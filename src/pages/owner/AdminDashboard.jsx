import React, { useEffect, useState } from "react";
import {
  Container,
  Typography,
  Box,
  Grid,
  Card,
  CardContent,
  CircularProgress,
  Alert,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import HomeWorkIcon from "@mui/icons-material/HomeWork";
import HotelIcon from "@mui/icons-material/Hotel";
import PieChartIcon from "@mui/icons-material/PieChart";
import { useNavigate } from "react-router-dom";
import { collection, onSnapshot } from "firebase/firestore";

// Adjust path relative to src/pages/owner/
import { db } from "../../config/firebase";
import { useAuth } from "../../context/AuthContext";

const getOwnerValue = (property = {}) => {
  const nestedOwner = property.owner && typeof property.owner === "object" ? property.owner : {};

  return (
    property.ownerUid ??
    property.ownerId ??
    property.createdBy ??
    property.userId ??
    property.uid ??
    nestedOwner.uid ??
    nestedOwner.id ??
    nestedOwner.ownerUid ??
    ""
  );
};

const normalizeProperty = (property = {}) => {
  const address = property.address && typeof property.address === "object" ? property.address : {};

  const street = property.street ?? address.street ?? "";
  const barangay = property.barangay ?? address.barangay ?? "";
  const cityMunicipality = property.cityMunicipality ?? address.cityMunicipality ?? "";
  const province = property.province ?? address.province ?? "";
  const region = property.region ?? address.region ?? "";

  const ownerUid = getOwnerValue(property);

  return {
    ...property,
    ownerUid,
    ownerId: property.ownerId ?? property.ownerUid ?? ownerUid,
    propertyName: property.propertyName || property.name || "Unnamed Property",
    propertyType: property.propertyType || "N/A",
    street,
    barangay,
    cityMunicipality,
    province,
    region,
    addressText: [street, barangay, cityMunicipality, province, region]
      .filter(Boolean)
      .join(", ") || "N/A",
  };
};

export default function AdminDashboard() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!currentUser?.uid) {
      setLoading(false);
      return;
    }

    const propertiesRef = collection(db, "properties");

    const unsubscribe = onSnapshot(
      propertiesRef,
      (snapshot) => {
        const currentUserId = String(currentUser?.uid || "").trim().toLowerCase();

        const docs = snapshot.docs
          .map((doc) => ({
            id: doc.id,
            ...normalizeProperty(doc.data()),
          }))
          .filter((property) => {
            const ownerValue = String(getOwnerValue(property) || "").trim().toLowerCase();
            return ownerValue === currentUserId;
          })
          .sort((a, b) => (a.propertyName || "").localeCompare(b.propertyName || ""));

        setProperties(docs);

        if (currentUserId && docs.length === 0) {
          navigate("/setup", { replace: true });
          return;
        }

        setLoading(false);
      },
      (err) => {
        console.error("Firestore real-time error:", err);
        setError("Failed to fetch property updates.");
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [currentUser?.uid, navigate]);

  const totalProperties = properties.length;
  const totalBeds = properties.reduce(
    (sum, p) => sum + (Number(p.totalBeds) || 0),
    0
  );
  const occupiedBeds = properties.reduce(
    (sum, p) => sum + (Number(p.occupiedBeds) || 0),
    0
  );
  const occupancyRate =
    totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0;

  if (loading) {
    return (
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          minHeight: "60vh",
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      {/* Dashboard Title & Action */}
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 4,
        }}
      >
        <Box>
          <Typography variant="h4" fontWeight="bold">
            Owner Dashboard
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Overview of registered properties, total capacity, and occupancy rates.
          </Typography>
        </Box>
        <Button
          variant="contained"
          color="primary"
          startIcon={<AddIcon />}
          onClick={() => navigate("/setup")}
        >
          Add Property
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

      {/* Dynamic Summary Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid size={{ xs: 12, sm: 4 }}>
          <MetricCard
            title="Total Properties"
            value={totalProperties}
            icon={<HomeWorkIcon color="primary" fontSize="large" />}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <MetricCard
            title="Total Capacity"
            value={`${totalBeds} Beds`}
            icon={<HotelIcon color="secondary" fontSize="large" />}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <MetricCard
            title="Occupancy Rate"
            value={`${occupancyRate}%`}
            icon={<PieChartIcon color="success" fontSize="large" />}
          />
        </Grid>
      </Grid>

      {/* Property List Table */}
      <Typography variant="h6" fontWeight="bold" mb={2}>
        Property Directory
      </Typography>

      {properties.length === 0 ? (
        <Alert severity="info">
          No properties registered under your account yet. Click <strong>Add Property</strong> to run the setup.
        </Alert>
      ) : (
        <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
          <Table>
            <TableHead sx={{ bgcolor: "#f5f5f5" }}>
              <TableRow>
                <TableCell><strong>Property Name</strong></TableCell>
                <TableCell><strong>Type</strong></TableCell>
                <TableCell><strong>Address</strong></TableCell>
                <TableCell><strong>Floors</strong></TableCell>
                <TableCell><strong>Occupied / Total Beds</strong></TableCell>
                <TableCell><strong>Status</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {properties.map((property) => (
                <TableRow key={property.id} hover>
                  {/* Renders the specific property name registered by the logged-in owner */}
                  <TableCell>{property.propertyName || property.name || "Unnamed Property"}</TableCell>
                  <TableCell>{property.propertyType || "N/A"}</TableCell>
                  <TableCell>{property.addressText}</TableCell>
                  <TableCell>{property.totalFloors || 1}</TableCell>
                  <TableCell>
                    {property.occupiedBeds || 0} / {property.totalBeds || 0}
                  </TableCell>
                  <TableCell>
                    <Chip label="Active" color="success" size="small" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Container>
  );
}

function MetricCard({ title, value, icon }) {
  return (
    <Card variant="outlined" sx={{ borderRadius: 2 }}>
      <CardContent>
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Box>
            <Typography variant="body2" color="text.secondary" fontWeight="medium">
              {title}
            </Typography>
            <Typography variant="h4" fontWeight="bold" sx={{ mt: 1 }}>
              {value}
            </Typography>
          </Box>
          {icon}
        </Box>
      </CardContent>
    </Card>
  );
}