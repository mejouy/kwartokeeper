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
  Tooltip,
  Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import BuildOutlinedIcon from "@mui/icons-material/BuildOutlined";
import AccessTimeOutlinedIcon from "@mui/icons-material/AccessTimeOutlined";
import DeleteOutlinedIcon from "@mui/icons-material/DeleteOutlined";
import NotesOutlinedIcon from "@mui/icons-material/NotesOutlined";
import SearchIcon from "@mui/icons-material/Search";
import CloseIcon from "@mui/icons-material/Close";

import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  updateDoc,
  deleteDoc,
} from "firebase/firestore";
import { db } from "../../config/firebase";
import { useAuth } from "../../context/AuthContext";
import { rankMaintenanceRequests } from "../../utils/maintenancePrioritization";

const row = { display: "flex", alignItems: "center" };

const TIER_TONE = { High: "error", Medium: "warning", Low: "default" };
const STATUS_TONE = { Pending: "warning", "In Progress": "info", Resolved: "success" };

const STATUS_OPTIONS = ["Pending", "In Progress", "Resolved"];
const FILTER_OPTIONS = ["All", ...STATUS_OPTIONS];
const MAX_REMARKS = 500;

const statusOf = (t) => t.status || "Pending";

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
function TicketCard({ ticket, onStatusChange, onDelete, notify }) {
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
  const resolved = status === "Resolved";
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
          </Typography>
        </Box>
        <Pill label={`${tier} priority`} tone={TIER_TONE[tier] || "default"} outlined />
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
          onChange={(e) => onStatusChange(ticket.id, e.target.value)}
          aria-label="Ticket status"
          sx={{
            flex: { xs: 1, sm: "none" },
            minWidth: { sm: 170 },
            "& .MuiOutlinedInput-root": {
              borderRadius: 2.5,
              fontWeight: 700,
              bgcolor: (t) => alpha(t.palette[STATUS_TONE[status] || "warning"].main, 0.1),
              color: (t) => t.palette[STATUS_TONE[status] || "warning"].dark,
            },
          }}
        >
          {STATUS_OPTIONS.map((opt) => (
            <MenuItem key={opt} value={opt}>{opt}</MenuItem>
          ))}
        </TextField>

        <Tooltip title="Delete ticket">
          <IconButton size="small" color="error" onClick={() => onDelete(ticket)} aria-label="Delete ticket">
            <DeleteOutlinedIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>
    </Paper>
  );
}

export default function MaintenancePage() {
  const { currentUser } = useAuth() || {};
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState({ open: false, severity: "success", message: "" });

  const notify = (message, severity = "success") => setToast({ open: true, severity, message });

  useEffect(() => {
    if (!currentUser?.uid) {
      setLoading(false);
      return undefined;
    }

    const q = query(
      collection(db, "maintenance_tickets"),
      where("ownerUid", "==", currentUser.uid)
    );

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

  const handleStatusChange = async (ticketId, newStatus) => {
    try {
      await updateDoc(doc(db, "maintenance_tickets", ticketId), {
        status: newStatus,
        updatedAt: new Date(),
      });
      notify(`Marked as ${newStatus}.`);
    } catch (err) {
      console.error("Failed to update ticket status:", err);
      notify("Failed to update status. You may not have permission.", "error");
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteDoc(doc(db, "maintenance_tickets", deleteTarget.id));
      setDeleteTarget(null);
      notify("Ticket deleted.");
    } catch (err) {
      console.error("Failed to delete ticket:", err);
      notify("Failed to delete ticket.", "error");
    } finally {
      setDeleting(false);
    }
  };

  // Summary metrics. "High priority" only counts tickets still open.
  const stats = useMemo(() => {
    const open = tickets.filter((t) => statusOf(t) !== "Resolved");
    return {
      total: tickets.length,
      pending: tickets.filter((t) => statusOf(t) === "Pending").length,
      inProgress: tickets.filter((t) => t.status === "In Progress").length,
      resolved: tickets.filter((t) => statusOf(t) === "Resolved").length,
      highPriority: open.filter((t) => t.priority?.tier === "High").length,
    };
  }, [tickets]);

  const rankedTickets = useMemo(() => rankMaintenanceRequests(tickets), [tickets]);

  const visibleTickets = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rankedTickets.filter((t) => {
      if (statusFilter !== "All" && statusOf(t) !== statusFilter) return false;
      if (!term) return true;
      return [t.title, t.description, t.tenantName, t.propertyName, t.roomNumber].some((v) =>
        String(v || "").toLowerCase().includes(term)
      );
    });
  }, [rankedTickets, statusFilter, search]);

  const countFor = (opt) =>
    opt === "All" ? stats.total : opt === "Pending" ? stats.pending : opt === "In Progress" ? stats.inProgress : stats.resolved;

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

  return (
    <Box sx={{ minWidth: 0 }}>
      {/* The top bar already names the page, so just a line of context */}
      <Typography color="text.secondary" sx={{ mb: { xs: 2, sm: 2.5 } }}>
        Monitor and prioritize repair requests across all your properties.
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2.5 }}>
          {error}
        </Alert>
      )}

      {tickets.length > 0 && (
        <SummaryStrip
          items={[
            { label: "Total requests", value: stats.total },
            { label: "Pending review", value: stats.pending, color: stats.pending > 0 ? "warning.main" : undefined },
            { label: "In progress", value: stats.inProgress, color: stats.inProgress > 0 ? "info.main" : undefined },
            { label: "High priority (open)", value: stats.highPriority, color: stats.highPriority > 0 ? "error.main" : undefined },
          ]}
        />
      )}

      {/* Search + status filter */}
      {tickets.length > 0 && (
        <Box sx={{ mb: { xs: 2, sm: 2.5 } }}>
          {tickets.length > 5 && (
            <Paper
              elevation={0}
              sx={{ ...row, gap: 1, px: 1.5, bgcolor: "background.default", border: "1px solid", borderColor: "divider", borderRadius: 3, height: 46, mb: 1.5 }}
            >
              <SearchIcon sx={{ color: "text.secondary" }} />
              <InputBase
                fullWidth
                placeholder="Search title, tenant, property or room"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                inputProps={{ "aria-label": "Search tickets" }}
              />
              {search && (
                <IconButton size="small" aria-label="Clear search" onClick={() => setSearch("")}>
                  <CloseIcon fontSize="small" />
                </IconButton>
              )}
            </Paper>
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
            {FILTER_OPTIONS.map((opt) => (
              <Chip
                key={opt}
                label={`${opt} · ${countFor(opt)}`}
                clickable
                onClick={() => setStatusFilter(opt)}
                color={statusFilter === opt ? "primary" : "default"}
                variant={statusFilter === opt ? "filled" : "outlined"}
                sx={{ fontWeight: 700, flexShrink: 0, height: 34, borderRadius: 17 }}
              />
            ))}
          </Box>
        </Box>
      )}

      {/* TICKET LIST */}
      {visibleTickets.length === 0 ? (
        <Paper elevation={0} sx={{ ...cardSx, borderStyle: tickets.length === 0 ? "dashed" : "solid", py: { xs: 5, sm: 7 }, px: 3, textAlign: "center" }}>
          <Box sx={{ width: 64, height: 64, borderRadius: "50%", mx: "auto", mb: 2, ...row, justifyContent: "center", bgcolor: "rgba(255, 69, 0, 0.10)" }}>
            <BuildOutlinedIcon sx={{ fontSize: 30, color: "primary.main" }} />
          </Box>
          <Typography sx={{ fontWeight: 700 }}>
            {tickets.length === 0 ? "No maintenance requests yet" : "No tickets match"}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {tickets.length === 0
              ? "When a tenant reports an issue, it will show up here."
              : search
                ? "Try a different search."
                : `No tickets with status "${statusFilter}".`}
          </Typography>
          {tickets.length > 0 && (statusFilter !== "All" || search) && (
            <Button size="small" onClick={() => { setStatusFilter("All"); setSearch(""); }} sx={{ mt: 1.5, fontWeight: 700 }}>
              Clear filters
            </Button>
          )}
        </Paper>
      ) : (
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "minmax(0, 1fr)", lg: "repeat(2, minmax(0, 1fr))" },
            gap: 2,
            alignItems: "start",
          }}
        >
          {visibleTickets.map((t) => (
            <TicketCard
              key={t.id}
              ticket={t}
              onStatusChange={handleStatusChange}
              onDelete={setDeleteTarget}
              notify={notify}
            />
          ))}
        </Box>
      )}

      {/* Delete confirmation */}
      <Dialog open={Boolean(deleteTarget)} onClose={() => !deleting && setDeleteTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>Delete this ticket?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            {deleteTarget ? `"${deleteTarget.title || "Untitled request"}" will be removed for good. This can't be undone.` : ""}
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button color="inherit" onClick={() => setDeleteTarget(null)} disabled={deleting} sx={{ fontWeight: 600 }}>
            Keep it
          </Button>
          <Button color="error" variant="contained" disableElevation onClick={confirmDelete} disabled={deleting} sx={{ fontWeight: 700, minWidth: 110 }}>
            {deleting ? <CircularProgress size={20} color="inherit" /> : "Delete ticket"}
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