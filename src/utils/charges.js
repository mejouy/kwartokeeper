// Extra fees on top of rent: electricity, water, Wi-Fi, kitchen access...
//
// One document per fee in `charges`, added by the owner for one tenant. A fee
// is for a single month ("once") or repeats every month from its first month
// until the owner stops it ("monthly"). Every rent screen adds a tenant's fees
// for a month to that month's rent, so the owner, the caretaker and the tenant
// always see the same amount due.
//
// Removing a fee never deletes it (money records are kept): it's marked
// status "removed" and stops counting.
import { collection, doc, serverTimestamp, updateDoc, writeBatch } from "firebase/firestore";
import { auth, db } from "../config/firebase";

const MONTH_NAMES = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
const MONTH_LABELS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export const FEE_TYPES = [
  { key: "electricity", label: "Electricity" },
  { key: "water", label: "Water" },
  { key: "wifi", label: "Wi-Fi / internet" },
  { key: "kitchen", label: "Kitchen access" },
  { key: "laundry", label: "Laundry" },
  { key: "appliance", label: "Appliance use" },
  { key: "parking", label: "Parking" },
  { key: "penalty", label: "Late fee" },
  // Move-in payments (panel revisions): both one-time, both optional
  { key: "advance", label: "Advance rent" },
  { key: "deposit", label: "Security deposit" },
  { key: "other", label: "Other" },
];
export const feeTypeLabel = (key) => FEE_TYPES.find((t) => t.key === key)?.label || "Fee";

/*
 * Move-in payments, added like any other fee for the move-in month:
 *  - Advance rent: rent paid ahead. It lists the months it pays for
 *    (coversPeriods); once its own month is paid, those months show as paid
 *    (utils/tenantRent.js, advanceCreditFor).
 *  - Security deposit: held by the owner while the tenant stays, then
 *    refunded, used for unpaid rent or fees, or kept for damages
 *    (depositStatus on the fee, set from the tenant's profile).
 */
export const MOVE_IN_TYPES = ["advance", "deposit"];
export const isMoveInType = (type) => MOVE_IN_TYPES.includes(type);

/** The months an advance pays for: the `count` months right after `period`. */
export function advanceCovers(period, count) {
  const start = periodIndex(period);
  const n = Math.max(Math.round(Number(count) || 0), 0);
  return start === null ? [] : Array.from({ length: n }, (_, i) => periodFromIndex(start + 1 + i));
}

export const DEPOSIT_OUTCOMES = [
  { key: "refunded", label: "Refunded to the tenant" },
  { key: "applied", label: "Used for unpaid rent or fees" },
  { key: "forfeited", label: "Kept for damages" },
];
export const depositOutcomeLabel = (key) => DEPOSIT_OUTCOMES.find((o) => o.key === key)?.label || "";

export const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

/** "November 2026" → a number that sorts by month (null if it isn't a month). */
export function periodIndex(label) {
  const m = String(label || "").trim().toLowerCase().match(/^([a-z]+)\s+(\d{4})$/);
  if (!m) return null;
  const month = MONTH_NAMES.indexOf(m[1]);
  return month < 0 ? null : Number(m[2]) * 12 + month;
}
export const periodFromIndex = (i) => `${MONTH_LABELS[((i % 12) + 12) % 12]} ${Math.floor(i / 12)}`;
export const periodOfDate = (d) => `${MONTH_LABELS[d.getMonth()]} ${d.getFullYear()}`;

/** Months a fee can be added for: three back to three ahead, oldest first. */
export function feePeriodOptions(today = new Date()) {
  const now = periodIndex(periodOfDate(today));
  return Array.from({ length: 7 }, (_, i) => periodFromIndex(now - 3 + i));
}

export const isActiveCharge =(c) => Boolean(c) && c.status !== "removed" && Number(c.amount) > 0;

/** Does this fee count toward the given month? */
export function chargeAppliesTo(c, period) {
  if (!isActiveCharge(c)) return false;
  const p = periodIndex(period);
  const start = periodIndex(c.period);
  if (p === null || start === null) return false;
  if (c.repeat !== "monthly") return p === start;
  const end = c.endPeriod ? periodIndex(c.endPeriod) : null;
  return p >= start && (end === null || p <= end);
}

/** One tenant's fees for one month. */
export const chargesFor = (charges, tenantId, period) =>
  (Array.isArray(charges) ? charges : []).filter((c) => c.tenantId === tenantId && chargeAppliesTo(c, period));

export const feesTotal = (fees) => round2((fees || []).reduce((s, c) => s + (Number(c.amount) || 0), 0));

/**
 * What one tenant owes for one month: rent plus that month's fees, less what
 * was received. `payments` are the tenant's payments FOR that month.
 *
 * A payment marked Paid settles the rent (even when the owner accepted less,
 * e.g. a discount). Fees sit on top of the rent, so only money beyond the rent
 * goes toward them. With no Paid payment, everything received counts toward
 * the total.
 */
export function monthBill(rent, fees = [], payments = []) {
  const statusOf = (p) => String(p.status || "").toLowerCase();
  const rentAmount = round2(rent);
  const feeTotal = feesTotal(fees);
  const total = round2(rentAmount + feeTotal);
  const received = round2(payments.filter((p) => ["paid", "partial"].includes(statusOf(p))).reduce((s, p) => s + (Number(p.amount) || 0), 0));
  const hasPaid = payments.some((p) => statusOf(p) === "paid");
  const balance = hasPaid ? round2(Math.max(feeTotal - Math.max(received - rentAmount, 0), 0)) : round2(Math.max(total - received, 0));
  return {
    rent: rentAmount,
    fees,
    feeTotal,
    total,
    received,
    balance,
    hasPaid,
    settled: total > 0 && balance === 0 && (hasPaid || received > 0),
    pending: payments.some((p) => statusOf(p) === "pending"),
  };
}

/** Saved on a payment so its receipt shows what it covered. */
export const billSnapshot = (rent, fees = []) => ({
  rent: round2(rent),
  fees: fees.map((c) => ({ label: c.label || feeTypeLabel(c.type), amount: round2(c.amount) })),
  total: round2(round2(rent) + feesTotal(fees)),
});

/** The same, from a whole bill (billForMonth in utils/tenantRent.js): rent after any advance, fees with any late fee. */
export const snapshotOfBill = (bill) => billSnapshot(bill?.rent || 0, bill?.fees || []);

/** "November 2026 only" / "Every month from November 2026" / "Every month, Nov 2026 – Jan 2027". */
export function describeRepeat(c) {
  if (c.repeat !== "monthly") return `${c.period} only`;
  if (c.endPeriod) return `Every month, ${c.period} – ${c.endPeriod}`;
  return `Every month from ${c.period}`;
}

/** Split one bill across several tenants, to the centavo; the first ones absorb the leftover centavos. */
export function splitAmount(total, count) {
  const cents = Math.round(round2(total) * 100);
  if (count < 1 || cents <= 0) return [];
  const base = Math.floor(cents / count);
  const extra = cents - base * count;
  return Array.from({ length: count }, (_, i) => (base + (i < extra ? 1 : 0)) / 100);
}

const peso = (n) => `₱${Number(n || 0).toLocaleString("en-PH", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

/**
 * Adds one fee to each tenant (one document each) and tells each tenant.
 * tenants: [{ id, name, propertyId, propertyName, roomNumber }]
 * amounts: one amount per tenant (same order)
 */
export async function addCharges({ ownerUid, tenants, amounts, type, label, repeat, period, note, extra = {} }) {
  const uid = auth.currentUser?.uid;
  if (!uid || !ownerUid || tenants.length === 0) throw new Error("Nothing to add.");
  const batch = writeBatch(db);
  const nowIso = new Date().toISOString();
  const cleanLabel = String(label || "").trim() || feeTypeLabel(type);
  tenants.forEach((t, i) => {
    const amount = round2(amounts[i]);
    if (!(amount > 0)) return;
    const ref = doc(collection(db, "charges"));
    batch.set(ref, {
      ownerUid,
      tenantId: t.id,
      tenantName: t.name || "",
      propertyId: t.propertyId || "",
      propertyName: t.propertyName || "",
      roomNumber: t.roomNumber || "",
      type,
      label: cleanLabel,
      amount,
      repeat: repeat === "monthly" ? "monthly" : "once",
      period,
      endPeriod: "",
      note: String(note || "").trim(),
      status: "active",
      // e.g. coversPeriods for advance rent
      ...extra,
      createdBy: uid,
      createdAt: serverTimestamp(),
    });
    batch.set(doc(collection(db, "notifications")), {
      userId: t.id,
      kind: "payment",
      category: "payment",
      type: "info",
      title: `New fee: ${cleanLabel}`,
      message:
        repeat === "monthly"
          ? `${peso(amount)} will be added to your rent every month starting ${period}.${note ? ` Note: ${String(note).trim()}` : ""}`
          : type === "advance" && Array.isArray(extra.coversPeriods) && extra.coversPeriods.length
          ? `${peso(amount)} advance rent was added to your bill for ${period}. Once paid, it covers your rent for ${extra.coversPeriods.join(", ")}.`
          : type === "deposit"
          ? `${peso(amount)} security deposit was added to your bill for ${period}. Your landlord holds it while you stay and settles it when you move out.`
          : `${peso(amount)} was added to your bill for ${period}.${note ? ` Note: ${String(note).trim()}` : ""}`,
      chargeId: ref.id,
      ownerId: ownerUid,
      createdBy: uid,
      createdByRole: "owner",
      isRead: false,
      createdAt: nowIso,
    });
  });
  await batch.commit();
}

export const updateCharge = (id, patch) => updateDoc(doc(db, "charges", id), { ...patch, updatedAt: serverTimestamp() });

/** Stops a monthly fee: it still counts up to and including `lastPeriod`. */
export const stopCharge = (id, lastPeriod) => updateCharge(id, { endPeriod: lastPeriod });

export const removeCharge = (id) => updateCharge(id, { status: "removed", removedAt: serverTimestamp(), removedBy: auth.currentUser?.uid || "" });

/** Settles a security deposit: refunded, used for unpaid rent or fees, or kept for damages. */
export const settleDeposit = (id, { outcome, amountReturned = 0, note = "" }) =>
  updateCharge(id, {
    depositStatus: outcome,
    depositAmountReturned: round2(amountReturned),
    depositNote: String(note || "").trim().slice(0, 200),
    depositSettledAt: serverTimestamp(),
    depositSettledBy: auth.currentUser?.uid || "",
  });
