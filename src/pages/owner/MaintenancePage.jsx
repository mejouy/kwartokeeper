// src/pages/owner/MaintenancePage.jsx

import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  InputBase,
  MenuItem,
  Paper,
  Skeleton,
  Snackbar,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import BuildOutlinedIcon from "@mui/icons-material/BuildOutlined";
import AccessTimeOutlinedIcon from "@mui/icons-material/AccessTimeOutlined";
import CancelOutlinedIcon from "@mui/icons-material/CancelOutlined";
import NotesOutlinedIcon from "@mui/icons-material/NotesOutlined";
import SearchIcon from "@mui/icons-material/Search";
import CloseIcon from "@mui/icons-material/Close";
import InventoryOutlinedIcon from "@mui/icons-material/Inventory2Outlined";
import ReportProblemOutlinedIcon from "@mui/icons-material/ReportProblemOutlined";
import EngineeringOutlinedIcon from "@mui/icons-material/EngineeringOutlined";
import TaskAltOutlinedIcon from "@mui/icons-material/TaskAltOutlined";
import ForumOutlinedIcon from "@mui/icons-material/ForumOutlined";

import {
  addDoc,
  collection,
  query,
  where,
  onSnapshot,
  doc,
  updateDoc,
  deleteField,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../../config/firebase";
import { useAuth } from "../../context/AuthContext";
import {
  notifyMaintenanceStatusChanged,
  notifyMaintenanceCancelled,
} from "../../services/notificationService";
import { rankMaintenanceRequests } from "../../utils/maintenancePrioritization";

const HEAD = '"Inter", sans-serif';
const R = { sm: "10px", md: "14px", lg: "18px", xl: "22px" };
const row = { display: "flex", alignItems: "center" };

const TIER_TONE = { High: "error", Medium: "warning", Low: "default" };
const STATUS_TONE = { Pending: "warning", "In Progress": "info", Resolved: "success", Cancelled: "default" };
// What the tier comes from (the tenant's chosen category), in plain words
const CATEGORY_LABEL = { safety: "Safety", utility: "Utility", routine: "Routine" };

const STATUS_OPTIONS = ["Pending", "In Progress", "Resolved"]; // what the owner can set; cancelling has its own button
const MAX_REMARKS = 500;
const MAX_REASON = 200;

const statusOf = (t) => t.status || "Pending";
const isClosed = (t) => ["Resolved", "Cancelled"].includes(statusOf(t));

// Views. "Active" is the default so finished work doesn't bury what needs attention.
const VIEWS = [
  { key: "active", label: "Active", test: (t) => !isClosed(t) },
  { key: "pending", label: "Pending", test: (t) => statusOf(t) === "Pending" },
  { key: "progress", label: "In progress", test: (t) => statusOf(t) === "In Progress" },
  { key: "resolved", label: "Resolved", test: (t) => statusOf(t) === "Resolved" },
  { key: "cancelled", label: "Cancelled", test: (t) => statusOf(t) === "Cancelled" },
  { key: "all", label: "All", test: () => true },
];

const toDate = (v) => {
  if (!v) return null;
  const d = v.toDate ? v.toDate() : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};
const formatTimestamp = (v) => {
  const d = toDate(v);
  return d ? new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "numeric" }).format(d) : "Unknown date";
};
const shortDate = (v) => {
  const d = toDate(v);
  return d ? d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "";
};
const waitingText = (days) => {
  const d = Math.floor(Number(days) || 0);
  return d < 1 ? "Reported today" : `Waiting ${d} ${d === 1 ? "day" : "days"}`;
};

// Two tickets from different properties can share a property name, so filter by id
const propertyKeyOf = (t) => t.propertyId || `name:${t.propertyName || ""}`;

const cardSx = {
  bgcolor: "background.default",
  border: "1px solid",
  borderColor: "divider",
  borderRadius: R.lg,
};

function Pill({ label, tone, icon }) {
  return (
    <Box
      component="span"
      sx={{
        ...row,
        gap: 0.5,
        px: 1,
        height: 24,
        borderRadius: 99,
        fontSize: 12.5,
        fontWeight: 700,
        whiteSpace: "nowrap",
        flexShrink: 0,
        bgcolor: (t) => (tone === "default" ? alpha(t.palette.text.primary, 0.07) : alpha(t.palette[tone].main, 0.13)),
        color: (t) => (tone === "default" ? t.palette.text.secondary : t.palette[tone].dark),
        "& svg": { fontSize: 15 },
      }}
    >
      {icon}
      {label}
    </Box>
  );
}

// Segmented status buttons: one tap instead of opening a dropdown
const segmentedSx = (status) => ({
  p: 0.5,
  gap: 0.5,
  borderRadius: "12px",
  bgcolor: (t) => alpha(t.palette.background.paper, 0.6),
  "& .MuiToggleButton-root": { textTransform: "none", fontWeight: 700, py: 0.6, px: 1.5, border: "none", borderRadius: "9px !important", color: "text.secondary", whiteSpace: "nowrap" },
  "& .MuiToggleButton-root.Mui-selected": {
    bgcolor: "#fff",
    color: (t) => t.palette[STATUS_TONE[status] === "default" ? "text" : STATUS_TONE[status]]?.dark || t.palette.text.primary,
    boxShadow: "0 2px 8px rgba(0,0,0,.08)",
    "&:hover": { bgcolor: "#fff" },
  },
});

// One ticket. Remarks are edited in a draft that only exists while editing,
// so live updates never fight what is being typed.
function TicketCard({ ticket, busy, onStatusChange, onCancel, notify }) {
  const [draft, setDraft] = useState(null); // null = not editing
  const [isSaving, setIsSaving] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const savedRemarks = ticket.remarks || "";
  const editing = draft !== null;
  const tier = ticket.priority?.tier || "Low";
  const status = statusOf(ticket);
  const closed = isClosed(ticket);
  const closedOn = status === "Resolved" ? shortDate(ticket.resolvedAt) : status === "Cancelled" ? shortDate(ticket.cancelledAt) : "";
  const longDescription = (ticket.description || "").length > 180;
  const followUps = Array.isArray(ticket.followUps) ? ticket.followUps : [];
  const accent = closed ? "divider" : tier === "High" ? "error.main" : tier === "Medium" ? "warning.main" : "text.disabled";

  const handleSaveRemarks = async () => {
    setIsSaving(true);
    try {
      await updateDoc(doc(db, "maintenance_tickets", ticket.id), { remarks: draft.trim(), updatedAt: new Date() });
      setDraft(null);
      notify("Remarks saved.");
    } catch (err) {
      console.error("Failed to save remarks:", err);
      notify("Failed to save remarks. Check your permissions.", "error");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Paper elevation={0} sx={{ ...cardSx, position: "relative", overflow: "hidden", p: { xs: 2, sm: 2.5 }, minWidth: 0 }}>
      <Box aria-hidden sx={{ position: "absolute", left: 0, top: 14, bottom: 14, width: 4, borderRadius: "0 4px 4px 0", bgcolor: accent }} />

      {/* Title, priority and who/where */}
      <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 1.5, opacity: closed ? 0.75 : 1 }}>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography sx={{ fontFamily: HEAD, fontWeight: 800, fontSize: "1.02rem", lineHeight: 1.3, overflowWrap: "anywhere" }}>
            {ticket.title || "Untitled request"}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25, overflowWrap: "anywhere" }}>
            {ticket.tenantName || "Unknown tenant"} · {ticket.propertyName || "Dormitory"} · Room {ticket.roomNumber || "N/A"}
          </Typography>
        </Box>
        <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap", justifyContent: "flex-end" }}>
          {closed ? (
            <Pill label={closedOn ? `${status} ${closedOn}` : status} tone={STATUS_TONE[status] || "default"} />
          ) : (
            <Pill label={`${tier} priority`} tone={TIER_TONE[tier] || "default"} icon={tier === "High" ? <ReportProblemOutlinedIcon /> : null} />
          )}
        </Box>
      </Box>

      {/* Quiet facts row */}
      <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 0.75, mt: 1, opacity: closed ? 0.75 : 1 }}>
        {CATEGORY_LABEL[ticket.category] && (
          <Box component="span" sx={{ px: 0.9, py: 0.2, borderRadius: "6px", fontSize: 12, fontWeight: 700, bgcolor: (t) => alpha(t.palette.background.paper, 0.75) }}>
            {CATEGORY_LABEL[ticket.category]}
          </Box>
        )}
        <Typography variant="caption" color="text.secondary" sx={{ ...row, gap: 0.5 }}>
          <AccessTimeOutlinedIcon sx={{ fontSize: 14 }} />
          {formatTimestamp(ticket.createdAt)}
          {!closed && ticket.daysPending !== undefined && (
            <Box component="span" sx={{ fontWeight: 700, color: ticket.daysPending >= 3 ? "error.main" : "text.secondary" }}>
              {" "}· {waitingText(ticket.daysPending)}
            </Box>
          )}
        </Typography>
      </Box>

      {/* Description + photo side by side on wider screens */}
      {(ticket.description || ticket.photoUrl) && (
        <Box sx={{ display: "flex", flexDirection: { xs: "column", sm: "row" }, gap: 1.5, mt: 1.5 }}>
          {ticket.description && (
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography
                variant="body2"
                sx={{
                  overflowWrap: "anywhere",
                  whiteSpace: "pre-wrap",
                  lineHeight: 1.6,
                  ...(expanded ? {} : { display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }),
                }}
              >
                {ticket.description}
              </Typography>
              {longDescription && (
                <Button size="small" onClick={() => setExpanded((v) => !v)} sx={{ mt: 0.25, ml: -0.75, fontWeight: 700 }}>
                  {expanded ? "Show less" : "Show more"}
                </Button>
              )}
            </Box>
          )}
          {ticket.photoUrl && (
            <Box component="a" href={ticket.photoUrl} target="_blank" rel="noopener noreferrer" aria-label="Open the photo" sx={{ display: "block", flexShrink: 0 }}>
              <Box component="img" src={ticket.photoUrl} alt="Photo attached to the request" loading="lazy" sx={{ display: "block", width: { xs: "100%", sm: 168 }, maxWidth: 360, height: { xs: 180, sm: 112 }, objectFit: "cover", borderRadius: R.sm, border: "1px solid", borderColor: "divider" }} />
            </Box>
          )}
        </Box>
      )}

      {/* Tenant follow-ups */}
      {followUps.length > 0 && (
        <Box sx={{ mt: 1.5, p: 1.25, borderRadius: R.sm, bgcolor: (th) => alpha(th.palette.info.main, 0.07) }}>
          <Typography variant="caption" sx={{ ...row, gap: 0.5, fontWeight: 800, color: "info.dark" }}>
            <ForumOutlinedIcon sx={{ fontSize: 15 }} />
            {followUps.length === 1 ? "1 update from the tenant" : `${followUps.length} updates from the tenant`}
          </Typography>
          {followUps.map((f, i) => (
            <Box key={i} sx={{ mt: 0.75, display: "flex", gap: 1, alignItems: "flex-start" }}>
              <Box sx={{ minWidth: 0, flex: 1 }}>
                {f.text && (
                  <Typography variant="body2" sx={{ overflowWrap: "anywhere", whiteSpace: "pre-wrap" }}>
                    {f.text}
                  </Typography>
                )}
                <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                  {f.at ? new Date(f.at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : ""}
                </Typography>
              </Box>
              {f.photoUrl && (
                <Box component="a" href={f.photoUrl} target="_blank" rel="noopener noreferrer" aria-label="Open the photo" sx={{ display: "block", flexShrink: 0 }}>
                  <Box component="img" src={f.photoUrl} alt="Photo added by the tenant" loading="lazy" sx={{ display: "block", width: 64, height: 64, objectFit: "cover", borderRadius: "8px", border: "1px solid", borderColor: "divider" }} />
                </Box>
              )}
            </Box>
          ))}
        </Box>
      )}

      {status === "Cancelled" && ticket.cancelReason && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5, overflowWrap: "anywhere" }}>
          <strong>Reason:</strong> {ticket.cancelReason}
        </Typography>
      )}

      {/* Remarks */}
      <Box sx={{ mt: 1.5 }}>
        {editing ? (
          <>
            <TextField
              fullWidth
              size="small"
              multiline
              minRows={2}
              maxRows={5}
              autoFocus
              placeholder="e.g. waiting for parts, scheduled for Tuesday"
              value={draft}
              onChange={(e) => setDraft(e.target.value.slice(0, MAX_REMARKS))}
              helperText={`${draft.length}/${MAX_REMARKS} · the tenant can see this`}
              sx={{ "& .MuiOutlinedInput-root": { borderRadius: R.sm, fontSize: "0.875rem" } }}
            />
            <Box sx={{ ...row, justifyContent: "flex-end", gap: 1, mt: 0.5 }}>
              <Button size="small" color="inherit" onClick={() => setDraft(null)} disabled={isSaving} sx={{ fontWeight: 700 }}>
                Cancel
              </Button>
              <Button
                size="small"
                variant="contained"
                disableElevation
                onClick={handleSaveRemarks}
                disabled={isSaving || draft.trim() === savedRemarks}
                sx={{ fontWeight: 700, minWidth: 72, borderRadius: "8px" }}
              >
                {isSaving ? <CircularProgress size={16} color="inherit" /> : "Save"}
              </Button>
            </Box>
          </>
        ) : savedRemarks ? (
          <Box
            component="button"
            type="button"
            onClick={() => setDraft(savedRemarks)}
            aria-label="Edit remarks"
            sx={{
              width: "100%",
              textAlign: "left",
              font: "inherit",
              color: "inherit",
              cursor: "pointer",
              border: 0,
              borderRadius: R.sm,
              p: 1.25,
              bgcolor: (t) => alpha(t.palette.background.paper, 0.6),
              "&:hover": { bgcolor: (t) => alpha(t.palette.background.paper, 0.9) },
            }}
          >
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, display: "block" }}>
              Your remarks · tap to edit
            </Typography>
            <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
              {savedRemarks}
            </Typography>
          </Box>
        ) : (
          <Button size="small" startIcon={<NotesOutlinedIcon />} onClick={() => setDraft("")} sx={{ ml: -0.75, fontWeight: 700 }}>
            Add remarks
          </Button>
        )}
      </Box>

      {/* Actions */}
      <Box sx={{ display: "flex", flexDirection: { xs: "column", sm: "row" }, alignItems: { sm: "center" }, justifyContent: "space-between", gap: 1.25, mt: 2, pt: 1.5, borderTop: "1px solid", borderColor: "divider" }}>
        <ToggleButtonGroup
          exclusive
          size="small"
          value={STATUS_OPTIONS.includes(status) ? status : null}
          disabled={busy}
          onChange={(e, value) => value && onStatusChange(ticket, value)}
          aria-label="Ticket status"
          sx={{ ...segmentedSx(status), width: { xs: "100%", sm: "auto" }, "& .MuiToggleButton-root": { ...segmentedSx(status)["& .MuiToggleButton-root"], flex: { xs: 1, sm: "none" } } }}
        >
          {STATUS_OPTIONS.map((opt) => (
            <ToggleButton key={opt} value={opt}>
              {status === "Cancelled" && opt === "Pending" ? "Reopen" : opt}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>

        <Box sx={{ ...row, gap: 1, justifyContent: "flex-end" }}>
          {busy && <CircularProgress size={18} />}
          {!closed && (
            <Button size="small" color="error" startIcon={<CancelOutlinedIcon />} onClick={() => onCancel(ticket)} disabled={busy} sx={{ fontWeight: 700, minHeight: 36, textTransform: "none" }}>
              Cancel request
            </Button>
          )}
        </Box>
      </Box>
    </Paper>
  );
}

export default function MaintenancePage() {
  const { currentUser } = useAuth() || {};
  const [tickets, setTickets] = useState([]);
  // Nothing to load when signed out, so start "done" in that case
  const [loading, setLoading] = useState(() => Boolean(currentUser?.uid));
  const [error, setError] = useState("");
  const [view, setView] = useState("active");
  const [propertyFilter, setPropertyFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState("");
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [toast, setToast] = useState({ open: false, severity: "success", message: "" });
  // "Now" for days-waiting, fixed when the page opens
  const [now] = useState(() => new Date());

  const notify = (message, severity = "success") => setToast({ open: true, severity, message });

  useEffect(() => {
    if (!currentUser?.uid) return undefined;

    const unsubscribeSnapshot = onSnapshot(
      query(collection(db, "maintenance_tickets"), where("ownerUid", "==", currentUser.uid)),
      (snapshot) => {
        setTickets(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
        setError("");
        setLoading(false);
      },
      (err) => {
        console.error("Failed to load maintenance tickets:", err);
        setError("Couldn't load repair requests. Check your connection and try again.");
        setLoading(false);
      }
    );

    return () => unsubscribeSnapshot();
  }, [currentUser?.uid]);

  // Tell the tenant (best effort: the change itself has already been saved).
  // The shared notifiers below tell the owner's caretakers, never the tenant.
  const notifyTenant = (ticket, type, title, message) => {
    const tenantId = ticket.tenantUid || ticket.tenantId;
    if (!tenantId || !currentUser?.uid) return;
    addDoc(collection(db, "notifications"), {
      userId: tenantId,
      kind: "notice",
      category: "maintenance",
      type,
      title,
      message,
      ticketId: ticket.id,
      ownerId: currentUser.uid,
      createdBy: currentUser.uid,
      createdByRole: "owner",
      isRead: false,
      createdAt: new Date().toISOString(),
    }).catch((err) => console.warn("Repair notice failed:", err?.code || err));
  };

  const handleStatusChange = async (ticket, newStatus) => {
    if (!ticket || busyId || newStatus === statusOf(ticket)) return;
    const name = ticket.title || "your repair request";
    setBusyId(ticket.id);
    try {
      await updateDoc(doc(db, "maintenance_tickets", ticket.id), {
        status: newStatus,
        updatedAt: serverTimestamp(),
        // Keep the dates honest when something is resolved, then reopened
        resolvedAt: newStatus === "Resolved" ? serverTimestamp() : deleteField(),
        ...(statusOf(ticket) === "Cancelled" ? { cancelledAt: deleteField(), cancelReason: deleteField(), cancelledBy: deleteField() } : {}),
      });
      notifyMaintenanceStatusChanged(ticket, newStatus, "owner");
      notifyTenant(
        ticket,
        newStatus === "Resolved" ? "success" : "info",
        `Repair update: ${newStatus}`,
        newStatus === "Resolved"
          ? `"${name}" was marked resolved. If it isn't fixed, add an update from your dashboard.`
          : newStatus === "In Progress"
          ? `Work has started on "${name}".`
          : `"${name}" is back to pending.`
      );
      notify(`Marked as ${newStatus.toLowerCase()}.${newStatus === "Resolved" && view === "active" ? " It moves to Resolved." : ""}`);
    } catch (err) {
      console.error("Failed to update ticket status:", err);
      notify("Failed to update status. You may not have permission.", "error");
    } finally {
      setBusyId("");
    }
  };

  const openCancel = (ticket) => {
    setCancelReason("");
    setCancelTarget(ticket);
  };

  const confirmCancel = async () => {
    if (!cancelTarget || cancelling) return;
    const ticket = cancelTarget;
    const reason = cancelReason.trim();
    setCancelling(true);
    try {
      await updateDoc(doc(db, "maintenance_tickets", ticket.id), {
        status: "Cancelled",
        cancelledAt: serverTimestamp(),
        cancelledBy: "owner",
        cancelReason: reason,
        updatedAt: serverTimestamp(),
      });
      notifyMaintenanceCancelled(ticket, "owner");
      notifyTenant(
        ticket,
        "warning",
        "Repair request cancelled",
        `Your landlord cancelled "${ticket.title || "your repair request"}".${reason ? ` Reason: ${reason}` : ""} You can send a new request if the problem is still there.`
      );
      setCancelTarget(null);
      notify("Request cancelled and kept under Cancelled.");
    } catch (err) {
      console.error("Failed to cancel ticket:", err);
      notify("Failed to cancel request.", "error");
    } finally {
      setCancelling(false);
    }
  };

  // Properties that have tickets, by id (names can repeat across properties)
  const propertyOptions = useMemo(() => {
    const map = new Map();
    tickets.forEach((t) => {
      if (!map.has(propertyKeyOf(t))) map.set(propertyKeyOf(t), t.propertyName || "Unnamed property");
    });
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [tickets]);

  // Ranked once: this is also where each ticket gets its priority tier, so
  // every count and list below uses the ranked tickets.
  const ranked = useMemo(() => rankMaintenanceRequests(tickets, now), [tickets, now]);

  // Everything below respects the property filter, so the numbers always match the list
  const scoped = useMemo(
    () => (propertyFilter === "all" ? ranked : ranked.filter((t) => propertyKeyOf(t) === propertyFilter)),
    [ranked, propertyFilter]
  );

  const stats = useMemo(() => {
    const open = scoped.filter((t) => !isClosed(t));
    const resolvedThisMonth = scoped.filter((t) => {
      if (statusOf(t) !== "Resolved") return false;
      const d = toDate(t.resolvedAt);
      return d && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).length;
    return {
      open: open.length,
      highPriority: open.filter((t) => t.priority?.tier === "High").length,
      inProgress: open.filter((t) => statusOf(t) === "In Progress").length,
      resolvedThisMonth,
    };
  }, [scoped, now]);

  // Open work first (already in priority order), finished work after, newest first
  const orderedTickets = useMemo(() => {
    const closedTime = (t) => (toDate(t.resolvedAt) || toDate(t.cancelledAt) || toDate(t.updatedAt) || toDate(t.createdAt))?.getTime() || 0;
    return [...scoped.filter((t) => !isClosed(t)), ...scoped.filter(isClosed).sort((a, b) => closedTime(b) - closedTime(a))];
  }, [scoped]);

  const activeView = VIEWS.find((v) => v.key === view) || VIEWS[0];
  const visibleTickets = useMemo(() => {
    const term = search.trim().toLowerCase();
    return orderedTickets.filter((t) => {
      if (!activeView.test(t)) return false;
      if (!term) return true;
      return [t.title, t.description, t.tenantName, t.propertyName, t.roomNumber].some((v) => String(v || "").toLowerCase().includes(term));
    });
  }, [orderedTickets, activeView, search]);

  const countFor = (v) => scoped.filter(v.test).length;
  const filtersActive = view !== "active" || Boolean(search.trim()) || propertyFilter !== "all";
  const clearFilters = () => {
    setView("active");
    setSearch("");
    setPropertyFilter("all");
  };

  if (loading) {
    return (
      <Box sx={{ minWidth: 0 }}>
        <Skeleton variant="rounded" height={170} sx={{ borderRadius: R.xl, mb: 2.5 }} />
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} variant="rounded" height={170} sx={{ borderRadius: R.lg, mb: 1.5 }} />
        ))}
      </Box>
    );
  }

  const emptyTitle =
    tickets.length === 0 ? "No maintenance requests yet" : !filtersActive ? "Nothing needs attention" : "No requests match";
  const emptyBody =
    tickets.length === 0
      ? "When a tenant reports an issue, it will show up here."
      : !filtersActive
      ? "All requests are resolved or cancelled. Look under Resolved to review them."
      : search.trim()
      ? "Try a different search."
      : "Nothing in this view.";

  const tiles = [
    { label: "Open requests", icon: <BuildOutlinedIcon />, value: stats.open },
    { label: "High priority", icon: <ReportProblemOutlinedIcon />, value: stats.highPriority, accent: stats.highPriority > 0 ? "error.main" : undefined },
    { label: "In progress", icon: <EngineeringOutlinedIcon />, value: stats.inProgress, accent: stats.inProgress > 0 ? "info.dark" : undefined },
    { label: "Resolved this month", icon: <TaskAltOutlinedIcon />, value: stats.resolvedThisMonth, accent: stats.resolvedThisMonth > 0 ? "success.dark" : undefined },
  ];

  return (
    <Box sx={{ minWidth: 0 }}>
      {/* HEADER: same pattern as the other owner pages */}
      <Paper elevation={0} component="section" sx={{ ...cardSx, borderRadius: R.xl, position: "relative", overflow: "hidden", p: { xs: 2, sm: 3 }, mb: { xs: 2, sm: 2.5 } }}>
        <Box aria-hidden sx={{ position: "absolute", top: -180, right: -120, width: 380, height: 380, borderRadius: "50%", background: "rgba(255,69,0,.10)", filter: "blur(70px)", pointerEvents: "none" }} />
        <Typography color="text.secondary" sx={{ position: "relative", fontSize: { xs: 14, sm: 15 }, mb: { xs: 2, sm: 2.5 } }}>
          Repair requests from your tenants, most urgent first.
        </Typography>
        <Box sx={{ position: "relative", display: "grid", gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", md: "repeat(4, minmax(0, 1fr))" }, gap: { xs: 1, sm: 1.5 } }}>
          {tiles.map((t) => (
            <Box key={t.label} sx={{ minWidth: 0, display: "flex", alignItems: "center", gap: 1.25, p: { xs: 1.25, sm: 1.75 }, borderRadius: R.md, bgcolor: (th) => alpha(th.palette.background.paper, 0.55) }}>
              <Box sx={{ width: { xs: 32, sm: 38 }, height: { xs: 32, sm: 38 }, flexShrink: 0, borderRadius: R.sm, display: "grid", placeItems: "center", bgcolor: "#fff", color: "primary.main", "& svg": { fontSize: { xs: 18, sm: 20 } } }}>
                {t.icon}
              </Box>
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="caption" color="text.secondary" noWrap sx={{ fontWeight: 600, display: "block" }}>
                  {t.label}
                </Typography>
                <Typography sx={{ fontFamily: HEAD, fontWeight: 800, letterSpacing: "-0.02em", fontSize: { xs: "1.2rem", sm: "1.45rem" }, lineHeight: 1.2, color: t.accent || "text.primary" }}>
                  {t.value}
                </Typography>
              </Box>
            </Box>
          ))}
        </Box>
      </Paper>

      {error && (
        <Alert severity="error" sx={{ mb: 2.5, borderRadius: R.md }}>
          {error}
        </Alert>
      )}

      {/* TOOLBAR: search, property and view */}
      {tickets.length > 0 && (
        <Box sx={{ display: "flex", flexDirection: { xs: "column", md: "row" }, alignItems: { md: "center" }, gap: 1.25, mb: { xs: 2, sm: 2.5 } }}>
          <Paper
            elevation={0}
            sx={{
              ...cardSx,
              ...row,
              gap: 1,
              px: 1.5,
              height: 44,
              borderRadius: R.sm,
              flex: { md: "0 1 320px" },
              minWidth: 0,
              transition: "border-color .15s, box-shadow .15s",
              "&:focus-within": { borderColor: "primary.main", boxShadow: "0 0 0 3px rgba(255,69,0,.12)" },
            }}
          >
            <SearchIcon sx={{ color: "text.secondary" }} />
            <InputBase fullWidth placeholder="Search title, tenant or room" value={search} onChange={(e) => setSearch(e.target.value)} inputProps={{ "aria-label": "Search requests" }} />
            {search && (
              <IconButton size="small" aria-label="Clear search" onClick={() => setSearch("")}>
                <CloseIcon fontSize="small" />
              </IconButton>
            )}
          </Paper>

          {propertyOptions.length > 1 && (
            <TextField
              select
              size="small"
              value={propertyFilter}
              onChange={(e) => setPropertyFilter(e.target.value)}
              slotProps={{ htmlInput: { "aria-label": "Filter by property" } }}
              sx={{ minWidth: { md: 190 }, "& .MuiOutlinedInput-root": { borderRadius: R.sm, height: 44, bgcolor: "background.default" } }}
            >
              <MenuItem value="all">All properties</MenuItem>
              {propertyOptions.map(([key, name]) => (
                <MenuItem key={key} value={key}>{name}</MenuItem>
              ))}
            </TextField>
          )}

          {/* Segmented view filter with counts */}
          <Box
            role="group"
            aria-label="Filter by status"
            sx={{ display: "flex", gap: 0.5, p: 0.5, ...cardSx, borderRadius: R.md, overflowX: "auto", scrollbarWidth: "none", "&::-webkit-scrollbar": { display: "none" } }}
          >
            {VIEWS.map((v) => {
              const on = view === v.key;
              return (
                <Box
                  key={v.key}
                  component="button"
                  type="button"
                  aria-pressed={on}
                  onClick={() => setView(v.key)}
                  sx={{
                    ...row,
                    gap: 0.6,
                    px: 1.4,
                    height: 34,
                    border: 0,
                    borderRadius: R.sm,
                    cursor: "pointer",
                    flexShrink: 0,
                    fontFamily: HEAD,
                    fontWeight: 700,
                    fontSize: 13.5,
                    whiteSpace: "nowrap",
                    color: on ? "primary.main" : "text.secondary",
                    bgcolor: on ? "rgba(255,69,0,.1)" : "transparent",
                    "&:hover": { color: on ? "primary.main" : "text.primary" },
                    "&:focus-visible": { outline: "2px solid", outlineColor: "primary.main", outlineOffset: 1 },
                  }}
                >
                  {v.label}
                  <Box component="span" sx={{ fontSize: 12, opacity: 0.7 }}>{countFor(v)}</Box>
                </Box>
              );
            })}
          </Box>
        </Box>
      )}

      {/* TICKET LIST */}
      {visibleTickets.length === 0 ? (
        <Paper elevation={0} sx={{ ...cardSx, borderStyle: tickets.length === 0 ? "dashed" : "solid", py: { xs: 5, sm: 7 }, px: 3, textAlign: "center" }}>
          <Box sx={{ width: 64, height: 64, borderRadius: R.md, mx: "auto", mb: 2, ...row, justifyContent: "center", bgcolor: "rgba(255, 69, 0, 0.10)" }}>
            {tickets.length > 0 && !filtersActive ? (
              <InventoryOutlinedIcon sx={{ fontSize: 30, color: "primary.main" }} />
            ) : (
              <BuildOutlinedIcon sx={{ fontSize: 30, color: "primary.main" }} />
            )}
          </Box>
          <Typography sx={{ fontFamily: HEAD, fontWeight: 800 }}>{emptyTitle}</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {emptyBody}
          </Typography>
          {tickets.length > 0 && filtersActive && (
            <Button size="small" onClick={clearFilters} sx={{ mt: 1.5, fontWeight: 700 }}>
              Back to active requests
            </Button>
          )}
        </Paper>
      ) : (
        <>
          {filtersActive && (
            <Box sx={{ ...row, justifyContent: "space-between", gap: 1, mb: 1.25 }}>
              <Typography variant="body2" color="text.secondary">
                Showing {visibleTickets.length} of {scoped.length} requests
              </Typography>
              <Button size="small" onClick={clearFilters} sx={{ fontWeight: 700 }}>
                Clear filters
              </Button>
            </Box>
          )}
          <Box sx={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 1.5 }}>
            {visibleTickets.map((t) => (
              <TicketCard key={t.id} ticket={t} busy={busyId === t.id} onStatusChange={handleStatusChange} onCancel={openCancel} notify={notify} />
            ))}
          </Box>
        </>
      )}

      {/* Cancellation confirmation */}
      <Dialog
        open={Boolean(cancelTarget)}
        onClose={() => !cancelling && setCancelTarget(null)}
        maxWidth="xs"
        fullWidth
        slotProps={{ paper: { sx: { borderRadius: R.lg, m: 2, width: "calc(100% - 32px)" } } }}
      >
        <DialogTitle sx={{ fontFamily: HEAD, fontWeight: 800 }}>Cancel this request?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {cancelTarget ? `"${cancelTarget.title || "Untitled request"}" will move to Cancelled, and ${cancelTarget.tenantName || "the tenant"} will be notified.` : ""}
          </Typography>
          <TextField
            fullWidth
            size="small"
            multiline
            minRows={2}
            label="Reason (optional)"
            placeholder="e.g. duplicate request, already fixed"
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value.slice(0, MAX_REASON))}
            helperText={`${cancelReason.length}/${MAX_REASON} · shown to the tenant`}
            sx={{ "& .MuiOutlinedInput-root": { borderRadius: R.sm } }}
          />
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button color="inherit" onClick={() => setCancelTarget(null)} disabled={cancelling} sx={{ fontWeight: 700 }}>
            Keep request
          </Button>
          <Button color="error" variant="contained" disableElevation onClick={confirmCancel} disabled={cancelling} sx={{ fontWeight: 700, minWidth: 130, borderRadius: R.sm }}>
            {cancelling ? <CircularProgress size={20} color="inherit" /> : "Cancel request"}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={toast.open}
        autoHideDuration={3000}
        onClose={() => setToast((t) => ({ ...t, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        sx={{ bottom: { xs: "calc(72px + env(safe-area-inset-bottom, 0px)) !important", sm: undefined } }}
      >
        <Alert severity={toast.severity} variant="filled" onClose={() => setToast((t) => ({ ...t, open: false }))} sx={{ width: "100%" }}>
          {toast.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
