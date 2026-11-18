import { describe, expect, it } from "vitest";
import {
  categoryOf,
  feedbackState,
  feedbackSummary,
  priorityChangeEntry,
  priorityChangeFields,
  reviewFields,
  stars,
  tierOfCategory,
  validatePriorityChange,
  validateReopenReason,
  validateResolutionNotes,
} from "./maintenanceWorkflow";

describe("changing the priority", () => {
  const open = { status: "In Progress", category: "routine" };

  it("maps each category to its AHP tier", () => {
    expect(tierOfCategory("safety")).toBe("High");
    expect(tierOfCategory("utility")).toBe("Medium");
    expect(tierOfCategory("routine")).toBe("Low");
    expect(categoryOf({ category: " Safety " })).toBe("safety");
    expect(categoryOf({})).toBe("routine");
  });

  it("needs a new category and a reason", () => {
    expect(validatePriorityChange(open, "safety", "Sparks from the outlet")).toBe("");
    expect(validatePriorityChange(open, "routine", "same")).not.toBe("");
    expect(validatePriorityChange(open, "safety", "  ")).not.toBe("");
    expect(validatePriorityChange(open, "urgent", "x")).not.toBe("");
    expect(validatePriorityChange({ ...open, status: "Resolved" }, "safety", "x")).not.toBe("");
  });

  it("keeps the tenant's first choice and logs who changed it", () => {
    expect(priorityChangeFields(open, "safety")).toEqual({ category: "safety", originalCategory: "routine" });
    expect(priorityChangeFields({ ...open, originalCategory: "utility" }, "safety").originalCategory).toBe("utility");
    const entry = priorityChangeEntry({ from: "routine", to: "safety", reason: " Sparks ", actor: { uid: "C1", name: "Ana", role: "caretaker" }, at: new Date("2026-11-17T08:00:00Z") });
    expect(entry).toEqual({ from: "routine", to: "safety", fromTier: "Low", toTier: "High", reason: "Sparks", byUid: "C1", byName: "Ana", byRole: "caretaker", at: "2026-11-17T08:00:00.000Z" });
  });
});

describe("resolution notes and the tenant's answer", () => {
  it("needs real resolution notes", () => {
    expect(validateResolutionNotes("Replaced the faucet washer")).toBe("");
    expect(validateResolutionNotes("ok")).not.toBe("");
    expect(validateResolutionNotes("x".repeat(501))).not.toBe("");
  });

  it("tracks where the tenant's answer stands", () => {
    expect(feedbackState({ status: "In Progress" })).toBe("none");
    expect(feedbackState({ status: "Resolved" })).toBe("awaiting");
    expect(feedbackState({ status: "Resolved", tenantConfirmed: true })).toBe("confirmed");
    expect(feedbackState({ status: "Resolved", tenantConfirmed: true, review: { rating: 4 } })).toBe("reviewed");
  });

  it("needs a reason to reopen and a whole-star rating", () => {
    expect(validateReopenReason("Still leaking")).toBe("");
    expect(validateReopenReason("")).not.toBe("");
    expect(reviewFields(5, "  Fast fix ")).toEqual({ rating: 5, comment: "Fast fix" });
    expect(reviewFields(0, "")).toBeNull();
    expect(reviewFields(4.5, "")).toBeNull();
    expect(stars(3)).toBe("★★★☆☆");
  });

  it("summarises confirmations and ratings for the report", () => {
    const tickets = [
      { status: "Resolved", tenantConfirmed: true, review: { rating: 5 } },
      { status: "Resolved", tenantConfirmed: true, review: { rating: 4 }, priorityChanges: [{}] },
      { status: "Resolved", reopenCount: 1 },
      { status: "Pending", reopenCount: 2 },
    ];
    expect(feedbackSummary(tickets)).toEqual({ resolved: 3, confirmed: 2, awaiting: 1, reopened: 2, reviews: 2, averageRating: 4.5, priorityChanged: 1 });
    expect(feedbackSummary([]).averageRating).toBeNull();
  });
});

import { cleanTenantNote, MAX_TENANT_NOTE, tenantNoteOf } from "./maintenanceWorkflow";
import { sortTickets } from "./maintenancePrioritization";

describe("tenant note on a fix", () => {
  it("trims and caps the note", () => {
    expect(cleanTenantNote("  ok  ")).toBe("ok");
    expect(cleanTenantNote("x".repeat(900))).toHaveLength(MAX_TENANT_NOTE);
    expect(tenantNoteOf({})).toBe("");
  });
});

describe("sorting requests", () => {
  const d = (n) => new Date(2026, 10, n).toISOString();
  const list = [
    { id: "a", createdAt: d(5), roomNumber: "201", status: "Pending" },
    { id: "b", createdAt: d(1), roomNumber: "103", status: "In Progress" },
    { id: "c", createdAt: d(9), roomNumber: "12", status: "Pending" },
  ];
  const ids = (l) => l.map((t) => t.id);
  it("keeps the priority order by default and re-sorts on request", () => {
    expect(ids(sortTickets(list))).toEqual(["a", "b", "c"]);
    expect(ids(sortTickets(list, "oldest"))).toEqual(["b", "a", "c"]);
    expect(ids(sortTickets(list, "newest"))).toEqual(["c", "a", "b"]);
    expect(ids(sortTickets(list, "room"))).toEqual(["c", "b", "a"]);
    expect(ids(sortTickets(list, "status"))).toEqual(["b", "a", "c"]);
    expect(list.map((t) => t.id)).toEqual(["a", "b", "c"]);
  });
});
