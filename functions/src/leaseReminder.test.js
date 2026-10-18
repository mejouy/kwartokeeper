const test = require("node:test");
const assert = require("node:assert/strict");

const {
  getLeaseEndDate,
  getReminderThreshold,
  hasReminderSentToday,
  getLeaseReminderRecipients,
  makeReminderKey,
  buildLeaseReminderNotification,
} = require("./leaseReminder.js");

test("resolves explicit lease end dates from supported aliases", () => {
  const leaseEnd = new Date("2026-11-10T00:00:00.000Z");
  assert.equal(
    getLeaseEndDate({ leaseEndDate: leaseEnd }).toISOString(),
    leaseEnd.toISOString()
  );
  assert.equal(
    getLeaseEndDate({ endDate: "2026-11-11T00:00:00.000Z" }).toISOString(),
    "2026-11-11T00:00:00.000Z"
  );
});

test("calculates a lease end date from start date and duration", () => {
  const endDate = getLeaseEndDate({
    leaseStartDate: "2026-10-01T00:00:00.000Z",
    leaseDuration: "3_months",
  });

  assert.equal(endDate.toISOString(), "2027-01-01T00:00:00.000Z");
});

test("selects exact supported calendar-day reminder thresholds", () => {
  const now = new Date("2026-10-01T12:00:00.000Z");
  const endDate = new Date("2026-10-31T12:00:00.000Z");

  assert.deepEqual(getReminderThreshold(endDate, now), {
    days: 30,
    label: "one month",
  });

  assert.deepEqual(
    getReminderThreshold(new Date("2026-10-08T12:00:00.000Z"), now),
    { days: 7, label: "one week" }
  );

  assert.deepEqual(
    getReminderThreshold(new Date("2026-10-04T12:00:00.000Z"), now),
    { days: 3, label: "three days" }
  );

  assert.equal(getReminderThreshold(new Date("2026-10-30T12:00:00.000Z"), now), null);
});

test("creates a stable key for duplicate suppression", () => {
  assert.equal(
    makeReminderKey("tenant-1", "2026-11-01T00:00:00.000Z", 7),
    "tenant-1:2026-11-01T00:00:00.000Z:7"
  );
});

test("selects the 0-day threshold when the lease ends today", () => {
  const now = new Date("2026-10-31T00:00:00.000Z");
  const endDate = new Date("2026-10-31T15:00:00.000Z");

  assert.deepEqual(getReminderThreshold(endDate, now), {
    days: 0,
    label: "today",
  });
});

test("includes the tenant, owner, and assigned caretakers once each", () => {
  assert.deepEqual(
    getLeaseReminderRecipients({
      tenantId: "tenant-1",
      tenantName: "Ari Santos",
      ownerId: "owner-1",
      caretakers: [
        { id: "caretaker-1", name: "Bea Reyes" },
        { id: "owner-1", name: "Duplicate owner" },
        { id: "caretaker-1", name: "Duplicate caretaker" },
      ],
    }),
    [
      { id: "tenant-1", name: "Ari Santos" },
      { id: "owner-1", name: "Property owner" },
      { id: "caretaker-1", name: "Bea Reyes" },
    ]
  );
});

test("builds a day-of lease-ended notification for each recipient", () => {
  const notification = buildLeaseReminderNotification({
    tenantId: "tenant-1",
    tenantName: "Ari Santos",
    ownerId: "owner-1",
    recipientId: "caretaker-1",
    recipientName: "Bea Reyes",
    endDate: "2026-10-31T15:00:00.000Z",
    days: 0,
    label: "today",
  });

  assert.equal(notification.userId, "caretaker-1");
  assert.equal(notification.recipientName, "Bea Reyes");
  assert.equal(notification.type, "lease-expired");
  assert.match(notification.title, /lease has ended/);
  assert.match(notification.message, /today/);
});

test("an early legacy day-of notice does not suppress the actual end-day notice", () => {
  const reminder = { days: 0, label: "today" };
  const oldNotice = {
    reminderDays: 0,
    reminderLabel: "today",
    createdAt: new Date("2026-10-01T12:00:00.000Z"),
  };
  const sentToday = {
    reminderDays: 0,
    reminderLabel: "today",
    createdAt: new Date("2026-10-31T12:00:00.000Z"),
  };

  assert.equal(hasReminderSentToday([oldNotice], reminder, new Date("2026-10-31T12:00:00.000Z")), false);
  assert.equal(hasReminderSentToday([sentToday], reminder, new Date("2026-10-31T12:00:00.000Z")), true);
});
