const DAY_IN_MS = 24 * 60 * 60 * 1000;
const REMINDER_DAYS = [30, 7, 3];

function toDate(value) {
  if (!value) return null;
  if (value.toDate) return value.toDate();
  if (value instanceof Date) return value;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseDuration(value) {
  if (!value) return null;
  const normalized = String(value).trim().toLowerCase().replace(/_/g, " ");
  const match = normalized.match(/^(\d+)\s*(day|days|week|weeks|month|months|year|years)$/);
  if (!match) return null;

  const amount = Number(match[1]);
  const unit = match[2];
  const multipliers = {
    day: 1,
    days: 1,
    week: 7,
    weeks: 7,
    month: 30,
    months: 30,
    year: 365,
    years: 365,
  };

  return amount * multipliers[unit] * DAY_IN_MS;
}

function getLeaseEndDate(tenant) {
  const explicitEndDate = toDate(
    tenant?.leaseEndDate || tenant?.leaseEnd || tenant?.endDate || tenant?.moveOutDate
  );
  if (explicitEndDate) return explicitEndDate;

  const startDate = toDate(tenant?.leaseStartDate || tenant?.leaseStart || tenant?.startDate);
  const duration = parseDuration(tenant?.leaseDuration);
  if (!startDate || !duration) return null;

  return new Date(startDate.getTime() + duration);
}

function getReminderThreshold(endDate, now = new Date()) {
  const end = toDate(endDate);
  const current = toDate(now);
  if (!end || !current || end <= current) return null;

  const daysUntilEnd = Math.ceil((end.getTime() - current.getTime()) / DAY_IN_MS);
  const matchingDay = Math.min(
    ...REMINDER_DAYS.filter((days) => daysUntilEnd >= days && daysUntilEnd > 0)
  );
  if (!Number.isFinite(matchingDay)) return null;

  return {
    days: matchingDay,
    label: matchingDay === 30 ? "one month" : matchingDay === 7 ? "one week" : "three days",
  };
}

function makeReminderKey(tenantId, endDate, days) {
  return `${tenantId}:${toDate(endDate)?.toISOString() || ""}:${days}`;
}

function buildLeaseReminderNotification({
  tenantId,
  tenantName,
  ownerId,
  recipientId,
  recipientName,
  endDate,
  days,
  label,
}) {
  const formattedEndDate = toDate(endDate)?.toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return {
    userId: recipientId,
    tenantId,
    tenantName,
    ownerId,
    type: "lease-ending",
    title: `${tenantName || "Tenant"} lease ending soon`,
    message: `${tenantName || "Tenant"} is scheduled to leave on ${formattedEndDate}. This reminder is set for ${label} before the lease ends.`,
    createdAt: new Date(),
    isRead: false,
    leaseEndDate: toDate(endDate)?.toISOString(),
    reminderDays: days,
    reminderLabel: label,
    recipientName,
  };
}

module.exports = {
  DAY_IN_MS,
  getLeaseEndDate,
  getReminderThreshold,
  makeReminderKey,
  buildLeaseReminderNotification,
};
