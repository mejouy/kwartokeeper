import { describe, expect, it, vi } from "vitest";

vi.mock("../config/firebase", () => ({ db: {}, auth: {} }));

const { tenantRentReminder } = await import("./rentReminders");
const { rentStatusOf } = await import("./tenantRent");

const tenant = { id: "T", status: "Active", monthlyRent: 3000, rentDueDay: 5, leaseStartDate: "2026-01-01" };
const fees = [{ tenantId: "T", amount: 350, repeat: "once", period: "November 2026", status: "active" }];
const on = (day) => new Date(2026, 10, day, 10);
const reminderOn = (day, payments = [], charges = fees, t = tenant) => tenantRentReminder(rentStatusOf(t, payments, on(day), charges), on(day));
const paidRent = { tenantId: "T", periodMonth: "November 2026", status: "Paid", amount: 3000 };

describe("tenant rent reminders", () => {
  it("says nothing more than 3 days before the due day", () => {
    expect(reminderOn(1)).toBeNull();
  });
  it("reminds 3 days before, with rent plus fees", () => {
    const r = reminderOn(2);
    expect(r.stage).toBe("due-soon");
    expect(r.message).toMatch(/₱3,350/);
    expect(reminderOn(4).title).toBe("Rent is due in 1 day");
  });
  it("reminds on the due day", () => {
    expect(reminderOn(5).stage).toBe("due-today");
  });
  it("reminds when overdue, then once a week", () => {
    expect(reminderOn(6)).toMatchObject({ stage: "overdue-w0", type: "error" });
    expect(reminderOn(6).message).toMatch(/1 day ago/);
    expect(reminderOn(12).stage).toBe("overdue-w0");
    expect(reminderOn(13).stage).toBe("overdue-w1");
  });
  it("only asks for the fees when the rent itself was paid", () => {
    expect(reminderOn(6, [paidRent]).message).toMatch(/₱350/);
  });
  it("stops once everything is paid or waiting for review", () => {
    expect(reminderOn(6, [{ ...paidRent, amount: 3350 }])).toBeNull();
    expect(reminderOn(6, [{ ...paidRent, status: "Pending", amount: 3350 }])).toBeNull();
  });
  it("never reminds former tenants", () => {
    expect(reminderOn(6, [], fees, { ...tenant, status: "Inactive" })).toBeNull();
  });
});
