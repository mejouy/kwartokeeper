import { useState, useEffect, useMemo } from "react";
import {
  Box,
  Typography,
  Button,
  TextField,
  Alert,
  CircularProgress,
  IconButton,
  InputBase,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  FormControlLabel,
  Checkbox,
  Snackbar,
  Skeleton,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import CampaignOutlinedIcon from "@mui/icons-material/CampaignOutlined";
import SendIcon from "@mui/icons-material/Send";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutlined";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import WarningAmberOutlinedIcon from "@mui/icons-material/WarningAmberOutlined";
import CheckCircleOutlinedIcon from "@mui/icons-material/CheckCircleOutlined";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutlined";
import CalendarMonthOutlinedIcon from "@mui/icons-material/CalendarMonthOutlined";
import ScheduleOutlinedIcon from "@mui/icons-material/ScheduleOutlined";
import SearchIcon from "@mui/icons-material/Search";
import CloseIcon from "@mui/icons-material/Close";
import EditNoteOutlinedIcon from "@mui/icons-material/EditNoteOutlined";
import { collection, doc, query, orderBy, onSnapshot, getDocs, where, writeBatch } from "firebase/firestore";
import { auth, db } from "../../config/firebase";
import { ownerAccessOf } from "../../utils/ownerAccess";
import { normalizeStatus } from "../../utils/tenantRent";
import { HeaderCard, Panel, Pill, FilterPills } from "./adminUi";
import { isRemovedAccount } from "../../utils/accountState";

const HEAD = '"Inter", sans-serif';
const R = { sm: "10px", md: "14px", lg: "18px", xl: "22px" };
const TITLE_MAX = 80;
const MESSAGE_MAX = 1000;
const BATCH_SIZE = 400; // Firestore allows 500 writes per batch
const PAGE = 8;
const fieldSx = { "& .MuiOutlinedInput-root": { borderRadius: R.sm } };

const AUDIENCES = [
  { value: "all", label: "Everyone", noun: "users" },
  { value: "owner", label: "Owners", noun: "owners" },
  { value: "caretaker", label: "Caretakers", noun: "caretakers" },
  { value: "tenant", label: "Tenants", noun: "tenants" },
];

const TYPES = [
  { value: "info", label: "Info", tone: "info", Icon: InfoOutlinedIcon },
  { value: "warning", label: "Warning", tone: "warning", Icon: WarningAmberOutlinedIcon },
  { value: "success", label: "Good news", tone: "success", Icon: CheckCircleOutlinedIcon },
  { value: "error", label: "Urgent", tone: "error", Icon: ErrorOutlineIcon },
];

const typeOf = (v) => TYPES.find((t) => t.value === v) || TYPES[0];
const audienceOf = (v) => AUDIENCES.find((a) => a.value === v) || AUDIENCES[0];
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

// Who can receive a broadcast: approved owners, current tenants, active caretakers
const isReachable = (u) => {
  if (isRemovedAccount(u)) return false;
  if (u.role === "owner") return ownerAccessOf(u) === "active";
  if (u.role === "tenant") return normalizeStatus(u.status) !== "Inactive";
  if (u.role === "caretaker") return !/inactive|suspend|archiv/i.test(String(u.status || ""));
  return false;
};

const chunk = (arr, size) => {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

const toMillis = (ts) => {
  if (!ts) return 0;
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return Number.isNaN(d.getTime()) ? 0 : d.getTime();
};
const formatDate = (ts, withTime = true) => {
  const ms = toMillis(ts);
  if (!ms) return "—";
  return new Date(ms).toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", ...(withTime ? { hour: "numeric", minute: "2-digit" } : {}) });
};

function Choice({ active, tone = "primary", onClick, children, sx }) {
  return (
    <Box
      component="button"
      type="button"
      onClick={onClick}
      aria-pressed={active}
      sx={{
        minWidth: 0,
        font: "inherit",
        cursor: "pointer",
        borderRadius: R.sm,
        border: "1.5px solid",
        borderColor: (t) => (active ? t.palette[tone].main : t.palette.divider),
        bgcolor: (t) => (active ? alpha(t.palette[tone].main, 0.08) : "transparent"),
        color: (t) => (active ? t.palette[tone].dark : t.palette.text.secondary),
        fontWeight: 700,
        transition: "border-color .15s, background-color .15s",
        "&:hover": { borderColor: (t) => (active ? t.palette[tone].main : alpha(t.palette.text.primary, 0.3)) },
        ...sx,
      }}
    >
      {children}
    </Box>
  );
}

function HistoryItem({ item, onDelete }) {
  const [open, setOpen] = useState(false);
  const t = typeOf(item.type);
  const a = audienceOf(item.targetAudience);
  const long = String(item.message || "").length > 220;
  return (
    <Box sx={{ display: "flex", gap: 1.5, p: { xs: 1.5, sm: 2 }, border: "1px solid", borderColor: "divider", borderRadius: R.md, minWidth: 0 }}>
      <Box sx={{ width: 36, height: 36, flexShrink: 0, borderRadius: R.sm, display: { xs: "none", sm: "grid" }, placeItems: "center", bgcolor: (th) => alpha(th.palette[t.tone].main, 0.12), color: `${t.tone}.dark` }}>
        <t.Icon sx={{ fontSize: 19 }} />
      </Box>
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1 }}>
          <Typography sx={{ fontWeight: 800, flex: 1, minWidth: 0, overflowWrap: "anywhere", lineHeight: 1.35 }}>{item.title}</Typography>
          <IconButton size="small" aria-label="Delete announcement" onClick={() => onDelete(item)} sx={{ mt: -0.5, mr: -0.5, color: "text.secondary", "&:hover": { color: "error.main" } }}>
            <DeleteOutlineIcon fontSize="small" />
          </IconButton>
        </Box>
        <Typography variant="caption" color="text.secondary" component="div" sx={{ mt: 0.25 }}>
          {formatDate(item.createdAt)} · {a.label}
        </Typography>
        <Typography
          variant="body2"
          sx={{ mt: 1, whiteSpace: "pre-wrap", overflowWrap: "anywhere", opacity: 0.85, ...(!open && long ? { display: "-webkit-box", WebkitLineClamp: 4, WebkitBoxOrient: "vertical", overflow: "hidden" } : {}) }}
        >
          {item.message}
        </Typography>
        <Box sx={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 0.75, mt: 1.25 }}>
          <Pill label={t.label} tone={t.tone} icon={<t.Icon />} />
          {typeof item.recipientCount === "number" && <Pill label={`Sent to ${plural(item.recipientCount, "person", "people")}`} icon={<GroupsOutlinedIcon />} />}
          {long && (
            <Button size="small" onClick={() => setOpen((v) => !v)} sx={{ ml: "auto", fontWeight: 700, minHeight: 30, py: 0 }}>
              {open ? "Show less" : "Show more"}
            </Button>
          )}
        </Box>
      </Box>
    </Box>
  );
}

export default function AdminAnnouncements() {
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [targetAudience, setTargetAudience] = useState("all");
  const [type, setType] = useState("info");

  // History controls
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [shown, setShown] = useState(PAGE);

  // UI state
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleteItem, setDeleteItem] = useState(null);
  const [alsoRemoveNotifs, setAlsoRemoveNotifs] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "success" });

  // History, live
  useEffect(() => {
    const q = query(collection(db, "announcements"), orderBy("createdAt", "desc"));
    return onSnapshot(
      q,
      (snapshot) => {
        setAnnouncements(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      (err) => {
        console.error("Error fetching announcements:", err);
        setLoading(false);
      }
    );
  }, []);

  // Users, once, so we can show "this will reach N people" before sending
  useEffect(() => {
    let cancelled = false;
    getDocs(collection(db, "users"))
      .then((snap) => !cancelled && setUsers(snap.docs.map((d) => ({ id: d.id, ...d.data() }))))
      .catch((err) => console.error("Error loading recipients:", err))
      .finally(() => !cancelled && setUsersLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  const reachable = useMemo(() => users.filter(isReachable), [users]);
  const audienceCount = (value) => reachable.filter((u) => value === "all" || u.role === value).length;
  const recipients = useMemo(() => reachable.filter((u) => targetAudience === "all" || u.role === targetAudience), [reachable, targetAudience]);

  const aud = audienceOf(targetAudience);
  const typeMeta = typeOf(type);
  const canSubmit = title.trim() && message.trim() && !submitting && !usersLoading && recipients.length > 0;

  const stats = useMemo(() => {
    const now = new Date();
    const thisMonth = announcements.filter((a) => {
      const ms = toMillis(a.createdAt);
      if (!ms) return false;
      const d = new Date(ms);
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    });
    return {
      monthName: now.toLocaleDateString(undefined, { month: "long" }),
      thisMonth: thisMonth.length,
      reached: thisMonth.reduce((n, a) => n + (Number(a.recipientCount) || 0), 0),
      last: announcements[0] ? formatDate(announcements[0].createdAt, false) : "Nothing yet",
    };
  }, [announcements]);

  const counts = useMemo(() => {
    const c = { all: announcements.length };
    announcements.forEach((a) => {
      const k = typeOf(a.type).value;
      c[k] = (c[k] || 0) + 1;
    });
    return c;
  }, [announcements]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return announcements.filter((a) => (filter === "all" || typeOf(a.type).value === filter) && (!q || `${a.title || ""} ${a.message || ""}`.toLowerCase().includes(q)));
  }, [announcements, filter, search]);

  const handlePublish = async () => {
    setSubmitting(true);
    const timestamp = new Date().toISOString();
    const cleanTitle = title.trim();
    const cleanMessage = message.trim();
    const annRef = doc(collection(db, "announcements"));
    let sent = 0;
    try {
      const groups = chunk(recipients, BATCH_SIZE);
      for (let i = 0; i < groups.length; i++) {
        const batch = writeBatch(db);
        // The history entry goes in the first batch, so it only exists if delivery started.
        if (i === 0) {
          batch.set(annRef, {
            title: cleanTitle,
            message: cleanMessage,
            targetAudience,
            type,
            recipientCount: recipients.length,
            createdAt: timestamp,
            createdBy: "Admin",
            createdByUid: auth.currentUser?.uid || null,
          });
        }
        groups[i].forEach((u) => {
          batch.set(doc(collection(db, "notifications")), {
            userId: u.id,
            title: cleanTitle,
            message: cleanMessage,
            type,
            announcementId: annRef.id,
            isRead: false,
            createdAt: timestamp,
          });
        });
        await batch.commit();
        sent += groups[i].length;
      }
      setTitle("");
      setMessage("");
      setTargetAudience("all");
      setType("info");
      setSnackbar({ open: true, message: `Sent to ${plural(recipients.length, "person", "people")}.`, severity: "success" });
    } catch (err) {
      console.error("Error sending announcement:", err);
      setSnackbar({
        open: true,
        message: sent > 0 ? `Only ${sent} of ${recipients.length} people received it. Check your connection and send it again.` : "Couldn't send the announcement. Please try again.",
        severity: sent > 0 ? "warning" : "error",
      });
    } finally {
      setSubmitting(false);
      setConfirmOpen(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteItem) return;
    setDeleting(true);
    try {
      let removed = 0;
      if (alsoRemoveNotifs) {
        const snap = await getDocs(query(collection(db, "notifications"), where("announcementId", "==", deleteItem.id)));
        for (const group of chunk(snap.docs, BATCH_SIZE)) {
          const batch = writeBatch(db);
          group.forEach((d) => batch.delete(d.ref));
          await batch.commit();
          removed += group.length;
        }
      }
      const batch = writeBatch(db);
      batch.delete(doc(db, "announcements", deleteItem.id));
      await batch.commit();
      setSnackbar({ open: true, message: alsoRemoveNotifs ? `Deleted, and removed from ${plural(removed, "inbox", "inboxes")}.` : "Removed from history.", severity: "info" });
    } catch (err) {
      console.error("Error deleting announcement:", err);
      setSnackbar({ open: true, message: "Couldn't delete the announcement.", severity: "error" });
    } finally {
      setDeleting(false);
      setDeleteItem(null);
    }
  };

  return (
    <Box sx={{ maxWidth: 1200, mx: "auto" }}>
      <HeaderCard
        description="Send a notice to owners, caretakers and tenants. It appears in their notifications right away."
        tiles={[
          { label: "Sent", value: announcements.length, sub: "All time", icon: <CampaignOutlinedIcon /> },
          { label: `In ${stats.monthName}`, value: stats.thisMonth, sub: plural(stats.reached, "person reached", "people reached"), icon: <CalendarMonthOutlinedIcon /> },
          { label: "Can reach", value: usersLoading ? "…" : reachable.length, sub: "Active accounts", icon: <GroupsOutlinedIcon /> },
          { label: "Last sent", value: stats.last, icon: <ScheduleOutlinedIcon /> },
        ]}
      />

      <Box sx={{ display: "grid", gap: { xs: 2, md: 2.5 }, gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "minmax(0, 5fr) minmax(0, 7fr)" }, alignItems: "start" }}>
        {/* Composer */}
        <Panel title="New announcement" icon={<EditNoteOutlinedIcon />} sx={{ position: { md: "sticky" }, top: { md: 96 } }}>
          <Box
            component="form"
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              if (canSubmit) setConfirmOpen(true);
            }}
            sx={{ display: "flex", flexDirection: "column", gap: 2 }}
          >
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, display: "block", mb: 0.75 }}>
                Send to
              </Typography>
              <Box sx={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 0.75 }}>
                {AUDIENCES.map((a) => (
                  <Choice key={a.value} active={targetAudience === a.value} onClick={() => setTargetAudience(a.value)} sx={{ p: 1, textAlign: "left" }}>
                    <Box sx={{ fontSize: 14, color: targetAudience === a.value ? "inherit" : "text.primary" }}>{a.label}</Box>
                    <Box sx={{ fontSize: 12, fontWeight: 600, opacity: 0.8 }}>{usersLoading ? "…" : plural(audienceCount(a.value), "person", "people")}</Box>
                  </Choice>
                ))}
              </Box>
            </Box>

            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, display: "block", mb: 0.75 }}>
                Type
              </Typography>
              <Box sx={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 0.75 }}>
                {TYPES.map((t) => (
                  <Choice key={t.value} active={type === t.value} tone={t.tone} onClick={() => setType(t.value)} sx={{ height: 40, display: "flex", alignItems: "center", justifyContent: "center", gap: 0.75, fontSize: 13.5 }}>
                    <t.Icon sx={{ fontSize: 18 }} />
                    {t.label}
                  </Choice>
                ))}
              </Box>
            </Box>

            <TextField
              label="Title"
              placeholder="e.g. Scheduled maintenance this Saturday"
              value={title}
              onChange={(e) => setTitle(e.target.value.slice(0, TITLE_MAX))}
              required
              fullWidth
              helperText={`${title.length}/${TITLE_MAX}`}
              sx={fieldSx}
            />
            <TextField
              label="Message"
              placeholder="What's happening, when, and what people need to do"
              value={message}
              onChange={(e) => setMessage(e.target.value.slice(0, MESSAGE_MAX))}
              required
              multiline
              minRows={5}
              maxRows={12}
              fullWidth
              helperText={`${message.length}/${MESSAGE_MAX}`}
              sx={fieldSx}
            />

            {usersLoading ? (
              <Skeleton variant="rounded" height={44} sx={{ borderRadius: R.sm }} />
            ) : recipients.length === 0 ? (
              <Alert severity="warning" sx={{ borderRadius: R.sm }}>
                No active {aud.noun} to send to yet.
              </Alert>
            ) : (
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, p: 1.25, borderRadius: R.sm, bgcolor: (t) => alpha(t.palette.primary.main, 0.06), color: "primary.main" }}>
                <GroupsOutlinedIcon fontSize="small" />
                <Typography variant="body2" sx={{ fontWeight: 700, color: "inherit" }}>
                  Reaches {plural(recipients.length, "person", "people")}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ ml: "auto", display: { xs: "none", sm: "block" } }}>
                  Suspended and unapproved accounts are skipped
                </Typography>
              </Box>
            )}

            <Button type="submit" variant="contained" disableElevation startIcon={<SendIcon />} disabled={!canSubmit} fullWidth sx={{ minHeight: 46, fontWeight: 700, borderRadius: R.sm }}>
              Review &amp; send
            </Button>
          </Box>
        </Panel>

        {/* History */}
        <Panel title={`Sent announcements · ${announcements.length}`} icon={<CampaignOutlinedIcon />}>
          {announcements.length > 0 && (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1.25, mb: 2 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, px: 1.5, height: 42, border: "1px solid", borderColor: "divider", borderRadius: R.sm }}>
                <SearchIcon sx={{ color: "text.secondary", fontSize: 20 }} />
                <InputBase
                  fullWidth
                  placeholder="Search title or message"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setShown(PAGE);
                  }}
                  inputProps={{ "aria-label": "Search announcements" }}
                  sx={{ fontSize: 14.5 }}
                />
                {search && (
                  <IconButton size="small" aria-label="Clear search" onClick={() => setSearch("")}>
                    <CloseIcon fontSize="small" />
                  </IconButton>
                )}
              </Box>
              <FilterPills
                value={filter}
                onChange={(v) => {
                  setFilter(v);
                  setShown(PAGE);
                }}
                options={[{ id: "all", label: "All", count: counts.all }, ...TYPES.filter((t) => counts[t.value]).map((t) => ({ id: t.value, label: t.label, count: counts[t.value] }))]}
              />
            </Box>
          )}

          {loading ? (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} variant="rounded" height={110} sx={{ borderRadius: R.md }} />
              ))}
            </Box>
          ) : announcements.length === 0 ? (
            <Box sx={{ textAlign: "center", py: 5 }}>
              <Box sx={{ width: 56, height: 56, borderRadius: R.md, mx: "auto", mb: 1.5, display: "grid", placeItems: "center", bgcolor: "rgba(255,69,0,.1)", color: "primary.main" }}>
                <CampaignOutlinedIcon />
              </Box>
              <Typography sx={{ fontFamily: HEAD, fontWeight: 800 }}>Nothing sent yet</Typography>
              <Typography variant="body2" color="text.secondary">
                Your announcements will be listed here.
              </Typography>
            </Box>
          ) : visible.length === 0 ? (
            <Box sx={{ textAlign: "center", py: 4 }}>
              <Typography sx={{ fontWeight: 700 }}>No announcements match</Typography>
              <Button
                size="small"
                onClick={() => {
                  setFilter("all");
                  setSearch("");
                }}
                sx={{ mt: 1, fontWeight: 700 }}
              >
                Clear filters
              </Button>
            </Box>
          ) : (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1.25 }}>
              {visible.slice(0, shown).map((item) => (
                <HistoryItem
                  key={item.id}
                  item={item}
                  onDelete={(it) => {
                    setAlsoRemoveNotifs(true);
                    setDeleteItem(it);
                  }}
                />
              ))}
              {visible.length > PAGE && (
                <Box sx={{ textAlign: "center" }}>
                  <Button size="small" onClick={() => setShown((n) => (n >= visible.length ? PAGE : n + PAGE))} sx={{ fontWeight: 700, borderRadius: 99, minHeight: 36, px: 1.75 }}>
                    {shown >= visible.length ? "Show fewer" : `Show ${Math.min(PAGE, visible.length - shown)} more`}
                  </Button>
                </Box>
              )}
            </Box>
          )}
        </Panel>
      </Box>

      {/* Confirm send */}
      <Dialog open={confirmOpen} onClose={() => !submitting && setConfirmOpen(false)} fullWidth maxWidth="xs" slotProps={{ paper: { sx: { borderRadius: R.xl } } }}>
        <DialogTitle sx={{ fontFamily: HEAD, fontWeight: 800 }}>Send this announcement?</DialogTitle>
        <DialogContent>
          <Box sx={{ p: 1.5, mb: 2, borderRadius: R.sm, borderLeft: "4px solid", borderLeftColor: `${typeMeta.tone}.main`, bgcolor: (t) => alpha(t.palette[typeMeta.tone].main, 0.08) }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 800, overflowWrap: "anywhere" }}>
              {title.trim()}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", mt: 0.5, maxHeight: 140, overflow: "auto" }}>
              {message.trim()}
            </Typography>
          </Box>
          <DialogContentText>
            This goes to <strong>{plural(recipients.length, "person", "people")}</strong> ({aud.label.toLowerCase()}) right away. You can delete it afterwards, but anyone who already read it will have seen it.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Button onClick={() => setConfirmOpen(false)} color="inherit" disabled={submitting} sx={{ fontWeight: 700 }}>
            Back
          </Button>
          <Button onClick={handlePublish} variant="contained" disableElevation disabled={submitting} startIcon={submitting ? <CircularProgress size={18} color="inherit" /> : <SendIcon />} sx={{ fontWeight: 700, borderRadius: R.sm }}>
            {submitting ? "Sending…" : "Send now"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete */}
      <Dialog open={Boolean(deleteItem)} onClose={() => !deleting && setDeleteItem(null)} fullWidth maxWidth="xs" slotProps={{ paper: { sx: { borderRadius: R.xl } } }}>
        <DialogTitle sx={{ fontFamily: HEAD, fontWeight: 800 }}>Delete announcement?</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 1 }}>&ldquo;{deleteItem?.title}&rdquo; will be removed from the sent list.</DialogContentText>
          <FormControlLabel control={<Checkbox checked={alsoRemoveNotifs} onChange={(e) => setAlsoRemoveNotifs(e.target.checked)} />} label="Also remove it from people's notifications" />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Button onClick={() => setDeleteItem(null)} color="inherit" disabled={deleting} sx={{ fontWeight: 700 }}>
            Cancel
          </Button>
          <Button onClick={handleDelete} color="error" variant="contained" disableElevation disabled={deleting} sx={{ fontWeight: 700, borderRadius: R.sm }}>
            {deleting ? "Deleting…" : "Delete"}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        sx={{ bottom: { xs: "calc(84px + env(safe-area-inset-bottom, 0px)) !important", md: 24 } }}
      >
        <Alert severity={snackbar.severity} variant="filled" sx={{ borderRadius: R.sm }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
