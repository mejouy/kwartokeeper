const {
  getLeaseEndDate,
  getReminderThreshold,
  getLeaseReminderRecipients,
  buildLeaseReminderNotification,
  makeReminderKey,
} = require("./src/leaseReminder.js");

const INACTIVE_STATUSES = ["inactive", "archived", "deactivated"];

const isInactive = (record) =>
  INACTIVE_STATUSES.includes(
    String(record.status || "Active")
      .trim()
      .toLowerCase(),
  );

async function getPropertyCaretakers(db, propertyId, ownerId) {
  const snapshot = await db
    .collection("caretakers")
    .where("ownerUid", "==", ownerId)
    .where("assignedPropertyId", "==", propertyId)
    .get();

  return snapshot.docs
    .map((document) => ({ id: document.id, ...document.data() }))
    .filter((caretaker) => !isInactive(caretaker));
}

async function processLeaseReminders(db) {
  const now = new Date();

  const [tenantsSnapshot, usersSnapshot] = await Promise.all([
    db.collection("tenants").get(),
    db.collection("users").where("role", "==", "tenant").get(),
  ]);

  const tenantsById = new Map();

  usersSnapshot.docs.forEach((document) => {
    tenantsById.set(document.id, {
      id: document.id,
      ...document.data(),
    });
  });

  tenantsSnapshot.docs.forEach((document) => {
    tenantsById.set(document.id, {
      ...(tenantsById.get(document.id) || {}),
      ...document.data(),
      id: document.id,
    });
  });

  let due = 0;
  let created = 0;

  for (const tenant of tenantsById.values()) {
    if (isInactive(tenant)) continue;

    const endDate = getLeaseEndDate(tenant);
    const reminder = endDate ? getReminderThreshold(endDate, now) : null;

    if (!endDate || !reminder) continue;
    due += 1;

    const ownerId =
      tenant.ownerUid || tenant.ownerId || tenant.landlordUid || tenant.userId;

    const tenantId = tenant.uid || tenant.id;
    const tenantName = tenant.fullName || tenant.name || "Tenant";
    const propertyId = tenant.propertyId || tenant.assignedPropertyId;

    let caretakers = [];

    if (propertyId && ownerId) {
      caretakers = await getPropertyCaretakers(db, propertyId, ownerId);
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

      const reminderKey = makeReminderKey(tenantId, endDate, reminder.days);

      const notificationId = `${reminderKey}:${recipient.id}`;
      const notificationRef = db
        .collection("notifications")
        .doc(
          require("crypto")
            .createHash("sha256")
            .update(notificationId)
            .digest("hex"),
        );

      const wasCreated = await db.runTransaction(async (transaction) => {
        // Prevent duplicate creation using the stable document ID.
        const existing = await transaction.get(notificationRef);

        if (existing.exists) return false;

        // Check legacy notifications with random document IDs.
        const legacyQuery = db
          .collection("notifications")
          .where("tenantId", "==", tenantId);

        const legacySnapshot = await transaction.get(legacyQuery);

        const targetEndTime = endDate.getTime();

        const legacyExists = legacySnapshot.docs.some((doc) => {
          const old = doc.data();

          if (old.userId !== recipient.id) return false;
          if (Number(old.reminderDays) !== reminder.days) return false;
          if (old.reminderLabel !== reminder.label) return false;

          const oldEndDate = old.leaseEndDate?.toDate
            ? old.leaseEndDate.toDate()
            : new Date(old.leaseEndDate);

          return (
            !Number.isNaN(oldEndDate.getTime()) &&
            oldEndDate.getTime() === targetEndTime
          );
        });

        if (legacyExists) return false;

        transaction.set(notificationRef, notification);
        return true;
      });

      if (wasCreated) {
        created += 1;
      }
    }
  }

  return {
    tenants: tenantsById.size,
    due,
    created,
  };
}

function startLeaseReminderLoop(
  db,
  { intervalMinutes = 30, startDelaySeconds = 30 } = {},
) {
  let running = false;

  const run = async () => {
    if (running) return;

    running = true;

    try {
      const result = await processLeaseReminders(db);

      console.log(
        `[${new Date().toLocaleTimeString()}] [lease] checked ${result.tenants} tenant(s), ${result.due} due, ${result.created} notification(s) created`,
      );
    } catch (error) {
      console.error("[lease] check failed:", error);
    } finally {
      running = false;
    }
  };

  setTimeout(run, startDelaySeconds * 1000);
  setInterval(run, intervalMinutes * 60 * 1000);

  console.log(
    `[lease] reminder check starts in ${startDelaySeconds}s, then every ${intervalMinutes} min`,
  );
}

module.exports = {
  startLeaseReminderLoop,
  processLeaseReminders,
};
