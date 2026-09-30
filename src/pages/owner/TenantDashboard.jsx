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
} from "@mui/material";

import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import MeetingRoomIcon from "@mui/icons-material/MeetingRoom";
import LogoutIcon from "@mui/icons-material/Logout";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";

import { useNavigate } from "react-router-dom";
import { signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../../config/firebase";

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
          });
        }
      } catch (err) {
        console.error("Error fetching tenant profile:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [navigate]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate("/login");
    } catch (err) {
      console.error("Logout failed:", err);
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
            sx={{ border: "1px solid", borderColor: "divider", borderRadius: 3 }}
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
            sx={{ border: "1px solid", borderColor: "divider", borderRadius: 3 }}
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
            sx={{ border: "1px solid", borderColor: "divider", borderRadius: 3 }}
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
      </Container>
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