import React, { useState, useEffect } from "react";
import {
  Box,
  Container,
  Typography,
  Paper,
  Button,
  Stack,
  Card,
  CardContent,
  AppBar,
  Toolbar,
  Divider,
  CircularProgress,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
} from "@mui/material";

import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import MeetingRoomIcon from "@mui/icons-material/MeetingRoom";
import LogoutIcon from "@mui/icons-material/Logout";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import BuildOutlinedIcon from "@mui/icons-material/BuildOutlined";
import AddIcon from "@mui/icons-material/Add";

import { useNavigate } from "react-router-dom";
import { signOut } from "firebase/auth";
import {
  doc,
  getDoc,
  collection,
  addDoc,
  query,
  where,
  onSnapshot,
  serverTimestamp,
} from "firebase/firestore";
import { auth, db } from "../../config/firebase";
// AHP-based maintenance prioritization (see src/utils/maintenancePrioritization.js
// for the full pairwise-comparison derivation and rationale).
import {
  CATEGORIES,
  rankMaintenanceRequests,
} from "../../utils/maintenancePrioritization";

// Human-readable labels for the category picker in the Maintenance Request modal.
const CATEGORY_OPTIONS = [
  {
    value: CATEGORIES.SAFETY,
    label: "Safety (e.g. exposed wiring, broken lock)",
  },
  {
    value: CATEGORIES.UTILITY,
    label: "Utility (e.g. clogged drain, appliance issue)",
  },
  {
    value: CATEGORIES.ROUTINE,
    label: "Routine (e.g. paint chip, cosmetic issue)",
  },
];

// Tier-matching chip colors, shown on each ticket once ranked.
const TIER_CHIP_COLOR = {
  High: "error",
  Medium: "warning",
  Low: "default",
};

export default function TenantDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);

  const [tenantInfo, setTenantInfo] = useState({
    name: "Tenant",
    propertyName: "Not Assigned",
    roomNumber: "N/A",
    bedId: "N/A",
    monthlyRent: 0,
    status: "Active",
    leaseStartDate: "Not specified",
    leaseDuration: "Not specified",
    contact: "None provided",
    // Needed (not previously stored) so a submitted maintenance ticket can
    // record which owner/property it belongs to.
    ownerUid: "",
    propertyId: "",
  });

  // Maintenance Requests state
  const [tickets, setTickets] = useState([]);
  const [openRepairModal, setOpenRepairModal] = useState(false);
  const [repairForm, setRepairForm] = useState({
    title: "",
    description: "",
    category: CATEGORIES.SAFETY,
  });

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) {
      navigate("/login");
      return;
    }

    const fetchProfile = async () => {
      try {
        setLoading(true);

        // 1. Fetch Tenant User Profile
        const userDoc = await getDoc(doc(db, "users", user.uid));

        if (userDoc.exists()) {
          const data = userDoc.data();
          const propertyId = data.propertyId || data.assignedPropertyId;
          let propertyName = "Not Assigned";

          // 2. Fetch Property Title using propertyId
          if (propertyId) {
            try {
              const propDoc = await getDoc(doc(db, "properties", propertyId));
              if (propDoc.exists()) {
                const propData = propDoc.data();
                propertyName =
                  propData.propertyName ||
                  propData.name ||
                  propData.title ||
                  "Facility Name Unavailable";
              }
            } catch (propErr) {
              console.error("Error fetching property doc:", propErr);
            }
          }

          setTenantInfo({
            name: data.name || data.fullName || "Tenant",
            propertyName: propertyName,
            roomNumber: data.roomNumber || data.roomId || "N/A",
            bedId: data.bedId || "N/A",
            monthlyRent: data.monthlyRent || 0,
            status: data.status || "Active",
            leaseStartDate:
              data.leaseStartDate || data.moveInDate || "Not specified",
            leaseDuration: formatLeaseDuration(data.leaseDuration),
            contact: data.phone || data.contact || "None provided",
            ownerUid: data.ownerUid || data.landlordUid || "",
            propertyId: propertyId || "",
          });
        }
      } catch (err) {
        console.error("Error fetching tenant profile:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();

    // Listen for this tenant's Maintenance Tickets in real time.
    const qTickets = query(
      collection(db, "maintenance_tickets"),
      where("tenantUid", "==", user.uid),
    );
    const unsubscribeTickets = onSnapshot(qTickets, (snapshot) => {
      const docs = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      setTickets(docs);
    });

    return () => unsubscribeTickets();
  }, [navigate]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate("/login");
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };

  // Maintenance Request Submission
  const handleRequestSubmit = async () => {
    const user = auth.currentUser;
    if (!user || !repairForm.title) return;

    try {
      await addDoc(collection(db, "maintenance_tickets"), {
        tenantUid: user.uid,
        tenantName: tenantInfo.name,
        ownerUid: tenantInfo.ownerUid,
        propertyId: tenantInfo.propertyId,
        propertyName: tenantInfo.propertyName,
        roomNumber: tenantInfo.roomNumber,
        title: repairForm.title,
        description: repairForm.description,
        // The tenant only picks a category — the AHP-derived priority tier
        // is computed on read (see rankMaintenanceRequests below), not
        // stored here, so the ranking logic lives in exactly one place.
        category: repairForm.category,
        status: "Pending",
        createdAt: serverTimestamp(),
      });

      setOpenRepairModal(false);
      setRepairForm({
        title: "",
        description: "",
        category: CATEGORIES.SAFETY,
      });
    } catch (err) {
      console.error("Error submitting repair request:", err);
    }
  };

  if (loading) {
    return (
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          minHeight: "100vh",
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  // AHP-ranked tickets: High tier first, then Medium, then Low; within the
  // same tier, oldest-pending first.
  const rankedTickets = rankMaintenanceRequests(tickets);

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "#f8fafc" }}>
      {/* Navbar Header */}
      <AppBar
        position="static"
        color="default"
        elevation={1}
        sx={{ bgcolor: "#ffffff" }}
      >
        <Toolbar sx={{ justifyContent: "space-between" }}>
          <Typography variant="h6" fontWeight="800" color="primary">
            KwartoKeeper
          </Typography>

          <Stack direction="row" spacing={2} alignItems="center">
            <Typography variant="body2" color="text.secondary" fontWeight="600">
              {tenantInfo.name} ({tenantInfo.propertyName})
            </Typography>
            <Button
              variant="outlined"
              color="error"
              size="small"
              startIcon={<LogoutIcon />}
              onClick={handleLogout}
            >
              Logout
            </Button>
          </Stack>
        </Toolbar>
      </AppBar>

      <Container maxWidth="xl" sx={{ py: 4 }}>
        <Box sx={{ mb: 4 }}>
          <Typography variant="h5" fontWeight="800">
            Welcome back, {tenantInfo.name}!
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Tenant Portal — Account &amp; Lease Overview
          </Typography>
        </Box>

        {/* Metrics Overview Cards */}
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "repeat(3, 1fr)" },
            gap: 2.5,
            mb: 4,
          }}
        >
          <Card
            elevation={0}
            sx={{
              border: "1px solid",
              borderColor: "divider",
              borderRadius: 3,
            }}
          >
            <CardContent sx={{ p: 2.5 }}>
              <Box
                sx={{
                  display: "flex",
                  justifyContent: "space-between",
                  mb: 1,
                }}
              >
                <Typography
                  variant="body2"
                  color="text.secondary"
                  fontWeight="600"
                >
                  Assigned Unit &amp; Space
                </Typography>
                <MeetingRoomIcon color="primary" />
              </Box>
              <Typography variant="h5" fontWeight="800">
                Room {tenantInfo.roomNumber}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Facility: {tenantInfo.propertyName}
              </Typography>
            </CardContent>
          </Card>

          <Card
            elevation={0}
            sx={{
              border: "1px solid",
              borderColor: "divider",
              borderRadius: 3,
            }}
          >
            <CardContent sx={{ p: 2.5 }}>
              <Box
                sx={{
                  display: "flex",
                  justifyContent: "space-between",
                  mb: 1,
                }}
              >
                <Typography
                  variant="body2"
                  color="text.secondary"
                  fontWeight="600"
                >
                  Monthly Rent Rate
                </Typography>
                <ReceiptLongIcon color="success" />
              </Box>
              <Typography variant="h5" fontWeight="800" color="success.main">
                ₱{Number(tenantInfo.monthlyRent || 0).toLocaleString()}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Standard monthly rate
              </Typography>
            </CardContent>
          </Card>

          <Card
            elevation={0}
            sx={{
              border: "1px solid",
              borderColor: "divider",
              borderRadius: 3,
            }}
          >
            <CardContent sx={{ p: 2.5 }}>
              <Box
                sx={{
                  display: "flex",
                  justifyContent: "space-between",
                  mb: 1,
                }}
              >
                <Typography
                  variant="body2"
                  color="text.secondary"
                  fontWeight="600"
                >
                  Lease Duration
                </Typography>
                <CalendarMonthIcon color="info" />
              </Box>
              <Typography variant="h5" fontWeight="800">
                {tenantInfo.leaseDuration}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Started: {tenantInfo.leaseStartDate}
              </Typography>
            </CardContent>
          </Card>
        </Box>

        {/* Profile Details List */}
        <Paper
          elevation={0}
          sx={{
            p: 3,
            border: "1px solid",
            borderColor: "divider",
            borderRadius: 3,
            mb: 3,
          }}
        >
          <Box
            sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              mb: 1,
            }}
          >
            <Typography variant="h6" fontWeight="700">
              Residency &amp; Lease Agreement
            </Typography>
            <Chip label={tenantInfo.status} color="success" size="small" />
          </Box>
          <Typography variant="body2" color="text.secondary" mb={3}>
            Details associated with your registered lease account.
          </Typography>
          <Divider sx={{ mb: 3 }} />

          <Stack spacing={2} maxWidth="sm">
            <Box sx={{ display: "flex", justifyContent: "space-between" }}>
              <Typography variant="body2" color="text.secondary">
                Tenant Name:
              </Typography>
              <Typography variant="subtitle2" fontWeight="700">
                {tenantInfo.name}
              </Typography>
            </Box>
            <Box sx={{ display: "flex", justifyContent: "space-between" }}>
              <Typography variant="body2" color="text.secondary">
                Property Facility:
              </Typography>
              <Typography variant="subtitle2" fontWeight="700">
                {tenantInfo.propertyName}
              </Typography>
            </Box>
            <Box sx={{ display: "flex", justifyContent: "space-between" }}>
              <Typography variant="body2" color="text.secondary">
                Assigned Room:
              </Typography>
              <Typography variant="subtitle2" fontWeight="700">
                Room {tenantInfo.roomNumber}
              </Typography>
            </Box>
            <Box sx={{ display: "flex", justifyContent: "space-between" }}>
              <Typography variant="body2" color="text.secondary">
                Bed Assignment:
              </Typography>
              <Typography variant="subtitle2" fontWeight="700">
                {tenantInfo.bedId}
              </Typography>
            </Box>
            <Box sx={{ display: "flex", justifyContent: "space-between" }}>
              <Typography variant="body2" color="text.secondary">
                Monthly Rent:
              </Typography>
              <Typography
                variant="subtitle2"
                fontWeight="700"
                color="success.main"
              >
                ₱{Number(tenantInfo.monthlyRent || 0).toLocaleString()}
              </Typography>
            </Box>
            <Box sx={{ display: "flex", justifyContent: "space-between" }}>
              <Typography variant="body2" color="text.secondary">
                Lease Start Date:
              </Typography>
              <Typography variant="subtitle2" fontWeight="700">
                {tenantInfo.leaseStartDate}
              </Typography>
            </Box>
            <Box sx={{ display: "flex", justifyContent: "space-between" }}>
              <Typography variant="body2" color="text.secondary">
                Lease Duration:
              </Typography>
              <Typography variant="subtitle2" fontWeight="700">
                {tenantInfo.leaseDuration}
              </Typography>
            </Box>
            <Box sx={{ display: "flex", justifyContent: "space-between" }}>
              <Typography variant="body2" color="text.secondary">
                Contact Phone:
              </Typography>
              <Typography variant="subtitle2" fontWeight="700">
                {tenantInfo.contact}
              </Typography>
            </Box>
          </Stack>
        </Paper>

        {/* Maintenance Requests Section (Dwight's Maintenance Module) */}
        <Paper
          elevation={0}
          sx={{
            p: 3,
            border: "1px solid",
            borderColor: "divider",
            borderRadius: 3,
          }}
        >
          <Box
            sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              mb: 2,
            }}
          >
            <Box>
              <Typography variant="h6" fontWeight="700">
                Maintenance Requests
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Report an issue in your room or unit
              </Typography>
            </Box>
            <Button
              size="small"
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setOpenRepairModal(true)}
            >
              New Request
            </Button>
          </Box>
          <Stack spacing={1.5}>
            {rankedTickets.length === 0 ? (
              <Typography
                variant="body2"
                color="text.secondary"
                align="center"
                sx={{ py: 3 }}
              >
                No active maintenance tickets reported.
              </Typography>
            ) : (
              rankedTickets.map((t) => (
                <Box
                  key={t.id}
                  sx={{
                    p: 2,
                    borderRadius: 2,
                    bgcolor: "background.default",
                    border: "1px solid",
                    borderColor: "divider",
                  }}
                >
                  <Box
                    sx={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      mb: 0.5,
                      gap: 1,
                    }}
                  >
                    <Typography variant="subtitle2" fontWeight="700">
                      {t.title}
                    </Typography>
                    <Stack direction="row" spacing={0.5}>
                      <Chip
                        label={t.priority.tier}
                        size="small"
                        color={TIER_CHIP_COLOR[t.priority.tier]}
                      />
                      <Chip
                        label={t.status || "Pending"}
                        size="small"
                        color={t.status === "Resolved" ? "success" : "warning"}
                        variant="outlined"
                      />
                    </Stack>
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    {t.description}
                  </Typography>
                  {t.resolutionNotes && (
                    <Typography
                      variant="caption"
                      color="info.main"
                      sx={{ display: "block", mt: 1 }}
                    >
                      <strong>Note:</strong> {t.resolutionNotes}
                    </Typography>
                  )}
                </Box>
              ))
            )}
          </Stack>
        </Paper>
      </Container>

      {/* Modal: Maintenance Request */}
      <Dialog
        open={openRepairModal}
        onClose={() => setOpenRepairModal(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 800 }}>
          Submit Maintenance Request
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ pt: 1 }}>
            <FormControl fullWidth>
              <InputLabel>Category</InputLabel>
              <Select
                value={repairForm.category}
                label="Category"
                onChange={(e) =>
                  setRepairForm({ ...repairForm, category: e.target.value })
                }
              >
                {CATEGORY_OPTIONS.map((opt) => (
                  <MenuItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="Issue Summary"
              placeholder="e.g. Water leak, Light bulb replacement"
              fullWidth
              value={repairForm.title}
              onChange={(e) =>
                setRepairForm({ ...repairForm, title: e.target.value })
              }
            />
            <TextField
              label="Detailed Description"
              multiline
              rows={3}
              fullWidth
              value={repairForm.description}
              onChange={(e) =>
                setRepairForm({ ...repairForm, description: e.target.value })
              }
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setOpenRepairModal(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleRequestSubmit}>
            Submit Request
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

function formatLeaseDuration(val) {
  if (!val) return "Not specified";
  switch (val) {
    case "3_months":
      return "3 Months";
    case "6_months":
      return "6 Months";
    case "12_months":
      return "12 Months";
    case "custom":
      return "Custom Term";
    default:
      return val;
  }
}
