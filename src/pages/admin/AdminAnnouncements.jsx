import React, { useState, useEffect, useMemo } from "react";
import {
  Box,
  Container,
  Paper,
  Typography,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Stack,
  Chip,
  Alert,
  CircularProgress,
  IconButton,
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
import CampaignIcon from "@mui/icons-material/Campaign";
import SendIcon from "@mui/icons-material/Send";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutlined";
import GroupIcon from "@mui/icons-material/Group";
import InfoIcon from "@mui/icons-material/Info";
import WarningIcon from "@mui/icons-material/Warning";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ErrorIcon from "@mui/icons-material/Error";
import {
  collection,
  doc,
  query,
  orderBy,
  onSnapshot,
  getDocs,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "../../config/firebase";

const TITLE_MAX = 80;
const MESSAGE_MAX = 1000;
const BATCH_SIZE = 400; // Firestore allows 500 writes per batch

const AUDIENCES = [
  { value: "all", label: "All users", noun: "users" },
  { value: "owner", label: "Owners only", noun: "owners" },
  { value: "caretaker", label: "Caretakers only", noun: "caretakers" },
  { value: "tenant", label: "Tenants only", noun: "tenants" },
];

const TYPES = [
  { value: "info", label: "Info", color: "info", Icon: InfoIcon },
  { value: "warning", label: "Warning", color: "warning", Icon: WarningIcon },
  { value: "success", label: "Success", color: "success", Icon: CheckCircleIcon },
  { value: "error", label: "Urgent", color: "error", Icon: ErrorIcon },
];

const typeOf = (v) => TYPES.find((t) => t.value === v) || TYPES[0];
const audienceOf = (v) => AUDIENCES.find((a) => a.value === v) || AUDIENCES[0];
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

// Who can actually receive a broadcast: real app roles, not suspended / awaiting approval / rejected.
const isReachable = (u) =>
  ["owner", "caretaker", "tenant"].includes(u.role) &&
  u.status !== "suspended" &&
  u.status !== "pending" &&
  u.approvalStatus !== "pending" &&
  u.approvalStatus !== "rejected";

const chunk = (arr, size) => {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

const formatDate = (timestamp) => {
  if (!timestamp) return "N/A";
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  if (Number.isNaN(date.getTime())) return "N/A";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

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

  // UI state
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleteItem, setDeleteItem] = useState(null);
  const [alsoRemoveNotifs, setAlsoRemoveNotifs] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "success" });

  // History, live
  useEffect(() => {
    const q = query(collection(db, "announcements"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(
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
    return () => unsubscribe();
  }, []);

  // Users, once, so we can show "this will reach N people" before sending
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const snap = await getDocs(collection(db, "users"));
        if (!cancelled) setUsers(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch (err) {
        console.error("Error loading recipients:", err);
      } finally {
        if (!cancelled) setUsersLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const recipients = useMemo(
    () => users.filter((u) => isReachable(u) && (targetAudience === "all" || u.role === targetAudience)),
    [users, targetAudience]
  );

  const aud = audienceOf(targetAudience);
  const typeMeta = typeOf(type);
  const canSubmit = title.trim() && message.trim() && !submitting && !usersLoading && recipients.length > 0;

  const handlePublish = async () => {
    setSubmitting(true);
    const timestamp = new Date().toISOString();
    const cleanTitle = title.trim();
    const cleanMessage = message.trim();

    try {
      const annRef = doc(collection(db, "announcements"));
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
      }

      setTitle("");
      setMessage("");
      setTargetAudience("all");
      setType("info");
      setSnackbar({
        open: true,
        message: `Sent to ${plural(recipients.length, "person", "people")}.`,
        severity: "success",
      });
    } catch (err) {
      console.error("Error sending announcement:", err);
      setSnackbar({
        open: true,
        message: "Couldn't send the announcement. Please try again.",
        severity: "error",
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
        const snap = await getDocs(
          query(collection(db, "notifications"), where("announcementId", "==", deleteItem.id))
        );
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
      setSnackbar({
        open: true,
        message: alsoRemoveNotifs
          ? `Deleted, and removed from ${plural(removed, "inbox", "inboxes")}.`
          : "Removed from history.",
        severity: "info",
      });
    } catch (err) {
      console.error("Error deleting announcement:", err);
      setSnackbar({ open: true, message: "Couldn't delete the announcement.", severity: "error" });
    } finally {
      setDeleting(false);
      setDeleteItem(null);
    }
  };

  return (
    <Container maxWidth="xl" disableGutters>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" fontWeight="800" gutterBottom>
          Announcements
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Send a notice to owners, caretakers and tenants. It shows up in their notifications.
        </Typography>
      </Box>

      <Box
        sx={{
          display: "grid",
          gap: 3,
          gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "minmax(0, 5fr) minmax(0, 7fr)" },
          alignItems: "start",
        }}
      >
        {/* Composer */}
        <Paper elevation={0} sx={{ p: { xs: 2, sm: 3 }, border: "1px solid", borderColor: "divider", borderRadius: 3 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
            <CampaignIcon color="primary" />
            <Typography variant="h6" fontWeight="700">
              New announcement
            </Typography>
          </Box>

          <Stack
            component="form"
            spacing={2.5}
            onSubmit={(e) => {
              e.preventDefault();
              if (canSubmit) setConfirmOpen(true);
            }}
          >
            <TextField
              label="Title"
              placeholder="e.g., Scheduled maintenance this Saturday"
              value={title}
              onChange={(e) => setTitle(e.target.value.slice(0, TITLE_MAX))}
              required
              fullWidth
              size="small"
              helperText={`${title.length}/${TITLE_MAX}`}
            />

            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "repeat(2, minmax(0, 1fr))" }, gap: 2 }}>
              <FormControl fullWidth size="small">
                <InputLabel>Send to</InputLabel>
                <Select value={targetAudience} label="Send to" onChange={(e) => setTargetAudience(e.target.value)}>
                  {AUDIENCES.map((a) => (
                    <MenuItem key={a.value} value={a.value}>
                      {a.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl fullWidth size="small">
                <InputLabel>Importance</InputLabel>
                <Select value={type} label="Importance" onChange={(e) => setType(e.target.value)}>
                  {TYPES.map((t) => (
                    <MenuItem key={t.value} value={t.value}>
                      {t.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>

            <TextField
              label="Message"
              placeholder="Write the details here..."
              value={message}
              onChange={(e) => setMessage(e.target.value.slice(0, MESSAGE_MAX))}
              required
              multiline
              minRows={5}
              maxRows={12}
              fullWidth
              helperText={`${message.length}/${MESSAGE_MAX}`}
            />

            {usersLoading ? (
              <Skeleton variant="rounded" height={40} />
            ) : recipients.length === 0 ? (
              <Alert severity="warning" sx={{ borderRadius: 2 }}>
                No active {aud.noun} to send to yet.
              </Alert>
            ) : (
              <Typography variant="body2" color="text.secondary" sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                <GroupIcon fontSize="small" />
                Will reach <strong>{plural(recipients.length, "person", "people")}</strong>
                {targetAudience === "all" ? "" : ` (${aud.noun})`}. Suspended and unapproved accounts are skipped.
              </Typography>
            )}

            <Button
              type="submit"
              variant="contained"
              startIcon={<SendIcon />}
              disabled={!canSubmit}
              fullWidth
              sx={{ py: 1.2, borderRadius: 2 }}
            >
              Review &amp; send
            </Button>
          </Stack>
        </Paper>

        {/* History */}
        <Paper elevation={0} sx={{ p: { xs: 2, sm: 3 }, border: "1px solid", borderColor: "divider", borderRadius: 3, minWidth: 0 }}>
          <Typography variant="h6" fontWeight="700" sx={{ mb: 2 }}>
            Sent announcements ({announcements.length})
          </Typography>

          {loading ? (
            <Stack spacing={2}>
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} variant="rounded" height={110} />
              ))}
            </Stack>
          ) : announcements.length === 0 ? (
            <Box sx={{ textAlign: "center", py: 5 }}>
              <CampaignIcon sx={{ fontSize: 40, color: "text.disabled", mb: 1 }} />
              <Typography variant="body2" color="text.secondary">
                Nothing sent yet. Your announcements will be listed here.
              </Typography>
            </Box>
          ) : (
            <Stack spacing={1.5}>
              {announcements.map((item) => {
                const t = typeOf(item.type);
                const a = audienceOf(item.targetAudience);
                const TypeIcon = t.Icon;
                return (
                  <Box
                    key={item.id}
                    sx={{
                      p: 2,
                      border: "1px solid",
                      borderColor: "divider",
                      borderLeft: "4px solid",
                      borderLeftColor: `${t.color}.main`,
                      borderRadius: 2,
                    }}
                  >
                    <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1 }}>
                      <TypeIcon color={t.color} fontSize="small" sx={{ mt: 0.3 }} />
                      <Typography variant="subtitle1" fontWeight="700" sx={{ flex: 1, minWidth: 0, overflowWrap: "anywhere" }}>
                        {item.title}
                      </Typography>
                      <IconButton
                        size="small"
                        color="error"
                        aria-label="Delete announcement"
                        onClick={() => {
                          setAlsoRemoveNotifs(true);
                          setDeleteItem(item);
                        }}
                        sx={{ mt: -0.5, mr: -0.5 }}
                      >
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    </Box>

                    <Typography
                      variant="body2"
                      sx={{ mt: 0.75, mb: 1.5, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}
                    >
                      {item.message}
                    </Typography>

                    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 1 }}>
                      <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>
                        <Chip icon={<GroupIcon />} label={a.label} size="small" variant="outlined" />
                        {typeof item.recipientCount === "number" && (
                          <Chip label={plural(item.recipientCount, "recipient", "recipients")} size="small" variant="outlined" />
                        )}
                      </Stack>
                      <Typography variant="caption" color="text.secondary">
                        {formatDate(item.createdAt)}
                      </Typography>
                    </Box>
                  </Box>
                );
              })}
            </Stack>
          )}
        </Paper>
      </Box>

      {/* Confirm send */}
      <Dialog open={confirmOpen} onClose={() => !submitting && setConfirmOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Send this announcement?</DialogTitle>
        <DialogContent>
          <Box
            sx={(theme) => ({
              p: 1.5,
              mb: 2,
              borderRadius: 2,
              borderLeft: "4px solid",
              borderLeftColor: `${typeMeta.color}.main`,
              bgcolor: alpha(theme.palette[typeMeta.color].main, 0.08),
            })}
          >
            <Typography variant="subtitle2" fontWeight="700" sx={{ overflowWrap: "anywhere" }}>
              {title.trim()}
            </Typography>
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere", mt: 0.5, maxHeight: 140, overflow: "auto" }}
            >
              {message.trim()}
            </Typography>
          </Box>
          <DialogContentText>
            This goes to <strong>{plural(recipients.length, "person", "people")}</strong> right away. It can be
            deleted afterwards, but anyone who already read it will have seen it.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setConfirmOpen(false)} disabled={submitting}>
            Back
          </Button>
          <Button
            onClick={handlePublish}
            variant="contained"
            disabled={submitting}
            startIcon={submitting ? <CircularProgress size={18} color="inherit" /> : <SendIcon />}
          >
            {submitting ? "Sending..." : "Send now"}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete */}
      <Dialog open={Boolean(deleteItem)} onClose={() => !deleting && setDeleteItem(null)} fullWidth maxWidth="xs">
        <DialogTitle>Delete announcement?</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 1 }}>
            "{deleteItem?.title}" will be removed from the sent list.
          </DialogContentText>
          <FormControlLabel
            control={<Checkbox checked={alsoRemoveNotifs} onChange={(e) => setAlsoRemoveNotifs(e.target.checked)} />}
            label="Also remove it from users' notifications"
          />
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setDeleteItem(null)} disabled={deleting}>
            Cancel
          </Button>
          <Button onClick={handleDelete} color="error" variant="contained" disabled={deleting}>
            {deleting ? "Deleting..." : "Delete"}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        sx={{ bottom: { xs: "calc(80px + env(safe-area-inset-bottom, 0px)) !important", md: 24 } }}
      >
        <Alert severity={snackbar.severity} variant="filled" sx={{ borderRadius: 2 }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Container>
  );
}