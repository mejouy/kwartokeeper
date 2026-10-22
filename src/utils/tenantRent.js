// Shared tenant status, rent and lease rules for the owner's Tenants list and
// tenant profile, so both pages always say the same thing.
//
// Rent rules match the server's overdue reminders (functions/src/overdue.js):
// due on the tenant's due day (default the 5th); overdue once that has passed
// with no PAID payment for the month; no rent owed before the lease starts or
// after it ends.
import { addMonthsClamped } from "./addMonthsClamped";

export const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export const DAY_MS = 86400000;

/**
 * One status per tenant, whatever spelling it was saved with
 * ("Active"/"active", "Pending"/"Pending Onboarding", "Inactive"/"archived"...).
 */
export const normalizeStatus = (raw) => {
  const s = String(raw || "Active").trim().toLowerCase();
  if (s.includes("pending")) return "Pending";
  if (["inactive", "archived", "deactivated", "moved out", "moved_out"].includes(s)) return "Inactive";
  return "Active";
};
export const STATUS_TONE = { Active: "success", Pending: "warning", Inactive: "default" };

export const toDate = (v) => {
  if (!v) return null;
  if (typeof v?.toDate === "function") return v.toDate();
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v;
  // "2026-10-05" (date inputs) is a LOCAL date, not UTC midnight
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v)) {
    const [y, m, d] = v.split("-").map(Number);
    return new Date(y, m - 1, d);
  }
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};
export const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
export const daysFrom = (from, to) => Math.round((startOfDay(to) - startOfDay(from)) / DAY_MS);
const shortDate = (d) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
export const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

export const rentOf = (t) => Number(t.monthlyRent ?? t.rentAmount ?? t.roomMonthlyRate ?? t.monthlyRate ?? t.rent ?? 0) || 0;
export const dueDayOf = (t) => Math.min(Math.max(Number(t.rentDueDay || t.dueDay || 5), 1), 28);
const LEASE_MONTHS = { "1_month": 1, "3_months": 3, "6_months": 6, "12_months": 12 };
export const leaseStartOf = (t) => toDate(t.leaseStartDate || t.leaseStart || t.startDate || t.moveInDate);
export const leaseEndOf = (t) => {
  const end = toDate(t.leaseEndDate || t.leaseEnd || t.endDate || t.moveOutDate);
  if (end) return end;
  const start = leaseStartOf(t);
  const months = LEASE_MONTHS[t.leaseDuration];
  return start && months ? addMonthsClamped(new Date(start), months) : null;
};

/** The month a payment is for, e.g. "October 2026" (falls back to its date). */
export const paymentPeriodOf = (p) => {
  if (p.periodMonth) return String(p.periodMonth).trim();
  const d = toDate(p.paymentDate || p.createdAt);
  return d ? `${MONTHS[d.getMonth()]} ${d.getFullYear()}` : "";
};

/**
 * This month's rent for one tenant: { key, label, tone, rank, due }.
 * rank orders "most urgent first" (overdue = 0).
 */
export function rentStatusOf(t, tenantPayments, today) {
  if (normalizeStatus(t.status) === "Inactive") return { key: "na", label: "—", tone: "none", rank: 9 };
  if (rentOf(t) <= 0) return { key: "none", label: "No rent set", tone: "default", rank: 7 };

  const y = today.getFullYear();
  const m = today.getMonth();
  const period = `${MONTHS[m]} ${y}`.toLowerCase();
  const forThisMonth = tenantPayments.filter((p) => paymentPeriodOf(p).toLowerCase() === period);
  const statusOf = (p) => String(p.status || "").toLowerCase();

  if (forThisMonth.some((p) => statusOf(p) === "paid")) return { key: "paid", label: `Paid · ${MONTHS[m].slice(0, 3)}`, tone: "success", rank: 6 };
  if (forThisMonth.some((p) => statusOf(p) === "pending")) return { key: "review", label: "Under review", tone: "info", rank: 1 };

  const due = new Date(y, m, dueDayOf(t));
  const start = leaseStartOf(t);
  const end = leaseEndOf(t);
  if (end && startOfDay(end) < new Date(y, m, 1)) return { key: "ended", label: "Lease ended", tone: "default", rank: 8 };
  if (start && startOfDay(start) > due) {
    // Moved in after this month's due day: first rent is next month
    const next = new Date(y, m + 1, dueDayOf(t));
    return { key: "upcoming", label: `Due ${shortDate(next)}`, tone: "default", rank: 5, due: next };
  }

  const left = daysFrom(today, due);
  if (left > 0) return { key: "due", label: `Due in ${plural(left, "day")}`, tone: left <= 3 ? "warning" : "default", rank: left <= 3 ? 3 : 4, due };
  if (left === 0) return { key: "due", label: "Due today", tone: "warning", rank: 2, due };
  return { key: "overdue", label: `Overdue ${plural(-left, "day")}`, tone: "error", rank: 0, due };
}

/** Lease ending within 30 days (or already ended) for a current tenant. */
export const LEASE_WARN_DAYS = 30;
export function leaseFlagOf(t, today) {
  if (normalizeStatus(t.status) === "Inactive") return null;
  const end = leaseEndOf(t);
  const start = leaseStartOf(t);
  if (!end || (start && end <= start)) return null;
  const left = daysFrom(today, end);
  if (left > LEASE_WARN_DAYS) return null;
  return { left, label: left < 0 ? "Lease ended" : left === 0 ? "Lease ends today" : `Lease ends in ${plural(left, "day")}` };
}
