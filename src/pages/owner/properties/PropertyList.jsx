import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Paper,
  Typography,
  Button,
  TableContainer,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  LinearProgress,
  CircularProgress,
  Alert
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";

import { db, auth } from "../../../config/firebase"; 
import { collection, query, where, getDocs } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

export default function PropertyList() {
  const navigate = useNavigate();
  
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Fetch properties from Firestore
  useEffect(() => {
    let isMounted = true; 

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          const q = query(collection(db, "properties"), where("ownerUid", "==", user.uid));
          const querySnapshot = await getDocs(q);
          
          if (isMounted) {
            const propsData = querySnapshot.docs.map(doc => ({
              id: doc.id,
              ...doc.data()
            }));
            
            setProperties(propsData);
            setError(null);
          }
        } catch (err) {
          console.error("Error fetching properties:", err);
          if (isMounted) {
            setError("Failed to load properties. Please try again.");
          }
        }
      } else {
        if (isMounted) {
          setProperties([]);
        }
      }
      
      if (isMounted) {
        setLoading(false);
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  return (
    <Paper elevation={0} sx={{ p: 3, border: "1px solid", borderColor: "divider", borderRadius: 3 }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3 }}>
        <Box>
          <Typography variant="h6" fontWeight="700">Property Directory</Typography>
          <Typography variant="body2" color="text.secondary">Manage buildings, rooms, and bed capacity</Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => navigate("/setup")}
          sx={{ fontWeight: 600 }}
        >
          Add Property
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <TableContainer>
        <Table sx={{ minWidth: 600 }}>
          <TableHead sx={{ bgcolor: "background.default" }}>
            <TableRow>
              <TableCell><strong>Property Name</strong></TableCell>
              <TableCell><strong>Type</strong></TableCell>
              <TableCell><strong>Occupied / Total Beds</strong></TableCell>
              <TableCell align="right"><strong>Action</strong></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={4} align="center" sx={{ py: 5 }}>
                  <CircularProgress size={30} />
                  <Typography variant="body2" sx={{ mt: 1, color: "text.secondary" }}>
                    Loading properties...
                  </Typography>
                </TableCell>
              </TableRow>
            ) : properties.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} align="center" sx={{ py: 5 }}>
                  <Typography color="text.secondary">
                    No properties found. Add your first property!
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              properties.map((p) => {
                const occ = p.totalBeds > 0 
                  ? Math.round(((p.occupiedBeds || 0) / p.totalBeds) * 100) 
                  : 0;

                return (
                  <TableRow 
                    key={p.id} 
                    hover 
                    onClick={() => navigate(`/owner/properties/${p.id}`)} 
                    sx={{ cursor: "pointer" }}
                  >
                    <TableCell>
                      <Typography variant="subtitle2" fontWeight="700" color="primary">
                        {p.propertyName || p.name}
                      </Typography>
                    </TableCell>
                    <TableCell>{p.propertyType || "Dormitory"}</TableCell>
                    <TableCell>
                      <Box sx={{ maxWidth: 200 }}>
                        <Typography variant="caption" fontWeight="600">
                          {p.occupiedBeds || 0} / {p.totalBeds || 0} Beds ({occ}%)
                        </Typography>
                        <LinearProgress 
                          variant="determinate" 
                          value={occ} 
                          color={occ >= 80 ? "success" : "warning"} 
                          sx={{ height: 6, borderRadius: 3, mt: 0.5 }} 
                        />
                      </Box>
                    </TableCell>
                    <TableCell align="right">
                      <Button 
                        size="small" 
                        endIcon={<ArrowForwardIcon />}
                        onClick={(e) => {
                          e.stopPropagation(); // Stops the row click from firing so we don't navigate twice
                          navigate(`/owner/properties/${p.id}`);
                        }}
                      >
                        View
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