// src/pages/owner/MaintenancePage.jsx
//
// Owner-facing Maintenance Queue: shows every maintenance ticket across
// ALL of this owner's properties (unlike the Caretaker Dashboard, which
// only shows tickets for the caretaker's one assigned property), ranked
// by the same AHP logic (see src/utils/maintenancePrioritization.js).

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
  ToggleButtonGroup,
  ToggleButton,
} from "@mui/material";
import BuildOutlinedIcon from "@mui/icons-material/BuildOutlined";
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  updateDoc,
} from "firebase/firestore";
import { auth, db } from "../../config/firebase";
import { rankMaintenanceRequests } from "../../utils/maintenancePrioritization";

const TIER_CHIP_COLOR = {
  High: "error",
  Medium: "warning",
  Low: "default",
};

const STATUS_OPTIONS = ["Pending", "In Progress", "Resolved"];
const FILTER_OPTIONS = ["All", "Pending", "In Progress", "Resolved"];

export default function MaintenancePage() {
  const [tickets, setTickets] = useState([]);
  // Initialize based on whether a user is already present, instead of
  // defaulting to true and then synchronously flipping it to false inside
  // the effect below — React warns on synchronous setState in an effect
  // body since it can trigger an extra cascading render.
  const [loading, setLoading] = useState(() => Boolean(auth.currentUser));
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) {
      // loading was already initialized to false for this case above.
      return undefined;
    }

    // Every ticket belonging to one of this owner's properties — the
    // ticket write already stores `ownerUid` (see TenantDashboard.jsx),
    // so a single query covers every property this owner has, no matter
    // how many.
    const q = query(
      collection(db, "maintenance_tickets"),
      where("ownerUid", "==", user.uid),
    );
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const docs = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        setTickets(docs);
        setLoading(false);
      },
      (err) => {
        console.error("Failed to load maintenance tickets:", err);
        setError("Unable to load maintenance tickets.");
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, []);

  const handleStatusChange = async (ticketId, newStatus) => {
    try {
      await updateDoc(doc(db, "maintenance_tickets", ticketId), {
        status: newStatus,
      });
    } catch (err) {
      console.error("Failed to update ticket status:", err);
    }
  };

  // AHP-ranked: High tier first, then Medium, then Low; within the same
  // tier, oldest-pending first.
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
              Every report across your properties, ranked by AHP priority
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
          <Paper variant="outlined" sx={{ p: 4, textAlign: "center" }}>
            <Typography color="text.secondary">
              {statusFilter === "All"
                ? "No maintenance tickets reported yet."
                : `No tickets with status "${statusFilter}".`}
            </Typography>
          </Paper>
        ) : (
          <Stack spacing={1.5}>
            {visibleTickets.map((t) => (
              <Paper
                key={t.id}
                variant="outlined"
                sx={{ p: 2.5, borderRadius: 2 }}
              >
                <Stack
                  direction="row"
                  justifyContent="space-between"
                  alignItems="flex-start"
                  flexWrap="wrap"
                  gap={1}
                  sx={{ mb: 0.5 }}
                >
                  <Box>
                    <Typography variant="subtitle1" fontWeight="700">
                      {t.title}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {t.tenantName} — {t.propertyName}, Room {t.roomNumber}
                    </Typography>
                  </Box>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Chip
                      label={t.priority.tier}
                      size="small"
                      color={TIER_CHIP_COLOR[t.priority.tier]}
                    />
                    <FormControl size="small">
                      <Select
                        value={t.status || "Pending"}
                        onChange={(e) =>
                          handleStatusChange(t.id, e.target.value)
                        }
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
                <Typography variant="body2" color="text.secondary">
                  {t.description}
                </Typography>
              </Paper>
            ))}
          </Stack>
        )}
      </Container>
    </Box>
  );
}
