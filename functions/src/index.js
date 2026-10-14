const { onSchedule } = require("firebase-functions/v2/scheduler");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const {
  getLeaseEndDate,
  getReminderThreshold,
  hasReminderSentToday,
  getLeaseReminderRecipients,
  buildLeaseReminderNotification,
} = require("./leaseReminder.js");

initializeApp();
const db = getFirestore();

async function getPropertyCaretakers(propertyId, ownerId) {
  const snapshot = await db
    .collection("caretakers")
    .where("ownerUid", "==", ownerId)
    .where("assignedPropertyId", "==", propertyId)
    .get();

  return snapshot.docs
    .map((document) => ({
      id: document.id,
      ...document.data(),
    }))
    .filter(
      (caretaker) =>
        !["inactive", "archived", "deactivated"].includes(
          String(caretaker.status || "Active")
            .trim()
            .toLowerCase(),
        ),
    );
}

async function processLeaseReminders() {
  const now = new Date();
  const [tenantsSnapshot, usersSnapshot] = await Promise.all([
    db.collection("tenants").get(),
    db.collection("users").where("role", "==", "tenant").get(),
  ]);
  const tenantsById = new Map();
  usersSnapshot.docs.forEach((document) => {
    tenantsById.set(document.id, { id: document.id, ...document.data() });
  });
  tenantsSnapshot.docs.forEach((document) => {
    tenantsById.set(document.id, {
      ...(tenantsById.get(document.id) || {}),
      id: document.id,
      ...document.data(),
    });
  });

  for (const tenant of tenantsById.values()) {
    if (
      ["inactive", "archived", "deactivated"].includes(
        String(tenant.status || "Active")
          .trim()
          .toLowerCase(),
      )
    )
      continue;
    const endDate = getLeaseEndDate(tenant);
    const reminder = getReminderThreshold(endDate, now);
    if (!endDate || !reminder) continue;

    const ownerId =
      tenant.ownerUid || tenant.ownerId || tenant.landlordUid || tenant.userId;
    const tenantId = tenant.uid || tenant.id;
    const tenantName = tenant.fullName || tenant.name || "Tenant";
    const propertyId = tenant.propertyId || tenant.assignedPropertyId;
    let caretakers = [];

    if (propertyId && ownerId) {
      caretakers = await getPropertyCaretakers(propertyId, ownerId);
    }

    const recipients = getLeaseReminderRecipients({
      tenantId,
      tenantName,
      ownerId,
      caretakers,
    });

    for (const recipient of recipients) {
      if (!recipient.id) continue;

      const notification = buildLeaseReminderNotification({
        tenantId,
        tenantName,
        ownerId,
        recipientId: recipient.id,
        recipientName: recipient.name,
        endDate,
        days: reminder.days,
        label: reminder.label,
      });

      const existing = await db
        .collection("notifications")
        .where("tenantId", "==", tenantId)
        .where("userId", "==", recipient.id)
        .where("leaseEndDate", "==", notification.leaseEndDate)
        .get();

      if (
        !hasReminderSentToday(
          existing.docs.map((document) => document.data()),
          reminder,
          now,
        )
      ) {
        await db.collection("notifications").add(notification);
      }
    }
  }
}

exports.processLeaseReminders = onSchedule(
  {
    schedule: "every 30 minutes",
    timeZone: "Asia/Manila",
    retryConfig: { maxAttempts: 3, minBackoffSeconds: 5 },
  },
  async () => {
    await processLeaseReminders();
  },
);

exports.sendPushOnNotification =
  require("./pushNotifications").sendPushOnNotification;
