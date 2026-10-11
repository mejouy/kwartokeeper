import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  serverTimestamp,
  where,
} from "firebase/firestore";
import { db } from "../config/firebase";

const REMINDER_DAYS = [30, 7, 3, 0];
const TIME_ZONE = "Asia/Manila";
const DAY_MS = 24 * 60 * 60 * 1000;
const INACTIVE = new Set(["inactive", "archived", "deactivated"]);
const lastCheckedDayByUser = new Map();

function asDate(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate();
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function manilaDayNumber(value) {
  const date = asDate(value);
  if (!date) return null;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "numeric",
    day: "numeric",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return Math.floor(Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day)) / DAY_MS);
}

function leaseEndDate(tenant) {
  const explicit = asDate(tenant.leaseEndDate || tenant.leaseEnd || tenant.endDate || tenant.moveOutDate);
  if (explicit) return explicit;

  const start = asDate(tenant.leaseStartDate || tenant.leaseStart || tenant.startDate || tenant.moveInDate);
  const duration = String(tenant.leaseDuration || "").trim().toLowerCase().replace(/_/g, " ");
  const match = duration.match(/^(\d+)\s*(day|days|week|weeks|month|months|year|years)$/);
  if (!start || !match) return null;

  const amount = Number(match[1]);
  const unit = match[2];
  if (unit.startsWith("month") || unit.startsWith("year")) {
    const months = amount * (unit.startsWith("year") ? 12 : 1);
    const day = start.getDate();
    start.setDate(1);
    start.setMonth(start.getMonth() + months);
    const lastDay = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate();
    start.setDate(Math.min(day, lastDay));
    return start;
  }

  const days = amount * (unit.startsWith("week") ? 7 : 1);
  return new Date(start.getTime() + days * DAY_MS);
}

function notificationText(tenant, endDate, days) {
  const name = tenant.fullName || tenant.name || "Tenant";
  const formattedDate = endDate.toLocaleDateString("en-US", {
    timeZone: TIME_ZONE,
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  return {
    title: days === 0 ? `${name}'s lease ends today` : `${name}'s lease is ending soon`,
    message: days === 0
      ? `${name}'s stay ends today (${formattedDate}). Please coordinate room turnover and move-out inspection.`
      : `${name} is scheduled to leave on ${formattedDate}. This is the ${days}-day lease reminder.`,
  };
}

async function getOwnerTenants(ownerUid) {
  const [tenantSnapshot, userSnapshot] = await Promise.all([
    getDocs(query(collection(db, "tenants"), where("ownerUid", "==", ownerUid))),
    getDocs(query(collection(db, "users"), where("ownerUid", "==", ownerUid))),
  ]);
  const tenants = new Map();

  userSnapshot.docs.forEach((document) => {
    const data = document.data();
    if (data.role === "tenant") tenants.set(document.id, { id: document.id, ...data });
  });
  tenantSnapshot.docs.forEach((document) => {
    const data = document.data();
    const id = data.uid || document.id;
    tenants.set(id, { ...(tenants.get(id) || {}), id, ...data });
  });

  return [...tenants.values()];
}

async function getOwnerCaretakers(ownerUid) {
  const [caretakerSnapshot, userSnapshot] = await Promise.all([
    getDocs(query(collection(db, "caretakers"), where("ownerUid", "==", ownerUid))),
    getDocs(query(collection(db, "users"), where("ownerUid", "==", ownerUid))),
  ]);
  const caretakers = new Map();

  userSnapshot.docs.forEach((document) => {
    const data = document.data();
    if (data.role === "caretaker") caretakers.set(document.id, { id: document.id, ...data });
  });
  caretakerSnapshot.docs.forEach((document) => {
    const data = document.data();
    const id = data.uid || data.userId || data.caretakerId || document.id;
    caretakers.set(id, { ...(caretakers.get(id) || {}), id, ...data });
  });

  return [...caretakers.values()].filter((caretaker) =>
    !INACTIVE.has(String(caretaker.status || "Active").trim().toLowerCase())
  );
}

export async function checkLeaseEndsOnOwnerAppOpen(ownerUid, requesterId = ownerUid) {
  if (!ownerUid || !requesterId) return;

  const now = new Date();
  const today = manilaDayNumber(now);
  if (lastCheckedDayByUser.get(requesterId) === today) return;
  const tenants = (await getOwnerTenants(ownerUid)).filter((tenant) =>
    !INACTIVE.has(String(tenant.status || "Active").trim().toLowerCase())
  );
  const caretakers = await getOwnerCaretakers(ownerUid);
  const notificationsRef = collection(db, "notifications");
  const requesterNotifications = await getDocs(
    query(notificationsRef, where("userId", "==", requesterId))
  );
  const isOwner = requesterId === ownerUid;

  for (const tenant of tenants) {
    const endDate = leaseEndDate(tenant);
    const endDay = endDate ? manilaDayNumber(endDate) : null;
    const days = endDay === null ? null : endDay - today;
    if (!REMINDER_DAYS.includes(days)) continue;

    const tenantId = tenant.uid || tenant.id;
    if (!isOwner && !caretakers.some((caretaker) => caretaker.id === requesterId && caretaker.assignedPropertyId === tenant.propertyId)) continue;
    const requesterProfile = caretakers.find((caretaker) => caretaker.id === requesterId);
    const recipientName = isOwner
      ? "Property owner"
      : requesterProfile?.name || requesterProfile?.fullName || "Caretaker";

    const endDateIso = endDate.toISOString();
    const text = notificationText(tenant, endDate, days);

    const alreadySentToday = requesterNotifications.docs.some((document) => {
      const notification = document.data();
      return notification.tenantId === tenantId &&
        notification.leaseEndDate === endDateIso &&
        Number(notification.reminderDays) === days &&
        manilaDayNumber(notification.createdAt) === today;
    });
    if (alreadySentToday) continue;

    await addDoc(notificationsRef, {
      userId: requesterId,
      ownerId: ownerUid,
      createdBy: requesterId,
      tenantId,
      tenantName: tenant.fullName || tenant.name || "Tenant",
      recipientName,
      propertyId: tenant.propertyId || "",
      type: days === 0 ? "lease-expired" : "lease-ending",
      title: text.title,
      message: text.message,
      leaseEndDate: endDateIso,
      reminderDays: days,
      reminderLabel: days === 0 ? "today" : `${days} days`,
      createdAt: serverTimestamp(),
      isRead: false,
    });
  }
  lastCheckedDayByUser.set(requesterId, today);
}

export async function checkLeaseEndsOnTenantAppOpen(tenantUid) {
  if (!tenantUid) return;

  const now = new Date();
  const today = manilaDayNumber(now);
  if (lastCheckedDayByUser.get(tenantUid) === today) return;

  const [userSnapshot, tenantSnapshot] = await Promise.all([
    getDoc(doc(db, "users", tenantUid)),
    getDoc(doc(db, "tenants", tenantUid)),
  ]);
  const tenant = {
    ...(userSnapshot.exists() ? userSnapshot.data() : {}),
    id: tenantUid,
    ...(tenantSnapshot.exists() ? tenantSnapshot.data() : {}),
  };
  if (!userSnapshot.exists() && !tenantSnapshot.exists()) return;
  if (INACTIVE.has(String(tenant.status || "Active").trim().toLowerCase())) return;

  const endDate = leaseEndDate(tenant);
  const endDay = endDate ? manilaDayNumber(endDate) : null;
  const days = endDay === null ? null : endDay - today;
  if (!REMINDER_DAYS.includes(days)) return;

  const notificationsRef = collection(db, "notifications");
  const existingNotifications = await getDocs(
    query(notificationsRef, where("userId", "==", tenantUid))
  );
  const endDateIso = endDate.toISOString();
  const alreadySentToday = existingNotifications.docs.some((document) => {
    const notification = document.data();
    return notification.tenantId === tenantUid &&
      notification.leaseEndDate === endDateIso &&
      Number(notification.reminderDays) === days &&
      manilaDayNumber(notification.createdAt) === today;
  });

  if (!alreadySentToday) {
    const text = notificationText(tenant, endDate, days);
    await addDoc(notificationsRef, {
      userId: tenantUid,
      ownerId: tenant.ownerUid || tenant.ownerId || tenant.landlordUid || tenant.invitedBy || "",
      createdBy: tenantUid,
      tenantId: tenantUid,
      tenantName: tenant.fullName || tenant.name || "Tenant",
      recipientName: tenant.fullName || tenant.name || "Tenant",
      propertyId: tenant.propertyId || tenant.assignedPropertyId || "",
      type: days === 0 ? "lease-expired" : "lease-ending",
      title: text.title,
      message: text.message,
      leaseEndDate: endDateIso,
      reminderDays: days,
      reminderLabel: days === 0 ? "today" : `${days} days`,
      createdAt: serverTimestamp(),
      isRead: false,
    });
  }

  lastCheckedDayByUser.set(tenantUid, today);
}
