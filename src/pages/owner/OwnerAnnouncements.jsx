// src/pages/owner/OwnerAnnouncements.jsx

import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogContent,
  IconButton,
  InputBase,
  MenuItem,
  Skeleton,
  Snackbar,
  TextField,
  Typography,
  useMediaQuery,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import CampaignOutlinedIcon from "@mui/icons-material/CampaignOutlined";
import SendIcon from "@mui/icons-material/Send";
import AddIcon from "@mui/icons-material/Add";
import SearchIcon from "@mui/icons-material/Search";
import CloseIcon from "@mui/icons-material/Close";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import WarningAmberOutlinedIcon from "@mui/icons-material/WarningAmberOutlined";
import CheckCircleOutlinedIcon from "@mui/icons-material/CheckCircleOutlined";
import ErrorOutlinedIcon from "@mui/icons-material/ErrorOutlined";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import ContentCopyOutlinedIcon from "@mui/icons-material/ContentCopyOutlined";
import ApartmentOutlinedIcon from "@mui/icons-material/ApartmentOutlined";
import HomeWorkOutlinedIcon from "@mui/icons-material/HomeWorkOutlined";
import MeetingRoomOutlinedIcon from "@mui/icons-material/MeetingRoomOutlined";
import PersonOutlineOutlinedIcon from "@mui/icons-material/PersonOutlineOutlined";
import CalendarMonthOutlinedIcon from "@mui/icons-material/CalendarMonthOutlined";
import ScheduleOutlinedIcon from "@mui/icons-material/ScheduleOutlined";
import EditNoteOutlinedIcon from "@mui/icons-material/EditNoteOutlined";
import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "../../config/firebase";
import { useAuth } from "../../context/AuthContext";
import { normalizeStatus } from "../../utils/tenantRent";
import { isRemovedAccount } from "../../utils/accountState";

const HEAD = '"Inter", sans-serif';
const R = { sm: "10px", md: "14px", lg: "18px", xl: "22px" };
const BOTTOM_NAV_H = 72;
const row = { display: "flex", alignItems: "center" };
const MAX_TITLE = 80;
const MAX_MESSAGE = 1000;
const BATCH_SIZE = 400; // Firestore caps a batch at 500 writes

const SCOPE_OPTIONS = [
  { value: "all", label: "Everyone", hint: "All your properties", Icon: ApartmentOutlinedIcon },
  { value: "property", label: "One property", hint: "Everyone in a building", Icon: HomeWorkOutlinedIcon },
  { value: "room", label: "One room", hint: "People in a room", Icon: MeetingRoomOutlinedIcon },
  { value: "individual", label: "One person", hint: "A single tenant or caretaker", Icon: PersonOutlineOutlinedIcon },
];

const AUDIENCE_OPTIONS = [
  { value: "both", label: "Everyone", long: "Tenants & caretakers" },
  { value: "tenants", label: "Tenants", long: "Tenants only" },
  { value: "caretakers", label: "Caretakers", long: "Caretakers only" },
];

// type -> label, tone, icon
const TYPES = {
  info: { label: "Info", tone: "info", Icon: InfoOutlinedIcon },
  warning: { label: "Warning", tone: "warning", Icon: WarningAmberOutlinedIcon },
  success: { label: "Good news", tone: "success", Icon: CheckCircleOutlinedIcon },
  error: { label: "Urgent", tone: "error", Icon: ErrorOutlinedIcon },
};
// Anything saved with an unknown type is shown, filtered and counted as Info
const typeKey = (t) => (TYPES[t] ? t : "info");
const FILTERS = ["all", ...Object.keys(TYPES)];

const panelSx = {
  bgcolor: "background.default",
  border: "1px solid",
  borderColor: "divider",
  borderRadius: R.lg,
  minWidth: 0,
};

const toMillis = (ts) => {
  if (!ts) return 0;
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  const n = d.getTime();
  return Number.isNaN(n) ? 0 : n;
};

const formatDate = (ts, withYear = true) => {
  const ms = toMillis(ts);
  if (!ms) return "Unknown date";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    ...(withYear ? { year: "numeric" } : {}),
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(ms));
};

const userProp = (u) => u.propertyId || u.assignedPropertyId;
const userRoom = (u) => u.roomId || u.roomNumber;
const userName = (u) => u.fullName || u.name || "Unnamed";
const roleOf = (u) => String(u.role || "tenant").toLowerCase();
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const propertyNameOf = (p) => p?.propertyName || p?.name || "Property";

// Only current tenants and caretakers receive announcements
const isReachable = (u) => {
  if (isRemovedAccount(u)) return false;
  const role = roleOf(u);
  if (role === "caretaker") return true;
  return role === "tenant" && normalizeStatus(u.status) !== "Inactive";
};

const chunk = (list, size) => Array.from({ length: Math.ceil(list.length / size) }, (_, i) => list.slice(i * size, i * size + size));

function Pill({ label, tone = "default", icon }) {
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
        "& svg": { fontSize: 15 },
        bgcolor: (t) => (tone === "default" ? alpha(t.palette.text.primary, 0.06) : alpha(t.palette[tone].main, 0.12)),
        color: (t) => (tone === "default" ? t.palette.text.secondary : t.palette[tone].dark),
      }}
    >
      {icon}
      {label}
    </Box>
  );
}

/* ---------------------------------------------------------------------------
   Header: same light card as Properties / Tenants, with the main action and
   four stat tiles.
   ------------------------------------------------------------------------- */
function Header({ tiles, onNew, loading }) {
  return (
    <Box component="section" sx={{ ...panelSx, position: "relative", overflow: "hidden", borderRadius: R.xl, p: { xs: 2, sm: 3 }, mb: { xs: 2, sm: 2.5 } }}>
      <Box aria-hidden sx={{ position: "absolute", top: -180, right: -120, width: 380, height: 380, borderRadius: "50%", background: "rgba(255,69,0,.10)", filter: "blur(70px)", pointerEvents: "none" }} />

      <Box sx={{ position: "relative", display: "flex", flexDirection: { xs: "column", sm: "row" }, alignItems: { xs: "stretch", sm: "center" }, justifyContent: "space-between", gap: { xs: 1.5, sm: 2 }, mb: { xs: 2, sm: 2.5 } }}>
        <Typography color="text.secondary" sx={{ minWidth: 0, fontSize: { xs: 14, sm: 15 } }}>
          Send updates to everyone, one property, one room or one person
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={onNew}
          sx={{ flexShrink: 0, fontWeight: 700, borderRadius: R.sm, minHeight: 44, boxShadow: "0 10px 22px -14px rgba(255,69,0,.9)" }}
        >
          New announcement
        </Button>
      </Box>

      <Box sx={{ position: "relative", display: "grid", gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", md: "repeat(4, minmax(0, 1fr))" }, gap: { xs: 1, sm: 1.5 } }}>
        {tiles.map((t) => (
          <Box key={t.label} sx={{ minWidth: 0, display: "flex", alignItems: "flex-start", gap: 1.25, p: { xs: 1.25, sm: 1.75 }, borderRadius: R.md, bgcolor: (th) => alpha(th.palette.background.paper, 0.55) }}>
            <Box sx={{ width: { xs: 32, sm: 38 }, height: { xs: 32, sm: 38 }, flexShrink: 0, borderRadius: R.sm, display: "grid", placeItems: "center", bgcolor: "#fff", color: t.accent ? `${t.accent}.main` : "primary.main", "& svg": { fontSize: { xs: 18, sm: 20 } } }}>
              {t.icon}
            </Box>
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography variant="caption" color="text.secondary" noWrap sx={{ fontWeight: 600, display: "block" }}>
                {t.label}
              </Typography>
              <Typography noWrap sx={{ fontFamily: HEAD, fontWeight: 800, letterSpacing: "-0.02em", fontSize: t.small ? { xs: "1rem", sm: "1.15rem" } : { xs: "1.2rem", sm: "1.45rem" }, lineHeight: t.small ? 1.5 : 1.2, color: t.accent ? `${t.accent}.main` : "text.primary" }}>
                {loading ? "–" : t.value}
              </Typography>
              {t.sub && !loading && (
                <Typography variant="caption" color="text.secondary" noWrap component="div">
                  {t.sub}
                </Typography>
              )}
            </Box>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

function AnnouncementCard({ a, scopeLabel, onReuse }) {
  const [open, setOpen] = useState(false);
  const meta = TYPES[typeKey(a.type)];
  const text = a.message || "";
  const long = text.length > 220 || text.split("\n").length > 4;
  const audience = (AUDIENCE_OPTIONS.find((o) => o.value === a.targetAudience) || AUDIENCE_OPTIONS[0]).long;

  return (
    <Box component="article" sx={{ ...panelSx, p: { xs: 1.75, sm: 2.25 }, display: "flex", gap: { xs: 1.5, sm: 2 } }}>
      <Box sx={{ width: 40, height: 40, flexShrink: 0, borderRadius: R.sm, display: { xs: "none", sm: "grid" }, placeItems: "center", bgcolor: (t) => alpha(t.palette[meta.tone].main, 0.12), color: `${meta.tone}.dark` }}>
        <meta.Icon sx={{ fontSize: 21 }} />
      </Box>

      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Box sx={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 1 }}>
          <Typography sx={{ fontFamily: HEAD, fontWeight: 800, fontSize: "1rem", lineHeight: 1.35, overflowWrap: "anywhere", minWidth: 0 }}>{a.title}</Typography>
          <Box sx={{ flexShrink: 0 }}>
            <Pill label={meta.label} tone={meta.tone} icon={<meta.Icon />} />
          </Box>
        </Box>

        <Typography variant="caption" color="text.secondary" component="div" sx={{ mt: 0.25, overflowWrap: "anywhere" }}>
          {formatDate(a.createdAt)} · {scopeLabel} · {audience}
        </Typography>

        <Typography
          variant="body2"
          sx={{
            mt: 1.25,
            color: "text.primary",
            opacity: 0.85,
            whiteSpace: "pre-wrap",
            overflowWrap: "anywhere",
            lineHeight: 1.6,
            ...(!open && long ? { display: "-webkit-box", WebkitLineClamp: 4, WebkitBoxOrient: "vertical", overflow: "hidden" } : {}),
          }}
        >
          {text}
        </Typography>

        <Box sx={{ ...row, justifyContent: "space-between", flexWrap: "wrap", mt: 1.25, gap: 1 }}>
          {typeof a.recipientCount === "number" ? (
            <Pill icon={<GroupsOutlinedIcon />} label={`Sent to ${plural(a.recipientCount, "person", "people")}`} />
          ) : (
            <span />
          )}
          <Box sx={{ ...row, gap: 0.5, ml: "auto" }}>
            {long && (
              <Button size="small" onClick={() => setOpen((v) => !v)} sx={{ fontWeight: 700, minWidth: 0 }}>
                {open ? "Show less" : "Show more"}
              </Button>
            )}
            <Button size="small" color="inherit" startIcon={<ContentCopyOutlinedIcon sx={{ fontSize: 16 }} />} onClick={() => onReuse(a)} sx={{ fontWeight: 700, minWidth: 0, color: "text.secondary" }}>
              Reuse
            </Button>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

// One block of the composer: a small heading, then its fields
function ComposeSection({ step, title, children }) {
  return (
    <Box sx={{ py: { xs: 2.25, sm: 2.5 }, "& + &": { borderTop: "1px solid", borderColor: "divider" } }}>
      <Box sx={{ ...row, gap: 1, mb: 1.75 }}>
        <Box sx={{ width: 22, height: 22, borderRadius: "6px", display: "grid", placeItems: "center", bgcolor: "primary.main", color: "#fff", fontSize: 12, fontWeight: 800 }}>{step}</Box>
        <Typography sx={{ fontFamily: HEAD, fontWeight: 800, fontSize: "0.98rem" }}>{title}</Typography>
      </Box>
      {children}
    </Box>
  );
}

// Button-style choice used for type, scope and audience
function Choice({ active, onClick, tone = "primary", children, sx }) {
  return (
    <Box
      component="button"
      type="button"
      onClick={onClick}
      aria-pressed={active}
      sx={{
        font: "inherit",
        cursor: "pointer",
        textAlign: "left",
        minWidth: 0,
        border: "1px solid",
        borderRadius: R.sm,
        transition: "background-color .15s, border-color .15s",
        borderColor: (t) => (active ? t.palette[tone].main : t.palette.divider),
        bgcolor: (t) => (active ? alpha(t.palette[tone].main, 0.08) : "transparent"),
        color: (t) => (active ? t.palette[tone].dark : t.palette.text.secondary),
        "&:hover": { borderColor: (t) => (active ? t.palette[tone].main : alpha(t.palette.text.primary, 0.3)) },
        "&:focus-visible": { outline: "2px solid", outlineColor: (t) => t.palette[tone].main, outlineOffset: 2 },
        ...sx,
      }}
    >
      {children}
    </Box>
  );
}

export default function OwnerAnnouncements() {
  const { currentUser } = useAuth();
  const ownerId = currentUser?.uid;
  const theme = useTheme();
  const isPhone = useMediaQuery(theme.breakpoints.down("sm"));

  // composer
  const [composeOpen, setComposeOpen] = useState(false);
  const [draftFromReuse, setDraftFromReuse] = useState(false);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [scope, setScope] = useState("all");
  const [targetAudience, setTargetAudience] = useState("both");
  const [selectedPropertyId, setSelectedPropertyId] = useState("");
  const [selectedRoomNumber, setSelectedRoomNumber] = useState("");
  const [selectedRecipientId, setSelectedRecipientId] = useState("");
  const [type, setType] = useState("info");
  const [touched, setTouched] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  // data
  const [people, setPeople] = useState({ status: "loading", properties: [], users: [] });
  const [history, setHistory] = useState({ loaded: false, list: [], error: "" });
  const [toast, setToast] = useState({ open: false, message: "", severity: "success" });

  // list controls
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");

  const notify = (msg, severity = "success") => setToast({ open: true, message: msg, severity });
  const { properties, users } = people;
  const announcements = history.list;
  const loading = Boolean(ownerId) && !history.loaded;

  // Properties + everyone who can receive an announcement. Tenants can be saved
  // in "tenants", in "users", or both (same uid), and caretakers may only carry
  // invitedBy, so every source is read and merged — the same way the Tenants
  // and Caretakers pages find them.
  useEffect(() => {
    if (!ownerId) return undefined;
    let active = true;
    const optional = (p) =>
      p.catch((err) => {
        console.warn("Recipient source skipped:", err);
        return null;
      });

    (async () => {
      try {
        const propsSnap = await getDocs(query(collection(db, "properties"), where("ownerUid", "==", ownerId)));
        const props = propsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
        const idChunks = chunk(props.map((p) => p.id), 30);

        const sources = await Promise.all([
          getDocs(query(collection(db, "users"), where("ownerUid", "==", ownerId))).then((s) => ({ s, fromTenants: false })),
          optional(getDocs(query(collection(db, "users"), where("invitedBy", "==", ownerId)))).then((s) => ({ s, fromTenants: false })),
          optional(getDocs(query(collection(db, "tenants"), where("ownerUid", "==", ownerId)))).then((s) => ({ s, fromTenants: true })),
          ...idChunks.flatMap((ids) => [
            optional(getDocs(query(collection(db, "tenants"), where("propertyId", "in", ids)))).then((s) => ({ s, fromTenants: true })),
            optional(getDocs(query(collection(db, "users"), where("propertyId", "in", ids)))).then((s) => ({ s, fromTenants: false })),
          ]),
        ]);

        const byId = new Map();
        sources.forEach(({ s, fromTenants }) => {
          s?.docs.forEach((d) => {
            const data = d.data();
            const id = data.uid || d.id;
            const prev = byId.get(id) || {};
            // A "users" record is the account itself: let it win on role
            const merged = fromTenants ? { ...data, ...prev } : { ...prev, ...data };
            byId.set(id, { ...merged, id, role: merged.role || "tenant" });
          });
        });

        const list = [...byId.values()].filter((u) => u.id !== ownerId && isReachable(u));
        if (active) setPeople({ status: "ready", properties: props, users: list });
      } catch (err) {
        console.error("Error fetching recipients:", err);
        if (active) setPeople({ status: "error", properties: [], users: [] });
      }
    })();

    return () => {
      active = false;
    };
  }, [ownerId]);

  // History
  useEffect(() => {
    if (!ownerId) return undefined;
    const q = query(collection(db, "owner_announcements"), where("ownerId", "==", ownerId));
    return onSnapshot(
      q,
      (snapshot) => {
        const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        list.sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
        setHistory({ loaded: true, list, error: "" });
      },
      (err) => {
        console.error("Error loading announcements:", err);
        setHistory((h) => ({ ...h, loaded: true, error: "Couldn't load your past announcements. Check your connection and refresh." }));
      }
    );
  }, [ownerId]);

  const propertyName = (id) => propertyNameOf(properties.find((x) => x.id === id));

  const availableRooms = useMemo(() => {
    const rooms = new Set();
    users.forEach((u) => {
      const room = userRoom(u);
      if (room && selectedPropertyId && userProp(u) === selectedPropertyId) rooms.add(String(room));
    });
    return Array.from(rooms).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [users, selectedPropertyId]);

  const matchesAudience = (u) => {
    const role = roleOf(u);
    if (targetAudience === "tenants") return role === "tenant";
    if (targetAudience === "caretakers") return role === "caretaker";
    return true;
  };

  // Same targeting rules everywhere, so the preview and the send agree
  const recipients = users.filter((u) => {
    if (!matchesAudience(u)) return false;
    if (scope === "all") return true;
    if (scope === "property") return !!selectedPropertyId && userProp(u) === selectedPropertyId;
    if (scope === "room")
      return !!selectedPropertyId && !!selectedRoomNumber && userProp(u) === selectedPropertyId && String(userRoom(u)) === selectedRoomNumber;
    if (scope === "individual") return !!selectedRecipientId && u.id === selectedRecipientId;
    return false;
  });

  // People shown in the "one person" picker
  const personOptions = useMemo(
    () =>
      users
        .filter((u) => {
          const role = roleOf(u);
          if (targetAudience === "tenants") return role === "tenant";
          if (targetAudience === "caretakers") return role === "caretaker";
          return true;
        })
        .sort((a, b) => userName(a).localeCompare(userName(b))),
    [users, targetAudience]
  );

  const scopeLabelFor = (a) => {
    const d = a.targetDetails || {};
    if (a.scope === "property") return propertyName(d.propertyId);
    if (a.scope === "room") return `${propertyName(d.propertyId)} · Room ${d.roomNumber ?? "?"}`;
    if (a.scope === "individual") {
      const u = users.find((x) => x.id === d.recipientId);
      return u ? userName(u) : "One person";
    }
    return "All properties";
  };

  // ---- validation ----
  const errors = {
    title: !title.trim() ? "Add a short title." : "",
    message: !message.trim() ? "Write the announcement." : "",
    property: (scope === "property" || scope === "room") && !selectedPropertyId ? "Choose a property." : "",
    room: scope === "room" && !selectedRoomNumber ? "Choose a room." : "",
    person: scope === "individual" && !selectedRecipientId ? "Choose a person." : "",
  };
  const hasErrors = Object.values(errors).some(Boolean);
  const show = (k) => (touched[k] ? errors[k] : "");
  const touch = (k) => setTouched((t) => ({ ...t, [k]: true }));

  const resetForm = () => {
    setTitle("");
    setMessage("");
    setScope("all");
    setTargetAudience("both");
    setSelectedPropertyId("");
    setSelectedRoomNumber("");
    setSelectedRecipientId("");
    setType("info");
    setTouched({});
    setFormError("");
    setDraftFromReuse(false);
  };

  // A draft the owner typed is kept if they close the composer by accident;
  // a copied one isn't, so "New" really starts fresh after a Reuse.
  const openNew = () => {
    if (draftFromReuse) resetForm();
    setComposeOpen(true);
  };

  const reuse = (a) => {
    const d = a.targetDetails || {};
    setTitle(a.title || "");
    setMessage(a.message || "");
    setType(typeKey(a.type));
    setScope(SCOPE_OPTIONS.some((o) => o.value === a.scope) ? a.scope : "all");
    setTargetAudience(AUDIENCE_OPTIONS.some((o) => o.value === a.targetAudience) ? a.targetAudience : "both");
    setSelectedPropertyId(d.propertyId || "");
    setSelectedRoomNumber(d.roomNumber != null ? String(d.roomNumber) : "");
    setSelectedRecipientId(d.recipientId || "");
    setTouched({});
    setFormError("");
    setDraftFromReuse(true);
    setComposeOpen(true);
  };

  const closeCompose = () => {
    if (submitting) return;
    setComposeOpen(false);
  };

  const changeScope = (value) => {
    setScope(value);
    setSelectedPropertyId("");
    setSelectedRoomNumber("");
    setSelectedRecipientId("");
    setFormError("");
  };

  const handleSend = async () => {
    if (submitting) return;
    setTouched({ title: true, message: true, property: true, room: true, person: true });
    if (!ownerId || hasErrors) return;
    if (recipients.length === 0) {
      setFormError("No one matches this scope and audience yet.");
      return;
    }

    setSubmitting(true);
    setFormError("");
    const timestamp = new Date().toISOString();
    const cleanTitle = title.trim();
    const cleanMessage = message.trim();
    const total = recipients.length;
    const announcementRef = doc(collection(db, "owner_announcements"));
    let sent = 0;

    try {
      const announcementData = {
        ownerId,
        createdBy: ownerId,
        title: cleanTitle,
        message: cleanMessage,
        scope,
        targetAudience,
        targetDetails: {
          propertyId: selectedPropertyId || null,
          roomNumber: selectedRoomNumber || null,
          recipientId: selectedRecipientId || null,
        },
        recipientCount: total,
        type,
        createdAt: timestamp,
      };

      // The record goes in the first batch with the first notifications, so a
      // failure there leaves nothing behind
      for (let i = 0; i < total; i += BATCH_SIZE) {
        const batch = writeBatch(db);
        const part = recipients.slice(i, i + BATCH_SIZE);
        if (i === 0) batch.set(announcementRef, announcementData);
        part.forEach((r) => {
          batch.set(doc(collection(db, "notifications")), {
            userId: r.id,
            title: cleanTitle,
            message: cleanMessage,
            type,
            announcementId: announcementRef.id,
            ownerId,
            createdBy: ownerId,
            isRead: false,
            createdAt: timestamp,
          });
        });
        await batch.commit();
        sent += part.length;
      }

      resetForm();
      setComposeOpen(false);
      notify(`Sent to ${plural(total, "person", "people")}.`);
    } catch (err) {
      console.error("Error sending announcement:", err);
      if (sent > 0) {
        // A later batch failed: the history should say how many really got it
        updateDoc(announcementRef, { recipientCount: sent }).catch((e) => console.error("Couldn't correct the recipient count:", e));
        setComposeOpen(false);
        resetForm();
        notify(`Only ${sent} of ${total} people received it. Check your connection and send it again to the rest.`, "warning");
      } else {
        setFormError("The announcement couldn't be sent. Check your connection and try again.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  // ---- list view ----
  const stats = useMemo(() => {
    const now = new Date();
    const thisMonth = announcements.filter((a) => {
      const ms = toMillis(a.createdAt);
      if (!ms) return false;
      const d = new Date(ms);
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    });
    return {
      total: announcements.length,
      thisMonth: thisMonth.length,
      reachedThisMonth: thisMonth.reduce((n, a) => n + (Number(a.recipientCount) || 0), 0),
      monthName: now.toLocaleDateString("en-US", { month: "long" }),
      last: announcements[0] ? formatDate(announcements[0].createdAt, false) : "Nothing yet",
      lastTitle: announcements[0]?.title || "",
    };
  }, [announcements]);

  const counts = useMemo(() => {
    const c = { all: announcements.length };
    announcements.forEach((a) => {
      const k = typeKey(a.type);
      c[k] = (c[k] || 0) + 1;
    });
    return c;
  }, [announcements]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return announcements.filter((a) => {
      if (filter !== "all" && typeKey(a.type) !== filter) return false;
      if (!q) return true;
      return `${a.title || ""} ${a.message || ""}`.toLowerCase().includes(q);
    });
  }, [announcements, filter, search]);

  const nTenants = users.filter((u) => roleOf(u) === "tenant").length;
  const nCaretakers = users.length - nTenants;
  const tiles = [
    { label: "Sent", icon: <CampaignOutlinedIcon />, value: stats.total, sub: "All time" },
    { label: `In ${stats.monthName}`, icon: <CalendarMonthOutlinedIcon />, value: stats.thisMonth, sub: plural(stats.reachedThisMonth, "person reached", "people reached") },
    {
      label: "Can reach",
      icon: <GroupsOutlinedIcon />,
      value: people.status === "loading" ? "…" : people.status === "error" ? "?" : users.length,
      sub: people.status === "ready" ? `${plural(nTenants, "tenant", "tenants")} · ${plural(nCaretakers, "caretaker", "caretakers")}` : "",
      accent: people.status === "error" ? "error" : null,
    },
    { label: "Last sent", icon: <ScheduleOutlinedIcon />, value: stats.last, sub: stats.lastTitle, small: true },
  ];

  const nRecTenants = recipients.filter((u) => roleOf(u) === "tenant").length;
  const nRecCaretakers = recipients.length - nRecTenants;
  const preview =
    people.status === "loading"
      ? "Finding recipients…"
      : recipients.length === 0
        ? "No one matches yet"
        : `Reaches ${plural(recipients.length, "person", "people")}` +
          (nRecTenants && nRecCaretakers ? ` · ${plural(nRecTenants, "tenant", "tenants")}, ${plural(nRecCaretakers, "caretaker", "caretakers")}` : "");

  const fieldSx = { "& .MuiOutlinedInput-root": { borderRadius: R.sm } };

  return (
    <Box>
      <Header tiles={tiles} onNew={openNew} loading={loading} />

      {history.error && <Alert severity="error" sx={{ mb: 2, borderRadius: R.md }}>{history.error}</Alert>}
      {people.status === "error" && (
        <Alert severity="warning" sx={{ mb: 2, borderRadius: R.md }}>
          Couldn't load your tenants and caretakers, so new announcements can't be sent right now. Refresh the page to try again.
        </Alert>
      )}

      {loading ? (
        <>
          <Skeleton variant="rounded" height={46} sx={{ borderRadius: R.md, mb: 1.5 }} />
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} variant="rounded" height={140} sx={{ borderRadius: R.lg, mb: 1.5 }} />
          ))}
        </>
      ) : announcements.length === 0 ? (
        <Box sx={{ ...panelSx, borderStyle: "dashed", py: { xs: 5, sm: 7 }, px: 3, textAlign: "center" }}>
          <Box sx={{ width: 60, height: 60, borderRadius: R.md, mx: "auto", mb: 2, display: "grid", placeItems: "center", bgcolor: "rgba(255,69,0,.10)" }}>
            <CampaignOutlinedIcon sx={{ fontSize: 30, color: "primary.main" }} />
          </Box>
          <Typography sx={{ fontFamily: HEAD, fontWeight: 800 }}>No announcements yet</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 2, maxWidth: 360, mx: "auto" }}>
            Let everyone know about a water interruption, a house meeting or a rule change.
          </Typography>
          <Button variant="outlined" startIcon={<AddIcon />} onClick={openNew} sx={{ fontWeight: 700, borderRadius: R.sm }}>
            Write the first one
          </Button>
        </Box>
      ) : (
        <>
          {/* Toolbar: search + type filter */}
          <Box sx={{ display: "flex", flexDirection: { xs: "column", md: "row" }, gap: 1.25, mb: 1.75, alignItems: { md: "center" } }}>
            <Box sx={{ ...panelSx, ...row, gap: 1, px: 1.5, height: 44, borderRadius: R.md, flex: { md: "0 1 340px" } }}>
              <SearchIcon sx={{ color: "text.secondary", fontSize: 20 }} />
              <InputBase
                fullWidth
                placeholder="Search title or message"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                inputProps={{ "aria-label": "Search announcements" }}
                sx={{ fontSize: 14.5 }}
              />
              {search && (
                <IconButton size="small" aria-label="Clear search" onClick={() => setSearch("")}>
                  <CloseIcon fontSize="small" />
                </IconButton>
              )}
            </Box>
            <Box
              role="tablist"
              aria-label="Filter by type"
              sx={{ display: "flex", gap: 0.75, overflowX: "auto", mx: { xs: -2, sm: 0 }, px: { xs: 2, sm: 0 }, scrollbarWidth: "none", "&::-webkit-scrollbar": { display: "none" } }}
            >
              {FILTERS.map((f) => {
                const active = filter === f;
                const t = TYPES[f];
                return (
                  <Box
                    key={f}
                    component="button"
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setFilter(f)}
                    sx={{
                      ...row,
                      gap: 0.75,
                      flexShrink: 0,
                      height: 36,
                      px: 1.5,
                      borderRadius: 99,
                      font: "inherit",
                      fontSize: 13.5,
                      fontWeight: 700,
                      cursor: "pointer",
                      border: "1px solid",
                      borderColor: active ? "text.primary" : "divider",
                      bgcolor: active ? "text.primary" : "background.default",
                      color: active ? "background.default" : "text.secondary",
                    }}
                  >
                    {t && <Box sx={{ width: 8, height: 8, borderRadius: "2px", bgcolor: `${t.tone}.main` }} />}
                    {f === "all" ? "All" : t.label}
                    <Box component="span" sx={{ opacity: 0.6, fontWeight: 600 }}>{counts[f] || 0}</Box>
                  </Box>
                );
              })}
            </Box>
          </Box>

          {visible.length === 0 ? (
            <Box sx={{ ...panelSx, py: 5, px: 3, textAlign: "center" }}>
              <Typography sx={{ fontWeight: 700 }}>No announcements match</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>Try a different search or filter.</Typography>
              <Button size="small" onClick={() => { setFilter("all"); setSearch(""); }} sx={{ mt: 1.5, fontWeight: 700 }}>
                Clear filters
              </Button>
            </Box>
          ) : (
            <Box sx={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 1.25 }}>
              {visible.map((a) => (
                <AnnouncementCard key={a.id} a={a} scopeLabel={scopeLabelFor(a)} onReuse={reuse} />
              ))}
            </Box>
          )}
        </>
      )}

      {/* ───── Composer (full-screen on phones) ───── */}
      <Dialog
        open={composeOpen}
        onClose={closeCompose}
        fullScreen={isPhone}
        fullWidth
        maxWidth="sm"
        slotProps={{ paper: { sx: { borderRadius: isPhone ? 0 : R.xl, bgcolor: "background.default", overflow: "hidden" } } }}
      >
        <Box sx={{ position: "relative", overflow: "hidden", flexShrink: 0, px: { xs: 2, sm: 3 }, py: 2, borderBottom: "1px solid", borderColor: "divider" }}>
          <Box aria-hidden sx={{ position: "absolute", top: -140, right: -100, width: 300, height: 300, borderRadius: "50%", background: "rgba(255,69,0,.10)", filter: "blur(60px)", pointerEvents: "none" }} />
          <Box sx={{ position: "relative", ...row, gap: 1.5 }}>
            <Box sx={{ width: 40, height: 40, borderRadius: R.sm, display: "grid", placeItems: "center", bgcolor: "rgba(255,69,0,.12)", color: "primary.main" }}>
              <EditNoteOutlinedIcon />
            </Box>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography sx={{ fontFamily: HEAD, fontWeight: 800, fontSize: "1.15rem", lineHeight: 1.25 }}>
                {draftFromReuse ? "Send again" : "New announcement"}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                It shows up in their notifications right away
              </Typography>
            </Box>
            <IconButton onClick={closeCompose} aria-label="Close" disabled={submitting} sx={{ bgcolor: "action.hover" }}>
              <CloseIcon />
            </IconButton>
          </Box>
        </Box>

        <DialogContent sx={{ px: { xs: 2, sm: 3 }, py: 0, ...fieldSx }}>
          {formError && <Alert severity="error" sx={{ mt: 2, borderRadius: R.sm }}>{formError}</Alert>}

          <ComposeSection step={1} title="Message">
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", sm: "repeat(4, minmax(0, 1fr))" }, gap: 0.75, mb: 2 }}>
              {Object.entries(TYPES).map(([key, t]) => (
                <Choice key={key} active={type === key} tone={t.tone} onClick={() => setType(key)} sx={{ ...row, justifyContent: "center", gap: 0.75, height: 40, fontSize: 13.5, fontWeight: 700 }}>
                  <t.Icon sx={{ fontSize: 18 }} />
                  {t.label}
                </Choice>
              ))}
            </Box>

            <TextField
              label="Title"
              value={title}
              onChange={(e) => setTitle(e.target.value.slice(0, MAX_TITLE))}
              onBlur={() => touch("title")}
              placeholder="e.g. Water interruption on Saturday"
              fullWidth
              error={!!show("title")}
              helperText={show("title") || `${title.length}/${MAX_TITLE}`}
              sx={{ mb: 1.5 }}
            />

            <TextField
              label="Message"
              value={message}
              onChange={(e) => setMessage(e.target.value.slice(0, MAX_MESSAGE))}
              onBlur={() => touch("message")}
              placeholder="What's happening, when, and what they need to do"
              multiline
              minRows={4}
              maxRows={12}
              fullWidth
              error={!!show("message")}
              helperText={show("message") || `${message.length}/${MAX_MESSAGE}`}
            />
          </ComposeSection>

          <ComposeSection step={2} title="Who gets it">
            <Box sx={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 0.75, mb: 1.5 }}>
              {SCOPE_OPTIONS.map((o) => (
                <Choice key={o.value} active={scope === o.value} onClick={() => changeScope(o.value)} sx={{ display: "flex", alignItems: "flex-start", gap: 1, p: 1.25 }}>
                  <o.Icon sx={{ fontSize: 20, mt: 0.1 }} />
                  <Box sx={{ minWidth: 0 }}>
                    <Box sx={{ fontWeight: 700, fontSize: 14, color: scope === o.value ? "inherit" : "text.primary" }}>{o.label}</Box>
                    <Box sx={{ fontSize: 12, lineHeight: 1.35, opacity: 0.85 }}>{o.hint}</Box>
                  </Box>
                </Choice>
              ))}
            </Box>

            {(scope === "property" || scope === "room") && (
              <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: scope === "room" ? "repeat(2, minmax(0, 1fr))" : "minmax(0, 1fr)" }, gap: 1.5, mb: 1.5 }}>
                <TextField
                  select
                  fullWidth
                  label="Property"
                  value={selectedPropertyId}
                  onChange={(e) => {
                    setSelectedPropertyId(e.target.value);
                    setSelectedRoomNumber("");
                    setFormError("");
                  }}
                  onBlur={() => touch("property")}
                  error={!!show("property")}
                  helperText={show("property")}
                >
                  {properties.length === 0 && <MenuItem value="" disabled>No properties found</MenuItem>}
                  {properties.map((p) => (
                    <MenuItem key={p.id} value={p.id}>{propertyNameOf(p)}</MenuItem>
                  ))}
                </TextField>

                {scope === "room" && (
                  <TextField
                    select
                    fullWidth
                    label="Room"
                    value={availableRooms.includes(selectedRoomNumber) ? selectedRoomNumber : ""}
                    disabled={!selectedPropertyId || availableRooms.length === 0}
                    onChange={(e) => {
                      setSelectedRoomNumber(e.target.value);
                      setFormError("");
                    }}
                    onBlur={() => touch("room")}
                    error={!!show("room")}
                    helperText={show("room") || (selectedPropertyId && availableRooms.length === 0 ? "No one lives in this property yet." : "")}
                  >
                    {availableRooms.map((r) => (
                      <MenuItem key={r} value={r}>Room {r}</MenuItem>
                    ))}
                  </TextField>
                )}
              </Box>
            )}

            {scope === "individual" && (
              <Autocomplete
                options={personOptions}
                value={personOptions.find((u) => u.id === selectedRecipientId) || null}
                onChange={(_, v) => {
                  setSelectedRecipientId(v ? v.id : "");
                  setFormError("");
                }}
                onBlur={() => touch("person")}
                getOptionLabel={(u) => userName(u)}
                isOptionEqualToValue={(o, v) => o.id === v.id}
                noOptionsText={people.status === "loading" ? "Loading…" : "No one found"}
                sx={{ mb: 1.5 }}
                renderOption={(props, u) => {
                  const { key, ...rest } = props;
                  return (
                    <li key={key} {...rest}>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography variant="body2" sx={{ fontWeight: 700 }} noWrap>{userName(u)}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {roleOf(u) === "caretaker" ? "Caretaker" : "Tenant"}
                          {userRoom(u) ? ` · Room ${userRoom(u)}` : ""}
                          {userProp(u) ? ` · ${propertyName(userProp(u))}` : ""}
                        </Typography>
                      </Box>
                    </li>
                  );
                }}
                renderInput={(params) => (
                  <TextField {...params} label="Person" placeholder="Search by name" error={!!show("person")} helperText={show("person")} />
                )}
              />
            )}

            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, display: "block", mb: 0.75 }}>
              Audience
            </Typography>
            <Box sx={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 0.75 }}>
              {AUDIENCE_OPTIONS.map((o) => (
                <Choice
                  key={o.value}
                  active={targetAudience === o.value}
                  onClick={() => {
                    setTargetAudience(o.value);
                    setSelectedRecipientId("");
                    setFormError("");
                  }}
                  sx={{ height: 38, textAlign: "center", fontSize: 13.5, fontWeight: 700 }}
                >
                  {o.label}
                </Choice>
              ))}
            </Box>
          </ComposeSection>
        </DialogContent>

        {/* Footer: who it reaches + send */}
        <Box
          sx={{
            display: "flex",
            flexDirection: { xs: "column", sm: "row" },
            alignItems: { xs: "stretch", sm: "center" },
            gap: 1.25,
            px: { xs: 2, sm: 3 },
            py: 1.75,
            pb: { xs: "calc(14px + env(safe-area-inset-bottom))", sm: 1.75 },
            borderTop: "1px solid",
            borderColor: "divider",
            bgcolor: (t) => alpha(t.palette.background.paper, 0.35),
          }}
        >
          <Box sx={{ ...row, gap: 1, flex: 1, minWidth: 0, color: recipients.length ? "primary.main" : "text.secondary" }}>
            <GroupsOutlinedIcon fontSize="small" />
            <Typography variant="body2" sx={{ fontWeight: 700, color: "inherit" }}>{preview}</Typography>
          </Box>
          <Box sx={{ display: "flex", gap: 1 }}>
            <Button onClick={closeCompose} color="inherit" disabled={submitting} sx={{ fontWeight: 700, borderRadius: R.sm, flex: { xs: 1, sm: "none" } }}>
              Cancel
            </Button>
            <Button
              variant="contained"
              disableElevation
              onClick={handleSend}
              disabled={submitting || people.status !== "ready" || recipients.length === 0}
              startIcon={submitting ? <CircularProgress size={18} color="inherit" /> : <SendIcon />}
              sx={{ borderRadius: R.sm, fontWeight: 700, px: 3, flex: { xs: 1, sm: "none" } }}
            >
              {submitting ? "Sending…" : "Send"}
            </Button>
          </Box>
        </Box>
      </Dialog>

      <Snackbar
        open={toast.open}
        autoHideDuration={toast.severity === "success" ? 4000 : 8000}
        onClose={() => setToast((t) => ({ ...t, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        sx={{ bottom: { xs: `calc(${BOTTOM_NAV_H}px + 16px + env(safe-area-inset-bottom)) !important`, sm: undefined } }}
      >
        <Alert severity={toast.severity} variant="filled" onClose={() => setToast((t) => ({ ...t, open: false }))} sx={{ borderRadius: R.sm }}>
          {toast.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
