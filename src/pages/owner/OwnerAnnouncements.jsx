// src/pages/owner/OwnerAnnouncements.jsx

import { useEffect, useMemo, useState } from "react";
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
  Fab,
  IconButton,
  InputBase,
  MenuItem,
  Paper,
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
import {
  addDoc,
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "../../config/firebase";
import { useAuth } from "../../context/AuthContext";

const BOTTOM_NAV_H = 64;
const row = { display: "flex", alignItems: "center" };
const MAX_TITLE = 80;
const MAX_MESSAGE = 1000;

const SCOPE_OPTIONS = [
  { value: "all", label: "All properties" },
  { value: "property", label: "One property" },
  { value: "room", label: "One room / space" },
  { value: "individual", label: "One person" },
];

const AUDIENCE_OPTIONS = [
  { value: "both", label: "Tenants & caretakers" },
  { value: "tenants", label: "Tenants only" },
  { value: "caretakers", label: "Caretakers only" },
];

// type -> label, tone, icon
const TYPES = {
  info: { label: "Info", tone: "info", Icon: InfoOutlinedIcon },
  warning: { label: "Warning", tone: "warning", Icon: WarningAmberOutlinedIcon },
  success: { label: "Good news", tone: "success", Icon: CheckCircleOutlinedIcon },
  error: { label: "Urgent", tone: "error", Icon: ErrorOutlinedIcon },
};
const typeOf = (t) => TYPES[t] || TYPES.info;

const FILTERS = ["all", "info", "warning", "success", "error"];

const cardSx = {
  bgcolor: "background.default",
  border: "1px solid",
  borderColor: "divider",
  borderRadius: 3,
};

const toMillis = (ts) => {
  if (!ts) return 0;
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  const n = d.getTime();
  return Number.isNaN(n) ? 0 : n;
};

const formatDate = (ts) => {
  const ms = toMillis(ts);
  if (!ms) return "Unknown date";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(ms));
};

const userProp = (u) => u.propertyId || u.assignedPropertyId;
const userRoom = (u) => u.roomId || u.roomNumber;
const userName = (u) => u.fullName || u.name || "Unnamed";

function Pill({ label, tone = "default", icon }) {
  return (
    <Chip
      label={label}
      icon={icon}
      size="small"
      sx={{
        fontWeight: 700,
        "& .MuiChip-icon": { fontSize: 16, ml: 0.75, color: "inherit" },
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

function AnnouncementCard({ a, scopeLabel }) {
  const [open, setOpen] = useState(false);
  const meta = typeOf(a.type);
  const long = (a.message || "").length > 220 || (a.message || "").split("\n").length > 4;

  return (
    <Paper
      elevation={0}
      sx={{
        ...cardSx,
        p: { xs: 2, sm: 2.5 },
        borderLeft: "4px solid",
        borderLeftColor: (t) => t.palette[meta.tone].main,
        minWidth: 0,
      }}
    >
      <Box sx={{ ...row, gap: 1, alignItems: "flex-start", justifyContent: "space-between" }}>
        <Typography sx={{ fontWeight: 800, overflowWrap: "anywhere", minWidth: 0 }}>{a.title}</Typography>
        <Box sx={{ flexShrink: 0 }}>
          <Pill label={meta.label} tone={meta.tone} icon={<meta.Icon />} />
        </Box>
      </Box>

      <Box sx={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 0.75, mt: 1 }}>
        <Pill label={scopeLabel} />
        <Pill label={(AUDIENCE_OPTIONS.find((o) => o.value === a.targetAudience) || AUDIENCE_OPTIONS[0]).label} />
        {typeof a.recipientCount === "number" && (
          <Pill
            icon={<GroupsOutlinedIcon />}
            label={`${a.recipientCount} ${a.recipientCount === 1 ? "recipient" : "recipients"}`}
          />
        )}
      </Box>

      <Typography
        variant="body2"
        color="text.secondary"
        sx={{
          mt: 1.5,
          whiteSpace: "pre-wrap",
          overflowWrap: "anywhere",
          ...(!open && long
            ? { display: "-webkit-box", WebkitLineClamp: 4, WebkitBoxOrient: "vertical", overflow: "hidden" }
            : {}),
        }}
      >
        {a.message}
      </Typography>

      <Box sx={{ ...row, justifyContent: "space-between", mt: 1.25, gap: 1 }}>
        <Typography variant="caption" color="text.secondary">
          {formatDate(a.createdAt)}
        </Typography>
        {long && (
          <Button size="small" onClick={() => setOpen((v) => !v)} sx={{ fontWeight: 700, minWidth: 0 }}>
            {open ? "Show less" : "Show more"}
          </Button>
        )}
      </Box>
    </Paper>
  );
}

export default function OwnerAnnouncements() {
  const { currentUser } = useAuth();
  const ownerId = currentUser?.uid;
  const theme = useTheme();
  const isPhone = useMediaQuery(theme.breakpoints.down("sm"));

  // composer
  const [composeOpen, setComposeOpen] = useState(false);
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
  const [properties, setProperties] = useState([]);
  const [users, setUsers] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState({ open: false, message: "", severity: "success" });

  // list controls
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");

  const notify = (message, severity = "success") => setToast({ open: true, message, severity });

  // Properties + people that belong to this owner (for targeting)
  useEffect(() => {
    if (!ownerId) return;
    (async () => {
      try {
        const [propsSnap, usersSnap] = await Promise.all([
          getDocs(query(collection(db, "properties"), where("ownerUid", "==", ownerId))),
          getDocs(query(collection(db, "users"), where("ownerUid", "==", ownerId))),
        ]);
        setProperties(propsSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setUsers(usersSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch (err) {
        console.error("Error fetching targeting metadata:", err);
      }
    })();
  }, [ownerId]);

  // History
  useEffect(() => {
    if (!ownerId) {
      setLoading(false);
      return undefined;
    }
    const q = query(collection(db, "owner_announcements"), where("ownerId", "==", ownerId));
    return onSnapshot(
      q,
      (snapshot) => {
        const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        list.sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
        setAnnouncements(list);
        setLoading(false);
      },
      (err) => {
        console.error("Error loading announcements:", err);
        setError("Could not load announcement history.");
        setLoading(false);
      }
    );
  }, [ownerId]);

  const propertyName = (id) => {
    const p = properties.find((x) => x.id === id);
    return p ? p.name || p.propertyName || "Property" : "Property";
  };

  const availableRooms = useMemo(() => {
    const rooms = new Set();
    users.forEach((u) => {
      const room = userRoom(u);
      if (room && (!selectedPropertyId || userProp(u) === selectedPropertyId)) rooms.add(room);
    });
    return Array.from(rooms);
  }, [users, selectedPropertyId]);

  // Same targeting rules as before, in one place so the preview and the send agree.
  const recipients = useMemo(
    () =>
      users.filter((u) => {
        const role = (u.role || "tenant").toLowerCase();
        if (targetAudience === "tenants" && role !== "tenant") return false;
        if (targetAudience === "caretakers" && role !== "caretaker") return false;
        if (scope === "all") return true;
        if (scope === "property") return !!selectedPropertyId && userProp(u) === selectedPropertyId;
        if (scope === "room")
          return !!selectedPropertyId && !!selectedRoomNumber && userProp(u) === selectedPropertyId && userRoom(u) === selectedRoomNumber;
        if (scope === "individual") return !!selectedRecipientId && u.id === selectedRecipientId;
        return false;
      }),
    [users, scope, targetAudience, selectedPropertyId, selectedRoomNumber, selectedRecipientId]
  );

  // People shown in the "one person" picker (role + property filtered)
  const personOptions = useMemo(
    () =>
      users.filter((u) => {
        const role = (u.role || "tenant").toLowerCase();
        if (targetAudience === "tenants" && role !== "tenant") return false;
        if (targetAudience === "caretakers" && role !== "caretaker") return false;
        return true;
      }),
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
  };

  const closeCompose = () => {
    if (submitting) return;
    setComposeOpen(false);
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

    try {
      const announcementRef = await addDoc(collection(db, "owner_announcements"), {
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
        recipientCount: recipients.length,
        type,
        createdAt: timestamp,
      });

      // Notifications in batches (Firestore caps a batch at 500 writes)
      for (let i = 0; i < recipients.length; i += 400) {
        const batch = writeBatch(db);
        recipients.slice(i, i + 400).forEach((r) => {
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
      }

      const n = recipients.length;
      resetForm();
      setComposeOpen(false);
      notify(`Sent to ${n} ${n === 1 ? "person" : "people"}.`);
    } catch (err) {
      console.error("Error sending announcement:", err);
      setFormError("The announcement could not be sent. Please try again.");
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
    }).length;
    return {
      total: announcements.length,
      thisMonth,
      urgent: announcements.filter((a) => a.type === "error").length,
      last: announcements[0] ? formatDate(announcements[0].createdAt).replace(/, \d{4}/, "") : "—",
    };
  }, [announcements]);

  const countFor = (f) => (f === "all" ? announcements.length : announcements.filter((a) => (a.type || "info") === f).length);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return announcements.filter((a) => {
      if (filter !== "all" && (a.type || "info") !== filter) return false;
      if (!q) return true;
      return `${a.title || ""} ${a.message || ""}`.toLowerCase().includes(q);
    });
  }, [announcements, filter, search]);

  const selectFieldProps = { select: true, fullWidth: true, size: "small" };
  const preview =
    recipients.length === 0
      ? "No matching recipients yet"
      : `Will reach ${recipients.length} ${recipients.length === 1 ? "person" : "people"}`;

  return (
    <Box>
      {/* Intro + desktop action */}
      <Box sx={{ ...row, justifyContent: "space-between", gap: 2, mb: { xs: 2, sm: 2.5 } }}>
        <Typography variant="body2" color="text.secondary">
          Broadcast updates to tenants and caretakers, or a single property, room or person.
        </Typography>
        {!isPhone && (
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setComposeOpen(true)}
            sx={{ borderRadius: 2.5, fontWeight: 700, flexShrink: 0, px: 2.5 }}
          >
            New announcement
          </Button>
        )}
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>{error}</Alert>}

      {loading ? (
        <>
          <Skeleton variant="rounded" height={72} sx={{ borderRadius: 3, mb: 2 }} />
          <Skeleton variant="rounded" height={150} sx={{ borderRadius: 3, mb: 1.5 }} />
          <Skeleton variant="rounded" height={150} sx={{ borderRadius: 3 }} />
        </>
      ) : (
        <>
          {announcements.length > 0 && (
            <SummaryStrip
              items={[
                { label: "Announcements", value: stats.total },
                { label: "This month", value: stats.thisMonth },
                { label: "Urgent", value: stats.urgent, color: stats.urgent > 0 ? "error.main" : undefined },
                { label: "Last sent", value: stats.last },
              ]}
            />
          )}

          {announcements.length > 0 && (
            <Box sx={{ mb: { xs: 2, sm: 2.5 } }}>
              {announcements.length > 5 && (
                <Paper
                  elevation={0}
                  sx={{ ...row, gap: 1, px: 1.5, ...cardSx, height: 46, mb: 1.5 }}
                >
                  <SearchIcon sx={{ color: "text.secondary" }} />
                  <InputBase
                    fullWidth
                    placeholder="Search title or message"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    inputProps={{ "aria-label": "Search announcements" }}
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
                {FILTERS.map((f) => (
                  <Chip
                    key={f}
                    label={`${f === "all" ? "All" : TYPES[f].label} · ${countFor(f)}`}
                    clickable
                    onClick={() => setFilter(f)}
                    color={filter === f ? "primary" : "default"}
                    variant={filter === f ? "filled" : "outlined"}
                    sx={{ fontWeight: 700, flexShrink: 0, height: 34, borderRadius: 17 }}
                  />
                ))}
              </Box>
            </Box>
          )}

          {visible.length === 0 ? (
            <Paper
              elevation={0}
              sx={{ ...cardSx, borderStyle: announcements.length === 0 ? "dashed" : "solid", py: { xs: 5, sm: 7 }, px: 3, textAlign: "center" }}
            >
              <Box sx={{ width: 64, height: 64, borderRadius: "50%", mx: "auto", mb: 2, ...row, justifyContent: "center", bgcolor: "rgba(255, 69, 0, 0.10)" }}>
                <CampaignOutlinedIcon sx={{ fontSize: 30, color: "primary.main" }} />
              </Box>
              <Typography sx={{ fontWeight: 700 }}>
                {announcements.length === 0 ? "No announcements yet" : "No announcements match"}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                {announcements.length === 0
                  ? "Send your first update, like a water interruption or a house meeting."
                  : "Try a different search or filter."}
              </Typography>
              {announcements.length > 0 && (
                <Button size="small" onClick={() => { setFilter("all"); setSearch(""); }} sx={{ mt: 1.5, fontWeight: 700 }}>
                  Clear filters
                </Button>
              )}
            </Paper>
          ) : (
            <Box sx={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: { xs: 1.5, sm: 2 } }}>
              {visible.map((a) => (
                <AnnouncementCard key={a.id} a={a} scopeLabel={scopeLabelFor(a)} />
              ))}
            </Box>
          )}
        </>
      )}

      {/* Phone FAB */}
      {isPhone && !composeOpen && (
        <Fab
          color="primary"
          variant="extended"
          onClick={() => setComposeOpen(true)}
          aria-label="New announcement"
          sx={{
            position: "fixed",
            right: 16,
            bottom: `calc(${BOTTOM_NAV_H}px + 16px + env(safe-area-inset-bottom))`,
            fontWeight: 700,
            textTransform: "none",
          }}
        >
          <AddIcon sx={{ mr: 0.75 }} /> New
        </Fab>
      )}

      {/* Composer */}
      <Dialog
        open={composeOpen}
        onClose={closeCompose}
        fullScreen={isPhone}
        fullWidth
        maxWidth="sm"
        PaperProps={{ sx: { borderRadius: isPhone ? 0 : 3, bgcolor: "background.default" } }}
      >
        <DialogTitle sx={{ ...row, justifyContent: "space-between", fontWeight: 800 }}>
          New announcement
          <IconButton onClick={closeCompose} aria-label="Close" size="small" disabled={submitting}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        <DialogContent dividers>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2.25, pt: 0.5 }}>
            {formError && <Alert severity="error" sx={{ borderRadius: 2 }}>{formError}</Alert>}

            <TextField
              label="Title"
              value={title}
              onChange={(e) => setTitle(e.target.value.slice(0, MAX_TITLE))}
              onBlur={() => touch("title")}
              placeholder="e.g. Scheduled water interruption"
              fullWidth
              size="small"
              error={!!show("title")}
              helperText={show("title") || `${title.length}/${MAX_TITLE}`}
            />

            {/* Type as tappable chips */}
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                Type
              </Typography>
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mt: 0.75 }}>
                {Object.entries(TYPES).map(([key, t]) => {
                  const active = type === key;
                  return (
                    <Chip
                      key={key}
                      label={t.label}
                      icon={<t.Icon />}
                      clickable
                      onClick={() => setType(key)}
                      variant="outlined"
                      sx={{
                        fontWeight: 700,
                        height: 34,
                        borderRadius: 17,
                        "& .MuiChip-icon": { color: "inherit" },
                        borderColor: (th) => (active ? th.palette[t.tone].main : th.palette.divider),
                        bgcolor: (th) => (active ? alpha(th.palette[t.tone].main, 0.13) : "transparent"),
                        color: (th) => (active ? th.palette[t.tone].dark : th.palette.text.secondary),
                      }}
                    />
                  );
                })}
              </Box>
            </Box>

            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "repeat(2, minmax(0, 1fr))" }, gap: 2 }}>
              <TextField
                {...selectFieldProps}
                label="Send to"
                value={scope}
                onChange={(e) => {
                  setScope(e.target.value);
                  setSelectedPropertyId("");
                  setSelectedRoomNumber("");
                  setSelectedRecipientId("");
                }}
              >
                {SCOPE_OPTIONS.map((o) => (
                  <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
                ))}
              </TextField>

              <TextField
                {...selectFieldProps}
                label="Audience"
                value={targetAudience}
                onChange={(e) => {
                  setTargetAudience(e.target.value);
                  setSelectedRecipientId("");
                }}
              >
                {AUDIENCE_OPTIONS.map((o) => (
                  <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
                ))}
              </TextField>
            </Box>

            {(scope === "property" || scope === "room") && (
              <TextField
                {...selectFieldProps}
                label="Property"
                value={selectedPropertyId}
                onChange={(e) => {
                  setSelectedPropertyId(e.target.value);
                  setSelectedRoomNumber("");
                }}
                onBlur={() => touch("property")}
                error={!!show("property")}
                helperText={show("property")}
              >
                {properties.length === 0 && <MenuItem value="" disabled>No properties found</MenuItem>}
                {properties.map((p) => (
                  <MenuItem key={p.id} value={p.id}>{p.name || p.propertyName || "Property"}</MenuItem>
                ))}
              </TextField>
            )}

            {scope === "room" && (
              <TextField
                {...selectFieldProps}
                label="Room"
                value={selectedRoomNumber}
                disabled={!selectedPropertyId}
                onChange={(e) => setSelectedRoomNumber(e.target.value)}
                onBlur={() => touch("room")}
                error={!!show("room")}
                helperText={show("room") || (selectedPropertyId && availableRooms.length === 0 ? "No occupied rooms in this property." : "")}
              >
                {availableRooms.map((r) => (
                  <MenuItem key={r} value={r}>Room {r}</MenuItem>
                ))}
              </TextField>
            )}

            {scope === "individual" && (
              <TextField
                {...selectFieldProps}
                label="Person"
                value={selectedRecipientId}
                onChange={(e) => setSelectedRecipientId(e.target.value)}
                onBlur={() => touch("person")}
                error={!!show("person")}
                helperText={show("person")}
              >
                {personOptions.length === 0 && <MenuItem value="" disabled>No people found</MenuItem>}
                {personOptions.map((u) => (
                  <MenuItem key={u.id} value={u.id}>
                    {userName(u)} · {u.role || "tenant"}
                    {userRoom(u) ? ` · Room ${userRoom(u)}` : ""}
                  </MenuItem>
                ))}
              </TextField>
            )}

            <TextField
              label="Message"
              value={message}
              onChange={(e) => setMessage(e.target.value.slice(0, MAX_MESSAGE))}
              onBlur={() => touch("message")}
              placeholder="Write the announcement details..."
              multiline
              minRows={5}
              maxRows={12}
              fullWidth
              error={!!show("message")}
              helperText={show("message") || `${message.length}/${MAX_MESSAGE}`}
            />

            <Box
              sx={{
                ...row,
                gap: 1,
                px: 1.5,
                py: 1,
                borderRadius: 2,
                bgcolor: recipients.length ? "rgba(255, 69, 0, 0.08)" : (t) => alpha(t.palette.text.primary, 0.05),
              }}
            >
              <GroupsOutlinedIcon fontSize="small" sx={{ color: recipients.length ? "primary.main" : "text.secondary" }} />
              <Typography variant="body2" sx={{ fontWeight: 700, color: recipients.length ? "primary.main" : "text.secondary" }}>
                {preview}
              </Typography>
            </Box>
          </Box>
        </DialogContent>

        <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
          <Button onClick={closeCompose} disabled={submitting} sx={{ fontWeight: 700 }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSend}
            disabled={submitting}
            startIcon={submitting ? <CircularProgress size={18} color="inherit" /> : <SendIcon />}
            sx={{ borderRadius: 2.5, fontWeight: 700, px: 3 }}
          >
            {submitting ? "Sending..." : "Send"}
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