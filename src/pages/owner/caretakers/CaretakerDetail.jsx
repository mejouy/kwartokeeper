// src/pages/owner/caretakers/CaretakerDetail.jsx

import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Box,
  Paper,
  Typography,
  Grid,
  Stack,
  Chip,
  Button,
  Avatar,
  Divider,
  CircularProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  FormControlLabel,
  Checkbox,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import HomeWorkIcon from "@mui/icons-material/HomeWork";
import SecurityIcon from "@mui/icons-material/Security";
import EditIcon from "@mui/icons-material/Edit";

import {
  doc,
  getDoc,
  getDocs,
  updateDoc,
  collection,
  query,
  where,
} from "firebase/firestore";
import { auth, db } from "../../../config/firebase";

const PERMISSION_LABELS = {
  manageTenants: "Manage Tenants",
  logOccupancy: "Log Occupancy",
  handleReports: "Handle Reports",
  viewFinancials: "View Financials",
  modifyLayout: "Modify Layout",
};

export default function CaretakerDetail() {
  const { caretakerId } = useParams();
  const navigate = useNavigate();

  const [caretaker, setCaretaker] = useState(null);
  const [property, setProperty] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Edit Modal State
  const [openEdit, setOpenEdit] = useState(false);
  const [saving, setSaving] = useState(false);
  const [ownerProperties, setOwnerProperties] = useState([]);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    assignedPropertyId: "",
    permissions: {
      manageTenants: false,
      logOccupancy: false,
      handleReports: false,
      viewFinancials: false,
      modifyLayout: false,
    },
  });

  // =========================================================
  // LOAD CARETAKER & PROPERTY DETAILS
  // =========================================================
  useEffect(() => {
    if (!caretakerId) {
      setError("No caretaker ID provided in URL.");
      setLoading(false);
      return;
    }

    const fetchCaretakerData = async () => {
      try {
        const userDocRef = doc(db, "users", caretakerId);
        const userSnap = await getDoc(userDocRef);

        if (!userSnap.exists()) {
          setError("Caretaker not found in database.");
          setLoading(false);
          return;
        }

        const caretakerData = { id: userSnap.id, ...userSnap.data() };
        setCaretaker(caretakerData);

        // Fetch properties for this owner
        if (auth.currentUser) {
          const propsQuery = query(
            collection(db, "properties"),
            where("ownerUid", "==", auth.currentUser.uid)
          );
          const propsSnap = await getDocs(propsQuery);
          const propsList = propsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
          setOwnerProperties(propsList);

          // Resolve assigned property
          if (caretakerData.assignedPropertyId) {
            const matchedProp = propsList.find(
              (p) => p.id === caretakerData.assignedPropertyId
            );
            if (matchedProp) {
              setProperty(matchedProp);
            } else {
              const propDocRef = doc(db, "properties", caretakerData.assignedPropertyId);
              const propSnap = await getDoc(propDocRef);
              if (propSnap.exists()) {
                setProperty({ id: propSnap.id, ...propSnap.data() });
              }
            }
          }
        }
      } catch (err) {
        console.error("Error fetching caretaker details:", err);
        setError("Failed to load caretaker details: " + err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchCaretakerData();
  }, [caretakerId]);

  // Open Edit Modal and populate fields
  const handleOpenEdit = () => {
    if (!caretaker) return;
    setFormData({
      name: caretaker.name || "",
      email: caretaker.email || "",
      phone: caretaker.phone || "",
      assignedPropertyId: caretaker.assignedPropertyId || property?.id || "",
      permissions: {
        manageTenants: caretaker.permissions?.manageTenants || false,
        logOccupancy: caretaker.permissions?.logOccupancy || false,
        handleReports: caretaker.permissions?.handleReports || false,
        viewFinancials: caretaker.permissions?.viewFinancials || false,
        modifyLayout: caretaker.permissions?.modifyLayout || false,
      },
    });
    setOpenEdit(true);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handlePermissionChange = (e) => {
    const { name, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      permissions: { ...prev.permissions, [name]: checked },
    }));
  };

  // Save changes to Firestore
  const handleSaveEdit = async () => {
    setSaving(true);
    try {
      const userRef = doc(db, "users", caretakerId);
      const updatedPayload = {
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        assignedPropertyId: formData.assignedPropertyId,
        permissions: formData.permissions,
        updatedAt: new Date(),
      };

      await updateDoc(userRef, updatedPayload);

      // Update local state instantly
      setCaretaker((prev) => ({ ...prev, ...updatedPayload }));
      const newlyMatchedProp = ownerProperties.find(
        (p) => p.id === formData.assignedPropertyId
      );
      setProperty(newlyMatchedProp || null);

      setOpenEdit(false);
    } catch (err) {
      console.error("Error updating caretaker:", err);
      alert("Failed to update caretaker details: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", py: 12, flexDirection: "column", gap: 2 }}>
        <CircularProgress />
        <Typography variant="body2" color="text.secondary">
          Loading caretaker profile...
        </Typography>
      </Box>
    );
  }

  if (error || !caretaker) {
    return (
      <Box sx={{ p: 3, maxWidth: 800, mx: "auto" }}>
        <Alert severity="error" sx={{ mb: 2 }}>{error || "Caretaker details unavailable."}</Alert>
        <Button
          variant="outlined"
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate("/owner/caretakers")}
        >
          Back to Caretakers
        </Button>
      </Box>
    );
  }

  const grantedPermissions = Object.entries(caretaker.permissions || {})
    .filter(([, granted]) => granted)
    .map(([key]) => PERMISSION_LABELS[key] || key);

  return (
    <Box sx={{ maxWidth: 800, mx: "auto", pb: 4, p: { xs: 2, sm: 3 } }}>
      {/* Back Button */}
      <Button
        startIcon={<ArrowBackIcon />}
        onClick={() => navigate("/owner/caretakers")}
        sx={{ mb: 2 }}
      >
        Back to Caretakers
      </Button>

      {/* Header Banner */}
      <Paper
        elevation={0}
        sx={{
          p: 3,
          border: "1px solid",
          borderColor: "divider",
          borderRadius: 3,
          mb: 3,
        }}
      >
        <Stack
          direction={{ xs: "column", sm: "row" }}
          justifyContent="space-between"
          alignItems={{ xs: "flex-start", sm: "center" }}
          gap={2}
        >
          <Stack direction="row" spacing={2} alignItems="center">
            <Avatar sx={{ width: 64, height: 64, fontSize: "1.5rem", bgcolor: "primary.main" }}>
              {(caretaker.name || "C").charAt(0).toUpperCase()}
            </Avatar>
            <Box>
              <Typography variant="h5" fontWeight="700">
                {caretaker.name || "Unnamed Caretaker"}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {caretaker.email || "No email provided"} • {caretaker.phone || "No phone number"}
              </Typography>
            </Box>
          </Stack>

          <Stack direction="row" spacing={2} alignItems="center">
            <Chip
              label={caretaker.mustChangePassword ? "Pending first login" : "Active"}
              color={caretaker.mustChangePassword ? "warning" : "success"}
              variant="outlined"
              sx={{ fontWeight: "700", px: 1 }}
            />
            <Button
              variant="outlined"
              size="small"
              startIcon={<EditIcon />}
              onClick={handleOpenEdit}
            >
              Edit Details
            </Button>
          </Stack>
        </Stack>
      </Paper>

      {/* Grid Overview Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {/* Assigned Property Card */}
        <Grid item xs={12} sm={6}>
          <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: "1px solid", borderColor: "divider", height: "100%" }}>
            <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 2 }}>
              <Typography variant="subtitle2" color="text.secondary" fontWeight="600">
                ASSIGNED PROPERTY
              </Typography>
              <Avatar sx={{ bgcolor: "primary.light", color: "primary.main", width: 40, height: 40 }}>
                <HomeWorkIcon />
              </Avatar>
            </Stack>
            <Typography variant="h6" fontWeight="700">
              {property?.name || property?.propertyName || "Unassigned Property"}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {property?.address ? (typeof property.address === "string" ? property.address : `${property.address.street || ""}, ${property.address.cityMunicipality || ""}`) : "No address listed"}
            </Typography>
          </Paper>
        </Grid>

        {/* Permissions Overview Card */}
        <Grid item xs={12} sm={6}>
          <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: "1px solid", borderColor: "divider", height: "100%" }}>
            <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 2 }}>
              <Typography variant="subtitle2" color="text.secondary" fontWeight="600">
                GRANTED PERMISSIONS
              </Typography>
              <Avatar sx={{ bgcolor: "primary.light", color: "primary.main", width: 40, height: 40 }}>
                <SecurityIcon />
              </Avatar>
            </Stack>
            {grantedPermissions.length > 0 ? (
              <Stack direction="row" flexWrap="wrap" gap={0.75} sx={{ mt: 1 }}>
                {grantedPermissions.map((label) => (
                  <Chip key={label} size="small" label={label} />
                ))}
              </Stack>
            ) : (
              <Typography variant="body2" color="text.secondary">
                No permissions granted.
              </Typography>
            )}
          </Paper>
        </Grid>
      </Grid>

      {/* ========================================================= */}
      {/* EDIT CARETAKER DIALOG / MODAL                            */}
      {/* ========================================================= */}
      <Dialog open={openEdit} onClose={() => setOpenEdit(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: "700" }}>Edit Caretaker Details</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2.5} sx={{ mt: 1 }}>
            <TextField
              label="Full Name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              fullWidth
              size="small"
            />

            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Email Address"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  fullWidth
                  size="small"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Phone Number"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  fullWidth
                  size="small"
                />
              </Grid>
            </Grid>

            {/* Property Assignment Dropdown */}
            <TextField
              select
              label="Assigned Property"
              name="assignedPropertyId"
              value={formData.assignedPropertyId}
              onChange={handleChange}
              fullWidth
              size="small"
            >
              <MenuItem value="">-- Unassigned Property --</MenuItem>
              {ownerProperties.map((prop) => (
                <MenuItem key={prop.id} value={prop.id}>
                  {prop.name || prop.propertyName}
                </MenuItem>
              ))}
            </TextField>

            <Divider />
            <Typography variant="subtitle2" fontWeight="700">Permissions Access</Typography>

            <Grid container spacing={1}>
              {Object.keys(PERMISSION_LABELS).map((permKey) => (
                <Grid item xs={12} sm={6} key={permKey}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={formData.permissions[permKey] || false}
                        onChange={handlePermissionChange}
                        name={permKey}
                        size="small"
                      />
                    }
                    label={<Typography variant="body2">{PERMISSION_LABELS[permKey]}</Typography>}
                  />
                </Grid>
              ))}
            </Grid>
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2.5 }}>
          <Button onClick={() => setOpenEdit(false)} color="inherit">
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSaveEdit}
            disabled={saving}
          >
            {saving ? "Saving..." : "Save Changes"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}