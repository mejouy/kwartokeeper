const test = require("node:test");
const assert = require("node:assert/strict");
const { getOverdueInfo } = require("./overdue.js");

const tenant = {
  monthlyRent: 2500,
  rentDueDay: 5,
  leaseStartDate: "2026-09-01T00:00:00.000Z",
};

// Noon in Manila
const oct10 = new Date("2026-10-10T04:00:00.000Z");
const oct5 = new Date("2026-10-05T04:00:00.000Z");

test("overdue after the due day with no payment", () => {
  const info = getOverdueInfo(tenant, oct10, false);
  assert.equal(info.period, "October 2026");
  assert.equal(info.daysOverdue, 5);
  assert.equal(info.rent, 2500);
});

test("not overdue on the due day itself", () => {
  assert.equal(getOverdueInfo(tenant, oct5, false), null);
});

test("not overdue when a payment exists for the period", () => {
  assert.equal(getOverdueInfo(tenant, oct10, true), null);
});

test("skips a tenant who moved in after the due day", () => {
  const late = { ...tenant, leaseStartDate: "2026-10-18T00:00:00.000Z" };
  assert.equal(getOverdueInfo(late, oct10, false), null);
});

test("defaults the due day to 5", () => {
  const noDay = { ...tenant };
  delete noDay.rentDueDay;
  assert.equal(getOverdueInfo(noDay, oct10, false).dueDay, 5);
});

test("due the 30th: overdue the day after, and never in a shorter February", () => {
  const tenant = { monthlyRent: 3000, rentDueDay: 30, leaseStartDate: "2026-01-01" };
  const jan31 = getOverdueInfo(tenant, new Date("2027-01-31T04:00:00Z"), false);
  assert.equal(jan31.daysOverdue, 1);
  assert.equal(jan31.dueLabel, "Jan 30, 2027");
  // Feb 28, 2027 (Manila) is February's last day: due today, not overdue
  assert.equal(getOverdueInfo(tenant, new Date("2027-02-28T04:00:00Z"), false), null);
  // Due the 31st: April has 30 days, so April 30 is the due date itself
  assert.equal(getOverdueInfo({ ...tenant, rentDueDay: 31 }, new Date("2026-04-30T04:00:00Z"), false), null);
});
