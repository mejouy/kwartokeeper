// src/pages/owner/MaintenancePage.jsx

import { useEffect, useState } from "react";
import {
  Box,
  Container,
  Typography,
  Paper,
  Stack,
  Chip,
  CircularProgress,
  Alert,
  Select,
  MenuItem,
  FormControl,
  ToggleButton,
  ToggleButtonGroup,
  TextField,
  Button,
  Divider,
} from "@mui/material";
import BuildOutlinedIcon from "@mui/icons-material/BuildOutlined";
import AccessTimeOutlinedIcon from "@mui/icons-material/AccessTimeOutlined";
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  updateDoc,
} from "firebase/firestore";
import { db } from "../../config/firebase";
import { useAuth } from "../../context/AuthContext";
import { rankMaintenanceRequests } from "../../utils/maintenancePrioritization";

const TIER_CHIP_COLOR = {
  High: "error",
  Medium: "warning",
  Low: "default",
};

const STATUS_OPTIONS = ["Pending", "In Progress", "Resolved"];
const FILTER_OPTIONS = ["All", "Pending", "In Progress", "Resolved"];

// Helper to format Firestore timestamps beautifully
const formatTimestamp = (timestamp) => {
  if (!timestamp) return "Unknown Date";
  // Convert Firestore Timestamp to JS Date
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  if (isNaN(date)) return "Unknown Date";
  
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
  }).format(date);
};

// Extracted TicketCard to handle its own local state (like typing remarks)
function TicketCard({ ticket, onStatusChange }) {
  const [remarks, setRemarks] = useState(ticket.remarks || "");
  const [isSaving, setIsSaving] = useState(false);

  const handleSaveRemarks = async () => {
    setIsSaving(true);
    try {
      await updateDoc(doc(db, "maintenance_tickets", ticket.id), {
        remarks: remarks,
        updatedAt: new Date(),
      });
    } catch (err) {
      console.error("Failed to save remarks:", err);
      alert("Failed to save remarks. Check your permissions.");
    } finally {
      setIsSaving(false);
    }
  };

  const hasUnsavedRemarks = remarks !== (ticket.remarks || "");

  return (
    <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 2 }}>
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="flex-start"
        flexWrap="wrap"
        gap={1}
        sx={{ mb: 1 }}
      >
        <Box>
          <Typography variant="subtitle1" fontWeight="700">
            {ticket.title}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            {ticket.tenantName} — {ticket.propertyName}, Room {ticket.roomNumber}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}>
            <AccessTimeOutlinedIcon sx={{ fontSize: 14 }} />
            Submitted: {formatTimestamp(ticket.createdAt)}
          </Typography>
        </Box>
        
        <Stack direction="row" spacing={1} alignItems="center">
          <Chip
            label={ticket.priority?.tier || "Medium"}
            size="small"
            color={TIER_CHIP_COLOR[ticket.priority?.tier] || "default"}
            sx={{ fontWeight: "bold" }}
          />
          <FormControl size="small">
            <Select
              value={ticket.status || "Pending"}
              onChange={(e) => onStatusChange(ticket.id, e.target.value)}
              sx={{ minWidth: 130 }}
            >
              {STATUS_OPTIONS.map((opt) => (
                <MenuItem key={opt} value={opt}>
                  {opt}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Stack>
      </Stack>

      <Typography variant="body2" sx={{ mt: 1.5, mb: 2 }}>
        {ticket.description}
      </Typography>

      <Divider sx={{ my: 1.5 }} />

      {/* Remarks Section */}
      <Stack direction="row" spacing={1} alignItems="flex-start">
        <TextField
          fullWidth
          size="small"
          multiline
          maxRows={3}
          placeholder="Add admin remarks (e.g., waiting for parts, scheduled for Tuesday)..."
          value={remarks}
          onChange={(e) => setRemarks(e.target.value)}
          sx={{
            '& .MuiInputBase-root': { fontSize: '0.875rem' }
          }}
        />
        {hasUnsavedRemarks && (
          <Button
            variant="contained"
            size="small"
            onClick={handleSaveRemarks}
            disabled={isSaving}
            sx={{ minWidth: 70, mt: 0.5 }}
          >
            {isSaving ? "..." : "Save"}
          </Button>
        )}
      </Stack>
    </Paper>
  );
}

export default function MaintenancePage() {
  const { currentUser } = useAuth();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  useEffect(() => {
    if (!currentUser?.uid) {
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, "maintenance_tickets"),
      where("ownerUid", "==", currentUser.uid)
    );

    const unsubscribeSnapshot = onSnapshot(
      q,
      (snapshot) => {
        const docs = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        setTickets(docs);
        setError("");
        setLoading(false);
      },
      (err) => {
        console.error("Failed to load maintenance tickets:", err);
        setError("Insufficient permissions. Check your Firestore rules.");
        setLoading(false);
      }
    );

    return () => unsubscribeSnapshot();
  }, [currentUser?.uid]);

  const handleStatusChange = async (ticketId, newStatus) => {
    try {
      await updateDoc(doc(db, "maintenance_tickets", ticketId), {
        status: newStatus,
        updatedAt: new Date(),
      });
    } catch (err) {
      console.error("Failed to update ticket status:", err);
      alert("Failed to update status. You may not have permission.");
    }
  };

  const rankedTickets = rankMaintenanceRequests(tickets);
  const visibleTickets =
    statusFilter === "All"
      ? rankedTickets
      : rankedTickets.filter((t) => (t.status || "Pending") === statusFilter);

  return (
    <Box sx={{ py: 2 }}>
      <Container maxWidth="lg" disableGutters>
        <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 3 }}>
          <BuildOutlinedIcon color="warning" fontSize="large" />
          <Box>
            <Typography variant="h5" fontWeight="800">
              Maintenance Queue
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Every report across your properties, ranked by priority
            </Typography>
          </Box>
        </Stack>

        <ToggleButtonGroup
          value={statusFilter}
          exclusive
          onChange={(_, val) => val && setStatusFilter(val)}
          size="small"
          sx={{ mb: 3 }}
        >
          {FILTER_OPTIONS.map((opt) => (
            <ToggleButton key={opt} value={opt}>
              {opt}
            </ToggleButton>
          ))}
        </ToggleButtonGroup>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
            <CircularProgress />
          </Box>
        ) : visibleTickets.length === 0 ? (
          <Paper variant="outlined" sx={{ p: 4, textAlign: "center", borderRadius: 2 }}>
            <Typography color="text.secondary">
              {statusFilter === "All"
                ? "No maintenance tickets reported yet."
                : `No tickets with status "${statusFilter}".`}
            </Typography>
          </Paper>
        ) : (
          <Stack spacing={2}>
            {visibleTickets.map((t) => (
              <TicketCard 
                key={t.id} 
                ticket={t} 
                onStatusChange={handleStatusChange} 
              />
            ))}
          </Stack>
        )}
      </Container>
    </Box>
  );
}