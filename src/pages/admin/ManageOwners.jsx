import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Paper,
  Typography,
  TableContainer,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Chip,
  Box,
  TextField,
  CircularProgress,
  Avatar,
  InputAdornment,
  Button,
  Tabs,
  Tab
} from "@mui/material";
import SearchIcon from "@mui/icons-material/Search";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "../../config/firebase"; // Adjust path if necessary

export default function ManageOwners() {
  const navigate = useNavigate();
  const [owners, setOwners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterTab, setFilterTab] = useState("all");

  useEffect(() => {
    const q = query(collection(db, "users"), where("role", "==", "owner"));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const ownerData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      // Sort by creation date (newest first) to keep pending registrations near the top
      ownerData.sort((a, b) => {
        const timeA = a.createdAt?.toMillis ? a.createdAt.toMillis() : 0;
        const timeB = b.createdAt?.toMillis ? b.createdAt.toMillis() : 0;
        return timeB - timeA;
      });

      setOwners(ownerData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const filteredOwners = owners.filter(o => {
    // 1. Filter by Tab Status
    const status = o.status || "active"; // fallback if no status field exists yet
    if (filterTab !== "all" && status !== filterTab) {
      // If tab is "active", it should match "active" or "approved"
      if (filterTab === "active" && status === "approved") {
        // allow
      } else {
        return false;
      }
    }

    // 2. Filter by Search Query
    const term = search.toLowerCase();
    const name = (o.fullName || o.name || `${o.firstName || ""} ${o.lastName || ""}`).toLowerCase();
    const email = (o.email || "").toLowerCase();
    const phone = (o.phoneNumber || o.phone || "").toLowerCase();
    
    return name.includes(term) || email.includes(term) || phone.includes(term);
  });

  // Helper to determine chip styling based on status
  const getStatusProps = (status) => {
    switch (status) {
      case "pending":
        return { label: "Pending", color: "warning", variant: "filled" };
      case "suspended":
        return { label: "Suspended", color: "error", variant: "filled" };
      case "active":
      case "approved":
      default:
        return { label: "Active", color: "success", variant: "outlined" };
    }
  };

  return (
    <Paper elevation={0} sx={{ p: 3, border: "1px solid", borderColor: "divider", borderRadius: 3 }}>
      <Box 
        sx={{ 
          display: "flex", 
          justifyContent: "space-between", 
          alignItems: { xs: "flex-start", sm: "center" }, 
          flexDirection: { xs: "column", sm: "row" },
          gap: 2,
          mb: 3 
        }}
      >
        <Box>
          <Typography variant="h6" fontWeight="700">Property Owners Directory</Typography>
          <Typography variant="body2" color="text.secondary">
            Manage registered platform owners and review pending applications.
          </Typography>
        </Box>

        <TextField
          size="small"
          placeholder="Search name, email, or phone..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ minWidth: { xs: "100%", sm: 280 } }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" color="action" />
              </InputAdornment>
            ),
          }}
        />
      </Box>

      {/* Status Filters */}
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
        <Tabs 
          value={filterTab} 
          onChange={(e, newValue) => setFilterTab(newValue)} 
          textColor="primary"
          indicatorColor="primary"
        >
          <Tab label="All Owners" value="all" sx={{ fontWeight: 600, textTransform: "none" }} />
          <Tab label="Pending" value="pending" sx={{ fontWeight: 600, textTransform: "none" }} />
          <Tab label="Active" value="active" sx={{ fontWeight: 600, textTransform: "none" }} />
          <Tab label="Suspended" value="suspended" sx={{ fontWeight: 600, textTransform: "none" }} />
        </Tabs>
      </Box>

      <TableContainer>
        <Table>
          <TableHead sx={{ bgcolor: "background.default" }}>
            <TableRow>
              <TableCell><strong>Owner Name</strong></TableCell>
              <TableCell><strong>Email</strong></TableCell>
              <TableCell><strong>Phone</strong></TableCell>
              <TableCell><strong>Status</strong></TableCell>
              <TableCell align="right"><strong>Action</strong></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                  <CircularProgress size={30} />
                </TableCell>
              </TableRow>
            ) : filteredOwners.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                  <Typography color="text.secondary">
                    {search ? "No owners match your search." : `No ${filterTab !== "all" ? filterTab : "registered"} owners found.`}
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              filteredOwners.map((owner) => {
                // Handle different name field variations (fullName, name, or firstName + lastName)
                const ownerName = owner.fullName || owner.name || 
                  (owner.firstName && owner.lastName ? `${owner.firstName} ${owner.lastName}` : "New Owner");
                
                const statusProps = getStatusProps(owner.status);

                return (
                  <TableRow 
                    key={owner.id} 
                    hover 
                    onClick={() => navigate(`/admin/owners/${owner.id}`)}
                    sx={{ cursor: "pointer" }}
                  >
                    <TableCell>
                      <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                        <Avatar sx={{ width: 36, height: 36, fontSize: "0.9rem", bgcolor: "primary.main", fontWeight: 700 }}>
                          {ownerName.charAt(0).toUpperCase()}
                        </Avatar>
                        <Box>
                          <Typography variant="subtitle2" fontWeight="700">
                            {ownerName}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" display={{ xs: "block", sm: "none" }}>
                            {owner.email || "No Email"}
                          </Typography>
                        </Box>
                      </Box>
                    </TableCell>

                    <TableCell>{owner.email || "—"}</TableCell>
                    
                    <TableCell>{owner.phoneNumber || owner.phone || "—"}</TableCell>
                    
                    <TableCell>
                      <Chip 
                        label={statusProps.label} 
                        color={statusProps.color} 
                        size="small" 
                        variant={statusProps.variant}
                        sx={{ fontWeight: 600 }}
                      />
                    </TableCell>

                    <TableCell align="right">
                      <Button
                        size="small"
                        endIcon={<ChevronRightIcon />}
                        onClick={(e) => {
                          e.stopPropagation(); // Prevents double triggers
                          navigate(`/admin/owners/${owner.id}`);
                        }}
                        sx={{ fontWeight: 600 }}
                      >
                        {owner.status === "pending" ? "Review" : "View Account"}
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
}