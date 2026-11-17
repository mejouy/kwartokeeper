// Owner billing rules (panel revisions: "singilan, make it editable according
// to the owner's need"):
//   - defaultDueMode / defaultDueDay: when a new tenant's rent is due: every
//     15th, every 30th, the same date as their lease start, or a custom day
//     (each tenant can then have their own, saved as rentDueMode / rentDueDay)
//   - feeTypes: the owner's own fee types, each with a default amount and how
//     often it is charged, offered in Add a fee next to the built-in ones
//   - lateFee: an automatic late fee once rent is still unpaid N days after the
//     due date (worked out in utils/tenantRent.js, billForMonth)
//   - moveIn: what Register Tenant suggests collecting at move-in: advance rent
//     and a security deposit, in months of rent (both optional)
//
// Saved on the owner's own profile (users/{ownerUid}.billingSettings). Their
// tenants and caretakers can already read that profile, so every screen works
// out the same bill.
import { useEffect, useState } from "react";
import { doc, onSnapshot, updateDoc } from "firebase/firestore";
import { db } from "../config/firebase";

export const MAX_FEE_TYPES = 12;
export const MAX_GRACE_DAYS = 27;
export const MAX_MOVE_IN_MONTHS = 6;

const DUE_MODE_KEYS = ["15", "30", "lease", "custom"];

export const DEFAULT_BILLING = Object.freeze({
  defaultDueMode: "lease",
  defaultDueDay: 5,
  feeTypes: [],
  lateFee: { enabled: false, mode: "fixed", amount: 0, graceDays: 3 },
  moveIn: { advanceMonths: 0, depositMonths: 0 },
});

const num = (v, fallback = 0) => (Number.isFinite(Number(v)) ? Number(v) : fallback);
const clamp = (n, lo, hi) => Math.min(Math.max(n, lo), hi);
const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

// One owner fee type: { key, label, defaultAmount, repeat }
export function cleanFeeType(raw, index = 0) {
  const label = String(raw?.label || "").trim().slice(0, 40);
  if (!label) return null;
  const key = String(raw?.key || "").trim() || `custom-${index}-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 20)}`;
  return {
    key: key.startsWith("custom-") ? key : `custom-${key}`,
    label,
    defaultAmount: Math.max(round2(raw?.defaultAmount), 0),
    repeat: raw?.repeat === "monthly" ? "monthly" : "once",
  };
}

/** Saved settings (or nothing) → complete settings, every value in range. */
export function normalizeBilling(raw) {
  const s = raw && typeof raw === "object" ? raw : {};
  const late = s.lateFee && typeof s.lateFee === "object" ? s.lateFee : {};
  const moveIn = s.moveIn && typeof s.moveIn === "object" ? s.moveIn : {};
  const seen = new Set();
  const feeTypes = (Array.isArray(s.feeTypes) ? s.feeTypes : [])
    .map(cleanFeeType)
    .filter((f) => f && !seen.has(f.label.toLowerCase()) && seen.add(f.label.toLowerCase()))
    .slice(0, MAX_FEE_TYPES);
  const defaultDueDay = clamp(Math.round(num(s.defaultDueDay, 5)) || 5, 1, 31);
  // Saved before due modes existed: a day only (15 and 30 have their own option)
  const defaultDueMode = DUE_MODE_KEYS.includes(s.defaultDueMode)
    ? s.defaultDueMode
    : s.defaultDueDay === undefined
    ? "lease"
    : defaultDueDay === 15
    ? "15"
    : defaultDueDay === 30
    ? "30"
    : "custom";
  return {
    defaultDueMode,
    defaultDueDay,
    feeTypes,
    lateFee: {
      enabled: late.enabled === true,
      mode: late.mode === "percent" ? "percent" : "fixed",
      amount: Math.max(round2(late.amount), 0),
      graceDays: clamp(Math.round(num(late.graceDays, 3)), 0, MAX_GRACE_DAYS),
    },
    moveIn: {
      advanceMonths: clamp(Math.round(num(moveIn.advanceMonths, 0)), 0, MAX_MOVE_IN_MONTHS),
      depositMonths: clamp(Math.round(num(moveIn.depositMonths, 0)), 0, MAX_MOVE_IN_MONTHS),
    },
  };
}

/** Problems with a draft before saving: { field: message } (empty when fine). */
export function validateBilling(draft) {
  const e = {};
  const day = Number(draft?.defaultDueDay);
  if (draft?.defaultDueMode === "custom" && (!Number.isInteger(day) || day < 1 || day > 31)) e.defaultDueDay = "Pick a day from 1 to 31.";
  const late = draft?.lateFee || {};
  if (late.enabled) {
    const amount = Number(late.amount);
    if (!(amount > 0)) e.lateFeeAmount = "Enter an amount above zero.";
    else if (late.mode === "percent" && amount > 100) e.lateFeeAmount = "A percentage can't be over 100.";
    else if (late.mode !== "percent" && amount > 100000) e.lateFeeAmount = "That amount looks too large.";
    const grace = Number(late.graceDays);
    if (!Number.isInteger(grace) || grace < 0 || grace > MAX_GRACE_DAYS) e.lateFeeGrace = `Use 0 to ${MAX_GRACE_DAYS} days.`;
  }
  const labels = new Set();
  (draft?.feeTypes || []).forEach((f, i) => {
    const label = String(f.label || "").trim();
    if (!label) e[`fee${i}`] = "Name this fee.";
    else if (labels.has(label.toLowerCase())) e[`fee${i}`] = "You already have a fee with this name.";
    else if (Number(f.defaultAmount) < 0 || Number(f.defaultAmount) > 1000000) e[`fee${i}`] = "Check the amount.";
    labels.add(label.toLowerCase());
  });
  return e;
}

/** How the late fee reads to people: "₱200, 3 days after the due date". */
export function describeLateFee(late) {
  if (!late?.enabled || !(Number(late.amount) > 0)) return "No late fee";
  const amount = late.mode === "percent" ? `${Number(late.amount)}% of the rent` : `₱${Number(late.amount).toLocaleString("en-PH")}`;
  const days = Number(late.graceDays) || 0;
  return `${amount}, ${days === 0 ? "the day after the due date" : `${days} ${days === 1 ? "day" : "days"} after the due date`}`;
}

export const saveBillingSettings = (ownerUid, settings) =>
  updateDoc(doc(db, "users", ownerUid), { billingSettings: normalizeBilling(settings), billingSettingsUpdatedAt: new Date().toISOString() });

/**
 * The owner's billing rules, live. Works for the owner, their tenants and
 * their caretakers (all can read the owner's profile). Defaults until loaded.
 */
export function useOwnerBilling(ownerUid) {
  const [state, setState] = useState({ uid: "", settings: normalizeBilling(null) });
  useEffect(() => {
    if (!ownerUid) return undefined;
    return onSnapshot(
      doc(db, "users", ownerUid),
      (snap) => setState({ uid: ownerUid, settings: normalizeBilling(snap.data()?.billingSettings) }),
      (err) => console.warn("Couldn't load the billing rules:", err?.code || err)
    );
  }, [ownerUid]);
  return state.uid === ownerUid ? state.settings : normalizeBilling(null);
}
