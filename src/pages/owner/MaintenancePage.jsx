// src/pages/owner/MaintenancePage.jsx

import React, { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
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

const row = { display: "flex", alignItems: "center" };

const TIER_TONE = { High: "error", Medium: "warning", Low: "default" };
const STATUS_TONE = { Pending: "warning", "In Progress": "info", Resolved: "success", Cancelled: "default" };

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

// Helper to format Firestore timestamps beautifully
const formatTimestamp = (timestamp) => {
  if (!timestamp) return "Unknown date";
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  if (isNaN(date)) return "Unknown date";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
  }).format(date);
};

const toDate = (v) => {
  if (!v) return null;
  const d = v.toDate ? v.toDate() : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};
const shortDate = (v) => {
  const d = toDate(v);
  return d ? d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "";
};

const cardSx = {
  bgcolor: "background.default",
  border: "1px solid",
  borderColor: "divider",
  borderRadius: 3,
};

function Pill({ label, tone, outlined }) {
  return (
    <Chip
      label={label}
      size="small"
      sx={{
        fontWeight: 700,
        border: outlined ? "1px solid" : "none",
        borderColor: (t) => (tone === "default" ? t.palette.divider : alpha(t.palette[tone].main, 0.4)),
        bgcolor: (t) =>
          tone === "default" ? alpha(t.palette.text.primary, 0.07) : alpha(t.palette[tone].main, 0.13),
        color: (t) => (tone === "default" ? t.palette.text.secondary : t.palette[tone].dark),
      }}
    />
  );
}

function SummaryStrip({ items }) {
  return (
    <Paper
      elevation={0}
      sx={{
        ...cardSx,
        overflow: "hidden",
        display: "grid",
        gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", md: "repeat(4, minmax(0, 1fr))" },
        mb: { xs: 2, sm: 2.5 },
      }}
    >
      {items.map((item, i) => (
        <Box
          key={item.label}
          sx={{
            px: { xs: 1.75, sm: 2.5 },
            py: { xs: 1.25, sm: 1.75 },
            minWidth: 0,
            borderTop: { xs: i > 1 ? "1px solid" : "none", md: "none" },
            borderLeft: { xs: i % 2 === 1 ? "1px solid" : "none", md: i === 0 ? "none" : "1px solid" },
            borderColor: "divider",
          }}
        >
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }} noWrap component="div">
            {item.label}
          </Typography>
          <Typography
            noWrap
            sx={{ fontFamily: '"Inter", sans-serif', fontWeight: 800, fontSize: { xs: "1.2rem", sm: "1.45rem" }, lineHeight: 1.25, color: item.color }}
          >
            {item.value}
          </Typography>
        </Box>
      ))}
    </Paper>
  );
}

// One ticket. Keeps its own remarks draft so typing never fights live updates.
function TicketCard({ ticket, busy, onStatusChange, onCancel, notify }) {
  const [remarks, setRemarks] = useState(ticket.remarks || "");
  const [editingRemarks, setEditingRemarks] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [expanded, setExpanded] = useState(false);

  // Pick up remarks changed elsewhere, but never overwrite what's being typed
  useEffect(() => {
    if (!editingRemarks) setRemarks(ticket.remarks || "");
  }, [ticket.remarks, editingRemarks]);

  const savedRemarks = ticket.remarks || "";
  const hasUnsavedRemarks = remarks.trim() !== savedRemarks;
  const tier = ticket.priority?.tier || "Medium";
  const status = statusOf(ticket);
  const resolved = status === "Resolved" || status === "Cancelled";
  const closedOn = status === "Resolved" ? shortDate(ticket.resolvedAt) : status === "Cancelled" ? shortDate(ticket.cancelledAt) : "";
  const longDescription = (ticket.description || "").length > 180;

  const handleSaveRemarks = async () => {
    setIsSaving(true);
    try {
      await updateDoc(doc(db, "maintenance_tickets", ticket.id), {
        remarks: remarks.trim(),
        updatedAt: new Date(),
      });
      setEditingRemarks(false);
      notify("Remarks saved.");
    } catch (err) {
      console.error("Failed to save remarks:", err);
      notify("Failed to save remarks. Check your permissions.", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const cancelRemarks = () => {
    setRemarks(savedRemarks);
    setEditingRemarks(false);
  };

  const accent = tier === "High" ? "error.main" : tier === "Medium" ? "warning.main" : "divider";

  return (
    <Paper
      elevation={0}
      sx={{
        ...cardSx,
        p: { xs: 2, sm: 2.5 },
        borderLeft: "3px solid",
        borderLeftColor: resolved ? "divider" : accent,
        opacity: resolved ? 0.8 : 1,
        minWidth: 0,
      }}
    >
      {/* Title + priority */}
      <Box sx={{ ...row, alignItems: "flex-start", justifyContent: "space-between", gap: 1.5 }}>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography sx={{ fontFamily: '"Inter", sans-serif', fontWeight: 800, lineHeight: 1.3, wordBreak: "break-word" }}>
            {ticket.title || "Untitled request"}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, wordBreak: "break-word" }}>
            {ticket.tenantName || "Unknown tenant"} · <strong>{ticket.propertyName || "Dormitory"}</strong>, Room {ticket.roomNumber || "N/A"}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ ...row, gap: 0.5, mt: 0.5 }}>
            <AccessTimeOutlinedIcon sx={{ fontSize: 14 }} />
            Submitted {formatTimestamp(ticket.createdAt)}
            {resolved && closedOn ? ` · ${status} ${closedOn}` : ""}
          </Typography>
        </Box>
        {resolved ? <Pill label={status} tone={STATUS_TONE[status] || "default"} /> : <Pill label={`${tier} priority`} tone={TIER_TONE[tier] || "default"} outlined />}
      </Box>

      {/* Description */}
      {ticket.description && (
        <Box sx={{ mt: 1.5 }}>
          <Typography
            variant="body2"
            sx={{
              color: "text.primary",
              wordBreak: "break-word",
              whiteSpace: "pre-wrap",
              ...(expanded
                ? {}
                : { display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }),
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
        <Box component="a" href={ticket.photoUrl} target="_blank" rel="noopener noreferrer" sx={{ display: "block", mt: 1.5 }}>
          <Box component="img" src={ticket.photoUrl} alt="Photo attached to the request" loading="lazy" sx={{ display: "block", width: "100%", maxWidth: 360, maxHeight: 200, objectFit: "cover", borderRadius: 2, border: "1px solid", borderColor: "divider" }} />
        </Box>
      )}

      {Array.isArray(ticket.followUps) && ticket.followUps.length > 0 && (
        <Box sx={{ mt: 1.5, p: 1.25, borderRadius: 2, bgcolor: (th) => alpha(th.palette.info.main, 0.08) }}>
          <Typography variant="caption" sx={{ fontWeight: 800, color: "info.dark" }}>
            Updates from the tenant
          </Typography>
          {ticket.followUps.map((f, i) => (
            <Box key={i} sx={{ mt: 0.75 }}>
              {f.text && (
                <Typography variant="body2" sx={{ overflowWrap: "anywhere", whiteSpace: "pre-wrap" }}>
                  {f.text}
                </Typography>
              )}
              {f.photoUrl && (
                <Box component="a" href={f.photoUrl} target="_blank" rel="noopener noreferrer" sx={{ display: "inline-block", mt: 0.5 }}>
                  <Box component="img" src={f.photoUrl} alt="Photo added by the tenant" loading="lazy" sx={{ display: "block", width: 96, height: 96, objectFit: "cover", borderRadius: 2, border: "1px solid", borderColor: "divider" }} />
                </Box>
              )}
              <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                {f.at ? new Date(f.at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : ""}
              </Typography>
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
        {editingRemarks ? (
          <>
            <TextField
              fullWidth
              size="small"
              multiline
              minRows={2}
              maxRows={5}
              autoFocus
              placeholder="e.g. waiting for parts, scheduled for Tuesday"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value.slice(0, MAX_REMARKS))}
              helperText={`${remarks.length}/${MAX_REMARKS}`}
              sx={{ "& .MuiInputBase-root": { fontSize: "0.875rem" } }}
            />
            <Box sx={{ ...row, justifyContent: "flex-end", gap: 1, mt: 0.5 }}>
              <Button size="small" color="inherit" onClick={cancelRemarks} disabled={isSaving} sx={{ fontWeight: 600 }}>
                Cancel
              </Button>
              <Button
                size="small"
                variant="contained"
                disableElevation
                onClick={handleSaveRemarks}
                disabled={isSaving || !hasUnsavedRemarks}
                sx={{ fontWeight: 700, minWidth: 72 }}
              >
                {isSaving ? <CircularProgress size={16} color="inherit" /> : "Save"}
              </Button>
            </Box>
          </>
        ) : savedRemarks ? (
          <Box
            component="button"
            type="button"
            onClick={() => setEditingRemarks(true)}
            aria-label="Edit remarks"
            sx={{
              width: "100%",
              textAlign: "left",
              font: "inherit",
              color: "inherit",
              cursor: "pointer",
              border: 0,
              borderRadius: 2,
              p: 1.25,
              bgcolor: (t) => alpha(t.palette.background.paper, 0.6),
              "&:hover": { bgcolor: (t) => alpha(t.palette.background.paper, 0.9) },
            }}
          >
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, display: "block" }}>
              Your remarks
            </Typography>
            <Typography variant="body2" sx={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
              {savedRemarks}
            </Typography>
          </Box>
        ) : (
          <Button size="small" startIcon={<NotesOutlinedIcon />} onClick={() => setEditingRemarks(true)} sx={{ ml: -0.75, fontWeight: 700 }}>
            Add remarks
          </Button>
        )}
      </Box>

      {/* Actions */}
      <Box
        sx={{
          ...row,
          justifyContent: "space-between",
          gap: 1.5,
          mt: 2,
          pt: 1.5,
          borderTop: "1px solid",
          borderColor: "divider",
        }}
      >
        <TextField
          select
          size="small"
          value={status}
          disabled={busy}
          onChange={(e) => onStatusChange(ticket, e.target.value)}
          slotProps={{ htmlInput: { "aria-label": "Ticket status" } }}
          sx={{
            flex: { xs: 1, sm: "none" },
            minWidth: { sm: 170 },
            "& .MuiOutlinedInput-root": {
              borderRadius: 2.5,
              fontWeight: 700,
              bgcolor: (t) => (STATUS_TONE[status] === "default" ? alpha(t.palette.text.primary, 0.07) : alpha(t.palette[STATUS_TONE[status] || "warning"].main, 0.1)),
              color: (t) => (STATUS_TONE[status] === "default" ? t.palette.text.secondary : t.palette[STATUS_TONE[status] || "warning"].dark),
            },
          }}
        >
          {/* A cancelled request can still be reopened; "Cancelled" is only listed while it is the current value */}
          {(status === "Cancelled" ? ["Cancelled", ...STATUS_OPTIONS] : STATUS_OPTIONS).map((opt) => (
            <MenuItem key={opt} value={opt} disabled={opt === "Cancelled"}>{opt}</MenuItem>
          ))}
        </TextField>

        {!resolved && (
          <Button size="small" color="error" startIcon={<CancelOutlinedIcon />} onClick={() => onCancel(ticket)} disabled={busy} sx={{ fontWeight: 700, minHeight: 40, textTransform: "none" }}>
            Cancel request
          </Button>
        )}
      </Box>
    </Paper>
  );
}

export default function MaintenancePage() {
  const { currentUser } = useAuth() || {};
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [view, setView] = useState("active");
  const [propertyFilter, setPropertyFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState("");
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [toast, setToast] = useState({ open: false, severity: "success", message: "" });

  const notify = (message, severity = "success") => setToast({ open: true, severity, message });

  useEffect(() => {
    if (!currentUser?.uid) {
      setLoading(false);
      return undefined;
    }

    const q = query(collection(db, "maintenance_tickets"), where("ownerUid", "==", currentUser.uid));

    const unsubscribeSnapshot = onSnapshot(
      q,
      (snapshot) => {
        setTickets(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
        setError("");
        setLoading(false);
      },
      (err) => {
        console.error("Failed to load maintenance tickets:", err);
        setError("Insufficient permissions or database error. Check your Firestore rules.");
        setLoading(false);
      }
    );

    return () => unsubscribeSnapshot();
  }, [currentUser?.uid]);

  // Tell the tenant (best effort: the change itself has already been saved)
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
        ...(statusOf(ticket) === "Cancelled" ? { cancelledAt: deleteField(), cancelReason: deleteField() } : {}),
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
      notify(`Marked as ${newStatus.toLowerCase()}.${newStatus === "Resolved" ? " It moves to Resolved." : ""}`);
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

  const propertyNames = useMemo(
    () => [...new Set(tickets.map((t) => t.propertyName).filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    [tickets]
  );

  // Everything below respects the property filter, so the numbers always match the list
  const scoped = useMemo(
    () => (propertyFilter === "all" ? tickets : tickets.filter((t) => t.propertyName === propertyFilter)),
    [tickets, propertyFilter]
  );

  const stats = useMemo(() => {
    const open = scoped.filter((t) => !isClosed(t));
    return {
      open: open.length,
      pending: open.filter((t) => statusOf(t) === "Pending").length,
      inProgress: open.filter((t) => statusOf(t) === "In Progress").length,
      highPriority: open.filter((t) => t.priority?.tier === "High").length,
    };
  }, [scoped]);

  const rankedTickets = useMemo(() => {
    const ranked = rankMaintenanceRequests(scoped);
    // Open work first (already in priority order), finished work after, newest first
    const closedTime = (t) => (toDate(t.resolvedAt) || toDate(t.cancelledAt) || toDate(t.updatedAt) || toDate(t.createdAt))?.getTime() || 0;
    return [...ranked.filter((t) => !isClosed(t)), ...ranked.filter(isClosed).sort((a, b) => closedTime(b) - closedTime(a))];
  }, [scoped]);

  const activeView = VIEWS.find((v) => v.key === view) || VIEWS[0];
  const visibleTickets = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rankedTickets.filter((t) => {
      if (!activeView.test(t)) return false;
      if (!term) return true;
      return [t.title, t.description, t.tenantName, t.propertyName, t.roomNumber].some((v) => String(v || "").toLowerCase().includes(term));
    });
  }, [rankedTickets, activeView, search]);

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
        <Skeleton variant="rounded" height={76} sx={{ borderRadius: 3, mb: 2.5 }} />
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} variant="rounded" height={150} sx={{ borderRadius: 3, mb: 2 }} />
        ))}
      </Box>
    );
  }

  const emptyTitle =
    tickets.length === 0
      ? "No maintenance requests yet"
      : view === "active" && !search.trim() && propertyFilter === "all"
      ? "Nothing needs attention"
      : "No requests match";
  const emptyBody =
    tickets.length === 0
      ? "When a tenant reports an issue, it will show up here."
      : view === "active" && !search.trim() && propertyFilter === "all"
      ? "All requests are resolved or cancelled. Look under Resolved to review them."
      : search.trim()
      ? "Try a different search."
      : "Nothing in this view.";

  return (
    <Box sx={{ minWidth: 0 }}>
      <Typography color="text.secondary" sx={{ mb: { xs: 2, sm: 2.5 } }}>
        Repair requests from your tenants, most urgent first.
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2.5 }}>
          {error}
        </Alert>
      )}

      {tickets.length > 0 && (
        <SummaryStrip
          items={[
            { label: "Open requests", value: stats.open },
            { label: "Pending review", value: stats.pending, color: stats.pending > 0 ? "warning.main" : undefined },
            { label: "In progress", value: stats.inProgress, color: stats.inProgress > 0 ? "info.main" : undefined },
            { label: "High priority", value: stats.highPriority, color: stats.highPriority > 0 ? "error.main" : undefined },
          ]}
        />
      )}

      {/* Search, property, and view */}
      {tickets.length > 0 && (
        <Box sx={{ mb: { xs: 2, sm: 2.5 } }}>
          {(tickets.length > 5 || propertyNames.length > 1) && (
            <Box sx={{ display: "flex", flexDirection: { xs: "column", sm: "row" }, gap: 1.25, mb: 1.5 }}>
              <Paper
                elevation={0}
                sx={{ ...row, flex: 1, gap: 1, px: 1.5, bgcolor: "background.default", border: "1px solid", borderColor: "divider", borderRadius: 3, height: 46, maxWidth: { sm: 420 } }}
              >
                <SearchIcon sx={{ color: "text.secondary" }} />
                <InputBase
                  fullWidth
                  placeholder="Search title, tenant or room"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  inputProps={{ "aria-label": "Search requests" }}
                />
                {search && (
                  <IconButton size="small" aria-label="Clear search" onClick={() => setSearch("")}>
                    <CloseIcon fontSize="small" />
                  </IconButton>
                )}
              </Paper>
              {propertyNames.length > 1 && (
                <TextField
                  select
                  size="small"
                  value={propertyFilter}
                  onChange={(e) => setPropertyFilter(e.target.value)}
                  slotProps={{ htmlInput: { "aria-label": "Filter by property" } }}
                  sx={{ minWidth: { sm: 200 }, "& .MuiOutlinedInput-root": { borderRadius: 3, height: 46 } }}
                >
                  <MenuItem value="all">All properties</MenuItem>
                  {propertyNames.map((p) => (
                    <MenuItem key={p} value={p}>{p}</MenuItem>
                  ))}
                </TextField>
              )}
            </Box>
          )}

          <Box
            sx={{
              display: "flex",
              gap: 1,
              overflowX: "auto",
              mx: { xs: -2, sm: 0 },
              px: { xs: 2, sm: 0 },
              scrollbarWidth: "none",
              "&::-webkit-scrollbar": { display: "none" },
            }}
          >
            {VIEWS.map((v) => (
              <Chip
                key={v.key}
                label={`${v.label} · ${countFor(v)}`}
                clickable
                onClick={() => setView(v.key)}
                color={view === v.key ? "primary" : "default"}
                variant={view === v.key ? "filled" : "outlined"}
                sx={{ fontWeight: 700, flexShrink: 0, height: 36, borderRadius: 18 }}
              />
            ))}
          </Box>
        </Box>
      )}

      {/* TICKET LIST */}
      {visibleTickets.length === 0 ? (
        <Paper elevation={0} sx={{ ...cardSx, borderStyle: tickets.length === 0 ? "dashed" : "solid", py: { xs: 5, sm: 7 }, px: 3, textAlign: "center" }}>
          <Box sx={{ width: 64, height: 64, borderRadius: "50%", mx: "auto", mb: 2, ...row, justifyContent: "center", bgcolor: "rgba(255, 69, 0, 0.10)" }}>
            {tickets.length > 0 && view === "active" && !filtersActive ? (
              <InventoryOutlinedIcon sx={{ fontSize: 30, color: "primary.main" }} />
            ) : (
              <BuildOutlinedIcon sx={{ fontSize: 30, color: "primary.main" }} />
            )}
          </Box>
          <Typography sx={{ fontWeight: 700 }}>{emptyTitle}</Typography>
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
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 1fr)",
            gap: 2,
          }}
        >
          {visibleTickets.map((t) => (
            <TicketCard key={t.id} ticket={t} busy={busyId === t.id} onStatusChange={handleStatusChange} onCancel={openCancel} notify={notify} />
          ))}
        </Box>
      )}

      {/* Cancellation confirmation */}
      <Dialog
        open={Boolean(cancelTarget)}
        onClose={() => !cancelling && setCancelTarget(null)}
        maxWidth="xs"
        fullWidth
        slotProps={{ paper: { sx: { borderRadius: 3, m: 2, width: "calc(100% - 32px)" } } }}
      >
        <DialogTitle sx={{ fontWeight: 800 }}>Cancel this request?</DialogTitle>
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
          />
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button color="inherit" onClick={() => setCancelTarget(null)} disabled={cancelling} sx={{ fontWeight: 600 }}>
            Keep request
          </Button>
          <Button color="error" variant="contained" disableElevation onClick={confirmCancel} disabled={cancelling} sx={{ fontWeight: 700, minWidth: 130 }}>
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