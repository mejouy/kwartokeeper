// src/pages/tenant/TenantDashboard.jsx
//
// One file for the whole tenant area, designed phone-first. TenantLayout decides
// which tab is open and passes it in as `activeTab` ("overview" | "payments" |
// "profile" | "maintenance").

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Fab,
  GlobalStyles,
  IconButton,
  LinearProgress,
  Paper,
  Skeleton,
  Snackbar,
  TextField,
  Typography,
  useMediaQuery,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import ReceiptLongOutlinedIcon from "@mui/icons-material/ReceiptLongOutlined";
import CalendarMonthOutlinedIcon from "@mui/icons-material/CalendarMonthOutlined";
import AddIcon from "@mui/icons-material/Add";
import CloseIcon from "@mui/icons-material/Close";
import PaymentIcon from "@mui/icons-material/Payment";
import QrCode2Icon from "@mui/icons-material/QrCode2";
import HistoryIcon from "@mui/icons-material/History";
import BuildOutlinedIcon from "@mui/icons-material/BuildOutlined";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import CheckIcon from "@mui/icons-material/Check";
import CheckCircleOutlinedIcon from "@mui/icons-material/CheckCircleOutlined";
import HomeWorkOutlinedIcon from "@mui/icons-material/HomeWorkOutlined";
import CampaignOutlinedIcon from "@mui/icons-material/CampaignOutlined";
import PhoneOutlinedIcon from "@mui/icons-material/PhoneOutlined";
import ShieldOutlinedIcon from "@mui/icons-material/ShieldOutlined";
import BoltOutlinedIcon from "@mui/icons-material/BoltOutlined";
import BrushOutlinedIcon from "@mui/icons-material/BrushOutlined";
import DownloadOutlinedIcon from "@mui/icons-material/DownloadOutlined";
import IosShareOutlinedIcon from "@mui/icons-material/IosShareOutlined";
import WifiOffOutlinedIcon from "@mui/icons-material/WifiOffOutlined";
import PhotoCameraOutlinedIcon from "@mui/icons-material/PhotoCameraOutlined";
import WarningAmberOutlinedIcon from "@mui/icons-material/WarningAmberOutlined";
import ErrorOutlinedIcon from "@mui/icons-material/ErrorOutlined";
import RefreshOutlinedIcon from "@mui/icons-material/RefreshOutlined";
import ScheduleIcon from "@mui/icons-material/Schedule";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import FilePreviewDialog from "../../components/FilePreviewDialog";
import PolicyOutlinedIcon from "@mui/icons-material/PolicyOutlined";
import PlaceOutlinedIcon from "@mui/icons-material/PlaceOutlined";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import DeleteOutlinedIcon from "@mui/icons-material/DeleteOutlined";
import DoneAllIcon from "@mui/icons-material/DoneAll";
import CloudOffOutlinedIcon from "@mui/icons-material/CloudOffOutlined";

import { useNavigate } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, collection, addDoc, updateDoc, arrayUnion, query, where, onSnapshot, serverTimestamp } from "firebase/firestore";

import { auth, db } from "../../config/firebase";
import { normalizePayment } from "../../utils/normalizePayment";
import { printReceipt as printReceiptDoc } from "../../utils/receiptPrint";
import { addMonthsClamped } from "../../utils/addMonthsClamped";
import { uploadToCloudinary } from "../../utils/cloudinary";
import { getPropertyCoverPhotoUrl } from "../../utils/getPropertyCoverPhotoUrl";
import { CATEGORIES, rankMaintenanceRequests } from "../../utils/maintenancePrioritization";

/* ---------------------------------------------------------------------------
   Constants
--------------------------------------------------------------------------- */
const RULES_PREVIEW = 4; // rules shown before "Show all"
const BOTTOM_NAV_H = 64;
const row = { display: "flex", alignItems: "center" };
const cardSx = { bgcolor: "background.default", border: "1px solid", borderColor: "divider", borderRadius: 3 };

const CATEGORY_OPTIONS = [
  { value: CATEGORIES.SAFETY, label: "Safety", hint: "e.g. exposed wiring, broken lock", Icon: ShieldOutlinedIcon },
  { value: CATEGORIES.UTILITY, label: "Utility", hint: "e.g. clogged drain, appliance issue", Icon: BoltOutlinedIcon },
  { value: CATEGORIES.ROUTINE, label: "Routine", hint: "e.g. paint chip, cosmetic issue", Icon: BrushOutlinedIcon },
];

const TIER_TONE = { High: "error", Medium: "warning", Low: "default" };
const NOTE_TONE = { info: "info", warning: "warning", success: "success", error: "error" };

/*
|--------------------------------------------------------------------------
| PAYMENT ACCOUNTS
|--------------------------------------------------------------------------
| The owner sets these up in Payments → Payment accounts. They are stored on
| the property (properties/{id}.paymentMethods and .paymentNote) and read here.
|--------------------------------------------------------------------------
*/
const PAY_METHOD_DEFS = [
  { key: "GCash", label: "GCash", kind: "wallet" },
  { key: "Maya", label: "Maya", kind: "wallet" },
  { key: "QR Ph", label: "QR Ph", kind: "qrph" },
];

// Only methods the owner switched on AND gave something to pay to
const readPayMethods = (raw) =>
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

const prettyMobile = (n) => (/^09\d{9}$/.test(String(n)) ? `${n.slice(0, 4)} ${n.slice(4, 7)} ${n.slice(7)}` : n);

/* ---------------------------------------------------------------------------
   Helpers
--------------------------------------------------------------------------- */
const peso = (n) => `₱${Number(n || 0).toLocaleString()}`;

function getTodayInputValue() {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

function getTimestampMillis(value) {
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

const fmtDate = (value, opts = { month: "short", day: "numeric", year: "numeric" }) => {
  const ms = getTimestampMillis(value);
  return ms ? new Date(ms).toLocaleDateString("en-US", opts) : "";
};

const formatLeaseStart = (value) => {
  if (!value || value === "Not specified") return "Not specified";
  return fmtDate(value) || String(value);
};

const LEASE_MONTHS = { "3_months": 3, "6_months": 6, "12_months": 12 };

function formatLeaseDuration(val) {
  if (!val) return "Not specified";
  switch (val) {
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

function paymentTone(status) {
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

const firstName = (name) => String(name || "").trim().split(/\s+/)[0] || "there";
const initials = (name) =>
  String(name || "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("") || "T";

const greeting = () => {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
};

/* ---------------------------------------------------------------------------
   Visuals
--------------------------------------------------------------------------- */
// Fade/slide-up on first paint; off for "reduce motion" users.
const AnimationStyles = (
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
const rise = (i = 0) => ({ animation: `kkFadeUp .45s ease-out ${i * 70}ms both` });

// Dorm-facade windows from the login page. Here: lit = share of the lease that has passed.
const WINDOW_COUNT = 30;
const LIGHT_ORDER = [3, 17, 8, 24, 1, 12, 27, 5, 20, 14, 9, 29, 2, 22, 11, 6, 25, 16, 0, 19, 28, 7, 13, 23, 4, 21, 10, 26, 15, 18];
const WINDOW_RANK = LIGHT_ORDER.reduce((acc, cell, rank) => ({ ...acc, [cell]: rank }), {});

function LeaseWindows({ progress, caption }) {
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
function StepTrack({ steps, current = 0, complete = false, failed = false }) {
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
              <Typography variant="caption" sx={{ mt: 0.5, fontWeight: st === "active" || st === "error" ? 800 : 600, color: st === "todo" ? "text.disabled" : "text.primary", textAlign: "center", lineHeight: 1.2 }}>
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
function Pill({ label, tone = "default", icon, sx }) {
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

function Panel({ title, icon, action, children, sx }) {
  return (
    <Paper elevation={0} sx={{ ...cardSx, p: { xs: 2, sm: 3 }, ...sx }}>
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

function EmptyState({ icon, title, body, action }) {
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

function Facts({ items }) {
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

function PaymentRow({ p, onClick }) {
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
          {p.periodMonth || "Payment"}
        </Typography>
        <Typography variant="caption" color="text.secondary" noWrap component="div">
          {p.paymentMethod || "Unknown method"}
          {date ? ` · ${date}` : ""}
        </Typography>
      </Box>
      <Box sx={{ textAlign: "right", flexShrink: 0 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
          {peso(p.amount)}
        </Typography>
        <Pill label={status} tone={paymentTone(status)} />
      </Box>
    </Box>
  );
}

function TicketCard({ t, compact, onAction }) {
  const tier = t.priority?.tier || "Low";
  const status = t.status || "Pending";
  const statusTone = status === "Resolved" ? "success" : status === "In Progress" ? "info" : status === "Cancelled" ? "default" : "warning";
  const date = fmtDate(t.createdAt);
  const stepIndex = status === "Resolved" ? 2 : status === "In Progress" ? 1 : 0;

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
      <Box sx={{ ...row, alignItems: "flex-start", justifyContent: "space-between", gap: 1 }}>
        <Typography sx={{ fontWeight: 800, overflowWrap: "anywhere" }}>{t.title}</Typography>
        <Pill label={status} tone={statusTone} sx={{ flexShrink: 0 }} />
      </Box>
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75, mt: 1 }}>
        <Pill label={`${tier} priority`} tone={TIER_TONE[tier]} />
        {t.category && <Pill label={String(t.category)} />}
        {date && <Pill label={`Reported ${date}`} />}
      </Box>
      {t.description && !compact && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1.25, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
          {t.description}
        </Typography>
      )}
      {status === "Cancelled" && t.cancelReason && !compact && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1.25, overflowWrap: "anywhere" }}>
          <strong>Reason:</strong> {t.cancelReason}
        </Typography>
      )}
      {!compact && status !== "Cancelled" && (
        <Box sx={{ mt: 2, px: 0.5 }}>
          <StepTrack steps={["Reported", "In progress", "Resolved"]} current={stepIndex} complete={stepIndex === 2} />
        </Box>
      )}
      {t.photoUrl && !compact && (
        <Box component="a" href={t.photoUrl} target="_blank" rel="noopener noreferrer" sx={{ display: "inline-block", mt: 1.25 }}>
          <Box component="img" src={t.photoUrl} alt="Photo of the issue" loading="lazy" sx={{ width: 96, height: 96, objectFit: "cover", borderRadius: 2, border: "1px solid", borderColor: "divider", display: "block" }} />
        </Box>
      )}
      {(t.remarks || t.resolutionNotes) && (
        <Box sx={{ mt: 1.5, p: 1.25, borderRadius: 2, bgcolor: (th) => alpha(th.palette.info.main, 0.08) }}>
          <Typography variant="caption" sx={{ fontWeight: 800, color: "info.dark" }}>
            Note from your landlord
          </Typography>
          <Typography variant="body2" sx={{ overflowWrap: "anywhere", whiteSpace: "pre-wrap" }}>
            {t.remarks || t.resolutionNotes}
          </Typography>
        </Box>
      )}
      {!compact && Array.isArray(t.followUps) && t.followUps.length > 0 && (
        <Box sx={{ mt: 1.5 }}>
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 800 }}>
            YOUR UPDATES
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
                  <Box component="img" src={f.photoUrl} alt="Photo you added" loading="lazy" sx={{ width: 72, height: 72, objectFit: "cover", borderRadius: 2, display: "block" }} />
                </Box>
              )}
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.25 }}>
                {fmtDate(f.at, { month: "short", day: "numeric" })}
              </Typography>
            </Box>
          ))}
        </Box>
      )}
      {!compact && onAction && !["Resolved", "Cancelled"].includes(status) && (
        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75, mt: 1.5 }}>
          <Button size="small" variant="outlined" startIcon={<AddIcon />} onClick={() => onAction("update", t)} sx={{ minHeight: 40, fontWeight: 700, borderRadius: 2, textTransform: "none" }}>
            Add an update
          </Button>
          {status === "Pending" && (
            <>
              <Button size="small" startIcon={<EditOutlinedIcon />} onClick={() => onAction("edit", t)} sx={{ minHeight: 40, fontWeight: 700, textTransform: "none" }}>
                Edit
              </Button>
              <Button size="small" color="error" startIcon={<DeleteOutlinedIcon />} onClick={() => onAction("cancel", t)} sx={{ minHeight: 40, fontWeight: 700, textTransform: "none" }}>
                Cancel request
              </Button>
            </>
          )}
        </Box>
      )}
    </Paper>
  );
}

function AnnouncementItem({ n, onRead }) {
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
          {open ? "Show less" : "Read more"}
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
function useToday() {
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
const outboxKey = (uid) => `kk_outbox_${uid}`;
const readOutbox = (uid) => {
  try {
    const list = JSON.parse(window.localStorage.getItem(outboxKey(uid)) || "[]");
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
};
const writeOutbox = (uid, list) => {
  try {
    window.localStorage.setItem(outboxKey(uid), JSON.stringify(list));
  } catch {
    /* storage unavailable: the item just isn't kept */
  }
};

function useOnline() {
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

const MAX_PHOTO_MB = 8;

// Camera / gallery picker with a thumbnail. Validation errors go to onError.
function PhotoPicker({ file, onChange, onError, label = "Add a photo", hint, disabled }) {
  const inputRef = useRef(null);
  const [preview, setPreview] = useState("");

  useEffect(() => {
    if (!file) {
      setPreview("");
      return undefined;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
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
          <Box component="img" src={preview} alt="Selected photo" sx={{ width: 64, height: 64, borderRadius: 2, objectFit: "cover", flexShrink: 0 }} />
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography variant="body2" noWrap sx={{ fontWeight: 700 }}>
              {file.name}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {(file.size / 1024 / 1024).toFixed(1)} MB
            </Typography>
          </Box>
          <IconButton aria-label="Remove photo" onClick={() => onChange(null)} disabled={disabled}>
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
function QuickAction({ icon, label, onClick, href, disabled, badge }) {
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
function AttentionBanner({ tone = "warning", icon, title, body, actionLabel, onAction, secondaryLabel, onSecondary }) {
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
class TabErrorBoundary extends React.Component {
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
            title="Something went wrong"
            body="This section couldn't be shown. Your information is safe."
            action={
              <Button variant="contained" startIcon={<RefreshOutlinedIcon />} onClick={() => window.location.reload()} sx={{ mt: 2, fontWeight: 700, borderRadius: 2.5, minHeight: 46 }}>
                Reload
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
async function saveImage(url, filename) {
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
function parseClock(label) {
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
function useClock(enabled) {
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
export default function TenantDashboard({ activeTab = "overview", onNavigateTab }) {
  const navigate = useNavigate();
  const theme = useTheme();
  const isPhone = useMediaQuery(theme.breakpoints.down("sm"));

  const goTab = (id) => {
    if (onNavigateTab) onNavigateTab(id);
    else navigate({ hash: id === "overview" ? "" : `#${id}` });
  };

  const [loading, setLoading] = useState(true);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [previewFile, setPreviewFile] = useState(null);
  const [toast, setToast] = useState({ open: false, message: "", severity: "success" });
  const notify = (message, severity = "success") => setToast({ open: true, message, severity });
  const online = useOnline();
  const today = useToday();
  const [loadError, setLoadError] = useState("");
  const [listenError, setListenError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  // ---- tenant info
  const [tenantInfo, setTenantInfo] = useState({
    name: "Tenant",
    propertyName: "Not Assigned",
    roomNumber: "N/A",
    bedId: "N/A",
    monthlyRent: 0,
    status: "Active",
    leaseStartDate: "Not specified",
    leaseEndDate: "",
    leaseMonths: null,
    leaseDuration: "Not specified",
    contact: "None provided",
    ownerUid: "",
    propertyId: "",
    propertyAddress: "",
    coverPhotoUrl: "",
    curfewTime: "",
    rules: [],
    ruleFiles: [],
    amenities: [],
    emergencyPhone: "",
    rentDueDay: 5,
  });
  const [announcements, setAnnouncements] = useState([]);
  const [curfewRecords, setCurfewRecords] = useState([]);
  const [outbox, setOutbox] = useState([]);
  const flushing = useRef(false);
  const [ticketDlg, setTicketDlg] = useState({ mode: "", ticket: null, title: "", description: "", text: "", photo: null, photoError: "", busy: false, error: "" });

  // ---- maintenance
  const [tickets, setTickets] = useState([]);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [openRepairModal, setOpenRepairModal] = useState(false);
  const [repairSubmitting, setRepairSubmitting] = useState(false);
  const [repairTouched, setRepairTouched] = useState(false);
  const [repairForm, setRepairForm] = useState({ title: "", description: "", category: CATEGORIES.SAFETY });
  const [repairPhoto, setRepairPhoto] = useState(null);
  const [repairPhotoError, setRepairPhotoError] = useState("");

  // ---- payments
  const [payments, setPayments] = useState([]);
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [proofFile, setProofFile] = useState(null);
  const [proofError, setProofError] = useState("");
  const [showAllAnnouncements, setShowAllAnnouncements] = useState(false);
  const [coverFailed, setCoverFailed] = useState(false);
  const [rulesAcked, setRulesAcked] = useState(true);
  const [openPaymentModal, setOpenPaymentModal] = useState(false);
  const [payStep, setPayStep] = useState(0); // 0 pay, 1 details, 2 done
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState("");
  const [paymentSubmitting, setPaymentSubmitting] = useState(false);
  const [paymentTouched, setPaymentTouched] = useState({});
  const [paymentForm, setPaymentForm] = useState({ amount: "", referenceNumber: "", paymentDate: getTodayInputValue(), remarks: "" });
  const [paymentError, setPaymentError] = useState("");
  const [submittedPayment, setSubmittedPayment] = useState(null);
  const [receipt, setReceipt] = useState(null);

  // ---- billing period / due date
  const currentPeriod = useMemo(() => today.toLocaleDateString("en-US", { month: "long", year: "numeric" }), [today]);

  const dueDate = useMemo(() => {
    const day = Math.min(Math.max(Number(tenantInfo.rentDueDay || 5), 1), 28);
    return new Date(today.getFullYear(), today.getMonth(), day);
  }, [tenantInfo.rentDueDay, today]);

  const dueDateLabel = dueDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

  const currentPeriodPayment = useMemo(() => {
    const periodPayments = payments.filter((p) => p.periodMonth === currentPeriod);
    const is = (p, ...names) => names.includes(String(p.status || "").toLowerCase());
    // Paid wins, then anything waiting for the owner, then the newest (e.g. a rejected one).
    return periodPayments.find((p) => is(p, "paid")) || periodPayments.find((p) => is(p, "pending", "pending verification")) || periodPayments[0] || null;
  }, [payments, currentPeriod]);

  const daysToDue = useMemo(() => {
    const midnight = new Date(today);
    midnight.setHours(0, 0, 0, 0);
    return Math.round((dueDate.getTime() - midnight.getTime()) / 86400000);
  }, [dueDate, today]);

  // Unpaid and past the due date reads as "Overdue"
  const rentStatus = currentPeriodPayment?.status || (daysToDue < 0 ? "Overdue" : "Unpaid");
  const statusKey = String(rentStatus).toLowerCase();
  const isPaid = statusKey === "paid";
  const isAwaitingVerification = ["pending", "pending verification"].includes(statusKey);
  const canPay = !isPaid && !isAwaitingVerification;
  const rentMissing = !(Number(tenantInfo.monthlyRent) > 0);

  const dueText = isPaid
    ? "Paid for this month"
    : isAwaitingVerification
      ? "Waiting for owner to verify"
      : daysToDue < 0
        ? `Overdue by ${Math.abs(daysToDue)} ${Math.abs(daysToDue) === 1 ? "day" : "days"}`
        : daysToDue === 0
          ? "Due today"
          : `Due in ${daysToDue} ${daysToDue === 1 ? "day" : "days"}`;

  // ---- lease progress
  const lease = useMemo(() => {
    const startMs = getTimestampMillis(tenantInfo.leaseStartDate);
    if (!startMs) return null;
    let endMs = getTimestampMillis(tenantInfo.leaseEndDate);
    if (!endMs && tenantInfo.leaseMonths) {
      endMs = addMonthsClamped(new Date(startMs), tenantInfo.leaseMonths)?.getTime() || 0;
    }
    const now = Date.now();
    if (!endMs || endMs <= startMs) {
      const monthsIn = Math.max(0, Math.floor((now - startMs) / (30.44 * 86400000)));
      return { open: true, monthsIn, startMs };
    }
    const progress = Math.min(1, Math.max(0, (now - startMs) / (endMs - startMs)));
    const daysLeft = Math.ceil((endMs - now) / 86400000);
    return { open: false, startMs, endMs, progress, daysLeft, ended: daysLeft < 0 };
  }, [tenantInfo.leaseStartDate, tenantInfo.leaseEndDate, tenantInfo.leaseMonths, today]);

  // ---- load tenant profile + realtime listeners
  // Waits for Firebase to restore the session (auth.currentUser is null for a
  // moment after a reload, which used to bounce people to the login page).
  useEffect(() => {
    let cancelled = false;
    let unsubs = [];

    setLoading(true);
    setLoadError("");
    setListenError(false);

    const loadProfile = async (user) => {
      try {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (cancelled) return;

        if (!userDoc.exists()) {
          setLoadError("We couldn't find your tenant profile. Please contact your landlord.");
          return;
        }

        const data = userDoc.data();
        const propertyId = data.propertyId || data.assignedPropertyId;

        let propertyName = "Not Assigned";
        let propertyAddress = "";
        let assignedRoom = null;
        let propExtras = {};

        if (propertyId) {
          try {
            const propDoc = await getDoc(doc(db, "properties", propertyId));
            if (propDoc.exists()) {
              const propData = propDoc.data();
              propertyName = propData.propertyName || propData.name || propData.title || "Facility Name Unavailable";

              // Address is stored as an object (street, barangay, ...); older records may use a string
              const addr = propData.address;
              propertyAddress =
                typeof addr === "string"
                  ? addr
                  : [addr?.street, addr?.barangay, addr?.cityMunicipality, addr?.province].filter(Boolean).join(", ") || propData.fullAddress || "";

              propExtras = {
                coverPhotoUrl: getPropertyCoverPhotoUrl({ id: propDoc.id, ...propData }) || propData.coverPhotoUrl || "",
                // New records: curfew { enabled, startTime }. Older wizard records: curfewEnabled / curfewTime.
                curfewTime: propData.curfew?.enabled ? propData.curfew.startTime || "" : propData.curfewEnabled ? propData.curfewTime || "" : "",
                rules: Array.isArray(propData.rules) ? propData.rules.filter(Boolean) : typeof propData.rules === "string" ? propData.rules.split("\n").map((r) => r.trim()).filter(Boolean) : [],
                ruleFiles: Array.isArray(propData.ruleFiles) ? propData.ruleFiles.filter((f) => f?.url) : [],
                amenities: Array.isArray(propData.amenities) ? propData.amenities.filter(Boolean) : [],
                emergencyPhone: propData.emergencyPhone || "",
                paymentMethods: readPayMethods(propData.paymentMethods),
                paymentNote: String(propData.paymentNote || ""),
              };

              // The tenant's room (users.roomId is the room's name/id, e.g. "A2")
              const rooms = Array.isArray(propData.rooms) ? propData.rooms : [];
              assignedRoom = rooms.find((room) => room.roomName === data.roomId || room.id === data.roomId) || null;
            }
          } catch (propErr) {
            console.error("Error fetching property doc:", propErr);
          }
        }

        if (cancelled) return;
        const ownerUid = data.ownerUid || data.landlordUid || data.invitedBy || "";

        setTenantInfo({
          name: data.name || data.fullName || "Tenant",
          propertyName,
          propertyAddress,
          coverPhotoUrl: "",
          curfewTime: "",
          rules: [],
          ruleFiles: [],
          amenities: [],
          emergencyPhone: "",
          paymentMethods: [],
          paymentNote: "",
          ...propExtras,
          roomNumber: assignedRoom?.roomName || data.roomNumber || data.roomId || "N/A",
          bedId: data.bedId || "N/A",
          // Preserve the tenant's agreed rent; use the room rate only for legacy records without one.
          monthlyRent: Number(data.monthlyRent ?? data.rentAmount ?? data.roomMonthlyRate ?? data.monthlyRate ?? data.rent ?? assignedRoom?.monthlyRatePerBed ?? 0) || 0,
          status: data.status || "Active",
          leaseStartDate: data.leaseStartDate || data.leaseStart || data.startDate || data.moveInDate || "Not specified",
          leaseEndDate: data.leaseEndDate || data.leaseEnd || data.endDate || data.moveOutDate || "",
          leaseMonths: LEASE_MONTHS[data.leaseDuration] || null,
          leaseDuration: formatLeaseDuration(data.leaseDuration),
          contact: data.phone || data.contact || "None provided",
          ownerUid,
          propertyId: propertyId || "",
          rentDueDay: Number(data.rentDueDay || data.dueDay || 5),
        });

        if (!cancelled) setLoading(false);
      } catch (err) {
        console.error("Error fetching tenant profile:", err);
        if (!cancelled) setLoadError("We couldn't load your account. Check your connection and try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      unsubs.forEach((u) => u());
      unsubs = [];

      if (!user) {
        navigate("/login", { replace: true });
        return;
      }

      loadProfile(user);

      const onListenError = (label) => (error) => {
        console.error(`Error listening to tenant ${label}:`, error);
        if (!cancelled) setListenError(true);
      };

      unsubs.push(
        onSnapshot(
          query(collection(db, "maintenance_tickets"), where("tenantUid", "==", user.uid)),
          (snapshot) => setTickets(snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))),
          onListenError("tickets")
        )
      );

      unsubs.push(
        onSnapshot(
          query(collection(db, "payments"), where("tenantId", "==", user.uid)),
          (snapshot) => {
            const docs = snapshot.docs.map((d) => {
              const raw = d.data();
              // keep the receipt fields even if normalizePayment doesn't know about them
              return { ...normalizePayment({ id: d.id, ...raw }), receiptNo: raw.receiptNo || "", receiptIssuer: raw.receiptIssuer || null };
            });
            docs.sort((a, b) => getTimestampMillis(b.paymentDate || b.createdAt) - getTimestampMillis(a.paymentDate || a.createdAt) || getTimestampMillis(b.createdAt) - getTimestampMillis(a.createdAt));
            setPayments(docs);
          },
          onListenError("payments")
        )
      );

      // Announcements arrive as notifications: the owner's broadcasts (announcementId) and caretaker notices (kind: "notice")
      unsubs.push(
        onSnapshot(
          query(collection(db, "notifications"), where("userId", "==", user.uid)),
          (snapshot) => {
            const docs = snapshot.docs
              .map((d) => ({ id: d.id, ...d.data() }))
              .filter((n) => n.announcementId || n.kind === "notice")
              .sort((a, b) => getTimestampMillis(b.createdAt) - getTimestampMillis(a.createdAt));
            setAnnouncements(docs);
          },
          onListenError("announcements")
        )
      );

      // The tenant's own curfew record (the caretaker writes one per tenant per night)
      unsubs.push(
        onSnapshot(
          query(collection(db, "curfew_records"), where("tenantId", "==", user.uid)),
          (snapshot) => {
            const docs = snapshot.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => String(b.date).localeCompare(String(a.date)));
            setCurfewRecords(docs);
          },
          (error) => console.warn("Curfew record unavailable:", error?.code || error)
        )
      );
    });

    return () => {
      cancelled = true;
      unsubscribeAuth();
      unsubs.forEach((u) => u());
    };
  }, [navigate, reloadKey]);

  // ---- saved-offline queue
  const flushOutbox = async () => {
    const user = auth.currentUser;
    if (!user || flushing.current) return;
    const items = readOutbox(user.uid);
    if (items.length === 0) {
      setOutbox([]);
      return;
    }
    flushing.current = true;
    let sent = 0;
    try {
      let remaining = items;
      for (const item of items) {
        try {
          await addDoc(collection(db, item.kind === "payment" ? "payments" : "maintenance_tickets"), { ...item.record, createdAt: serverTimestamp() });
          remaining = remaining.filter((x) => x.id !== item.id);
          writeOutbox(user.uid, remaining);
          sent += 1;
        } catch (err) {
          console.warn("Saved item not sent yet:", err?.code || err);
          break;
        }
      }
      setOutbox(readOutbox(user.uid));
      if (sent > 0) notify(sent === 1 ? "Your saved item was sent." : `${sent} saved items were sent.`);
    } finally {
      flushing.current = false;
    }
  };
  const queueOffline = (kind, record) => {
    const user = auth.currentUser;
    if (!user) return;
    const next = [...readOutbox(user.uid), { id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, kind, record }];
    writeOutbox(user.uid, next);
    setOutbox(next);
  };
  useEffect(() => {
    if (loading) return;
    const user = auth.currentUser;
    if (user) setOutbox(readOutbox(user.uid));
    if (online) flushOutbox();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online, loading]);

  // ---- announcements: mark as read
  const markRead = (list) => {
    list.filter((n) => n.isRead === false).forEach((n) => updateDoc(doc(db, "notifications", n.id), { isRead: true }).catch((err) => console.warn("Couldn't mark as read:", err?.code || err)));
  };

  // ---- repair requests: add an update, edit, cancel
  const openTicketDlg = (mode, t) => setTicketDlg({ mode, ticket: t, title: t.title || "", description: t.description || "", text: "", photo: null, photoError: "", busy: false, error: "" });
  const closeTicketDlg = () => {
    if (!ticketDlg.busy) setTicketDlg((d) => ({ ...d, mode: "" }));
  };
  const submitTicketDlg = async () => {
    const user = auth.currentUser;
    const t = ticketDlg.ticket;
    if (!user || !t || ticketDlg.busy) return;
    if (!online) {
      setTicketDlg((d) => ({ ...d, error: "You're offline. Connect to the internet and try again." }));
      return;
    }
    const live = tickets.find((x) => x.id === t.id);
    if (!live) {
      setTicketDlg((d) => ({ ...d, mode: "" }));
      return;
    }
    if (ticketDlg.mode !== "update" && (live.status || "Pending") !== "Pending") {
      setTicketDlg((d) => ({ ...d, error: "Work has already started on this request, so it can't be changed. Add an update instead." }));
      return;
    }
    if (ticketDlg.mode === "edit" && !ticketDlg.title.trim()) {
      setTicketDlg((d) => ({ ...d, error: "Give the request a title." }));
      return;
    }
    if (ticketDlg.mode === "update" && !ticketDlg.text.trim() && !ticketDlg.photo) {
      setTicketDlg((d) => ({ ...d, error: "Write a message or add a photo." }));
      return;
    }
    setTicketDlg((d) => ({ ...d, busy: true, error: "" }));
    try {
      const ref = doc(db, "maintenance_tickets", t.id);
      if (ticketDlg.mode === "cancel") {
        await updateDoc(ref, { status: "Cancelled", cancelledAt: serverTimestamp(), cancelledBy: "tenant", updatedAt: serverTimestamp() });
        notify("Request cancelled.");
      } else if (ticketDlg.mode === "edit") {
        await updateDoc(ref, { title: ticketDlg.title.trim(), description: ticketDlg.description.trim(), updatedAt: serverTimestamp() });
        notify("Request updated.");
      } else {
        let photoUrl = "";
        if (ticketDlg.photo) {
          try {
            photoUrl = await uploadToCloudinary(ticketDlg.photo);
          } catch (uploadErr) {
            console.error("Photo upload failed:", uploadErr);
            setTicketDlg((d) => ({ ...d, busy: false, photoError: "The photo couldn't be uploaded. Try again, or remove it to send without one." }));
            return;
          }
        }
        const entry = { text: ticketDlg.text.trim(), ...(photoUrl ? { photoUrl } : {}), at: new Date().toISOString(), by: "tenant" };
        await updateDoc(ref, { followUps: arrayUnion(entry), updatedAt: serverTimestamp() });
        if (t.ownerUid) {
          addDoc(collection(db, "notifications"), {
            userId: t.ownerUid,
            kind: "maintenance_update",
            category: "maintenance",
            type: "info",
            title: `Update on "${t.title || "a repair request"}"`,
            message: `${tenantInfo.name} (Room ${tenantInfo.roomNumber || "N/A"}) added an update.`,
            isRead: false,
            createdBy: user.uid,
            createdByRole: "tenant",
            createdAt: new Date().toISOString(),
          }).catch((err) => console.warn("Owner notice failed:", err?.code || err));
        }
        notify("Update sent.");
      }
      setTicketDlg((d) => ({ ...d, mode: "", busy: false }));
    } catch (err) {
      console.error("Couldn't change the request:", err);
      setTicketDlg((d) => ({ ...d, busy: false, error: "Couldn't do that right now. Please try again." }));
    }
  };

  // ---- maintenance submit
  const openRepair = () => {
    setRepairTouched(false);
    setRepairPhoto(null);
    setRepairPhotoError("");
    setOpenRepairModal(true);
  };

  const handleRequestSubmit = async () => {
    const user = auth.currentUser;
    setRepairTouched(true);
    if (!user || !repairForm.title.trim() || repairSubmitting) return;
    if (!online) {
      // Keep it on this phone and send it when the connection is back (photos can't be kept offline)
      queueOffline("repair", {
        tenantUid: user.uid,
        tenantName: tenantInfo.name,
        ownerUid: tenantInfo.ownerUid,
        propertyId: tenantInfo.propertyId,
        propertyName: tenantInfo.propertyName,
        roomNumber: tenantInfo.roomNumber,
        title: repairForm.title.trim(),
        description: repairForm.description.trim(),
        category: repairForm.category,
        status: "Pending",
      });
      setOpenRepairModal(false);
      setRepairForm({ title: "", description: "", category: CATEGORIES.SAFETY });
      setRepairPhoto(null);
      notify(repairPhoto ? "Saved on your phone. It sends when you're back online. Add the photo as an update afterwards." : "Saved on your phone. It sends when you're back online.", "info");
      return;
    }

    try {
      setRepairSubmitting(true);

      let photoUrl = "";
      if (repairPhoto) {
        try {
          photoUrl = await uploadToCloudinary(repairPhoto);
        } catch (uploadErr) {
          console.error("Photo upload failed:", uploadErr);
          setRepairPhotoError("The photo couldn't be uploaded. Try again, or remove it to send without a photo.");
          return;
        }
      }

      await addDoc(collection(db, "maintenance_tickets"), {
        tenantUid: user.uid,
        tenantName: tenantInfo.name,
        ownerUid: tenantInfo.ownerUid,
        propertyId: tenantInfo.propertyId,
        propertyName: tenantInfo.propertyName,
        roomNumber: tenantInfo.roomNumber,
        title: repairForm.title.trim(),
        description: repairForm.description.trim(),
        category: repairForm.category,
        ...(photoUrl ? { photoUrl } : {}),
        status: "Pending",
        createdAt: serverTimestamp(),
      });

      setOpenRepairModal(false);
      setRepairForm({ title: "", description: "", category: CATEGORIES.SAFETY });
      setRepairPhoto(null);
      notify("Request sent. Your landlord has been notified.");
    } catch (err) {
      console.error("Error submitting repair request:", err);
      notify("Couldn't send the request. Please try again.", "error");
    } finally {
      setRepairSubmitting(false);
    }
  };

  // ---- payment flow
  const openPayRentModal = () => {
    setPaymentError("");
    setPaymentTouched({});
    setSubmittedPayment(null);
    setProofFile(null);
    setProofError("");
    setPayStep(0);
    setSelectedPaymentMethod(tenantInfo.paymentMethods?.[0]?.key || "");
    setPaymentForm({
      amount: String(tenantInfo.monthlyRent || ""),
      referenceNumber: "",
      paymentDate: getTodayInputValue(),
      remarks: "",
    });
    setOpenPaymentModal(true);
  };

  const amountNum = Number(paymentForm.amount);
  const paymentErrors = {
    amount: !amountNum || amountNum <= 0 ? "Enter a valid amount." : "",
    referenceNumber: !paymentForm.referenceNumber.trim() ? "Enter the reference number from your payment." : "",
    paymentDate: !paymentForm.paymentDate ? "Choose the payment date." : paymentForm.paymentDate > getTodayInputValue() ? "The date can't be in the future." : "",
  };
  const showPayErr = (k) => (paymentTouched[k] ? paymentErrors[k] : "");

  const handlePaymentSubmit = async () => {
    const user = auth.currentUser;
    if (!user || paymentSubmitting) return;

    setPaymentTouched({ amount: true, referenceNumber: true, paymentDate: true });
    if (Object.values(paymentErrors).some(Boolean)) return;

    if (!tenantInfo.ownerUid) {
      setPaymentError("Your account is not linked to an owner yet. Please contact the property owner.");
      return;
    }
    if (!online) {
      const queuedRecord = {
        tenantId: user.uid,
        tenantName: tenantInfo.name,
        ownerUid: tenantInfo.ownerUid,
        propertyId: tenantInfo.propertyId,
        propertyName: tenantInfo.propertyName,
        roomNumber: tenantInfo.roomNumber,
        amount: amountNum,
        paymentMethod: payMethodKey,
        periodMonth: currentPeriod,
        status: "Pending",
        verificationStatus: "Pending",
        referenceNumber: paymentForm.referenceNumber.trim(),
        paymentDate: paymentForm.paymentDate,
        remarks: paymentForm.remarks.trim(),
      };
      queueOffline("payment", queuedRecord);
      setSubmittedPayment({ ...queuedRecord, queued: true });
      setPayStep(2);
      return;
    }

    try {
      setPaymentSubmitting(true);
      setPaymentError("");

      // Optional proof of payment (screenshot of the receipt)
      let proofUrl = "";
      if (proofFile) {
        try {
          proofUrl = await uploadToCloudinary(proofFile);
        } catch (uploadErr) {
          console.error("Proof upload failed:", uploadErr);
          setPaymentError("The screenshot couldn't be uploaded. Try again, or remove it to submit without it.");
          return;
        }
      }

      const record = {
        tenantId: user.uid,
        tenantName: tenantInfo.name,
        ownerUid: tenantInfo.ownerUid,
        propertyId: tenantInfo.propertyId,
        propertyName: tenantInfo.propertyName,
        roomNumber: tenantInfo.roomNumber,
        amount: amountNum,
        paymentMethod: payMethodKey,
        periodMonth: currentPeriod,
        // IMPORTANT: a tenant can never mark a payment as Paid.
        status: "Pending",
        verificationStatus: "Pending",
        referenceNumber: paymentForm.referenceNumber.trim(),
        paymentDate: paymentForm.paymentDate,
        remarks: paymentForm.remarks.trim(),
        ...(proofUrl ? { proofUrl } : {}),
      };

      await addDoc(collection(db, "payments"), { ...record, createdAt: serverTimestamp() });

      setSubmittedPayment(record);
      setPayStep(2);
    } catch (err) {
      console.error("Error submitting payment:", err);
      setPaymentError("Unable to submit the payment right now. Please try again.");
    } finally {
      setPaymentSubmitting(false);
    }
  };

  const goNextStep = () => setPayStep(1);

  const copyText = async (text, label = "Copied.") => {
    try {
      await navigator.clipboard.writeText(text);
      notify(label);
    } catch {
      notify("Couldn't copy. Select the text and copy it manually.", "warning");
    }
  };

  const sharePayment = async (p) => {
    const text = `Rent payment · ${p.periodMonth || ""}\nAmount: ${peso(p.amount)}\nMethod: ${p.paymentMethod || "—"}\nReference: ${p.referenceNumber || "—"}\nStatus: ${p.status || "Pending"}`;
    try {
      if (navigator.share) await navigator.share({ title: "Payment details", text });
      else await copyText(text, "Payment details copied.");
    } catch {
      /* the person closed the share sheet */
    }
  };

  // ---- derived
  const rankedTickets = useMemo(() => rankMaintenanceRequests(tickets), [tickets]);
  const activeTickets = rankedTickets.filter((t) => !["Resolved", "Cancelled"].includes(t.status || "Pending"));
  const resolvedTickets = rankedTickets.filter((t) => ["Resolved", "Cancelled"].includes(t.status || "Pending"));
  const payMethods = tenantInfo.paymentMethods || [];
  const activePayMethod = payMethods.find((m) => m.key === selectedPaymentMethod) || payMethods[0] || null;
  const payMethodKey = activePayMethod?.key || selectedPaymentMethod || "GCash";

  const statusTone = /suspend|inactive|terminated/i.test(tenantInfo.status) ? "error" : /pending/i.test(tenantInfo.status) ? "warning" : "success";

  // ---- curfew + house rules
  const curfewMin = parseClock(tenantInfo.curfewTime);
  const clock = useClock(curfewMin !== null);
  const recentCurfew = curfewRecords.filter((r) => Date.now() - new Date(`${r.date}T12:00:00`).getTime() <= 30 * 86400000);
  const hasHouseRules = Boolean(tenantInfo.curfewTime) || tenantInfo.rules.length > 0 || tenantInfo.ruleFiles.length > 0;
  const rulesSig = JSON.stringify([tenantInfo.curfewTime, tenantInfo.rules]);
  const rulesKey = `kk_rules_ack_${tenantInfo.propertyId}`;
  useEffect(() => {
    if (!tenantInfo.propertyId || !hasHouseRules) {
      setRulesAcked(true);
      return;
    }
    try {
      setRulesAcked(window.localStorage.getItem(rulesKey) === rulesSig);
    } catch {
      setRulesAcked(false);
    }
  }, [tenantInfo.propertyId, hasHouseRules, rulesKey, rulesSig]);
  const ackRules = () => {
    try {
      window.localStorage.setItem(rulesKey, rulesSig);
    } catch {
      /* storage unavailable: the banner just returns next visit */
    }
    setRulesAcked(true);
  };
  const hasCover = Boolean(tenantInfo.coverPhotoUrl) && !coverFailed;

  const paidThisYear = useMemo(() => {
    const y = String(new Date().getFullYear());
    return payments.filter((p) => p.status === "Paid" && String(p.periodMonth || "").includes(y)).reduce((s, p) => s + (Number(p.amount) || 0), 0);
  }, [payments]);

  const paymentKind = (p) => {
    const k = String(p.status || "pending").toLowerCase();
    return k === "paid" ? "paid" : k === "rejected" ? "rejected" : "pending";
  };
  const paymentCounts = useMemo(
    () => ({
      all: payments.length,
      paid: payments.filter((p) => paymentKind(p) === "paid").length,
      pending: payments.filter((p) => paymentKind(p) === "pending").length,
      rejected: payments.filter((p) => paymentKind(p) === "rejected").length,
    }),
    [payments]
  );
  const filteredPayments = useMemo(() => (paymentFilter === "all" ? payments : payments.filter((p) => paymentKind(p) === paymentFilter)), [payments, paymentFilter]);

  const paymentsByYear = useMemo(() => {
    const groups = {};
    filteredPayments.forEach((p) => {
      const ms = getTimestampMillis(p.paymentDate || p.createdAt);
      const y = ms ? new Date(ms).getFullYear() : "Earlier";
      (groups[y] = groups[y] || []).push(p);
    });
    return Object.entries(groups).sort((a, b) => String(b[0]).localeCompare(String(a[0])));
  }, [filteredPayments]);

  /* ---------------------------------------------------------------------
     Loading
  --------------------------------------------------------------------- */
  if (loadError) {
    return (
      <Paper elevation={0} sx={cardSx}>
        <EmptyState
          icon={<ErrorOutlinedIcon sx={{ fontSize: 28, color: "primary.main" }} />}
          title="We couldn't open your dashboard"
          body={loadError}
          action={
            <Button variant="contained" startIcon={<RefreshOutlinedIcon />} onClick={() => setReloadKey((k) => k + 1)} sx={{ mt: 2, fontWeight: 700, borderRadius: 2.5, minHeight: 46 }}>
              Try again
            </Button>
          }
        />
      </Paper>
    );
  }

  if (loading) {
    return (
      <Box>
        <Skeleton variant="rounded" height={240} sx={{ borderRadius: 4, mb: 3 }} />
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2, 1fr)", md: "repeat(4, 1fr)" }, gap: 2, mb: 3 }}>
          {[0, 1, 2, 3].map((k) => (
            <Skeleton key={k} variant="rounded" height={112} sx={{ borderRadius: 3 }} />
          ))}
        </Box>
        <Skeleton variant="rounded" height={240} sx={{ borderRadius: 3 }} />
      </Box>
    );
  }

  /* ---------------------------------------------------------------------
     Tabs
  --------------------------------------------------------------------- */
  // Things the tenant should look at first
  const attention = [];
  if (statusTone === "error") {
    attention.push({ key: "account", tone: "error", title: `Your account is ${String(tenantInfo.status).toLowerCase()}`, body: "Please contact your landlord to sort this out." });
  }
  if (tenantInfo.propertyName === "Not Assigned") {
    attention.push({ key: "unassigned", tone: "warning", title: "No room assigned yet", body: "Your landlord hasn't linked you to a room. Rent and lease details appear once they do." });
  }
  if (statusKey === "rejected") {
    attention.push({
      key: "rejected",
      tone: "error",
      title: "Your payment couldn't be verified",
      body: currentPeriodPayment?.rejectionReason || "Check the reference number and submit it again.",
      actionLabel: "Submit again",
      onAction: openPayRentModal,
    });
  } else if (statusKey === "overdue") {
    attention.push({ key: "overdue", tone: "error", title: "Your rent is overdue", body: `${peso(tenantInfo.monthlyRent)} for ${currentPeriod} · ${dueText.toLowerCase()}`, actionLabel: "Pay now", onAction: openPayRentModal });
  } else if (canPay && daysToDue >= 0 && daysToDue <= 3) {
    attention.push({ key: "soon", tone: "warning", title: daysToDue === 0 ? "Rent is due today" : `Rent is due in ${daysToDue} ${daysToDue === 1 ? "day" : "days"}`, body: `${peso(tenantInfo.monthlyRent)} for ${currentPeriod}`, actionLabel: "Pay now", onAction: openPayRentModal });
  }
  // Lease: tell the tenant a month ahead, and again once it has ended
  if (lease && !lease.open) {
    if (lease.ended) {
      attention.push({
        key: "lease",
        tone: "error",
        icon: CalendarMonthOutlinedIcon,
        title: "Your lease has ended",
        body: `It ended on ${fmtDate(lease.endMs)}. Please talk to your landlord about renewing or moving out.`,
      });
    } else if (lease.daysLeft <= 30) {
      attention.push({
        key: "lease",
        tone: "warning",
        icon: CalendarMonthOutlinedIcon,
        title: lease.daysLeft === 0 ? "Your lease ends today" : `Your lease ends in ${lease.daysLeft} ${lease.daysLeft === 1 ? "day" : "days"}`,
        body: `Ends on ${fmtDate(lease.endMs)}. Talk to your landlord if you'd like to renew.`,
      });
    }
  }
  if (curfewMin !== null) {
    const nowMin = clock.getHours() * 60 + clock.getMinutes();
    const until = (curfewMin - nowMin + 1440) % 1440;
    const since = (nowMin - curfewMin + 1440) % 1440;
    if (since < 180) {
      attention.push({ key: "curfew", tone: "info", icon: ScheduleIcon, title: "Curfew is in effect", body: `Curfew started at ${tenantInfo.curfewTime}. Please check the house rules if you're out.` });
    } else if (until <= 120) {
      const label = until >= 60 ? `${Math.floor(until / 60)} h ${until % 60} min` : `${until} min`;
      attention.push({ key: "curfew", tone: "warning", icon: ScheduleIcon, title: `Curfew in ${label}`, body: `Be back at ${tenantInfo.propertyName} by ${tenantInfo.curfewTime}.` });
    }
  }
  if (!rulesAcked && hasHouseRules) {
    attention.push({
      key: "rules",
      tone: "info",
      icon: PolicyOutlinedIcon,
      title: "Please read your house rules",
      body: tenantInfo.curfewTime ? `Includes the curfew (${tenantInfo.curfewTime}) set for ${tenantInfo.propertyName}.` : `Set by the owner of ${tenantInfo.propertyName}.`,
      actionLabel: "Read rules",
      onAction: () => {
        ackRules();
        goTab("profile");
      },
      secondaryLabel: "Got it",
      onSecondary: ackRules,
    });
  }

  const heroBtnSx = {
    fontWeight: 700,
    borderRadius: 2.5,
    color: "#fff",
    borderColor: "rgba(255,255,255,0.35)",
    "&:hover": { borderColor: "#fff", bgcolor: "rgba(255,255,255,0.08)" },
  };

  const overview = (
    <>
      {/* Hero: the property's cover photo gives the tenant a sense of home */}
      <Box
        sx={{
          position: "relative",
          overflow: "hidden",
          bgcolor: "#202020",
          color: "#fff",
          borderRadius: 4,
          p: { xs: 2, sm: 4 },
          mb: { xs: 2, sm: 3 },
          display: "grid",
          gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "1.2fr 0.8fr" },
          gap: { xs: 2.5, md: 4 },
          alignItems: "end",
          minHeight: hasCover ? { xs: 300, sm: 280 } : undefined,
          ...rise(0),
        }}
      >
        {hasCover ? (
          <>
            <Box
              component="img"
              src={tenantInfo.coverPhotoUrl}
              alt=""
              onError={() => setCoverFailed(true)}
              sx={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }}
            />
            <Box sx={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(20,20,20,0.35) 0%, rgba(20,20,20,0.88) 70%)" }} />
          </>
        ) : (
          <>
            <Box
              sx={{
                position: "absolute",
                top: -140,
                right: -100,
                width: 380,
                height: 380,
                borderRadius: "50%",
                background: "radial-gradient(circle, rgba(255, 69, 0, 0.22), transparent 70%)",
                pointerEvents: "none",
              }}
            />
            <Box sx={{ position: "absolute", top: 20, right: 20, width: 150, opacity: 0.7, display: { xs: "none", sm: "block" }, pointerEvents: "none" }}>
              <LeaseWindows progress={0.5} />
            </Box>
          </>
        )}

        <Box sx={{ position: "relative", minWidth: 0, alignSelf: "end" }}>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75, mb: 1.5 }}>
            <Chip
              size="small"
              label={`${tenantInfo.status} tenant`}
              sx={{
                fontWeight: 700,
                bgcolor: statusTone === "success" ? "rgba(76, 175, 80, 0.28)" : statusTone === "warning" ? "rgba(255, 167, 38, 0.28)" : "rgba(244, 67, 54, 0.28)",
                color: statusTone === "success" ? "#c8e6c9" : statusTone === "warning" ? "#ffe0b2" : "#ffcdd2",
              }}
            />
            {tenantInfo.curfewTime && (
              <Chip
                size="small"
                icon={<ScheduleIcon />}
                label={`Curfew ${tenantInfo.curfewTime}`}
                sx={{ fontWeight: 700, bgcolor: "rgba(255,255,255,0.16)", color: "#fff", "& .MuiChip-icon": { color: "inherit" } }}
              />
            )}
          </Box>
          <Typography
            component="h1"
            sx={{ fontFamily: '"Inter", sans-serif', fontWeight: 900, color: "#fff", fontSize: { xs: "1.45rem", sm: "2.1rem" }, lineHeight: 1.15, overflowWrap: "anywhere" }}
          >
            {greeting()}, {firstName(tenantInfo.name)}
          </Typography>
          <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.8)", mt: 0.75 }}>
            {tenantInfo.propertyName} · Room {tenantInfo.roomNumber}
            {tenantInfo.bedId && tenantInfo.bedId !== "N/A" ? ` · Bed ${tenantInfo.bedId}` : ""}
          </Typography>
        </Box>

        {/* Rent card */}
        <Box
          sx={{
            position: "relative",
            p: { xs: 1.75, sm: 2.25 },
            borderRadius: 3,
            bgcolor: "rgba(255,255,255,0.1)",
            border: "1px solid rgba(255,255,255,0.18)",
            backdropFilter: "blur(10px)",
            WebkitBackdropFilter: "blur(10px)",
          }}
        >
          <Box sx={{ ...row, justifyContent: "space-between", mb: 0.5 }}>
            <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.8)", fontWeight: 700 }}>
              {currentPeriod.toUpperCase()} RENT
            </Typography>
            <Chip
              size="small"
              label={rentStatus}
              sx={{
                fontWeight: 700,
                bgcolor: isPaid ? "rgba(76,175,80,0.3)" : paymentTone(rentStatus) === "error" ? "rgba(244,67,54,0.3)" : "rgba(255,167,38,0.3)",
                color: isPaid ? "#c8e6c9" : paymentTone(rentStatus) === "error" ? "#ffcdd2" : "#ffe0b2",
              }}
            />
          </Box>
          <Typography sx={{ fontFamily: '"Inter", sans-serif', fontWeight: 900, fontSize: { xs: "1.8rem", sm: "2rem" }, lineHeight: 1.2 }}>{peso(tenantInfo.monthlyRent)}</Typography>
          <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.8)", mb: 1.75 }}>
            {dueText}
            {canPay ? ` · ${dueDate.toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : ""}
          </Typography>
          {canPay ? (
            <Button variant="contained" fullWidth size="large" startIcon={<PaymentIcon />} onClick={openPayRentModal} sx={{ fontWeight: 800, borderRadius: 2.5, minHeight: 48 }}>
              Pay rent
            </Button>
          ) : (
            <Button fullWidth size="large" variant="outlined" onClick={() => goTab("payments")} sx={{ ...heroBtnSx, minHeight: 48 }}>
              View payments
            </Button>
          )}
        </Box>
      </Box>

      {/* Needs attention */}
      {attention.length > 0 && (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1.25, mb: { xs: 2, sm: 3 } }}>
          {attention.map(({ key, ...a }) => (
            <AttentionBanner key={key} {...a} />
          ))}
        </Box>
      )}

      {/* Quick actions */}
      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: { xs: 1, sm: 1.5 }, mb: { xs: 2, sm: 3 }, ...rise(1) }}>
        <QuickAction icon={<PaymentIcon fontSize="small" />} label={canPay ? "Pay rent" : "Payments"} onClick={canPay ? openPayRentModal : () => goTab("payments")} />
        <QuickAction icon={<BuildOutlinedIcon fontSize="small" />} label="Report issue" onClick={openRepair} />
      </Box>

      {/* Panels: what's happening now */}
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "repeat(2, minmax(0, 1fr))" }, gap: { xs: 2, md: 3 }, alignItems: "start" }}>
        <Panel
          title="Announcements"
          icon={<CampaignOutlinedIcon fontSize="small" />}
          sx={rise(2)}
          action={
            <Box sx={{ display: "flex", gap: 0.5 }}>
              {announcements.some((n) => n.isRead === false) && (
                <Button size="small" startIcon={<DoneAllIcon fontSize="small" />} onClick={() => markRead(announcements)} sx={{ fontWeight: 700, minHeight: 40 }}>
                  Mark all read
                </Button>
              )}
              {announcements.length > 3 && (
                <Button size="small" onClick={() => setShowAllAnnouncements((v) => !v)} sx={{ fontWeight: 700, minHeight: 40 }}>
                  {showAllAnnouncements ? "Show less" : `Show all (${announcements.length})`}
                </Button>
              )}
            </Box>
          }
        >
          {announcements.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No announcements. Updates from your landlord will show up here.
            </Typography>
          ) : (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1.25 }}>
              {(showAllAnnouncements ? announcements : announcements.slice(0, 3)).map((n) => (
                <AnnouncementItem key={n.id} n={n} onRead={markRead} />
              ))}
            </Box>
          )}
        </Panel>

        <Panel
          title="Open requests"
          icon={<BuildOutlinedIcon fontSize="small" />}
          sx={rise(3)}
          action={
            rankedTickets.length > 0 && (
              <Button size="small" endIcon={<ArrowForwardIcon />} onClick={() => goTab("maintenance")} sx={{ fontWeight: 700, minHeight: 40 }}>
                View all
              </Button>
            )
          }
        >
          {activeTickets.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              Nothing pending. Use "Report issue" above if something needs fixing.
            </Typography>
          ) : (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1.25 }}>
              {activeTickets.slice(0, 2).map((t) => (
                <TicketCard key={t.id} t={t} compact />
              ))}
            </Box>
          )}
        </Panel>
      </Box>
    </>
  );

  const currentStep = !currentPeriodPayment ? -1 : isPaid ? 2 : statusKey === "rejected" ? 2 : 1;

  const paymentsTab = (
    <>
      <Box sx={{ ...row, justifyContent: "space-between", gap: 2, mb: { xs: 2, sm: 2.5 } }}>
        <Typography variant="body2" color="text.secondary">
          Pay your rent and submit it for owner verification.
        </Typography>
        {!isPhone && (
          <Button variant="contained" startIcon={<PaymentIcon />} onClick={openPayRentModal} disabled={!canPay} sx={{ fontWeight: 700, borderRadius: 2.5, px: 2.5, flexShrink: 0 }}>
            {isPaid ? "Paid" : isAwaitingVerification ? "Awaiting verification" : "Pay rent"}
          </Button>
        )}
      </Box>

      {rentMissing && (
        <Alert severity="warning" sx={{ mb: 2, borderRadius: 2 }}>
          Your monthly rent isn't set yet, so the amount may need to be typed in. Ask your landlord to confirm it.
        </Alert>
      )}

      <Paper elevation={0} sx={{ ...cardSx, overflow: "hidden", display: "grid", gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", md: "repeat(4, minmax(0, 1fr))" }, mb: { xs: 2, sm: 2.5 }, ...rise(0) }}>
        {[
          { label: "Billing period", value: currentPeriod },
          { label: "Amount due", value: peso(tenantInfo.monthlyRent) },
          { label: "Due date", value: dueDateLabel, sub: dueText },
          { label: "Status", value: rentStatus, tone: paymentTone(rentStatus) },
        ].map((item, i) => (
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
            {item.tone ? (
              <Box sx={{ mt: 0.5 }}>
                <Pill label={item.value} tone={item.tone} />
              </Box>
            ) : (
              <Typography sx={{ fontFamily: '"Inter", sans-serif', fontWeight: 800, fontSize: { xs: "1.05rem", sm: "1.25rem" }, lineHeight: 1.3 }}>{item.value}</Typography>
            )}
            {item.sub && (
              <Typography variant="caption" color="text.secondary" noWrap component="div">
                {item.sub}
              </Typography>
            )}
          </Box>
        ))}
      </Paper>

      {/* Where is this month's payment? */}
      {currentPeriodPayment ? (
        <Paper elevation={0} sx={{ ...cardSx, p: { xs: 2, sm: 2.5 }, mb: { xs: 2, sm: 2.5 }, ...rise(1) }}>
          <Box sx={{ ...row, justifyContent: "space-between", gap: 1, mb: 2 }}>
            <Typography sx={{ fontWeight: 800 }}>Your {currentPeriod} payment</Typography>
            <Typography variant="body2" color="text.secondary">
              {peso(currentPeriodPayment.amount)} · {currentPeriodPayment.paymentMethod}
            </Typography>
          </Box>
          <Box sx={{ px: { xs: 0, sm: 4 } }}>
            <StepTrack
              steps={["Submitted", "Under review", statusKey === "rejected" ? "Rejected" : "Paid"]}
              current={currentStep}
              complete={isPaid}
              failed={statusKey === "rejected"}
            />
          </Box>
          {statusKey === "rejected" && (
            <Alert severity="error" sx={{ mt: 2, borderRadius: 2 }}>
              The owner couldn't verify this payment
              {currentPeriodPayment.rejectionReason ? `: ${currentPeriodPayment.rejectionReason}` : "."} Check the details and submit it again.
            </Alert>
          )}
          {isAwaitingVerification && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
              The owner has been notified and will verify your payment soon.
            </Typography>
          )}
        </Paper>
      ) : (
        <Paper
          elevation={0}
          sx={{
            ...cardSx,
            p: { xs: 2, sm: 2.5 },
            mb: { xs: 2, sm: 2.5 },
            borderColor: (t) => alpha(t.palette[daysToDue < 0 ? "error" : "warning"].main, 0.45),
            bgcolor: (t) => alpha(t.palette[daysToDue < 0 ? "error" : "warning"].main, 0.06),
            display: "flex",
            flexDirection: { xs: "column", sm: "row" },
            alignItems: { xs: "stretch", sm: "center" },
            gap: 2,
            ...rise(1),
          }}
        >
          <Box sx={{ flex: 1 }}>
            <Typography sx={{ fontWeight: 800 }}>{daysToDue < 0 ? "Your rent is overdue" : "Rent not paid yet"}</Typography>
            <Typography variant="body2" color="text.secondary">
              {peso(tenantInfo.monthlyRent)} for {currentPeriod} · {dueText.toLowerCase()}
            </Typography>
          </Box>
          {isPhone && (
            <Button variant="contained" startIcon={<PaymentIcon />} onClick={openPayRentModal} sx={{ fontWeight: 700, borderRadius: 2.5 }}>
              Pay now
            </Button>
          )}
        </Paper>
      )}

      <Panel
        title="Payment history"
        icon={<HistoryIcon fontSize="small" />}
        sx={rise(2)}
        action={paidThisYear > 0 && <Pill label={`${peso(paidThisYear)} paid in ${new Date().getFullYear()}`} tone="success" />}
      >
        {payments.length > 0 && (
          <Box sx={{ display: "flex", gap: 1, overflowX: "auto", mx: { xs: -2, sm: 0 }, px: { xs: 2, sm: 0 }, mb: 2, scrollbarWidth: "none", "&::-webkit-scrollbar": { display: "none" } }}>
            {[
              { id: "all", label: "All" },
              { id: "paid", label: "Paid" },
              { id: "pending", label: "Pending" },
              ...(paymentCounts.rejected > 0 ? [{ id: "rejected", label: "Rejected" }] : []),
            ].map((f) => (
              <Chip
                key={f.id}
                label={`${f.label} · ${paymentCounts[f.id]}`}
                clickable
                onClick={() => setPaymentFilter(f.id)}
                color={paymentFilter === f.id ? "primary" : "default"}
                variant={paymentFilter === f.id ? "filled" : "outlined"}
                sx={{ fontWeight: 700, flexShrink: 0, height: 40, borderRadius: 20 }}
              />
            ))}
          </Box>
        )}
        {payments.length === 0 ? (
          <EmptyState icon={<ReceiptLongOutlinedIcon sx={{ fontSize: 28, color: "primary.main" }} />} title="No payments yet" body="Your submitted payments will show up here." />
        ) : filteredPayments.length === 0 ? (
          <EmptyState icon={<CheckCircleOutlinedIcon sx={{ fontSize: 28, color: "primary.main" }} />} title="Nothing here" body="No payments match this filter." />
        ) : (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {paymentsByYear.map(([year, list]) => (
              <Box key={year}>
                <Typography variant="caption" sx={{ fontWeight: 800, letterSpacing: 0.6, color: "text.secondary" }}>
                  {year}
                </Typography>
                <Box sx={{ display: "flex", flexDirection: "column", gap: 1.25, mt: 0.75 }}>
                  {list.map((p) => (
                    <PaymentRow key={p.id} p={p} onClick={() => setReceipt(p)} />
                  ))}
                </Box>
              </Box>
            ))}
          </Box>
        )}
      </Panel>
    </>
  );

  const profileTab = (
    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "minmax(0, 1fr) minmax(0, 1.4fr)" }, gap: { xs: 2, md: 3 }, alignItems: "start" }}>
      <Box sx={{ display: "flex", flexDirection: "column", gap: { xs: 2, md: 3 }, minWidth: 0 }}>
        <Paper elevation={0} sx={{ ...cardSx, p: { xs: 2.5, sm: 3 }, textAlign: "center", ...rise(0) }}>
          <Avatar sx={{ width: 76, height: 76, mx: "auto", mb: 1.5, fontSize: "1.6rem", fontWeight: 800, bgcolor: "rgba(255, 69, 0, 0.12)", color: "primary.main" }}>
            {initials(tenantInfo.name)}
          </Avatar>
          <Typography sx={{ fontFamily: '"Inter", sans-serif', fontWeight: 800, fontSize: "1.3rem", mb: 1.5, overflowWrap: "anywhere" }}>{tenantInfo.name}</Typography>
          <Box sx={{ display: "flex", justifyContent: "center", flexWrap: "wrap", gap: 0.75 }}>
            <Pill label={tenantInfo.status} tone={statusTone} />
            <Pill label={`Room ${tenantInfo.roomNumber}`} icon={<HomeWorkOutlinedIcon />} />
          </Box>
        </Paper>

        <Panel title="Room & lease" icon={<CalendarMonthOutlinedIcon fontSize="small" />} sx={rise(1)}>
          {lease && (
            <Box sx={{ mb: 1.5 }}>
              {lease.open ? (
                <Typography variant="body2" color="text.secondary">
                  Your lease is open-ended. You've been here since <strong>{fmtDate(lease.startMs)}</strong>.
                </Typography>
              ) : (
                <>
                  <Box sx={{ ...row, justifyContent: "space-between", mb: 0.75 }}>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>
                      {Math.round(lease.progress * 100)}% complete
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {lease.ended ? "Ended" : `${lease.daysLeft} days left`}
                    </Typography>
                  </Box>
                  <LinearProgress variant="determinate" value={lease.progress * 100} sx={{ height: 8, borderRadius: 4, bgcolor: (t) => alpha(t.palette.text.primary, 0.08) }} />
                  <Box sx={{ ...row, justifyContent: "space-between", mt: 1 }}>
                    <Typography variant="caption" color="text.secondary">
                      {fmtDate(lease.startMs)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {fmtDate(lease.endMs)}
                    </Typography>
                  </Box>
                </>
              )}
            </Box>
          )}
          <Facts
            items={[
              { label: "Room", value: `Room ${tenantInfo.roomNumber}` },
              { label: "Bed", value: tenantInfo.bedId },
              { label: "Lease start", value: formatLeaseStart(tenantInfo.leaseStartDate) },
              { label: "Lease length", value: tenantInfo.leaseDuration },
              { label: "My phone", value: tenantInfo.contact },
            ]}
          />
        </Panel>
      </Box>

      <Box sx={{ display: "flex", flexDirection: "column", gap: { xs: 2, md: 3 }, minWidth: 0 }}>
        <Panel title="My place" icon={<PlaceOutlinedIcon fontSize="small" />} sx={rise(2)}>
          {hasCover && (
            <Box component="img" src={tenantInfo.coverPhotoUrl} alt="" sx={{ display: "block", width: "100%", height: 140, objectFit: "cover", borderRadius: 2, mb: 1.5 }} />
          )}
          <Typography sx={{ fontWeight: 800 }}>{tenantInfo.propertyName}</Typography>
          {tenantInfo.propertyAddress && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
              {tenantInfo.propertyAddress}
            </Typography>
          )}
          {tenantInfo.amenities.length > 0 && (
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75, mt: 1.5 }}>
              {tenantInfo.amenities.map((a) => (
                <Pill key={a} label={a} />
              ))}
            </Box>
          )}
          {tenantInfo.emergencyPhone && (
            <Button
              component="a"
              href={`tel:${tenantInfo.emergencyPhone}`}
              variant="outlined"
              color="error"
              fullWidth
              startIcon={<PhoneOutlinedIcon />}
              sx={{ mt: 2, fontWeight: 700, borderRadius: 2.5, minHeight: 46 }}
            >
              Emergency: {tenantInfo.emergencyPhone}
            </Button>
          )}
        </Panel>

        <Panel title="House rules & curfew" icon={<PolicyOutlinedIcon fontSize="small" />} sx={rise(3)}>
          {!hasHouseRules ? (
            <Typography variant="body2" color="text.secondary">
              Your landlord hasn't posted any house rules yet.
            </Typography>
          ) : (
            <>
              {tenantInfo.curfewTime && (
                <Box sx={{ ...row, gap: 1.25, p: 1.5, mb: 1.5, borderRadius: 2.5, bgcolor: (t) => alpha(t.palette.primary.main, 0.08) }}>
                  <ScheduleIcon color="primary" />
                  <Box>
                    <Typography sx={{ fontWeight: 800 }}>Curfew at {tenantInfo.curfewTime}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      Please be back before then.
                    </Typography>
                  </Box>
                </Box>
              )}
              {tenantInfo.curfewTime && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 800 }}>
                    YOUR CURFEW RECORD · LAST 30 NIGHTS
                  </Typography>
                  {recentCurfew.length === 0 ? (
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                      Nothing recorded yet.
                    </Typography>
                  ) : (
                    <>
                      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75, mt: 0.75 }}>
                        <Pill label={`${recentCurfew.filter((r) => r.status === "present").length} on time`} tone="success" />
                        {recentCurfew.some((r) => r.status === "late") && <Pill label={`${recentCurfew.filter((r) => r.status === "late").length} late`} tone="warning" />}
                        {recentCurfew.some((r) => r.status === "out") && <Pill label={`${recentCurfew.filter((r) => r.status === "out").length} out past curfew`} tone="error" />}
                      </Box>
                      {recentCurfew.filter((r) => r.status !== "present").slice(0, 6).map((r) => {
                        const [yy, mm, dd] = String(r.date).split("-").map(Number);
                        return (
                          <Box key={r.id} sx={{ ...row, justifyContent: "space-between", gap: 1, mt: 0.75, py: 0.5 }}>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                              {new Date(yy, mm - 1, dd).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}
                            </Typography>
                            <Pill label={r.status === "out" ? "Out past curfew" : "Late"} tone={r.status === "out" ? "error" : "warning"} />
                          </Box>
                        );
                      })}
                    </>
                  )}
                </Box>
              )}
              {tenantInfo.rules.length > 0 && (
                <>
                  <Box component="ol" sx={{ m: 0, pl: 2.5, display: "flex", flexDirection: "column", gap: 0.9 }}>
                    {(rulesOpen ? tenantInfo.rules : tenantInfo.rules.slice(0, RULES_PREVIEW)).map((r, i) => (
                      <Typography component="li" variant="body2" key={`${i}-${r}`} sx={{ overflowWrap: "anywhere" }}>
                        {r}
                      </Typography>
                    ))}
                  </Box>
                  {tenantInfo.rules.length > RULES_PREVIEW && (
                    <Button
                      size="small"
                      onClick={() => setRulesOpen((v) => !v)}
                      aria-expanded={rulesOpen}
                      endIcon={<ExpandMoreIcon sx={{ transform: rulesOpen ? "rotate(180deg)" : "none", transition: "transform .2s" }} />}
                      sx={{ mt: 1, minHeight: 40, fontWeight: 700, textTransform: "none" }}
                    >
                      {rulesOpen ? "Show fewer rules" : `Show all ${tenantInfo.rules.length} rules`}
                    </Button>
                  )}
                </>
              )}
              {tenantInfo.ruleFiles.length > 0 && (
                <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75, mt: tenantInfo.rules.length > 0 ? 2 : 0 }}>
                  {tenantInfo.ruleFiles.map((f, i) => (
                    <Button
                      key={`${i}-${f.url}`}
                      onClick={() => setPreviewFile(f)}
                      variant="outlined"
                      startIcon={<DescriptionOutlinedIcon />}
                      sx={{ justifyContent: "flex-start", fontWeight: 700, borderRadius: 2.5, minHeight: 44, textTransform: "none" }}
                    >
                      {f.name || "House rules document"}
                    </Button>
                  ))}
                </Box>
              )}
              {!rulesAcked && (
                <Button fullWidth variant="contained" onClick={ackRules} sx={{ mt: 2, fontWeight: 700, borderRadius: 2.5, minHeight: 46 }}>
                  I've read the rules
                </Button>
              )}
            </>
          )}
        </Panel>
        <FilePreviewDialog file={previewFile} onClose={() => setPreviewFile(null)} />
      </Box>
    </Box>
  );

  const maintenanceTab = (
    <>
      <Box sx={{ ...row, justifyContent: "space-between", gap: 2, mb: { xs: 2, sm: 2.5 } }}>
        <Typography variant="body2" color="text.secondary">
          Report an issue in your room or unit and track its progress.
        </Typography>
        {!isPhone && (
          <Button variant="contained" startIcon={<AddIcon />} onClick={openRepair} sx={{ fontWeight: 700, borderRadius: 2.5, px: 2.5, flexShrink: 0 }}>
            New request
          </Button>
        )}
      </Box>

      {rankedTickets.length === 0 ? (
        <Paper elevation={0} sx={{ ...cardSx, borderStyle: "dashed" }}>
          <EmptyState
            icon={<BuildOutlinedIcon sx={{ fontSize: 28, color: "primary.main" }} />}
            title="No maintenance requests"
            body={`Something broken or needs fixing? Tap "New request" and your landlord will see it right away.`}
          />
        </Paper>
      ) : (
        <>
          {activeTickets.length === 0 ? (
            <Paper elevation={0} sx={{ ...cardSx }}>
              <EmptyState icon={<CheckCircleOutlinedIcon sx={{ fontSize: 28, color: "primary.main" }} />} title="All sorted" body="No open requests right now." />
            </Paper>
          ) : (
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", lg: "repeat(2, minmax(0, 1fr))" }, gap: { xs: 1.5, sm: 2 } }}>
              {activeTickets.map((t, i) => (
                <Box key={t.id} sx={{ ...rise(i), minWidth: 0 }}>
                  <TicketCard t={t} onAction={openTicketDlg} />
                </Box>
              ))}
            </Box>
          )}

          {/* Resolved requests live in the archive, out of the way */}
          {resolvedTickets.length > 0 && (
            <Box sx={{ mt: { xs: 2.5, sm: 3 } }}>
              <Button
                fullWidth
                onClick={() => setArchiveOpen((o) => !o)}
                aria-expanded={archiveOpen}
                startIcon={<HistoryIcon fontSize="small" />}
                sx={{ ...cardSx, justifyContent: "space-between", px: 2, minHeight: 52, fontWeight: 700, color: "text.primary", textTransform: "none" }}
                endIcon={<ArrowForwardIcon fontSize="small" sx={{ transform: archiveOpen ? "rotate(90deg)" : "none", transition: "transform .2s" }} />}
              >
                <Box component="span" sx={{ flex: 1, textAlign: "left", ml: 0.5 }}>
                  Archive · {resolvedTickets.length} closed
                </Box>
              </Button>
              {archiveOpen && (
                <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", lg: "repeat(2, minmax(0, 1fr))" }, gap: { xs: 1.5, sm: 2 }, mt: 1.5 }}>
                  {resolvedTickets.map((t) => (
                    <Box key={t.id} sx={{ minWidth: 0, opacity: 0.85 }}>
                      <TicketCard t={t} />
                    </Box>
                  ))}
                </Box>
              )}
            </Box>
          )}
        </>
      )}
    </>
  );

  const fabAction =
    isPhone && activeTab === "payments" && canPay
      ? { label: "Pay rent", icon: <PaymentIcon sx={{ mr: 0.75 }} />, onClick: openPayRentModal }
      : isPhone && activeTab === "maintenance"
        ? { label: "New request", icon: <AddIcon sx={{ mr: 0.75 }} />, onClick: openRepair }
        : null;

  const closePayment = () => {
    if (paymentSubmitting) return;
    setOpenPaymentModal(false);
  };

  return (
    <Box>
      {AnimationStyles}

      {!online && (
        <Alert severity="warning" icon={<WifiOffOutlinedIcon />} sx={{ mb: 2, borderRadius: 2 }}>
          You're offline. You can still look around. New requests and payments are saved on your phone and sent when you're back online.
        </Alert>
      )}
      {outbox.length > 0 && (
        <Alert
          severity="info"
          icon={<CloudOffOutlinedIcon />}
          sx={{ mb: 2, borderRadius: 2 }}
          action={
            online ? (
              <Button color="inherit" size="small" onClick={flushOutbox} sx={{ fontWeight: 700 }}>
                Send now
              </Button>
            ) : undefined
          }
        >
          {outbox.length === 1 ? "1 item is waiting to be sent." : `${outbox.length} items are waiting to be sent.`} {online ? "" : "It goes out automatically when you're back online."}
        </Alert>
      )}
      {online && listenError && (
        <Alert
          severity="warning"
          sx={{ mb: 2, borderRadius: 2 }}
          action={
            <Button color="inherit" size="small" onClick={() => setReloadKey((k) => k + 1)} sx={{ fontWeight: 700 }}>
              Retry
            </Button>
          }
        >
          Some of your information couldn't be loaded.
        </Alert>
      )}

      <TabErrorBoundary resetKey={activeTab}>
        {activeTab === "overview" && overview}
        {activeTab === "payments" && paymentsTab}
        {activeTab === "profile" && profileTab}
        {activeTab === "maintenance" && maintenanceTab}
      </TabErrorBoundary>

      {/* keeps the last card clear of the floating button */}
      {fabAction && <Box sx={{ height: 72 }} />}

      {fabAction && !openPaymentModal && !openRepairModal && (
        <Fab
          color="primary"
          variant="extended"
          onClick={fabAction.onClick}
          sx={{ position: "fixed", right: 16, bottom: `calc(${BOTTOM_NAV_H}px + 16px + env(safe-area-inset-bottom))`, fontWeight: 700, textTransform: "none" }}
        >
          {fabAction.icon} {fabAction.label}
        </Fab>
      )}

      {/* ===================== PAY RENT (3 steps) ===================== */}
      <Dialog
        open={openPaymentModal}
        onClose={(event, reason) => {
          // Don't throw away a half-filled form with a stray tap outside
          if (reason === "backdropClick" && payStep === 1) return;
          closePayment();
        }}
        fullScreen={isPhone}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: isPhone ? 0 : 3, bgcolor: "background.default" } }}
      >
        <DialogTitle sx={{ pb: 1.25 }}>
          <Box sx={{ ...row, justifyContent: "space-between", fontWeight: 800 }}>
            <Typography sx={{ fontWeight: 800, fontSize: "1.1rem" }}>
              {payStep === 2 ? "Payment submitted" : `Pay rent · ${currentPeriod}`}
            </Typography>
            <IconButton edge="end" aria-label="Close" onClick={closePayment} disabled={paymentSubmitting}>
              <CloseIcon />
            </IconButton>
          </Box>
          {payStep < 2 && (
            <Box sx={{ mt: 1.25 }}>
              <LinearProgress variant="determinate" value={payStep === 0 ? 50 : 100} sx={{ height: 5, borderRadius: 3, bgcolor: (t) => alpha(t.palette.text.primary, 0.08) }} />
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, display: "block", mt: 0.5 }}>
                Step {payStep + 1} of 2 · {payStep === 0 ? "Send your payment" : "Confirm the details"}
              </Typography>
            </Box>
          )}
        </DialogTitle>

        <DialogContent dividers sx={{ px: { xs: 2, sm: 3 } }}>
          {/* STEP 0: pay */}
          {payStep === 0 && (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 2.25, pt: 0.5 }}>
              <Box sx={{ p: 2, borderRadius: 2.5, bgcolor: "rgba(255, 69, 0, 0.08)" }}>
                <Typography variant="body2" color="text.secondary">
                  Amount to send
                </Typography>
                <Typography sx={{ fontFamily: '"Inter", sans-serif', fontWeight: 900, fontSize: "1.9rem", color: "primary.main", lineHeight: 1.2 }}>
                  {peso(tenantInfo.monthlyRent)}
                </Typography>
              </Box>

              {tenantInfo.paymentNote.trim() && (
                <Alert severity="info" icon={false} sx={{ borderRadius: 2, whiteSpace: "pre-line" }}>
                  {tenantInfo.paymentNote.trim()}
                </Alert>
              )}

              {payMethods.length === 0 ? (
                <Alert severity="info" sx={{ borderRadius: 2 }}>
                  Your landlord hasn't added online payment details yet. Please ask them how to pay. They can record a cash payment for you.
                </Alert>
              ) : (
                <>
                  <Box>
                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                      Payment method
                    </Typography>
                    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mt: 0.75 }}>
                      {payMethods.map((m) => (
                        <Chip
                          key={m.key}
                          label={m.label}
                          clickable
                          onClick={() => setSelectedPaymentMethod(m.key)}
                          color={activePayMethod?.key === m.key ? "primary" : "default"}
                          variant={activePayMethod?.key === m.key ? "filled" : "outlined"}
                          sx={{ fontWeight: 700, height: 40, borderRadius: 20 }}
                        />
                      ))}
                    </Box>
                  </Box>

                  {activePayMethod && (
                    <Box sx={{ textAlign: "center", p: 2, border: "1px solid", borderColor: "divider", borderRadius: 3, bgcolor: "background.paper" }}>
                      <Box sx={{ ...row, justifyContent: "center", gap: 1, mb: 1 }}>
                        <QrCode2Icon color="primary" />
                        <Typography sx={{ fontWeight: 800 }}>
                          {activePayMethod.kind === "wallet" ? `Scan with ${activePayMethod.label}` : "Scan with any bank or e-wallet app"}
                        </Typography>
                      </Box>

                      {activePayMethod.qrUrl && (
                        <>
                          <Box sx={{ display: "flex", justifyContent: "center", mb: 1.5 }}>
                            <Box
                              component="a"
                              href={activePayMethod.qrUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              aria-label="Open QR code full size"
                              sx={{ display: "block", width: "100%", maxWidth: 240 }}
                            >
                              <Box component="img" src={activePayMethod.qrUrl} alt={`${activePayMethod.label} QR code`} sx={{ display: "block", width: "100%", height: "auto", bgcolor: "#fff", borderRadius: 2, border: "1px solid", borderColor: "divider" }} />
                            </Box>
                          </Box>
                          {isPhone && (
                            <Box sx={{ textAlign: "center" }}>
                              <Button
                                size="small"
                                startIcon={<DownloadOutlinedIcon />}
                                onClick={async () => ((await saveImage(activePayMethod.qrUrl, `${activePayMethod.key}-payment-qr.png`)) ? notify("QR saved to your photos/downloads.") : notify("Couldn't save it here. Tap the QR to open it, then press and hold to save.", "warning"))}
                                sx={{ fontWeight: 700, mb: 0.5, minHeight: 40 }}
                              >
                                Save QR to my phone
                              </Button>
                              <Typography variant="caption" color="text.secondary" component="div" sx={{ mb: 1.25 }}>
                                Paying from this phone? Save the QR, then in your {activePayMethod.kind === "wallet" ? activePayMethod.label : "bank or e-wallet"} app choose <strong>Pay QR → Upload from gallery</strong>.
                              </Typography>
                            </Box>
                          )}
                        </>
                      )}

                      <Typography variant="body2" sx={{ fontWeight: 700 }}>
                        {activePayMethod.accountName}
                      </Typography>
                      {activePayMethod.kind === "wallet" && activePayMethod.accountNumber && (
                        <Box sx={{ ...row, justifyContent: "center", gap: 0.5 }}>
                          <Typography variant="body2" color="text.secondary">
                            {prettyMobile(activePayMethod.accountNumber)}
                          </Typography>
                          <IconButton size="small" aria-label="Copy number" onClick={() => copyText(activePayMethod.accountNumber, "Number copied.")}>
                            <ContentCopyIcon sx={{ fontSize: 16 }} />
                          </IconButton>
                        </Box>
                      )}
                      {activePayMethod.kind === "wallet" && !activePayMethod.qrUrl && (
                        <Typography variant="caption" color="text.secondary" component="div" sx={{ mt: 0.5 }}>
                          Send to this number in your {activePayMethod.label} app.
                        </Typography>
                      )}
                    </Box>
                  )}
                </>
              )}

              {payMethods.length > 0 && (
                <Typography variant="body2" color="text.secondary">
                  Send the payment first, then tap <strong>I've paid</strong> to enter your reference number.
                </Typography>
              )}
            </Box>
          )}

          {/* STEP 1: details */}
          {payStep === 1 && (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 2.25, pt: 0.5 }}>
              {paymentError && (
                <Alert severity="error" sx={{ borderRadius: 2 }}>
                  {paymentError}
                </Alert>
              )}

              <Box sx={{ ...row, justifyContent: "space-between", p: 1.5, borderRadius: 2.5, bgcolor: (t) => alpha(t.palette.text.primary, 0.05) }}>
                <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
                  Paid via
                </Typography>
                <Pill label={payMethodKey} />
              </Box>

              <TextField
                label="Payment amount"
                type="number"
                fullWidth
                size="small"
                value={paymentForm.amount}
                onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                onBlur={() => setPaymentTouched((t) => ({ ...t, amount: true }))}
                error={!!showPayErr("amount")}
                helperText={showPayErr("amount") || (amountNum > 0 && tenantInfo.monthlyRent > 0 && amountNum !== tenantInfo.monthlyRent ? `This is different from your monthly rent of ${peso(tenantInfo.monthlyRent)}. Your owner will review it.` : "")}
                slotProps={{ input: { startAdornment: <Typography sx={{ mr: 1 }}>₱</Typography> }, htmlInput: { min: 0, inputMode: "decimal" } }}
              />

              <TextField
                label="Payment reference number"
                fullWidth
                size="small"
                value={paymentForm.referenceNumber}
                onChange={(e) => setPaymentForm({ ...paymentForm, referenceNumber: e.target.value })}
                onBlur={() => setPaymentTouched((t) => ({ ...t, referenceNumber: true }))}
                error={!!showPayErr("referenceNumber")}
                helperText={showPayErr("referenceNumber") || "Found on your payment receipt or confirmation message."}
                placeholder="Enter the reference number from your payment"
              />

              <TextField
                label="Payment date"
                type="date"
                fullWidth
                size="small"
                value={paymentForm.paymentDate}
                onChange={(e) => setPaymentForm({ ...paymentForm, paymentDate: e.target.value })}
                onBlur={() => setPaymentTouched((t) => ({ ...t, paymentDate: true }))}
                error={!!showPayErr("paymentDate")}
                helperText={showPayErr("paymentDate")}
                slotProps={{ inputLabel: { shrink: true }, htmlInput: { max: getTodayInputValue() } }}
              />

              <TextField
                label="Remarks (optional)"
                multiline
                minRows={2}
                fullWidth
                value={paymentForm.remarks}
                onChange={(e) => setPaymentForm({ ...paymentForm, remarks: e.target.value.slice(0, 300) })}
                placeholder="Add any additional payment details"
                helperText={`${paymentForm.remarks.length}/300`}
              />

              <Box>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, display: "block", mb: 0.75 }}>
                  Proof of payment (optional)
                </Typography>
                <PhotoPicker
                  file={proofFile}
                  onChange={setProofFile}
                  onError={setProofError}
                  disabled={paymentSubmitting}
                  label="Attach a screenshot of your receipt"
                  hint="Helps your owner verify faster"
                />
                {proofError && (
                  <Typography variant="caption" color="error" sx={{ display: "block", mt: 0.5 }}>
                    {proofError}
                  </Typography>
                )}
              </Box>

              {!online && (
                <Alert severity="warning" icon={<WifiOffOutlinedIcon />} sx={{ borderRadius: 2 }}>
                  You're offline. Your details are kept, so you can submit once you're back online.
                </Alert>
              )}

              <Alert severity="warning" sx={{ borderRadius: 2 }}>
                Your payment will be recorded as <strong>Pending</strong>. The owner must verify it before it becomes <strong>Paid</strong>.
              </Alert>
            </Box>
          )}

          {/* STEP 2: done */}
          {payStep === 2 && submittedPayment && (
            <Box sx={{ textAlign: "center", py: 2 }}>
              <Box sx={{ width: 84, height: 84, borderRadius: "50%", mx: "auto", mb: 2, ...row, justifyContent: "center", bgcolor: (t) => alpha(t.palette.success.main, 0.14), animation: "kkPop .45s ease-out both" }}>
                <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#2e7d32" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12.5l4.5 4.5L19 7.5" strokeDasharray="30" style={{ animation: "kkCheck .5s ease-out .2s both" }} />
                </svg>
              </Box>
              <Typography sx={{ fontFamily: '"Inter", sans-serif', fontWeight: 900, fontSize: "1.4rem" }}>{submittedPayment.queued ? "Saved on your phone" : "Payment sent!"}</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 2.5 }}>
                {submittedPayment.queued
                  ? "You're offline. We'll send it automatically once you're back online. A proof screenshot can't be kept offline, so show it to your landlord if asked."
                  : "Your owner will verify it soon. We'll notify you once it's marked Paid."}
              </Typography>
              <Box sx={{ textAlign: "left", p: 2, borderRadius: 3, border: "1px solid", borderColor: "divider", bgcolor: "background.paper" }}>
                <Facts
                  items={[
                    { label: "Amount", value: peso(submittedPayment.amount), color: "success.main" },
                    { label: "Period", value: submittedPayment.periodMonth },
                    { label: "Method", value: submittedPayment.paymentMethod },
                    { label: "Reference", value: submittedPayment.referenceNumber },
                    { label: "Status", value: "Pending verification" },
                  ]}
                />
              </Box>
            </Box>
          )}
        </DialogContent>

        <DialogActions sx={{ px: { xs: 2, sm: 3 }, pt: 1.5, pb: { xs: "calc(12px + env(safe-area-inset-bottom, 0px))", sm: 2 }, gap: 1, "& .MuiButton-root": { minHeight: 46 } }}>
          {payStep === 0 && (
            <>
              <Button onClick={closePayment} sx={{ fontWeight: 700 }}>
                Cancel
              </Button>
              <Button variant="contained" endIcon={<ArrowForwardIcon />} onClick={goNextStep} disabled={payMethods.length === 0} sx={{ fontWeight: 700, borderRadius: 2.5, px: 3 }}>
                I've paid
              </Button>
            </>
          )}
          {payStep === 1 && (
            <>
              <Button startIcon={<ArrowBackIcon />} onClick={() => setPayStep(0)} disabled={paymentSubmitting} sx={{ fontWeight: 700 }}>
                Back
              </Button>
              <Button
                variant="contained"
                onClick={handlePaymentSubmit}
                disabled={paymentSubmitting || !online}
                startIcon={paymentSubmitting ? <CircularProgress size={18} color="inherit" /> : <PaymentIcon />}
                sx={{ fontWeight: 700, borderRadius: 2.5, px: 3 }}
              >
                {paymentSubmitting ? "Submitting..." : "Submit payment"}
              </Button>
            </>
          )}
          {payStep === 2 && (
            <>
              <Button
                onClick={() => {
                  setOpenPaymentModal(false);
                  goTab("payments");
                }}
                sx={{ fontWeight: 700 }}
              >
                View payments
              </Button>
              <Button variant="contained" onClick={() => setOpenPaymentModal(false)} sx={{ fontWeight: 700, borderRadius: 2.5, px: 3 }}>
                Done
              </Button>
            </>
          )}
        </DialogActions>
      </Dialog>

      {/* ===================== REPAIR: UPDATE / EDIT / CANCEL ===================== */}
      <Dialog
        open={Boolean(ticketDlg.mode)}
        onClose={closeTicketDlg}
        fullWidth
        maxWidth="xs"
        slotProps={{ paper: { sx: { borderRadius: 3, bgcolor: "background.default", m: 2, width: "calc(100% - 32px)", maxHeight: "calc(100% - 32px)" } } }}
      >
        <DialogTitle sx={{ ...row, justifyContent: "space-between", fontWeight: 800 }}>
          {ticketDlg.mode === "cancel" ? "Cancel this request?" : ticketDlg.mode === "edit" ? "Edit request" : "Add an update"}
          <IconButton edge="end" aria-label="Close" onClick={closeTicketDlg} disabled={ticketDlg.busy}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          {ticketDlg.error && (
            <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
              {ticketDlg.error}
            </Alert>
          )}
          {ticketDlg.mode === "cancel" && (
            <Typography variant="body2" color="text.secondary">
              "{ticketDlg.ticket?.title}" will be removed and your landlord won't see it any more. You can only cancel a request that hasn't been started.
            </Typography>
          )}
          {ticketDlg.mode === "edit" && (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 0.5 }}>
              <TextField fullWidth required label="Title" value={ticketDlg.title} onChange={(e) => setTicketDlg((d) => ({ ...d, title: e.target.value, error: "" }))} slotProps={{ htmlInput: { maxLength: 100 } }} />
              <TextField fullWidth multiline minRows={3} label="Details" value={ticketDlg.description} onChange={(e) => setTicketDlg((d) => ({ ...d, description: e.target.value }))} slotProps={{ htmlInput: { maxLength: 600 } }} />
            </Box>
          )}
          {ticketDlg.mode === "update" && (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 0.5 }}>
              <Typography variant="body2" color="text.secondary">
                Something changed, or you have more to tell about "{ticketDlg.ticket?.title}"? Your landlord is notified.
              </Typography>
              <TextField fullWidth multiline minRows={3} label="Your message" value={ticketDlg.text} onChange={(e) => setTicketDlg((d) => ({ ...d, text: e.target.value, error: "" }))} slotProps={{ htmlInput: { maxLength: 400 } }} />
              <PhotoPicker file={ticketDlg.photo} onChange={(f) => setTicketDlg((d) => ({ ...d, photo: f, error: "" }))} onError={(m) => setTicketDlg((d) => ({ ...d, photoError: m }))} disabled={ticketDlg.busy} label="Take or choose a photo" hint="Optional" />
              {ticketDlg.photoError && (
                <Typography variant="caption" color="error">
                  {ticketDlg.photoError}
                </Typography>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1, "& .MuiButton-root": { minHeight: 46 } }}>
          <Button onClick={closeTicketDlg} disabled={ticketDlg.busy} sx={{ fontWeight: 700, textTransform: "none" }}>
            {ticketDlg.mode === "cancel" ? "Keep it" : "Close"}
          </Button>
          <Button
            variant="contained"
            color={ticketDlg.mode === "cancel" ? "error" : "primary"}
            onClick={submitTicketDlg}
            disabled={ticketDlg.busy || !online}
            sx={{ fontWeight: 800, borderRadius: 2.5, px: 3, textTransform: "none" }}
          >
            {ticketDlg.busy ? "Please wait..." : ticketDlg.mode === "cancel" ? "Cancel request" : ticketDlg.mode === "edit" ? "Save changes" : "Send update"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ===================== RECEIPT ===================== */}
      <Dialog
        open={!!receipt}
        onClose={() => setReceipt(null)}
        fullWidth
        maxWidth="xs"
        sx={{ "& .MuiDialog-container": { alignItems: { xs: "flex-end", sm: "center" } } }}
        PaperProps={{ sx: { borderRadius: isPhone ? "20px 20px 0 0" : 3, bgcolor: "background.default", m: isPhone ? 0 : undefined, width: "100%", maxHeight: "90dvh" } }}
      >
        {receipt && (
          <>
            <DialogTitle sx={{ ...row, justifyContent: "space-between", fontWeight: 800 }}>
              Payment details
              <IconButton edge="end" aria-label="Close" onClick={() => setReceipt(null)}>
                <CloseIcon />
              </IconButton>
            </DialogTitle>
            <DialogContent dividers sx={{ px: { xs: 2, sm: 3 } }}>
              <Box sx={{ textAlign: "center", mb: 2 }}>
                <Typography sx={{ fontFamily: '"Inter", sans-serif', fontWeight: 900, fontSize: "2rem" }}>{peso(receipt.amount)}</Typography>
                <Pill label={receipt.status || "Pending"} tone={paymentTone(receipt.status)} />
              </Box>
              <Facts
                items={[
                  { label: "Period", value: receipt.periodMonth || "—" },
                  ...(receipt.receiptNo ? [{ label: "Receipt no.", value: receipt.receiptNo }] : []),
                  { label: "Method", value: receipt.paymentMethod || "—" },
                  { label: "Reference", value: receipt.referenceNumber || "—" },
                  { label: "Payment date", value: fmtDate(receipt.paymentDate) || "—" },
                  { label: "Submitted", value: fmtDate(receipt.createdAt) || "—" },
                  ...(receipt.remarks ? [{ label: "Remarks", value: receipt.remarks }] : []),
                  ...(receipt.rejectionReason ? [{ label: "Owner note", value: receipt.rejectionReason, color: "error.main" }] : []),
                ]}
              />
              {receipt.proofUrl && (
                <Box component="a" href={receipt.proofUrl} target="_blank" rel="noopener noreferrer" sx={{ display: "block", mt: 2 }}>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, display: "block", mb: 0.5 }}>
                    Your proof of payment
                  </Typography>
                  <Box component="img" src={receipt.proofUrl} alt="Proof of payment" loading="lazy" sx={{ width: "100%", maxHeight: 220, objectFit: "cover", borderRadius: 2, border: "1px solid", borderColor: "divider" }} />
                </Box>
              )}
            </DialogContent>
            <DialogActions sx={{ px: { xs: 2, sm: 3 }, pt: 1.5, pb: { xs: "calc(12px + env(safe-area-inset-bottom, 0px))", sm: 2 }, "& .MuiButton-root": { minHeight: 46 } }}>
              {receipt.referenceNumber && (
                <Button startIcon={<ContentCopyIcon />} onClick={() => copyText(receipt.referenceNumber, "Reference copied.")} sx={{ fontWeight: 700 }}>
                  Copy reference
                </Button>
              )}
              {receipt.receiptNo && String(receipt.status || "").toLowerCase() === "paid" && (
                <Button
                  startIcon={<ReceiptLongOutlinedIcon />}
                  onClick={() =>
                    printReceiptDoc({
                      receiptNo: receipt.receiptNo,
                      issuer: receipt.receiptIssuer,
                      tenant: receipt.tenantName || tenantInfo.name,
                      property: receipt.propertyName,
                      room: receipt.roomNumber,
                      period: receipt.periodMonth,
                      dateText: fmtDate(receipt.paymentDate) || "—",
                      method: receipt.paymentMethod,
                      amountText: peso(receipt.amount),
                      remarks: receipt.remarks,
                    })
                  }
                  sx={{ fontWeight: 700 }}
                >
                  Official receipt
                </Button>
              )}
              <Button startIcon={<IosShareOutlinedIcon />} onClick={() => sharePayment(receipt)} sx={{ fontWeight: 700 }}>
                Share
              </Button>
              <Button variant="contained" onClick={() => setReceipt(null)} sx={{ fontWeight: 700, borderRadius: 2.5 }}>
                Close
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      {/* ===================== MAINTENANCE REQUEST ===================== */}
      <Dialog
        open={openRepairModal}
        onClose={() => !repairSubmitting && setOpenRepairModal(false)}
        fullScreen={isPhone}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: isPhone ? 0 : 3, bgcolor: "background.default" } }}
      >
        <DialogTitle sx={{ ...row, justifyContent: "space-between", fontWeight: 800 }}>
          New maintenance request
          <IconButton edge="end" aria-label="Close" onClick={() => setOpenRepairModal(false)} disabled={repairSubmitting}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        <DialogContent dividers sx={{ px: { xs: 2, sm: 3 } }}>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2.25, pt: 0.5 }}>
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                What kind of issue is it?
              </Typography>
              <Box sx={{ display: "flex", flexDirection: "column", gap: 1, mt: 0.75 }}>
                {CATEGORY_OPTIONS.map((opt) => {
                  const active = repairForm.category === opt.value;
                  return (
                    <Box
                      key={opt.value}
                      component="button"
                      type="button"
                      onClick={() => setRepairForm({ ...repairForm, category: opt.value })}
                      sx={{
                        ...row,
                        gap: 1.5,
                        textAlign: "left",
                        font: "inherit",
                        color: "inherit",
                        cursor: "pointer",
                        p: 1.5,
                        borderRadius: 2.5,
                        border: "1.5px solid",
                        borderColor: active ? "primary.main" : "divider",
                        bgcolor: active ? "rgba(255, 69, 0, 0.07)" : "background.paper",
                      }}
                    >
                      <Box sx={{ width: 38, height: 38, borderRadius: "50%", flexShrink: 0, ...row, justifyContent: "center", bgcolor: active ? "primary.main" : (t) => alpha(t.palette.text.primary, 0.07), color: active ? "#fff" : "text.secondary" }}>
                        <opt.Icon fontSize="small" />
                      </Box>
                      <Box sx={{ flex: 1 }}>
                        <Typography sx={{ fontWeight: 700 }}>{opt.label}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {opt.hint}
                        </Typography>
                      </Box>
                      {active && <CheckCircleOutlinedIcon color="primary" />}
                    </Box>
                  );
                })}
              </Box>
            </Box>

            <TextField
              label="Issue summary"
              placeholder="e.g. Water leak, light bulb replacement"
              fullWidth
              size="small"
              value={repairForm.title}
              onChange={(e) => setRepairForm({ ...repairForm, title: e.target.value.slice(0, 80) })}
              error={repairTouched && !repairForm.title.trim()}
              helperText={repairTouched && !repairForm.title.trim() ? "Add a short summary." : `${repairForm.title.length}/80`}
            />

            <TextField
              label="Detailed description"
              multiline
              minRows={3}
              fullWidth
              value={repairForm.description}
              onChange={(e) => setRepairForm({ ...repairForm, description: e.target.value.slice(0, 500) })}
              helperText={`${repairForm.description.length}/500`}
            />

            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, display: "block", mb: 0.75 }}>
                Photo (optional)
              </Typography>
              <PhotoPicker file={repairPhoto} onChange={setRepairPhoto} onError={setRepairPhotoError} disabled={repairSubmitting} label="Take or choose a photo" hint="A picture helps your landlord prepare" />
              {repairPhotoError && (
                <Typography variant="caption" color="error" sx={{ display: "block", mt: 0.5 }}>
                  {repairPhotoError}
                </Typography>
              )}
            </Box>

            {!online && (
              <Alert severity="warning" icon={<WifiOffOutlinedIcon />} sx={{ borderRadius: 2 }}>
                You're offline. Connect to the internet to send this request.
              </Alert>
            )}
          </Box>
        </DialogContent>

        <DialogActions sx={{ px: { xs: 2, sm: 3 }, pt: 1.5, pb: { xs: "calc(12px + env(safe-area-inset-bottom, 0px))", sm: 2 }, gap: 1, "& .MuiButton-root": { minHeight: 46 } }}>
          <Button onClick={() => setOpenRepairModal(false)} disabled={repairSubmitting} sx={{ fontWeight: 700 }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleRequestSubmit}
            disabled={repairSubmitting || !online}
            startIcon={repairSubmitting ? <CircularProgress size={18} color="inherit" /> : null}
            sx={{ fontWeight: 700, borderRadius: 2.5, px: 3 }}
          >
            {repairSubmitting ? "Sending..." : "Submit request"}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={toast.open}
        autoHideDuration={4000}
        onClose={() => setToast((t) => ({ ...t, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        sx={{ bottom: { xs: `calc(${BOTTOM_NAV_H}px + 16px + env(safe-area-inset-bottom)) !important`, sm: undefined } }}
      >
        <Alert severity={toast.severity} variant="filled" sx={{ borderRadius: 2 }}>
          {toast.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}