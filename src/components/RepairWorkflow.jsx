// Repair-request steps shared by the owner's Maintenance page and the
// caretaker's Repairs tab (panel revisions, logic in utils/maintenanceWorkflow.js):
//  - PriorityDialog: change a request's priority (its AHP category) with a reason
//  - ResolveDialog: mark a request resolved, with resolution notes
//  - RepairOutcome: what happened after the report — priority changes, a
//    reopened request, how it was fixed, the tenant's confirmation and rating
import { useState } from "react";
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
  TextField,
  Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import CloseIcon from "@mui/icons-material/Close";
import ShieldOutlinedIcon from "@mui/icons-material/ShieldOutlined";
import BoltOutlinedIcon from "@mui/icons-material/BoltOutlined";
import BrushOutlinedIcon from "@mui/icons-material/BrushOutlined";
import SwapVertOutlinedIcon from "@mui/icons-material/SwapVertOutlined";
import TaskAltOutlinedIcon from "@mui/icons-material/TaskAltOutlined";
import ReplayOutlinedIcon from "@mui/icons-material/ReplayOutlined";
import HourglassEmptyOutlinedIcon from "@mui/icons-material/HourglassEmptyOutlined";
import StarRoundedIcon from "@mui/icons-material/StarRounded";
import {
  MAX_PRIORITY_REASON,
  MAX_RESOLUTION_NOTES,
  PRIORITY_CHOICES,
  categoryOf,
  feedbackState,
  labelOfCategory,
  lastPriorityChange,
  priorityChangesOf,
  statusOf,
  tierOfCategory,
  validatePriorityChange,
  validateResolutionNotes,
} from "../utils/maintenanceWorkflow";
import { t } from "../i18n";

const row = { display: "flex", alignItems: "center" };
const TIER_TONE = { High: "error", Medium: "warning", Low: "default" };
const ICONS = { safety: ShieldOutlinedIcon, utility: BoltOutlinedIcon, routine: BrushOutlinedIcon };
// Same examples the tenant sees when reporting
const HINTS = {
  safety: "e.g. exposed wiring, broken lock",
  utility: "e.g. clogged drain, appliance issue",
  routine: "e.g. paint chip, cosmetic issue",
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
const roleWord = (role) => (role === "owner" ? t("owner") : role === "caretaker" ? t("caretaker") : role || "");

function Tag({ label, tone = "default", icon }) {
  return (
    <Chip
      label={label}
      icon={icon}
      size="small"
      sx={{
        fontWeight: 700,
        maxWidth: "100%",
        "& .MuiChip-icon": { fontSize: 15, ml: 0.75, color: "inherit" },
        bgcolor: (th) => (tone === "default" ? alpha(th.palette.text.primary, 0.07) : alpha(th.palette[tone].main, 0.13)),
        color: (th) => (tone === "default" ? th.palette.text.secondary : th.palette[tone].dark),
      }}
    />
  );
}

function DialogFrame({ open, title, busy, onClose, paper, fullScreen, children, actions }) {
  return (
    <Dialog open={open} onClose={() => !busy && onClose()} fullWidth maxWidth="xs" fullScreen={fullScreen} slotProps={{ paper: paper || { sx: { borderRadius: 3, bgcolor: "background.default", m: 2, width: "calc(100% - 32px)" } } }}>
      <DialogTitle sx={{ ...row, justifyContent: "space-between", gap: 1, fontWeight: 800 }}>
        {title}
        <IconButton edge="end" aria-label={t("Close")} onClick={onClose} disabled={busy}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent>{children}</DialogContent>
      <DialogActions sx={{ p: 2, pb: "calc(16px + env(safe-area-inset-bottom))", gap: 1, "& .MuiButton-root": { minHeight: 46 } }}>{actions}</DialogActions>
    </Dialog>
  );
}

/* ---------------- Change priority ---------------- */

// `onSave({ category, reason })` saves and resolves; a thrown error shows here
export function PriorityDialog({ ticket, onClose, onSave, paper, fullScreen }) {
  // The form is keyed by ticket, so it starts fresh for each request
  return ticket ? <PriorityForm key={ticket.id} ticket={ticket} onClose={onClose} onSave={onSave} paper={paper} fullScreen={fullScreen} /> : null;
}

function PriorityForm({ ticket, onClose, onSave, paper, fullScreen }) {
  const current = categoryOf(ticket);
  const [category, setCategory] = useState(current);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const save = async () => {
    const problem = validatePriorityChange(ticket, category, reason);
    if (problem) {
      setError(t(problem));
      return;
    }
    setBusy(true);
    setError("");
    try {
      await onSave({ category, reason: reason.trim() });
    } catch (err) {
      console.error("Couldn't change the priority:", err);
      setError(t("Couldn't change the priority. Please try again."));
      setBusy(false);
    }
  };

  return (
    <DialogFrame
      open
      title={t("Change priority")}
      busy={busy}
      onClose={onClose}
      paper={paper}
      fullScreen={fullScreen}
      actions={
        <>
          <Button color="inherit" onClick={onClose} disabled={busy} sx={{ fontWeight: 700 }}>
            {t("Cancel")}
          </Button>
          <Button variant="contained" disableElevation onClick={save} disabled={busy || category === current || !reason.trim()} sx={{ fontWeight: 800, borderRadius: 2.5, px: 3, minWidth: 140 }}>
            {busy ? <CircularProgress size={20} color="inherit" /> : t("Save priority")}
          </Button>
        </>
      }
    >
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {t("\"{title}\" was reported as {category} ({tier} priority). The priority comes from the category, so pick the one that fits after checking it.", {
          title: ticket.title || t("Untitled request"),
          category: t(labelOfCategory(current)),
          tier: t(tierOfCategory(current)),
        })}
      </Typography>
      {error && (
        <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
          {error}
        </Alert>
      )}
      <Box role="radiogroup" aria-label={t("Priority")} sx={{ display: "grid", gap: 1, mb: 2 }}>
        {PRIORITY_CHOICES.map((c) => {
          const on = category === c.category;
          const Icon = ICONS[c.category];
          return (
            <Box
              key={c.category}
              component="button"
              type="button"
              role="radio"
              aria-checked={on}
              disabled={busy}
              onClick={() => {
                setCategory(c.category);
                setError("");
              }}
              sx={{
                ...row,
                gap: 1.25,
                width: "100%",
                textAlign: "left",
                font: "inherit",
                color: "inherit",
                cursor: busy ? "default" : "pointer",
                p: 1.25,
                borderRadius: 2,
                border: "2px solid",
                borderColor: on ? "primary.main" : "divider",
                bgcolor: on ? (th) => alpha(th.palette.primary.main, 0.06) : "background.paper",
                "&:focus-visible": { outline: "2px solid", outlineColor: "primary.main", outlineOffset: 2 },
              }}
            >
              <Icon sx={{ color: on ? "primary.main" : "text.secondary" }} />
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography sx={{ fontWeight: 800, lineHeight: 1.3 }}>
                  {t(c.label)}
                  {c.category === current ? ` · ${t("now")}` : ""}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {t(HINTS[c.category])}
                </Typography>
              </Box>
              <Tag label={t("{tier} priority", { tier: t(c.tier) })} tone={TIER_TONE[c.tier]} />
            </Box>
          );
        })}
      </Box>
      <TextField
        fullWidth
        size="small"
        multiline
        minRows={2}
        required
        label={t("Reason for the change")}
        placeholder={t("e.g. checked it: sparks come from the outlet")}
        value={reason}
        disabled={busy}
        onChange={(e) => {
          setReason(e.target.value.slice(0, MAX_PRIORITY_REASON));
          setError("");
        }}
        helperText={t("{n}/{max} · the tenant sees this", { n: reason.length, max: MAX_PRIORITY_REASON })}
      />
    </DialogFrame>
  );
}

/* ---------------- Mark as resolved ---------------- */

export function ResolveDialog({ ticket, onClose, onSave, paper, fullScreen }) {
  return ticket ? <ResolveForm key={ticket.id} ticket={ticket} onClose={onClose} onSave={onSave} paper={paper} fullScreen={fullScreen} /> : null;
}

function ResolveForm({ ticket, onClose, onSave, paper, fullScreen }) {
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const save = async () => {
    const problem = validateResolutionNotes(notes);
    if (problem) {
      setError(t(problem));
      return;
    }
    setBusy(true);
    setError("");
    try {
      await onSave({ notes: notes.trim() });
    } catch (err) {
      console.error("Couldn't mark it resolved:", err);
      setError(t("Couldn't mark it resolved. Please try again."));
      setBusy(false);
    }
  };

  return (
    <DialogFrame
      open
      title={t("Mark as resolved")}
      busy={busy}
      onClose={onClose}
      paper={paper}
      fullScreen={fullScreen}
      actions={
        <>
          <Button color="inherit" onClick={onClose} disabled={busy} sx={{ fontWeight: 700 }}>
            {t("Cancel")}
          </Button>
          <Button variant="contained" color="success" disableElevation onClick={save} disabled={busy || !notes.trim()} sx={{ fontWeight: 800, borderRadius: 2.5, px: 3, minWidth: 140 }}>
            {busy ? <CircularProgress size={20} color="inherit" /> : t("Mark resolved")}
          </Button>
        </>
      }
    >
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {t("Write what was done to fix \"{title}\". {name} will be asked to confirm that it is fixed and to rate the service.", {
          title: ticket.title || t("Untitled request"),
          name: ticket.tenantName || t("The tenant"),
        })}
      </Typography>
      {error && (
        <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
          {error}
        </Alert>
      )}
      <TextField
        fullWidth
        multiline
        minRows={3}
        required
        autoFocus
        label={t("Resolution notes")}
        placeholder={t("e.g. replaced the faucet washer and checked for leaks")}
        value={notes}
        disabled={busy}
        onChange={(e) => {
          setNotes(e.target.value.slice(0, MAX_RESOLUTION_NOTES));
          setError("");
        }}
        helperText={t("{n}/{max} · the tenant sees this", { n: notes.length, max: MAX_RESOLUTION_NOTES })}
      />
    </DialogFrame>
  );
}

/* ---------------- What happened after the report ---------------- */

const box = (tone) => ({ mt: 1.25, p: 1.25, borderRadius: 2, bgcolor: (th) => alpha(th.palette[tone].main, 0.08) });

export function RepairOutcome({ ticket, compact = false }) {
  const status = statusOf(ticket);
  const changes = priorityChangesOf(ticket);
  const last = lastPriorityChange(ticket);
  const state = feedbackState(ticket);
  const reopened = Number(ticket.reopenCount) > 0 && ticket.reopenReason && ["Pending", "In Progress"].includes(status);

  return (
    <>
      {last && !compact && (
        <Box sx={box("info")}>
          <Typography variant="caption" sx={{ ...row, gap: 0.5, fontWeight: 800, color: "info.dark" }}>
            <SwapVertOutlinedIcon sx={{ fontSize: 15 }} />
            {t("Priority changed: {from} → {to}", { from: t(last.fromTier || tierOfCategory(last.from)), to: t(last.toTier || tierOfCategory(last.to)) })}
            {changes.length > 1 ? ` · ${t("{n} changes", { n: changes.length })}` : ""}
          </Typography>
          {last.reason && (
            <Typography variant="body2" sx={{ overflowWrap: "anywhere", whiteSpace: "pre-wrap" }}>
              {last.reason}
            </Typography>
          )}
          <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
            {[last.byName, roleWord(last.byRole)].filter(Boolean).join(" · ")}
            {last.at ? ` · ${shortDate(last.at)}` : ""}
            {ticket.originalCategory ? ` · ${t("tenant chose {category}", { category: t(labelOfCategory(ticket.originalCategory)) })}` : ""}
          </Typography>
        </Box>
      )}

      {reopened && (
        <Box sx={box("warning")}>
          <Typography variant="caption" sx={{ ...row, gap: 0.5, fontWeight: 800, color: "warning.dark" }}>
            <ReplayOutlinedIcon sx={{ fontSize: 15 }} />
            {Number(ticket.reopenCount) > 1 ? t("Reopened by the tenant ({n} times)", { n: ticket.reopenCount }) : t("Reopened by the tenant")}
            {ticket.reopenedAt ? ` · ${shortDate(ticket.reopenedAt)}` : ""}
          </Typography>
          <Typography variant="body2" sx={{ overflowWrap: "anywhere", whiteSpace: "pre-wrap" }}>
            {ticket.reopenReason}
          </Typography>
        </Box>
      )}

      {status === "Resolved" && ticket.resolutionNotes && (
        <Box sx={box("success")}>
          <Typography variant="caption" sx={{ ...row, gap: 0.5, fontWeight: 800, color: "success.dark" }}>
            <TaskAltOutlinedIcon sx={{ fontSize: 15 }} />
            {t("How it was fixed")}
          </Typography>
          <Typography variant="body2" sx={{ overflowWrap: "anywhere", whiteSpace: "pre-wrap", ...(compact ? { display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" } : {}) }}>
            {ticket.resolutionNotes}
          </Typography>
          {!compact && (ticket.resolvedByName || ticket.resolvedAt) && (
            <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
              {[ticket.resolvedByName, roleWord(ticket.resolvedByRole)].filter(Boolean).join(" · ")}
              {ticket.resolvedAt ? ` · ${shortDate(ticket.resolvedAt)}` : ""}
            </Typography>
          )}
        </Box>
      )}

      {state !== "none" && (
        <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 0.75, mt: 1.25 }}>
          {state === "awaiting" ? (
            <Tag label={t("Waiting for the tenant to confirm")} tone="warning" icon={<HourglassEmptyOutlinedIcon />} />
          ) : (
            <Tag label={t("Tenant confirmed the fix")} tone="success" icon={<TaskAltOutlinedIcon />} />
          )}
          {state === "reviewed" && <Tag label={t("Rated {n}/5", { n: ticket.review.rating })} tone="warning" icon={<StarRoundedIcon />} />}
        </Box>
      )}
      {state === "reviewed" && ticket.review.comment && !compact && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75, overflowWrap: "anywhere", whiteSpace: "pre-wrap", fontStyle: "italic" }}>
          “{ticket.review.comment}”
        </Typography>
      )}
    </>
  );
}
