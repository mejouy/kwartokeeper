const DAY_IN_MS = 24 * 60 * 60 * 1000;
const REMINDER_DAYS = [30, 7, 3, 0];
const REMINDER_TIME_ZONE = "Asia/Manila";

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
  const match = normalized.match(
    /^(\d+)\s*(day|days|week|weeks|month|months|year|years)$/
  );
  if (!match) return null;

  const amount = Number(match[1]);
  const unit = match[2];

  if (unit === "day" || unit === "days") {
    return { amount, unit: "day" };
  }

  if (unit === "week" || unit === "weeks") {
    return { amount: amount * 7, unit: "day" };
  }

  if (unit === "month" || unit === "months") {
    return { amount, unit: "month" };
  }

  return { amount: amount * 12, unit: "month" };
}

function addMonthsClamped(value, months) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const day = date.getDate();
  date.setDate(1);
  date.setMonth(date.getMonth() + Number(months));

  const lastDay = new Date(
    date.getFullYear(),
    date.getMonth() + 1,
    0
  ).getDate();

  date.setDate(Math.min(day, lastDay));
  return date;
}

function getLeaseEndDate(tenant) {
  const explicitEndDate = toDate(
    tenant?.leaseEndDate ||
      tenant?.leaseEnd ||
      tenant?.endDate ||
      tenant?.moveOutDate
  );
  if (explicitEndDate) return explicitEndDate;

  const startDate = toDate(
    tenant?.leaseStartDate ||
      tenant?.leaseStart ||
      tenant?.startDate
  );
  const duration = parseDuration(tenant?.leaseDuration);
  if (!startDate || !duration) return null;

  if (duration.unit === "month") {
    return addMonthsClamped(startDate, duration.amount);
  }

  return new Date(
    startDate.getTime() + duration.amount * DAY_IN_MS
  );
}

function getReminderThreshold(endDate, now = new Date()) {
  const end = toDate(endDate);
  const current = toDate(now);
  if (!end || !current) return null;

  const getCalendarDay = (date) => {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: REMINDER_TIME_ZONE,
      year: "numeric",
      month: "numeric",
      day: "numeric",
    }).formatToParts(date);
    const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
    return Math.floor(Date.UTC(Number(values.year), Number(values.month) - 1, Number(values.day)) / DAY_IN_MS);
  };

  const daysUntilEnd = getCalendarDay(end) - getCalendarDay(current);
  if (!REMINDER_DAYS.includes(daysUntilEnd)) return null;
  const matchingDay = daysUntilEnd;

  return {
    days: matchingDay,
    label: matchingDay === 30 ? "one month" : matchingDay === 7 ? "one week" : matchingDay === 3 ? "three days" : "today",
  };
}

function getCalendarDayKey(value) {
  const date = toDate(value);
  if (!date) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: REMINDER_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(({ type, value: part }) => [type, part]));
  return `${values.year}-${values.month}-${values.day}`;
}

function hasReminderSentToday(notifications, reminder, now = new Date()) {
  const todayKey = getCalendarDayKey(now);
  return notifications.some((notification) =>
    Number(notification.reminderDays) === reminder.days &&
    notification.reminderLabel === reminder.label &&
    getCalendarDayKey(notification.createdAt) === todayKey
  );
}

function getLeaseReminderRecipients({ tenantId, tenantName, ownerId, caretakers = [] }) {
  const recipients = [];
  const seenIds = new Set();
  const addRecipient = (id, name) => {
    if (!id || seenIds.has(id)) return;
    seenIds.add(id);
    recipients.push({ id, name });
  };

  addRecipient(tenantId, tenantName || "Tenant");
  addRecipient(ownerId, "Property owner");
  caretakers.forEach((caretaker) => {
    addRecipient(caretaker.id, caretaker.name || caretaker.fullName || "Caretaker");
  });

  return recipients;
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
    timeZone: REMINDER_TIME_ZONE,
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  // ✅ Customize message if the lease finishes today
  const isToday = days === 0;
  const title = isToday ? `${tenantName || "Tenant"} lease has ended` : `${tenantName || "Tenant"} lease ending soon`;
  const message = isToday
    ? `${tenantName || "Tenant"}'s lease officially concludes today (${formattedEndDate}). Please process room turnover and move-out inspection.`
    : `${tenantName || "Tenant"} is scheduled to leave on ${formattedEndDate}. This reminder is set for ${label} before the lease ends.`;

  return {
    userId: recipientId,
    tenantId,
    tenantName,
    ownerId,
    type: isToday ? "lease-expired" : "lease-ending",
    title,
    message,
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
  hasReminderSentToday,
  getLeaseReminderRecipients,
  makeReminderKey,
  buildLeaseReminderNotification,
};