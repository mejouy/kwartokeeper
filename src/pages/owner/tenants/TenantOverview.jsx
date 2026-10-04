import React from "react";
import {
  Box,
  Grid,
  Paper,
  Typography,
  Chip,
  Button,
  Divider,
  Avatar,
  Stack,
} from "@mui/material";
import HomeWorkIcon from "@mui/icons-material/HomeWork";
import MeetingRoomIcon from "@mui/icons-material/MeetingRoom";
import PaymentsIcon from "@mui/icons-material/Payments";
import BuildIcon from "@mui/icons-material/Build";
import CalendarTodayIcon from "@mui/icons-material/CalendarToday";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import PhoneIcon from "@mui/icons-material/Phone";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import { useNavigate } from "react-router-dom";

export default function TenantOverview() {
  const navigate = useNavigate();

  // Mock data (replace with state/props or Firestore queries)
  const tenantData = {
    propertyName: "www",
    roomNumber: "101",
    monthlyRent: "₱0",
    nextDueDate: "Oct 15, 2026",
    maintenanceCount: 1,
    accountStatus: "Active",
    caretakerName: "Juan Dela Cruz",
    caretakerPhone: "0917-123-4567",
    recentReport: {
      title: "q",
      room: "Room 101",
      date: "9/30/2026",
      status: "Pending",
    },
  };

  return (
    <Box sx={{ width: "100%", py: 1 }}>
      {/* Header Banner */}
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 3,
        }}
      >
        <Typography variant="h4" fontWeight="700" sx={{ color: "#2D2D2D" }}>
          Overview
        </Typography>

        <Stack direction="row" spacing={1} alignItems="center">
          <Typography variant="body2" color="text.secondary">
            Account Status:
          </Typography>
          <Chip
            icon={<CheckCircleIcon style={{ color: "#FFF" }} />}
            label={tenantData.accountStatus}
            color="success"
            size="medium"
            sx={{ fontWeight: "600", px: 1 }}
          />
        </Stack>
      </Box>

      {/* Top 4 Key Stat Cards (Maximized & Full Width) */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {/* Card 1: Property */}
        <Grid item xs={12} sm={6} md={3}>
          <Paper
            elevation={0}
            sx={{
              p: 3,
              borderRadius: 3,
              bgcolor: "#F5EFE6",
              border: "1px solid #E5DFD5",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              height: "100%",
              minHeight: 160,
            }}
          >
            <Box
              sx={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
              }}
            >
              <Typography variant="subtitle1" fontWeight="600" color="text.secondary">
                Property
              </Typography>
              <Avatar sx={{ bgcolor: "#FF6B35", width: 44, height: 44 }}>
                <HomeWorkIcon />
              </Avatar>
            </Box>
            <Box sx={{ mt: 2 }}>
              <Typography variant="h3" fontWeight="700" color="#2D2D2D">
                {tenantData.propertyName}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Assigned Residence
              </Typography>
            </Box>
          </Paper>
        </Grid>

        {/* Card 2: Room */}
        <Grid item xs={12} sm={6} md={3}>
          <Paper
            elevation={0}
            sx={{
              p: 3,
              borderRadius: 3,
              bgcolor: "#F5EFE6",
              border: "1px solid #E5DFD5",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              height: "100%",
              minHeight: 160,
            }}
          >
            <Box
              sx={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
              }}
            >
              <Typography variant="subtitle1" fontWeight="600" color="text.secondary">
                Room
              </Typography>
              <Avatar sx={{ bgcolor: "#FF6B35", width: 44, height: 44 }}>
                <MeetingRoomIcon />
              </Avatar>
            </Box>
            <Box sx={{ mt: 2 }}>
              <Typography variant="h3" fontWeight="700" color="#2D2D2D">
                {tenantData.roomNumber}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Unit Number
              </Typography>
            </Box>
          </Paper>
        </Grid>

        {/* Card 3: Monthly Rent */}
        <Grid item xs={12} sm={6} md={3}>
          <Paper
            elevation={0}
            sx={{
              p: 3,
              borderRadius: 3,
              bgcolor: "#F5EFE6",
              border: "1px solid #E5DFD5",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              height: "100%",
              minHeight: 160,
            }}
          >
            <Box
              sx={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
              }}
            >
              <Typography variant="subtitle1" fontWeight="600" color="text.secondary">
                Monthly Rent
              </Typography>
              <Avatar sx={{ bgcolor: "#FF6B35", width: 44, height: 44 }}>
                <PaymentsIcon />
              </Avatar>
            </Box>
            <Box sx={{ mt: 2 }}>
              <Typography variant="h3" fontWeight="700" color="#2D2D2D">
                {tenantData.monthlyRent}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Next Due: {tenantData.nextDueDate}
              </Typography>
            </Box>
          </Paper>
        </Grid>

        {/* Card 4: Maintenance Reports */}
        <Grid item xs={12} sm={6} md={3}>
          <Paper
            elevation={0}
            sx={{
              p: 3,
              borderRadius: 3,
              bgcolor: "#F5EFE6",
              border: "1px solid #E5DFD5",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              height: "100%",
              minHeight: 160,
            }}
          >
            <Box
              sx={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
              }}
            >
              <Typography variant="subtitle1" fontWeight="600" color="text.secondary">
                Maintenance Reports
              </Typography>
              <Avatar sx={{ bgcolor: "#FF6B35", width: 44, height: 44 }}>
                <BuildIcon />
              </Avatar>
            </Box>
            <Box sx={{ mt: 2 }}>
              <Typography variant="h3" fontWeight="700" color="#2D2D2D">
                {tenantData.maintenanceCount}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Active Requests
              </Typography>
            </Box>
          </Paper>
        </Grid>
      </Grid>

      {/* Bottom Layout: Maintenance Report Card + Quick Info Card */}
      <Grid container spacing={3}>
        {/* Maintenance Report Section */}
        <Grid item xs={12} md={8}>
          <Paper
            elevation={0}
            sx={{
              p: 3.5,
              borderRadius: 3,
              bgcolor: "#F5EFE6",
              border: "1px solid #E5DFD5",
            }}
          >
            <Box
              sx={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                mb: 2.5,
              }}
            >
              <Typography variant="h6" fontWeight="700" color="#2D2D2D">
                Recent Maintenance Report
              </Typography>
              <Button
                size="small"
                endIcon={<ArrowForwardIcon />}
                onClick={() => navigate("/tenant/maintenance")}
                sx={{ color: "#FF6B35", fontWeight: "700", textTransform: "none" }}
              >
                View all reports
              </Button>
            </Box>

            {tenantData.recentReport ? (
              <Paper
                elevation={0}
                sx={{
                  p: 2.5,
                  borderRadius: 2,
                  bgcolor: "#FFFFFF",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  border: "1px solid #E5DFD5",
                }}
              >
                <Box>
                  <Typography variant="h6" fontWeight="600" color="#2D2D2D">
                    {tenantData.recentReport.title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {tenantData.recentReport.room} • Submited on {tenantData.recentReport.date}
                  </Typography>
                </Box>
                <Chip
                  label={tenantData.recentReport.status}
                  sx={{
                    bgcolor: "#FF6B35",
                    color: "#FFFFFF",
                    fontWeight: "700",
                    px: 1,
                  }}
                />
              </Paper>
            ) : (
              <Typography variant="body2" color="text.secondary">
                No active maintenance reports found.
              </Typography>
            )}
          </Paper>
        </Grid>

        {/* Quick Contact & Helpful Information */}
        <Grid item xs={12} md={4}>
          <Paper
            elevation={0}
            sx={{
              p: 3.5,
              borderRadius: 3,
              bgcolor: "#F5EFE6",
              border: "1px solid #E5DFD5",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              height: "100%",
            }}
          >
            <Typography variant="h6" fontWeight="700" color="#2D2D2D" sx={{ mb: 2 }}>
              Property Contact
            </Typography>

            <Box sx={{ bgcolor: "#FFFFFF", p: 2, borderRadius: 2, border: "1px solid #E5DFD5", mb: 2 }}>
              <Typography variant="caption" color="text.secondary" fontWeight="600">
                ASSIGNED CARETAKER
              </Typography>
              <Typography variant="subtitle1" fontWeight="700" color="#2D2D2D">
                {tenantData.caretakerName}
              </Typography>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1 }}>
                <PhoneIcon fontSize="small" sx={{ color: "#FF6B35" }} />
                <Typography variant="body2" fontWeight="600" color="text.secondary">
                  {tenantData.caretakerPhone}
                </Typography>
              </Stack>
            </Box>

            <Button
              variant="contained"
              fullWidth
              onClick={() => navigate("/tenant/maintenance")}
              sx={{
                bgcolor: "#FF6B35",
                color: "#FFFFFF",
                py: 1.2,
                fontWeight: "700",
                borderRadius: 2,
                textTransform: "none",
                "&:hover": { bgcolor: "#E05A2B" },
              }}
            >
              + Create Maintenance Ticket
            </Button>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}