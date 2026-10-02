// src/pages/owner/InviteCaretaker.jsx
//
// Owner-facing form to invite a caretaker. On submit, creates the caretaker's
// Firebase Auth account + Firestore profile (see caretakerService.js), then
// navigates to CaretakerInvited.jsx to show the temporary credentials.
//
// ROUTES: this screen lives at /owner/caretakers/invite (matching the
// "Invite a caretaker" button in WizardSuccess.jsx) and hands off to
// /owner/caretakers/invited.
//
// INTEGRATION NOTE: "Assigned Property" dropdown currently queries the
// `properties` collection filtered by ownerUid. Adjust the query if the
// team's properties data shape changes.

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Typography,
  TextField,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  ToggleButtonGroup,
  ToggleButton,
  FormControlLabel,
  Checkbox,
  RadioGroup,
  Radio,
  Button,
  Stack,
  Paper,
  Alert,
  CircularProgress,
} from "@mui/material";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../../../config/firebase";
import { useAuth } from "../../../context/AuthContext";
import { createCaretakerAccount } from "../../../services/caretakerService";
import { generateTempPassword } from "../../../utils/generateTempPassword";

const PERMISSION_OPTIONS = [
  {
    key: "manageTenants",
    label: "Manage Tenant Registrations & Room Assignments",
  },
  { key: "logOccupancy", label: "Log Daily Occupancy & Curfew Checks" },
  {
    key: "handleReports",
    label: "Receive & Update Incident / Maintenance Reports",
  },
  { key: "viewFinancials", label: "View Financials & Rent Payment History" },
  { key: "modifyLayout", label: "Modify Property Layout or Room Rates" },
];

const FULL_PERMISSIONS = PERMISSION_OPTIONS.reduce(
  (acc, p) => ({ ...acc, [p.key]: true }),
  {},
);
const NO_PERMISSIONS = PERMISSION_OPTIONS.reduce(
  (acc, p) => ({ ...acc, [p.key]: false }),
  {},
);

export default function InviteCaretaker() {
  const navigate = useNavigate();
  const { currentUser } = useAuth() || {};

  const [properties, setProperties] = useState([]);
  const [loadingProperties, setLoadingProperties] = useState(true);

  const [form, setForm] = useState({
    assignedPropertyId: "",
    fullName: "",
    email: "",
    mobilePhone: "",
  });

  const [permissionMode, setPermissionMode] = useState("full"); // "full" | "custom"
  const [customPermissions, setCustomPermissions] = useState(NO_PERMISSIONS);

  const [dispatchMethod, setDispatchMethod] = useState("email"); // "sms" | "email"

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchProperties() {
      if (!currentUser?.uid) return;
      try {
        const q = query(
          collection(db, "properties"),
          where("ownerUid", "==", currentUser.uid),
        );
        const snap = await getDocs(q);
        setProperties(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch (err) {
        setError("Failed to load properties. Please refresh and try again.");
      } finally {
        setLoadingProperties(false);
      }
    }
    fetchProperties();
  }, [currentUser?.uid]);

  const updateField = (field, value) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const toggleCustomPermission = (key) =>
    setCustomPermissions((prev) => ({ ...prev, [key]: !prev[key] }));

  const handleSubmit = async () => {
    setError(null);

    if (!form.assignedPropertyId) return setError("Please select a property.");
    if (!form.fullName.trim()) return setError("Full name is required.");
    if (!form.email.trim()) return setError("Email is required.");
    if (!form.mobilePhone.trim()) return setError("Mobile phone is required.");

    setSubmitting(true);
    try {
      const tempPassword = generateTempPassword();
      const permissions =
        permissionMode === "full" ? FULL_PERMISSIONS : customPermissions;

      await createCaretakerAccount({
        fullName: form.fullName,
        email: form.email,
        mobilePhone: form.mobilePhone,
        tempPassword,
        assignedPropertyId: form.assignedPropertyId,
        ownerUid: currentUser?.uid,
        permissions,
      });

      navigate("/owner/caretakers/invited", {
        state: {
          email: form.email.trim(),
          tempPassword,
          dispatchMethod,
        },
      });
    } catch (err) {
      setError(
        err.message ||
          "Something went wrong while creating the caretaker account.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box sx={{ maxWidth: 600, mx: "auto", p: 2 }}>
      <Typography variant="h1" sx={{ mb: 3 }}>
        Invite Caretaker
      </Typography>

      <Stack spacing={3}>
        <FormControl fullWidth disabled={loadingProperties}>
          <InputLabel id="assigned-property-label">
            Assigned Property
          </InputLabel>
          <Select
            labelId="assigned-property-label"
            value={form.assignedPropertyId}
            label="Assigned Property"
            onChange={(e) => updateField("assignedPropertyId", e.target.value)}
          >
            {properties.map((p) => (
              <MenuItem key={p.id} value={p.id}>
                {p.propertyName}
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        <Box>
          <Typography variant="h2" sx={{ mb: 2 }}>
            Caretaker Personal Information
          </Typography>
          <Stack spacing={2}>
            <TextField
              label="Full Name"
              fullWidth
              value={form.fullName}
              onChange={(e) => updateField("fullName", e.target.value)}
            />
            <TextField
              label="Email"
              type="email"
              fullWidth
              value={form.email}
              onChange={(e) => updateField("email", e.target.value)}
            />
            <TextField
              label="Mobile Phone"
              fullWidth
              value={form.mobilePhone}
              onChange={(e) => updateField("mobilePhone", e.target.value)}
            />
          </Stack>
        </Box>

        <Box>
          <Typography variant="h2" sx={{ mb: 2 }}>
            Permission Controls
          </Typography>
          <ToggleButtonGroup
            value={permissionMode}
            exclusive
            onChange={(_, val) => val && setPermissionMode(val)}
            fullWidth
            sx={{ mb: 2 }}
          >
            <ToggleButton value="full">Full Caretaker</ToggleButton>
            <ToggleButton value="custom">Custom Permissions</ToggleButton>
          </ToggleButtonGroup>

          {permissionMode === "custom" && (
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Stack spacing={0.5}>
                {PERMISSION_OPTIONS.map((p) => (
                  <FormControlLabel
                    key={p.key}
                    control={
                      <Checkbox
                        checked={customPermissions[p.key]}
                        onChange={() => toggleCustomPermission(p.key)}
                      />
                    }
                    label={p.label}
                  />
                ))}
              </Stack>
            </Paper>
          )}
        </Box>

        <Box>
          <Typography variant="h2" sx={{ mb: 2 }}>
            Credentials &amp; Access Dispatch
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            Send Invitation Via:
          </Typography>
          <RadioGroup
            value={dispatchMethod}
            onChange={(e) => setDispatchMethod(e.target.value)}
          >
            <FormControlLabel
              value="sms"
              control={<Radio />}
              label="Send SMS Invite with Temporary Password"
            />
            <FormControlLabel
              value="email"
              control={<Radio />}
              label="Send Email Invitation Link"
            />
          </RadioGroup>
        </Box>

        {error && <Alert severity="error">{error}</Alert>}

        <Button
          variant="contained"
          fullWidth
          size="large"
          onClick={handleSubmit}
          disabled={submitting}
          startIcon={submitting ? <CircularProgress size={18} /> : null}
        >
          {submitting ? "Sending..." : "Send Caretaker Invite"}
        </Button>
      </Stack>
    </Box>
  );
}
