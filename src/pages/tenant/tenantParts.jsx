// Shared pieces of the tenant area: constants, small helpers, hooks and the
// small components the tabs are built from (moved out of TenantDashboard.jsx).
/* eslint-disable react-refresh/only-export-components */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Box, Button, Chip, GlobalStyles, IconButton, Paper, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import ReceiptLongOutlinedIcon from "@mui/icons-material/ReceiptLongOutlined";
import AddIcon from "@mui/icons-material/Add";
import CloseIcon from "@mui/icons-material/Close";
import CheckIcon from "@mui/icons-material/Check";
import ShieldOutlinedIcon from "@mui/icons-material/ShieldOutlined";
import BoltOutlinedIcon from "@mui/icons-material/BoltOutlined";
import BrushOutlinedIcon from "@mui/icons-material/BrushOutlined";
import PhotoCameraOutlinedIcon from "@mui/icons-material/PhotoCameraOutlined";
import WarningAmberOutlinedIcon from "@mui/icons-material/WarningAmberOutlined";
import ErrorOutlinedIcon from "@mui/icons-material/ErrorOutlined";
import RefreshOutlinedIcon from "@mui/icons-material/RefreshOutlined";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import DeleteOutlinedIcon from "@mui/icons-material/DeleteOutlined";
import { CATEGORIES } from "../../utils/maintenancePrioritization";
// Translation is "tr" here: TicketCard already calls its ticket "t"
import { t as tr } from "../../i18n";

/* ---------------------------------------------------------------------------
   Constants
--------------------------------------------------------------------------- */
export const RULES_PREVIEW = 4; // rules shown before "Show all"
export const ADVANCE_MONTHS = 5; // how many months ahead a tenant can pay
export const periodLabel = (d) => d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
export const shortPeriod = (label) => {
  const [m, y] = String(label).split(" ");
  return `${(m || "").slice(0, 3)} ${y || ""}`.trim();
};
// "October 2026" / "October 2026 – December 2026" / "Oct, Dec 2026"
export const periodsText = (list) => {
  if (!list.length) return "";
  if (list.length === 1) return list[0];
  return `${shortPeriod(list[0])} – ${shortPeriod(list[list.length - 1])}${list.length > 2 ? ` (${list.length} months)` : ""}`;
};
export const PAGE_SIZE = 6; // long lists show this many at a time
export const ANNOUNCE_PREVIEW = 3; // announcements on the overview before "Show more"
export const ATTENTION_PREVIEW = 2; // alerts shown before "Show N more"
export const BOTTOM_NAV_H = 66; // the phone bottom bar in AppShell
export const row = { display: "flex", alignItems: "center" };
export const cardSx = { bgcolor: "background.default", border: "1px solid", borderColor: "divider", borderRadius: 3 };

export const CATEGORY_OPTIONS = [
  { value: CATEGORIES.SAFETY, label: tr("Safety"), hint: tr("e.g. exposed wiring, broken lock"), Icon: ShieldOutlinedIcon },
  { value: CATEGORIES.UTILITY, label: tr("Utility"), hint: tr("e.g. clogged drain, appliance issue"), Icon: BoltOutlinedIcon },
  { value: CATEGORIES.ROUTINE, label: tr("Routine"), hint: tr("e.g. paint chip, cosmetic issue"), Icon: BrushOutlinedIcon },
];

export const TIER_TONE = { High: "error", Medium: "warning", Low: "default" };
export const NOTE_TONE = { info: "info", warning: "warning", success: "success", error: "error" };

/*
|--------------------------------------------------------------------------
| PAYMENT ACCOUNTS
|--------------------------------------------------------------------------
| The owner sets these up in Payments → Payment accounts. They are stored on
| the property (properties/{id}.paymentMethods and .paymentNote) and read here.
|--------------------------------------------------------------------------
*/
export const PAY_METHOD_DEFS = [
  { key: "GCash", label: "GCash", kind: "wallet" },
  { key: "Maya", label: tr("Maya"), kind: "wallet" },
  { key: "QR Ph", label: tr("QR Ph"), kind: "qrph" },
];

// Only methods the owner switched on AND gave something to pay to
export const readPayMethods = (raw) =>
  PAY_METHOD_DEFS.map((d) => {
    const m = raw?.[d.key] || {};
    return {
      ...d,
      enabled: Boolean(m.enabled),
      accountName: String(m.accountName || ""),
      accountNumber: String(m.accountNumber || ""),
      qrUrl: String(m.qrUrl || ""),
    };
  }).filter((m) => m.enabled && (m.accountNumber.trim() || m.qrUrl));

export const prettyMobile = (n) => (/^09\d{9}$/.test(String(n)) ? `${n.slice(0, 4)} ${n.slice(4, 7)} ${n.slice(7)}` : n);

/* ---------------------------------------------------------------------------
   Helpers
--------------------------------------------------------------------------- */
export const peso = (n) => `₱${Number(n || 0).toLocaleString()}`;

export function getTodayInputValue() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

export function getTimestampMillis(value) {
  if (!value) return 0;
  if (typeof value?.toMillis === "function") return value.toMillis();
  // "2026-10-05" (the date inputs) is read as a LOCAL date, not UTC midnight
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split("-").map(Number);
    return new Date(y, m - 1, d).getTime();
  }
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? 0 : time;
}

export const fmtDate = (value, opts = { month: "short", day: "numeric", year: "numeric" }) => {
  const ms = getTimestampMillis(value);
  return ms ? new Date(ms).toLocaleDateString("en-US", opts) : "";
};

export const formatLeaseStart = (value) => {
  if (!value || value === "Not specified") return "Not specified";
  return fmtDate(value) || String(value);
};

export const LEASE_MONTHS = { "3_months": 3, "6_months": 6, "12_months": 12 };

export function formatLeaseDuration(val) {
  if (!val) return "Not specified";
  switch (val) {
    case "1_month":
      return "1 Month";
    case "3_months":
      return "3 Months";
    case "6_months":
      return "6 Months";
    case "12_months":
      return "12 Months";
    case "custom":
      return "Custom Term";
    default:
      return val;
  }
}

export function paymentTone(status) {
  switch (String(status || "").toLowerCase()) {
    case "paid":
      return "success";
    case "pending":
    case "pending verification":
    case "partial":
      return "warning";
    case "overdue":
    case "rejected":
      return "error";
    default:
      return "default";
  }
}

export const firstName = (name) => String(name || "").trim().split(/\s+/)[0] || "there";
export const initials = (name) =>
  String(name || "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("") || "T";

export const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? tr("Good morning") : h < 18 ? tr("Good afternoon") : tr("Good evening");
};

/* ---------------------------------------------------------------------------
   Visuals
--------------------------------------------------------------------------- */
// Fade/slide-up on first paint; off for "reduce motion" users.
export const AnimationStyles = (
  <GlobalStyles
    styles={{
      "@keyframes kkPop": { from: { opacity: 0, transform: "scale(0.6)" }, to: { opacity: 1, transform: "scale(1)" } },
      "@keyframes kkFadeUp": { from: { opacity: 0, transform: "translateY(10px)" }, to: { opacity: 1, transform: "translateY(0)" } },
      "@keyframes kkCheck": { from: { strokeDashoffset: 30 }, to: { strokeDashoffset: 0 } },
      // Snappier taps on phones: no 300ms delay, no grey flash
      "button, [role='button'], a": { WebkitTapHighlightColor: "transparent", touchAction: "manipulation" },
      "@media (prefers-reduced-motion: reduce)": {
        "*, *::before, *::after": { animationDuration: "0.001ms !important", transitionDuration: "0.001ms !important" },
      },
    }}
  />
);
export const rise = (i = 0) => ({ animation: `kkFadeUp .45s ease-out ${i * 70}ms both` });

// Dorm-facade windows from the login page. Here: lit = share of the lease that has passed.
export const WINDOW_COUNT = 30;
export const LIGHT_ORDER = [3, 17, 8, 24, 1, 12, 27, 5, 20, 14, 9, 29, 2, 22, 11, 6, 25, 16, 0, 19, 28, 7, 13, 23, 4, 21, 10, 26, 15, 18];
export const WINDOW_RANK = LIGHT_ORDER.reduce((acc, cell, rank) => ({ ...acc, [cell]: rank }), {});

export function LeaseWindows({ progress, caption }) {
  const lit = progress > 0 ? Math.max(1, Math.round(progress * WINDOW_COUNT)) : 0;
  return (
    <Box>
      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(10, 1fr)", gap: { xs: 0.6, md: 0.8 }, width: "100%", maxWidth: 300 }}>
        {Array.from({ length: WINDOW_COUNT }).map((_, i) => (
          <Box
            key={i}
            sx={{
              aspectRatio: "1",
              borderRadius: "3px",
              bgcolor: WINDOW_RANK[i] < lit ? "primary.main" : "rgba(202, 220, 246, 0.14)",
              animation: `kkPop 0.4s ease-out ${i * 18}ms both`,
            }}
          />
        ))}
      </Box>
      {caption && (
        <Typography variant="caption" sx={{ color: "#cadcf6", display: "block", mt: 1 }}>
          {caption}
        </Typography>
      )}
    </Box>
  );
}

// Horizontal progress track: steps are done / active / todo / error.
export function StepTrack({ steps, current = 0, complete = false, failed = false }) {
  const last = steps.length - 1;
  const stateOf = (i) => (failed && i === last ? "error" : complete || i < current ? "done" : i === current ? "active" : "todo");
  return (
    <Box sx={{ display: "flex", alignItems: "flex-start" }}>
      {steps.map((label, i) => {
        const st = stateOf(i);
        const color = st === "error" ? "error.main" : st === "todo" ? "divider" : "primary.main";
        return (
          <React.Fragment key={`${label}-${i}`}>
            <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", width: 64, flexShrink: 0 }}>
              <Box
                sx={{
                  width: 22,
                  height: 22,
                  borderRadius: "50%",
                  ...row,
                  justifyContent: "center",
                  border: "2px solid",
                  borderColor: color,
                  bgcolor: st === "done" ? "primary.main" : st === "error" ? "error.main" : "background.paper",
                  color: "#fff",
                  boxShadow: st === "active" ? (t) => `0 0 0 4px ${alpha(t.palette.primary.main, 0.18)}` : "none",
                }}
              >
                {st === "done" && <CheckIcon sx={{ fontSize: 14 }} />}
                {st === "error" && <CloseIcon sx={{ fontSize: 14 }} />}
                {st === "active" && <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: "primary.main" }} />}
              </Box>
              <Typography variant="caption" sx={{ mt: 0.5, fontWeight: st === "active" || st === "error" ? 800 : 600, color: st === "todo" ? "text.secondary" : "text.primary", textAlign: "center", lineHeight: 1.2 }}>
                {label}
              </Typography>
            </Box>
            {i < last && (
              <Box sx={{ flex: 1, height: 2, mt: "10px", mx: -2, bgcolor: complete || i < current ? "primary.main" : "divider", borderRadius: 1 }} />
            )}
          </React.Fragment>
        );
      })}
    </Box>
  );
}

/* ---------------------------------------------------------------------------
   Small UI pieces
--------------------------------------------------------------------------- */
export function Pill({ label, tone = "default", icon, sx }) {
  return (
    <Chip
      label={label}
      icon={icon}
      size="small"
      sx={{
        fontWeight: 700,
        "& .MuiChip-icon": { fontSize: 15, ml: 0.75, color: "inherit" },
        bgcolor: (t) => (tone === "default" ? alpha(t.palette.text.primary, 0.07) : alpha(t.palette[tone].main, 0.13)),
        color: (t) => (tone === "default" ? t.palette.text.secondary : t.palette[tone].dark),
        ...sx,
      }}
    />
  );
}

export function Panel({ title, icon, action, children, sx }) {
  return (
    <Paper elevation={0} sx={{ ...cardSx, p: { xs: 2, sm: 3 }, display: "flex", flexDirection: "column", minWidth: 0, ...sx }}>
      <Box sx={{ ...row, justifyContent: "space-between", gap: 1.5, mb: 2 }}>
        <Box sx={{ ...row, gap: 1.25, minWidth: 0 }}>
          {icon && (
            <Box sx={{ width: 34, height: 34, borderRadius: 2, flexShrink: 0, ...row, justifyContent: "center", bgcolor: "rgba(255, 69, 0, 0.1)", color: "primary.main" }}>
              {icon}
            </Box>
          )}
          <Typography variant="h6" noWrap sx={{ fontFamily: '"Inter", sans-serif', fontWeight: 700, fontSize: "1.05rem" }}>
            {title}
          </Typography>
        </Box>
        {action}
      </Box>
      {children}
    </Paper>
  );
}

export function EmptyState({ icon, title, body, action }) {
  return (
    <Box sx={{ textAlign: "center", py: { xs: 3, sm: 4 }, px: 2 }}>
      <Box sx={{ width: 56, height: 56, borderRadius: "50%", mx: "auto", mb: 1.5, ...row, justifyContent: "center", bgcolor: "rgba(255, 69, 0, 0.10)" }}>
        {icon}
      </Box>
      <Typography sx={{ fontWeight: 700 }}>{title}</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
        {body}
      </Typography>
      {action}
    </Box>
  );
}

export function Facts({ items }) {
  return (
    <Box sx={{ display: "flex", flexDirection: "column" }}>
      {items.map((it, i) => (
        <Box
          key={it.label}
          sx={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 0.9fr) minmax(0, 1.4fr)",
            gap: 1.5,
            py: 1.1,
            borderTop: i === 0 ? "none" : "1px solid",
            borderColor: "divider",
          }}
        >
          <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
            {it.label}
          </Typography>
          <Typography variant="body2" sx={{ fontWeight: 700, overflowWrap: "anywhere", color: it.color }}>
            {it.value}
          </Typography>
        </Box>
      ))}
    </Box>
  );
}

export function PaymentRow({ p, onClick }) {
  const status = p.status || "Pending";
  const date = fmtDate(p.paymentDate || p.createdAt);
  return (
    <Box
      component="button"
      type="button"
      onClick={onClick}
      sx={{
        ...row,
        gap: 1.5,
        width: "100%",
        textAlign: "left",
        font: "inherit",
        color: "inherit",
        cursor: onClick ? "pointer" : "default",
        p: 1.5,
        borderRadius: 2.5,
        bgcolor: (t) => alpha(t.palette.background.paper, 0.35),
        border: "1px solid",
        borderColor: "divider",
        transition: "border-color .15s",
        "&:hover": onClick ? { borderColor: "primary.main" } : undefined,
        "&:focus-visible": { outline: "2px solid", outlineColor: "primary.main", outlineOffset: 2 },
      }}
    >
      <Box sx={{ width: 40, height: 40, borderRadius: "50%", flexShrink: 0, ...row, justifyContent: "center", bgcolor: (t) => (paymentTone(status) === "default" ? alpha(t.palette.text.primary, 0.07) : alpha(t.palette[paymentTone(status)].main, 0.13)), color: (t) => (paymentTone(status) === "default" ? t.palette.text.secondary : t.palette[paymentTone(status)].dark) }}>
        <ReceiptLongOutlinedIcon fontSize="small" />
      </Box>
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography variant="subtitle2" noWrap sx={{ fontWeight: 700 }}>
          {p.periodMonth || tr("Payment")}
        </Typography>
        <Typography variant="caption" color="text.secondary" noWrap component="div">
          {p.paymentMethod || tr("Unknown method")}
          {date ? ` · ${date}` : ""}
        </Typography>
      </Box>
      <Box sx={{ textAlign: "right", flexShrink: 0 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
          {peso(p.amount)}
        </Typography>
        <Pill label={tr(status)} tone={paymentTone(status)} />
      </Box>
    </Box>
  );
}

// With many requests, each one is a short summary row (title, status, priority,
// date) that opens to the full details. `collapsible` turns that on.
export function TicketCard({ t, compact, onAction, collapsible = false, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  const tier = t.priority?.tier || "Low";
  const status = t.status || "Pending";
  const statusTone = status === "Resolved" ? "success" : status === "In Progress" ? "info" : status === "Cancelled" ? "default" : "warning";
  const date = fmtDate(t.createdAt);
  const stepIndex = status === "Resolved" ? 2 : status === "In Progress" ? 1 : 0;
  const details = !compact && (!collapsible || open);
  const updates = Array.isArray(t.followUps) ? t.followUps.length : 0;
  const hasNote = Boolean(t.remarks || t.resolutionNotes);

  const summary = (
    <>
      <Box sx={{ ...row, alignItems: "flex-start", justifyContent: "space-between", gap: 1 }}>
        <Typography sx={{ fontWeight: 800, overflowWrap: "anywhere", minWidth: 0 }}>{t.title}</Typography>
        <Box sx={{ ...row, gap: 0.5, flexShrink: 0 }}>
          <Pill label={tr(status)} tone={statusTone} />
          {collapsible && <ExpandMoreIcon sx={{ color: "text.secondary", transform: open ? "rotate(180deg)" : "none", transition: "transform .2s" }} />}
        </Box>
      </Box>
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75, mt: 1 }}>
        <Pill label={tr("{tier} priority", { tier: tr(tier) })} tone={TIER_TONE[tier]} />
        {t.category && <Pill label={String(t.category)} />}
        {date && <Pill label={tr("Reported {date}", { date })} />}
        {collapsible && !open && hasNote && <Pill label={tr("Landlord replied")} tone="info" />}
        {collapsible && !open && updates > 0 && <Pill label={updates === 1 ? tr("1 update") : tr("{n} updates", { n: updates })} />}
      </Box>
    </>
  );

  return (
    <Paper
      elevation={0}
      sx={{
        ...cardSx,
        p: { xs: 2, sm: 2.5 },
        borderLeft: "4px solid",
        borderLeftColor: (th) => (TIER_TONE[tier] === "default" ? th.palette.divider : th.palette[TIER_TONE[tier]].main),
        minWidth: 0,
      }}
    >
      {collapsible ? (
        <Box
          component="button"
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          sx={{ display: "block", width: "100%", p: 0, m: 0, border: 0, bgcolor: "transparent", font: "inherit", color: "inherit", textAlign: "left", cursor: "pointer", "&:focus-visible": { outline: "2px solid", outlineColor: "primary.main", outlineOffset: 4, borderRadius: 1 } }}
        >
          {summary}
        </Box>
      ) : (
        summary
      )}
      {t.description && details && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1.25, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
          {t.description}
        </Typography>
      )}
      {status === "Cancelled" && t.cancelReason && details && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1.25, overflowWrap: "anywhere" }}>
          <strong>{tr("Reason:")}</strong> {t.cancelReason}
        </Typography>
      )}
      {details && status !== "Cancelled" && (
        <Box sx={{ mt: 2, px: 0.5 }}>
          <StepTrack steps={[tr("Reported"), tr("In progress"), tr("Resolved")]} current={stepIndex} complete={stepIndex === 2} />
        </Box>
      )}
      {t.photoUrl && details && (
        <Box component="a" href={t.photoUrl} target="_blank" rel="noopener noreferrer" sx={{ display: "inline-block", mt: 1.25 }}>
          <Box component="img" src={t.photoUrl} alt={tr("Photo of the issue")} loading="lazy" sx={{ width: 96, height: 96, objectFit: "cover", borderRadius: 2, border: "1px solid", borderColor: "divider", display: "block" }} />
        </Box>
      )}
      {hasNote && (compact || details) && (
        <Box sx={{ mt: 1.5, p: 1.25, borderRadius: 2, bgcolor: (th) => alpha(th.palette.info.main, 0.08) }}>
          <Typography variant="caption" sx={{ fontWeight: 800, color: "info.dark" }}>
            {tr("Note from your landlord")}
          </Typography>
          <Typography variant="body2" sx={{ overflowWrap: "anywhere", whiteSpace: "pre-wrap" }}>
            {t.remarks || t.resolutionNotes}
          </Typography>
        </Box>
      )}
      {details && updates > 0 && (
        <Box sx={{ mt: 1.5 }}>
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 800 }}>
            {tr("YOUR UPDATES")}
          </Typography>
          {t.followUps.map((f, i) => (
            <Box key={i} sx={{ mt: 0.75, p: 1.25, borderRadius: 2, border: "1px solid", borderColor: "divider" }}>
              {f.text && (
                <Typography variant="body2" sx={{ overflowWrap: "anywhere", whiteSpace: "pre-wrap" }}>
                  {f.text}
                </Typography>
              )}
              {f.photoUrl && (
                <Box component="a" href={f.photoUrl} target="_blank" rel="noopener noreferrer" sx={{ display: "inline-block", mt: 0.5 }}>
                  <Box component="img" src={f.photoUrl} alt={tr("Photo you added")} loading="lazy" sx={{ width: 72, height: 72, objectFit: "cover", borderRadius: 2, display: "block" }} />
                </Box>
              )}
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.25 }}>
                {fmtDate(f.at, { month: "short", day: "numeric" })}
              </Typography>
            </Box>
          ))}
        </Box>
      )}
      {details && onAction && !["Resolved", "Cancelled"].includes(status) && (
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75, mt: 1.5 }}>
          <Button size="small" variant="outlined" startIcon={<AddIcon />} onClick={() => onAction("update", t)} sx={{ minHeight: 40, fontWeight: 700, borderRadius: 2, textTransform: "none" }}>
            {tr("Add an update")}
          </Button>
          {status === "Pending" && (
            <>
              <Button size="small" startIcon={<EditOutlinedIcon />} onClick={() => onAction("edit", t)} sx={{ minHeight: 40, fontWeight: 700, textTransform: "none" }}>
                {tr("Edit")}
              </Button>
              <Button size="small" color="error" startIcon={<DeleteOutlinedIcon />} onClick={() => onAction("cancel", t)} sx={{ minHeight: 40, fontWeight: 700, textTransform: "none" }}>
                {tr("Cancel request")}
              </Button>
            </>
          )}
        </Box>
      )}
    </Paper>
  );
}

// "Show N more" under a long list (adds a page at a time instead of everything at once)
export function ShowMore({ shown, total, step, onMore, onLess, noun = "more" }) {
  if (total <= step && shown >= total) return null;
  const left = total - shown;
  return (
    <Box sx={{ ...row, justifyContent: "center", gap: 0.5, mt: 1 }}>
      {left > 0 && (
        <Button size="small" onClick={onMore} endIcon={<ExpandMoreIcon />} sx={{ fontWeight: 700, borderRadius: 99, minHeight: 36, py: 0.5, px: 1.5, textTransform: "none" }}>
          {tr("Show")}{" "}{Math.min(step, left)} {noun}
        </Button>
      )}
      {shown > step && (
        <Button size="small" color="inherit" onClick={onLess} sx={{ fontWeight: 700, minHeight: 36, py: 0.5, px: 1.5, borderRadius: 99, textTransform: "none", color: "text.secondary" }}>
          {tr("Show less")}
        </Button>
      )}
    </Box>
  );
}

// Tap-to-filter pills with counts (scroll sideways on phones)
export function FilterPills({ options, value, onChange }) {
  return (
    <Box sx={{ display: "flex", gap: 0.75, overflowX: "auto", mx: { xs: -2, sm: 0 }, px: { xs: 2, sm: 0 }, mb: 2, scrollbarWidth: "none", "&::-webkit-scrollbar": { display: "none" } }}>
      {options.map((o) => {
        const on = value === o.id;
        return (
          <Box
            key={o.id}
            component="button"
            type="button"
            onClick={() => onChange(o.id)}
            aria-pressed={on}
            sx={{
              ...row,
              gap: 0.75,
              flexShrink: 0,
              height: 38,
              px: 1.5,
              borderRadius: 99,
              font: "inherit",
              fontSize: 13.5,
              fontWeight: 700,
              cursor: "pointer",
              border: "1px solid",
              borderColor: on ? "text.primary" : "divider",
              bgcolor: on ? "text.primary" : "background.default",
              color: on ? "background.default" : "text.secondary",
            }}
          >
            {o.label}
            <Box component="span" sx={{ opacity: 0.65, fontWeight: 600 }}>{o.count}</Box>
          </Box>
        );
      })}
    </Box>
  );
}

// One year of payments: a header with the year's total that opens to its rows
export function PaymentYear({ year, list, defaultOpen, onPick }) {
  const [open, setOpen] = useState(defaultOpen);
  const [shown, setShown] = useState(PAGE_SIZE);
  const paid = list.filter((p) => ["paid", "partial"].includes(String(p.status || "").toLowerCase())).reduce((s, p) => s + (Number(p.amount) || 0), 0);
  return (
    <Box sx={{ border: "1px solid", borderColor: "divider", borderRadius: 3, overflow: "hidden" }}>
      <Box
        component="button"
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        sx={{ ...row, width: "100%", gap: 1.25, px: 1.75, py: 1.25, border: 0, font: "inherit", color: "inherit", textAlign: "left", cursor: "pointer", bgcolor: (t) => alpha(t.palette.background.paper, open ? 0.45 : 0.25) }}
      >
        <Typography sx={{ fontFamily: '"Inter", sans-serif', fontWeight: 800, flex: 1 }}>{year}</Typography>
        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
          {list.length} {list.length === 1 ? "payment" : "payments"}
          {paid > 0 ? ` · ${peso(paid)} paid` : ""}
        </Typography>
        <ExpandMoreIcon sx={{ color: "text.secondary", transform: open ? "rotate(180deg)" : "none", transition: "transform .2s" }} />
      </Box>
      {open && (
        <Box sx={{ p: 1.25, display: "flex", flexDirection: "column", gap: 1 }}>
          {list.slice(0, shown).map((p) => (
            <PaymentRow key={p.id} p={p} onClick={() => onPick(p)} />
          ))}
          <ShowMore shown={Math.min(shown, list.length)} total={list.length} step={PAGE_SIZE} onMore={() => setShown((n) => n + PAGE_SIZE)} onLess={() => setShown(PAGE_SIZE)} />
        </Box>
      )}
    </Box>
  );
}

export function AnnouncementItem({ n, onRead }) {
  const tone = NOTE_TONE[n.type] || "info";
  const [open, setOpen] = useState(false);
  const long = String(n.message || "").length > 110 || String(n.message || "").split("\n").length > 3;
  return (
    <Box
      component="button"
      type="button"
      onClick={() => {
        setOpen((v) => !v);
        if (n.isRead === false && onRead) onRead([n]);
      }}
      aria-expanded={open}
      sx={{
        display: "block",
        width: "100%",
        textAlign: "left",
        font: "inherit",
        color: "inherit",
        cursor: "pointer",
        p: 1.5,
        borderRadius: 2.5,
        border: "1px solid",
        borderColor: "divider",
        borderLeft: "4px solid",
        borderLeftColor: (t) => t.palette[tone].main,
        bgcolor: (t) => alpha(t.palette.background.paper, 0.35),
      }}
    >
      <Box sx={{ ...row, justifyContent: "space-between", gap: 1 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 800, overflowWrap: "anywhere" }}>
          {n.isRead === false && <Box component="span" sx={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", bgcolor: "primary.main", mr: 0.75, verticalAlign: "middle" }} />}
          {n.title}
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>
          {fmtDate(n.createdAt, { month: "short", day: "numeric" })}
        </Typography>
      </Box>
      <Typography
        variant="body2"
        color="text.secondary"
        sx={{
          mt: 0.25,
          overflowWrap: "anywhere",
          whiteSpace: "pre-wrap",
          ...(open ? {} : { display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }),
        }}
      >
        {n.message}
      </Typography>
      {long && (
        <Typography variant="caption" sx={{ color: "primary.main", fontWeight: 800, mt: 0.5, display: "block" }}>
          {open ? tr("Show less") : tr("Read more")}
        </Typography>
      )}
    </Box>
  );
}

/* ---------------------------------------------------------------------------
   Phone helpers
--------------------------------------------------------------------------- */
// Changes identity only when the calendar day changes, so a tab that stays open
// for days (common on phones) rolls over to the new month by itself.
export function useToday() {
  const [dayKey, setDayKey] = useState(() => new Date().toDateString());
  useEffect(() => {
    let timer;
    const refresh = () => setDayKey(new Date().toDateString());
    const schedule = () => {
      const now = new Date();
      const next = new Date(now);
      next.setHours(24, 0, 5, 0);
      timer = setTimeout(() => {
        refresh();
        schedule();
      }, next - now);
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    schedule();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => new Date(), [dayKey]);
}

// Things written while offline wait here (on this phone) and are sent once the connection is back
export const outboxKey = (uid) => `kk_outbox_${uid}`;
export const readOutbox = (uid) => {
  try {
    const list = JSON.parse(window.localStorage.getItem(outboxKey(uid)) || "[]");
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
};
export const writeOutbox = (uid, list) => {
  try {
    window.localStorage.setItem(outboxKey(uid), JSON.stringify(list));
  } catch {
    /* storage unavailable: the item just isn't kept */
  }
};

export function useOnline() {
  const [online, setOnline] = useState(typeof navigator === "undefined" ? true : navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);
  return online;
}

export const MAX_PHOTO_MB = 8;

// Camera / gallery picker with a thumbnail. Validation errors go to onError.
export function PhotoPicker({ file, onChange, onError, label = "Add a photo", hint, disabled }) {
  const inputRef = useRef(null);
  const previewRef = useRef(null);

  // The thumbnail's object URL is set on the <img> directly and freed when the photo changes
  useEffect(() => {
    if (!file || !previewRef.current) return undefined;
    const url = URL.createObjectURL(file);
    previewRef.current.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const handlePick = (e) => {
    const picked = e.target.files?.[0];
    e.target.value = ""; // allow picking the same photo again
    if (!picked) return;
    if (!picked.type.startsWith("image/")) {
      onError?.("Please choose a photo (JPG or PNG).");
      return;
    }
    if (picked.size > MAX_PHOTO_MB * 1024 * 1024) {
      onError?.(`That photo is too large. The limit is ${MAX_PHOTO_MB} MB.`);
      return;
    }
    onError?.("");
    onChange(picked);
  };

  return (
    <Box>
      <input ref={inputRef} type="file" accept="image/*" hidden onChange={handlePick} />
      {file ? (
        <Box sx={{ ...row, gap: 1.5, p: 1, borderRadius: 2.5, border: "1px solid", borderColor: "divider", bgcolor: "background.paper" }}>
          <Box component="img" ref={previewRef} alt={tr("Selected photo")} sx={{ width: 64, height: 64, borderRadius: 2, objectFit: "cover", flexShrink: 0 }} />
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography variant="body2" noWrap sx={{ fontWeight: 700 }}>
              {file.name}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {(file.size / 1024 / 1024).toFixed(1)} MB
            </Typography>
          </Box>
          <IconButton aria-label={tr("Remove photo")} onClick={() => onChange(null)} disabled={disabled}>
            <CloseIcon />
          </IconButton>
        </Box>
      ) : (
        <Button
          fullWidth
          variant="outlined"
          startIcon={<PhotoCameraOutlinedIcon />}
          onClick={() => inputRef.current?.click()}
          disabled={disabled}
          sx={{ minHeight: 52, borderStyle: "dashed", borderRadius: 2.5, fontWeight: 700, textTransform: "none", justifyContent: "flex-start", px: 2 }}
        >
          <Box sx={{ textAlign: "left" }}>
            <Box component="span" sx={{ display: "block" }}>
              {label}
            </Box>
            {hint && (
              <Typography component="span" variant="caption" color="text.secondary" sx={{ display: "block", fontWeight: 500 }}>
                {hint}
              </Typography>
            )}
          </Box>
        </Button>
      )}
    </Box>
  );
}

// Big thumb-sized shortcut used on the overview
export function QuickAction({ icon, label, onClick, href, disabled, badge }) {
  return (
    <Box
      component={href ? "a" : "button"}
      type={href ? undefined : "button"}
      href={href}
      onClick={onClick}
      disabled={href ? undefined : disabled}
      aria-disabled={disabled || undefined}
      sx={{
        ...cardSx,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 0.75,
        minHeight: 84,
        px: 0.5,
        py: 1.25,
        font: "inherit",
        color: disabled ? "text.disabled" : "text.primary",
        textDecoration: "none",
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.55 : 1,
        pointerEvents: disabled && href ? "none" : undefined,
        position: "relative",
        "&:active": disabled ? undefined : { transform: "scale(0.97)" },
        "&:focus-visible": { outline: "2px solid", outlineColor: "primary.main", outlineOffset: 2 },
      }}
    >
      <Box sx={{ width: 38, height: 38, borderRadius: "50%", ...row, justifyContent: "center", bgcolor: "rgba(255, 69, 0, 0.1)", color: "primary.main" }}>{icon}</Box>
      <Typography variant="caption" sx={{ fontWeight: 700, lineHeight: 1.15, textAlign: "center" }}>
        {label}
      </Typography>
      {badge > 0 && (
        <Box sx={{ position: "absolute", top: 6, right: 10, minWidth: 18, height: 18, px: 0.5, borderRadius: 9, bgcolor: "primary.main", color: "#fff", fontSize: 11, fontWeight: 800, ...row, justifyContent: "center" }}>
          {badge > 9 ? "9+" : badge}
        </Box>
      )}
    </Box>
  );
}

// "Needs your attention" row
export function AttentionBanner({ tone = "warning", icon, title, body, actionLabel, onAction, secondaryLabel, onSecondary }) {
  const Icon = icon || (tone === "error" ? ErrorOutlinedIcon : tone === "info" ? InfoOutlinedIcon : WarningAmberOutlinedIcon);
  return (
    <Box
      sx={{
        ...row,
        alignItems: "flex-start",
        gap: 1.25,
        p: 1.5,
        borderRadius: 3,
        border: "1px solid",
        borderColor: (t) => alpha(t.palette[tone].main, 0.45),
        bgcolor: (t) => alpha(t.palette[tone].main, 0.07),
      }}
    >
      <Box sx={{ color: `${tone}.main`, display: "flex", pt: 0.25 }}>
        <Icon />
      </Box>
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography sx={{ fontWeight: 800, lineHeight: 1.25 }}>{title}</Typography>
        {body && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25, overflowWrap: "anywhere" }}>
            {body}
          </Typography>
        )}
        {(actionLabel || secondaryLabel) && (
          <Box sx={{ display: "flex", gap: 1, mt: 1, flexWrap: "wrap" }}>
            {actionLabel && (
              <Button size="small" variant="contained" color={tone} onClick={onAction} sx={{ fontWeight: 700, borderRadius: 2, minHeight: 38, textTransform: "none" }}>
                {actionLabel}
              </Button>
            )}
            {secondaryLabel && (
              <Button size="small" onClick={onSecondary} sx={{ fontWeight: 700, borderRadius: 2, minHeight: 38, textTransform: "none", color: "text.secondary" }}>
                {secondaryLabel}
              </Button>
            )}
          </Box>
        )}
      </Box>
    </Box>
  );
}

// If one tab throws, the rest of the app keeps working
export class TabErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error) {
    console.error("Tenant dashboard error:", error);
  }
  componentDidUpdate(prev) {
    if (this.state.hasError && prev.resetKey !== this.props.resetKey) this.setState({ hasError: false });
  }
  render() {
    if (this.state.hasError) {
      return (
        <Paper elevation={0} sx={cardSx}>
          <EmptyState
            icon={<ErrorOutlinedIcon sx={{ fontSize: 28, color: "primary.main" }} />}
            title={tr("Something went wrong")}
            body={tr("This section couldn't be shown. Your information is safe.")}
            action={
              <Button variant="contained" startIcon={<RefreshOutlinedIcon />} onClick={() => window.location.reload()} sx={{ mt: 2, fontWeight: 700, borderRadius: 2.5, minHeight: 46 }}>
                {tr("Reload")}
              </Button>
            }
          />
        </Paper>
      );
    }
    return this.props.children;
  }
}

// Save the owner's QR image to the phone (a phone can't scan its own screen).
// Resolves false when the browser won't let us, so the caller can explain what to do instead.
export async function saveImage(url, filename) {
  try {
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) return false;
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = objectUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(objectUrl), 4000);
    return true;
  } catch {
    return false;
  }
}

/* ---------------------------------------------------------------------------
   Curfew + messaging
--------------------------------------------------------------------------- */
// "10:00 PM" -> minutes after midnight (null if it can't be read)
export function parseClock(label) {
  const m = String(label || "").trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (!m) return null;
  let h = Number(m[1]);
  const min = Number(m[2]);
  const ap = (m[3] || "").toUpperCase();
  if (ap === "PM" && h < 12) h += 12;
  if (ap === "AM" && h === 12) h = 0;
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

// Ticks every 30s while enabled (used for the curfew countdown)
export function useClock(enabled) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    if (!enabled) return undefined;
    const tick = () => setNow(new Date());
    const id = setInterval(tick, 30000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [enabled]);
  return now;
}

/* ---------------------------------------------------------------------------
   Page
--------------------------------------------------------------------------- */
