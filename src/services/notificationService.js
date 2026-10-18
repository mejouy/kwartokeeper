// src/services/notificationService.js
//
// Fills the gaps in maintenance notifications. Existing code already notifies the
// tenant on status changes and the owner on tenant follow-ups, so this service
// does NOT repeat those. It covers:
//   - new ticket submitted: owner + assigned caretakers (alert), tenant (confirmation)
//   - status changed: owner + assigned caretakers (never the tenant, already handled)
//   - ticket cancelled: owner + assigned caretakers
//   - tenant follow-up: assigned caretakers
// The person who triggered the action is never notified about their own action.
//
// Documents follow the same shape as the existing maintenance notices so the
// in-app NotificationFeed treats them the same. The push listener
// (localPushListener.js) sends the FCM push for every new notifications doc.
//
// Firestore rules: creating a notification requires createdBy == auth uid, which
// is always set here. Caretakers are looked up through `users` (tenants cannot
// read the `caretakers` collection).
//
// Notifications must never break the main action, so every exported function
// catches its own errors and never throws.

import { addDoc, collection, getDocs, query, where } from "firebase/firestore";
import { auth, db } from "../config/firebase";

const INACTIVE_STATUSES = ["inactive", "archived", "deactivated"];
const URGENT_CATEGORIES = ["safety", "emergency", "urgent"];
const URGENT_PRIORITIES = ["urgent", "high", "emergency", "critical"];

const isActive = (user) =>
  !INACTIVE_STATUSES.includes(
    String(user.status || "Active")
      .trim()
      .toLowerCase(),
  );

// Firestore rejects `undefined` values, so drop them.
const clean = (object) =>
  Object.fromEntries(
    Object.entries(object).filter(([, value]) => value !== undefined),
  );

async function createNotification({
  userId,
  kind,
  type,
  title,
  message,
  ownerId,
  actorRole,
  extra,
}) {
  if (!userId) return;
  await addDoc(
    collection(db, "notifications"),
    clean({
      userId,
      kind,
      category: "maintenance",
      type,
      title,
      message,
      ownerId: ownerId || null,
      isRead: false,
      createdBy: auth.currentUser?.uid || null,
      createdByRole: actorRole || null,
      createdAt: new Date().toISOString(),
      ...extra,
    }),
  );
}

// Sends one notification to each unique recipient (actor skipped by default).
async function notifyUsers(userIds, payload, { includeActor = false } = {}) {
  const actorUid = auth.currentUser?.uid;
  const unique = [...new Set(userIds.filter(Boolean))].filter(
    (id) => includeActor || id !== actorUid,
  );
  await Promise.all(
    unique.map((userId) =>
      createNotification({ ...payload, userId }).catch((error) =>
        console.warn("Notification not created:", error?.code || error),
      ),
    ),
  );
}

// Active caretakers assigned to a property who may handle reports.
export async function getCaretakerUids(propertyId, { permission } = {}) {
  if (!propertyId) return [];
  try {
    const snapshot = await getDocs(
      query(
        collection(db, "users"),
        where("role", "==", "caretaker"),
        where("assignedPropertyId", "==", propertyId),
      ),
    );
    return snapshot.docs
      .map((document) => ({ uid: document.id, ...document.data() }))
      .filter(isActive)
      .filter((user) => !permission || user.permissions?.[permission] === true)
      .map((user) => user.uid);
  } catch (error) {
    console.warn("Could not look up caretakers:", error?.code || error);
    return [];
  }
}

// Reads the ticket fields we need (matches the maintenance_tickets documents).
function readTicket(ticket = {}) {
  const rawPriority =
    typeof ticket.priority === "object"
      ? ticket.priority?.tier
      : ticket.priority;
  const priority = String(rawPriority || "")
    .trim()
    .toLowerCase();
  const category = String(ticket.category || "")
    .trim()
    .toLowerCase();
  const room = ticket.roomNumber || ticket.roomName || ticket.room || "";
  return {
    ticketId: ticket.id || null,
    title: ticket.title || "Maintenance request",
    roomText: room ? ` (Room ${room})` : "",
    tenantName: ticket.tenantName || "",
    tenantUid: ticket.tenantUid || ticket.tenantId || null,
    ownerUid: ticket.ownerUid || null,
    propertyId: ticket.propertyId || ticket.assignedPropertyId || null,
    urgent:
      ticket.urgent === true ||
      URGENT_CATEGORIES.includes(category) ||
      URGENT_PRIORITIES.includes(priority),
  };
}

/**
 * A tenant just created a ticket.
 * `ticket` = ticket data plus its id: { id, ...data }
 */
export async function notifyMaintenanceSubmitted(ticket, actorRole = "tenant") {
  try {
    const t = readTicket(ticket);
    const extra = { ticketId: t.ticketId };
    const caretakers = await getCaretakerUids(t.propertyId, {
      permission: "handleReports",
    });

    await notifyUsers([t.ownerUid, ...caretakers], {
      kind: t.urgent ? "maintenance_urgent" : "maintenance_new",
      type: t.urgent ? "warning" : "info",
      title: t.urgent ? "Urgent Maintenance Alert" : "New Maintenance Request",
      message: `${t.tenantName || "A tenant"} reported "${t.title}"${t.roomText}.`,
      ownerId: t.ownerUid,
      actorRole,
      extra,
    });

    await notifyUsers(
      [t.tenantUid],
      {
        kind: "maintenance_confirmation",
        type: "success",
        title: "Maintenance Request Submitted",
        message: `Your request "${t.title}"${t.roomText} has been submitted.`,
        ownerId: t.ownerUid,
        actorRole,
        extra,
      },
      { includeActor: true },
    );
  } catch (error) {
    console.warn("notifyMaintenanceSubmitted failed:", error);
  }
}

/**
 * The status of a ticket changed (by a caretaker or the owner).
 * Notifies the owner and assigned caretakers. The tenant is NOT notified here
 * because the existing code already does that.
 */
export async function notifyMaintenanceStatusChanged(
  ticket,
  newStatus,
  actorRole,
) {
  try {
    const t = readTicket(ticket);
    const status = String(newStatus || "").trim();
    if (!status) return;

    const resolved = status.toLowerCase() === "resolved";
    const caretakers = await getCaretakerUids(t.propertyId, {
      permission: "handleReports",
    });

    await notifyUsers([t.ownerUid, ...caretakers], {
      kind: "maintenance_update",
      type: resolved ? "success" : "info",
      title: resolved ? "Maintenance Completed" : "Maintenance Update",
      message: `"${t.title}"${t.roomText} is now ${status}.`,
      ownerId: t.ownerUid,
      actorRole,
      extra: { ticketId: t.ticketId, status },
    });
  } catch (error) {
    console.warn("notifyMaintenanceStatusChanged failed:", error);
  }
}

/**
 * A ticket was cancelled (by the tenant or the owner).
 * Notifies the owner and assigned caretakers. The tenant is not notified here
 * (they either did it themselves, or the existing owner code already tells them).
 */
export async function notifyMaintenanceCancelled(ticket, actorRole) {
  try {
    const t = readTicket(ticket);
    const caretakers = await getCaretakerUids(t.propertyId, {
      permission: "handleReports",
    });

    await notifyUsers([t.ownerUid, ...caretakers], {
      kind: "maintenance_cancelled",
      type: "warning",
      title: "Request Cancelled",
      message: `The request "${t.title}"${t.roomText} was cancelled.`,
      ownerId: t.ownerUid,
      actorRole,
      extra: { ticketId: t.ticketId },
    });
  } catch (error) {
    console.warn("notifyMaintenanceCancelled failed:", error);
  }
}

/**
 * The tenant added a follow-up to a ticket.
 * Notifies assigned caretakers only (the existing code already tells the owner).
 */
export async function notifyMaintenanceFollowUp(ticket, actorRole = "tenant") {
  try {
    const t = readTicket(ticket);
    const caretakers = await getCaretakerUids(t.propertyId, {
      permission: "handleReports",
    });

    await notifyUsers(caretakers, {
      kind: "maintenance_followup",
      type: "info",
      title: "Request Updated",
      message: `${t.tenantName || "The tenant"} added an update to "${t.title}"${t.roomText}.`,
      ownerId: t.ownerUid,
      actorRole,
      extra: { ticketId: t.ticketId },
    });
  } catch (error) {
    console.warn("notifyMaintenanceFollowUp failed:", error);
  }
}

/**
 * A tenant just submitted a rent payment (status "Pending").
 * Notifies the owner and the property's caretakers who can view financials.
 * `payment` = payment data plus its id: { id, ...data }
 */
export async function notifyPaymentSubmitted(payment = {}, actorRole = "tenant") {
  try {
    const propertyId = payment.propertyId || null;
    const ownerUid = payment.ownerUid || null;
    const caretakerUids = await getCaretakerUids(propertyId, {
      permission: "viewFinancials",
    });
    const who = payment.tenantName || "A tenant";
    const room =
      payment.roomNumber && payment.roomNumber !== "N/A"
        ? ` (Room ${payment.roomNumber})`
        : "";
    const amount = Number(payment.amount);
    const amountText = Number.isFinite(amount)
      ? `PHP ${amount.toLocaleString("en-PH")}`
      : "a payment";
    await notifyUsers([ownerUid, ...caretakerUids], {
      kind: "payment",
      type: "info",
      title: "Payment awaiting review",
      message: `${who}${room} submitted ${amountText} for ${payment.periodMonth || "this month"}. Please review it.`,
      ownerId: ownerUid,
      actorRole,
      extra: {
        category: "payment",
        paymentId: payment.id || null,
        propertyId,
        tenantId: payment.tenantId || null,
      },
    });
  } catch (error) {
    console.warn("Payment notification failed:", error?.code || error);
  }
}

/**
 * A caretaker just recorded a cash payment. Notifies the owner.
 * (The tenant is already notified by the existing code.)
 */
export async function notifyCashPaymentRecorded(
  payment = {},
  actorRole = "caretaker",
) {
  try {
    const ownerUid = payment.ownerUid || null;
    const room =
      payment.roomNumber && payment.roomNumber !== "N/A"
        ? ` (Room ${payment.roomNumber})`
        : "";
    const amount = Number(payment.amount);
    const amountText = Number.isFinite(amount)
      ? `PHP ${amount.toLocaleString("en-PH")}`
      : "a cash payment";
    await notifyUsers([ownerUid], {
      kind: "payment",
      type: "success",
      title: "Cash payment recorded",
      message: `Your caretaker recorded ${amountText} from ${payment.tenantName || "a tenant"}${room} for ${payment.periodMonth || "this month"}.`,
      ownerId: ownerUid,
      actorRole,
      extra: {
        category: "payment",
        paymentId: payment.id || null,
        propertyId: payment.propertyId || null,
      },
    });
  } catch (error) {
    console.warn("Cash payment notification failed:", error?.code || error);
  }
}
