const test = require("node:test");
const assert = require("node:assert/strict");

const {
  getLeaseEndDate,
  getReminderThreshold,
  makeReminderKey,
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

  assert.equal(endDate.toISOString(), "2026-12-30T00:00:00.000Z");
});

test("selects the nearest supported reminder threshold", () => {
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
});

test("creates a stable key for duplicate suppression", () => {
  assert.equal(
    makeReminderKey("tenant-1", "2026-11-01T00:00:00.000Z", 7),
    "tenant-1:2026-11-01T00:00:00.000Z:7"
  );
});
