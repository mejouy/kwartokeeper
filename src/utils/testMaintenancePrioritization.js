// src/utils/testMaintenancePrioritization.js
//
// TEMPORARY sanity-check script — NOT part of the app's routes or UI.
// Run this once to confirm the AHP logic behaves as expected, then
// delete it (or keep it as a reference/manual test, your call).
//
// HOW TO RUN (from project root):
//   node src/utils/testMaintenancePrioritization.js

import { rankMaintenanceRequests } from "./maintenancePrioritization.js";

const now = new Date("2026-09-30");

function daysAgo(n) {
  const d = new Date(now);
  d.setDate(d.getDate() - n);
  return d;
}

const sampleReports = [
  {
    id: "r1",
    label: "Exposed wiring, reported today (Safety)",
    category: "safety",
    createdAt: daysAgo(0),
  },
  {
    id: "r2",
    label: "Faulty lock, reported 10 days ago (Safety)",
    category: "safety",
    createdAt: daysAgo(10),
  },
  {
    id: "r3",
    label: "Clogged drain, reported today (Utility)",
    category: "utility",
    createdAt: daysAgo(0),
  },
  {
    id: "r4",
    label: "Appliance malfunction, reported 5 days ago (Utility)",
    category: "utility",
    createdAt: daysAgo(5),
  },
  {
    id: "r5",
    label: "Paint chip, reported 20 days ago (Routine)",
    category: "routine",
    createdAt: daysAgo(20),
  },
];

const ranked = rankMaintenanceRequests(sampleReports, now);

console.log("Ranked order (most urgent first):\n");
ranked.forEach((r, i) => {
  console.log(
    `${i + 1}. [${r.priority.tier}, weight=${r.priority.weight}] ${r.daysPending}d pending  ${r.label}`,
  );
});

// EXPECTED SANITY CHECKS (verify these hold after you run it):
// - Both "safety" reports (r1, r2) should rank ABOVE both "utility" reports
//   (r3, r4) — AHP category weight (0.733) always wins over aging.
// - Within Safety: r2 (10 days pending) should outrank r1 (0 days) —
//   aging tie-breaker means the OLDER report goes first within the tier.
// - Within Utility: r4 (5 days) should outrank r3 (0 days), same logic.
// - r5 (routine) should always be last, no matter how long it's been
//   pending — Low tier never escapes to Medium/High.
