import React, { useState, useEffect } from "react";
import {
  Box,
  Container,
  Grid,
  Paper,
  Typography,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Stack,
  Card,
  CardContent,
  Chip,
  Alert,
  CircularProgress,
  IconButton,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Snackbar
} from "@mui/material";
import CampaignIcon from "@mui/icons-material/Campaign";
import SendIcon from "@mui/icons-material/Send";
import DeleteIcon from "@mui/icons-material/Delete";
import GroupIcon from "@mui/icons-material/Group";
import InfoIcon from "@mui/icons-material/Info";
import WarningIcon from "@mui/icons-material/Warning";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import ErrorIcon from "@mui/icons-material/Error";
import { 
  collection, 
  addDoc, 
  deleteDoc, 
  doc, 
  query, 
  orderBy, 
  onSnapshot,
  getDocs,
  where
} from "firebase/firestore";
import { db } from "../../config/firebase";

export default function AdminAnnouncements() {
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [targetAudience, setTargetAudience] = useState("all"); // 'all', 'owner', 'caretaker', 'tenant'
  const [type, setType] = useState("info"); // 'info', 'warning', 'success', 'error'
  
  // UI State
  const [deleteId, setDeleteId] = useState(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "success" });

  // Fetch announcements in real-time
  useEffect(() => {
    const q = query(collection(db, "announcements"), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list = snapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data()
        }));
        setAnnouncements(list);
        setLoading(false);
      },
      (err) => {
        console.error("Error fetching announcements:", err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  const handleCreateAnnouncement = async (e) => {
    e.preventDefault();
    if (!title.trim() || !message.trim()) return;

    setSubmitting(true);
    const timestamp = new Date().toISOString();

    try {
      // 1. Save broadcast announcement entry
      const annRef = await addDoc(collection(db, "announcements"), {
        title: title.trim(),
        message: message.trim(),
        targetAudience,
        type,
        createdAt: timestamp,
        createdBy: "Admin"
      });

      // 2. Optional: Dispatch direct notifications to target users in bulk
      let userQuery = collection(db, "users");
      if (targetAudience !== "all") {
        userQuery = query(collection(db, "users"), where("role", "==", targetAudience));
      }

      const usersSnap = await getDocs(userQuery);
      const notificationPromises = usersSnap.docs.map((userDoc) =>
        addDoc(collection(db, "notifications"), {
          userId: userDoc.id,
          title: title.trim(),
          message: message.trim(),
          type,
          announcementId: annRef.id,
          isRead: false,
          createdAt: timestamp
        })
      );

      await Promise.all(notificationPromises);

      // Reset Form
      setTitle("");
      setMessage("");
      setTargetAudience("all");
      setType("info");

      setSnackbar({
        open: true,
        message: `Broadcast published successfully to ${usersSnap.docs.length} user(s)!`,
        severity: "success"
      });
    } catch (err) {
      console.error("Error sending announcement:", err);
      setSnackbar({
        open: true,
        message: "Failed to publish announcement. Please try again.",
        severity: "error"
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteAnnouncement = async () => {
    if (!deleteId) return;
    try {
      await deleteDoc(doc(db, "announcements", deleteId));
      setSnackbar({ open: true, message: "Announcement deleted.", severity: "info" });
    } catch (err) {
      console.error("Error deleting announcement:", err);
      setSnackbar({ open: true, message: "Failed to delete announcement.", severity: "error" });
    } finally {
      setDeleteId(null);
    }
  };

  const formatDate = (timestamp) => {
    if (!timestamp) return "N/A";
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  const getTypeIcon = (severity) => {
    switch (severity) {
      case "warning": return <WarningIcon color="warning" fontSize="small" />;
      case "success": return <CheckCircleIcon color="success" fontSize="small" />;
      case "error": return <ErrorIcon color="error" fontSize="small" />;
      default: return <InfoIcon color="info" fontSize="small" />;
    }
  };

  return (
    <Container maxWidth="xl" disableGutters>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" fontWeight="800" gutterBottom>
          System Announcements & Broadcasts
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Publish system notifications and updates directly to owner and user feeds.
        </Typography>
      </Box>

      <Grid container spacing={3}>
        {/* Left Column: Create Announcement Form */}
        <Grid item xs={12} md={5}>
          <Paper elevation={0} sx={{ p: 3, border: "1px solid", borderColor: "divider", borderRadius: 3 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
              <CampaignIcon color="primary" />
              <Typography variant="h6" fontWeight="700">
                Create New Broadcast
              </Typography>
            </Box>

            <form onSubmit={handleCreateAnnouncement}>
              <Stack spacing={2.5}>
                <TextField
                  label="Announcement Title"
                  placeholder="e.g., Scheduled Platform Maintenance"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  fullWidth
                  size="small"
                />

                <Grid container spacing={2}>
                  <Grid item xs={6}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Target Audience</InputLabel>
                      <Select
                        value={targetAudience}
                        label="Target Audience"
                        onChange={(e) => setTargetAudience(e.target.value)}
                      >
                        <MenuItem value="all">All Users</MenuItem>
                        <MenuItem value="owner">Owners Only</MenuItem>
                        <MenuItem value="caretaker">Caretakers Only</MenuItem>
                        <MenuItem value="tenant">Tenants Only</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>

                  <Grid item xs={6}>
                    <FormControl fullWidth size="small">
                      <InputLabel>Severity / Type</InputLabel>
                      <Select
                        value={type}
                        label="Severity / Type"
                        onChange={(e) => setType(e.target.value)}
                      >
                        <MenuItem value="info">Info</MenuItem>
                        <MenuItem value="warning">Warning</MenuItem>
                        <MenuItem value="success">Success</MenuItem>
                        <MenuItem value="error">Urgent / Error</MenuItem>
                      </Select>
                    </FormControl>
                  </Grid>
                </Grid>

                <TextField
                  label="Message Content"
                  placeholder="Write full broadcast details here..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  required
                  multiline
                  rows={5}
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
                  {submitting ? "Publishing..." : "Broadcast Announcement"}
                </Button>
              </Stack>
            </form>
          </Paper>
        </Grid>

        {/* Right Column: History Feed */}
        <Grid item xs={12} md={7}>
          <Paper elevation={0} sx={{ p: 3, border: "1px solid", borderColor: "divider", borderRadius: 3 }}>
            <Typography variant="h6" fontWeight="700" sx={{ mb: 2 }}>
              Broadcast History ({announcements.length})
            </Typography>

            {loading ? (
              <Box sx={{ display: "flex", justifyContent: "center", py: 5 }}>
                <CircularProgress />
              </Box>
            ) : announcements.length === 0 ? (
              <Box sx={{ textAlign: "center", py: 5 }}>
                <Typography variant="body2" color="text.secondary">
                  No announcements published yet.
                </Typography>
              </Box>
            ) : (
              <Stack spacing={2}>
                {announcements.map((item) => (
                  <Card key={item.id} elevation={0} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2 }}>
                    <CardContent sx={{ p: 2.5, "&:last-child": { pb: 2.5 } }}>
                      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: 1 }}>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                          {getTypeIcon(item.type)}
                          <Typography variant="subtitle1" fontWeight="700">
                            {item.title}
                          </Typography>
                        </Box>
                        <IconButton size="small" color="error" onClick={() => setDeleteId(item.id)}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Box>

                      <Typography variant="body2" color="text.primary" sx={{ mb: 2, whitespace: "pre-wrap" }}>
                        {item.message}
                      </Typography>

                      <Divider sx={{ mb: 1.5 }} />

                      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 1 }}>
                        <Stack direction="row" spacing={1}>
                          <Chip
                            icon={<GroupIcon fontSize="small" />}
                            label={item.targetAudience.toUpperCase()}
                            size="small"
                            variant="outlined"
                          />
                          <Chip
                            label={item.type.toUpperCase()}
                            size="small"
                            color={item.type === "error" ? "error" : item.type === "warning" ? "warning" : item.type === "success" ? "success" : "default"}
                          />
                        </Stack>
                        <Typography variant="caption" color="text.secondary">
                          {formatDate(item.createdAt)}
                        </Typography>
                      </Box>
                    </CardContent>
                  </Card>
                ))}
              </Stack>
            )}
          </Paper>
        </Grid>
      </Grid>

      {/* Delete Dialog */}
      <Dialog open={Boolean(deleteId)} onClose={() => setDeleteId(null)}>
        <DialogTitle>Delete Announcement?</DialogTitle>
        <DialogContent>
          Are you sure you want to delete this announcement from the history record?
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setDeleteId(null)}>Cancel</Button>
          <Button onClick={handleDeleteAnnouncement} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Notification Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        <Alert severity={snackbar.severity} sx={{ borderRadius: 2 }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Container>
  );
}