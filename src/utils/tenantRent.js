// Shared tenant status, rent and lease rules for the owner's Tenants list and
// tenant profile, so both pages always say the same thing.
//
// Rent rules match the server's overdue reminders (functions/src/overdue.js):
// due on the tenant's due day (default the 5th); overdue once that has passed
// with no PAID payment for the month; no rent owed before the lease starts or
// after it ends.
import { addMonthsClamped } from "./addMonthsClamped";
import { chargesFor, isActiveCharge, monthBill, periodIndex, round2 } from "./charges";
import { t } from "../i18n";

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
export const dueDayOf = (t) => Math.min(Math.max(Math.round(Number(t.rentDueDay || t.dueDay || 5)) || 5, 1), 31);

/**
 * The due date in a given month. A due day the month doesn't have (the 30th in
 * February, the 31st in April...) falls on that month's last day.
 * `month` may run past 11 (next year), like the Date constructor.
 */
export const dueDateOn = (year, month, day) => new Date(year, month, Math.min(day, new Date(year, month + 1, 0).getDate()));

/*
 * How the owner picks a tenant's due day (panel revisions):
 *   "15"     every 15th
 *   "30"     every 30th (the last day in February)
 *   "lease"  the same date as the lease start (moved in on the 12th → every 12th)
 *   "custom" any day from 1 to 31
 * Saved on the tenant as rentDueMode, with the day it works out to in rentDueDay
 * (which is what every rent rule reads).
 */
export const DUE_MODES = [
  { key: "15", label: "Every 15th of the month" },
  { key: "30", label: "Every 30th of the month" },
  { key: "lease", label: "Same date as the lease start" },
  { key: "custom", label: "Custom day" },
];
export const ordinalDay = (n) => `${n}${n % 10 === 1 && n !== 11 ? "st" : n % 10 === 2 && n !== 12 ? "nd" : n % 10 === 3 && n !== 13 ? "rd" : "th"}`;

/** The day of the month a due rule works out to (1–31), using the lease start for "lease". */
export function resolveDueDay(rule, leaseStart) {
  const mode = rule?.mode;
  if (mode === "15") return 15;
  if (mode === "30") return 30;
  if (mode === "lease") {
    const start = toDate(leaseStart);
    return start ? start.getDate() : Math.min(Math.max(Math.round(Number(rule?.day) || 5), 1), 31);
  }
  return Math.min(Math.max(Math.round(Number(rule?.day) || 5), 1), 31);
}

/** A tenant's due rule as saved (older records only have the day: shown as 15th, 30th or custom). */
export function dueRuleOf(t) {
  const day = dueDayOf(t || {});
  if (DUE_MODES.some((m) => m.key === t?.rentDueMode)) return { mode: t.rentDueMode, day };
  return { mode: day === 15 ? "15" : day === 30 ? "30" : "custom", day };
}

/** "every 15th", "every 30th (or the last day of shorter months)". */
export const dueDayText = (day) => `every ${ordinalDay(day)}${day >= 29 ? " (or the month's last day, if shorter)" : ""}`;
const LEASE_MONTHS = { "1_month": 1, "3_months": 3, "6_months": 6, "12_months": 12 };
export const leaseStartOf = (t) => toDate(t.leaseStartDate || t.leaseStart || t.startDate || t.moveInDate);
export const leaseEndOf = (t) => {
  const end = toDate(t.leaseEndDate || t.leaseEnd || t.endDate || t.moveOutDate);
  if (end) return end;
  const start = leaseStartOf(t);
  const months = LEASE_MONTHS[t.leaseDuration];
  return start && months ? addMonthsClamped(new Date(start), months) : null;
};

/**
 * How long a lease runs, worked out from its two dates: "1 year and 30 days",
 * "6 months", "45 days". Null when a date is missing or the end isn't after the start.
 * Every screen shows this rather than a saved label, so the length can never
 * disagree with the dates.
 */
export function leaseLengthText(startValue, endValue) {
  const start = toDate(startValue);
  const end = toDate(endValue);
  if (!start || !end || startOfDay(end) <= startOfDay(start)) return null;
  let months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
  if (end.getDate() < start.getDate()) months -= 1;
  const days = daysFrom(addMonthsClamped(new Date(start), months), end);
  const years = Math.floor(months / 12);
  const rest = months % 12;
  const part = (n, one, many) => (n ? t(n === 1 ? one : many, { n }) : null);
  const parts = [part(years, "{n} year", "{n} years"), part(rest, "{n} month", "{n} months"), part(days, "{n} day", "{n} days")].filter(Boolean);
  return parts.length > 1 ? `${parts.slice(0, -1).join(", ")} ${t("and")} ${parts[parts.length - 1]}` : parts[0];
}

/** The month a payment is for, e.g. "October 2026" (falls back to its date). */
export const paymentPeriodOf = (p) => {
  if (p.periodMonth) return String(p.periodMonth).trim();
  const d = toDate(p.paymentDate || p.createdAt);
  return d ? `${MONTHS[d.getMonth()]} ${d.getFullYear()}` : "";
};

/* ---------------------------------------------------------------------------
   One bill for one tenant and one month, the same on every screen (owner,
   caretaker, tenant): rent, less advance rent paid at move-in for that month,
   plus the month's fees and the owner's automatic late fee (billing rules,
   utils/billingSettings.js).
--------------------------------------------------------------------------- */

/** When rent for a month ("November 2026") is due for this tenant. */
export function dueDateFor(t, period) {
  const i = periodIndex(period);
  return i === null ? null : dueDateOn(Math.floor(i / 12), i % 12, dueDayOf(t));
}

const statusWord = (p) => String(p.status || "").toLowerCase();
const sentOn = (p) => toDate(p.paymentDate) || toDate(p.createdAt) || toDate(p.submittedAt);

/**
 * The automatic late fee for a month, as a fee line (like a charge), or null.
 * Added once for the month when the rent is still unpaid `graceDays` after the
 * due date. Rent sent on time (even if the owner checks it later) never gets
 * one, nor does a month the owner waived (tenant.lateFeeWaived) or a month that
 * started before the lease did.
 * `payments` are the tenant's payments for that month.
 */
/**
 * The billing rules for one property: the owner's usual rules, with that
 * property's own rules on top when the owner set some (Property → Billing).
 * Only the due date, late fee and move-in payments can differ per property;
 * fee types stay the owner's. Safe to call twice.
 */
export const PROPERTY_RULE_KEYS = ["defaultDueMode", "defaultDueDay", "lateFee", "moveIn"];
export function billingForProperty(settings, propertyId) {
  const own = propertyId ? settings?.propertyRules?.[propertyId] : null;
  if (!settings || !own) return settings;
  const picked = Object.fromEntries(PROPERTY_RULE_KEYS.filter((k) => own[k] !== undefined).map((k) => [k, own[k]]));
  return { ...settings, ...picked };
}
const propertyOfTenant = (t) => t?.propertyId || t?.assignedPropertyId || "";

export function lateFeeLine({ tenant, period, rent, payments = [], settings: ownerSettings, today = new Date() }) {
  const settings = billingForProperty(ownerSettings, propertyOfTenant(tenant));
  const rule = settings?.lateFee;
  if (!rule?.enabled || !(Number(rule.amount) > 0) || !(rent > 0)) return null;
  if (Array.isArray(tenant?.lateFeeWaived) && tenant.lateFeeWaived.includes(period)) return null;
  const due = dueDateFor(tenant, period);
  if (!due) return null;
  const start = leaseStartOf(tenant);
  if (start && startOfDay(start) > due) return null; // moved in after the due day: first rent is next month
  const grace = Math.min(Math.max(Math.round(Number(rule.graceDays) || 0), 0), 27);
  const deadline = new Date(due.getFullYear(), due.getMonth(), due.getDate() + grace, 23, 59, 59, 999);
  if (today <= deadline) return null;
  const onTime = payments.filter((p) => statusWord(p) !== "rejected" && (sentOn(p) || today) <= deadline);
  if (onTime.some((p) => statusWord(p) === "paid")) return null;
  if (round2(onTime.reduce((sum, p) => sum + (Number(p.amount) || 0), 0)) >= rent) return null;
  const amount = rule.mode === "percent" ? round2((rent * Number(rule.amount)) / 100) : round2(rule.amount);
  if (!(amount > 0)) return null;
  return {
    id: `late:${period}`,
    auto: true,
    type: "penalty",
    label: "Late fee",
    amount,
    period,
    repeat: "once",
    note: grace ? `Rent still unpaid ${grace} ${grace === 1 ? "day" : "days"} after the due date` : "Rent unpaid after the due date",
  };
}

/**
 * Rent already covered for a month by advance rent collected at move-in.
 * An advance is a one-time fee (type "advance") listing the months it pays
 * for (coversPeriods). It counts once its own month's bill is fully paid.
 * `payments` are ALL of the tenant's payments (the advance was paid in another month).
 */
export function advanceCreditFor({ tenant, period, charges = [], payments = [] }) {
  const id = tenant?.id || tenant?.uid;
  const rent = rentOf(tenant || {});
  const key = String(period || "").toLowerCase();
  let credit = 0;
  (Array.isArray(charges) ? charges : [])
    .filter((c) => c.tenantId === id && c.type === "advance" && isActiveCharge(c) && Array.isArray(c.coversPeriods) && c.coversPeriods.some((x) => String(x).toLowerCase() === key))
    .forEach((c) => {
      const own = String(c.period || "").toLowerCase();
      if (own === key) return; // an advance never pays for its own month
      const ownBill = monthBill(rent, chargesFor(charges, id, c.period), payments.filter((p) => paymentPeriodOf(p).toLowerCase() === own));
      if (ownBill.settled) credit += round2(Number(c.amount) / c.coversPeriods.length);
    });
  return round2(Math.min(credit, rent));
}

/**
 * What one tenant owes for one month, with everything the owner set up:
 * monthBill() plus { baseRent, advanceCredit, lateFee, coveredByAdvance }.
 * `payments` are the tenant's payments (all months is fine; it picks the month).
 */
export function billForMonth({ tenant, period, charges = [], payments = [], settings: ownerSettings = null, today = new Date() }) {
  // The tenant's property may have its own rules (late fee)
  const settings = billingForProperty(ownerSettings, propertyOfTenant(tenant));
  const id = tenant?.id || tenant?.uid;
  const baseRent = round2(rentOf(tenant || {}));
  const key = String(period || "").toLowerCase();
  const forMonth = payments.filter((p) => paymentPeriodOf(p).toLowerCase() === key);
  const advanceCredit = advanceCreditFor({ tenant, period, charges, payments });
  const rent = round2(baseRent - advanceCredit);
  const fees = chargesFor(charges, id, period);
  const lateFee = lateFeeLine({ tenant, period, rent, payments: forMonth, settings, today });
  const bill = monthBill(rent, lateFee ? [...fees, lateFee] : fees, forMonth);
  const coveredByAdvance = advanceCredit > 0 && bill.total <= 0;
  return { ...bill, baseRent, advanceCredit, lateFee, coveredByAdvance, ...(coveredByAdvance ? { settled: true } : {}) };
}

/**
 * This month's rent for one tenant: { key, label, tone, rank, due, bill }.
 * rank orders "most urgent first" (overdue = 0). `charges` are the owner's
 * extra fees (utils/charges.js); this month's are added to the rent.
 * `settings` are the owner's billing rules (late fee); optional.
 */
export function rentStatusOf(t, tenantPayments, today, charges = [], settings = null) {
  if (normalizeStatus(t.status) === "Inactive") return { key: "na", label: "—", tone: "none", rank: 9 };

  const y = today.getFullYear();
  const m = today.getMonth();
  const periodLabel = `${MONTHS[m]} ${y}`;
  const bill = billForMonth({ tenant: t, period: periodLabel, charges, payments: tenantPayments, settings, today });
  if (bill.coveredByAdvance) return { key: "paid", label: `Paid · advance`, tone: "success", rank: 6, bill };
  if (bill.total <= 0) return { key: "none", label: "No rent set", tone: "default", rank: 7, bill };

  if (bill.settled) return { key: "paid", label: `Paid · ${MONTHS[m].slice(0, 3)}`, tone: "success", rank: 6, bill };
  if (bill.pending) return { key: "review", label: "Under review", tone: "info", rank: 1, bill };
  const withBill = (s) => ({ ...s, bill, ...(bill.hasPaid ? { label: `Fees due · ${s.label}` } : {}) });

  const due = dueDateOn(y, m, dueDayOf(t));
  const start = leaseStartOf(t);
  const end = leaseEndOf(t);
  if (end && startOfDay(end) < new Date(y, m, 1)) return { key: "ended", label: "Lease ended", tone: "default", rank: 8, bill };
  if (start && startOfDay(start) > due) {
    // Moved in after this month's due day: first rent is next month
    const next = dueDateOn(y, m + 1, dueDayOf(t));
    return { key: "upcoming", label: `Due ${shortDate(next)}`, tone: "default", rank: 5, due: next, bill };
  }

  const left = daysFrom(today, due);
  if (left > 0) return withBill({ key: "due", label: `Due in ${plural(left, "day")}`, tone: left <= 3 ? "warning" : "default", rank: left <= 3 ? 3 : 4, due });
  if (left === 0) return withBill({ key: "due", label: "Due today", tone: "warning", rank: 2, due });
  return withBill({ key: "overdue", label: `Overdue ${plural(-left, "day")}`, tone: "error", rank: 0, due });
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
