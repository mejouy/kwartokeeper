// src/utils/maintenancePrioritization.js
//
// AHP-based (Analytic Hierarchy Process) prioritization logic for
// maintenance requests, per KwartoKeeper's DSS scope (manuscript
// Chapter 2 — "Decision Support Systems for Maintenance and Safety
// Prioritization").
//
// ─────────────────────────────────────────────────────────────────
// DESIGN NOTE — SCOPE MATCHES THE MANUSCRIPT EXACTLY
// ─────────────────────────────────────────────────────────────────
// Per the manuscript, tenants categorize a report as ONE of three types
// when submitting it — Safety, Utility, or Routine (no separate
// tenant-selected "severity level" exists in the scope). The system then
// "cross-references the report category against pre-established severity
// weights" to assign a priority tier:
//   Safety  -> High Priority   (exposed wiring, faulty locks, major leaks)
//   Utility -> Medium Priority (clogged drains, appliance malfunctions)
//   Routine -> Low Priority    (paint chips, aesthetic concerns)
//
// Those "pre-established severity weights" are exactly what the AHP
// pairwise comparison below derives — the weights justify WHY Safety
// outranks Utility outranks Routine, with real numbers instead of an
// arbitrary lookup table.
//
// PAIRWISE COMPARISON MATRIX (Saaty 1-9 scale) — Safety vs Utility vs
// Routine:
//
//              Safety   Utility   Routine
//   Safety        1        5         8      <- Safety is "very strongly"
//   Utility      1/5       1         4         more important than Utility,
//   Routine      1/8      1/4        1         "extremely" more than Routine
//
// Priority vector (geometric mean method, normalized):
//   Safety:  (1 * 5 * 8)^(1/3)     = 3.420 -> 3.420 / 4.663 = 0.733
//   Utility: (1/5 * 1 * 4)^(1/3)   = 0.928 -> 0.928 / 4.663 = 0.199
//   Routine: (1/8 * 1/4 * 1)^(1/3) = 0.315 -> 0.315 / 4.663 = 0.068
//
// This is the numeric backing behind the tier assignment — it is why
// Safety = High (weight 0.73), Utility = Medium (0.20), Routine = Low
// (0.07), rather than an unjustified arbitrary ranking.
//
// WITHIN A TIER: reports are ordered purely by AGING (how long a report
// has been pending, oldest first). This is NOT part of the AHP weighting
// itself — the manuscript defines only one input per report (category),
// so there is no second criterion to pairwise-compare against. Aging is
// a standard, well-understood operational tie-breaker (oldest unresolved
// issue within the same urgency tier gets handled first), applied
// separately from — not blended into — the AHP-derived category weight.
// ─────────────────────────────────────────────────────────────────

export const CATEGORIES = {
  SAFETY: "safety",
  UTILITY: "utility",
  ROUTINE: "routine",
};

export const PRIORITY_TIERS = {
  HIGH: "High",
  MEDIUM: "Medium",
  LOW: "Low",
};

// AHP-derived category weights (see pairwise comparison matrix above).
// Kept alongside the tier so the UI/reports can show the numeric
// justification, not just the label.
const CATEGORY_WEIGHTS = {
  [CATEGORIES.SAFETY]: 0.733,
  [CATEGORIES.UTILITY]: 0.199,
  [CATEGORIES.ROUTINE]: 0.068,
};

const CATEGORY_TIER_MAP = {
  [CATEGORIES.SAFETY]: PRIORITY_TIERS.HIGH,
  [CATEGORIES.UTILITY]: PRIORITY_TIERS.MEDIUM,
  [CATEGORIES.ROUTINE]: PRIORITY_TIERS.LOW,
};

// Numeric rank so tiers can be sorted (higher = more urgent).
const TIER_RANK = {
  [PRIORITY_TIERS.HIGH]: 3,
  [PRIORITY_TIERS.MEDIUM]: 2,
  [PRIORITY_TIERS.LOW]: 1,
};

/**
 * Converts a Firestore Timestamp, JS Date, or ISO string into a plain
 * Date, defensively.
 */
function toDate(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate(); // Firestore Timestamp
  if (value instanceof Date) return value;
  return new Date(value);
}

/**
 * Computes the priority tier (and its AHP weight) for a single
 * maintenance report, based on category alone.
 *
 * @param {object} report
 * @param {string} report.category - "safety" | "utility" | "routine"
 * @returns {{ tier: string, tierRank: number, weight: number }}
 */
export function computePriority(report) {
  const category = report.category;
  const tier = CATEGORY_TIER_MAP[category] || PRIORITY_TIERS.LOW;
  const weight =
    CATEGORY_WEIGHTS[category] ?? CATEGORY_WEIGHTS[CATEGORIES.ROUTINE];

  return {
    tier,
    tierRank: TIER_RANK[tier],
    weight,
  };
}

/**
 * Ranks a list of maintenance reports: High tier first, then Medium,
 * then Low (per AHP-derived category weights); within each tier, oldest
 * report first (aging tie-breaker). Returns a new array — does not
 * mutate the input.
 *
 * @param {object[]} reports - each must have category and createdAt
 * @param {Date} [now] - override "current time" (useful for testing)
 * @returns {object[]} reports, each annotated with a `priority` field
 *                      and `daysPending`, sorted most urgent first
 */
export function rankMaintenanceRequests(reports, now = new Date()) {
  return reports
    .map((report) => {
      const createdDate = toDate(report.createdAt);
      const daysPending = createdDate
        ? Math.max((now - createdDate) / (1000 * 60 * 60 * 24), 0)
        : 0;
      return {
        ...report,
        priority: computePriority(report),
        daysPending: Math.round(daysPending * 10) / 10,
        _createdDate: createdDate,
      };
    })
    .sort((a, b) => {
      if (b.priority.tierRank !== a.priority.tierRank) {
        return b.priority.tierRank - a.priority.tierRank; // tier first (AHP weight)
      }
      // Within the same tier: oldest first (ascending createdAt).
      if (!a._createdDate || !b._createdDate) return 0;
      return a._createdDate - b._createdDate;
    })
    .map(({ _createdDate, ...rest }) => rest); // strip internal helper field
}
