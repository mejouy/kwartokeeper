// src/pages/caretaker/CaretakerDashboard.jsx
//
// One file for the whole caretaker area, designed phone-first. CaretakerLayout
// decides which tab is open (URL hash) and passes it in as `activeTab`
// ("overview" | "tenants" | "maintenance" | "payments").
// Tabs other than the overview only exist when the owner granted the matching
// permission (manageTenants / logOccupancy / handleReports / viewFinancials).

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate, useOutletContext } from "react-router-dom";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Drawer,
  Fab,
  GlobalStyles,
  IconButton,
  InputAdornment,
  LinearProgress,
  Paper,
  Skeleton,
  Snackbar,
  Switch,
  FormControlLabel,
  TextField,
  Typography,
  useMediaQuery,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import HomeWorkOutlinedIcon from "@mui/icons-material/HomeWorkOutlined";
import MeetingRoomOutlinedIcon from "@mui/icons-material/MeetingRoomOutlined";
import PeopleAltOutlinedIcon from "@mui/icons-material/PeopleAltOutlined";
import SearchIcon from "@mui/icons-material/Search";
import CloseIcon from "@mui/icons-material/Close";
import BuildOutlinedIcon from "@mui/icons-material/BuildOutlined";
import PaymentIcon from "@mui/icons-material/Payment";
import AddIcon from "@mui/icons-material/Add";
import PlaceOutlinedIcon from "@mui/icons-material/PlaceOutlined";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import FilePreviewDialog from "../../components/FilePreviewDialog";
import PolicyOutlinedIcon from "@mui/icons-material/PolicyOutlined";
import ScheduleIcon from "@mui/icons-material/Schedule";
import PhoneOutlinedIcon from "@mui/icons-material/PhoneOutlined";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import CheckCircleOutlinedIcon from "@mui/icons-material/CheckCircleOutlined";
import ErrorOutlinedIcon from "@mui/icons-material/ErrorOutlined";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import WarningAmberOutlinedIcon from "@mui/icons-material/WarningAmberOutlined";
import WifiOffOutlinedIcon from "@mui/icons-material/WifiOffOutlined";
import RefreshOutlinedIcon from "@mui/icons-material/RefreshOutlined";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import HistoryIcon from "@mui/icons-material/History";
import NotificationsActiveOutlinedIcon from "@mui/icons-material/NotificationsActiveOutlined";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import GridViewOutlinedIcon from "@mui/icons-material/GridViewOutlined";
import TouchAppOutlinedIcon from "@mui/icons-material/TouchAppOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutlined";
import AddPhotoAlternateOutlinedIcon from "@mui/icons-material/AddPhotoAlternateOutlined";
import CloudOffOutlinedIcon from "@mui/icons-material/CloudOffOutlined";
import SendOutlinedIcon from "@mui/icons-material/SendOutlined";
import PaymentsOutlinedIcon from "@mui/icons-material/PaymentsOutlined";

import { onAuthStateChanged } from "firebase/auth";
import { addDoc, collection, deleteDoc, deleteField, doc, getDoc, onSnapshot, query, serverTimestamp, setDoc, updateDoc, where, writeBatch } from "firebase/firestore";
import { auth, db } from "../../config/firebase";
import { notifyMaintenanceStatusChanged } from "../../services/notificationService";
import { uploadToCloudinary } from "../../utils/cloudinary";
import { rankMaintenanceRequests } from "../../utils/maintenancePrioritization";
import { getPropertyCoverPhotoUrl } from "../../utils/getPropertyCoverPhotoUrl";
import { normalizePayment } from "../../utils/normalizePayment";

/* ---------------------------------------------------------------------------
   Constants + small helpers
--------------------------------------------------------------------------- */
const RULES_PREVIEW = 4; // rules shown before "Show all"
const BOTTOM_NAV_H = 64; // height of the phone bottom navigation in CaretakerLayout
const row = { display: "flex", alignItems: "center" };
const cardSx = { bgcolor: "background.default", border: "1px solid", borderColor: "divider", borderRadius: 3 };

const TAB_IDS = ["overview", "tenants", "maintenance", "payments", "rooms"];
const NOTICE_DELAY_MS = 6000; // time to undo a mark before the automatic notice goes out
const CHECK_WORD = { present: "in", late: "late", out: "out" };
const SMS_URL = typeof import.meta !== "undefined" ? import.meta.env?.VITE_SMS_WORKER_URL || "" : "";
const HISTORY_NIGHTS = 14;
const STATUS_OPTIONS = ["Pending", "In Progress", "Resolved"];
const STATUS_TONE = { Pending: "warning", "In Progress": "info", Resolved: "success", Cancelled: "default" };
const TIER_TONE = { High: "error", Medium: "warning", Low: "default" };
const CHECK_OPTIONS = [
  { id: "present", label: "In", tone: "success" },
  { id: "late", label: "Late", tone: "warning" },
  { id: "out", label: "Out", tone: "error" },
];
const CURFEW_WINDOW_MIN = 420; // a curfew "night" runs for 7 hours after the curfew time
const NOTICE_TYPES = [
  { id: "info", label: "Info" },
  { id: "warning", label: "Warning" },
  { id: "error", label: "Urgent" },
];
const timeOf = (value) => {
  const ms = getTimestampMillis(value);
  return ms ? new Date(ms).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : "";
};
const DEFAULT_CASH_NOTE = "Cash payment collected by caretaker";

const peso = (n) => `₱${Number(n || 0).toLocaleString()}`;

const localDateKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const periodLabel = (d) => d.toLocaleString("en-US", { month: "long", year: "numeric" });
const normPeriod = (s) => String(s || "").trim().toLowerCase();

function getTimestampMillis(value) {
  if (!value) return 0;
  if (typeof value?.toMillis === "function") return value.toMillis();
  // "2026-10-05" (date inputs) is read as a LOCAL date, not UTC midnight
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

function timeAgo(value) {
  const ms = getTimestampMillis(value);
  if (!ms) return "";
  const mins = Math.max(0, Math.round((Date.now() - ms) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} h ago`;
  const days = Math.round(hrs / 24);
  return days < 30 ? `${days} d ago` : fmtDate(ms);
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

const payKind = (p) => {
  const k = String(p.status || "pending").toLowerCase();
  return k === "paid" ? "paid" : k === "rejected" ? "rejected" : "pending";
};
const PAY_TONE = { paid: "success", pending: "warning", rejected: "error" };
const PAY_LABEL = { paid: "Paid", pending: "Pending", rejected: "Rejected" };

const isInactiveStatus = (s) => /inactive|terminated|moved/i.test(String(s || ""));

// Strings or objects that Firestore might hold -> a one-line label
function addressText(addr, fallback = "") {
  if (!addr) return fallback;
  if (typeof addr === "string") return addr;
  return [addr.street, addr.barangay, addr.cityMunicipality, addr.province].filter(Boolean).join(", ") || fallback;
}

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
    console.error("Caretaker dashboard error:", error);
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
   Small building blocks
--------------------------------------------------------------------------- */
// Tappable summary tile (opens the matching tab)
function StatTile({ title, value, subtitle, icon, onClick, tone }) {
  return (
    <Box
      component={onClick ? "button" : "div"}
      type={onClick ? "button" : undefined}
      onClick={onClick}
      sx={{
        ...cardSx,
        p: { xs: 1.5, sm: 2 },
        textAlign: "left",
        font: "inherit",
        color: "text.primary",
        cursor: onClick ? "pointer" : "default",
        minWidth: 0,
        "&:active": onClick ? { transform: "scale(0.98)" } : undefined,
        "&:focus-visible": { outline: "2px solid", outlineColor: "primary.main", outlineOffset: 2 },
      }}
    >
      <Box sx={{ ...row, justifyContent: "space-between", gap: 1, mb: 1 }}>
        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }} noWrap>
          {title}
        </Typography>
        <Box sx={{ width: 30, height: 30, flexShrink: 0, borderRadius: 2, ...row, justifyContent: "center", bgcolor: "rgba(255, 69, 0, 0.1)", color: "primary.main" }}>{icon}</Box>
      </Box>
      <Typography sx={{ fontFamily: '"Inter", sans-serif', fontWeight: 900, fontSize: { xs: "1.5rem", sm: "1.75rem" }, lineHeight: 1.15, color: tone ? `${tone}.main` : undefined }} noWrap>
        {value}
      </Typography>
      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.25 }} noWrap>
        {subtitle}
      </Typography>
    </Box>
  );
}

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

function RoomHeader({ title, meta, action }) {
  return (
    <Box sx={{ ...row, justifyContent: "space-between", gap: 1, mb: 0.75, px: 0.5, minHeight: 34 }}>
      <Box sx={{ ...row, gap: 0.75, minWidth: 0 }}>
        <MeetingRoomOutlinedIcon sx={{ fontSize: 18, color: "text.secondary" }} />
        <Typography sx={{ fontWeight: 800 }} noWrap>
          {title}
        </Typography>
        <Typography variant="caption" color="text.secondary" noWrap>
          {meta}
        </Typography>
      </Box>
      {action}
    </Box>
  );
}

// [[room, tenants], ...] in the order the list already has
const groupByRoom = (list) => {
  const m = new Map();
  list.forEach((t) => {
    const k = t.roomNumber || "";
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(t);
  });
  return [...m.entries()];
};

// A tiny tap-confirmation on phones that support it
const buzz = () => {
  try {
    navigator.vibrate?.(12);
  } catch {
    /* not supported */
  }
};

function FilterChips({ options, value, onChange, flush }) {
  return (
    <Box sx={{ display: "flex", gap: 1, overflowX: "auto", mx: flush ? 0 : { xs: -2, sm: 0 }, px: flush ? 0 : { xs: 2, sm: 0 }, mb: flush ? 0 : { xs: 2, sm: 2.5 }, scrollbarWidth: "none", "&::-webkit-scrollbar": { display: "none" } }}>
      {options.map((f) => (
        <Chip
          key={f.id}
          label={`${f.label} · ${f.n}`}
          clickable
          onClick={() => onChange(f.id)}
          color={value === f.id ? "primary" : "default"}
          variant={value === f.id ? "filled" : "outlined"}
          sx={{ fontWeight: 700, flexShrink: 0, height: 40, borderRadius: 20 }}
        />
      ))}
    </Box>
  );
}

function SearchBox({ value, onChange, placeholder }) {
  return (
    <TextField
      fullWidth
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      slotProps={{
        htmlInput: { "aria-label": placeholder },
        input: {
          sx: { borderRadius: 3, bgcolor: "background.default" },
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon fontSize="small" />
            </InputAdornment>
          ),
          endAdornment: value ? (
            <InputAdornment position="end">
              <IconButton size="small" aria-label="Clear search" onClick={() => onChange("")}>
                <CloseIcon fontSize="small" />
              </IconButton>
            </InputAdornment>
          ) : null,
        },
      }}
    />
  );
}

// Same look as the owner's room map: a coloured tile per room
const ROOM_STATUS = {
  vacant: { fill: "rgba(202, 220, 246, 0.55)", label: "Vacant", text: "text.primary" },
  partial: { fill: "rgba(255, 69, 0, 0.45)", label: "Partially occupied", text: "text.primary" },
  full: { fill: "#ff4500", label: "Fully occupied", text: "#ffffff" },
};
const roomStatusOf = (capacity, taken) => (taken === 0 ? "vacant" : Number(capacity) > 0 && taken >= Number(capacity) ? "full" : "partial");

function RoomTile({ room, taken, selected, onClick }) {
  const status = roomStatusOf(room.capacity, taken);
  const style = ROOM_STATUS[status];
  const capacity = Number(room.capacity) || 0;
  return (
    <Box
      component="button"
      type="button"
      onClick={onClick}
      aria-label={`${room.roomName}, ${style.label}, ${taken} of ${capacity} beds`}
      aria-pressed={selected}
      sx={{
        height: 64,
        minWidth: 0,
        borderRadius: 2,
        border: "none",
        outline: selected ? "2px solid" : "none",
        outlineColor: "text.primary",
        outlineOffset: 2,
        bgcolor: style.fill,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        gap: 0.25,
        px: 0.5,
        fontFamily: "inherit",
        transition: "transform 0.12s ease",
        "&:hover": { transform: "scale(1.05)" },
        "&:focus-visible": { outline: "2px solid", outlineColor: "text.primary", outlineOffset: 2 },
      }}
    >
      <Typography noWrap sx={{ fontWeight: 800, fontSize: "0.78rem", color: style.text, lineHeight: 1.1, maxWidth: "100%" }}>
        {room.roomName}
      </Typography>
      {capacity > 0 && (
        <Typography sx={{ fontSize: "0.66rem", fontWeight: 600, color: style.text, opacity: 0.8, lineHeight: 1 }}>
          {taken}/{capacity}
        </Typography>
      )}
    </Box>
  );
}

function TenantCard({ t, rentState, showRent, onClick }) {
  return (
    <Box sx={{ ...cardSx, ...row, minWidth: 0, opacity: t.inactive ? 0.7 : 1 }}>
      <Box
        component="button"
        type="button"
        onClick={onClick}
        aria-label={`Open details for ${t.name}`}
        sx={{
          ...row,
          gap: 1.5,
          p: 1.5,
          flex: 1,
          minWidth: 0,
          textAlign: "left",
          font: "inherit",
          color: "text.primary",
          bgcolor: "transparent",
          border: 0,
          borderRadius: "inherit",
          cursor: "pointer",
          "&:active": { bgcolor: "action.hover" },
          "&:focus-visible": { outline: "2px solid", outlineColor: "primary.main", outlineOffset: -2 },
        }}
      >
        <Avatar sx={{ width: 44, height: 44, fontWeight: 800, bgcolor: "rgba(255, 69, 0, 0.12)", color: "primary.main" }}>{initials(t.name)}</Avatar>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography sx={{ fontWeight: 800, lineHeight: 1.25 }} noWrap>
            {t.name}
          </Typography>
          <Typography variant="body2" color="text.secondary" noWrap>
            {t.roomNumber ? `Room ${t.roomNumber}` : "No room yet"}
            {t.bedId ? ` · Bed ${t.bedId}` : ""}
          </Typography>
          <Box sx={{ display: "flex", gap: 0.5, mt: 0.5, flexWrap: "wrap" }}>
            {t.inactive && <Pill label={t.status} />}
            {showRent && !t.inactive && t.roomNumber && (
              <Pill label={rentState === "paid" ? "Rent paid" : rentState === "pending" ? "Rent pending" : "Unpaid"} tone={rentState === "paid" ? "success" : rentState === "pending" ? "warning" : "error"} />
            )}
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

function RequestCard({ t, busy, onStatus, compact }) {
  const tier = t.priority?.tier || "Low";
  const status = t.status || "Pending";
  return (
    <Paper elevation={0} sx={{ ...cardSx, p: 1.75, minWidth: 0 }}>
      <Box sx={{ ...row, alignItems: "flex-start", justifyContent: "space-between", gap: 1, mb: 0.5 }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontWeight: 800, lineHeight: 1.25, overflowWrap: "anywhere" }}>{t.title || "Maintenance request"}</Typography>
          <Typography variant="caption" color="text.secondary">
            {t.tenantName || "Tenant"}
            {t.roomNumber ? ` · Room ${t.roomNumber}` : ""}
            {t.createdAt ? ` · ${timeAgo(t.createdAt)}` : ""}
          </Typography>
        </Box>
        <Pill label={`${tier} priority`} tone={TIER_TONE[tier] || "default"} />
      </Box>

      {t.description && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75, overflowWrap: "anywhere", display: "-webkit-box", WebkitLineClamp: compact ? 2 : 6, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
          {t.description}
        </Typography>
      )}

      {t.photoUrl && !compact && (
        <Box component="a" href={t.photoUrl} target="_blank" rel="noopener noreferrer" sx={{ display: "block", mt: 1.25 }}>
          <Box component="img" src={t.photoUrl} alt="Photo attached to the request" loading="lazy" sx={{ display: "block", width: "100%", maxHeight: 180, objectFit: "cover", borderRadius: 2, border: "1px solid", borderColor: "divider" }} />
        </Box>
      )}

      {!compact && Array.isArray(t.followUps) && t.followUps.length > 0 && (
        <Box sx={{ mt: 1.25, p: 1.25, borderRadius: 2, bgcolor: (th) => alpha(th.palette.info.main, 0.08) }}>
          <Typography variant="caption" sx={{ fontWeight: 800, color: "info.dark" }}>
            Updates from the tenant
          </Typography>
          {t.followUps.map((f, i) => (
            <Box key={i} sx={{ mt: 0.5 }}>
              {f.text && (
                <Typography variant="body2" sx={{ overflowWrap: "anywhere", whiteSpace: "pre-wrap" }}>
                  {f.text}
                </Typography>
              )}
              {f.photoUrl && (
                <Box component="a" href={f.photoUrl} target="_blank" rel="noopener noreferrer" sx={{ display: "inline-block", mt: 0.5 }}>
                  <Box component="img" src={f.photoUrl} alt="Photo added by the tenant" loading="lazy" sx={{ display: "block", width: 88, height: 88, objectFit: "cover", borderRadius: 2, border: "1px solid", borderColor: "divider" }} />
                </Box>
              )}
              <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                {f.at ? timeAgo(f.at) : ""}
              </Typography>
            </Box>
          ))}
        </Box>
      )}

      {onStatus ? (
        <Box sx={{ display: "flex", gap: 0.75, mt: 1 }} role="group" aria-label="Request status">
          {STATUS_OPTIONS.map((opt) => {
            const current = status === opt;
            return (
              <Button
                key={opt}
                size="small"
                disabled={busy}
                aria-pressed={current}
                variant={current ? "contained" : "outlined"}
                color={current ? STATUS_TONE[opt] : "inherit"}
                onClick={() => onStatus(t, opt)}
                sx={{ flex: 1, minWidth: 0, minHeight: 40, px: 0.5, fontWeight: 700, borderRadius: 2, textTransform: "none", borderColor: current ? undefined : "divider", color: current ? undefined : "text.secondary" }}
              >
                {opt}
              </Button>
            );
          })}
        </Box>
      ) : (
        <Box sx={{ mt: 1 }}>
          <Pill label={status} tone={STATUS_TONE[status] || "default"} />
        </Box>
      )}
    </Paper>
  );
}

function CheckRow({ t, entry, past, onSet, onNotice }) {
  const status = entry?.status || "";
  const accent = status === "present" ? "success.main" : status === "late" ? "warning.main" : status === "out" ? "error.main" : "divider";
  const flagged = past && (status === "out" || status === "late");
  return (
    <Box
      sx={{
        ...cardSx,
        ...row,
        gap: 1,
        p: 1,
        pl: 1.5,
        minWidth: 0,
        borderLeft: "4px solid",
        borderLeftColor: accent,
        bgcolor: flagged ? (theme) => alpha(theme.palette[status === "out" ? "error" : "warning"].main, 0.05) : "background.default",
      }}
    >
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography sx={{ fontWeight: 800, lineHeight: 1.25 }} noWrap>
          {t.name}
        </Typography>
        <Typography variant="caption" color="text.secondary" noWrap sx={{ display: "block" }}>
          {t.bedId ? `Bed ${t.bedId}` : `Room ${t.roomNumber}`}
          {status && timeOf(entry.at) ? ` · ${timeOf(entry.at)}` : ""}
          {entry?.noticeSent ? " · notified" : ""}
        </Typography>
      </Box>
      <Box sx={{ display: "flex", gap: 0.5, flexShrink: 0 }} role="group" aria-label={`Curfew check for ${t.name}`}>
        {CHECK_OPTIONS.map((o) => {
          const current = status === o.id;
          return (
            <Button
              key={o.id}
              aria-pressed={current}
              variant={current ? "contained" : "outlined"}
              color={current ? o.tone : "inherit"}
              disableElevation
              onClick={() => onSet(t, o.id)}
              sx={{ minWidth: 0, width: 46, height: 44, px: 0, fontWeight: 800, fontSize: "0.8rem", borderRadius: 2, textTransform: "none", borderColor: current ? undefined : "divider", color: current ? undefined : "text.secondary" }}
            >
              {o.label}
            </Button>
          );
        })}
      </Box>
      <IconButton aria-label={`Send a notice to ${t.name}`} onClick={() => onNotice(t)} sx={{ width: 40, height: 40, flexShrink: 0, color: "primary.main" }}>
        <NotificationsActiveOutlinedIcon fontSize="small" />
      </IconButton>
    </Box>
  );
}

function PayRow({ p }) {
  const kind = payKind(p);
  return (
    <Box sx={{ ...cardSx, ...row, gap: 1.5, p: 1.5, minWidth: 0 }}>
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography sx={{ fontWeight: 800, lineHeight: 1.25 }} noWrap>
          {p.tenantName || "Tenant"}
        </Typography>
        <Typography variant="caption" color="text.secondary" noWrap sx={{ display: "block" }}>
          {p.periodMonth || "Period not set"} · {p.paymentMethod || "Online"}
          {fmtDate(p.paymentDate || p.createdAt) ? ` · ${fmtDate(p.paymentDate || p.createdAt, { month: "short", day: "numeric" })}` : ""}
        </Typography>
        {(p.recordedByName || p.proofUrl) && (
          <Typography variant="caption" color="text.secondary" noWrap sx={{ display: "block" }}>
            {p.recordedByName ? `Recorded by ${p.recordedByName}` : ""}
            {p.recordedByName && p.proofUrl ? " · " : ""}
            {p.proofUrl && (
              <Box component="a" href={p.proofUrl} target="_blank" rel="noopener noreferrer" sx={{ color: "primary.main", fontWeight: 700 }}>
                Receipt photo
              </Box>
            )}
          </Typography>
        )}
      </Box>
      <Box sx={{ textAlign: "right", flexShrink: 0 }}>
        <Typography sx={{ fontWeight: 800 }}>{peso(p.amount)}</Typography>
        <Pill label={PAY_LABEL[kind]} tone={PAY_TONE[kind]} />
      </Box>
    </Box>
  );
}

// Texts the same notice through the SMS worker (see sms-worker/SETUP.md). Never throws.
async function sendNoticeSms({ tenantIds, title, message, propertyId }) {
  if (!SMS_URL) return { ok: false, error: "Texting isn't set up yet." };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    const idToken = await auth.currentUser?.getIdToken();
    if (!idToken) return { ok: false, error: "You're signed out." };
    const res = await fetch(`${SMS_URL.replace(/\/+$/, "")}/notice`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
      body: JSON.stringify({ tenantIds, title, message, propertyId }),
      signal: controller.signal,
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.ok) return { ok: true, sent: data.sent || 0, skipped: data.skipped || 0, failed: data.failed || 0 };
    return { ok: false, error: data.error || "The SMS service didn't accept it." };
  } catch (err) {
    return { ok: false, error: err?.name === "AbortError" ? "It took too long." : "Couldn't reach the SMS service." };
  } finally {
    clearTimeout(timer);
  }
}

/* ---------------------------------------------------------------------------
   Page
--------------------------------------------------------------------------- */
export default function CaretakerDashboard({ activeTab: tabProp, onNavigateTab }) {
  const navigate = useNavigate();
  const location = useLocation();
  const outlet = useOutletContext();
  const theme = useTheme();
  const isPhone = useMediaQuery(theme.breakpoints.down("sm"));
  const isDesktop = useMediaQuery(theme.breakpoints.up("md"));
  const online = useOnline();
  const today = useToday();
  const dayKey = localDateKey(today);
  const currentPeriod = periodLabel(today);
  const periodKey = normPeriod(currentPeriod);

  // The tab comes from the layout (props / outlet context) or, failing that, the URL hash
  const hashTab = String(location.hash || "").replace(/^#(caretaker-)?/, "");
  const rawTab = tabProp ?? outlet?.activeTab ?? (hashTab || "overview");
  const requestedTab = rawTab === "occupancy" ? "tenants" : rawTab; // occupancy & curfew now lives with the directory
  const activeTab = TAB_IDS.includes(requestedTab) ? requestedTab : "overview";
  const goTab = (id) => {
    const go = onNavigateTab || outlet?.setActiveTab;
    if (go) go(id);
    else navigate({ hash: id === "overview" ? "" : `#${id}` });
  };

  // ---- load state
  const [loading, setLoading] = useState(true);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [previewFile, setPreviewFile] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [listenError, setListenError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [uid, setUid] = useState("");
  const [profile, setProfile] = useState({ name: "Caretaker", permissions: {}, ownerUid: "" });
  const [property, setProperty] = useState(null);
  const [userTenants, setUserTenants] = useState([]);
  const [legacyTenants, setLegacyTenants] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [payments, setPayments] = useState([]);
  const [coverFailed, setCoverFailed] = useState(false);
  const [occEntries, setOccEntries] = useState({});
  const [occMeta, setOccMeta] = useState({});
  const [occError, setOccError] = useState(false);
  const [tenantsView, setTenantsView] = useState("");
  const [checkFilter, setCheckFilter] = useState("todo");
  const [checkSearch, setCheckSearch] = useState("");
  const [ticketFilter, setTicketFilter] = useState("open");
  const [autoNotify, setAutoNotify] = useState(() => {
    try {
      return window.localStorage.getItem("kk_ct_autonotify") !== "off";
    } catch {
      return true;
    }
  });
  const [notice, setNotice] = useState({ open: false, recipients: [], title: "", message: "", type: "info", sending: false, error: "", reminder: false, sms: false });

  // ---- ui state
  const [toast, setToast] = useState({ open: false, message: "", severity: "success", undo: null });
  const notify = (message, severity = "success", undo = null) => setToast({ open: true, message, severity, undo });
  const pendingNotices = useRef({}); // tenantId -> { timer, run }: automatic notices waiting out the undo window
  const [history, setHistory] = useState({ loading: false, loaded: false, nights: [], error: false });
  const [openNight, setOpenNight] = useState("");
  const [cashProof, setCashProof] = useState(null);
  const [cashProofPreview, setCashProofPreview] = useState("");
  const [pickedRoomId, setPickedRoomId] = useState("");
  const [roomDlg, setRoomDlg] = useState({ open: false, id: "", roomName: "", floor: "1", capacity: "1", rate: "0", saving: false, error: "", confirmDelete: false });
  const [search, setSearch] = useState("");
  const [tenantFilter, setTenantFilter] = useState("active");
  const [selectedTenantId, setSelectedTenantId] = useState("");
  const [busyTicket, setBusyTicket] = useState("");
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [payFilter, setPayFilter] = useState("all");
  const [payLimit, setPayLimit] = useState(20);

  // ---- cash payment dialog
  const [cashOpen, setCashOpen] = useState(false);
  const [cash, setCash] = useState({ tenantId: "", amount: "", periodMonth: currentPeriod, paymentDate: dayKey, notes: DEFAULT_CASH_NOTE });
  const [amountTouched, setAmountTouched] = useState(false);
  const [cashErrors, setCashErrors] = useState({});
  const [cashSaving, setCashSaving] = useState(false);

  const perms = profile.permissions || {};
  const canTenants = perms.manageTenants === true;
  const canOccupancy = perms.logOccupancy === true;
  const canReports = perms.handleReports === true;
  const canFinancials = perms.viewFinancials === true;
  const canLayout = perms.modifyLayout === true;
  const canTenantsTab = canTenants || canOccupancy; // directory and/or occupancy & curfew
  const tabAllowed = { overview: true, tenants: canTenantsTab, maintenance: canReports, payments: canFinancials, rooms: canLayout };

  // ---- load the caretaker, their facility and live data.
  // Waits for Firebase to restore the session (auth.currentUser is null for a
  // moment after a reload, which must not bounce people to the login page).
  useEffect(() => {
    let cancelled = false;
    let unsubs = [];
    const stop = () => {
      unsubs.forEach((u) => u());
      unsubs = [];
    };

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      stop();
      if (!user) {
        if (!cancelled) navigate("/login", { replace: true });
        return;
      }
      try {
        const [userSnap, caretakerSnap] = await Promise.all([getDoc(doc(db, "users", user.uid)), getDoc(doc(db, "caretakers", user.uid))]);
        if (cancelled) return;
        const data = { ...(userSnap.exists() ? userSnap.data() : {}), ...(caretakerSnap.exists() ? caretakerSnap.data() : {}) };
        const granted = data.permissions || {};
        const propertyId = data.assignedPropertyId || data.propertyId || "";
        setUid(user.uid);
        setProfile({ name: data.name || data.fullName || user.displayName || "Caretaker", permissions: granted, ownerUid: data.ownerUid || data.invitedBy || "" });

        if (!propertyId) {
          setProperty(null);
          return;
        }
        const propSnap = await getDoc(doc(db, "properties", propertyId));
        if (cancelled) return;
        if (!propSnap.exists()) {
          setProperty(null);
          setLoadError("The facility assigned to this account could not be found. Please ask the owner to check the assignment.");
          return;
        }
        setProperty({ id: propSnap.id, ...propSnap.data() });

        const fail = (label) => (err) => {
          console.error(`Caretaker ${label} listener failed:`, err);
          if (!cancelled) setListenError(true);
        };
        unsubs.push(
          onSnapshot(
            query(collection(db, "users"), where("propertyId", "==", propertyId)),
            (snap) => setUserTenants(snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((t) => t.role === "tenant")),
            fail("tenants")
          )
        );
        // Older records live in "tenants"; failing to read them is not fatal
        unsubs.push(
          onSnapshot(
            query(collection(db, "tenants"), where("propertyId", "==", propertyId)),
            (snap) => setLegacyTenants(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
            (err) => console.warn("Legacy tenants unavailable:", err?.code || err)
          )
        );
        if (granted.handleReports === true) {
          unsubs.push(
            onSnapshot(
              query(collection(db, "maintenance_tickets"), where("propertyId", "==", propertyId)),
              (snap) => setTickets(snap.docs.map((d) => ({ id: d.id, ...d.data({ serverTimestamps: "estimate" }) }))),
              fail("maintenance")
            )
          );
        }
        if (granted.viewFinancials === true) {
          unsubs.push(
            onSnapshot(
              query(collection(db, "payments"), where("propertyId", "==", propertyId)),
              (snap) => setPayments(snap.docs.map((d) => normalizePayment({ id: d.id, ...d.data({ serverTimestamps: "estimate" }) }))),
              fail("payments")
            )
          );
        }
      } catch (err) {
        console.error("Failed to load caretaker dashboard:", err);
        if (!cancelled) setLoadError("We couldn't load your facility. Check your connection and try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    });

    return () => {
      cancelled = true;
      unsubscribeAuth();
      stop();
    };
  }, [navigate, reloadKey]);

  const retryLoad = () => {
    setLoading(true);
    setLoadError("");
    setListenError(false);
    setReloadKey((k) => k + 1);
  };

  // ---- derived: facility
  const rooms = useMemo(() => (Array.isArray(property?.rooms) ? property.rooms : []), [property]);
  const propertyName = property?.propertyName || property?.name || "Your facility";
  const address = addressText(property?.address, property?.fullAddress || "");
  const coverUrl = property ? getPropertyCoverPhotoUrl(property) || property.coverPhotoUrl || "" : "";
  const hasCover = Boolean(coverUrl) && !coverFailed;
  const curfewTime = property ? (property.curfew?.enabled ? property.curfew.startTime || "" : property.curfewEnabled ? property.curfewTime || "" : "") : "";
  const rules = useMemo(() => {
    const r = property?.rules;
    if (Array.isArray(r)) return r.filter((x) => typeof x === "string" && x.trim());
    if (typeof r === "string") return r.split("\n").map((x) => x.trim()).filter(Boolean);
    return [];
  }, [property]);
  const ruleFiles = Array.isArray(property?.ruleFiles) ? property.ruleFiles.filter((f) => f?.url) : [];
  const amenities = Array.isArray(property?.amenities) ? property.amenities.filter((a) => typeof a === "string" && a) : [];
  const hasHouseRules = Boolean(curfewTime) || rules.length > 0 || ruleFiles.length > 0;

  // ---- derived: tenants
  const tenants = useMemo(() => {
    const map = new Map();
    [...legacyTenants, ...userTenants].forEach((t) => {
      if (!t.id) return;
      map.set(t.id, { ...(map.get(t.id) || {}), ...t });
    });
    return [...map.values()]
      .map((t) => {
        const roomNumber = String(t.roomNumber || t.roomId || t.room || "");
        const room = rooms.find((r) => r.roomName === roomNumber || r.id === roomNumber);
        const status = t.status || "Active";
        return {
          ...t,
          name: t.name || t.fullName || "Tenant",
          roomNumber,
          bedId: t.bedId || t.bedNumber || t.bed || "",
          phone: t.contact || t.phone || t.phoneNumber || t.contactNumber || "",
          status,
          inactive: isInactiveStatus(status),
          leaseStartDate: t.leaseStartDate || t.leaseStart || t.startDate || t.moveInDate || "",
          leaseEndDate: t.leaseEndDate || t.leaseEnd || t.endDate || t.moveOutDate || "",
          rent: Number(t.monthlyRent ?? t.rentAmount ?? t.roomMonthlyRate ?? t.monthlyRate ?? t.rent ?? room?.monthlyRatePerBed ?? 0) || 0,
        };
      })
      .sort((a, b) => a.roomNumber.localeCompare(b.roomNumber, undefined, { numeric: true }) || a.name.localeCompare(b.name));
  }, [legacyTenants, userTenants, rooms]);
  const activeTenants = useMemo(() => tenants.filter((t) => !t.inactive), [tenants]);
  const rentTenants = useMemo(() => activeTenants.filter((t) => t.roomNumber), [activeTenants]);
  const selectedTenant = tenants.find((t) => t.id === selectedTenantId) || null;

  const totalRooms = rooms.length;
  const occupiedRooms = rooms.filter(
    (r) => r.status === "Occupied" || Number(r.occupiedBeds) > 0 || activeTenants.some((t) => t.roomNumber && (t.roomNumber === r.roomName || t.roomNumber === r.id))
  ).length;

  const filteredTenants = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tenants.filter((t) => {
      if (tenantFilter === "active" && t.inactive) return false;
      if (tenantFilter === "inactive" && !t.inactive) return false;
      if (!q) return true;
      return t.name.toLowerCase().includes(q) || t.roomNumber.toLowerCase().includes(q);
    });
  }, [tenants, search, tenantFilter]);

  // ---- derived: rent this month
  const rentState = useMemo(() => {
    const rank = { paid: 3, pending: 2, rejected: 1 };
    const m = {};
    payments.forEach((p) => {
      if (normPeriod(p.periodMonth) !== periodKey) return;
      const k = payKind(p);
      if (!m[p.tenantId] || rank[k] > rank[m[p.tenantId]]) m[p.tenantId] = k;
    });
    return m;
  }, [payments, periodKey]);
  const unpaidTenants = rentTenants.filter((t) => !["paid", "pending"].includes(rentState[t.id]));
  const pendingCount = rentTenants.filter((t) => rentState[t.id] === "pending").length;
  const paidCount = rentTenants.filter((t) => rentState[t.id] === "paid").length;
  const collected = useMemo(() => payments.filter((p) => normPeriod(p.periodMonth) === periodKey && payKind(p) === "paid").reduce((s, p) => s + (Number(p.amount) || 0), 0), [payments, periodKey]);

  const sortedPayments = useMemo(() => [...payments].sort((a, b) => getTimestampMillis(b.paymentDate || b.createdAt) - getTimestampMillis(a.paymentDate || a.createdAt)), [payments]);
  const payCounts = useMemo(
    () => ({ all: payments.length, paid: payments.filter((p) => payKind(p) === "paid").length, pending: payments.filter((p) => payKind(p) === "pending").length, rejected: payments.filter((p) => payKind(p) === "rejected").length }),
    [payments]
  );
  const shownPayments = payFilter === "all" ? sortedPayments : sortedPayments.filter((p) => payKind(p) === payFilter);

  // ---- derived: maintenance
  const rankedTickets = useMemo(() => rankMaintenanceRequests(tickets), [tickets]);
  const activeTickets = rankedTickets.filter((t) => !["Resolved", "Cancelled"].includes(t.status || "Pending"));
  const resolvedTickets = rankedTickets.filter((t) => ["Resolved", "Cancelled"].includes(t.status || "Pending"));
  const highTickets = activeTickets.filter((t) => t.priority?.tier === "High");
  const progressTickets = activeTickets.filter((t) => (t.status || "Pending") === "In Progress");
  const shownTickets = ticketFilter === "high" ? highTickets : ticketFilter === "progress" ? progressTickets : activeTickets;

  // ---- derived: curfew + tonight's check
  // A curfew "night" starts at the curfew time and runs past midnight, so a check
  // made at 1 AM still belongs to the evening before.
  const clock = useClock(true);
  const curfewMin = parseClock(curfewTime);
  const nowMin = clock.getHours() * 60 + clock.getMinutes();
  let nightKey = localDateKey(clock);
  let curfewPhase = "none"; // none | before | active
  let minsUntil = 0;
  if (curfewMin !== null) {
    const since = (nowMin - curfewMin + 1440) % 1440;
    if (since < CURFEW_WINDOW_MIN) {
      curfewPhase = "active";
      if (nowMin < curfewMin) nightKey = localDateKey(new Date(clock.getTime() - 86400000));
    } else {
      curfewPhase = "before";
      minsUntil = (curfewMin - nowMin + 1440) % 1440;
    }
  }
  const pastCurfew = curfewPhase === "active";
  const checkTenants = rentTenants;
  const entryOf = (t) => occEntries[t.id] || null;
  const statusOf = (t) => occEntries[t.id]?.status || "";
  const checkCounts = {
    present: checkTenants.filter((t) => statusOf(t) === "present").length,
    late: checkTenants.filter((t) => statusOf(t) === "late").length,
    out: checkTenants.filter((t) => statusOf(t) === "out").length,
  };
  const checkedCount = checkCounts.present + checkCounts.late + checkCounts.out;
  const uncheckedCount = checkTenants.length - checkedCount;
  const checkQuery = checkSearch.trim().toLowerCase();
  const shownChecks = checkTenants.filter(
    (t) =>
      (checkFilter === "all" ? true : checkFilter === "todo" ? !statusOf(t) : statusOf(t) === checkFilter) &&
      (!checkQuery || t.name.toLowerCase().includes(checkQuery) || t.roomNumber.toLowerCase().includes(checkQuery))
  );
  const minsLabel = (m) => (m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min`);
  const curfewHeadline =
    curfewPhase === "none" ? "No curfew set for this property" : curfewPhase === "active" ? `Curfew in effect since ${curfewTime}` : minsUntil <= 120 ? `Curfew in ${minsLabel(minsUntil)} (${curfewTime})` : `Curfew tonight at ${curfewTime}`;

  // Tonight's check: one document per facility per curfew night
  useEffect(() => {
    setOccEntries({});
    setOccMeta({});
    setOccError(false);
    if (!property?.id || !canOccupancy) return undefined;
    return onSnapshot(
      doc(db, "occupancy_logs", `${property.id}_${nightKey}`),
      { includeMetadataChanges: true },
      (snap) => {
        const data = snap.exists() ? snap.data({ serverTimestamps: "estimate" }) : {};
        setOccEntries(data.entries || {});
        setOccMeta({ reminderSentAt: data.reminderSentAt || null, pending: snap.metadata.hasPendingWrites });
        setOccError(false);
      },
      (err) => {
        console.warn("Occupancy log unavailable:", err?.code || err);
        setOccError(true);
      }
    );
  }, [property?.id, canOccupancy, nightKey]);

  const ownerUidValue = property?.ownerUid || profile.ownerUid || "";

  // Leaving the page shouldn't swallow an automatic notice that was waiting out its undo window
  useEffect(
    () => () => {
      Object.values(pendingNotices.current).forEach((p) => {
        clearTimeout(p.timer);
        p.run();
      });
      pendingNotices.current = {};
    },
    []
  );

  /* -------------------------------------------------------------------------
     Actions
  ------------------------------------------------------------------------- */
  const changeTicketStatus = async (t, next) => {
    const prev = t.status || "Pending";
    if (prev === next || busyTicket) return;
    if (!online) {
      notify("You're offline. Connect to the internet to update requests.", "warning");
      return;
    }
    setBusyTicket(t.id);
    try {
      await updateDoc(doc(db, "maintenance_tickets", t.id), {
        status: next,
        updatedAt: serverTimestamp(),
        updatedBy: uid,
        ...(next === "Resolved" ? { resolvedAt: serverTimestamp() } : {}),
      });
      notifyMaintenanceStatusChanged(t, next, "caretaker");
      const tenantId = t.tenantUid || t.tenantId;
      if (tenantId && property?.id) {
        const title = t.title || "your request";
        const text =
          next === "Resolved"
            ? `Your repair request "${title}" has been marked as resolved.`
            : next === "In Progress"
              ? `Work has started on your repair request "${title}".`
              : `Your repair request "${title}" is back to pending.`;
        pushNotices([{ userId: tenantId, kind: "notice", category: "maintenance", type: next === "Resolved" ? "success" : "info", title: `Repair update: ${next}`, message: text }]).catch((err) => console.warn("Repair notice failed:", err?.code || err));
      }
      notify(next === "Resolved" ? "Marked as resolved and moved to the archive." : `Marked as ${next.toLowerCase()}.`);
    } catch (err) {
      console.error("Failed to update ticket status:", err);
      notify("Couldn't update that request. Please try again.", "error");
    } finally {
      setBusyTicket("");
    }
  };

  // ---- curfew check + notices
  const pushNotices = async (items) => {
    const nowIso = new Date().toISOString();
    for (let i = 0; i < items.length; i += 400) {
      const batch = writeBatch(db);
      items.slice(i, i + 400).forEach((it) => {
        batch.set(doc(collection(db, "notifications")), {
          category: "curfew",
          ...it,
          propertyId: property.id,
          ownerId: ownerUidValue,
          createdBy: uid,
          createdByRole: "caretaker",
          senderName: profile.name,
          isRead: false,
          createdAt: nowIso,
        });
      });
      await batch.commit();
    }
  };

  const writeChecks = (entries, extra = {}) => {
    if (!property?.id) return;
    setDoc(
      doc(db, "occupancy_logs", `${property.id}_${nightKey}`),
      { propertyId: property.id, propertyName, ownerUid: ownerUidValue, date: nightKey, curfewTime: curfewTime || "", entries, updatedAt: serverTimestamp(), recordedBy: uid, recordedByName: profile.name, ...extra },
      { merge: true }
    ).catch((err) => {
      console.error("Failed to save curfew check:", err);
      notify("Couldn't save that check. Please try again.", "error");
    });
    // Each tenant also gets a private record of their own night, so they can see it without seeing anyone else's
    Object.entries(entries).forEach(([tenantId, e]) => {
      if (!e || typeof e !== "object" || !e.status) return;
      setDoc(
        doc(db, "curfew_records", `${property.id}_${nightKey}_${tenantId}`),
        { tenantId, propertyId: property.id, ownerUid: ownerUidValue, date: nightKey, curfewTime: curfewTime || "", status: e.status, name: e.name || "", roomNumber: e.roomNumber || "", at: e.at || serverTimestamp(), recordedBy: uid, recordedByName: profile.name },
        { merge: true }
      ).catch((err) => console.warn("Tenant curfew record not saved:", err?.code || err));
    });
  };

  const undoChecks = (prev) => {
    Object.keys(prev).forEach((id) => {
      const pending = pendingNotices.current[id];
      if (pending) {
        clearTimeout(pending.timer);
        delete pendingNotices.current[id];
      }
    });
    writeChecks(Object.fromEntries(Object.entries(prev).map(([id, e]) => [id, e ? { ...e, noticeSent: e.noticeSent ?? deleteField() } : deleteField()])));
    Object.entries(prev).forEach(([tenantId, e]) => {
      if (!e && property?.id) deleteDoc(doc(db, "curfew_records", `${property.id}_${nightKey}_${tenantId}`)).catch(() => {});
    });
    setToast((x) => ({ ...x, open: false }));
  };

  const setCheck = (t, status) => {
    const existing = occEntries[t.id];
    if (existing?.status === status) return;
    const entry = { name: t.name, roomNumber: t.roomNumber, status, at: serverTimestamp(), by: profile.name };
    const waiting = pendingNotices.current[t.id];
    if (waiting) {
      clearTimeout(waiting.timer);
      delete pendingNotices.current[t.id];
    }
    // Automated notices go out after a short moment so a mis-tap can still be undone
    const willNotify = autoNotify && (status === "late" || status === "out") && existing?.noticeSent !== status;
    if (willNotify) {
      const clockText = curfewTime || "curfew";
      const run = () => {
        delete pendingNotices.current[t.id];
        if (typeof navigator !== "undefined" && navigator.onLine === false) return;
        const items = [
          status === "out"
            ? { userId: t.id, kind: "notice", type: "error", title: "Out past curfew", message: `You were recorded as out past curfew (${clockText}). Please contact your caretaker as soon as you can.` }
            : { userId: t.id, kind: "notice", type: "warning", title: "Marked late for curfew", message: `You were recorded as arriving after curfew (${clockText}). Please follow the house rules.` },
        ];
        if (status === "out" && ownerUidValue) {
          items.push({ userId: ownerUidValue, kind: "curfew_alert", type: "warning", tenantId: t.id, title: `${t.name} is out past curfew`, message: `Room ${t.roomNumber} · curfew ${clockText}. Recorded by ${profile.name}.` });
        }
        pushNotices(items)
          .then(() => writeChecks({ [t.id]: { noticeSent: status } }))
          .catch((err) => console.warn("Automatic notice failed:", err?.code || err));
      };
      pendingNotices.current[t.id] = { timer: setTimeout(run, NOTICE_DELAY_MS), run };
    }
    buzz();
    writeChecks({ [t.id]: entry });
    notify(`${firstName(t.name)} marked ${CHECK_WORD[status]}${willNotify ? ". Notifying them in a moment" : ""}.`, "success", () => undoChecks({ [t.id]: existing || null }));
  };

  const markMany = (list, message) => {
    if (list.length === 0) return;
    buzz();
    const prev = Object.fromEntries(list.map((t) => [t.id, occEntries[t.id] || null]));
    writeChecks(Object.fromEntries(list.map((t) => [t.id, { name: t.name, roomNumber: t.roomNumber, status: "present", at: serverTimestamp(), by: profile.name }])));
    notify(message, "success", () => undoChecks(prev));
  };

  const markAllPresent = () => {
    const pending = checkTenants.filter((t) => !statusOf(t));
    markMany(pending, `${pending.length} ${pending.length === 1 ? "tenant" : "tenants"} marked as in.`);
  };

  const openCurfewCheck = () => {
    setTenantsView("curfew");
    goTab("tenants");
  };

  const markRoomIn = (list) => {
    const pending = list.filter((t) => statusOf(t) !== "present");
    markMany(pending, `${pending.length} marked as in.`);
  };

  const openDirectory = () => {
    setTenantsView("directory");
    goTab("tenants");
  };

  const toggleAutoNotify = (on) => {
    setAutoNotify(on);
    try {
      window.localStorage.setItem("kk_ct_autonotify", on ? "on" : "off");
    } catch {
      /* storage unavailable: the choice just lasts until reload */
    }
  };

  const openNotice = (recipients, preset = {}) =>
    setNotice({ open: true, recipients, title: preset.title || "Notice from your caretaker", message: preset.message || "", type: preset.type || "info", sending: false, error: "", reminder: Boolean(preset.reminder) });
  const reminderPreset = {
    reminder: true,
    type: "warning",
    title: "Curfew reminder",
    message: curfewTime ? `Curfew is at ${curfewTime}. Please make sure you're back at ${propertyName} before then.` : `Please be back at ${propertyName} on time tonight.`,
  };
  const remindRecipients = checkTenants.filter((t) => statusOf(t) !== "present");
  const sendNotice = async () => {
    const message = notice.message.trim();
    const title = notice.title.trim() || "Notice from your caretaker";
    if (!message) {
      setNotice((n) => ({ ...n, error: "Write a message first." }));
      return;
    }
    if (!online) {
      setNotice((n) => ({ ...n, error: "You're offline. Connect to the internet to send notices." }));
      return;
    }
    setNotice((n) => ({ ...n, sending: true, error: "" }));
    try {
      await pushNotices(notice.recipients.map((r) => ({ userId: r.id, kind: "notice", type: notice.type, title, message })));
      if (notice.reminder) writeChecks({}, { reminderSentAt: serverTimestamp() });
      const n = notice.recipients.length;
      let smsNote = "";
      if (notice.sms && SMS_URL) {
        const res = await sendNoticeSms({ tenantIds: notice.recipients.map((r) => r.id), title, message, propertyId: property.id });
        smsNote = res.ok ? ` Texts: ${res.sent} sent${res.skipped ? `, ${res.skipped} skipped (no number)` : ""}${res.failed ? `, ${res.failed} failed` : ""}.` : ` The text messages didn't go out: ${res.error}`;
      }
      setNotice((x) => ({ ...x, open: false, sending: false }));
      notify(`Notice sent to ${n} ${n === 1 ? "tenant" : "tenants"}.${smsNote}`, smsNote.includes("didn't") ? "warning" : "success");
    } catch (err) {
      console.error("Failed to send notice:", err);
      setNotice((x) => ({ ...x, sending: false, error: "Couldn't send the notice. Please try again." }));
    }
  };

  // cash payments
  const periodOptions = useMemo(() => [1, 0, -1, -2, -3, -4, -5].map((o) => periodLabel(new Date(today.getFullYear(), today.getMonth() + o, 1))), [today]);
  const cashTenants = useMemo(() => [...activeTenants].sort((a, b) => a.name.localeCompare(b.name)), [activeTenants]);
  const cashTenant = tenants.find((t) => t.id === cash.tenantId) || null;
  const cashExisting = payments.filter((p) => p.tenantId === cash.tenantId && normPeriod(p.periodMonth) === normPeriod(cash.periodMonth));
  const cashPaid = cashExisting.some((p) => payKind(p) === "paid");
  const cashPending = cashExisting.some((p) => payKind(p) === "pending");

  const openCash = (tenantId = "") => {
    const t = tenants.find((x) => x.id === tenantId);
    setCash({ tenantId, amount: t?.rent ? String(t.rent) : "", periodMonth: currentPeriod, paymentDate: dayKey, notes: DEFAULT_CASH_NOTE });
    setCashProof(null);
    setAmountTouched(false);
    setCashErrors({});
    setCashOpen(true);
  };
  useEffect(() => {
    if (!cashProof) {
      setCashProofPreview("");
      return undefined;
    }
    const url = URL.createObjectURL(cashProof);
    setCashProofPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [cashProof]);
  const pickProof = (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) return setCashErrors((er) => ({ ...er, form: "Choose a photo (JPG or PNG)." }));
    if (file.size > 10 * 1024 * 1024) return setCashErrors((er) => ({ ...er, form: "That photo is too large. Choose one under 10 MB." }));
    setCashErrors((er) => ({ ...er, form: undefined }));
    setCashProof(file);
  };
  const closeCash = () => {
    if (!cashSaving) setCashOpen(false);
  };
  const pickCashTenant = (id) => {
    const t = tenants.find((x) => x.id === id);
    setCash((c) => ({ ...c, tenantId: id, amount: !amountTouched && t?.rent ? String(t.rent) : c.amount }));
    setCashErrors((e) => ({ ...e, tenantId: undefined }));
  };
  const submitCash = (e) => {
    e?.preventDefault();
    const errs = {};
    if (!cash.tenantId) errs.tenantId = "Choose a tenant.";
    if (!(Number(cash.amount) > 0)) errs.amount = "Enter an amount above zero.";
    if (!cash.paymentDate || getTimestampMillis(cash.paymentDate) === 0) errs.paymentDate = "Choose the date you received the cash.";
    else if (cash.paymentDate > dayKey) errs.paymentDate = "The date can't be in the future.";
    setCashErrors(errs);
    if (Object.keys(errs).length === 0) saveCash();
  };
  const saveCash = async () => {
    if (cashSaving || !cashTenant || !property) return;
    if (!online) {
      notify("You're offline. Connect to the internet to record a payment.", "warning");
      return;
    }
    setCashSaving(true);
    try {
      let proofUrl = "";
      if (cashProof) {
        try {
          proofUrl = await uploadToCloudinary(cashProof);
        } catch (uploadErr) {
          console.error("Cash proof upload failed:", uploadErr);
          setCashErrors({ form: "The photo couldn't be uploaded. Try again, or remove it to save without it." });
          return;
        }
      }
      await addDoc(collection(db, "payments"), {
        tenantId: cashTenant.id,
        tenantName: cashTenant.name,
        propertyId: property.id,
        propertyName,
        roomNumber: cashTenant.roomNumber || "N/A",
        amount: Number(cash.amount),
        paymentMethod: "Cash",
        periodMonth: cash.periodMonth,
        status: "Paid",
        verificationStatus: "Approved",
        remarks: cash.notes.trim(),
        ownerUid: cashTenant.ownerUid || property.ownerUid || profile.ownerUid || "",
        paymentDate: new Date(`${cash.paymentDate}T12:00:00`),
        createdAt: serverTimestamp(),
        recordedBy: uid,
        recordedByName: profile.name,
        recordedByRole: "caretaker",
        ...(proofUrl ? { proofUrl } : {}),
      });
      pushNotices([{ userId: cashTenant.id, kind: "payment", category: "payment", type: "success", title: "Cash payment recorded", message: `Your caretaker recorded your ${peso(cash.amount)} cash payment for ${cash.periodMonth}. Thank you!` }]).catch((err) => console.warn("Cash notice failed:", err?.code || err));
      setCashOpen(false);
      notify(`Recorded ${peso(cash.amount)} from ${cashTenant.name}.`);
    } catch (err) {
      console.error("Failed to record cash payment:", err);
      setCashErrors({ form: "Couldn't record the payment. Please try again." });
    } finally {
      setCashSaving(false);
    }
  };

  const viewOptions = [canTenants && "directory", canOccupancy && "curfew", canOccupancy && "history"].filter(Boolean);
  const tenantsViewNow = viewOptions.includes(tenantsView) ? tenantsView : viewOptions[0] || "directory";

  // Past nights: one small read per night (no index needed), loaded when the history view opens
  const loadHistory = async () => {
    if (!property?.id) return;
    setHistory((h) => ({ ...h, loading: true, error: false }));
    try {
      const [y, m, d] = nightKey.split("-").map(Number);
      const keys = Array.from({ length: HISTORY_NIGHTS }, (_, i) => localDateKey(new Date(y, m - 1, d - i)));
      const snaps = await Promise.all(keys.map((k) => getDoc(doc(db, "occupancy_logs", `${property.id}_${k}`))));
      const nights = snaps
        .map((snap, i) => (snap.exists() ? { key: keys[i], ...snap.data({ serverTimestamps: "estimate" }) } : null))
        .filter(Boolean);
      setHistory({ loading: false, loaded: true, nights, error: false });
    } catch (err) {
      console.warn("Curfew history unavailable:", err?.code || err);
      setHistory((h) => ({ ...h, loading: false, error: true }));
    }
  };
  useEffect(() => {
    if (tenantsViewNow === "history" && activeTab === "tenants" && !history.loaded && !history.loading && !history.error) loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantsViewNow, activeTab, history.loaded, property?.id]);

  const roomsByFloor = useMemo(() => {
    const m = new Map();
    rooms.forEach((r, index) => {
      const f = Number(r.floor) || 1;
      if (!m.has(f)) m.set(f, []);
      m.get(f).push({ ...r, index });
    });
    return [...m.entries()].sort((a, b) => a[0] - b[0]);
  }, [rooms]);
  /* -------------------------------------------------------------------------
     Early states
  ------------------------------------------------------------------------- */
  if (loading) {
    return (
      <Box>
        <Skeleton variant="rounded" height={200} sx={{ borderRadius: 4, mb: 2 }} />
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2, 1fr)", md: "repeat(4, 1fr)" }, gap: 1.5, mb: 2 }}>
          {[0, 1, 2, 3].map((k) => (
            <Skeleton key={k} variant="rounded" height={96} sx={{ borderRadius: 3 }} />
          ))}
        </Box>
        <Skeleton variant="rounded" height={220} sx={{ borderRadius: 3 }} />
      </Box>
    );
  }

  if (loadError || !property) {
    return (
      <Paper elevation={0} sx={{ ...cardSx, borderStyle: "dashed" }}>
        <EmptyState
          icon={<ErrorOutlinedIcon sx={{ fontSize: 28, color: "primary.main" }} />}
          title={loadError ? "We couldn't open your dashboard" : "No facility assigned yet"}
          body={loadError || "Ask the property owner to assign a facility to your caretaker account."}
          action={
            <Button variant="contained" startIcon={<RefreshOutlinedIcon />} onClick={retryLoad} sx={{ mt: 2, fontWeight: 700, borderRadius: 2.5, minHeight: 46 }}>
              {loadError ? "Try again" : "Check again"}
            </Button>
          }
        />
      </Paper>
    );
  }

  const locked = (what) => (
    <Paper elevation={0} sx={{ ...cardSx, borderStyle: "dashed" }}>
      <EmptyState
        icon={<InfoOutlinedIcon sx={{ fontSize: 28, color: "primary.main" }} />}
        title="Not enabled for your account"
        body={`${what} access hasn't been turned on by the property owner.`}
        action={
          <Button variant="outlined" onClick={() => goTab("overview")} sx={{ mt: 2, fontWeight: 700, borderRadius: 2.5 }}>
            Back to overview
          </Button>
        }
      />
    </Paper>
  );

  /* -------------------------------------------------------------------------
     Overview
  ------------------------------------------------------------------------- */
  const attention = [];
  if (canOccupancy && pastCurfew && (checkCounts.out > 0 || uncheckedCount > 0)) {
    attention.push({
      key: "curfew",
      tone: checkCounts.out > 0 ? "error" : "warning",
      icon: ScheduleIcon,
      title: checkCounts.out > 0 ? `${checkCounts.out} ${checkCounts.out === 1 ? "tenant is" : "tenants are"} out past curfew` : "Curfew has started",
      body: `${uncheckedCount} of ${checkTenants.length} ${uncheckedCount === 1 ? "tenant isn't" : "tenants aren't"} checked yet.`,
      actionLabel: "Open curfew check",
      onAction: openCurfewCheck,
    });
  } else if (canOccupancy && curfewPhase === "before" && minsUntil <= 60 && uncheckedCount > 0) {
    attention.push({ key: "curfew", tone: "info", icon: ScheduleIcon, title: `Curfew in ${minsLabel(minsUntil)}`, body: "Get ready for tonight's check, or send everyone a reminder.", actionLabel: "Open curfew check", onAction: openCurfewCheck });
  }
  if (canReports && highTickets.length > 0) {
    attention.push({
      key: "urgent",
      tone: "error",
      title: highTickets.length === 1 ? "1 high-priority request" : `${highTickets.length} high-priority requests`,
      body: highTickets[0].title ? `Most urgent: ${highTickets[0].title}${highTickets[0].roomNumber ? ` (Room ${highTickets[0].roomNumber})` : ""}` : undefined,
      actionLabel: "Review",
      onAction: () => goTab("maintenance"),
    });
  }
  if (canFinancials && unpaidTenants.length > 0) {
    attention.push({
      key: "unpaid",
      tone: "warning",
      title: unpaidTenants.length === 1 ? `1 tenant hasn't paid for ${currentPeriod}` : `${unpaidTenants.length} tenants haven't paid for ${currentPeriod}`,
      actionLabel: "See who",
      onAction: () => goTab("payments"),
    });
  }
  if (listenError) {
    attention.push({ key: "listen", tone: "warning", title: "Some information couldn't be loaded", body: "Check your connection or ask the owner to review your access.", actionLabel: "Retry", onAction: retryLoad });
  }

  const quickActions = [
    canOccupancy && { key: "curfew", icon: <ScheduleIcon fontSize="small" />, label: "Curfew check", badge: pastCurfew ? checkCounts.out : 0, onClick: openCurfewCheck },
    canReports && { key: "requests", icon: <BuildOutlinedIcon fontSize="small" />, label: "Requests", badge: activeTickets.length, onClick: () => goTab("maintenance") },
    canFinancials && { key: "cash", icon: <PaymentIcon fontSize="small" />, label: "Record cash", onClick: () => openCash() },
    canTenants && { key: "tenants", icon: <PeopleAltOutlinedIcon fontSize="small" />, label: "Tenants", onClick: openDirectory },
  ].filter(Boolean);

  const overview = (
    <>
      {/* Hero: the facility's cover photo */}
      <Box
        sx={{
          position: "relative",
          overflow: "hidden",
          bgcolor: "#202020",
          color: "#fff",
          borderRadius: 4,
          p: { xs: 2, sm: 4 },
          mb: { xs: 2, sm: 3 },
          minHeight: { xs: 190, sm: 230 },
          display: "flex",
          alignItems: "flex-end",
          ...rise(0),
        }}
      >
        {hasCover ? (
          <>
            <Box component="img" src={coverUrl} alt="" onError={() => setCoverFailed(true)} sx={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
            <Box sx={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(20,20,20,0.3) 0%, rgba(20,20,20,0.88) 75%)" }} />
          </>
        ) : (
          <Box sx={{ position: "absolute", top: -140, right: -100, width: 380, height: 380, borderRadius: "50%", background: "radial-gradient(circle, rgba(255, 69, 0, 0.22), transparent 70%)", pointerEvents: "none" }} />
        )}
        <Box sx={{ position: "relative", minWidth: 0 }}>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75, mb: 1.5 }}>
            <Chip size="small" label="Caretaker" sx={{ fontWeight: 700, bgcolor: "rgba(255,255,255,0.16)", color: "#fff" }} />
            {curfewTime && <Chip size="small" icon={<ScheduleIcon />} label={curfewPhase === "active" ? "Curfew in effect" : curfewPhase === "before" && minsUntil <= 120 ? `Curfew in ${minsLabel(minsUntil)}` : `Curfew ${curfewTime}`} sx={{ fontWeight: 700, bgcolor: "rgba(255,255,255,0.16)", color: "#fff", "& .MuiChip-icon": { color: "inherit" } }} />}
          </Box>
          <Typography component="h1" sx={{ fontFamily: '"Inter", sans-serif', fontWeight: 900, color: "#fff", fontSize: { xs: "1.45rem", sm: "2.1rem" }, lineHeight: 1.15, overflowWrap: "anywhere" }}>
            {greeting()}, {firstName(profile.name)}
          </Typography>
          <Typography variant="body2" sx={{ color: "rgba(255,255,255,0.85)", mt: 0.75, overflowWrap: "anywhere" }}>
            {propertyName}
            {address ? ` · ${address}` : ""}
          </Typography>
        </Box>
      </Box>

      {attention.length > 0 && (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1.25, mb: { xs: 2, sm: 3 } }}>
          {attention.map(({ key, ...a }) => (
            <AttentionBanner key={key} {...a} />
          ))}
        </Box>
      )}

      {/* The things a caretaker does most, one thumb-tap away */}
      {quickActions.length > 0 && (
        <Box sx={{ display: "grid", gridTemplateColumns: `repeat(${quickActions.length}, minmax(0, 1fr))`, gap: { xs: 1, sm: 1.5 }, mb: { xs: 2, sm: 3 }, ...rise(1) }}>
          {quickActions.map(({ key, ...q }) => (
            <QuickAction key={key} {...q} />
          ))}
        </Box>
      )}

      {/* Where things stand (tap a tile to open it) */}
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", md: "repeat(4, minmax(0, 1fr))" }, gap: { xs: 1.25, md: 2 }, mb: { xs: 2, sm: 3 }, ...rise(1) }}>
        <StatTile title="Rooms" value={`${occupiedRooms}/${totalRooms}`} subtitle={`${Math.max(0, totalRooms - occupiedRooms)} available`} icon={<MeetingRoomOutlinedIcon fontSize="small" />} onClick={canTenantsTab ? () => goTab("tenants") : undefined} />
        <StatTile title="Residents" value={activeTenants.length} subtitle="Active tenants" icon={<PeopleAltOutlinedIcon fontSize="small" />} onClick={canTenantsTab ? () => goTab("tenants") : undefined} />
        {canFinancials && (
          <StatTile title={`${currentPeriod.split(" ")[0]} rent`} value={peso(collected)} subtitle={`${paidCount} of ${rentTenants.length} paid`} icon={<PaymentIcon fontSize="small" />} onClick={() => goTab("payments")} />
        )}
      </Box>

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "repeat(2, minmax(0, 1fr))" }, gap: { xs: 2, md: 3 }, alignItems: "start" }}>
        <Box sx={{ display: "flex", flexDirection: "column", gap: { xs: 2, md: 3 }, minWidth: 0 }}>
          <Panel title="Property" icon={<PlaceOutlinedIcon fontSize="small" />} sx={rise(2)}>
            <Typography sx={{ fontWeight: 800 }}>{propertyName}</Typography>
            {address && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                {address}
              </Typography>
            )}
            {property.propertyType && (
              <Box sx={{ mt: 1 }}>
                <Pill label={String(property.propertyType)} icon={<HomeWorkOutlinedIcon />} />
              </Box>
            )}
            {amenities.length > 0 && (
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75, mt: 1.5 }}>
                {amenities.map((a) => (
                  <Pill key={a} label={a} />
                ))}
              </Box>
            )}
            {property.emergencyPhone && (
              <Button component="a" href={`tel:${property.emergencyPhone}`} variant="outlined" color="error" fullWidth startIcon={<PhoneOutlinedIcon />} sx={{ mt: 2, fontWeight: 700, borderRadius: 2.5, minHeight: 46 }}>
                Emergency: {property.emergencyPhone}
              </Button>
            )}
          </Panel>

          {canReports && (
            <Panel
              title="Needs a look"
              icon={<BuildOutlinedIcon fontSize="small" />}
              sx={rise(4)}
              action={
                activeTickets.length > 0 && (
                  <Button size="small" endIcon={<ArrowForwardIcon />} onClick={() => goTab("maintenance")} sx={{ fontWeight: 700, minHeight: 40 }}>
                    View all
                  </Button>
                )
              }
            >
              {activeTickets.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  No open maintenance requests.
                </Typography>
              ) : (
                <Box sx={{ display: "flex", flexDirection: "column", gap: 1.25 }}>
                  {activeTickets.slice(0, 3).map((t) => (
                    <RequestCard key={t.id} t={t} compact />
                  ))}
                </Box>
              )}
            </Panel>
          )}
        </Box>

        <Panel title="House rules & curfew" icon={<PolicyOutlinedIcon fontSize="small" />} sx={rise(3)}>
          {!hasHouseRules ? (
            <Typography variant="body2" color="text.secondary">
              The owner hasn't posted house rules for this property yet.
            </Typography>
          ) : (
            <>
              {curfewTime && (
                <Box sx={{ ...row, gap: 1.25, p: 1.5, mb: 1.5, borderRadius: 2.5, bgcolor: (t) => alpha(t.palette.primary.main, 0.08) }}>
                  <ScheduleIcon color="primary" />
                  <Box>
                    <Typography sx={{ fontWeight: 800 }}>Curfew at {curfewTime}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      Residents should be back by then.
                    </Typography>
                  </Box>
                </Box>
              )}
              {rules.length > 0 && (
                <>
                  <Box component="ol" sx={{ m: 0, pl: 2.5, display: "flex", flexDirection: "column", gap: 0.9 }}>
                    {(rulesOpen ? rules : rules.slice(0, RULES_PREVIEW)).map((r, i) => (
                      <Typography component="li" variant="body2" key={`${i}-${r}`} sx={{ overflowWrap: "anywhere" }}>
                        {r}
                      </Typography>
                    ))}
                  </Box>
                  {rules.length > RULES_PREVIEW && (
                    <Button
                      size="small"
                      onClick={() => setRulesOpen((v) => !v)}
                      aria-expanded={rulesOpen}
                      endIcon={<ExpandMoreIcon sx={{ transform: rulesOpen ? "rotate(180deg)" : "none", transition: "transform .2s" }} />}
                      sx={{ mt: 1, minHeight: 40, fontWeight: 700, textTransform: "none" }}
                    >
                      {rulesOpen ? "Show fewer rules" : `Show all ${rules.length} rules`}
                    </Button>
                  )}
                </>
              )}
              {ruleFiles.length > 0 && (
                <Box sx={{ display: "flex", flexDirection: "column", gap: 0.75, mt: rules.length > 0 ? 2 : 0 }}>
                  {ruleFiles.map((f, i) => (
                    <Button key={`${i}-${f.url}`} onClick={() => setPreviewFile(f)}
                      variant="outlined" startIcon={<DescriptionOutlinedIcon />} sx={{ justifyContent: "flex-start", fontWeight: 700, borderRadius: 2.5, minHeight: 44, textTransform: "none" }}>
                      {f.name || "House rules document"}
                    </Button>
                  ))}
                </Box>
              )}
            </>
          )}
        </Panel>
        <FilePreviewDialog file={previewFile} onClose={() => setPreviewFile(null)} />
      </Box>
    </>
  );

  /* -------------------------------------------------------------------------
     Tenants
  ------------------------------------------------------------------------- */
  const directoryView = (
    <>
      {canOccupancy && (
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", md: "repeat(3, minmax(0, 1fr))" }, gap: { xs: 1.25, md: 2 }, mb: { xs: 2, sm: 3 } }}>
          <StatTile title="Total occupants" value={activeTenants.length} subtitle="Active tenants" icon={<PeopleAltOutlinedIcon fontSize="small" />} />
          <StatTile title="Rooms in use" value={`${occupiedRooms}/${totalRooms}`} subtitle={`${Math.max(0, totalRooms - occupiedRooms)} available`} icon={<MeetingRoomOutlinedIcon fontSize="small" />} />
          <Box sx={{ gridColumn: { xs: "1 / -1", md: "auto" }, minWidth: 0 }}>
            <StatTile title="Curfew" value={curfewTime || "Not set"} subtitle={curfewTime ? "Residents back by then" : "No curfew for this property"} icon={<ScheduleIcon fontSize="small" />} />
          </Box>
        </Box>
      )}
      <Box sx={{ mb: 1.5 }}>
        <SearchBox value={search} onChange={setSearch} placeholder="Search name or room" />
      </Box>
      <FilterChips
        value={tenantFilter}
        onChange={setTenantFilter}
        options={[
          { id: "active", label: "Active", n: activeTenants.length },
          { id: "inactive", label: "Inactive", n: tenants.length - activeTenants.length },
          { id: "all", label: "All", n: tenants.length },
        ]}
      />
      {filteredTenants.length === 0 ? (
        <Paper elevation={0} sx={{ ...cardSx, borderStyle: "dashed" }}>
          <EmptyState
            icon={<PeopleAltOutlinedIcon sx={{ fontSize: 28, color: "primary.main" }} />}
            title={search ? "No match" : "No tenants here"}
            body={search ? `Nobody matches "${search}".` : "Tenants registered by the owner will show up here."}
            action={
              search ? (
                <Button onClick={() => setSearch("")} sx={{ mt: 1.5, fontWeight: 700 }}>
                  Clear search
                </Button>
              ) : undefined
            }
          />
        </Paper>
      ) : (
        groupByRoom(filteredTenants).map(([room, list]) => (
          <Box key={room || "none"} sx={{ mb: 2 }}>
            <RoomHeader title={room ? `Room ${room}` : "No room yet"} meta={`${list.length} ${list.length === 1 ? "tenant" : "tenants"}`} />
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "repeat(2, minmax(0, 1fr))", xl: "repeat(3, minmax(0, 1fr))" }, gap: 1 }}>
              {list.map((t) => (
                <TenantCard key={t.id} t={t} showRent={canFinancials} rentState={rentState[t.id]} onClick={() => setSelectedTenantId(t.id)} />
              ))}
            </Box>
          </Box>
        ))
      )}
    </>
  );

  const curfewView = (
    <>
      {occError && (
        <Alert severity="warning" sx={{ mb: 2, borderRadius: 2 }}>
          Tonight's check couldn't be loaded, so saved marks may not show. Ask the owner to review your access.
        </Alert>
      )}

      {/* Where tonight stands */}
      <Paper elevation={0} sx={{ ...cardSx, p: { xs: 2, sm: 2.5 }, mb: 2, borderColor: pastCurfew && checkCounts.out > 0 ? "error.main" : "divider" }}>
        <Box sx={{ ...row, justifyContent: "space-between", gap: 1.5, mb: 1.25 }}>
          <Box sx={{ ...row, gap: 1, minWidth: 0 }}>
            <ScheduleIcon color={pastCurfew ? "primary" : "action"} fontSize="small" />
            <Typography sx={{ fontWeight: 800 }}>{curfewHeadline}</Typography>
          </Box>
          <Typography variant="body2" sx={{ fontWeight: 700, flexShrink: 0 }}>
            {checkedCount}/{checkTenants.length}
          </Typography>
        </Box>
        <LinearProgress variant="determinate" value={checkTenants.length ? (checkedCount / checkTenants.length) * 100 : 0} sx={{ height: 8, borderRadius: 4, bgcolor: (t) => alpha(t.palette.text.primary, 0.08) }} />
        <Box sx={{ display: "flex", gap: 0.75, mt: 1.5, flexWrap: "wrap" }}>
          <Pill label={`${checkCounts.present} in`} tone="success" />
          <Pill label={`${checkCounts.late} late`} tone="warning" />
          <Pill label={`${checkCounts.out} out${pastCurfew && checkCounts.out > 0 ? " past curfew" : ""}`} tone="error" />
          {uncheckedCount > 0 && <Pill label={`${uncheckedCount} to check`} />}
        </Box>
        {curfewPhase === "none" && (
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1.25 }}>
            The owner hasn't set a curfew, but you can still log who is in each night.
          </Typography>
        )}
      </Paper>

      {/* Automation + bulk actions */}
      <Paper elevation={0} sx={{ ...cardSx, p: { xs: 1.5, sm: 2 }, mb: 2 }}>
        <FormControlLabel
          control={<Switch checked={autoNotify} onChange={(e) => toggleAutoNotify(e.target.checked)} />}
          label={
            <Box>
              <Typography sx={{ fontWeight: 700, lineHeight: 1.25 }}>Notify automatically</Typography>
              <Typography variant="caption" color="text.secondary">
                Tell a tenant when they're marked late or out. The owner is alerted when someone is out.
              </Typography>
            </Box>
          }
          sx={{ alignItems: "flex-start", m: 0, width: "100%", "& .MuiSwitch-root": { mr: 1 } }}
        />
        <Box sx={{ display: "flex", gap: 1, mt: 1.5, flexWrap: "wrap" }}>
          <Button
            variant="outlined"
            startIcon={<CheckCircleOutlinedIcon />}
            disabled={uncheckedCount === 0}
            onClick={markAllPresent}
            sx={{ flex: "1 1 180px", minHeight: 46, fontWeight: 700, borderRadius: 2.5, textTransform: "none" }}
          >
            Mark the rest as in
          </Button>
          <Button
            variant="outlined"
            startIcon={<SendOutlinedIcon />}
            disabled={remindRecipients.length === 0}
            onClick={() => openNotice(remindRecipients, reminderPreset)}
            sx={{ flex: "1 1 180px", minHeight: 46, fontWeight: 700, borderRadius: 2.5, textTransform: "none" }}
          >
            Remind {remindRecipients.length} not in
          </Button>
        </Box>
        {occMeta.pending && (
          <Box sx={{ ...row, gap: 0.75, mt: 1.25, color: online ? "text.secondary" : "warning.main" }}>
            <CloudOffOutlinedIcon sx={{ fontSize: 16 }} />
            <Typography variant="caption" sx={{ fontWeight: 700 }}>
              {online ? "Saving..." : "Not saved yet. It will sync when you're back online. Keep this page open."}
            </Typography>
          </Box>
        )}
        {occMeta.reminderSentAt && (
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
            Last reminder sent at {timeOf(occMeta.reminderSentAt)}.
          </Typography>
        )}
      </Paper>

      {checkTenants.length === 0 ? (
        <Paper elevation={0} sx={{ ...cardSx, borderStyle: "dashed" }}>
          <EmptyState icon={<CheckCircleOutlinedIcon sx={{ fontSize: 28, color: "primary.main" }} />} title="No residents to check" body="Tenants with an assigned room will appear here." />
        </Paper>
      ) : (
        <>
          {/* Stays in view while you scroll through the rooms */}
          <Box
            sx={{
              position: "sticky",
              top: { xs: 56, md: 80 },
              zIndex: 2,
              bgcolor: "background.paper",
              mx: { xs: -2, sm: -3 },
              px: { xs: 2, sm: 3 },
              pt: 1.25,
              pb: 1.25,
              mb: 1.5,
              borderBottom: "1px solid",
              borderColor: "divider",
            }}
          >
            <Box sx={{ ...row, justifyContent: "space-between", mb: 0.75 }}>
              <Typography variant="caption" sx={{ fontWeight: 800 }}>
                {checkedCount} of {checkTenants.length} checked
              </Typography>
              <Typography variant="caption" color={occMeta.pending && !online ? "warning.main" : "text.secondary"} sx={{ fontWeight: occMeta.pending && !online ? 800 : undefined }}>
                {occMeta.pending && !online ? "Not saved yet · " : occMeta.pending ? "Saving · " : ""}
                {checkCounts.out} out · {checkCounts.late} late · {uncheckedCount} to go
              </Typography>
            </Box>
            <LinearProgress variant="determinate" value={(checkedCount / checkTenants.length) * 100} sx={{ height: 5, borderRadius: 3, mb: 1.25, bgcolor: (t) => alpha(t.palette.text.primary, 0.08) }} />
            <SearchBox value={checkSearch} onChange={setCheckSearch} placeholder="Find a name or room" />
            <Box sx={{ mt: 1 }}>
              <FilterChips
                flush
                value={checkFilter}
                onChange={setCheckFilter}
                options={[
                  { id: "todo", label: "To check", n: uncheckedCount },
                  { id: "out", label: "Out", n: checkCounts.out },
                  { id: "late", label: "Late", n: checkCounts.late },
                  { id: "present", label: "In", n: checkCounts.present },
                  { id: "all", label: "All", n: checkTenants.length },
                ]}
              />
            </Box>
          </Box>

          {shownChecks.length === 0 ? (
            <Paper elevation={0} sx={cardSx}>
              <EmptyState
                icon={<CheckCircleOutlinedIcon sx={{ fontSize: 28, color: "primary.main" }} />}
                title={checkQuery ? "No match" : checkFilter === "todo" ? "Everyone is checked" : "Nobody here"}
                body={checkQuery ? `Nobody matches "${checkSearch}".` : checkFilter === "todo" ? "Nice work. Switch to All to change any mark." : "No tenants match this filter."}
              />
            </Paper>
          ) : (
            // Walk the building room by room
            groupByRoom(shownChecks).map(([room, list]) => (
              <Box key={room || "none"} sx={{ mb: 2 }}>
                <RoomHeader
                  title={`Room ${room}`}
                  meta={`${list.length} ${list.length === 1 ? "tenant" : "tenants"}`}
                  action={
                    list.some((t) => statusOf(t) !== "present") && (
                      <Button size="small" onClick={() => markRoomIn(list)} sx={{ minHeight: 36, fontWeight: 800, textTransform: "none" }}>
                        All in
                      </Button>
                    )
                  }
                />
                <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "repeat(2, minmax(0, 1fr))", xl: "repeat(3, minmax(0, 1fr))" }, gap: 1 }}>
                  {list.map((t) => (
                    <CheckRow key={t.id} t={t} entry={entryOf(t)} past={pastCurfew} onSet={setCheck} onNotice={(x) => openNotice([x])} />
                  ))}
                </Box>
              </Box>
            ))
          )}
        </>
      )}
    </>
  );

  const historyView = (
    <>
      <Box sx={{ ...row, justifyContent: "flex-end", mb: 1 }}>
        <Button size="small" startIcon={<RefreshOutlinedIcon />} onClick={loadHistory} disabled={history.loading} sx={{ fontWeight: 700, textTransform: "none", minHeight: 40 }}>
          Refresh
        </Button>
      </Box>
      {history.loading && !history.loaded ? (
        <Box sx={{ display: "grid", gap: 1 }}>
          {[0, 1, 2].map((k) => (
            <Skeleton key={k} variant="rounded" height={72} sx={{ borderRadius: 3 }} />
          ))}
        </Box>
      ) : history.error ? (
        <Alert severity="warning" sx={{ borderRadius: 2 }}>
          Past nights couldn't be loaded. Check your connection and tap Refresh.
        </Alert>
      ) : history.nights.length === 0 ? (
        <Paper elevation={0} sx={{ ...cardSx, borderStyle: "dashed" }}>
          <EmptyState icon={<HistoryIcon sx={{ fontSize: 28, color: "primary.main" }} />} title="No curfew records yet" body="Nights you record in the Curfew check tab will show up here." />
        </Paper>
      ) : (
        <Box sx={{ display: "grid", gap: 1 }}>
          {history.nights.map((n) => {
            const list = Object.entries(n.entries || {}).map(([id, e]) => ({ id, ...e }));
            const count = (k) => list.filter((e) => e.status === k).length;
            const flagged = list.filter((e) => e.status === "out" || e.status === "late").sort((a, b) => String(a.roomNumber).localeCompare(String(b.roomNumber), undefined, { numeric: true }));
            const open = openNight === n.key;
            const [yy, mm, dd] = n.key.split("-").map(Number);
            return (
              <Paper key={n.key} elevation={0} sx={{ ...cardSx, overflow: "hidden", borderColor: count("out") > 0 ? "error.main" : "divider" }}>
                <Box
                  component="button"
                  type="button"
                  onClick={() => setOpenNight(open ? "" : n.key)}
                  aria-expanded={open}
                  sx={{ all: "unset", boxSizing: "border-box", width: "100%", cursor: "pointer", p: 1.5, display: "block", minHeight: 56, "&:focus-visible": { outline: "2px solid", outlineColor: "primary.main", outlineOffset: -2 } }}
                >
                  <Box sx={{ ...row, justifyContent: "space-between", gap: 1 }}>
                    <Typography sx={{ fontWeight: 800 }}>{new Date(yy, mm - 1, dd).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {n.curfewTime ? `Curfew ${n.curfewTime}` : "No curfew"}
                    </Typography>
                  </Box>
                  <Box sx={{ display: "flex", gap: 0.75, mt: 0.75, flexWrap: "wrap" }}>
                    <Pill label={`${count("present")} in`} tone="success" />
                    {count("late") > 0 && <Pill label={`${count("late")} late`} tone="warning" />}
                    {count("out") > 0 && <Pill label={`${count("out")} out`} tone="error" />}
                  </Box>
                </Box>
                {open && (
                  <Box sx={{ px: 1.5, pb: 1.5, borderTop: "1px solid", borderColor: "divider", pt: 1 }}>
                    {flagged.length === 0 ? (
                      <Typography variant="body2" color="text.secondary">
                        Everyone recorded was in on time.
                      </Typography>
                    ) : (
                      flagged.map((e) => (
                        <Box key={e.id} sx={{ ...row, justifyContent: "space-between", gap: 1, py: 0.75 }}>
                          <Box sx={{ minWidth: 0 }}>
                            <Typography sx={{ fontWeight: 700 }} noWrap>
                              {e.name || "Tenant"}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" noWrap sx={{ display: "block" }}>
                              Room {e.roomNumber || "N/A"}
                              {timeOf(e.at) ? ` · ${timeOf(e.at)}` : ""}
                              {e.noticeSent ? " · notified" : ""}
                            </Typography>
                          </Box>
                          <Pill label={e.status === "out" ? "Out" : "Late"} tone={e.status === "out" ? "error" : "warning"} />
                        </Box>
                      ))
                    )}
                    {n.recordedByName && (
                      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
                        Recorded by {n.recordedByName}
                      </Typography>
                    )}
                  </Box>
                )}
              </Paper>
            );
          })}
        </Box>
      )}
    </>
  );

  const tenantsTab = (
    <>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {tenantsViewNow === "curfew" ? "Record who is in tonight, see who is out past curfew, and send notices." : tenantsViewNow === "history" ? `Curfew records for the last ${HISTORY_NIGHTS} nights.` : "Who lives where. Tap a tenant for contact details."}
      </Typography>
      {viewOptions.length > 1 && (
        <Box sx={{ display: "flex", gap: 0.75, p: 0.5, mb: 2, borderRadius: 3, bgcolor: (t) => alpha(t.palette.text.primary, 0.06) }} role="group" aria-label="Tenants view">
          {[
            { id: "directory", label: "Directory" },
            { id: "curfew", label: "Curfew check", badge: pastCurfew ? checkCounts.out : 0 },
            { id: "history", label: "History" },
          ]
            .filter((v) => viewOptions.includes(v.id))
            .map((v) => (
              <Button
                key={v.id}
                onClick={() => setTenantsView(v.id)}
                aria-pressed={tenantsViewNow === v.id}
                variant={tenantsViewNow === v.id ? "contained" : "text"}
                color={tenantsViewNow === v.id ? "primary" : "inherit"}
                sx={{ flex: 1, minHeight: 42, px: 1, fontWeight: 800, borderRadius: 2.5, textTransform: "none", boxShadow: "none", color: tenantsViewNow === v.id ? undefined : "text.secondary" }}
              >
                {v.label}
                {v.badge > 0 && <Chip size="small" color="error" label={v.badge} sx={{ ml: 0.75, height: 20, fontWeight: 800 }} />}
              </Button>
            ))}
        </Box>
      )}
      {tenantsViewNow === "curfew" ? curfewView : tenantsViewNow === "history" ? historyView : directoryView}
    </>
  );

  /* -------------------------------------------------------------------------
     Maintenance
  ------------------------------------------------------------------------- */
  const maintenanceTab = (
    <>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Reports from residents, most urgent first. Update the status as you work on them.
      </Typography>
      {activeTickets.length > 0 && (
        <FilterChips
          value={ticketFilter}
          onChange={setTicketFilter}
          options={[
            { id: "open", label: "Open", n: activeTickets.length },
            { id: "high", label: "High priority", n: highTickets.length },
            { id: "progress", label: "In progress", n: progressTickets.length },
          ]}
        />
      )}
      {rankedTickets.length === 0 ? (
        <Paper elevation={0} sx={{ ...cardSx, borderStyle: "dashed" }}>
          <EmptyState icon={<BuildOutlinedIcon sx={{ fontSize: 28, color: "primary.main" }} />} title="No maintenance requests" body="When a resident reports a problem it will show up here." />
        </Paper>
      ) : (
        <>
          {shownTickets.length === 0 ? (
            <Paper elevation={0} sx={cardSx}>
              <EmptyState icon={<CheckCircleOutlinedIcon sx={{ fontSize: 28, color: "primary.main" }} />} title="All sorted" body={activeTickets.length === 0 ? "No open requests right now." : "Nothing in this filter."} />
            </Paper>
          ) : (
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", lg: "repeat(2, minmax(0, 1fr))" }, gap: { xs: 1.5, sm: 2 } }}>
              {shownTickets.map((t, i) => (
                <Box key={t.id} sx={{ ...rise(i), minWidth: 0 }}>
                  <RequestCard t={t} busy={busyTicket === t.id} onStatus={changeTicketStatus} />
                </Box>
              ))}
            </Box>
          )}

          {resolvedTickets.length > 0 && (
            <Box sx={{ mt: { xs: 2.5, sm: 3 } }}>
              <Button
                fullWidth
                onClick={() => setArchiveOpen((o) => !o)}
                aria-expanded={archiveOpen}
                startIcon={<HistoryIcon fontSize="small" />}
                endIcon={<ArrowForwardIcon fontSize="small" sx={{ transform: archiveOpen ? "rotate(90deg)" : "none", transition: "transform .2s" }} />}
                sx={{ ...cardSx, justifyContent: "space-between", px: 2, minHeight: 52, fontWeight: 700, color: "text.primary", textTransform: "none" }}
              >
                <Box component="span" sx={{ flex: 1, textAlign: "left", ml: 0.5 }}>
                  Archive · {resolvedTickets.length} closed
                </Box>
              </Button>
              {archiveOpen && (
                <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", lg: "repeat(2, minmax(0, 1fr))" }, gap: { xs: 1.5, sm: 2 }, mt: 1.5 }}>
                  {resolvedTickets.map((t) => (
                    <Box key={t.id} sx={{ minWidth: 0, opacity: 0.85 }}>
                      <RequestCard t={t} busy={busyTicket === t.id} onStatus={changeTicketStatus} compact />
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

  /* -------------------------------------------------------------------------
     Payments
  ------------------------------------------------------------------------- */
  const paymentsTab = (
    <>
      <Box sx={{ ...row, justifyContent: "space-between", gap: 2, mb: 2 }}>
        <Typography variant="body2" color="text.secondary">
          Rent for {currentPeriod}, and every payment on record.
        </Typography>
        {!isPhone && (
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => openCash()} sx={{ fontWeight: 700, borderRadius: 2.5, px: 2.5, flexShrink: 0, textTransform: "none" }}>
            Record cash payment
          </Button>
        )}
      </Box>

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", md: "repeat(4, minmax(0, 1fr))" }, gap: { xs: 1.25, md: 2 }, mb: { xs: 2, sm: 3 } }}>
        <StatTile title="Collected" value={peso(collected)} subtitle={currentPeriod} icon={<PaymentsOutlinedIcon fontSize="small" />} />
        <StatTile title="Paid" value={`${paidCount}/${rentTenants.length}`} subtitle="Tenants this month" icon={<CheckCircleOutlinedIcon fontSize="small" />} />
        <StatTile title="Verifying" value={pendingCount} subtitle="Waiting for owner" icon={<HistoryIcon fontSize="small" />} />
        <StatTile title="Unpaid" value={unpaidTenants.length} subtitle="Still to collect" tone={unpaidTenants.length > 0 ? "error" : undefined} icon={<WarningAmberOutlinedIcon fontSize="small" />} />
      </Box>

      <Panel title="Unpaid this month" icon={<WarningAmberOutlinedIcon fontSize="small" />} sx={{ mb: { xs: 2, sm: 3 } }}>
        {unpaidTenants.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            Everyone with a room has paid or is waiting for verification.
          </Typography>
        ) : (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1.25 }}>
            {unpaidTenants.map((t) => (
              <Box key={t.id} sx={{ ...row, gap: 1.25, p: 1.25, borderRadius: 2.5, border: "1px solid", borderColor: "divider" }}>
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography sx={{ fontWeight: 800, lineHeight: 1.25 }} noWrap>
                    {t.name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" noWrap sx={{ display: "block" }}>
                    Room {t.roomNumber}
                    {t.rent ? ` · ${peso(t.rent)}` : ""}
                    {rentState[t.id] === "rejected" ? " · last payment rejected" : ""}
                  </Typography>
                </Box>
                <Button size="small" variant="outlined" onClick={() => openCash(t.id)} sx={{ fontWeight: 700, borderRadius: 2, minHeight: 40, flexShrink: 0, textTransform: "none" }}>
                  Record cash
                </Button>
              </Box>
            ))}
          </Box>
        )}
      </Panel>

      <Typography variant="h6" sx={{ fontFamily: '"Inter", sans-serif', fontWeight: 700, fontSize: "1.05rem", mb: 1.5 }}>
        Payment history
      </Typography>
      {payments.length === 0 ? (
        <Paper elevation={0} sx={{ ...cardSx, borderStyle: "dashed" }}>
          <EmptyState icon={<PaymentIcon sx={{ fontSize: 28, color: "primary.main" }} />} title="No payments yet" body="Payments from tenants and cash you record will appear here." />
        </Paper>
      ) : (
        <>
          <FilterChips
            value={payFilter}
            onChange={(v) => {
              setPayFilter(v);
              setPayLimit(20);
            }}
            options={[
              { id: "all", label: "All", n: payCounts.all },
              { id: "paid", label: "Paid", n: payCounts.paid },
              { id: "pending", label: "Pending", n: payCounts.pending },
              { id: "rejected", label: "Rejected", n: payCounts.rejected },
            ]}
          />
          {shownPayments.length === 0 ? (
            <Paper elevation={0} sx={cardSx}>
              <EmptyState icon={<PaymentIcon sx={{ fontSize: 28, color: "primary.main" }} />} title="Nothing here" body="No payments match this filter." />
            </Paper>
          ) : (
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", lg: "repeat(2, minmax(0, 1fr))" }, gap: 1.25 }}>
              {shownPayments.slice(0, payLimit).map((p) => (
                <PayRow key={p.id} p={p} />
              ))}
            </Box>
          )}
          {shownPayments.length > payLimit && (
            <Button fullWidth onClick={() => setPayLimit((n) => n + 20)} sx={{ mt: 1.5, minHeight: 46, fontWeight: 700, textTransform: "none" }}>
              Show more ({shownPayments.length - payLimit} left)
            </Button>
          )}
        </>
      )}
    </>
  );

  /* -------------------------------------------------------------------------
     Rooms & rates (modifyLayout)
  ------------------------------------------------------------------------- */
  const occupantsOf = (room) => activeTenants.filter((t) => t.roomNumber === room.roomName || t.roomNumber === room.id).length;
  const roomBeds = rooms.reduce((n, r) => n + (Number(r.capacity) || 0), 0);

  const openRoom = (room = null) =>
    setRoomDlg({
      open: true,
      id: room?.id || "",
      roomName: room?.roomName || "",
      floor: String(room?.floor || 1),
      capacity: String(room?.capacity || 1),
      rate: String(room?.monthlyRatePerBed || 0),
      saving: false,
      error: "",
      confirmDelete: false,
    });
  const editingRoom = roomDlg.id ? rooms.find((r) => r.id === roomDlg.id) : null;
  const editingOccupants = editingRoom ? occupantsOf(editingRoom) : 0;

  const saveRooms = async (nextRooms, successMessage) => {
    setRoomDlg((d) => ({ ...d, saving: true, error: "" }));
    try {
      const patch = {
        rooms: nextRooms,
        totalRooms: nextRooms.length,
        totalBeds: nextRooms.reduce((n, r) => n + (Number(r.capacity) || 0), 0),
        totalFloors: Math.max(1, ...nextRooms.map((r) => Number(r.floor) || 1)),
        updatedAt: new Date(),
      };
      await updateDoc(doc(db, "properties", property.id), patch);
      setProperty((p) => ({ ...p, ...patch }));
      setRoomDlg((d) => ({ ...d, open: false, saving: false }));
      notify(successMessage);
    } catch (err) {
      console.error("Failed to save rooms:", err);
      setRoomDlg((d) => ({ ...d, saving: false, error: "Couldn't save. Check your connection, or ask the owner whether you have permission to edit rooms." }));
    }
  };
  const submitRoom = (e) => {
    e?.preventDefault();
    const name = roomDlg.roomName.trim();
    const floor = Math.max(1, Math.round(Number(roomDlg.floor) || 0));
    const capacity = Math.round(Number(roomDlg.capacity) || 0);
    const rate = Number(roomDlg.rate);
    if (!name) return setRoomDlg((d) => ({ ...d, error: "Give the room a name or number." }));
    if (rooms.some((r) => r.id !== roomDlg.id && String(r.roomName).trim().toLowerCase() === name.toLowerCase())) return setRoomDlg((d) => ({ ...d, error: "Another room already uses that name." }));
    if (capacity < 1) return setRoomDlg((d) => ({ ...d, error: "A room needs at least one bed." }));
    if (capacity < editingOccupants) return setRoomDlg((d) => ({ ...d, error: `${editingOccupants} ${editingOccupants === 1 ? "tenant lives" : "tenants live"} here, so it needs at least ${editingOccupants} ${editingOccupants === 1 ? "bed" : "beds"}.` }));
    if (!(rate >= 0)) return setRoomDlg((d) => ({ ...d, error: "Enter the monthly rate per bed (0 or more)." }));
    if (editingRoom) {
      saveRooms(rooms.map((r) => (r.id === roomDlg.id ? { ...r, roomName: name, floor, capacity, monthlyRatePerBed: rate } : r)), `Saved ${name}.`);
    } else {
      saveRooms([...rooms, { id: `room_${Date.now()}`, roomName: name, floor, capacity, occupiedBeds: 0, monthlyRatePerBed: rate }], `Added ${name}.`);
    }
  };
  const removeRoom = () => {
    if (!editingRoom || editingOccupants > 0) return;
    saveRooms(rooms.filter((r) => r.id !== roomDlg.id), `Removed ${editingRoom.roomName}.`);
  };

  const takenOf = (r) => occupantsOf(r);
  const bedsTaken = rooms.reduce((n, r) => n + Math.min(takenOf(r), Number(r.capacity) || 0), 0);
  const vacantRooms = rooms.filter((r) => takenOf(r) === 0).length;
  const occPct = roomBeds ? Math.round((bedsTaken / roomBeds) * 100) : 0;
  const pickedRoom = rooms.find((r) => r.id === pickedRoomId) || null;
  const pickedTenants = pickedRoom ? activeTenants.filter((t) => t.roomNumber === pickedRoom.roomName || t.roomNumber === pickedRoom.id) : [];
  const pickedStatus = pickedRoom ? roomStatusOf(pickedRoom.capacity, pickedTenants.length) : "vacant";

  const roomPanel = pickedRoom ? (
    <Box>
      <Box sx={{ ...row, justifyContent: "space-between", gap: 1, mb: 0.5 }}>
        <Typography sx={{ fontWeight: 900, fontSize: "1.3rem", minWidth: 0 }} noWrap>
          {pickedRoom.roomName}
        </Typography>
        <Pill label={ROOM_STATUS[pickedStatus].label} tone={pickedStatus === "full" ? "error" : pickedStatus === "partial" ? "warning" : "default"} />
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Floor {pickedRoom.floor || 1} · {pickedTenants.length}/{Number(pickedRoom.capacity) || 0} beds taken · {peso(pickedRoom.monthlyRatePerBed)} per bed
      </Typography>
      <Divider sx={{ mb: 1.5 }} />
      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 800 }}>
        TENANTS
      </Typography>
      {pickedTenants.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ py: 1.5 }}>
          No one is assigned to this room.
        </Typography>
      ) : (
        <Box sx={{ mt: 0.5 }}>
          {pickedTenants.map((t) => (
            <Box key={t.id} sx={{ ...row, gap: 1.25, py: 1 }}>
              <Avatar sx={{ width: 36, height: 36, fontSize: "0.85rem", fontWeight: 800, bgcolor: "rgba(255, 69, 0, 0.12)", color: "primary.main" }}>{initials(t.name)}</Avatar>
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography sx={{ fontWeight: 700, lineHeight: 1.25 }} noWrap>
                  {t.name}
                </Typography>
                <Typography variant="caption" color="text.secondary" noWrap sx={{ display: "block" }}>
                  {t.bedId ? `Bed ${t.bedId}` : "No bed assigned"}
                </Typography>
              </Box>
            </Box>
          ))}
        </Box>
      )}
      <Button fullWidth variant="contained" startIcon={<EditOutlinedIcon />} onClick={() => openRoom(pickedRoom)} sx={{ mt: 2, minHeight: 48, fontWeight: 800, borderRadius: 2.5, textTransform: "none" }}>
        Edit room and rate
      </Button>
    </Box>
  ) : null;

  const roomsTab = (
    <>
      <Box sx={{ ...row, justifyContent: "space-between", gap: 1.5, mb: 2, flexWrap: "wrap" }}>
        <Typography variant="body2" color="text.secondary" sx={{ flex: "1 1 200px" }}>
          {rooms.length} {rooms.length === 1 ? "room" : "rooms"} · {bedsTaken}/{roomBeds} beds taken · {vacantRooms} vacant
        </Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => openRoom()} sx={{ minHeight: 46, px: 2.5, fontWeight: 800, borderRadius: 2.5, textTransform: "none", flex: { xs: "1 1 100%", sm: "0 0 auto" } }}>
          Add a room
        </Button>
      </Box>
      <LinearProgress variant="determinate" value={occPct} aria-label={`${occPct}% occupied`} sx={{ height: 6, borderRadius: 3, mb: 2.5, bgcolor: (t) => alpha(t.palette.text.primary, 0.08) }} />

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "minmax(0, 7fr) minmax(0, 5fr)" }, gap: 3, alignItems: "start" }}>
        <Paper elevation={0} sx={{ ...cardSx, p: { xs: 2, sm: 3 } }}>
          <Box sx={{ ...row, gap: 1, mb: 2 }}>
            <GridViewOutlinedIcon sx={{ color: "primary.main" }} />
            <Typography sx={{ fontWeight: 800, fontSize: "1.1rem" }}>Room map</Typography>
          </Box>
          {rooms.length === 0 ? (
            <Typography color="text.secondary" sx={{ p: 3, textAlign: "center", border: "1px dashed", borderColor: "divider", borderRadius: 2 }}>
              No rooms yet. Add the first one to start assigning tenants.
            </Typography>
          ) : (
            <>
              <Box sx={{ display: "flex", flexWrap: "wrap", columnGap: 2, rowGap: 0.75, mb: 2.5 }}>
                {Object.values(ROOM_STATUS).map((st) => (
                  <Box key={st.label} sx={{ ...row, gap: 0.75 }}>
                    <Box sx={{ width: 12, height: 12, borderRadius: "4px", bgcolor: st.fill }} />
                    <Typography variant="caption" color="text.secondary">
                      {st.label}
                    </Typography>
                  </Box>
                ))}
              </Box>
              <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
                {roomsByFloor.map(([floor, list], fIdx) => (
                  <Box key={floor}>
                    {fIdx > 0 && <Divider sx={{ mb: 2.5 }} />}
                    <Typography variant="body2" sx={{ fontWeight: 700, mb: 1.25 }}>
                      Floor {floor}
                      <Typography component="span" variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
                        {" "}
                        · {list.length} {list.length === 1 ? "room" : "rooms"}
                      </Typography>
                    </Typography>
                    <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(72px, 1fr))", gap: 1.25 }}>
                      {list.map((r) => (
                        <RoomTile key={r.id || r.index} room={r} taken={takenOf(r)} selected={pickedRoomId === r.id} onClick={() => setPickedRoomId(r.id)} />
                      ))}
                    </Box>
                  </Box>
                ))}
              </Box>
            </>
          )}
        </Paper>

        {/* Desktop: side card. Phones: bottom sheet below. */}
        {isDesktop && (
          <Paper elevation={0} sx={{ ...cardSx, p: 3, position: "sticky", top: 96, minHeight: 280 }}>
            {roomPanel || (
              <Box sx={{ minHeight: 232, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center" }}>
                <Box sx={{ width: 56, height: 56, borderRadius: "50%", mb: 1.5, ...row, justifyContent: "center", bgcolor: "rgba(255, 69, 0, 0.08)" }}>
                  <TouchAppOutlinedIcon sx={{ color: "primary.main" }} />
                </Box>
                <Typography sx={{ fontWeight: 700 }}>Select a room</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  Tap any room on the map to see its tenants or change its rate.
                </Typography>
              </Box>
            )}
          </Paper>
        )}
      </Box>

      {!isDesktop && (
        <Drawer
          anchor="bottom"
          open={Boolean(pickedRoom)}
          onClose={() => setPickedRoomId("")}
          slotProps={{
            paper: {
              sx: { borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: "85dvh", p: 2.5, pb: "calc(20px + env(safe-area-inset-bottom, 0px))" },
            },
          }}
        >
          <Box sx={{ width: 40, height: 4, borderRadius: 2, bgcolor: "divider", mx: "auto", mb: 2 }} />
          {roomPanel}
        </Drawer>
      )}
    </>
  );

  const fabAction = isPhone && activeTab === "payments" && canFinancials ? { label: "Record cash", icon: <AddIcon sx={{ mr: 0.75 }} />, onClick: () => openCash() } : null;
  const navVisible = Object.values(tabAllowed).filter(Boolean).length > 1;

  const bottomOffset = navVisible ? `calc(${BOTTOM_NAV_H}px + 16px + env(safe-area-inset-bottom))` : "calc(16px + env(safe-area-inset-bottom))";
  const dialogPaper = { sx: { borderRadius: isPhone ? 0 : 3, bgcolor: "background.default" } };
  const tabBody = {
    overview,
    tenants: canTenantsTab ? tenantsTab : locked("Tenant directory"),
    maintenance: canReports ? maintenanceTab : locked("Maintenance"),
    payments: canFinancials ? paymentsTab : locked("Financials"),
    rooms: canLayout ? roomsTab : locked("Rooms & rates"),
  }[activeTab];

  return (
    <Box>
      {AnimationStyles}

      {!online && (
        <Alert severity="warning" icon={<WifiOffOutlinedIcon />} sx={{ mb: 2, borderRadius: 2 }}>
          You're offline. Curfew marks are kept and sync when you're back online (keep this page open). Requests, notices and payments need a connection.
        </Alert>
      )}
      {online && listenError && activeTab !== "overview" && (
        <Alert
          severity="warning"
          sx={{ mb: 2, borderRadius: 2 }}
          action={
            <Button color="inherit" size="small" onClick={retryLoad} sx={{ fontWeight: 700 }}>
              Retry
            </Button>
          }
        >
          Some information couldn't be loaded.
        </Alert>
      )}

      <TabErrorBoundary resetKey={activeTab}>{tabBody}</TabErrorBoundary>

      {fabAction && <Box sx={{ height: 72 }} />}
      {fabAction && !cashOpen && (
        <Fab color="primary" variant="extended" onClick={fabAction.onClick} sx={{ position: "fixed", right: 16, bottom: bottomOffset, fontWeight: 700, textTransform: "none" }}>
          {fabAction.icon} {fabAction.label}
        </Fab>
      )}

      {/* ===================== TENANT DETAILS ===================== */}
      <Dialog open={Boolean(selectedTenant)} onClose={() => setSelectedTenantId("")} fullScreen={isPhone} fullWidth maxWidth="xs" slotProps={{ paper: dialogPaper }}>
        {selectedTenant && (
          <>
            <DialogTitle sx={{ ...row, justifyContent: "space-between", fontWeight: 800 }}>
              Tenant details
              <IconButton aria-label="Close" onClick={() => setSelectedTenantId("")} edge="end">
                <CloseIcon />
              </IconButton>
            </DialogTitle>
            <DialogContent>
              <Box sx={{ textAlign: "center", pt: 1, pb: 2 }}>
                <Avatar sx={{ width: 72, height: 72, mx: "auto", mb: 1.5, fontSize: "1.5rem", fontWeight: 800, bgcolor: "rgba(255, 69, 0, 0.12)", color: "primary.main" }}>{initials(selectedTenant.name)}</Avatar>
                <Typography sx={{ fontFamily: '"Inter", sans-serif', fontWeight: 800, fontSize: "1.25rem", overflowWrap: "anywhere" }}>{selectedTenant.name}</Typography>
                <Box sx={{ display: "flex", justifyContent: "center", gap: 0.75, flexWrap: "wrap", mt: 1 }}>
                  <Pill label={selectedTenant.status} tone={selectedTenant.inactive ? "default" : "success"} />
                  {selectedTenant.roomNumber && <Pill label={`Room ${selectedTenant.roomNumber}`} icon={<HomeWorkOutlinedIcon />} />}
                </Box>
              </Box>

              {canOccupancy && !selectedTenant.inactive && (
                <Button
                  fullWidth
                  variant="outlined"
                  startIcon={<NotificationsActiveOutlinedIcon />}
                  onClick={() => {
                    const x = selectedTenant;
                    setSelectedTenantId("");
                    openNotice([x]);
                  }}
                  sx={{ mb: 1, minHeight: 46, fontWeight: 700, borderRadius: 2.5, textTransform: "none" }}
                >
                  Send an in-app notice
                </Button>
              )}
              <Facts
                items={[
                  { label: "Room", value: selectedTenant.roomNumber ? `Room ${selectedTenant.roomNumber}` : "Not assigned" },
                  ...(selectedTenant.bedId ? [{ label: "Bed", value: selectedTenant.bedId }] : []),
                  { label: "Phone", value: selectedTenant.phone || "Not provided" },
                  ...(selectedTenant.email ? [{ label: "Email", value: selectedTenant.email }] : []),
                  ...(fmtDate(selectedTenant.leaseStartDate) ? [{ label: "Lease start", value: fmtDate(selectedTenant.leaseStartDate) }] : []),
                  ...(fmtDate(selectedTenant.leaseEndDate) ? [{ label: "Lease end", value: fmtDate(selectedTenant.leaseEndDate) }] : []),
                  ...(canFinancials && selectedTenant.rent ? [{ label: "Monthly rent", value: peso(selectedTenant.rent) }] : []),
                  ...(canFinancials && !selectedTenant.inactive && selectedTenant.roomNumber
                    ? [{ label: currentPeriod.split(" ")[0], value: rentState[selectedTenant.id] === "paid" ? "Paid" : rentState[selectedTenant.id] === "pending" ? "Waiting for verification" : "Unpaid", color: rentState[selectedTenant.id] === "paid" ? "success.main" : rentState[selectedTenant.id] === "pending" ? "warning.main" : "error.main" }]
                    : []),
                ]}
              />
            </DialogContent>
            {canFinancials && !selectedTenant.inactive && selectedTenant.roomNumber && !["paid", "pending"].includes(rentState[selectedTenant.id]) && (
              <DialogActions sx={{ p: 2, pb: "calc(16px + env(safe-area-inset-bottom))" }}>
                <Button
                  fullWidth
                  variant="contained"
                  startIcon={<PaymentIcon />}
                  onClick={() => {
                    const id = selectedTenant.id;
                    setSelectedTenantId("");
                    openCash(id);
                  }}
                  sx={{ minHeight: 48, fontWeight: 800, borderRadius: 2.5, textTransform: "none" }}
                >
                  Record cash payment
                </Button>
              </DialogActions>
            )}
          </>
        )}
      </Dialog>

      {/* ===================== SEND A NOTICE ===================== */}
      <Dialog open={notice.open} onClose={() => !notice.sending && setNotice((n) => ({ ...n, open: false }))} fullScreen={isPhone} fullWidth maxWidth="sm" slotProps={{ paper: dialogPaper }}>
        <DialogTitle sx={{ ...row, justifyContent: "space-between", fontWeight: 800 }}>
          Send a notice
          <IconButton aria-label="Close" onClick={() => setNotice((n) => ({ ...n, open: false }))} disabled={notice.sending} edge="end">
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent>
          {notice.error && (
            <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
              {notice.error}
            </Alert>
          )}
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
            TO
          </Typography>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75, mt: 0.5, mb: 2 }}>
            {notice.recipients.slice(0, 4).map((r) => (
              <Pill key={r.id} label={`${r.name}${r.roomNumber ? ` · ${r.roomNumber}` : ""}`} />
            ))}
            {notice.recipients.length > 4 && <Pill label={`+${notice.recipients.length - 4} more`} />}
          </Box>

          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
            QUICK MESSAGES
          </Typography>
          <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap", mt: 0.5, mb: 2 }}>
            {[
              { label: "Curfew reminder", ...reminderPreset, reminder: notice.reminder },
              { label: "See the caretaker", title: "Please see the caretaker", type: "info", message: "Please drop by the caretaker when you have a moment." },
              { label: "Past curfew", title: "Out past curfew", type: "error", message: `You're recorded as out past curfew${curfewTime ? ` (${curfewTime})` : ""}. Please contact your caretaker as soon as you can.` },
            ].map((q) => (
              <Chip key={q.label} label={q.label} clickable variant="outlined" onClick={() => setNotice((n) => ({ ...n, title: q.title, message: q.message, type: q.type }))} sx={{ fontWeight: 700, height: 36, borderRadius: 18 }} />
            ))}
          </Box>

          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <TextField fullWidth label="Title" value={notice.title} onChange={(e) => setNotice((n) => ({ ...n, title: e.target.value }))} slotProps={{ htmlInput: { maxLength: 80 } }} />
            <TextField
              fullWidth
              required
              multiline
              minRows={3}
              label="Message"
              value={notice.message}
              onChange={(e) => setNotice((n) => ({ ...n, message: e.target.value, error: "" }))}
              helperText={`${notice.message.length}/300`}
              slotProps={{ htmlInput: { maxLength: 300 } }}
            />
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                IMPORTANCE
              </Typography>
              <Box sx={{ display: "flex", gap: 0.75, mt: 0.5 }}>
                {NOTICE_TYPES.map((o) => (
                  <Chip key={o.id} label={o.label} clickable onClick={() => setNotice((n) => ({ ...n, type: o.id }))} color={notice.type === o.id ? (o.id === "info" ? "primary" : o.id) : "default"} variant={notice.type === o.id ? "filled" : "outlined"} sx={{ fontWeight: 700, height: 36, borderRadius: 18 }} />
                ))}
              </Box>
            </Box>
            {SMS_URL && (
              <FormControlLabel
                control={<Switch checked={notice.sms} onChange={(e) => setNotice((n) => ({ ...n, sms: e.target.checked }))} />}
                label={
                  <Box>
                    <Typography sx={{ fontWeight: 700, lineHeight: 1.25 }}>Also send as a text message</Typography>
                    <Typography variant="caption" color="text.secondary">
                      Reaches tenants who aren't using the app. Tenants without a number are skipped.
                    </Typography>
                  </Box>
                }
                sx={{ alignItems: "flex-start", m: 0, "& .MuiSwitch-root": { mr: 1 } }}
              />
            )}
            <Typography variant="caption" color="text.secondary">
              Tenants see this in their Announcements and notification bell.
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2, pb: "calc(16px + env(safe-area-inset-bottom))", gap: 1 }}>
          <Button onClick={() => setNotice((n) => ({ ...n, open: false }))} disabled={notice.sending} sx={{ minHeight: 46, fontWeight: 700, textTransform: "none" }}>
            Cancel
          </Button>
          <Button variant="contained" startIcon={<SendOutlinedIcon />} onClick={sendNotice} disabled={notice.sending || !notice.recipients.length} sx={{ minHeight: 46, fontWeight: 800, borderRadius: 2.5, px: 3, textTransform: "none" }}>
            {notice.sending ? "Sending..." : `Send to ${notice.recipients.length}`}
          </Button>
        </DialogActions>
      </Dialog>

      {/* ===================== RECORD CASH PAYMENT ===================== */}
      <Dialog open={cashOpen} onClose={closeCash} fullScreen={isPhone} fullWidth maxWidth="sm" slotProps={{ paper: dialogPaper }}>
        <DialogTitle sx={{ ...row, justifyContent: "space-between", fontWeight: 800 }}>
          Record cash payment
          <IconButton aria-label="Close" onClick={closeCash} disabled={cashSaving} edge="end">
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <Box component="form" onSubmit={submitCash} noValidate sx={{ display: "contents" }}>
          <DialogContent>
            {cashErrors.form && (
              <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
                {cashErrors.form}
              </Alert>
            )}
            {!online && (
              <Alert severity="warning" sx={{ mb: 2, borderRadius: 2 }}>
                You're offline. You can fill this in, but it can't be saved until you reconnect.
              </Alert>
            )}

            {(
              <Box sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 0.5 }}>
                <TextField
                  select
                  fullWidth
                  required
                  label="Tenant"
                  value={cash.tenantId}
                  onChange={(e) => pickCashTenant(e.target.value)}
                  error={Boolean(cashErrors.tenantId)}
                  helperText={cashErrors.tenantId}
                  slotProps={{ select: { native: true }, inputLabel: { shrink: true } }}
                >
                  <option value="">Choose a tenant</option>
                  {cashTenants.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                      {t.roomNumber ? ` (Room ${t.roomNumber})` : ""}
                    </option>
                  ))}
                </TextField>

                {cashPaid && (
                  <Alert severity="warning" sx={{ borderRadius: 2 }}>
                    {cashTenant?.name || "This tenant"} already has a paid record for {cash.periodMonth}. Double-check before saving another.
                  </Alert>
                )}
                {!cashPaid && cashPending && (
                  <Alert severity="warning" sx={{ borderRadius: 2 }}>
                    {cashTenant?.name || "This tenant"} already sent a payment for {cash.periodMonth} that's waiting for verification. Check with the owner first so it isn't counted twice.
                  </Alert>
                )}

                <TextField
                  fullWidth
                  required
                  label="Amount (₱)"
                  type="number"
                  value={cash.amount}
                  onChange={(e) => {
                    setAmountTouched(true);
                    setCash((c) => ({ ...c, amount: e.target.value }));
                    setCashErrors((er) => ({ ...er, amount: undefined }));
                  }}
                  error={Boolean(cashErrors.amount)}
                  helperText={cashErrors.amount || (cashTenant?.rent ? `Room rate: ${peso(cashTenant.rent)}` : undefined)}
                  slotProps={{ htmlInput: { inputMode: "decimal", min: 0, step: "any" } }}
                />

                <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "repeat(2, minmax(0, 1fr))" }, gap: 2 }}>
                  <TextField select fullWidth label="Rent for" value={cash.periodMonth} onChange={(e) => setCash((c) => ({ ...c, periodMonth: e.target.value }))} slotProps={{ select: { native: true }, inputLabel: { shrink: true } }}>
                    {periodOptions.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </TextField>
                  <TextField
                    fullWidth
                    label="Date received"
                    type="date"
                    value={cash.paymentDate}
                    onChange={(e) => {
                      setCash((c) => ({ ...c, paymentDate: e.target.value }));
                      setCashErrors((er) => ({ ...er, paymentDate: undefined }));
                    }}
                    error={Boolean(cashErrors.paymentDate)}
                    helperText={cashErrors.paymentDate}
                    slotProps={{ inputLabel: { shrink: true }, htmlInput: { max: dayKey } }}
                  />
                </Box>

                <TextField fullWidth label="Notes (optional)" multiline minRows={2} value={cash.notes} onChange={(e) => setCash((c) => ({ ...c, notes: e.target.value }))} />

                <Box>
                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                    PHOTO OF THE RECEIPT OR CASH (OPTIONAL)
                  </Typography>
                  {cashProofPreview ? (
                    <Box sx={{ ...row, gap: 1.5, mt: 0.75 }}>
                      <Box component="img" src={cashProofPreview} alt="Selected photo" sx={{ width: 72, height: 72, borderRadius: 2, objectFit: "cover", border: "1px solid", borderColor: "divider" }} />
                      <Button color="inherit" onClick={() => setCashProof(null)} disabled={cashSaving} sx={{ fontWeight: 700, textTransform: "none", minHeight: 44 }}>
                        Remove
                      </Button>
                    </Box>
                  ) : (
                    <Button component="label" variant="outlined" startIcon={<AddPhotoAlternateOutlinedIcon />} disabled={cashSaving} sx={{ mt: 0.75, display: "flex", minHeight: 48, borderRadius: 2.5, fontWeight: 700, textTransform: "none" }}>
                      Take or choose a photo
                      <input hidden type="file" accept="image/*" onChange={pickProof} />
                    </Button>
                  )}
                </Box>
              </Box>
            )}
          </DialogContent>
          <DialogActions sx={{ p: 2, pb: "calc(16px + env(safe-area-inset-bottom))", gap: 1 }}>
            <Button onClick={closeCash} disabled={cashSaving} sx={{ minHeight: 46, fontWeight: 700, textTransform: "none" }}>
              Cancel
            </Button>
            <Button type="submit" variant="contained" disabled={cashSaving || !online} sx={{ minHeight: 46, fontWeight: 800, borderRadius: 2.5, px: 3, textTransform: "none" }}>
              {cashSaving ? "Saving..." : "Save cash payment"}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

      {/* ===================== ROOM EDITOR ===================== */}
      <Dialog open={roomDlg.open} onClose={() => !roomDlg.saving && setRoomDlg((d) => ({ ...d, open: false }))} fullWidth maxWidth="xs" slotProps={{ paper: { sx: { borderRadius: 3, bgcolor: "background.default", m: 2, width: "calc(100% - 32px)", maxHeight: "calc(100% - 32px)" } } }}>
        <DialogTitle sx={{ ...row, justifyContent: "space-between", fontWeight: 800 }}>
          {editingRoom ? `Edit ${editingRoom.roomName}` : "Add a room"}
          <IconButton aria-label="Close" onClick={() => setRoomDlg((d) => ({ ...d, open: false }))} disabled={roomDlg.saving} edge="end">
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <Box component="form" onSubmit={submitRoom} noValidate sx={{ display: "contents" }}>
          <DialogContent>
            {roomDlg.error && (
              <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
                {roomDlg.error}
              </Alert>
            )}
            <Box sx={{ display: "flex", flexDirection: "column", gap: 2, pt: 0.5 }}>
              <TextField
                fullWidth
                required
                label="Room name or number"
                value={roomDlg.roomName}
                onChange={(e) => setRoomDlg((d) => ({ ...d, roomName: e.target.value, error: "" }))}
                disabled={editingOccupants > 0}
                helperText={editingOccupants > 0 ? "Can't rename a room while tenants are assigned to it." : undefined}
                slotProps={{ htmlInput: { maxLength: 40 } }}
              />
              <Box sx={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 2 }}>
                <TextField fullWidth label="Floor" type="number" value={roomDlg.floor} onChange={(e) => setRoomDlg((d) => ({ ...d, floor: e.target.value, error: "" }))} slotProps={{ htmlInput: { inputMode: "numeric", min: 1 } }} />
                <TextField fullWidth label="Beds" type="number" value={roomDlg.capacity} onChange={(e) => setRoomDlg((d) => ({ ...d, capacity: e.target.value, error: "" }))} slotProps={{ htmlInput: { inputMode: "numeric", min: 1 } }} />
              </Box>
              <TextField
                fullWidth
                label="Monthly rate per bed (₱)"
                type="number"
                value={roomDlg.rate}
                onChange={(e) => setRoomDlg((d) => ({ ...d, rate: e.target.value, error: "" }))}
                helperText={editingRoom ? "The new rate shows as the rent for tenants here. Past payments aren't changed." : undefined}
                slotProps={{ htmlInput: { inputMode: "decimal", min: 0, step: "any" } }}
              />
              {editingRoom && (
                <Box sx={{ pt: 1 }}>
                  {editingOccupants > 0 ? (
                    <Typography variant="caption" color="text.secondary">
                      {editingOccupants} {editingOccupants === 1 ? "tenant lives" : "tenants live"} here, so this room can't be removed.
                    </Typography>
                  ) : roomDlg.confirmDelete ? (
                    <Box sx={{ ...row, gap: 1, flexWrap: "wrap" }}>
                      <Typography variant="body2" sx={{ fontWeight: 700, flex: "1 1 100%" }}>
                        Remove {editingRoom.roomName} for good?
                      </Typography>
                      <Button color="error" variant="contained" onClick={removeRoom} disabled={roomDlg.saving} sx={{ minHeight: 44, fontWeight: 800, textTransform: "none" }}>
                        Yes, remove it
                      </Button>
                      <Button color="inherit" onClick={() => setRoomDlg((d) => ({ ...d, confirmDelete: false }))} sx={{ minHeight: 44, fontWeight: 700, textTransform: "none" }}>
                        Keep
                      </Button>
                    </Box>
                  ) : (
                    <Button color="error" startIcon={<DeleteOutlineIcon />} onClick={() => setRoomDlg((d) => ({ ...d, confirmDelete: true }))} sx={{ minHeight: 44, fontWeight: 700, textTransform: "none" }}>
                      Remove this room
                    </Button>
                  )}
                </Box>
              )}
            </Box>
          </DialogContent>
          <DialogActions sx={{ p: 2, pb: "calc(16px + env(safe-area-inset-bottom))", gap: 1 }}>
            <Button onClick={() => setRoomDlg((d) => ({ ...d, open: false }))} disabled={roomDlg.saving} sx={{ minHeight: 46, fontWeight: 700, textTransform: "none" }}>
              Cancel
            </Button>
            <Button type="submit" variant="contained" disabled={roomDlg.saving || !online} sx={{ minHeight: 46, fontWeight: 800, borderRadius: 2.5, px: 3, textTransform: "none" }}>
              {roomDlg.saving ? "Saving..." : editingRoom ? "Save room" : "Add room"}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

      <Snackbar
        open={toast.open}
        autoHideDuration={toast.undo ? 6000 : 4000}
        onClose={(e, reason) => {
          if (reason !== "clickaway") setToast((t) => ({ ...t, open: false }));
        }}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        sx={{ bottom: { xs: `${bottomOffset} !important`, sm: undefined } }}
      >
        <Alert
          severity={toast.severity}
          variant="filled"
          sx={{ borderRadius: 2, width: "100%", alignItems: "center" }}
          action={
            toast.undo ? (
              <Button color="inherit" size="small" onClick={toast.undo} sx={{ fontWeight: 800, minHeight: 36 }}>
                Undo
              </Button>
            ) : undefined
          }
        >
          {toast.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}