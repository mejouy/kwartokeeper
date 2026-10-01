import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Box, Typography, Button, IconButton, Chip, CircularProgress, 
  Paper, Grid, Divider, Stack
} from "@mui/material";

import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import EditIcon from "@mui/icons-material/Edit";
import BedroomParentIcon from "@mui/icons-material/BedroomParent";
import PolicyIcon from "@mui/icons-material/Policy";
import WifiIcon from "@mui/icons-material/Wifi";
import InsertDriveFileIcon from "@mui/icons-material/InsertDriveFile";

import { doc, getDoc } from "firebase/firestore";
import { db } from "../../../config/firebase"; // Adjust to your firebase path

// Helper function to safely render the address
const formatAddress = (address) => {
  if (!address) return "No address specified";
  if (typeof address === "string") return address;

  const { street, barangay, cityMunicipality, province } = address;
  const addressParts = [street, barangay, cityMunicipality, province].filter(Boolean);
  
  return addressParts.length > 0 ? addressParts.join(", ") : "Invalid address format";
};

export default function PropertyProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [property, setProperty] = useState(null);

  useEffect(() => {
    const fetchProperty = async () => {
      try {
        const docRef = doc(db, "properties", id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setProperty(docSnap.data());
        }
      } catch (error) {
        console.error("Error fetching property:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchProperty();
  }, [id]);

  if (loading) return <Box sx={{ display: "flex", justifyContent: "center", mt: 10 }}><CircularProgress /></Box>;
  if (!property) return <Typography align="center" mt={10}>Property not found.</Typography>;

  return (
    <Box sx={{ maxWidth: 1200, mx: "auto", p: { xs: 2, md: 4 } }}>
      
      {/* HEADER SECTION */}
      <Box sx={{ display: "flex", alignItems: "flex-start", mb: 4, flexWrap: "wrap", gap: 2 }}>
        <IconButton onClick={() => navigate("/owner/properties")} sx={{ mt: 0.5 }}>
          <ArrowBackIcon />
        </IconButton>
        
        <Box sx={{ flexGrow: 1 }}>
          <Box sx={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 2, mb: 1 }}>
            <Typography variant="h4" fontWeight="800">
              {property.propertyName || "Unnamed Property"}
            </Typography>
            <Chip label={property.propertyType || "Dormitory"} color="primary" variant="outlined" />
          </Box>
          <Typography variant="body1" color="text.secondary">
            {formatAddress(property.address)}
          </Typography>
        </Box>

        <Button
          variant="contained"
          size="large"
          startIcon={<EditIcon />}
          onClick={() => navigate(`/owner/properties/${id}/edit`)}
          sx={{ fontWeight: 700, px: 3, borderRadius: 2 }}
        >
          Edit Property
        </Button>
      </Box>

      <Divider sx={{ mb: 5 }} />

      {/* ROOMS SECTION */}
      <Box sx={{ mb: 6 }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 3 }}>
          <BedroomParentIcon color="primary" fontSize="large" />
          <Typography variant="h5" fontWeight="700">Available Rooms</Typography>
        </Box>
        
        {property.rooms?.length > 0 ? (
          <Grid container spacing={3}>
            {property.rooms.map((room, idx) => (
              <Grid item xs={12} sm={6} md={4} key={idx}>
                <Paper 
                  elevation={0} 
                  sx={{ 
                    p: 3, 
                    border: "1px solid", 
                    borderColor: "divider", 
                    borderRadius: 3,
                    height: "100%",
                    display: "flex",
                    flexDirection: "column"
                  }}
                >
                  <Typography fontWeight="800" variant="h6" mb={0.5}>
                    {room.roomName}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" mb={2}>
                    Floor {room.floor} • {room.capacity} Beds
                  </Typography>
                  <Box sx={{ mt: "auto" }}>
                    <Typography variant="h6" color="primary" fontWeight="800">
                      ₱{room.monthlyRatePerBed} <Typography component="span" variant="body2" color="text.secondary" fontWeight="500">/ bed</Typography>
                    </Typography>
                  </Box>
                </Paper>
              </Grid>
            ))}
          </Grid>
        ) : (
          <Typography color="text.secondary" sx={{ p: 3, bgcolor: "background.default", borderRadius: 2 }}>
            No rooms have been added to this property yet.
          </Typography>
        )}
      </Box>

      <Divider sx={{ mb: 5 }} />

      {/* AMENITIES & POLICIES SECTION */}
      <Grid container spacing={6}>
        
        {/* AMENITIES */}
        <Grid item xs={12} md={6}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 3 }}>
            <WifiIcon color="primary" fontSize="large" />
            <Typography variant="h5" fontWeight="700">Amenities</Typography>
          </Box>
          {property.amenities?.length > 0 ? (
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.5 }}>
              {property.amenities.map((amenity) => (
                <Chip 
                  key={amenity} 
                  label={amenity} 
                  sx={{ px: 1, py: 2.5, borderRadius: 2, fontWeight: 500 }} 
                />
              ))}
            </Box>
          ) : (
            <Typography color="text.secondary">No amenities listed.</Typography>
          )}
        </Grid>

        {/* HOUSE RULES & DOCUMENTS */}
        <Grid item xs={12} md={6}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 3 }}>
            <PolicyIcon color="primary" fontSize="large" />
            <Typography variant="h5" fontWeight="700">House Rules</Typography>
          </Box>
          <Typography variant="body1" sx={{ whiteSpace: "pre-line", mb: 4, color: "text.secondary", lineHeight: 1.7 }}>
            {property.rulesText || "No house rules specified."}
          </Typography>

          {property.ruleFiles?.length > 0 && (
            <Box>
              <Typography variant="subtitle2" fontWeight="700" color="text.primary" mb={2} textTransform="uppercase" letterSpacing={1}>
                Attached Documents
              </Typography>
              <Stack spacing={2}>
                {property.ruleFiles.map((file, idx) => (
                  <Button 
                    key={idx} 
                    variant="outlined" 
                    startIcon={<InsertDriveFileIcon color="action" />} 
                    href={file.url} 
                    target="_blank"
                    sx={{ 
                      justifyContent: "flex-start", 
                      color: "text.primary",
                      borderColor: "divider",
                      py: 1.5,
                      borderRadius: 2,
                      '&:hover': { bgcolor: "action.hover" }
                    }}
                  >
                    {file.name}
                  </Button>
                ))}
              </Stack>
            </Box>
          )}
        </Grid>

      </Grid>

    </Box>
  );
}