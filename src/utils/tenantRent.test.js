import { billingForProperty } from "./tenantRent";
import { describe, expect, it, vi } from "vitest";

vi.mock("../config/firebase", () => ({ db: {}, auth: {} }));

const { leaseLengthText } = await import("./tenantRent");

describe("lease length comes from the dates", () => {
  it.each([
    ["2026-10-01", "2027-10-31", "1 year and 30 days"], // the case that showed "1 Day"
    ["2026-01-01", "2027-01-01", "1 year"],
    ["2026-01-15", "2026-07-15", "6 months"],
    ["2026-01-31", "2026-02-28", "28 days"], // February is shorter: not a full month
    ["2026-03-01", "2026-04-15", "1 month and 14 days"],
    ["2026-03-01", "2027-05-04", "1 year, 2 months and 3 days"],
    ["2026-03-01", "2026-03-02", "1 day"],
  ])("%s → %s is %s", (start, end, expected) => {
    expect(leaseLengthText(start, end)).toBe(expected);
  });
  it("accepts saved timestamps and ISO strings", () => {
    expect(leaseLengthText(new Date(2026, 9, 1), "2027-10-01T00:00:00.000Z".slice(0, 10))).toBe("1 year");
  });
  it("has no length without both dates, or with the end before the start", () => {
    expect(leaseLengthText("2026-10-01", null)).toBeNull();
    expect(leaseLengthText("", "2027-10-01")).toBeNull();
    expect(leaseLengthText("2027-10-01", "2026-10-01")).toBeNull();
    expect(leaseLengthText("2026-10-01", "2026-10-01")).toBeNull();
  });
});

// ---- Panel revisions: late fee, advance rent, billForMonth ----
const { advanceCreditFor, billForMonth, lateFeeLine } = await import("./tenantRent");

describe("automatic late fee", () => {
  const tenant = { id: "T1", monthlyRent: 3000, rentDueDay: 5, leaseStartDate: "2026-01-10" };
  const settings = { lateFee: { enabled: true, mode: "fixed", amount: 200, graceDays: 3 } };
  const nov = "November 2026";

  it("is added once the grace days have passed with the rent unpaid", () => {
    expect(lateFeeLine({ tenant, period: nov, rent: 3000, payments: [], settings, today: new Date(2026, 10, 8, 20) })).toBeNull();
    const line = lateFeeLine({ tenant, period: nov, rent: 3000, payments: [], settings, today: new Date(2026, 10, 9, 9) });
    expect(line).toMatchObject({ type: "penalty", label: "Late fee", amount: 200, auto: true });
  });

  it("can be a percentage of the rent, and can be off or waived", () => {
    const pct = { lateFee: { enabled: true, mode: "percent", amount: 5, graceDays: 0 } };
    expect(lateFeeLine({ tenant, period: nov, rent: 3000, settings: pct, today: new Date(2026, 10, 6) }).amount).toBe(150);
    expect(lateFeeLine({ tenant, period: nov, rent: 3000, settings: { lateFee: { ...settings.lateFee, enabled: false } }, today: new Date(2026, 10, 20) })).toBeNull();
    expect(lateFeeLine({ tenant: { ...tenant, lateFeeWaived: [nov] }, period: nov, rent: 3000, settings, today: new Date(2026, 10, 20) })).toBeNull();
  });

  it("never charges rent that was sent on time, even if checked later", () => {
    const onTime = [{ periodMonth: nov, status: "Pending", amount: 3000, paymentDate: new Date(2026, 10, 7) }];
    expect(lateFeeLine({ tenant, period: nov, rent: 3000, payments: onTime, settings, today: new Date(2026, 10, 20) })).toBeNull();
    const late = [{ periodMonth: nov, status: "Paid", amount: 3000, paymentDate: new Date(2026, 10, 15) }];
    expect(lateFeeLine({ tenant, period: nov, rent: 3000, payments: late, settings, today: new Date(2026, 10, 20) })).not.toBeNull();
  });

  it("skips a month the lease started after the due day", () => {
    expect(lateFeeLine({ tenant: { ...tenant, leaseStartDate: "2026-11-12" }, period: nov, rent: 3000, settings, today: new Date(2026, 10, 25) })).toBeNull();
  });
});

describe("advance rent and the month's bill", () => {
  const tenant = { id: "T1", monthlyRent: 3000, rentDueDay: 5 };
  const advance = { id: "a1", tenantId: "T1", type: "advance", label: "Advance rent", amount: 3000, repeat: "once", period: "November 2026", coversPeriods: ["December 2026"], status: "active" };
  const deposit = { id: "d1", tenantId: "T1", type: "deposit", label: "Security deposit", amount: 3000, repeat: "once", period: "November 2026", status: "active" };
  const charges = [advance, deposit];

  it("adds move-in fees to the move-in month", () => {
    const bill = billForMonth({ tenant, period: "November 2026", charges, payments: [] });
    expect(bill.total).toBe(9000);
    expect(bill.advanceCredit).toBe(0);
  });

  it("covers the next month once the move-in bill is paid", () => {
    const paid = [{ periodMonth: "November 2026", status: "Paid", amount: 9000 }];
    expect(advanceCreditFor({ tenant, period: "December 2026", charges, payments: [] })).toBe(0);
    expect(advanceCreditFor({ tenant, period: "December 2026", charges, payments: paid })).toBe(3000);
    const dec = billForMonth({ tenant, period: "December 2026", charges, payments: paid });
    expect(dec).toMatchObject({ baseRent: 3000, advanceCredit: 3000, coveredByAdvance: true, settled: true });
  });

  it("puts the late fee on the bill", () => {
    const settings = { lateFee: { enabled: true, mode: "fixed", amount: 250, graceDays: 2 } };
    const bill = billForMonth({ tenant, period: "January 2027", charges: [], payments: [], settings, today: new Date(2027, 0, 10) });
    expect(bill.total).toBe(3250);
    expect(bill.lateFee.amount).toBe(250);
  });
});

// ---- Due day: every 15th, every 30th, same date as the lease start, or custom ----
const { dueDateOn, dueRuleOf, resolveDueDay, rentStatusOf: statusOf } = await import("./tenantRent");

describe("rent due day", () => {
  it("works out the day for each choice", () => {
    expect(resolveDueDay({ mode: "15" }, "2026-11-03")).toBe(15);
    expect(resolveDueDay({ mode: "30" }, "2026-11-03")).toBe(30);
    expect(resolveDueDay({ mode: "lease" }, "2026-11-12")).toBe(12);
    expect(resolveDueDay({ mode: "custom", day: 31 })).toBe(31);
    expect(resolveDueDay({ mode: "custom", day: 40 })).toBe(31);
  });

  it("falls on the month's last day when the month is shorter", () => {
    expect(dueDateOn(2027, 1, 30).getDate()).toBe(28); // February 2027
    expect(dueDateOn(2028, 1, 30).getDate()).toBe(29); // leap year
    expect(dueDateOn(2026, 3, 31).getDate()).toBe(30); // April
    expect(dueDateOn(2026, 12, 30).getMonth()).toBe(0); // month 12 = next January
    const feb = statusOf({ id: "T1", monthlyRent: 3000, rentDueDay: 30, leaseStartDate: "2026-01-01" }, [], new Date(2027, 1, 28, 10));
    expect(feb.label).toBe("Due today");
  });

  it("reads older records that only have a day", () => {
    expect(dueRuleOf({ rentDueDay: 15 })).toEqual({ mode: "15", day: 15 });
    expect(dueRuleOf({ rentDueDay: 5 })).toEqual({ mode: "custom", day: 5 });
    expect(dueRuleOf({ rentDueDay: 12, rentDueMode: "lease" })).toEqual({ mode: "lease", day: 12 });
  });
});

describe("billing rules per property", () => {
  const owner = { lateFee: { enabled: true, mode: "fixed", amount: 100, graceDays: 3 }, defaultDueMode: "15", defaultDueDay: 15, propertyRules: { P2: { lateFee: { enabled: true, mode: "fixed", amount: 250, graceDays: 0 }, defaultDueMode: "custom", defaultDueDay: 5 } } };
  it("uses a property's own rules on top of the owner's", () => {
    expect(billingForProperty(owner, "P2").lateFee.amount).toBe(250);
    expect(billingForProperty(owner, "P2").defaultDueDay).toBe(5);
    expect(billingForProperty(owner, "P1").lateFee.amount).toBe(100);
    expect(billingForProperty(owner, "").lateFee.amount).toBe(100);
    expect(billingForProperty(null, "P2")).toBe(null);
  });
  it("is safe to apply twice", () => {
    expect(billingForProperty(billingForProperty(owner, "P2"), "P2").lateFee.amount).toBe(250);
  });
});
