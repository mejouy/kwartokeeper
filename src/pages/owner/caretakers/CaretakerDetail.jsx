// src/pages/owner/caretakers/CaretakerDetail.jsx

import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Box,
  Container,
  Typography,
  Stack,
  Chip,
  Button,
  Avatar,
  Link,
  CircularProgress,
  Alert,
  Snackbar,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  IconButton,
  FormControlLabel,
  Switch,
  useMediaQuery,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import CloseIcon from "@mui/icons-material/Close";
import CheckIcon from "@mui/icons-material/Check";
import HomeWorkOutlinedIcon from "@mui/icons-material/HomeWorkOutlined";
import BadgeOutlinedIcon from "@mui/icons-material/BadgeOutlined";
import SecurityOutlinedIcon from "@mui/icons-material/SecurityOutlined";
import EmailOutlinedIcon from "@mui/icons-material/EmailOutlined";
import PhoneOutlinedIcon from "@mui/icons-material/PhoneOutlined";

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
import { useAuth } from "../../../context/AuthContext";

const PERMISSION_LABELS = {
  manageTenants: "Manage tenants",
  logOccupancy: "Log occupancy",
  handleReports: "Handle reports",
  viewFinancials: "View financials",
  modifyLayout: "Modify layout",
};

const EMPTY_PERMISSIONS = Object.fromEntries(Object.keys(PERMISSION_LABELS).map((k) => [k, false]));

const STATUS_CHIP_STYLES = {
  active: { bg: "rgba(46, 125, 50, 0.12)", color: "success.dark" },
  pending: { bg: "rgba(237, 108, 2, 0.14)", color: "warning.dark" },
};

const HEADING_FONT = '"Inter", sans-serif';

// White card on the cream page, matching the other owner pages
const panelSx = {
  bgcolor: "background.default",
  border: "1px solid",
  borderColor: "divider",
  borderRadius: 3,
  minWidth: 0,
};

function formatDate(value) {
  const d = typeof value?.toDate === "function" ? value.toDate() : value ? new Date(value) : null;
  return d && !Number.isNaN(d.getTime())
    ? d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : null;
}

function formatAddress(address) {
  if (!address) return "No address listed";
  if (typeof address === "string") return address;
  const parts = [address.street, address.barangay, address.cityMunicipality, address.province].filter(Boolean);
  return parts.length ? parts.join(", ") : "No address listed";
}

function FormSectionTitle({ children }) {
  return (
    <Typography sx={{ fontFamily: HEADING_FONT, fontWeight: 700, fontSize: "0.95rem", mb: 2 }} color="text.primary">
      {children}
    </Typography>
  );
}

export default function CaretakerDetail() {
  const { caretakerId } = useParams();
  const navigate = useNavigate();
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down("sm"));
  const { currentUser, loading: authLoading } = useAuth() || {};
  const ownerUid = currentUser?.uid || auth.currentUser?.uid || null;

  const [caretaker, setCaretaker] = useState(null);
  const [property, setProperty] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Edit dialog state
  const [openEdit, setOpenEdit] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [formErrors, setFormErrors] = useState({});
  const [snackbar, setSnackbar] = useState(false);
  const [ownerProperties, setOwnerProperties] = useState([]);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    assignedPropertyId: "",
    permissions: { ...EMPTY_PERMISSIONS },
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
    // On a hard refresh Firebase restores the session asynchronously — wait
    // for it, otherwise the owner's properties silently fail to load.
    if (authLoading) return;

    const fetchCaretakerData = async () => {
      try {
        const userSnap = await getDoc(doc(db, "users", caretakerId));

        if (!userSnap.exists()) {
          setError("Caretaker not found in database.");
          setLoading(false);
          return;
        }

        const caretakerData = { id: userSnap.id, ...userSnap.data() };
        setCaretaker(caretakerData);

        if (ownerUid) {
          const propsSnap = await getDocs(
            query(collection(db, "properties"), where("ownerUid", "==", ownerUid))
          );
          const propsList = propsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
          setOwnerProperties(propsList);

          if (caretakerData.assignedPropertyId) {
            const matchedProp = propsList.find((p) => p.id === caretakerData.assignedPropertyId);
            if (matchedProp) {
              setProperty(matchedProp);
            } else {
              // A failed property lookup shouldn't blank the whole profile
              try {
                const propSnap = await getDoc(doc(db, "properties", caretakerData.assignedPropertyId));
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
        console.error("Error fetching caretaker details:", err);
        setError("Failed to load caretaker details: " + err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchCaretakerData();
  }, [caretakerId, authLoading, ownerUid]);

  // =========================================================
  // EDIT HANDLERS
  // =========================================================
  const handleOpenEdit = () => {
    if (!caretaker) return;
    setFormData({
      name: caretaker.name || "",
      email: caretaker.email || "",
      phone: caretaker.phone || "",
      assignedPropertyId: caretaker.assignedPropertyId || property?.id || "",
      // Keep any permission keys beyond the standard five so saving doesn't drop them
      permissions: Object.fromEntries(
        Object.entries({ ...EMPTY_PERMISSIONS, ...(caretaker.permissions || {}) }).map(([k, v]) => [k, Boolean(v)])
      ),
    });
    setFormErrors({});
    setSaveError("");
    setOpenEdit(true);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormErrors((prev) => {
      if (!prev[name]) return prev;
      const next = { ...prev };
      delete next[name];
      return next;
    });
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handlePermissionChange = (e) => {
    const { name, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      permissions: { ...prev.permissions, [name]: checked },
    }));
  };

  const validateForm = () => {
    const e = {};
    if (!formData.name.trim()) e.name = "Full name is required.";
    if (formData.email.trim() && !/^\S+@\S+\.\S+$/.test(formData.email.trim())) {
      e.email = "Enter a valid email address.";
    }
    return e;
  };

  const handleSaveEdit = async () => {
    const errs = validateForm();
    setFormErrors(errs);
    if (Object.keys(errs).length > 0) {
      setSaveError("Please fix the highlighted fields.");
      return;
    }

    setSaving(true);
    setSaveError("");
    try {
      const updatedPayload = {
        name: formData.name.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim(),
        assignedPropertyId: formData.assignedPropertyId,
        permissions: formData.permissions,
        updatedAt: new Date(),
      };

      // 1. Update the 'users' collection document
      await updateDoc(doc(db, "users", caretakerId), updatedPayload);

      // 2. Also update the 'caretakers' collection document (by ID or userId query)
      try {
        const caretakerDocRef = doc(db, "caretakers", caretakerId);
        const caretakerSnap = await getDoc(caretakerDocRef);
        
        if (caretakerSnap.exists()) {
          await updateDoc(caretakerDocRef, updatedPayload);
        } else {
          // Fallback: If the caretaker doc ID differs from the auth/user ID, query by userId/caretakerId
          const q = query(
            collection(db, "caretakers"),
            where("userId", "==", caretakerId)
          );
          const qSnap = await getDocs(q);
          if (!qSnap.empty) {
            await updateDoc(doc(db, "caretakers", qSnap.docs[0].id), updatedPayload);
          } else {
            const q2 = query(
              collection(db, "caretakers"),
              where("email", "==", formData.email.trim().toLowerCase())
            );
            const qSnap2 = await getDocs(q2);
            if (!qSnap2.empty) {
              await updateDoc(doc(db, "caretakers", qSnap2.docs[0].id), updatedPayload);
            }
          }
        }
      } catch (caretakerCollectionErr) {
        console.warn("Note: Secondary caretakers collection update skipped or failed:", caretakerCollectionErr);
      }

      // Update local state instantly
      setCaretaker((prev) => ({ ...prev, ...updatedPayload }));
      setProperty(ownerProperties.find((p) => p.id === formData.assignedPropertyId) || null);

      setOpenEdit(false);
      setSnackbar(true);
    } catch (err) {
      console.error("Error updating caretaker:", err);
      setSaveError("Failed to update caretaker details: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  // =========================================================
  // LOADING / ERROR STATES
  // =========================================================
  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", py: 12, flexDirection: "column", gap: 2 }}>
        <CircularProgress />
        <Typography variant="body2" color="text.secondary">
          Loading caretaker profile…
        </Typography>
      </Box>
    );
  }

  if (error || !caretaker) {
    return (
      <Container maxWidth="md" sx={{ py: 4 }}>
        <Alert severity="error" sx={{ mb: 2 }}>{error || "Caretaker details unavailable."}</Alert>
        <Button variant="outlined" startIcon={<ArrowBackIcon />} onClick={() => navigate("/owner/caretakers")}>
          Back to caretakers
        </Button>
      </Container>
    );
  }

  // =========================================================
  // DERIVED DISPLAY VALUES
  // =========================================================
  const displayName = caretaker.name || "Unnamed caretaker";
  const isPending = Boolean(caretaker.mustChangePassword);
  const statusStyle = isPending ? STATUS_CHIP_STYLES.pending : STATUS_CHIP_STYLES.active;
  const addedOn = formatDate(caretaker.createdAt);

  // Standard five first, then any extra keys that were granted at some point
  const permissionKeys = [
    ...Object.keys(PERMISSION_LABELS),
    ...Object.keys(caretaker.permissions || {}).filter((k) => !(k in PERMISSION_LABELS)),
  ];
  const grantedCount = permissionKeys.filter((k) => caretaker.permissions?.[k]).length;

  const propertyMissing = Boolean(caretaker.assignedPropertyId) && !property;

  return (
    <Container maxWidth="lg" disableGutters sx={{ py: 0 }}>
      <Button
        startIcon={<ArrowBackIcon />}
        onClick={() => navigate("/owner/caretakers")}
        sx={{ mb: 1.5, ml: -1, color: "text.secondary", fontWeight: 600 }}
      >
        Caretakers
      </Button>

      {/* ───── Header ───── */}
      <Box
        sx={{
          display: "flex",
          flexDirection: { xs: "column", sm: "row" },
          alignItems: { xs: "stretch", sm: "center" },
          justifyContent: "space-between",
          gap: { xs: 2, sm: 3 },
          mb: 3,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: { xs: 2, sm: 2.5 }, minWidth: 0 }}>
          <Avatar
            alt={displayName}
            sx={{
              width: { xs: 60, sm: 76 },
              height: { xs: 60, sm: 76 },
              bgcolor: "rgba(255, 69, 0, 0.12)",
              color: "primary.main",
              fontFamily: HEADING_FONT,
              fontWeight: 800,
              fontSize: { xs: "1.5rem", sm: "1.9rem" },
              flexShrink: 0,
            }}
          >
            {displayName.charAt(0).toUpperCase()}
          </Avatar>

          <Box sx={{ minWidth: 0 }}>
            <Box sx={{ display: "flex", alignItems: "center", flexWrap: "wrap", columnGap: 1.5, rowGap: 0.5 }}>
              <Typography
                component="h1"
                sx={{ fontFamily: HEADING_FONT, fontWeight: 900, fontSize: { xs: "1.5rem", sm: "2rem" }, wordBreak: "break-word", lineHeight: 1.2 }}
                color="text.primary"
              >
                {displayName}
              </Typography>
              <Chip
                label={isPending ? "Pending first login" : "Active"}
                size="small"
                sx={{ bgcolor: statusStyle.bg, color: statusStyle.color, fontWeight: 600, border: "none" }}
              />
            </Box>
            <Box sx={{ display: "flex", flexWrap: "wrap", columnGap: 2.5, rowGap: 0.5, mt: 0.75 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, minWidth: 0 }}>
                <EmailOutlinedIcon sx={{ fontSize: 17, color: "text.secondary" }} />
                {caretaker.email ? (
                  <Link href={`mailto:${caretaker.email}`} underline="hover" color="text.secondary" variant="body2" sx={{ wordBreak: "break-all" }}>
                    {caretaker.email}
                  </Link>
                ) : (
                  <Typography variant="body2" color="text.secondary">No email provided</Typography>
                )}
              </Box>
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                <PhoneOutlinedIcon sx={{ fontSize: 17, color: "text.secondary" }} />
                {caretaker.phone ? (
                  <Link href={`tel:${caretaker.phone}`} underline="hover" color="text.secondary" variant="body2">
                    {caretaker.phone}
                  </Link>
                ) : (
                  <Typography variant="body2" color="text.secondary">No phone number</Typography>
                )}
              </Box>
            </Box>
          </Box>
        </Box>

        <Button
          variant="contained"
          disableElevation
          startIcon={<EditOutlinedIcon />}
          onClick={handleOpenEdit}
          sx={{ py: 1.1, px: 3, fontWeight: 600, flexShrink: 0, alignSelf: { xs: "stretch", sm: "center" } }}
        >
          Edit details
        </Button>
      </Box>

      {/* ───── Property + Access: side by side on desktop ───── */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "minmax(0, 1fr) minmax(0, 1.2fr)" },
          gap: 2.5,
          alignItems: "start",
        }}
      >
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5, minWidth: 0 }}>
        {/* Assigned property */}
        <Box sx={{ ...panelSx, p: { xs: 2.5, md: 3 } }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
            <Box
              sx={{
                width: 44,
                height: 44,
                borderRadius: "50%",
                bgcolor: "rgba(255, 69, 0, 0.1)",
                color: "primary.main",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <HomeWorkOutlinedIcon />
            </Box>

            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                Assigned property
              </Typography>
              <Typography sx={{ fontFamily: HEADING_FONT, fontWeight: 700, wordBreak: "break-word" }} color="text.primary">
                {property
                  ? property.name || property.propertyName || "Unnamed property"
                  : propertyMissing
                  ? "Property unavailable"
                  : "No property assigned"}
              </Typography>
            </Box>
          </Box>

          <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5, wordBreak: "break-word" }}>
            {property
              ? formatAddress(property.address || property)
              : propertyMissing
              ? "The assigned property couldn't be found."
              : "This caretaker isn't assigned to a property yet."}
          </Typography>

          {!property && !propertyMissing && (
            <Button variant="outlined" fullWidth onClick={handleOpenEdit} sx={{ mt: 2, py: 1, fontWeight: 600 }}>
              Assign property
            </Button>
          )}
        </Box>

        {/* Account */}
        <Box sx={{ ...panelSx, p: { xs: 2.5, md: 3 } }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, mb: 1 }}>
            <BadgeOutlinedIcon sx={{ color: "primary.main" }} />
            <Typography sx={{ fontFamily: HEADING_FONT, fontWeight: 700 }}>Account</Typography>
          </Box>
          {[
            ["Status", isPending ? "Hasn't signed in yet" : "Signed in"],
            ["Added", addedOn || "—"],
            ["Last updated", formatDate(caretaker.updatedAt) || "—"],
          ].map(([label, value]) => (
            <Box
              key={label}
              sx={{ display: "flex", justifyContent: "space-between", gap: 2, py: 1.25, borderBottom: "1px solid", borderColor: "divider", "&:last-of-type": { borderBottom: "none", pb: 0 } }}
            >
              <Typography variant="body2" color="text.secondary">{label}</Typography>
              <Typography variant="body2" sx={{ fontWeight: 500, textAlign: "right" }}>{value}</Typography>
            </Box>
          ))}
        </Box>
        </Box>

        {/* Access */}
        <Box sx={{ bgcolor: "#202020", color: "#ffffff", borderRadius: 3, p: { xs: 2.5, sm: 3.5 }, minWidth: 0 }}>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
              <SecurityOutlinedIcon sx={{ color: "primary.main" }} />
              <Typography sx={{ fontFamily: HEADING_FONT, fontWeight: 700 }}>Access</Typography>
            </Box>
            <Chip
              label={`${grantedCount} of ${permissionKeys.length}`}
              size="small"
              sx={{ bgcolor: "rgba(202, 220, 246, 0.16)", color: "#cadcf6", fontWeight: 600, border: "none" }}
            />
          </Box>

          <Typography sx={{ fontFamily: HEADING_FONT, fontWeight: 900, fontSize: { xs: "1.4rem", sm: "1.75rem" }, lineHeight: 1.2 }}>
            {grantedCount === 0 ? "No permissions granted" : `${grantedCount} of ${permissionKeys.length} permissions granted`}
          </Typography>
          <Typography variant="body2" sx={{ color: "#cadcf6", mt: 0.5 }}>
            You can change these any time with Edit details.
          </Typography>

          <Box sx={{ mt: 2.5 }}>
            {permissionKeys.map((key) => {
              const on = Boolean(caretaker.permissions?.[key]);
              return (
                <Box
                  key={key}
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 1.5,
                    py: 1.35,
                    borderTop: "1px solid rgba(255, 255, 255, 0.08)",
                  }}
                >
                  {/* Lit square = granted, dim square = not — same language as the facade illustrations */}
                  <Box
                    sx={{
                      width: 22,
                      height: 22,
                      borderRadius: "6px",
                      flexShrink: 0,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      bgcolor: on ? "primary.main" : "rgba(202, 220, 246, 0.16)",
                    }}
                  >
                    {on && <CheckIcon sx={{ fontSize: 15, color: "#ffffff" }} />}
                  </Box>
                  <Typography sx={{ fontWeight: on ? 600 : 400, color: on ? "#ffffff" : "rgba(202, 220, 246, 0.55)" }}>
                    {PERMISSION_LABELS[key] || key}
                  </Typography>
                  <Typography variant="caption" sx={{ ml: "auto", color: on ? "#cadcf6" : "rgba(202, 220, 246, 0.4)" }}>
                    {on ? "Allowed" : "Not allowed"}
                  </Typography>
                </Box>
              );
            })}
          </Box>
        </Box>
      </Box>

      {/* ───── Edit dialog (full-screen on phones) ───── */}
      <Dialog
        open={openEdit}
        onClose={() => !saving && setOpenEdit(false)}
        maxWidth="sm"
        fullWidth
        fullScreen={fullScreen}
        slotProps={{ paper: { sx: { borderRadius: fullScreen ? 0 : 3 } } }}
      >
        <DialogTitle sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontFamily: HEADING_FONT, fontWeight: 700 }}>
          Edit caretaker details
          <IconButton onClick={() => setOpenEdit(false)} size="small" aria-label="Close" disabled={saving}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        <DialogContent dividers sx={{ p: { xs: 2, sm: 3 } }}>
          {saveError && <Alert severity="error" sx={{ mb: 3 }}>{saveError}</Alert>}

          <Stack spacing={4}>
            <Box>
              <FormSectionTitle>Contact</FormSectionTitle>
              <Stack spacing={2}>
                <TextField
                  required
                  label="Full name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  fullWidth
                  error={Boolean(formErrors.name)}
                  helperText={formErrors.name || ""}
                />
                <TextField
                  label="Email address"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleChange}
                  fullWidth
                  error={Boolean(formErrors.email)}
                  helperText={
                    formErrors.email ||
                    "Updates this profile only — the caretaker still signs in with their original email."
                  }
                />
                <TextField
                  label="Phone number"
                  name="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={handleChange}
                  fullWidth
                />
              </Stack>
            </Box>

            <Box>
              <FormSectionTitle>Assignment</FormSectionTitle>
              <TextField
                select
                label="Assigned property"
                name="assignedPropertyId"
                value={formData.assignedPropertyId}
                onChange={handleChange}
                fullWidth
                slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}
              >
                <MenuItem value="">Unassigned</MenuItem>
                {ownerProperties.map((prop) => (
                  <MenuItem key={prop.id} value={prop.id}>
                    {prop.name || prop.propertyName}
                  </MenuItem>
                ))}
              </TextField>
            </Box>

            <Box>
              <FormSectionTitle>Permissions</FormSectionTitle>
              <Box>
                {Object.keys(PERMISSION_LABELS).map((permKey) => (
                  <FormControlLabel
                    key={permKey}
                    labelPlacement="start"
                    sx={{
                      display: "flex",
                      justifyContent: "space-between",
                      width: "100%",
                      mx: 0,
                      py: 0.5,
                      borderBottom: "1px solid",
                      borderColor: "divider",
                      "&:last-of-type": { borderBottom: "none" },
                    }}
                    control={
                      <Switch
                        checked={Boolean(formData.permissions[permKey])}
                        onChange={handlePermissionChange}
                        name={permKey}
                      />
                    }
                    label={<Typography variant="body1">{PERMISSION_LABELS[permKey]}</Typography>}
                  />
                ))}
              </Box>
            </Box>
          </Stack>
        </DialogContent>

        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button onClick={() => setOpenEdit(false)} color="inherit" disabled={saving} sx={{ fontWeight: 600, flex: { xs: 1, sm: "none" } }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSaveEdit}
            disabled={saving}
            sx={{ px: 4, py: 1.25, fontWeight: 600, flex: { xs: 1, sm: "none" } }}
          >
            {saving ? <CircularProgress size={22} color="inherit" /> : "Save changes"}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar}
        autoHideDuration={3500}
        onClose={() => setSnackbar(false)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity="success" variant="filled" onClose={() => setSnackbar(false)} sx={{ width: "100%" }}>
          Caretaker details updated.
        </Alert>
      </Snackbar>
    </Container>
  );
}