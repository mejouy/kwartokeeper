import React, { useState, useEffect } from "react";
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
  Chip
} from "@mui/material";
import SupervisorAccountIcon from "@mui/icons-material/SupervisorAccount";
import MapsHomeWorkIcon from "@mui/icons-material/MapsHomeWork";
import GroupIcon from "@mui/icons-material/Group";
import SupportAgentIcon from "@mui/icons-material/SupportAgent";
import { collection, onSnapshot, query, where, orderBy, limit } from "firebase/firestore";
import { db } from "../../config/firebase"; // Make sure this path is correct

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

export default function AdminOverview() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalOwners: 0,
    totalProperties: 0,
    totalTenants: 0,
    totalCaretakers: 0,
  });
  
  const [recentProperties, setRecentProperties] = useState([]);

  useEffect(() => {
    // 1. Listen to ALL Users (Filter locally or by query to count roles)
    const unsubUsers = onSnapshot(collection(db, "users"), (snapshot) => {
      let owners = 0;
      let caretakers = 0;
      
      snapshot.docs.forEach(doc => {
        const role = doc.data().role;
        if (role === "owner") owners++;
        if (role === "caretaker") caretakers++;
      });

      setStats(prev => ({ ...prev, totalOwners: owners, totalCaretakers: caretakers }));
    });

    // 2. Listen to ALL Properties
    const unsubProperties = onSnapshot(
      query(collection(db, "properties"), orderBy("createdAt", "desc")), 
      (snapshot) => {
        setStats(prev => ({ ...prev, totalProperties: snapshot.docs.length }));
        
        // Grab the 4 most recently added properties for the feed
        const recent = snapshot.docs.slice(0, 4).map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setRecentProperties(recent);
      }
    );

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
            title="Registered Owners" 
            value={stats.totalOwners} 
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
        <Grid item xs={12} sm={6} md={3}>
          <AdminMetricBox 
            title="Active Caretakers" 
            value={stats.totalCaretakers} 
            subtitle="Staff across all properties" 
            icon={<SupportAgentIcon sx={{ color: "#ed6c02" }} />} 
          />
        </Grid>
      </Grid>

      {/* Bottom Layout - Admin Feed */}
      <Grid container spacing={3}>
        <Grid item xs={12} md={8}>
          <Paper elevation={0} sx={{ p: 3, border: "1px solid", borderColor: "divider", borderRadius: 3, height: "100%" }}>
            <Box sx={{ mb: 2 }}>
              <Typography variant="h6" fontWeight="700">Recently Added Properties</Typography>
              <Typography variant="body2" color="text.secondary">Latest properties registered by owners across the system.</Typography>
            </Box>
            
            <Stack spacing={2}>
              {recentProperties.length === 0 ? (
                <Typography variant="body2" color="text.secondary">No properties added yet.</Typography>
              ) : (
                recentProperties.map((prop) => (
                  <Box key={prop.id} sx={{ p: 2, borderRadius: 2, bgcolor: "background.default", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <Box>
                      <Typography variant="subtitle2" fontWeight="700">{prop.propertyName || "Unnamed Property"}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        Owner UID: {prop.ownerUid} | Rooms: {prop.rooms?.length || 0}
                      </Typography>
                    </Box>
                    <Chip label="Active" color="success" size="small" variant="outlined" />
                  </Box>
                ))
              )}
            </Stack>
          </Paper>
        </Grid>

        <Grid item xs={12} md={4}>
          <Paper elevation={0} sx={{ p: 3, border: "1px solid", borderColor: "divider", borderRadius: 3, height: "100%", bgcolor: "primary.main", color: "primary.contrastText" }}>
            <Typography variant="h6" fontWeight="700" sx={{ mb: 2 }}>Admin Quick Actions</Typography>
            <Stack spacing={2}>
              <Box sx={{ p: 2, bgcolor: "rgba(255,255,255,0.1)", borderRadius: 2, cursor: "pointer", "&:hover": { bgcolor: "rgba(255,255,255,0.2)" } }}>
                <Typography variant="subtitle2" fontWeight="700">Manage Owners</Typography>
                <Typography variant="caption">View, suspend, or assist registered owners.</Typography>
              </Box>
              <Box sx={{ p: 2, bgcolor: "rgba(255,255,255,0.1)", borderRadius: 2, cursor: "pointer", "&:hover": { bgcolor: "rgba(255,255,255,0.2)" } }}>
                <Typography variant="subtitle2" fontWeight="700">Global Settings</Typography>
                <Typography variant="caption">Adjust platform fees, terms, and configurations.</Typography>
              </Box>
              <Box sx={{ p: 2, bgcolor: "rgba(255,255,255,0.1)", borderRadius: 2, cursor: "pointer", "&:hover": { bgcolor: "rgba(255,255,255,0.2)" } }}>
                <Typography variant="subtitle2" fontWeight="700">System Logs</Typography>
                <Typography variant="caption">Review platform errors and security events.</Typography>
              </Box>
            </Stack>
          </Paper>
        </Grid>
      </Grid>
    </Container>
  );
}