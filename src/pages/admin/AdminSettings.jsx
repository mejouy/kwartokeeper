import React, { useState, useEffect, useMemo } from "react";
import {
  Box,
  Container,
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
  Skeleton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
} from "@mui/material";
import SaveIcon from "@mui/icons-material/Save";
import BuildIcon from "@mui/icons-material/Build";
import ContactSupportIcon from "@mui/icons-material/ContactSupport";
import SecurityIcon from "@mui/icons-material/Security";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db } from "../../config/firebase";

const DEFAULTS = {
  maintenanceMode: false,
  maintenanceMessage: "KwartoKeeper is down for scheduled maintenance. Please check back soon.",
  supportEmail: "",
  supportPhone: "",
  autoApproveOwners: false,
  maxPropertiesPerOwner: "20",
};

const fromDoc = (data = {}) => ({
  maintenanceMode: Boolean(data.maintenanceMode),
  maintenanceMessage: data.maintenanceMessage || DEFAULTS.maintenanceMessage,
  supportEmail: data.supportEmail || "",
  supportPhone: data.supportPhone || "",
  autoApproveOwners: Boolean(data.autoApproveOwners),
  maxPropertiesPerOwner: String(data.maxPropertiesPerOwner ?? DEFAULTS.maxPropertiesPerOwner),
});

const validate = (f) => {
  const e = {};
  const max = Number(f.maxPropertiesPerOwner);
  if (f.maxPropertiesPerOwner === "" || !Number.isInteger(max) || max < 1) e.maxPropertiesPerOwner = "Enter a whole number, 1 or more.";
  if (f.supportEmail.trim() && !/^\S+@\S+\.\S+$/.test(f.supportEmail.trim())) e.supportEmail = "That doesn't look like an email.";
  if (f.maintenanceMode && !f.maintenanceMessage.trim()) e.maintenanceMessage = "Write what users should see.";
  return e;
};

function Section({ icon, title, hint, children }) {
  return (
    <Paper
      elevation={0}
      sx={{ p: { xs: 2, sm: 3 }, border: "1px solid", borderColor: "divider", borderRadius: 3, minWidth: 0 }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: hint ? 0.5 : 2 }}>
        {icon}
        <Typography variant="h6" fontWeight="700">
          {title}
        </Typography>
      </Box>
      {hint && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {hint}
        </Typography>
      )}
      <Divider sx={{ mb: 2.5 }} />
      <Stack spacing={2.5}>{children}</Stack>
    </Paper>
  );
}

export default function AdminSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(DEFAULTS); // what's in Firestore
  const [form, setForm] = useState(DEFAULTS); // what's on screen
  const [touched, setTouched] = useState(false); // show errors only after a save attempt
  const [confirmMaintenance, setConfirmMaintenance] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "success" });

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const setFlag = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.checked }));

  useEffect(() => {
    (async () => {
      try {
        const snap = await getDoc(doc(db, "settings", "global"));
        const values = fromDoc(snap.exists() ? snap.data() : {});
        setSaved(values);
        setForm(values);
      } catch (err) {
        console.error("Error fetching settings:", err);
        setSnackbar({ open: true, message: "Failed to load settings.", severity: "error" });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const errors = useMemo(() => validate(form), [form]);
  const dirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(saved), [form, saved]);
  const shown = touched ? errors : {};

  const persist = async () => {
    setSaving(true);
    try {
      await setDoc(
        doc(db, "settings", "global"),
        {
          maintenanceMode: form.maintenanceMode,
          maintenanceMessage: form.maintenanceMessage.trim(),
          supportEmail: form.supportEmail.trim(),
          supportPhone: form.supportPhone.trim(),
          autoApproveOwners: form.autoApproveOwners,
          maxPropertiesPerOwner: Number(form.maxPropertiesPerOwner),
          updatedAt: new Date().toISOString(),
          updatedBy: auth.currentUser?.uid || null,
        },
        { merge: true }
      );
      setSaved(form);
      setTouched(false);
      setSnackbar({ open: true, message: "Settings saved.", severity: "success" });
    } catch (err) {
      console.error("Error saving settings:", err);
      setSnackbar({ open: true, message: "Couldn't save settings. Please try again.", severity: "error" });
    } finally {
      setSaving(false);
      setConfirmMaintenance(false);
    }
  };

  const handleSave = (e) => {
    e?.preventDefault();
    setTouched(true);
    if (Object.keys(errors).length) {
      setSnackbar({ open: true, message: "Fix the highlighted fields first.", severity: "error" });
      return;
    }
    // Turning maintenance mode on locks everyone else out, so ask first.
    if (form.maintenanceMode && !saved.maintenanceMode) {
      setConfirmMaintenance(true);
      return;
    }
    persist();
  };

  if (loading) {
    return (
      <Container maxWidth="xl" disableGutters>
        <Skeleton variant="text" width={240} height={40} />
        <Skeleton variant="text" width={340} sx={{ mb: 3 }} />
        <Box sx={{ display: "grid", gap: 3, gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "repeat(2, minmax(0, 1fr))" } }}>
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} variant="rounded" height={220} />
          ))}
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="xl" disableGutters>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" fontWeight="800" gutterBottom>
          Settings
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Platform-wide controls: maintenance, owner sign-up rules and support contacts.
        </Typography>
      </Box>

      {saved.maintenanceMode && (
        <Alert severity="warning" sx={{ mb: 3, borderRadius: 2 }}>
          <strong>Maintenance mode is on.</strong> Owners, caretakers and tenants are being shown the maintenance message.
        </Alert>
      )}

      <Box
        component="form"
        onSubmit={handleSave}
        noValidate
        sx={{
          display: "grid",
          gap: 3,
          gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "repeat(2, minmax(0, 1fr))" },
          alignItems: "start",
        }}
      >
        <Section icon={<BuildIcon color="primary" />} title="Maintenance mode" hint="Temporarily pause the app for everyone except admins.">
          <Box
            sx={{
              p: 1.5,
              borderRadius: 2,
              border: "1px solid",
              borderColor: form.maintenanceMode ? "warning.main" : "divider",
              bgcolor: form.maintenanceMode ? "warning.light" : "transparent",
            }}
          >
            <FormControlLabel
              sx={{ m: 0, width: 1, justifyContent: "space-between", flexDirection: "row-reverse" }}
              control={<Switch checked={form.maintenanceMode} onChange={setFlag("maintenanceMode")} color="warning" />}
              label={
                <Typography fontWeight="700" color={form.maintenanceMode ? "warning.dark" : "text.primary"}>
                  {form.maintenanceMode ? "Maintenance mode on" : "Maintenance mode off"}
                </Typography>
              }
            />
          </Box>

          <TextField
            label="Message shown to users"
            value={form.maintenanceMessage}
            onChange={set("maintenanceMessage")}
            multiline
            minRows={3}
            fullWidth
            error={Boolean(shown.maintenanceMessage)}
            helperText={shown.maintenanceMessage || "Shown on the maintenance screen."}
          />
        </Section>

        <Section icon={<SecurityIcon color="primary" />} title="Owner sign-ups" hint="How new owner accounts are handled.">
          <Box>
            <FormControlLabel
              sx={{ m: 0, width: 1, justifyContent: "space-between", flexDirection: "row-reverse" }}
              control={<Switch checked={form.autoApproveOwners} onChange={setFlag("autoApproveOwners")} />}
              label={<Typography fontWeight="600">Auto-approve new owners</Typography>}
            />
            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.5 }}>
              {form.autoApproveOwners
                ? "New owners skip review. You won't be able to check their documents first."
                : "New owners wait in the Owners list until you approve them."}
            </Typography>
          </Box>

          <TextField
            label="Max properties per owner"
            type="number"
            value={form.maxPropertiesPerOwner}
            onChange={set("maxPropertiesPerOwner")}
            fullWidth
            size="small"
            error={Boolean(shown.maxPropertiesPerOwner)}
            helperText={shown.maxPropertiesPerOwner || "How many properties one owner can add."}
            slotProps={{ htmlInput: { min: 1, step: 1, inputMode: "numeric" } }}
          />
        </Section>

        <Section icon={<ContactSupportIcon color="primary" />} title="Support contact" hint="Where users are told to reach you.">
          <TextField
            label="Support email"
            type="email"
            value={form.supportEmail}
            onChange={set("supportEmail")}
            placeholder="support@yourdomain.com"
            fullWidth
            size="small"
            error={Boolean(shown.supportEmail)}
            helperText={shown.supportEmail || " "}
          />

          <TextField
            label="Support phone"
            value={form.supportPhone}
            onChange={set("supportPhone")}
            placeholder="09XX XXX XXXX"
            fullWidth
            size="small"
            slotProps={{ htmlInput: { inputMode: "tel" } }}
          />
        </Section>

        {/* Save bar, only when something changed. Sits above the phone bottom nav. */}
        {dirty && (
          <Paper
            elevation={4}
            sx={{
              gridColumn: "1 / -1",
              position: "sticky",
              bottom: { xs: "calc(76px + env(safe-area-inset-bottom, 0px))", md: 16 },
              zIndex: 2,
              p: 1.5,
              borderRadius: 3,
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 1.5,
              flexWrap: "wrap",
            }}
          >
            <Typography variant="body2" fontWeight="600">
              You have unsaved changes
            </Typography>
            <Stack direction="row" spacing={1} sx={{ ml: "auto" }}>
              <Button
                onClick={() => {
                  setForm(saved);
                  setTouched(false);
                }}
                disabled={saving}
              >
                Discard
              </Button>
              <Button
                type="submit"
                variant="contained"
                disabled={saving}
                startIcon={saving ? <CircularProgress size={18} color="inherit" /> : <SaveIcon />}
                sx={{ borderRadius: 2 }}
              >
                {saving ? "Saving..." : "Save changes"}
              </Button>
            </Stack>
          </Paper>
        )}
      </Box>

      <Dialog open={confirmMaintenance} onClose={() => !saving && setConfirmMaintenance(false)} fullWidth maxWidth="xs">
        <DialogTitle>Turn on maintenance mode?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Owners, caretakers and tenants will see the maintenance message instead of the app until you turn this off.
            Admins are not affected.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setConfirmMaintenance(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={persist} color="warning" variant="contained" disabled={saving}>
            {saving ? "Saving..." : "Turn on"}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        sx={{ bottom: { xs: "calc(80px + env(safe-area-inset-bottom, 0px)) !important", md: 24 } }}
      >
        <Alert severity={snackbar.severity} variant="filled" sx={{ borderRadius: 2 }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Container>
  );
}