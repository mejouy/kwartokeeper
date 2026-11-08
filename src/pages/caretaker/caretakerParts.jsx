// Shared pieces of the caretaker area: constants, small helpers, hooks, the
// offline curfew store and the small components the tabs are built from
// (moved out of CaretakerDashboard.jsx).
/* eslint-disable react-refresh/only-export-components */
import React, { useEffect, useMemo, useState } from "react";
import { Avatar, Box, Button, Chip, GlobalStyles, IconButton, InputAdornment, Paper, TextField, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import { visuallyHidden } from "@mui/utils";
import MeetingRoomOutlinedIcon from "@mui/icons-material/MeetingRoomOutlined";
import SearchIcon from "@mui/icons-material/Search";
import CloseIcon from "@mui/icons-material/Close";
import ErrorOutlinedIcon from "@mui/icons-material/ErrorOutlined";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import WarningAmberOutlinedIcon from "@mui/icons-material/WarningAmberOutlined";
import RefreshOutlinedIcon from "@mui/icons-material/RefreshOutlined";
import NotificationsActiveOutlinedIcon from "@mui/icons-material/NotificationsActiveOutlined";
import { deleteField, Timestamp } from "firebase/firestore";
import { auth } from "../../config/firebase";
// Translation is "tr" here: this file also uses "t" for tenants and the theme
import { t as tr } from "../../i18n";

/* ---------------------------------------------------------------------------
   Constants + small helpers
--------------------------------------------------------------------------- */
export const RULES_PREVIEW = 4; // rules shown before "Show all"
export const BOTTOM_NAV_H = 66; // height of the phone bottom bar in AppShell (CaretakerLayout)
export const row = { display: "flex", alignItems: "center" };
export const cardSx = { bgcolor: "background.default", border: "1px solid", borderColor: "divider", borderRadius: 3 };

export const TAB_IDS = ["overview", "tenants", "maintenance", "payments", "rooms"];
export const NOTICE_DELAY_MS = 6000; // time to undo a mark before the automatic notice goes out
export const CHECK_WORD = { present: "in", late: "late", out: "out" };
export const SMS_URL = typeof import.meta !== "undefined" ? import.meta.env?.VITE_SMS_WORKER_URL || "" : "";
export const HISTORY_NIGHTS = 14;
export const EMPTY_OBJ = Object.freeze({});
export const STATUS_OPTIONS = ["Pending", "In Progress", "Resolved"];
export const STATUS_TONE = { Pending: "warning", "In Progress": "info", Resolved: "success", Cancelled: "default" };
export const TIER_TONE = { High: "error", Medium: "warning", Low: "default" };
export const CHECK_OPTIONS = [
  { id: "present", label: tr("In"), tone: "success" },
  { id: "late", label: tr("Late"), tone: "warning" },
  { id: "out", label: tr("Out"), tone: "error" },
];
export const CURFEW_WINDOW_MIN = 420; // a curfew "night" runs for 7 hours after the curfew time
export const NOTICE_TYPES = [
  { id: "info", label: tr("Info") },
  { id: "warning", label: tr("Warning") },
  { id: "error", label: tr("Urgent") },
];
export const timeOf = (value) => {
  const ms = getTimestampMillis(value);
  return ms ? new Date(ms).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : "";
};
export const DEFAULT_CASH_NOTE = "Cash payment collected by caretaker";

export const peso = (n) => `₱${Number(n || 0).toLocaleString()}`;

export const localDateKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const periodLabel = (d) => d.toLocaleString("en-US", { month: "long", year: "numeric" });
export const normPeriod = (s) => String(s || "").trim().toLowerCase();

/* ---------------------------------------------------------------------------
   Curfew marks kept on this phone until the server has them (offline nights).
   Stored per caretaker → property → night. A mark is either a tenant's entry
   or null (taken back with Undo). Older than 3 days is dropped.
--------------------------------------------------------------------------- */
export const pendingKey = (uid) => `kk_ct_pending_${uid}`;
export const readPendingStore = (uid) => {
  try {
    return JSON.parse(window.localStorage.getItem(pendingKey(uid)) || "{}") || {};
  } catch {
    return {};
  }
};
export const writePendingStore = (uid, store) => {
  try {
    window.localStorage.setItem(pendingKey(uid), JSON.stringify(store));
  } catch {
    /* storage full or blocked: marks still sync while the page stays open */
  }
};
export function rememberPendingMarks(uid, propertyId, night, entries) {
  const ids = Object.keys(entries || {});
  if (!uid || ids.length === 0) return null;
  const store = readPendingStore(uid);
  const forProperty = (store[propertyId] = store[propertyId] || {});
  const slot = (forProperty[night] = forProperty[night] || { v: 0, entries: {} });
  ids.forEach((id) => {
    const e = entries[id];
    slot.entries[id] =
      e && typeof e === "object" && e.status
        ? { name: e.name || "", roomNumber: e.roomNumber || "", status: e.status, by: e.by || "", atMs: getTimestampMillis(e.at) || Date.now() }
        : null;
  });
  slot.v += 1;
  slot.savedAt = Date.now();
  writePendingStore(uid, store);
  return slot.v;
}
// Only forgets them if nothing newer was marked for that night meanwhile
export function forgetPendingMarks(uid, propertyId, night, version) {
  if (!uid || version === null) return;
  const store = readPendingStore(uid);
  if (store[propertyId]?.[night]?.v !== version) return;
  delete store[propertyId][night];
  if (Object.keys(store[propertyId]).length === 0) delete store[propertyId];
  writePendingStore(uid, store);
}
export function readPendingMarks(uid, propertyId) {
  const nights = readPendingStore(uid)[propertyId] || {};
  const out = {};
  Object.entries(nights).forEach(([night, slot]) => {
    if (!slot?.entries || Date.now() - (slot.savedAt || 0) > 3 * 86400000) return;
    out[night] = Object.fromEntries(
      Object.entries(slot.entries).map(([id, e]) => [id, e ? { name: e.name, roomNumber: e.roomNumber, status: e.status, by: e.by, at: Timestamp.fromMillis(e.atMs) } : deleteField()])
    );
  });
  return out;
}

export function getTimestampMillis(value) {
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

export const fmtDate = (value, opts = { month: "short", day: "numeric", year: "numeric" }) => {
  const ms = getTimestampMillis(value);
  return ms ? new Date(ms).toLocaleDateString("en-US", opts) : "";
};

export function timeAgo(value) {
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
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
};

export const payKind = (p) => {
  const k = String(p.status || "pending").toLowerCase();
  if (k === "paid") return "paid";
  if (k === "partial") return "partial"; // received, but a balance is still owed
  if (k === "rejected" || k === "cancelled") return "rejected";
  return "pending";
};
export const isReceived = (p) => ["paid", "partial"].includes(payKind(p));
export const PAY_TONE = { paid: "success", partial: "warning", pending: "warning", rejected: "error" };
export const PAY_LABEL = { paid: "Paid", partial: "Partial", pending: "Pending", rejected: "Rejected" };
export const LIST_PAGE = 6; // long lists show this many at a time
export const ROOM_PAGE = 8; // room groups in the tenant directory
export const NIGHT_PAGE = 7; // nights in curfew history

export const isInactiveStatus = (s) => /inactive|terminated|moved/i.test(String(s || ""));

// Strings or objects that Firestore might hold -> a one-line label
export function addressText(addr, fallback = "") {
  if (!addr) return fallback;
  if (typeof addr === "string") return addr;
  return [addr.street, addr.barangay, addr.cityMunicipality, addr.province].filter(Boolean).join(", ") || fallback;
}

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
   Small building blocks
--------------------------------------------------------------------------- */
// Tappable summary tile (opens the matching tab)
export function StatTile({ title, value, subtitle, icon, onClick, tone }) {
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

export function RoomHeader({ title, meta, action }) {
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
export const groupByRoom = (list) => {
  const m = new Map();
  list.forEach((t) => {
    const k = t.roomNumber || "";
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(t);
  });
  return [...m.entries()];
};

// A tiny tap-confirmation on phones that support it
export const buzz = () => {
  try {
    navigator.vibrate?.(12);
  } catch {
    /* not supported */
  }
};

export function FilterChips({ options, value, onChange, flush }) {
  return (
    <Box sx={{ display: "flex", gap: 1, overflowX: "auto", mx: flush ? 0 : { xs: -2, sm: 0 }, px: flush ? 0 : { xs: 2, sm: 0 }, mb: flush ? 0 : { xs: 2, sm: 2.5 }, scrollbarWidth: "none", "&::-webkit-scrollbar": { display: "none" } }}>
      {options.map((f) => {
        const on = value === f.id;
        return (
          <Box
            key={f.id}
            component="button"
            type="button"
            onClick={() => onChange(f.id)}
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
            {f.label}
            <Box component="span" sx={{ opacity: 0.65, fontWeight: 600 }}>{f.n}</Box>
          </Box>
        );
      })}
    </Box>
  );
}

export function SearchBox({ value, onChange, placeholder }) {
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
              <IconButton size="small" aria-label={tr("Clear search")} onClick={() => onChange("")}>
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
export const ROOM_STATUS = {
  vacant: { fill: "rgba(202, 220, 246, 0.55)", label: tr("Vacant"), text: "text.primary" },
  partial: { fill: "rgba(255, 69, 0, 0.45)", label: tr("Partially occupied"), text: "text.primary" },
  full: { fill: "primary.main", label: tr("Fully occupied"), text: "#ffffff" },
};
export const roomStatusOf = (capacity, taken) => (taken === 0 ? "vacant" : Number(capacity) > 0 && taken >= Number(capacity) ? "full" : "partial");

export function RoomTile({ room, taken, selected, onClick }) {
  const status = roomStatusOf(room.capacity, taken);
  const style = ROOM_STATUS[status];
  const capacity = Number(room.capacity) || 0;
  return (
    <Box
      component="button"
      type="button"
      onClick={onClick}
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
        <Typography sx={{ fontSize: "0.66rem", fontWeight: 600, color: style.text, opacity: status === "full" ? 1 : 0.8, lineHeight: 1 }}>
          {taken}/{capacity}
        </Typography>
      )}
      {/* Read out after the visible text (voice control still matches what's on screen) */}
      <Box component="span" sx={visuallyHidden}>{`, ${style.label}, ${taken} of ${capacity} beds`}</Box>
    </Box>
  );
}

export function TenantCard({ t, rentState, showRent, onClick }) {
  return (
    <Box sx={{ ...cardSx, ...row, minWidth: 0, opacity: t.inactive ? 0.7 : 1 }}>
      <Box
        component="button"
        type="button"
        onClick={onClick}
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
            {t.roomNumber ? `Room ${t.roomNumber}` : tr("No room yet")}
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

export function RequestCard({ t, busy, onStatus, compact }) {
  const tier = t.priority?.tier || "Low";
  const status = t.status || "Pending";
  const [allUpdates, setAllUpdates] = useState(false);
  const updates = Array.isArray(t.followUps) ? t.followUps : [];
  // Newest update shows; the rest stay folded so busy requests don't get huge
  const shownUpdates = allUpdates ? updates : updates.slice(-1);
  return (
    <Paper elevation={0} sx={{ ...cardSx, p: 1.75, minWidth: 0 }}>
      <Box sx={{ ...row, alignItems: "flex-start", justifyContent: "space-between", gap: 1, mb: 0.5 }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontWeight: 800, lineHeight: 1.25, overflowWrap: "anywhere" }}>{t.title || tr("Maintenance request")}</Typography>
          <Typography variant="caption" color="text.secondary">
            {t.tenantName || tr("Tenant")}
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
          <Box component="img" src={t.photoUrl} alt={tr("Photo attached to the request")} loading="lazy" sx={{ display: "block", width: "100%", maxHeight: 180, objectFit: "cover", borderRadius: 2, border: "1px solid", borderColor: "divider" }} />
        </Box>
      )}

      {!compact && updates.length > 0 && (
        <Box sx={{ mt: 1.25, p: 1.25, borderRadius: 2, bgcolor: (th) => alpha(th.palette.info.main, 0.08) }}>
          <Box sx={{ ...row, justifyContent: "space-between", gap: 1 }}>
            <Typography variant="caption" sx={{ fontWeight: 800, color: "info.dark" }}>
              {updates.length === 1 ? tr("Update from the tenant") : allUpdates ? `${updates.length} updates from the tenant` : tr("Latest update from the tenant")}
            </Typography>
            {updates.length > 1 && (
              <Button size="small" onClick={() => setAllUpdates((v) => !v)} sx={{ minHeight: 28, py: 0, px: 1, fontWeight: 700, fontSize: 12, textTransform: "none" }}>
                {allUpdates ? tr("Latest only") : `See all ${updates.length}`}
              </Button>
            )}
          </Box>
          {shownUpdates.map((f, i) => (
            <Box key={i} sx={{ mt: 0.5 }}>
              {f.text && (
                <Typography variant="body2" sx={{ overflowWrap: "anywhere", whiteSpace: "pre-wrap" }}>
                  {f.text}
                </Typography>
              )}
              {f.photoUrl && (
                <Box component="a" href={f.photoUrl} target="_blank" rel="noopener noreferrer" sx={{ display: "inline-block", mt: 0.5 }}>
                  <Box component="img" src={f.photoUrl} alt={tr("Photo added by the tenant")} loading="lazy" sx={{ display: "block", width: 88, height: 88, objectFit: "cover", borderRadius: 2, border: "1px solid", borderColor: "divider" }} />
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
        <Box sx={{ display: "flex", gap: 0.75, mt: 1 }} role="group" aria-label={tr("Request status")}>
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
                sx={{ flex: 1, minWidth: 0, minHeight: 40, px: 0.5, fontWeight: 700, fontSize: { xs: 12.5, sm: 13.5 }, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", borderRadius: 2, textTransform: "none", borderColor: current ? undefined : "divider", color: current ? undefined : "text.secondary" }}
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

export function CheckRow({ t, entry, past, onSet, onNotice }) {
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
          {entry?.noticeSent ? tr(" · notified") : ""}
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
              sx={{ minWidth: 0, width: { xs: 42, sm: 46 }, height: 44, px: 0, fontWeight: 800, fontSize: "0.8rem", borderRadius: 2, textTransform: "none", borderColor: current ? undefined : "divider", color: current ? undefined : "text.secondary" }}
            >
              {o.label}
            </Button>
          );
        })}
      </Box>
      <IconButton aria-label={`Send a notice to ${t.name}`} onClick={() => onNotice(t)} sx={{ width: { xs: 34, sm: 40 }, height: 40, flexShrink: 0, color: "primary.main" }}>
        <NotificationsActiveOutlinedIcon fontSize="small" />
      </IconButton>
    </Box>
  );
}

export function PayRow({ p }) {
  const kind = payKind(p);
  return (
    <Box sx={{ ...cardSx, ...row, gap: 1.5, p: 1.5, minWidth: 0 }}>
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography sx={{ fontWeight: 800, lineHeight: 1.25 }} noWrap>
          {p.tenantName || tr("Tenant")}
        </Typography>
        <Typography variant="caption" color="text.secondary" noWrap sx={{ display: "block" }}>
          {p.periodMonth || tr("Period not set")} · {p.paymentMethod || tr("Online")}
          {fmtDate(p.paymentDate || p.createdAt) ? ` · ${fmtDate(p.paymentDate || p.createdAt, { month: "short", day: "numeric" })}` : ""}
        </Typography>
        {(p.recordedByName || p.proofUrl) && (
          <Typography variant="caption" color="text.secondary" noWrap sx={{ display: "block" }}>
            {p.recordedByName ? `Recorded by ${p.recordedByName}` : ""}
            {p.recordedByName && p.proofUrl ? " · " : ""}
            {p.proofUrl && (
              <Box component="a" href={p.proofUrl} target="_blank" rel="noopener noreferrer" sx={{ color: "primary.main", fontWeight: 700 }}>
                {tr("Receipt photo")}
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
export async function sendNoticeSms({ tenantIds, title, message, propertyId }) {
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
