// src/utils/maintenanceWorkflow.js
//
// The repair-request steps added after the final defense (panel revisions):
//   1. The caretaker or the owner can change a request's priority after
//      checking it. Priority still comes from the AHP category weights
//      (maintenancePrioritization.js), so changing the priority means
//      correcting the category: Safety → High, Utility → Medium, Routine → Low.
//      The tenant's own choice stays in `originalCategory`, and every change is
//      logged in `priorityChanges` with who changed it and why.
//   2. Marking a request resolved needs resolution notes (what was done).
//   3. The tenant then confirms the fix ("Yes, it's fixed") or reopens the
//      request ("Not fixed yet") with a reason.
//   4. With or after the confirmation, the tenant can rate the service (1–5)
//      and leave a comment.
//
// Plain logic only, so it can be tested without Firestore.

import { CATEGORIES, PRIORITY_TIERS } from "./maintenancePrioritization";

export const MIN_RESOLUTION_NOTES = 5;
export const MAX_RESOLUTION_NOTES = 500;
export const MAX_PRIORITY_REASON = 200;
export const MAX_REOPEN_REASON = 300;
export const MAX_REVIEW_COMMENT = 500;

// Category → tier, the same mapping the AHP ranking uses, most urgent first
export const PRIORITY_CHOICES = [
  { category: CATEGORIES.SAFETY, tier: PRIORITY_TIERS.HIGH, label: "Safety" },
  { category: CATEGORIES.UTILITY, tier: PRIORITY_TIERS.MEDIUM, label: "Utility" },
  { category: CATEGORIES.ROUTINE, tier: PRIORITY_TIERS.LOW, label: "Routine" },
];

export const statusOf = (ticket) => ticket?.status || "Pending";
export const isClosed = (ticket) => ["Resolved", "Cancelled"].includes(statusOf(ticket));

// The ticket's category, normalised. Unknown or missing counts as routine,
// which is also how the AHP ranking treats it.
export function categoryOf(ticket) {
  const value = String(ticket?.category || "").trim().toLowerCase();
  return PRIORITY_CHOICES.some((c) => c.category === value) ? value : CATEGORIES.ROUTINE;
}

export const tierOfCategory = (category) =>
  PRIORITY_CHOICES.find((c) => c.category === category)?.tier || PRIORITY_TIERS.LOW;

export const labelOfCategory = (category) =>
  PRIORITY_CHOICES.find((c) => c.category === category)?.label || "Routine";

/* ---------------- 1. Changing the priority ---------------- */

// Returns "" when the change is allowed, or the reason it isn't
export function validatePriorityChange(ticket, nextCategory, reason) {
  if (isClosed(ticket)) return "This request is already closed.";
  if (!PRIORITY_CHOICES.some((c) => c.category === nextCategory)) return "Choose a priority.";
  if (nextCategory === categoryOf(ticket)) return "That is already its priority.";
  const text = String(reason || "").trim();
  if (!text) return "Say why the priority changed. The tenant sees this.";
  if (text.length > MAX_PRIORITY_REASON) return `Keep the reason under ${MAX_PRIORITY_REASON} characters.`;
  return "";
}

// One entry for the ticket's `priorityChanges` log
export function priorityChangeEntry({ from, to, reason, actor = {}, at = new Date() }) {
  return {
    from,
    to,
    fromTier: tierOfCategory(from),
    toTier: tierOfCategory(to),
    reason: String(reason || "").trim().slice(0, MAX_PRIORITY_REASON),
    byUid: actor.uid || null,
    byName: actor.name || "",
    byRole: actor.role || "",
    at: at.toISOString(),
  };
}

// The fields to save (the caller adds the log entry with arrayUnion)
export function priorityChangeFields(ticket, nextCategory) {
  return {
    category: nextCategory,
    // The tenant's first choice is kept once, so the history always shows it
    originalCategory: ticket?.originalCategory || categoryOf(ticket),
  };
}

export const priorityChangesOf = (ticket) => (Array.isArray(ticket?.priorityChanges) ? ticket.priorityChanges : []);
export const lastPriorityChange = (ticket) => {
  const list = priorityChangesOf(ticket);
  return list.length ? list[list.length - 1] : null;
};

/* ---------------- 2. Resolution notes ---------------- */

export function validateResolutionNotes(notes) {
  const text = String(notes || "").trim();
  if (text.length < MIN_RESOLUTION_NOTES) return "Write what was done to fix it. The tenant sees this.";
  if (text.length > MAX_RESOLUTION_NOTES) return `Keep the notes under ${MAX_RESOLUTION_NOTES} characters.`;
  return "";
}

/* ---------------- 3 and 4. The tenant's answer ---------------- */

export const isValidRating = (rating) => Number.isInteger(rating) && rating >= 1 && rating <= 5;
export const hasReview = (ticket) => isValidRating(ticket?.review?.rating);

// "none": not resolved · "awaiting": waiting for the tenant to confirm ·
// "confirmed": confirmed, not rated yet · "reviewed": confirmed and rated
export function feedbackState(ticket) {
  if (statusOf(ticket) !== "Resolved") return "none";
  if (ticket.tenantConfirmed !== true) return "awaiting";
  return hasReview(ticket) ? "reviewed" : "confirmed";
}

export const needsTenantAnswer = (ticket) => feedbackState(ticket) === "awaiting";
export const canReview = (ticket) => feedbackState(ticket) === "confirmed";

export function validateReopenReason(reason) {
  const text = String(reason || "").trim();
  if (!text) return "Tell your landlord what is still wrong.";
  if (text.length > MAX_REOPEN_REASON) return `Keep it under ${MAX_REOPEN_REASON} characters.`;
  return "";
}

// The review as it is saved. `at` is filled in by the caller (server time).
// The tenant's own note when they confirm a fix (panel revisions: tenants
// "input completion/resolution notes once a concern is marked resolved").
// Optional, saved even without a star rating.
export const MAX_TENANT_NOTE = 500;
export const tenantNoteOf = (ticket) => String(ticket?.tenantNote || "").trim();
export const cleanTenantNote = (text) => String(text || "").trim().slice(0, MAX_TENANT_NOTE);

export function reviewFields(rating, comment) {
  if (!isValidRating(rating)) return null;
  return { rating, comment: String(comment || "").trim().slice(0, MAX_REVIEW_COMMENT) };
}

export const stars = (rating) => {
  const n = Math.max(0, Math.min(5, Math.round(Number(rating) || 0)));
  return "★".repeat(n) + "☆".repeat(5 - n);
};

/* ---------------- For the maintenance report ---------------- */

// How tenants answered, over the given tickets
export function feedbackSummary(tickets = []) {
  const resolved = tickets.filter((t) => statusOf(t) === "Resolved");
  const confirmed = resolved.filter((t) => t.tenantConfirmed === true).length;
  const ratings = tickets.filter(hasReview).map((t) => t.review.rating);
  const total = ratings.reduce((sum, r) => sum + r, 0);
  return {
    resolved: resolved.length,
    confirmed,
    awaiting: resolved.length - confirmed,
    reopened: tickets.filter((t) => Number(t.reopenCount) > 0).length,
    reviews: ratings.length,
    averageRating: ratings.length ? Math.round((total / ratings.length) * 10) / 10 : null,
    priorityChanged: tickets.filter((t) => priorityChangesOf(t).length > 0).length,
  };
}
