import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Container,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Snackbar,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import CampaignIcon from "@mui/icons-material/Campaign";
import SendIcon from "@mui/icons-material/Send";
import InfoIcon from "@mui/icons-material/Info";
import WarningIcon from "@mui/icons-material/Warning";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ErrorIcon from "@mui/icons-material/Error";
import {
  addDoc,
  collection,
  getDocs,
  onSnapshot,
  query,
  where,
} from "firebase/firestore";
import { db } from "../../config/firebase";
import { useAuth } from "../../context/AuthContext";

const AUDIENCE_OPTIONS = [
  { value: "tenants", label: "Tenants only" },
  { value: "caretakers", label: "Caretakers only" },
  { value: "both", label: "Tenants and caretakers" },
];

export default function OwnerAnnouncements() {
  const { currentUser } = useAuth();
  const ownerId = currentUser?.uid;

  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [targetAudience, setTargetAudience] = useState("tenants");
  const [type, setType] = useState("info");
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "success" });

  const audienceRoles = useMemo(() => {
    if (targetAudience === "tenants") return ["tenant"];
    if (targetAudience === "caretakers") return ["caretaker"];
    return ["tenant", "caretaker"];
  }, [targetAudience]);

  useEffect(() => {
    if (!ownerId) {
      setLoading(false);
      return undefined;
    }

    // Single-field equality query (No composite index required)
    const ownerAnnouncementsQuery = query(
      collection(db, "owner_announcements"),
      where("ownerId", "==", ownerId)
    );

    const unsubscribe = onSnapshot(
      ownerAnnouncementsQuery,
      (snapshot) => {
        const fetchedDocs = snapshot.docs.map((document) => ({
          id: document.id,
          ...document.data(),
        }));

        // Client-side sorting by createdAt (descending)
        fetchedDocs.sort((a, b) => {
          const timeA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : new Date(a.createdAt || 0).getTime();
          const timeB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : new Date(b.createdAt || 0).getTime();
          return timeB - timeA;
        });

        setAnnouncements(fetchedDocs);
        setLoading(false);
      },
      (snapshotError) => {
        console.error("Error loading owner announcements:", snapshotError);
        setError("Could not load announcement history. Please verify database permissions.");
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [ownerId]);

  const formatDate = (timestamp) => {
    if (!timestamp) return "N/A";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return Number.isNaN(date.getTime())
      ? "N/A"
      : date.toLocaleString(undefined, {
          month: "short",
          day: "numeric",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });
  };

  const getTypeIcon = (severity) => {
    switch (severity) {
      case "warning":
        return <WarningIcon color="warning" fontSize="small" />;
      case "success":
        return <CheckCircleIcon color="success" fontSize="small" />;
      case "error":
        return <ErrorIcon color="error" fontSize="small" />;
      default:
        return <InfoIcon color="info" fontSize="small" />;
    }
  };

  const handleCreateAnnouncement = async (event) => {
    event.preventDefault();
    if (!ownerId || !title.trim() || !message.trim()) return;

    setSubmitting(true);
    setError("");
    const timestamp = new Date().toISOString();

    try {
      const [propertiesSnapshot, usersSnapshot] = await Promise.all([
        getDocs(query(collection(db, "properties"), where("ownerUid", "==", ownerId))),
        getDocs(query(collection(db, "users"), where("ownerUid", "==", ownerId))),
      ]);

      const ownedPropertyIds = new Set(propertiesSnapshot.docs.map((docSnap) => docSnap.id));

      const recipients = usersSnapshot.docs
        .map((document) => ({ id: document.id, ...document.data() }))
        .filter((user) => {
          if (!audienceRoles.includes(user.role)) return false;
          if (user.ownerUid === ownerId || user.invitedBy === ownerId) return true;
          return ownedPropertyIds.has(user.propertyId);
        });

      const announcementRef = await addDoc(collection(db, "owner_announcements"), {
        ownerId,
        createdBy: ownerId,
        title: title.trim(),
        message: message.trim(),
        targetAudience,
        type,
        createdAt: timestamp,
      });

      const notificationPromises = recipients.map((recipient) =>
        addDoc(collection(db, "notifications"), {
          userId: recipient.id,
          title: title.trim(),
          message: message.trim(),
          type,
          announcementId: announcementRef.id,
          ownerId,
          createdBy: ownerId,
          isRead: false,
          createdAt: timestamp,
        })
      );

      await Promise.all(notificationPromises);

      setTitle("");
      setMessage("");
      setTargetAudience("tenants");
      setType("info");
      setSnackbar({
        open: true,
        message: `Announcement sent to ${recipients.length} ${recipients.length === 1 ? "recipient" : "recipients"}.`,
        severity: "success",
      });
    } catch (sendError) {
      console.error("Error sending owner announcement:", sendError);
      setError("The announcement could not be sent. Please check security rules or network logs.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Container maxWidth="xl" disableGutters>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" fontWeight={800} gutterBottom>
          Owner Announcements
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Send updates to your tenants, caretakers, or both.
        </Typography>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Grid container spacing={3}>
        <Grid item xs={12} md={5}>
          <Paper elevation={0} sx={{ p: 3, border: "1px solid", borderColor: "divider", borderRadius: 3 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
              <CampaignIcon color="primary" />
              <Typography variant="h6" fontWeight={700}>
                Send an update
              </Typography>
            </Box>

            <form onSubmit={handleCreateAnnouncement}>
              <Stack spacing={2.5}>
                <TextField
                  label="Announcement title"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="e.g. Property maintenance schedule"
                  required
                  fullWidth
                  size="small"
                />

                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <FormControl fullWidth size="small">
                      <InputLabel id="owner-announcement-audience-label">Audience</InputLabel>
                      <Select
                        labelId="owner-announcement-audience-label"
                        label="Audience"
                        value={targetAudience}
                        onChange={(event) => setTargetAudience(event.target.value)}
                      >
                        {AUDIENCE_OPTIONS.map((option) => (
                          <MenuItem key={option.value} value={option.value}>
                            {option.label}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <FormControl fullWidth size="small">
                      <InputLabel id="owner-announcement-type-label">Message type</InputLabel>
                      <Select
                        labelId="owner-announcement-type-label"
                        label="Message type"
                        value={type}
                        onChange={(event) => setType(event.target.value)}
                      >
                        <MenuItem value="info">Info</MenuItem>
                        <MenuItem value="warning">Warning</MenuItem>
                        <MenuItem value="success">Success</MenuItem>
                        <MenuItem value="error">Urgent</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                </Grid>

                <TextField
                  label="Message"
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  placeholder="Write the details your recipients should see."
                  required
                  multiline
                  rows={6}
                  fullWidth
                />

                <Button
                  type="submit"
                  variant="contained"
                  startIcon={submitting ? <CircularProgress size={20} color="inherit" /> : <SendIcon />}
                  disabled={submitting || !title.trim() || !message.trim()}
                  fullWidth
                  sx={{ py: 1.2, borderRadius: 2 }}
                >
                  {submitting ? "Sending..." : "Send announcement"}
                </Button>
              </Stack>
            </form>
          </Paper>
        </Grid>

        <Grid item xs={12} md={7}>
          <Paper elevation={0} sx={{ p: 3, border: "1px solid", borderColor: "divider", borderRadius: 3 }}>
            <Typography variant="h6" fontWeight={700} sx={{ mb: 2 }}>
              Announcement history ({announcements.length})
            </Typography>

            {loading ? (
              <Box sx={{ display: "flex", justifyContent: "center", py: 5 }}>
                <CircularProgress />
              </Box>
            ) : announcements.length === 0 ? (
              <Box sx={{ textAlign: "center", py: 5 }}>
                <Typography variant="body2" color="text.secondary">
                  No announcements sent yet.
                </Typography>
              </Box>
            ) : (
              <Stack spacing={2}>
                {announcements.map((announcement) => (
                  <Card key={announcement.id} elevation={0} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2 }}>
                    <CardContent sx={{ p: 2.5, "&:last-child": { pb: 2.5 } }}>
                      <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1, mb: 1 }}>
                        {getTypeIcon(announcement.type)}
                        <Box sx={{ minWidth: 0, flex: 1 }}>
                          <Typography variant="subtitle1" fontWeight={700}>
                            {announcement.title}
                          </Typography>
                          <Box sx={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 1, mt: 0.5 }}>
                            <Chip label={announcement.targetAudience} size="small" variant="outlined" />
                            <Typography variant="caption" color="text.secondary">
                              {formatDate(announcement.createdAt)}
                            </Typography>
                          </Box>
                        </Box>
                      </Box>
                      <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
                        {announcement.message}
                      </Typography>
                    </CardContent>
                  </Card>
                ))}
              </Stack>
            )}
          </Paper>
        </Grid>
      </Grid>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar((current) => ({ ...current, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        <Alert severity={snackbar.severity} sx={{ borderRadius: 2 }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Container>
  );
}