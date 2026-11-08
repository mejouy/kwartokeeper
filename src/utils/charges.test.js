import { describe, expect, it, vi } from "vitest";

vi.mock("../config/firebase", () => ({ db: {}, auth: {} }));

const { billSnapshot, chargeAppliesTo, chargesFor, feePeriodOptions, monthBill, periodFromIndex, periodIndex, splitAmount } = await import("./charges");

const paid = (amount) => ({ status: "Paid", amount });
const partial = (amount) => ({ status: "Partial", amount });
const pending = (amount) => ({ status: "Pending", amount });
const elec = { id: "e", tenantId: "t1", label: "Electricity", amount: 350, repeat: "once", period: "November 2026", status: "active" };
const wifi = { id: "w", tenantId: "t1", label: "Wi-Fi", amount: 200, repeat: "monthly", period: "October 2026", status: "active" };
const fees = [elec, wifi];

describe("months", () => {
  it("turns a month label into a number and back", () => {
    expect(periodFromIndex(periodIndex("November 2026"))).toBe("November 2026");
    expect(periodIndex("nonsense")).toBeNull();
  });
  it("offers three months back to three ahead", () => {
    expect(feePeriodOptions(new Date(2026, 10, 7))).toEqual(["August 2026", "September 2026", "October 2026", "November 2026", "December 2026", "January 2027", "February 2027"]);
  });
});

describe("which months a fee counts for", () => {
  it("one-month fees count only in their month", () => {
    expect(chargeAppliesTo(elec, "November 2026")).toBe(true);
    expect(chargeAppliesTo(elec, "December 2026")).toBe(false);
  });
  it("monthly fees count from their first month until stopped", () => {
    expect(chargeAppliesTo(wifi, "September 2026")).toBe(false);
    expect(chargeAppliesTo(wifi, "March 2027")).toBe(true);
    expect(chargeAppliesTo({ ...wifi, endPeriod: "November 2026" }, "November 2026")).toBe(true);
    expect(chargeAppliesTo({ ...wifi, endPeriod: "November 2026" }, "December 2026")).toBe(false);
  });
  it("removed fees never count", () => {
    expect(chargeAppliesTo({ ...elec, status: "removed" }, "November 2026")).toBe(false);
  });
  it("picks one tenant's fees", () => {
    expect(chargesFor([elec, wifi, { ...elec, tenantId: "t2" }], "t1", "November 2026")).toHaveLength(2);
  });
});

describe("a month's bill", () => {
  it("adds fees to the rent", () => {
    const b = monthBill(3000, fees, []);
    expect([b.total, b.balance, b.settled]).toEqual([3550, 3550, false]);
  });
  it("leaves fees owing when only the rent was paid", () => {
    const b = monthBill(3000, fees, [paid(3000)]);
    expect([b.balance, b.settled, b.hasPaid]).toEqual([550, false, true]);
  });
  it("is settled when everything was paid, in one or several payments", () => {
    expect(monthBill(3000, fees, [paid(3550)]).settled).toBe(true);
    expect(monthBill(3000, fees, [paid(3000), partial(550)]).settled).toBe(true);
    expect(monthBill(3000, fees, [partial(1000), partial(2550)]).settled).toBe(true);
  });
  it("treats rent marked Paid as settled even when the owner accepted less", () => {
    expect(monthBill(3000, [], [paid(2800)])).toMatchObject({ balance: 0, settled: true });
  });
  it("keeps a partial balance", () => {
    expect(monthBill(3000, fees, [partial(1000)]).balance).toBe(2550);
  });
  it("doesn't count payments still waiting for review", () => {
    expect(monthBill(3000, fees, [pending(3550)])).toMatchObject({ balance: 3550, pending: true, settled: false });
  });
  it("adds centavos without floating-point errors", () => {
    expect(monthBill(0.1, [{ amount: 0.2 }], []).total).toBe(0.3);
  });
  it("is never settled when nothing is owed", () => {
    expect(monthBill(0, [], []).settled).toBe(false);
  });
});

describe("splitting one bill", () => {
  it("splits to the centavo and adds back up", () => {
    const parts = splitAmount(1000, 3);
    expect(parts).toEqual([333.34, 333.33, 333.33]);
    expect(parts.reduce((s, x) => s + x, 0).toFixed(2)).toBe("1000.00");
  });
  it("handles nothing to split", () => {
    expect(splitAmount(100, 0)).toEqual([]);
  });
});

it("saves what a month was billed at on the payment", () => {
  expect(billSnapshot(3000, fees)).toEqual({ rent: 3000, fees: [{ label: "Electricity", amount: 350 }, { label: "Wi-Fi", amount: 200 }], total: 3550 });
});
