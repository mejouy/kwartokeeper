// src/pages/owner/CaretakerList.jsx
//
// Owner-facing list of all caretakers they've invited. Fetches from the
// `users` collection filtered by role == "caretaker" and invitedBy ==
// current owner's uid. Also fetches each caretaker's assigned property
// name (instead of showing the raw property doc id) for readability.

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Typography,
  Paper,
  Stack,
  Chip,
  Avatar,
  Button,
  CircularProgress,
  Alert,
  Divider,
} from "@mui/material";
import PersonAddAltOutlinedIcon from "@mui/icons-material/PersonAddAltOutlined";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
} from "firebase/firestore";
import { db } from "../../../config/firebase";
import { useAuth } from "../../../context/AuthContext";

const PERMISSION_LABELS = {
  manageTenants: "Manage Tenants",
  logOccupancy: "Log Occupancy",
  handleReports: "Handle Reports",
  viewFinancials: "View Financials",
  modifyLayout: "Modify Layout",
};

function CaretakerCard({ caretaker }) {
  const grantedPermissions = Object.entries(caretaker.permissions || {})
    .filter(([, granted]) => granted)
    .map(([key]) => PERMISSION_LABELS[key] || key);

  return (
    <Paper variant="outlined" sx={{ p: 2.5 }}>
      <Stack direction="row" spacing={2} alignItems="flex-start">
        <Avatar sx={{ bgcolor: "primary.main" }}>
          {caretaker.name?.charAt(0)?.toUpperCase() || "?"}
        </Avatar>

        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Stack
            direction="row"
            justifyContent="space-between"
            alignItems="flex-start"
            flexWrap="wrap"
          >
            <Typography variant="subtitle1" fontWeight={700}>
              {caretaker.name || "Unnamed Caretaker"}
            </Typography>
            <Chip
              size="small"
              label={
                caretaker.mustChangePassword ? "Pending first login" : "Active"
              }
              color={caretaker.mustChangePassword ? "warning" : "success"}
              variant="outlined"
            />
          </Stack>

          <Typography variant="body2" color="text.secondary">
            {caretaker.email}
          </Typography>
          {caretaker.phone && (
            <Typography variant="body2" color="text.secondary">
              {caretaker.phone}
            </Typography>
          )}

          <Typography variant="body2" sx={{ mt: 1 }}>
            <strong>Property:</strong>{" "}
            {caretaker.propertyName || "Unknown property"}
          </Typography>

          <Divider sx={{ my: 1.5 }} />

          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ display: "block", mb: 0.5 }}
          >
            Permissions
          </Typography>
          {grantedPermissions.length > 0 ? (
            <Stack direction="row" flexWrap="wrap" gap={0.75}>
              {grantedPermissions.map((label) => (
                <Chip key={label} size="small" label={label} />
              ))}
            </Stack>
          ) : (
            <Typography variant="body2" color="text.secondary">
              No permissions granted.
            </Typography>
          )}
        </Box>
      </Stack>
    </Paper>
  );
}

export default function CaretakerList() {
  const navigate = useNavigate();
  const { currentUser } = useAuth() || {};

  const [caretakers, setCaretakers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchCaretakers() {
      if (!currentUser?.uid) return;
      try {
        const q = query(
          collection(db, "users"),
          where("role", "==", "caretaker"),
          where("invitedBy", "==", currentUser.uid),
        );
        const snap = await getDocs(q);
        const rawCaretakers = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

        // Resolve each caretaker's assignedPropertyId into a readable name.
        // Cache lookups so we don't re-fetch the same property doc twice.
        const propertyCache = new Map();
        const withPropertyNames = await Promise.all(
          rawCaretakers.map(async (c) => {
            if (!c.assignedPropertyId) return { ...c, propertyName: null };
            if (propertyCache.has(c.assignedPropertyId)) {
              return {
                ...c,
                propertyName: propertyCache.get(c.assignedPropertyId),
              };
            }
            try {
              const propSnap = await getDoc(
                doc(db, "properties", c.assignedPropertyId),
              );
              const name = propSnap.exists()
                ? propSnap.data().propertyName
                : null;
              propertyCache.set(c.assignedPropertyId, name);
              return { ...c, propertyName: name };
            } catch {
              return { ...c, propertyName: null };
            }
          }),
        );

        setCaretakers(withPropertyNames);
      } catch (err) {
        setError("Failed to load caretakers. Please refresh and try again.");
      } finally {
        setLoading(false);
      }
    }
    fetchCaretakers();
  }, [currentUser?.uid]);

  return (
    <Box sx={{ maxWidth: 700, mx: "auto", p: { xs: 2, sm: 3 } }}>
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="center"
        sx={{ mb: 3 }}
      >
        <Typography variant="h1">Caretakers</Typography>
        <Button
          variant="contained"
          startIcon={<PersonAddAltOutlinedIcon />}
          onClick={() => navigate("/owner/caretakers/invite")}
        >
          Invite Caretaker
        </Button>
      </Stack>

      {loading && (
        <Box sx={{ display: "flex", justifyContent: "center", py: 6 }}>
          <CircularProgress />
        </Box>
      )}

      {error && <Alert severity="error">{error}</Alert>}

      {!loading && !error && caretakers.length === 0 && (
        <Paper variant="outlined" sx={{ p: 4, textAlign: "center" }}>
          <Typography color="text.secondary">
            You haven't invited any caretakers yet.
          </Typography>
        </Paper>
      )}

      {!loading && !error && caretakers.length > 0 && (
        <Stack spacing={2}>
          {caretakers.map((c) => (
            <CaretakerCard key={c.id} caretaker={c} />
          ))}
        </Stack>
      )}
    </Box>
  );
}
