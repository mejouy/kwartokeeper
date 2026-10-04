import React, { useState, useEffect } from "react";
import {
  Box,
  Container,
  Grid,
  Paper,
  Typography,
  Button,
  TextField,
  Switch,
  FormControlLabel,
  Stack,
  Divider,
  Alert,
  Snackbar,
  CircularProgress,
  InputAdornment,
  Card,
  CardContent
} from "@mui/material";
import SaveIcon from "@mui/icons-material/Save";
import BuildIcon from "@mui/icons-material/Build";
import AttachMoneyIcon from "@mui/icons-material/AttachMoney";
import ContactSupportIcon from "@mui/icons-material/ContactSupport";
import SecurityIcon from "@mui/icons-material/Security";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../../config/firebase";

export default function AdminSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Settings State
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [maintenanceMessage, setMaintenanceMessage] = useState("");
  const [platformFeePercent, setPlatformFeePercent] = useState(5.0);
  const [fixedServiceFee, setFixedServiceFee] = useState(50);
  const [supportEmail, setSupportEmail] = useState("");
  const [supportPhone, setSupportPhone] = useState("");
  const [autoApproveOwners, setAutoApproveOwners] = useState(false);
  const [maxPropertiesPerOwner, setMaxPropertiesPerOwner] = useState(20);

  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "success" });

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const docRef = doc(db, "settings", "global");
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const data = docSnap.data();
          setMaintenanceMode(data.maintenanceMode || false);
          setMaintenanceMessage(data.maintenanceMessage || "Platform is currently undergoing scheduled maintenance.");
          setPlatformFeePercent(data.platformFeePercent ?? 5.0);
          setFixedServiceFee(data.fixedServiceFee ?? 50);
          setSupportEmail(data.supportEmail || "support@dormitoryapp.com");
          setSupportPhone(data.supportPhone || "+63 912 345 6789");
          setAutoApproveOwners(data.autoApproveOwners || false);
          setMaxPropertiesPerOwner(data.maxPropertiesPerOwner ?? 20);
        }
      } catch (err) {
        console.error("Error fetching settings:", err);
        setSnackbar({ open: true, message: "Failed to load settings.", severity: "error" });
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, []);

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    setSaving(true);

    try {
      const payload = {
        maintenanceMode,
        maintenanceMessage,
        platformFeePercent: Number(platformFeePercent),
        fixedServiceFee: Number(fixedServiceFee),
        supportEmail,
        supportPhone,
        autoApproveOwners,
        maxPropertiesPerOwner: Number(maxPropertiesPerOwner),
        updatedAt: new Date().toISOString()
      };

      await setDoc(doc(db, "settings", "global"), payload, { merge: true });

      setSnackbar({
        open: true,
        message: "System settings updated successfully!",
        severity: "success"
      });
    } catch (err) {
      console.error("Error saving settings:", err);
      setSnackbar({
        open: true,
        message: "Failed to save settings. Please try again.",
        severity: "error"
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "60vh" }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Container maxWidth="xl" disableGutters>
      <Box sx={{ mb: 3, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 2 }}>
        <Box>
          <Typography variant="h5" fontWeight="800" gutterBottom>
            System Settings & Controls
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Manage global operational parameters, financial fees, and maintenance status.
          </Typography>
        </Box>

        <Button
          variant="contained"
          startIcon={saving ? <CircularProgress size={20} color="inherit" /> : <SaveIcon />}
          onClick={handleSaveSettings}
          disabled={saving}
          sx={{ py: 1, px: 3, borderRadius: 2 }}
        >
          {saving ? "Saving..." : "Save Settings"}
        </Button>
      </Box>

      {maintenanceMode && (
        <Alert severity="warning" sx={{ mb: 3, borderRadius: 2 }}>
          <strong>Maintenance Mode Active:</strong> Non-admin users will see a maintenance screen upon logging in.
        </Alert>
      )}

      <form onSubmit={handleSaveSettings}>
        <Grid container spacing={3}>
          {/* Maintenance Mode Controls */}
          <Grid item xs={12} md={6}>
            <Paper elevation={0} sx={{ p: 3, border: "1px solid", borderColor: "divider", borderRadius: 3, height: "100%" }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
                <BuildIcon color="primary" />
                <Typography variant="h6" fontWeight="700">
                  System Status & Maintenance
                </Typography>
              </Box>
              <Divider sx={{ mb: 2.5 }} />

              <Stack spacing={2.5}>
                <Paper elevation={0} sx={{ p: 2, bgcolor: maintenanceMode ? "warning.light" : "background.default", borderRadius: 2 }}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={maintenanceMode}
                        onChange={(e) => setMaintenanceMode(e.target.checked)}
                        color="warning"
                      />
                    }
                    label={
                      <Typography fontWeight="700" color={maintenanceMode ? "warning.dark" : "text.primary"}>
                        Enable Maintenance Mode
                      </Typography>
                    }
                  />
                  <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                    When enabled, restricts access for owners, caretakers, and tenants.
                  </Typography>
                </Paper>

                <TextField
                  label="Maintenance Announcement Banner"
                  value={maintenanceMessage}
                  onChange={(e) => setMaintenanceMessage(e.target.value)}
                  multiline
                  rows={3}
                  fullWidth
                  disabled={!maintenanceMode}
                  helperText="Displayed to users attempting to access the dashboard during maintenance."
                />
              </Stack>
            </Paper>
          </Grid>

          {/* Financials & Platform Fees */}
          <Grid item xs={12} md={6}>
            <Paper elevation={0} sx={{ p: 3, border: "1px solid", borderColor: "divider", borderRadius: 3, height: "100%" }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
                <AttachMoneyIcon color="primary" />
                <Typography variant="h6" fontWeight="700">
                  Platform Fees & Revenue
                </Typography>
              </Box>
              <Divider sx={{ mb: 2.5 }} />

              <Stack spacing={2.5}>
                <TextField
                  label="Platform Commission Rate"
                  type="number"
                  value={platformFeePercent}
                  onChange={(e) => setPlatformFeePercent(e.target.value)}
                  fullWidth
                  size="small"
                  InputProps={{
                    endAdornment: <InputAdornment position="end">%</InputAdornment>,
                  }}
                  helperText="Percentage deducted from owner transaction payouts."
                />

                <TextField
                  label="Fixed Transaction / Service Fee"
                  type="number"
                  value={fixedServiceFee}
                  onChange={(e) => setFixedServiceFee(e.target.value)}
                  fullWidth
                  size="small"
                  InputProps={{
                    startAdornment: <InputAdornment position="start">₱</InputAdornment>,
                  }}
                  helperText="Flat service charge per processed digital payment."
                />
              </Stack>
            </Paper>
          </Grid>

          {/* Registration Policies */}
          <Grid item xs={12} md={6}>
            <Paper elevation={0} sx={{ p: 3, border: "1px solid", borderColor: "divider", borderRadius: 3 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
                <SecurityIcon color="primary" />
                <Typography variant="h6" fontWeight="700">
                  Owner Policies & Limits
                </Typography>
              </Box>
              <Divider sx={{ mb: 2.5 }} />

              <Stack spacing={2.5}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={autoApproveOwners}
                      onChange={(e) => setAutoApproveOwners(e.target.checked)}
                      color="primary"
                    />
                  }
                  label={
                    <Typography variant="body2" fontWeight="600">
                      Auto-Approve Owner Registrations
                    </Typography>
                  }
                />
                <Typography variant="caption" color="text.secondary" sx={{ mt: -1 }}>
                  If disabled, new owners must be reviewed manually in the directory.
                </Typography>

                <TextField
                  label="Max Properties Per Owner"
                  type="number"
                  value={maxPropertiesPerOwner}
                  onChange={(e) => setMaxPropertiesPerOwner(e.target.value)}
                  fullWidth
                  size="small"
                  helperText="Maximum property listings allowed per individual owner account."
                />
              </Stack>
            </Paper>
          </Grid>

          {/* Support Channels */}
          <Grid item xs={12} md={6}>
            <Paper elevation={0} sx={{ p: 3, border: "1px solid", borderColor: "divider", borderRadius: 3 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
                <ContactSupportIcon color="primary" />
                <Typography variant="h6" fontWeight="700">
                  Platform Contact & Support
                </Typography>
              </Box>
              <Divider sx={{ mb: 2.5 }} />

              <Stack spacing={2.5}>
                <TextField
                  label="Official Support Email"
                  type="email"
                  value={supportEmail}
                  onChange={(e) => setSupportEmail(e.target.value)}
                  fullWidth
                  size="small"
                />

                <TextField
                  label="Support Helpline / Phone"
                  value={supportPhone}
                  onChange={(e) => setSupportPhone(e.target.value)}
                  fullWidth
                  size="small"
                />
              </Stack>
            </Paper>
          </Grid>
        </Grid>
      </form>

      {/* Notification Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        <Alert severity={snackbar.severity} sx={{ borderRadius: 2 }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Container>
  );
}