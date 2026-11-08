// Rent reminders, checked when the app opens (the free plan has no scheduled
// server jobs, the same way lease reminders work).
//
//  Tenant: "Rent is due in 3 days", "Rent is due today", then "Rent is overdue"
//          once a week until it's paid. Fees count (rent + this month's fees).
//  Owner:  once a week while anyone is overdue, one note listing who.
//
// Each reminder is an ordinary notification (bell, and the phone if push is set
// up), sent at most once: its reminderKey is checked before sending. The check
// itself runs at most once a day per device.
import { addDoc, collection, doc, getDoc, getDocs, query, where } from "firebase/firestore";
import { db } from "../config/firebase";
import { MONTHS, daysFrom, normalizeStatus, rentStatusOf } from "./tenantRent";
import { isActiveCharge } from "./charges";

const dayKey = (d) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
const checkedToday = (key) => {
  try {
    return window.localStorage.getItem(key) === dayKey(new Date());
  } catch {
    return false;
  }
};
const markChecked = (key) => {
  try {
    window.localStorage.setItem(key, dayKey(new Date()));
  } catch {
    /* storage blocked: the reminderKey check still stops duplicates */
  }
};
const peso = (n) => `₱${Number(n || 0).toLocaleString("en-PH", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;
const docs = (snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() }));

async function alreadySent(userId, reminderKey) {
  const snap = await getDocs(query(collection(db, "notifications"), where("userId", "==", userId)));
  return snap.docs.some((d) => d.data().reminderKey === reminderKey);
}

function sendToSelf(uid, role, fields) {
  return addDoc(collection(db, "notifications"), {
    userId: uid,
    kind: "rent-reminder",
    category: "payment",
    createdBy: uid,
    createdByRole: role,
    isRead: false,
    createdAt: new Date().toISOString(),
    ...fields,
  });
}

/** Today's reminder for one tenant's rent status, or null. */
export function tenantRentReminder(status, today) {
  const amount = status.bill?.balance || status.bill?.total || 0;
  if (!(amount > 0) || !status.due) return null;
  const month = MONTHS[status.due.getMonth()];
  if (status.key === "due") {
    const left = daysFrom(today, status.due);
    if (left === 0) return { stage: "due-today", type: "warning", title: "Rent is due today", message: `${peso(amount)} for ${month} is due today.` };
    if (left <= 3) return { stage: "due-soon", type: "info", title: `Rent is due in ${plural(left, "day")}`, message: `${peso(amount)} for ${month} is due on ${status.due.toLocaleDateString("en-US", { month: "short", day: "numeric" })}.` };
    return null;
  }
  if (status.key === "overdue") {
    const late = daysFrom(status.due, today);
    // Day 1 late, then once a week (day 8, 15, ...)
    return {
      stage: `overdue-w${Math.floor((late - 1) / 7)}`,
      type: "error",
      title: "Your rent is overdue",
      message: `${peso(amount)} for ${month} was due ${plural(late, "day")} ago. Pay it from your dashboard, or talk to your landlord.`,
    };
  }
  return null;
}

/** Tenant: checks their own rent once a day when the app opens. */
export async function checkRentOnTenantAppOpen(uid) {
  if (!uid) return;
  const guard = `kk_rent_check_${uid}`;
  if (checkedToday(guard)) return;

  const [userSnap, tenantSnap] = await Promise.all([getDoc(doc(db, "users", uid)), getDoc(doc(db, "tenants", uid)).catch(() => null)]);
  const tenant = { ...(userSnap.exists() ? userSnap.data() : {}), ...(tenantSnap?.exists() ? tenantSnap.data() : {}), id: uid };
  if (normalizeStatus(tenant.status) !== "Active") return markChecked(guard);

  const [payments, charges] = await Promise.all([
    getDocs(query(collection(db, "payments"), where("tenantId", "==", uid))).then(docs),
    getDocs(query(collection(db, "charges"), where("tenantId", "==", uid))).then(docs).catch(() => []),
  ]);
  const today = new Date();
  const status = rentStatusOf(tenant, payments, today, charges.filter(isActiveCharge));
  const reminder = tenantRentReminder(status, today);
  if (reminder) {
    const reminderKey = `${MONTHS[status.due.getMonth()]} ${status.due.getFullYear()}:${reminder.stage}`;
    if (!(await alreadySent(uid, reminderKey))) {
      const { stage, ...fields } = reminder;
      await sendToSelf(uid, "tenant", { ...fields, reminderKey, ownerId: tenant.ownerUid || "", propertyId: tenant.propertyId || "", reminderStage: stage });
    }
  }
  markChecked(guard);
}

/** Owner: once a week while anyone is overdue, one note listing who. */
export async function checkRentOnOwnerAppOpen(uid) {
  if (!uid) return;
  const guard = `kk_rent_check_owner_${uid}`;
  if (checkedToday(guard)) return;

  const today = new Date();
  const period = `${MONTHS[today.getMonth()]} ${today.getFullYear()}`;
  const [tenantRecords, userRecords, payments, charges] = await Promise.all([
    getDocs(query(collection(db, "tenants"), where("ownerUid", "==", uid))).then(docs),
    getDocs(query(collection(db, "users"), where("ownerUid", "==", uid))).then(docs),
    getDocs(query(collection(db, "payments"), where("ownerUid", "==", uid), where("periodMonth", "==", period))).then(docs),
    getDocs(query(collection(db, "charges"), where("ownerUid", "==", uid))).then(docs).catch(() => []),
  ]);

  // A tenant can have a `users` profile, a `tenants` record, or both
  const byId = new Map();
  userRecords.filter((u) => u.role === "tenant").forEach((u) => byId.set(u.id, u));
  tenantRecords.forEach((t) => {
    const id = t.uid || t.id;
    byId.set(id, { ...(byId.get(id) || {}), ...t, id });
  });
  const activeCharges = charges.filter(isActiveCharge);
  const overdue = [...byId.values()]
    .filter((t) => normalizeStatus(t.status) === "Active" && !t.accountRemoved)
    .map((t) => ({ t, status: rentStatusOf(t, payments.filter((p) => p.tenantId === t.id || p.tenantId === t.uid), today, activeCharges) }))
    .filter(({ status }) => status.key === "overdue" && (status.bill?.balance || 0) > 0)
    .sort((a, b) => a.status.due - b.status.due);

  if (overdue.length > 0) {
    const week = Math.floor((today.getDate() - 1) / 7);
    const reminderKey = `${period}:owner-overdue-w${week}`;
    if (!(await alreadySent(uid, reminderKey))) {
      const total = overdue.reduce((s, { status }) => s + status.bill.balance, 0);
      const names = overdue.slice(0, 3).map(({ t, status }) => `${t.fullName || t.name || "A tenant"} (${peso(status.bill.balance)}, ${plural(daysFrom(status.due, today), "day")} late)`);
      const more = overdue.length > 3 ? `, and ${overdue.length - 3} more` : "";
      await sendToSelf(uid, "owner", {
        ownerId: uid,
        type: "warning",
        title: `${plural(overdue.length, "tenant")} ${overdue.length === 1 ? "is" : "are"} overdue for ${MONTHS[today.getMonth()]}`,
        message: `${names.join(", ")}${more}. ${peso(total)} in all. See Payments for details.`,
        reminderKey,
      });
    }
  }
  markChecked(guard);
}
