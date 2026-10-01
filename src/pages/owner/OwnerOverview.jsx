import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Container,
  Grid,
  Paper,
  Typography,
  Button,
  Stack,
  Chip,
  Card,
  CardContent,
  CircularProgress,
} from "@mui/material";
import HomeWorkIcon from "@mui/icons-material/HomeWork";
import PeopleIcon from "@mui/icons-material/People";
import AttachMoneyIcon from "@mui/icons-material/AttachMoney";
import BuildOutlinedIcon from "@mui/icons-material/BuildOutlined";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import FormatListNumberedIcon from "@mui/icons-material/FormatListNumbered";
import GroupAddIcon from "@mui/icons-material/GroupAdd";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { auth, db } from "../../config/firebase";

function MetricBox({ title, value, subtitle, icon }) {
  return (
    <Card elevation={0} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 3, height: "100%" }}>
      <CardContent sx={{ p: 2.5 }}>
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
          <Typography variant="body2" color="text.secondary" fontWeight="600">{title}</Typography>
          <Box sx={{ p: 1, borderRadius: 2, bgcolor: "action.hover" }}>{icon}</Box>
        </Box>
        <Typography variant="h4" fontWeight="800">{value}</Typography>
        <Typography variant="caption" color="text.secondary">{subtitle}</Typography>
      </CardContent>
    </Card>
  );
}

export default function OwnerOverview() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalProperties: 0,
    totalBeds: 0,
    occupancyRate: 0,
    occupiedBeds: 0,
    collectedThisMonth: 0,
    totalRevenue: 0,
    pendingMaintenance: 0,
    urgentMaintenance: 0,
    activeTenants: 0,
    pendingTenants: 0,
    totalCaretakers: 0,
  });

  const [tickets, setTickets] = useState([]);
  const [payments, setPayments] = useState([]);

  // Use refs to store snapshot values so combined calculations can always access up-to-date values without timing issues
  const propertiesDataRef = useRef({ count: 0, totalBeds: 0 });
  const tenantsDataRef = useRef({ active: 0, pending: 0 });

  useEffect(() => {
    if (!auth.currentUser) return;
    const ownerId = auth.currentUser.uid;

    const recalculateOccupancy = () => {
      const beds = propertiesDataRef.current.totalBeds;
      const active = tenantsDataRef.current.active;
      const pending = tenantsDataRef.current.pending;
      const propertiesCount = propertiesDataRef.current.count;

      const occRate = beds > 0 ? Math.min(Math.round((active / beds) * 100), 100) : 0;

      setStats((prev) => ({
        ...prev,
        totalProperties: propertiesCount,
        totalBeds: beds,
        activeTenants: active,
        pendingTenants: pending,
        occupiedBeds: active,
        occupancyRate: occRate,
      }));
    };

    // 1. Listen to Properties Data (Handles root fields & room arrays)
    const unsubProperties = onSnapshot(
      query(collection(db, "properties"), where("ownerUid", "==", ownerId)),
      (snapshot) => {
        let totalCapacity = 0;

        snapshot.docs.forEach((doc) => {
          const data = doc.data();

          // Calculate capacity from rooms array if present
          let roomCapacity = 0;
          if (Array.isArray(data.rooms) && data.rooms.length > 0) {
            data.rooms.forEach((room) => {
              roomCapacity += Number(room.capacity || room.beds || room.totalBeds || 0);
            });
          }

          // Fallback to top-level capacity fields
          const topLevelCapacity =
            Number(data.totalBeds) ||
            Number(data.capacity) ||
            Number(data.beds) ||
            Number(data.totalCapacity) ||
            0;

          totalCapacity += roomCapacity > 0 ? roomCapacity : topLevelCapacity;
        });

        propertiesDataRef.current = {
          count: snapshot.docs.length,
          totalBeds: totalCapacity,
        };

        recalculateOccupancy();
      },
      (error) => console.error("Error fetching properties:", error)
    );

    // 2. Listen to Tenants Data (Case-insensitive status parsing)
    const unsubTenants = onSnapshot(
      query(collection(db, "tenants"), where("ownerUid", "==", ownerId)),
      (snapshot) => {
        let active = 0;
        let pending = 0;

        snapshot.docs.forEach((doc) => {
          const data = doc.data();
          const rawStatus = (data.status || "active").toString().trim().toLowerCase();

          if (rawStatus.includes("pending")) {
            pending++;
          } else if (rawStatus === "inactive" || rawStatus === "archived") {
            // Exclude inactive tenants
          } else {
            // Count "active", "occupied", or undefined as active tenants
            active++;
          }
        });

        tenantsDataRef.current = { active, pending };
        recalculateOccupancy();
      },
      (error) => console.error("Error fetching tenants:", error)
    );

    // 3. Listen to Caretakers Data
    const unsubCaretakers = onSnapshot(
      query(collection(db, "users"), where("ownerUid", "==", ownerId), where("role", "==", "caretaker")),
      (snapshot) => {
        setStats((prev) => ({ ...prev, totalCaretakers: snapshot.docs.length }));
        setLoading(false);
      },
      (error) => {
        console.error("Error fetching caretakers:", error);
        setLoading(false);
      }
    );

    return () => {
      unsubProperties();
      unsubTenants();
      unsubCaretakers();
    };
  }, []);

  const pendingTickets = tickets.filter((t) => t.status !== "Resolved").slice(0, 3);
  const recentPayments = payments.slice(0, 4);

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", height: "60vh" }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Container maxWidth="xl" disableGutters>
      {/* Top Metrics Row */}
      <Grid container spacing={2.5} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <MetricBox title="Total Properties" value={stats.totalProperties} subtitle={`${stats.totalBeds} Total Capacity`} icon={<HomeWorkIcon sx={{ color: "primary.main" }} />} />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricBox title="Occupancy Rate" value={`${stats.occupancyRate}%`} subtitle={`${stats.occupiedBeds} / ${stats.totalBeds} Occupied`} icon={<PeopleIcon sx={{ color: "#0288d1" }} />} />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricBox title="Rent Collected This Month" value={`₱${stats.collectedThisMonth.toLocaleString()}`} subtitle={`Target: ₱${stats.totalRevenue.toLocaleString()}`} icon={<AttachMoneyIcon sx={{ color: "#2e7d32" }} />} />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricBox title="Pending Repairs" value={stats.pendingMaintenance} subtitle={`${stats.urgentMaintenance} Urgent Issues`} icon={<BuildOutlinedIcon sx={{ color: "#ed6c02" }} />} />
        </Grid>
      </Grid>

      {/* Bottom Dashboard Panels */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {/* Left Panel */}
        <Grid item xs={12} md={6}>
          <Paper elevation={0} sx={{ p: 3, border: "1px solid", borderColor: "divider", borderRadius: 3, height: "100%" }}>
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
              <Typography variant="h6" fontWeight="700">Recent Rent Collections</Typography>
              <Button size="small" variant="outlined" startIcon={<ReceiptLongIcon />} onClick={() => navigate("/owner/payments")}>
                View Payments
              </Button>
            </Box>
            <Stack spacing={1.5}>
              {recentPayments.length === 0 ? (
                <Typography variant="body2" color="text.secondary">No payments logged recently.</Typography>
              ) : (
                recentPayments.map((p) => (
                  <Box key={p.id} sx={{ p: 1.5, borderRadius: 2, bgcolor: "background.default", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <Box>
                      <Typography variant="subtitle2" fontWeight="700">{p.tenantName} — ₱{Number(p.amount).toLocaleString()}</Typography>
                      <Typography variant="caption" color="text.secondary">{p.propertyName} (Room {p.roomNumber})</Typography>
                    </Box>
                    <Chip label={p.status || "Paid"} color="success" size="small" />
                  </Box>
                ))
              )}
            </Stack>
          </Paper>
        </Grid>

        {/* Right Panel */}
        <Grid item xs={12} md={6}>
          <Paper elevation={0} sx={{ p: 3, border: "1px solid", borderColor: "divider", borderRadius: 3, height: "100%" }}>
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
              <Typography variant="h6" fontWeight="700">Tenant Onboarding & Caretakers</Typography>
              <Button size="small" variant="contained" startIcon={<PersonAddIcon />} onClick={() => navigate("/owner/tenants/register")}>
                Register Tenant
              </Button>
            </Box>
            
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <Box sx={{ p: 2, borderRadius: 2, bgcolor: "rgba(46, 125, 50, 0.08)" }}>
                  <Typography variant="caption" color="text.secondary" fontWeight="600">Active Tenants</Typography>
                  <Typography variant="h5" fontWeight="800" color="success.main">{stats.activeTenants}</Typography>
                </Box>
              </Grid>
              <Grid item xs={6}>
                <Box sx={{ p: 2, borderRadius: 2, bgcolor: "rgba(237, 108, 2, 0.08)" }}>
                  <Typography variant="caption" color="text.secondary" fontWeight="600">Pending Registration</Typography>
                  <Typography variant="h5" fontWeight="800" color="warning.main">{stats.pendingTenants}</Typography>
                </Box>
              </Grid>
            </Grid>

            <Box sx={{ mt: 2.5, pt: 2, borderTop: "1px solid", borderColor: "divider", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <Typography variant="body2" fontWeight="600">Active Caretakers: {stats.totalCaretakers}</Typography>
              <Stack direction="row" spacing={1}>
                <Button size="small" startIcon={<FormatListNumberedIcon />} onClick={() => navigate("/owner/caretakers")}>
                  List
                </Button>
                <Button size="small" variant="outlined" startIcon={<GroupAddIcon />} onClick={() => navigate("/owner/caretakers/invite")}>
                  Invite
                </Button>
              </Stack>
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Container>
  );
}