import { useState, useEffect, useMemo } from "react";
import {
  Box,
  Typography,
  Button,
  TextField,
  Switch,
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
import { alpha } from "@mui/material/styles";
import SaveOutlinedIcon from "@mui/icons-material/SaveOutlined";
import ConstructionOutlinedIcon from "@mui/icons-material/ConstructionOutlined";
import SupportAgentOutlinedIcon from "@mui/icons-material/SupportAgentOutlined";
import VerifiedUserOutlinedIcon from "@mui/icons-material/VerifiedUserOutlined";
import HomeWorkOutlinedIcon from "@mui/icons-material/HomeWorkOutlined";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db } from "../../config/firebase";
import { SETTINGS_DEFAULTS, normalizeSettings, forgetPlatformSettings } from "../../utils/platformSettings";
import { HeaderCard, Pill } from "./adminUi";

const HEAD = '"Inter", sans-serif';
const R = { sm: "10px", md: "14px", lg: "18px", xl: "22px" };
const fieldSx = { "& .MuiOutlinedInput-root": { borderRadius: R.sm } };

// The form keeps the limit as text while typing
const toForm = (s) => ({ ...s, maxPropertiesPerOwner: String(s.maxPropertiesPerOwner) });
const DEFAULT_FORM = toForm(normalizeSettings(SETTINGS_DEFAULTS));

const validate = (f) => {
  const e = {};
  const max = Number(f.maxPropertiesPerOwner);
  if (f.maxPropertiesPerOwner === "" || !Number.isInteger(max) || max < 1) e.maxPropertiesPerOwner = "Enter a whole number, 1 or more.";
  if (f.supportEmail.trim() && !/^\S+@\S+\.\S+$/.test(f.supportEmail.trim())) e.supportEmail = "That doesn't look like an email.";
  if (f.supportPhone.trim() && !/^[0-9+\-\s()]{7,20}$/.test(f.supportPhone.trim())) e.supportPhone = "Enter a valid phone number.";
  if (f.maintenanceMode && !f.maintenanceMessage.trim()) e.maintenanceMessage = "Write what users should see.";
  return e;
};

// Settings card: what it controls on the left (on wide screens), the controls on the right
function Section({ icon: Icon, title, description, children, tone }) {
  return (
    <Box
      component="section"
      sx={{
        display: "grid",
        gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "260px minmax(0, 1fr)" },
        gap: { xs: 2, md: 3 },
        p: { xs: 2, sm: 3 },
        bgcolor: "background.default",
        border: "1px solid",
        borderColor: tone ? `${tone}.main` : "divider",
        borderRadius: R.lg,
      }}
    >
      <Box sx={{ display: "flex", gap: 1.25, alignItems: "flex-start", minWidth: 0 }}>
        <Box sx={{ width: 38, height: 38, flexShrink: 0, borderRadius: R.sm, display: "grid", placeItems: "center", bgcolor: (t) => alpha(t.palette[tone || "primary"].main, 0.1), color: `${tone || "primary"}.main` }}>
          <Icon sx={{ fontSize: 20 }} />
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontFamily: HEAD, fontWeight: 800, fontSize: "1.02rem", lineHeight: 1.3 }}>{title}</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25, lineHeight: 1.5 }}>
            {description}
          </Typography>
        </Box>
      </Box>
      <Box sx={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>{children}</Box>
    </Box>
  );
}

// A switch row you can tap anywhere on
function SwitchRow({ checked, onChange, title, hint, tone = "primary" }) {
  return (
    <Box
      component="label"
      sx={{
        display: "flex",
        alignItems: "center",
        gap: 1.5,
        p: 1.5,
        borderRadius: R.md,
        cursor: "pointer",
        border: "1.5px solid",
        borderColor: checked ? `${tone}.main` : "divider",
        bgcolor: (t) => (checked ? alpha(t.palette[tone].main, 0.06) : "transparent"),
        transition: "border-color .15s, background-color .15s",
      }}
    >
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography sx={{ fontWeight: 800, fontSize: 14.5, color: checked ? `${tone}.dark` : "text.primary" }}>{title}</Typography>
        {hint && (
          <Typography variant="caption" color="text.secondary" sx={{ display: "block", lineHeight: 1.45 }}>
            {hint}
          </Typography>
        )}
      </Box>
      <Switch checked={checked} onChange={onChange} color={tone} slotProps={{ input: { "aria-label": title } }} />
    </Box>
  );
}

export default function AdminSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(DEFAULT_FORM); // what's in Firestore
  const [form, setForm] = useState(DEFAULT_FORM); // what's on screen
  const [touched, setTouched] = useState(false); // show errors only after a save attempt
  const [confirmMaintenance, setConfirmMaintenance] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "success" });

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));
  const setFlag = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.checked }));

  useEffect(() => {
    getDoc(doc(db, "settings", "global"))
      .then((snap) => {
        const values = toForm(normalizeSettings(snap.exists() ? snap.data() : {}));
        setSaved(values);
        setForm(values);
      })
      .catch((err) => {
        console.error("Error fetching settings:", err);
        setSnackbar({ open: true, message: "Couldn't load the settings. Showing the defaults.", severity: "error" });
      })
      .finally(() => setLoading(false));
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
      forgetPlatformSettings(); // the rest of the app re-reads them
      setSaved(form);
      setTouched(false);
      setSnackbar({ open: true, message: "Settings saved. They apply right away.", severity: "success" });
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
      <Box sx={{ maxWidth: 1100, mx: "auto" }}>
        <Skeleton variant="rounded" height={190} sx={{ borderRadius: R.xl, mb: 2.5 }} />
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} variant="rounded" height={180} sx={{ borderRadius: R.lg, mb: 2 }} />
        ))}
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 1100, mx: "auto" }}>
      <HeaderCard
        description="Platform-wide controls. Changes apply to everyone as soon as you save."
        tiles={[
          { label: "Maintenance mode", value: saved.maintenanceMode ? "On" : "Off", sub: saved.maintenanceMode ? "App is paused" : "App is open", icon: <ConstructionOutlinedIcon />, tone: saved.maintenanceMode ? "warning" : undefined },
          { label: "New owners", value: saved.autoApproveOwners ? "Auto" : "Reviewed", sub: saved.autoApproveOwners ? "Approved on sign-up" : "You approve each one", icon: <VerifiedUserOutlinedIcon />, tone: saved.autoApproveOwners ? "warning" : undefined },
          { label: "Property limit", value: saved.maxPropertiesPerOwner, sub: "Per owner", icon: <HomeWorkOutlinedIcon /> },
          { label: "Support contact", value: saved.supportEmail || saved.supportPhone ? "Set" : "Not set", sub: saved.supportEmail || saved.supportPhone || "Add one below", icon: <SupportAgentOutlinedIcon />, tone: saved.supportEmail || saved.supportPhone ? undefined : "warning" },
        ]}
      />

      {saved.maintenanceMode && (
        <Alert severity="warning" icon={<ConstructionOutlinedIcon />} sx={{ mb: 2.5, borderRadius: R.md }}>
          <strong>Maintenance mode is on.</strong> Owners, caretakers and tenants are seeing the maintenance screen. Admins aren&apos;t affected.
        </Alert>
      )}

      <Box component="form" onSubmit={handleSave} noValidate sx={{ display: "flex", flexDirection: "column", gap: { xs: 2, sm: 2.5 } }}>
        <Section icon={ConstructionOutlinedIcon} title="Maintenance mode" description="Pause the app for owners, caretakers and tenants while you fix or update something. Admins can still sign in." tone={form.maintenanceMode ? "warning" : undefined}>
          <SwitchRow
            checked={form.maintenanceMode}
            onChange={setFlag("maintenanceMode")}
            tone="warning"
            title={form.maintenanceMode ? "Maintenance mode on" : "Maintenance mode off"}
            hint={form.maintenanceMode ? "Everyone except admins sees the message below." : "The app is open to everyone."}
          />
          <TextField
            label="Message shown to users"
            value={form.maintenanceMessage}
            onChange={set("maintenanceMessage")}
            multiline
            minRows={3}
            fullWidth
            error={Boolean(shown.maintenanceMessage)}
            helperText={shown.maintenanceMessage || "Shown on the maintenance screen, with your support contact."}
            sx={fieldSx}
          />
        </Section>

        <Section icon={VerifiedUserOutlinedIcon} title="Owner sign-ups" description="How new owner accounts are handled, and how many properties each can add.">
          <SwitchRow
            checked={form.autoApproveOwners}
            onChange={setFlag("autoApproveOwners")}
            tone="warning"
            title="Auto-approve new owners"
            hint={form.autoApproveOwners ? "New owners get full access right away. You won't check their documents first." : "New owners wait in the Owners list until you approve them."}
          />
          <TextField
            label="Max properties per owner"
            type="number"
            value={form.maxPropertiesPerOwner}
            onChange={set("maxPropertiesPerOwner")}
            fullWidth
            error={Boolean(shown.maxPropertiesPerOwner)}
            helperText={shown.maxPropertiesPerOwner || "Owners at the limit can't start the property setup again."}
            slotProps={{ htmlInput: { min: 1, step: 1, inputMode: "numeric" } }}
            sx={{ ...fieldSx, maxWidth: { sm: 280 } }}
          />
        </Section>

        <Section icon={SupportAgentOutlinedIcon} title="Support contact" description="Shown to users on the maintenance screen, so they know how to reach you.">
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "repeat(2, minmax(0, 1fr))" }, gap: 2 }}>
            <TextField
              label="Support email"
              type="email"
              value={form.supportEmail}
              onChange={set("supportEmail")}
              placeholder="support@yourdomain.com"
              fullWidth
              error={Boolean(shown.supportEmail)}
              helperText={shown.supportEmail || "Optional"}
              sx={fieldSx}
            />
            <TextField
              label="Support phone"
              value={form.supportPhone}
              onChange={set("supportPhone")}
              placeholder="09XX XXX XXXX"
              fullWidth
              error={Boolean(shown.supportPhone)}
              helperText={shown.supportPhone || "Optional"}
              slotProps={{ htmlInput: { inputMode: "tel" } }}
              sx={fieldSx}
            />
          </Box>
        </Section>

        {/* Save bar, only when something changed. Sits above the phone bottom bar. */}
        {dirty && (
          <Box
            sx={{
              position: "sticky",
              bottom: { xs: "calc(80px + env(safe-area-inset-bottom, 0px))", md: 16 },
              zIndex: 2,
              p: 1.5,
              pl: { xs: 1.5, sm: 2.25 },
              borderRadius: R.md,
              bgcolor: "#202020",
              color: "#fff",
              boxShadow: "0 18px 40px -18px rgba(0,0,0,.45)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 1.5,
              flexWrap: "wrap",
            }}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <Pill label="Unsaved" tone="warning" sx={{ bgcolor: "rgba(255,167,38,.2)", color: "#ffcc80" }} />
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                You have unsaved changes
              </Typography>
            </Box>
            <Box sx={{ display: "flex", gap: 1, ml: "auto" }}>
              <Button
                onClick={() => {
                  setForm(saved);
                  setTouched(false);
                }}
                disabled={saving}
                sx={{ color: "#fff", fontWeight: 700 }}
              >
                Discard
              </Button>
              <Button type="submit" variant="contained" disableElevation disabled={saving} startIcon={saving ? <CircularProgress size={18} color="inherit" /> : <SaveOutlinedIcon />} sx={{ borderRadius: R.sm, fontWeight: 700 }}>
                {saving ? "Saving…" : "Save changes"}
              </Button>
            </Box>
          </Box>
        )}
      </Box>

      <Dialog open={confirmMaintenance} onClose={() => !saving && setConfirmMaintenance(false)} fullWidth maxWidth="xs" slotProps={{ paper: { sx: { borderRadius: R.xl } } }}>
        <DialogTitle sx={{ fontFamily: HEAD, fontWeight: 800 }}>Turn on maintenance mode?</DialogTitle>
        <DialogContent>
          <DialogContentText>Owners, caretakers and tenants will see the maintenance message instead of the app until you turn this off. Admins aren&apos;t affected.</DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
          <Button onClick={() => setConfirmMaintenance(false)} color="inherit" disabled={saving} sx={{ fontWeight: 700 }}>
            Cancel
          </Button>
          <Button onClick={persist} color="warning" variant="contained" disableElevation disabled={saving} sx={{ fontWeight: 700, borderRadius: R.sm }}>
            {saving ? "Saving…" : "Turn on"}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        sx={{ bottom: { xs: "calc(84px + env(safe-area-inset-bottom, 0px)) !important", md: 24 } }}
      >
        <Alert severity={snackbar.severity} variant="filled" sx={{ borderRadius: R.sm }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
