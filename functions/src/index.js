const { onSchedule } = require("firebase-functions/v2/scheduler");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const {
  getLeaseEndDate,
  getReminderThreshold,
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

  return snapshot.docs.map((document) => ({
    id: document.id,
    ...document.data(),
  }));
}

async function processLeaseReminders() {
  const now = new Date();
  const tenantsSnapshot = await db.collection("tenants").get();

  for (const tenantDocument of tenantsSnapshot.docs) {
    const tenant = { id: tenantDocument.id, ...tenantDocument.data() };
    const endDate = getLeaseEndDate(tenant);
    const reminder = getReminderThreshold(endDate, now);
    if (!endDate || !reminder) continue;

    const ownerId = tenant.ownerUid || tenant.userId || tenant.uid;
    const tenantId = tenant.id || tenantDocument.id;
    const tenantName = tenant.fullName || tenant.name || "Tenant";
    const propertyId = tenant.propertyId || tenant.assignedPropertyId;
    const recipients = [{ id: tenantId, name: tenantName }];

    if (ownerId) {
      recipients.push({ id: ownerId, name: "Property owner" });
    }

    if (propertyId && ownerId) {
      const caretakers = await getPropertyCaretakers(propertyId, ownerId);
      recipients.push(
        ...caretakers
          .filter((caretaker) => caretaker.id !== ownerId)
          .map((caretaker) => ({
            id: caretaker.id,
            name: caretaker.name || caretaker.fullName || "Caretaker",
          }))
      );
    }

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
        .where("reminderDays", "==", reminder.days)
        .where("leaseEndDate", "==", notification.leaseEndDate)
        .get();

      if (existing.empty) {
        await db.collection("notifications").add(notification);
      }
    }
  }
}

exports.processLeaseReminders = onSchedule({
  schedule: "every 30 minutes",
  timeZone: "Asia/Manila",
  retryConfig: { maxAttempts: 3, minBackoffSeconds: 5 },
}, async () => {
  await processLeaseReminders();
});
