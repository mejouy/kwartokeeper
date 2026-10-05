// src/pages/owner/tenants/TenantDetail.jsx

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
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import HomeWorkIcon from "@mui/icons-material/HomeWork";
import MeetingRoomIcon from "@mui/icons-material/MeetingRoom";
import PaymentsIcon from "@mui/icons-material/Payments";
import ContactEmergencyIcon from "@mui/icons-material/ContactEmergency";
import EditIcon from "@mui/icons-material/Edit";

import {
  doc,
  getDoc,
  getDocs,
  updateDoc,
  collection,
  query,
  where,
  onSnapshot,
} from "firebase/firestore";
import { auth, db } from "../../../config/firebase";

export default function TenantDetail() {
  const { tenantId } = useParams();
  const navigate = useNavigate();

  const [tenant, setTenant] = useState(null);
  const [property, setProperty] = useState(null);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Edit Modal State
  const [openEdit, setOpenEdit] = useState(false);
  const [saving, setSaving] = useState(false);
  const [ownerProperties, setOwnerProperties] = useState([]); // Loaded properties for dropdown
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    phone: "",
    status: "Active",
    propertyId: "",
    roomId: "",
    bedId: "",
    monthlyRent: "",
    leaseStart: "",
    leaseEnd: "",
    emergencyName: "",
    emergencyRelationship: "",
    emergencyPhone: "",
    notes: "",
  });

  // =========================================================
  // LOAD TENANT & PROPERTY DETAILS
  // =========================================================
  useEffect(() => {
    if (!tenantId) {
      setError("No tenant ID provided in URL.");
      setLoading(false);
      return;
    }

    const fetchTenantData = async () => {
      try {
        const tenantDocRef = doc(db, "tenants", tenantId);
        const tenantSnap = await getDoc(tenantDocRef);

        if (!tenantSnap.exists()) {
          setError("Tenant not found in database.");
          setLoading(false);
          return;
        }

        const tenantData = { id: tenantSnap.id, ...tenantSnap.data() };
        setTenant(tenantData);

        // Fetch properties for this owner to resolve property association properly
        if (auth.currentUser) {
          const propsQuery = query(
            collection(db, "properties"),
            where("ownerUid", "==", auth.currentUser.uid)
          );
          const propsSnap = await getDocs(propsQuery);
          const propsList = propsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
          setOwnerProperties(propsList);

          // Find matching property via propertyId (ID match) or propertyName/propertyId string match
          if (tenantData.propertyId) {
            const matchedProp = propsList.find(
              (p) =>
                p.id === tenantData.propertyId ||
                p.name === tenantData.propertyId ||
                p.propertyName === tenantData.propertyId
            );
            if (matchedProp) {
              setProperty(matchedProp);
            } else {
              // Fallback direct document fetch if ID didn't match list
              try {
                const propDocRef = doc(db, "properties", tenantData.propertyId);
                const propSnap = await getDoc(propDocRef);
                if (propSnap.exists()) {
                  setProperty({ id: propSnap.id, ...propSnap.data() });
                }
              } catch (e) {
                console.warn("Direct property fetch fallback failed:", e);
              }
            }
          }
        }
      } catch (err) {
        console.error("Error fetching tenant details:", err);
        setError("Failed to load tenant details: " + err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchTenantData();
  }, [tenantId]);

  // =========================================================
  // LOAD PAYMENTS RECORD FOR THIS TENANT
  // =========================================================
  useEffect(() => {
    if (!tenantId) return;

    const q = query(
      collection(db, "payments"),
      where("tenantId", "==", tenantId)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const paymentData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setPayments(paymentData);
      },
      (err) => {
        console.error("Error fetching tenant payments:", err);
      }
    );

    return () => unsubscribe();
  }, [tenantId]);

  // Format date helper for input type="date" (YYYY-MM-DD)
  const formatInputDate = (dateVal) => {
    if (!dateVal) return "";
    const date = typeof dateVal.toDate === "function" ? dateVal.toDate() : new Date(dateVal);
    if (isNaN(date.getTime())) return "";
    return date.toISOString().split("T")[0];
  };

  // Open Edit Dialog and populate form fields
  const handleOpenEdit = () => {
    if (!tenant) return;
    setFormData({
      fullName: tenant.fullName || tenant.name || "",
      email: tenant.email || "",
      phone: tenant.phone || tenant.contactNumber || "",
      status: tenant.status || "Active",
      propertyId: tenant.propertyId || property?.id || "",
      roomId: tenant.roomId || "",
      bedId: tenant.bedId || "",
      monthlyRent: tenant.monthlyRent || tenant.rentAmount || "",
      leaseStart: formatInputDate(tenant.leaseStart || tenant.startDate),
      leaseEnd: formatInputDate(tenant.leaseEnd || tenant.endDate),
      emergencyName: tenant.emergencyContact?.name || tenant.emergencyName || "",
      emergencyRelationship: tenant.emergencyContact?.relationship || tenant.emergencyRelationship || "",
      emergencyPhone: tenant.emergencyContact?.phone || tenant.emergencyPhone || "",
      notes: tenant.notes || "",
    });
    setOpenEdit(true);
  };

  // Handle Form Input Change
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // Save Updated Tenant Data to Firestore
  const handleSaveEdit = async () => {
    setSaving(true);
    try {
      const tenantRef = doc(db, "tenants", tenantId);
      const updatedPayload = {
        fullName: formData.fullName,
        name: formData.fullName,
        email: formData.email,
        phone: formData.phone,
        contactNumber: formData.phone,
        status: formData.status,
        propertyId: formData.propertyId,
        roomId: formData.roomId,
        bedId: formData.bedId,
        monthlyRent: Number(formData.monthlyRent) || 0,
        rentAmount: Number(formData.monthlyRent) || 0,
        leaseStart: formData.leaseStart ? new Date(formData.leaseStart) : null,
        leaseEnd: formData.leaseEnd ? new Date(formData.leaseEnd) : null,
        startDate: formData.leaseStart ? new Date(formData.leaseStart) : null,
        endDate: formData.leaseEnd ? new Date(formData.leaseEnd) : null,
        emergencyContact: {
          name: formData.emergencyName,
          relationship: formData.emergencyRelationship,
          phone: formData.emergencyPhone,
        },
        notes: formData.notes,
        updatedAt: new Date(),
      };

      await updateDoc(tenantRef, updatedPayload);

      // Update local state and matching property object immediately
      setTenant((prev) => ({ ...prev, ...updatedPayload }));
      const newlyMatchedProp = ownerProperties.find((p) => p.id === formData.propertyId);
      if (newlyMatchedProp) {
        setProperty(newlyMatchedProp);
      }

      setOpenEdit(false);
    } catch (err) {
      console.error("Error updating tenant:", err);
      alert("Failed to update tenant details: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  // Format amount helper
  const formatAmount = (amount) => {
    const numericAmount = Number(amount || 0);
    return numericAmount.toLocaleString("en-PH", {
      style: "currency",
      currency: "PHP",
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });
  };

  // Format display date helper
  const formatDate = (dateVal) => {
    if (!dateVal) return "—";
    const date = typeof dateVal.toDate === "function" ? dateVal.toDate() : new Date(dateVal);
    if (isNaN(date.getTime())) return "—";
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", py: 12, flexDirection: "column", gap: 2 }}>
        <CircularProgress />
        <Typography variant="body2" color="text.secondary">
          Loading tenant profile...
        </Typography>
      </Box>
    );
  }

  if (error || !tenant) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error" sx={{ mb: 2 }}>{error || "Tenant details unavailable."}</Alert>
        <Button
          variant="outlined"
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate("/owner/tenants")}
        >
          Back to Directory
        </Button>
      </Box>
    );
  }

  const leaseStartDate = tenant.leaseStart || tenant.startDate;
  const leaseEndDate = tenant.leaseEnd || tenant.endDate;

  return (
    <Box sx={{ pb: 4 }}>
      {/* Back Button */}
      <Button
        startIcon={<ArrowBackIcon />}
        onClick={() => navigate("/owner/tenants")}
        sx={{ mb: 2 }}
      >
        Back to Tenants Directory
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
            <Avatar
              src={tenant.idPhotoUrl || ""}
              alt={tenant.fullName || tenant.name}
              sx={{ width: 64, height: 64, fontSize: "1.5rem" }}
            >
              {(tenant.fullName || tenant.name || "T").charAt(0).toUpperCase()}
            </Avatar>
            <Box>
              <Typography variant="h5" fontWeight="700">
                {tenant.fullName || tenant.name || "Unnamed Tenant"}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {tenant.email || "No email provided"} • {tenant.phone || tenant.contactNumber || "No phone number"}
              </Typography>
            </Box>
          </Stack>

          <Stack direction="row" spacing={2} alignItems="center">
            <Chip
              label={tenant.status || "Active"}
              color={tenant.status === "Inactive" ? "default" : tenant.status === "Pending Onboarding" ? "warning" : "success"}
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
        {/* Property Card */}
        <Grid item xs={12} sm={6} md={4}>
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
              {property?.name || property?.propertyName || tenant.propertyName || "Unassigned Property"}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {property?.address ? (typeof property.address === "string" ? property.address : `${property.address.street || ""}, ${property.address.cityMunicipality || ""}`) : "No address listed"}
            </Typography>
          </Paper>
        </Grid>

        {/* Room Card */}
        <Grid item xs={12} sm={6} md={4}>
          <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: "1px solid", borderColor: "divider", height: "100%" }}>
            <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 2 }}>
              <Typography variant="subtitle2" color="text.secondary" fontWeight="600">
                ROOM & SPACE
              </Typography>
              <Avatar sx={{ bgcolor: "primary.light", color: "primary.main", width: 40, height: 40 }}>
                <MeetingRoomIcon />
              </Avatar>
            </Stack>
            <Typography variant="h6" fontWeight="700">
              {tenant.roomId ? `Room ${tenant.roomId}` : "Unassigned Room"}
              {tenant.bedId ? ` (Bed ${tenant.bedId})` : ""}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Accommodation Unit
            </Typography>
          </Paper>
        </Grid>

        {/* Lease & Rent Card */}
        <Grid item xs={12} sm={6} md={4}>
          <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: "1px solid", borderColor: "divider", height: "100%" }}>
            <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 2 }}>
              <Typography variant="subtitle2" color="text.secondary" fontWeight="600">
                LEASE & MONTHLY RENT
              </Typography>
              <Avatar sx={{ bgcolor: "primary.light", color: "primary.main", width: 40, height: 40 }}>
                <PaymentsIcon />
              </Avatar>
            </Stack>
            <Typography variant="h6" fontWeight="700">
              {formatAmount(tenant.monthlyRent || tenant.rentAmount || 0)}
            </Typography>
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
              <strong>Lease Term:</strong> {formatDate(leaseStartDate)} — {formatDate(leaseEndDate)}
            </Typography>
          </Paper>
        </Grid>
      </Grid>

      {/* Emergency Contact & Setup Details Section */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={6}>
          <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: "1px solid", borderColor: "divider", height: "100%" }}>
            <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2 }}>
              <ContactEmergencyIcon color="primary" />
              <Typography variant="h6" fontWeight="700">
                Emergency Contact
              </Typography>
            </Stack>
            <Divider sx={{ mb: 2 }} />
            <Stack spacing={1}>
              <Typography variant="body2">
                <strong>Name:</strong> {tenant.emergencyContact?.name || tenant.emergencyName || "Not provided"}
              </Typography>
              <Typography variant="body2">
                <strong>Relationship:</strong> {tenant.emergencyContact?.relationship || tenant.emergencyRelationship || "—"}
              </Typography>
              <Typography variant="body2">
                <strong>Phone:</strong> {tenant.emergencyContact?.phone || tenant.emergencyPhone || "—"}
              </Typography>
            </Stack>
          </Paper>
        </Grid>

        <Grid item xs={12} md={6}>
          <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: "1px solid", borderColor: "divider", height: "100%" }}>
            <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2 }}>
              <HomeWorkIcon color="primary" />
              <Typography variant="h6" fontWeight="700">
                Owner Setup & Identification
              </Typography>
            </Stack>
            <Divider sx={{ mb: 2 }} />
            <Stack spacing={1}>
              <Typography variant="body2">
                <strong>ID Type:</strong> {tenant.idType ? tenant.idType.replace("_", " ").toUpperCase() : "—"}
              </Typography>
              <Typography variant="body2">
                <strong>Onboarded Date:</strong> {formatDate(tenant.createdAt)}
              </Typography>
              <Typography variant="body2">
                <strong>Notes / Requirements:</strong> {tenant.notes || "No custom notes recorded."}
              </Typography>
            </Stack>
          </Paper>
        </Grid>
      </Grid>

      {/* Payment Records Section */}
      <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: "1px solid", borderColor: "divider" }}>
        <Typography variant="h6" fontWeight="700" sx={{ mb: 2 }}>
          Tenant Payment Records
        </Typography>

        <TableContainer>
          <Table>
            <TableHead sx={{ bgcolor: "background.default" }}>
              <TableRow>
                <TableCell><strong>Date</strong></TableCell>
                <TableCell><strong>Amount</strong></TableCell>
                <TableCell><strong>Method</strong></TableCell>
                <TableCell><strong>Reference / Notes</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {payments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} align="center" sx={{ py: 3 }}>
                    <Typography variant="body2" color="text.secondary">
                      No payment records found for this tenant.
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                payments.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>{formatDate(p.paymentDate || p.createdAt)}</TableCell>
                    <TableCell><strong>{formatAmount(p.amount)}</strong></TableCell>
                    <TableCell>{p.paymentMethod || "Not specified"}</TableCell>
                    <TableCell>{p.referenceNumber || p.notes || "—"}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>

      {/* ========================================================= */}
      {/* EDIT TENANT DIALOG / MODAL                               */}
      {/* ========================================================= */}
      <Dialog open={openEdit} onClose={() => setOpenEdit(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: "700" }}>Edit Tenant Details</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2.5} sx={{ mt: 1 }}>
            <TextField
              label="Full Name"
              name="fullName"
              value={formData.fullName}
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
              name="propertyId"
              value={formData.propertyId}
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

            <Grid container spacing={2}>
              <Grid item xs={12} sm={4}>
                <TextField
                  select
                  label="Account Status"
                  name="status"
                  value={formData.status}
                  onChange={handleChange}
                  fullWidth
                  size="small"
                >
                  <MenuItem value="Active">Active</MenuItem>
                  <MenuItem value="Pending Onboarding">Pending Onboarding</MenuItem>
                  <MenuItem value="Inactive">Inactive</MenuItem>
                </TextField>
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  label="Room ID / No."
                  name="roomId"
                  value={formData.roomId}
                  onChange={handleChange}
                  fullWidth
                  size="small"
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <TextField
                  label="Monthly Rent (₱)"
                  name="monthlyRent"
                  type="number"
                  value={formData.monthlyRent}
                  onChange={handleChange}
                  fullWidth
                  size="small"
                />
              </Grid>
            </Grid>

            {/* Lease Start / End Inputs */}
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Lease Start Date"
                  name="leaseStart"
                  type="date"
                  InputLabelProps={{ shrink: true }}
                  value={formData.leaseStart}
                  onChange={handleChange}
                  fullWidth
                  size="small"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Lease End Date"
                  name="leaseEnd"
                  type="date"
                  InputLabelProps={{ shrink: true }}
                  value={formData.leaseEnd}
                  onChange={handleChange}
                  fullWidth
                  size="small"
                />
              </Grid>
            </Grid>

            <Divider />
            <Typography variant="subtitle2" fontWeight="700">Emergency Contact Info</Typography>

            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Contact Name"
                  name="emergencyName"
                  value={formData.emergencyName}
                  onChange={handleChange}
                  fullWidth
                  size="small"
                />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField
                  label="Relationship"
                  name="emergencyRelationship"
                  value={formData.emergencyRelationship}
                  onChange={handleChange}
                  fullWidth
                  size="small"
                />
              </Grid>
            </Grid>

            <TextField
              label="Emergency Phone Number"
              name="emergencyPhone"
              value={formData.emergencyPhone}
              onChange={handleChange}
              fullWidth
              size="small"
            />

            <Divider />
            <TextField
              label="Owner Notes / Requirements"
              name="notes"
              multiline
              rows={3}
              value={formData.notes}
              onChange={handleChange}
              fullWidth
              size="small"
            />
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