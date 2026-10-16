import React, { useState, useEffect } from "react";
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
  Avatar
} from "@mui/material";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "../../config/firebase";

export default function ManageOwners() {
  const [owners, setOwners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const q = query(collection(db, "users"), where("role", "==", "owner"));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const ownerData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setOwners(ownerData);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const filteredOwners = owners.filter(o => {
    const term = search.toLowerCase();
    const name = o.fullName || o.name || "";
    const email = o.email || "";
    return name.toLowerCase().includes(term) || email.toLowerCase().includes(term);
  });

  return (
    <Paper elevation={0} sx={{ p: 3, border: "1px solid", borderColor: "divider", borderRadius: 3 }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3 }}>
        <Typography variant="h6" fontWeight="700">Property Owners Directory</Typography>
        <TextField
          size="small"
          placeholder="Search owner name or email..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </Box>

      <TableContainer>
        <Table>
          <TableHead sx={{ bgcolor: "background.default" }}>
            <TableRow>
              <TableCell><strong>Owner Name</strong></TableCell>
              <TableCell><strong>Email</strong></TableCell>
              <TableCell><strong>Phone</strong></TableCell>
              <TableCell><strong>Status</strong></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={4} align="center" sx={{ py: 4 }}>
                  <CircularProgress size={30} />
                </TableCell>
              </TableRow>
            ) : filteredOwners.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} align="center" sx={{ py: 3 }}>
                  <Typography color="text.secondary">No owners found.</Typography>
                </TableCell>
              </TableRow>
            ) : (
              filteredOwners.map((owner) => (
                <TableRow key={owner.id} hover>
                  <TableCell>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                      <Avatar sx={{ width: 32, height: 32, fontSize: "0.85rem" }}>
                        {(owner.fullName || owner.name || "O").charAt(0).toUpperCase()}
                      </Avatar>
                      <Typography variant="subtitle2" fontWeight="700">
                        {owner.fullName || owner.name || "Unnamed Owner"}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>{owner.email || "—"}</TableCell>
                  <TableCell>{owner.phoneNumber || owner.phone || "—"}</TableCell>
                  <TableCell>
                    <Chip label="Active" color="success" size="small" />
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