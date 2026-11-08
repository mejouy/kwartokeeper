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
