// One rule for what an owner account may do, shared by the route guard, the
// owner menu and the dashboard, so they never disagree.
//
//  "suspended": blocked by an admin -> the suspended page
//  "rejected":  documents were declined -> dashboard + Account only, to re-submit
//  "pending":   waiting for review -> dashboard, Account and the setup wizard only
//  "active":    everything
//
// Older rejections were saved as status "suspended" (with approvalStatus
// "rejected"); those are still treated as rejected unless an admin suspended the
// account on purpose (suspendedAt is set by the admin's Suspend button).

const lower = (v) => String(v || "").trim().toLowerCase();

export function ownerAccessOf(profile) {
  const approval = lower(profile?.approvalStatus);
  const status = lower(profile?.status);
  if (status === "suspended" && (approval !== "rejected" || profile?.suspendedAt)) return "suspended";
  if (approval === "rejected" || status === "rejected") return "rejected";
  if (approval === "pending" || status === "pending") return "pending";
  return "active";
}

// Pages a pending or rejected owner can still open
export const RESTRICTED_OWNER_PATHS = ["/owner", "/owner/account", "/welcome", "/setup", "/wizard-success"];

// Fields to write when an owner (re-)submits verification documents
export function resubmissionPatch(profile) {
  return {
    approvalStatus: "pending",
    // A rejected account goes back to the review queue (the rules allow exactly this change)
    ...(lower(profile?.approvalStatus) === "rejected" ? { status: "pending" } : {}),
  };
}
