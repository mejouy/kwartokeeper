import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Paper,
  Typography,
  Stack,
  TextField,
  Button,
  TableContainer,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Chip,
  CircularProgress,
  Avatar
} from "@mui/material";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { auth, db } from "../../../config/firebase";

export default function TenantList() {
  const navigate = useNavigate();
  
  const [tenants, setTenants] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);

  // Fetch tenants belonging to the logged-in owner in real-time
  useEffect(() => {
    if (!auth.currentUser) {
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, "tenants"),
      where("ownerUid", "==", auth.currentUser.uid)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const tenantData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setTenants(tenantData);
        setLoading(false);
      },
      (error) => {
        console.error("Error fetching tenants:", error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // Filter tenants based on name or email search query
  const filteredTenants = tenants.filter((t) => {
    const name = t.fullName || t.name || "";
    const email = t.email || "";
    const term = searchQuery.toLowerCase();
    return name.toLowerCase().includes(term) || email.toLowerCase().includes(term);
  });

  return (
    <Paper elevation={0} sx={{ p: 3, border: "1px solid", borderColor: "divider", borderRadius: 3 }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3, flexWrap: "wrap", gap: 2 }}>
        <Typography variant="h6" fontWeight="700">Enrolled Tenants Directory</Typography>
        <Stack direction="row" spacing={2}>
          <TextField 
            size="small" 
            placeholder="Search tenant or email..." 
            value={searchQuery} 
            onChange={(e) => setSearchQuery(e.target.value)} 
          />
          <Button 
            variant="contained" 
            startIcon={<PersonAddIcon />} 
            onClick={() => navigate("/owner/tenants/register")}
          >
            Register Tenant
          </Button>
        </Stack>
      </Box>

      <TableContainer>
        <Table>
          <TableHead sx={{ bgcolor: "background.default" }}>
            <TableRow>
              <TableCell><strong>Tenant Name</strong></TableCell>
              <TableCell><strong>Room &amp; Bed</strong></TableCell>
              <TableCell><strong>Contact Info</strong></TableCell>
              <TableCell><strong>Status</strong></TableCell>
              <TableCell align="right"><strong>Action</strong></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} align="center" sx={{ py: 5 }}>
                  <CircularProgress size={32} />
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    Loading directory...
                  </Typography>
                </TableCell>
              </TableRow>
            ) : filteredTenants.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                  <Typography color="text.secondary">
                    {searchQuery ? "No tenants match your search." : "No tenants enrolled yet."}
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              filteredTenants.map((t) => (
                <TableRow key={t.id} hover>
                  <TableCell>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                      <Avatar 
                        src={t.idPhotoUrl || ""} 
                        alt={t.fullName || t.name}
                        sx={{ width: 36, height: 36, fontSize: "0.875rem" }}
                      >
                        {(t.fullName || t.name || "T").charAt(0).toUpperCase()}
                      </Avatar>
                      <Box>
                        <Typography variant="subtitle2" fontWeight="700">
                          {t.fullName || t.name || "Unnamed Tenant"}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {t.idType ? t.idType.replace("_", " ").toUpperCase() : "No ID Provided"}
                        </Typography>
                      </Box>
                    </Box>
                  </TableCell>
                  <TableCell>
                    {t.roomId ? (
                      <Typography variant="body2" fontWeight="500">
                        {t.roomId} {t.bedId ? `(${t.bedId})` : ""}
                      </Typography>
                    ) : (
                      <Chip label="Unassigned" size="small" color="warning" variant="outlined" />
                    )}
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{t.phone || "—"}</Typography>
                    <Typography variant="caption" color="text.secondary" display="block">
                      {t.email || "—"}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip 
                      label={t.status || "Active"} 
                      color={
                        t.status === "Pending Onboarding" ? "warning" : 
                        t.status === "Inactive" ? "default" : "success"
                      } 
                      size="small" 
                    />
                  </TableCell>
                  <TableCell align="right">
                    <Button size="small" variant="outlined" onClick={() => navigate(`/owner/tenants/${t.id}`)}>
                      Manage
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
}