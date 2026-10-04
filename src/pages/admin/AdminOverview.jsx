import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Container,
  Grid,
  Paper,
  Typography,
  Card,
  CardContent,
  CircularProgress,
  Stack,
  Chip,
    IconButton,
  Button
} from "@mui/material";
import SupervisorAccountIcon from "@mui/icons-material/SupervisorAccount";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import MapsHomeWorkIcon from "@mui/icons-material/MapsHomeWork";
import GroupIcon from "@mui/icons-material/Group";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../../config/firebase"; // Adjust path if necessary

function AdminMetricBox({ title, value, subtitle, icon }) {
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

// Helper to format Firestore timestamps safely
const formatDate = (timestamp) => {
  if (!timestamp) return "Recently";
  const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
};

export default function AdminOverview() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    pendingOwners: 0,
    approvedOwners: 0,
    totalProperties: 0,
    totalTenants: 0,
  });
  
  const [pendingList, setPendingList] = useState([]);

  useEffect(() => {
    // 1. Listen to ALL Users to separate pending vs approved owners
    const unsubUsers = onSnapshot(collection(db, "users"), (snapshot) => {
      let approved = 0;
      let pending = 0;
      let pendingOwnersData = [];
      
      snapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.role === "owner") {
          // Adjust "status" field based on what you saved in Firebase during registration
          if (data.status === "pending") {
            pending++;
            pendingOwnersData.push({ id: doc.id, ...data });
          } else {
            approved++;
          }
        }
      });

      // Sort pending list by createdAt descending
      pendingOwnersData.sort((a, b) => {
        const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
        const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
        return timeB - timeA;
      });

      setStats(prev => ({ ...prev, approvedOwners: approved, pendingOwners: pending }));
      setPendingList(pendingOwnersData.slice(0, 5)); // Show up to 5 in the feed
    });

    // 2. Listen to ALL Properties
    const unsubProperties = onSnapshot(collection(db, "properties"), (snapshot) => {
      setStats(prev => ({ ...prev, totalProperties: snapshot.docs.length }));
    });

    // 3. Listen to ALL Tenants
    const unsubTenants = onSnapshot(collection(db, "tenants"), (snapshot) => {
      setStats(prev => ({ ...prev, totalTenants: snapshot.docs.length }));
      setLoading(false);
    });

    return () => {
      unsubUsers();
      unsubProperties();
      unsubTenants();
    };
  }, []);

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", height: "60vh" }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Container maxWidth="xl" disableGutters>
      <Typography variant="h5" fontWeight="800" sx={{ mb: 3 }}>
        System Overview
      </Typography>

      {/* Top Metrics Row */}
      <Grid container spacing={2.5} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <AdminMetricBox 
            title="Pending Approvals" 
            value={stats.pendingOwners} 
            subtitle="Owners awaiting verification" 
            icon={<PersonAddIcon sx={{ color: "#ed6c02" }} />} 
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <AdminMetricBox 
            title="Approved Owners" 
            value={stats.approvedOwners} 
            subtitle="Active platform clients" 
            icon={<SupervisorAccountIcon sx={{ color: "#9c27b0" }} />} 
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <AdminMetricBox 
            title="Total Properties" 
            value={stats.totalProperties} 
            subtitle="System-wide dorms/apts" 
            icon={<MapsHomeWorkIcon sx={{ color: "#0288d1" }} />} 
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <AdminMetricBox 
            title="Total Tenants" 
            value={stats.totalTenants} 
            subtitle="Overall occupancy" 
            icon={<GroupIcon sx={{ color: "#2e7d32" }} />} 
          />
        </Grid>
      </Grid>

      {/* Bottom Layout - Admin Feed & Quick Actions */}
      <Grid container spacing={3}>
        
        {/* Action Required: Pending Owner Registrations */}
        <Grid item xs={12} md={8}>
          <Paper elevation={0} sx={{ p: 3, border: "1px solid", borderColor: "divider", borderRadius: 3, height: "100%" }}>
            <Box sx={{ mb: 2, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <Box>
                <Typography variant="h6" fontWeight="700">Action Required: Registrations</Typography>
                <Typography variant="body2" color="text.secondary">Review and approve pending owner accounts.</Typography>
              </Box>
              <Button 
                variant="outlined" 
                size="small" 
                onClick={() => navigate("/admin/owners")}
                sx={{ borderRadius: 2, textTransform: "none", fontWeight: 600 }}
              >
                View All
              </Button>
            </Box>
            
            <Stack spacing={2}>
              {pendingList.length === 0 ? (
                <Box sx={{ py: 4, textAlign: "center", bgcolor: "background.default", borderRadius: 2 }}>
                  <Typography variant="body2" color="text.secondary">All caught up! No pending registrations.</Typography>
                </Box>
              ) : (
                pendingList.map((owner) => (
                  <Box 
                    key={owner.id} 
                    sx={{ 
                      p: 2, 
                      borderRadius: 2, 
                      bgcolor: "background.default", 
                      display: "flex", 
                      justifyContent: "space-between", 
                      alignItems: "center",
                      border: "1px solid",
                      borderColor: "transparent",
                      transition: "all 0.2s",
                      "&:hover": { borderColor: "divider", bgcolor: "action.hover" }
                    }}
                  >
                    <Box>
                      <Typography variant="subtitle2" fontWeight="700">
                        {owner.firstName && owner.lastName ? `${owner.firstName} ${owner.lastName}` : "New Owner"}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" display="block">
                        {owner.email} • Applied: {formatDate(owner.createdAt)}
                      </Typography>
                    </Box>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                      <Chip label="Pending" color="warning" size="small" sx={{ fontWeight: 600 }} />
                      <IconButton onClick={() => navigate("/admin/owners")} color="primary" size="small">
                        <ArrowForwardIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  </Box>
                ))
              )}
            </Stack>
          </Paper>
        </Grid>

        {/* Quick Actions Panel */}
        <Grid item xs={12} md={4}>
          <Paper elevation={0} sx={{ p: 3, border: "1px solid", borderColor: "divider", borderRadius: 3, height: "100%", bgcolor: "primary.main", color: "primary.contrastText" }}>
            <Typography variant="h6" fontWeight="700" sx={{ mb: 2 }}>Admin Quick Actions</Typography>
            <Stack spacing={2}>
              
              <Box 
                onClick={() => navigate("/admin/owners")}
                sx={{ 
                  p: 2, 
                  bgcolor: "rgba(255,255,255,0.1)", 
                  borderRadius: 2, 
                  cursor: "pointer", 
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  transition: "background-color 0.2s",
                  "&:hover": { bgcolor: "rgba(255,255,255,0.2)" } 
                }}
              >
                <Box>
                  <Typography variant="subtitle2" fontWeight="700">Manage Owners</Typography>
                  <Typography variant="caption" sx={{ opacity: 0.8 }}>Approve, view, or suspend registered owners.</Typography>
                </Box>
                <ArrowForwardIcon fontSize="small" />
              </Box>

              <Box 
                onClick={() => navigate("/admin/settings")}
                sx={{ 
                  p: 2, 
                  bgcolor: "rgba(255,255,255,0.1)", 
                  borderRadius: 2, 
                  cursor: "pointer", 
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  transition: "background-color 0.2s",
                  "&:hover": { bgcolor: "rgba(255,255,255,0.2)" } 
                }}
              >
                <Box>
                  <Typography variant="subtitle2" fontWeight="700">Global Settings</Typography>
                  <Typography variant="caption" sx={{ opacity: 0.8 }}>Adjust platform settings and configurations.</Typography>
                </Box>
                <ArrowForwardIcon fontSize="small" />
              </Box>

              <Box 
                onClick={() => navigate("/admin/announcements")}
                sx={{ 
                  p: 2, 
                  bgcolor: "rgba(255,255,255,0.1)", 
                  borderRadius: 2, 
                  cursor: "pointer", 
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  transition: "background-color 0.2s",
                  "&:hover": { bgcolor: "rgba(255,255,255,0.2)" } 
                }}
              >
                <Box>
                  <Typography variant="subtitle2" fontWeight="700">System Broadcasts</Typography>
                  <Typography variant="caption" sx={{ opacity: 0.8 }}>Send updates or announcements to owners.</Typography>
                </Box>
                <ArrowForwardIcon fontSize="small" />
              </Box>

            </Stack>
          </Paper>
        </Grid>
      </Grid>
    </Container>
  );
}