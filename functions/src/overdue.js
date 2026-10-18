// functions/src/overdue.js
//
// Pure helpers for "rent is overdue" reminders. Mirrors the tenant dashboard:
// overdue = past the due day AND no payment document for the current period.

const { getLeaseEndDate } = require("./leaseReminder.js");

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000;

function toDate(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

// Calendar parts of "now" in Manila time.
function manilaParts(value) {
  const shifted = new Date(value.getTime() + MANILA_OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth(),
    day: shifted.getUTCDate(),
  };
}

// Same format as payments.periodMonth, e.g. "October 2026".
function getCurrentPeriod(now = new Date()) {
  const { year, month } = manilaParts(now);
  return {
    period: `${MONTHS[month]} ${year}`,
    periodKey: `${year}-${String(month + 1).padStart(2, "0")}`,
  };
}

function getRentDueDay(tenant) {
  const day = Number(tenant?.rentDueDay || tenant?.dueDay || 5);
  return Math.min(Math.max(day, 1), 28);
}

/**
 * Returns overdue details, or null when the tenant is not overdue.
 * @param {object} tenant
 * @param {Date} now
 * @param {boolean} hasPaymentThisPeriod any payment doc for the current period
 */
function getOverdueInfo(tenant, now, hasPaymentThisPeriod) {
  if (hasPaymentThisPeriod) return null;

  const rent = Number(tenant?.monthlyRent) || 0;
  if (rent <= 0) return null;

  const today = manilaParts(now);
  const dueDay = getRentDueDay(tenant);
  if (today.day <= dueDay) return null;

  const dueKey = Date.UTC(today.year, today.month, dueDay);

  // Moved in after this month's due day: not overdue yet.
  const start = toDate(
    tenant?.leaseStartDate || tenant?.leaseStart || tenant?.startDate,
  );
  if (start) {
    const s = manilaParts(start);
    if (Date.UTC(s.year, s.month, s.day) > dueKey) return null;
  }

  // Lease ended before this month began: nothing is owed.
  const end = getLeaseEndDate(tenant);
  if (end) {
    const e = manilaParts(end);
    if (Date.UTC(e.year, e.month, e.day) < Date.UTC(today.year, today.month, 1)) {
      return null;
    }
  }

  const { period, periodKey } = getCurrentPeriod(now);
  return {
    period,
    periodKey,
    rent,
    dueDay,
    daysOverdue: today.day - dueDay,
    dueLabel: `${MONTHS[today.month].slice(0, 3)} ${dueDay}, ${today.year}`,
  };
}

module.exports = { getOverdueInfo, getCurrentPeriod, getRentDueDay };
