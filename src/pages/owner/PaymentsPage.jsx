// src/pages/owner/PaymentsPage.jsx
//
// Owner payments, in two tabs:
//   "Rent"              — who has paid, what needs review, record a payment
//   "Payment accounts"  — where tenants send rent (GCash / Maya / QR Ph, each with a QR image)
//
// The accounts are saved on the property document (properties/{id}.paymentMethods
// and .paymentNote). The tenant dashboard reads them from there.

import { Fragment, useEffect, useMemo, useRef, useState } from "react";

import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  IconButton,
  InputAdornment,
  LinearProgress,
  MenuItem,
  Paper,
  Skeleton,
  Snackbar,
  Switch,
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Avatar,
  InputBase,
  ToggleButton,
  ToggleButtonGroup,
  Autocomplete,
} from "@mui/material";
import { alpha } from "@mui/material/styles";

import AddIcon from "@mui/icons-material/Add";
import CloseIcon from "@mui/icons-material/Close";
import CheckIcon from "@mui/icons-material/Check";
import SearchIcon from "@mui/icons-material/Search";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ApartmentOutlinedIcon from "@mui/icons-material/ApartmentOutlined";
import PaymentsOutlinedIcon from "@mui/icons-material/PaymentsOutlined";
import VisibilityIcon from "@mui/icons-material/Visibility";
import HistoryIcon from "@mui/icons-material/History";
import PrintIcon from "@mui/icons-material/Print";
import QrCode2Icon from "@mui/icons-material/QrCode2";
import AddPhotoAlternateOutlinedIcon from "@mui/icons-material/AddPhotoAlternateOutlined";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutlined";
import SaveOutlinedIcon from "@mui/icons-material/SaveOutlined";
import SmartphoneOutlinedIcon from "@mui/icons-material/SmartphoneOutlined";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import AccountBalanceWalletOutlinedIcon from "@mui/icons-material/AccountBalanceWalletOutlined";
import PendingActionsOutlinedIcon from "@mui/icons-material/PendingActionsOutlined";
import ErrorOutlineRoundedIcon from "@mui/icons-material/ErrorOutlineRounded";

import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";

import { db } from "../../config/firebase";
import { useAuth } from "../../context/AuthContext";
import { uploadToCloudinary } from "../../utils/cloudinary";
import { isReceiptable, issueReceipt, reserveReceiptNo } from "../../utils/receipt";
import { issuerFromProfile, printReceipt as printReceiptDoc } from "../../utils/receiptPrint";
import { rentStatusOf } from "../../utils/tenantRent";
import { withoutRemoved } from "../../utils/accountState";

// ------------------------------------------------------------
// CONSTANTS + PURE HELPERS
// ------------------------------------------------------------

const row = { display: "flex", alignItems: "center" };
const BOTTOM_NAV_H = 64;
const PAYMENT_METHODS = ["GCash", "Cash", "QR Ph", "Maya", "Other"];
const PAYMENT_STATUSES = ["Paid", "Partial", "Pending"];
const MAX_AMOUNT = 10000000;
const QR_MAX_MB = 5;

const pad = (n) => String(n).padStart(2, "0");

// Local date as yyyy-mm-dd (toISOString shifts the day back for anyone east of UTC)
const todayInput = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

// "October 2026" — the format already stored in payments.periodMonth
const periodLabel = (date) => date.toLocaleDateString("en-US", { month: "long", year: "numeric" });

// Current month plus the 11 before it, and next month (advance payments)
const buildPeriodOptions = () => {
  const now = new Date();
  const out = [];
  for (let i = -11; i <= 1; i++) {
    out.push(periodLabel(new Date(now.getFullYear(), now.getMonth() + i, 1)));
  }
  return out.reverse();
};

const STATUS_TONE = {
  paid: "success",
  pending: "warning",
  overdue: "error",
  partial: "info",
  rejected: "error",
  unpaid: "default",
};

function StatusPill({ status }) {
  const tone = STATUS_TONE[String(status).toLowerCase()] || "default";
  return (
    <Chip
      label={status}
      size="small"
      sx={{
        fontWeight: 700,
        border: "none",
        bgcolor: (t) => (tone === "default" ? alpha(t.palette.text.primary, 0.08) : alpha(t.palette[tone].main, 0.13)),
        color: (t) => (tone === "default" ? t.palette.text.secondary : t.palette[tone].dark),
      }}
    />
  );
}

const cardSx = {
  bgcolor: "background.default",
  border: "1px solid",
  borderColor: "divider",
  borderRadius: "18px",
};

const groupShellSx = {
  ...cardSx,
  borderRadius: "18px !important",
  overflow: "hidden",
  "&:before": { display: "none" },
};

// Dialogs: centred pop-ups on phones too (not full screen), scrolling inside
const dialogPaperSx = {
  borderRadius: "20px",
  m: { xs: 2, sm: 4 },
  width: { xs: "calc(100% - 32px)", sm: "calc(100% - 64px)" },
  maxHeight: { xs: "calc(100% - 32px)", sm: "calc(100% - 64px)" },
};

/* ---------------------------------------------------------------------------
   Payment accounts: shape of properties/{id}.paymentMethods
--------------------------------------------------------------------------- */
const METHOD_DEFS = [
  {
    key: "GCash",
    label: "GCash",
    kind: "wallet",
    icon: SmartphoneOutlinedIcon,
    qrHint: "In your GCash app, open your QR code, save it to your photos, then upload it here.",
  },
  {
    key: "Maya",
    label: "Maya",
    kind: "wallet",
    icon: SmartphoneOutlinedIcon,
    qrHint: "In your Maya app, open your QR code, save it to your photos, then upload it here.",
  },
  {
    key: "QR Ph",
    label: "QR Ph",
    kind: "qrph",
    icon: QrCode2Icon,
    qrHint: "Upload your QR Ph code. Tenants can scan it from any bank or e-wallet app.",
  },
];

const emptyMethod = () => ({ enabled: false, accountName: "", accountNumber: "", qrUrl: "" });

const normalizeMethods = (raw) => {
  const out = {};
  METHOD_DEFS.forEach((d) => {
    const r = raw?.[d.key] || {};
    out[d.key] = {
      ...emptyMethod(),
      enabled: Boolean(r.enabled),
      accountName: String(r.accountName || ""),
      accountNumber: String(r.accountNumber || ""),
      qrUrl: String(r.qrUrl || ""),
    };
  });
  return out;
};

const draftFromProperty = (p) => ({
  methods: normalizeMethods(p?.paymentMethods),
  note: String(p?.paymentNote || ""),
});

// A property counts as "set up" when at least one method is on and has something to pay to
const methodUsable = (m) => Boolean(m?.enabled && (String(m.accountNumber || "").trim() || m.qrUrl));
const hasPaymentSetup = (p) => METHOD_DEFS.some((d) => methodUsable(p?.paymentMethods?.[d.key]));

// Philippine mobile numbers: 09XXXXXXXXX (also accepts +63 9XXXXXXXXX)
const normalizeMobile = (value) => {
  const digits = String(value || "").replace(/[^\d+]/g, "");
  if (/^\+639\d{9}$/.test(digits)) return `0${digits.slice(3)}`;
  if (/^639\d{9}$/.test(digits)) return `0${digits.slice(2)}`;
  if (/^09\d{9}$/.test(digits)) return digits;
  return null;
};

const prettyMobile = (n) => (/^09\d{9}$/.test(n) ? `${n.slice(0, 4)} ${n.slice(4, 7)} ${n.slice(7)}` : n);

const validateAccounts = (draft) => {
  const errors = {};
  METHOD_DEFS.forEach((d) => {
    const m = draft.methods[d.key];
    if (!m.enabled) return;
    const e = {};
    if (!m.accountName.trim()) e.accountName = "Enter the account name tenants will see.";
    else if (m.accountName.trim().length > 60) e.accountName = "Keep this under 60 characters.";
    if (d.kind === "wallet") {
      if (!m.accountNumber.trim()) e.accountNumber = "Enter the mobile number.";
      else if (!normalizeMobile(m.accountNumber)) e.accountNumber = "Use a Philippine mobile number, like 0917 123 4567.";
    }
    // Tenants pay by scanning, so every method needs its QR image
    if (!m.qrUrl) e.qrUrl = d.kind === "qrph" ? "Upload your QR Ph code so tenants can scan it." : `Upload your ${d.label} QR code so tenants can scan it.`;
    if (Object.keys(e).length) errors[d.key] = e;
  });
  if (draft.note.length > 300) errors._note = "Keep the note under 300 characters.";
  return errors;
};

// What actually gets written (trimmed, numbers tidied)
const cleanMethods = (methods) => {
  const out = {};
  METHOD_DEFS.forEach((d) => {
    const m = methods[d.key];
    const number = m.accountNumber.trim();
    out[d.key] = {
      enabled: Boolean(m.enabled),
      accountName: m.accountName.trim(),
      accountNumber: d.kind === "wallet" ? normalizeMobile(number) || number : "",
      qrUrl: m.qrUrl || "",
    };
  });
  return out;
};

function SectionTitle({ title, sub, right }) {
  return (
    <Box sx={{ ...row, justifyContent: "space-between", gap: 2, mb: 1.5 }}>
      <Box sx={{ minWidth: 0 }}>
        <Typography sx={{ fontFamily: '"Inter", sans-serif', fontWeight: 800, fontSize: "1.1rem", lineHeight: 1.3 }}>{title}</Typography>
        {sub && (
          <Typography variant="body2" color="text.secondary">
            {sub}
          </Typography>
        )}
      </Box>
      {right}
    </Box>
  );
}

/* ---------------------------------------------------------------------------
   What a tenant sees for one method (used by the preview dialog)
--------------------------------------------------------------------------- */
function MethodPreviewCard({ def, m }) {
  return (
    <Paper elevation={0} sx={{ ...cardSx, p: 2, textAlign: "center" }}>
      <Typography sx={{ fontWeight: 800, mb: 1 }}>
        {def.kind === "wallet" ? `Scan with ${def.label}` : "Scan with any bank or e-wallet app"}
      </Typography>
      {m.qrUrl ? (
        <Box component="img" src={m.qrUrl} alt={`${def.label} QR`} sx={{ display: "block", mx: "auto", mb: 1.5, width: "100%", maxWidth: 220, borderRadius: 2, border: "1px solid", borderColor: "divider", bgcolor: "#fff" }} />
      ) : (
        def.kind === "wallet" && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            No QR uploaded — tenants will only see your number.
          </Typography>
        )
      )}
      <Typography variant="body2" sx={{ fontWeight: 700 }}>{m.accountName || "—"}</Typography>
      {def.kind === "wallet" && (
        <Typography variant="body2" color="text.secondary">
          {prettyMobile(normalizeMobile(m.accountNumber) || m.accountNumber) || "—"}
        </Typography>
      )}
    </Paper>
  );
}

/* ---------------------------------------------------------------------------
   PAYMENT ACCOUNTS TAB
--------------------------------------------------------------------------- */
function PaymentAccountsPanel({ properties, showToast }) {
  const sortedProps = useMemo(
    () => [...properties].sort((a, b) => String(a.propertyName || a.name || "").localeCompare(String(b.propertyName || b.name || ""))),
    [properties]
  );

  // The chosen property (falls back to the first one, and recovers if it disappears)
  const [pickedId, setPickedId] = useState("");
  const selectedId = sortedProps.some((p) => p.id === pickedId) ? pickedId : sortedProps[0]?.id || "";
  // Unsaved edits, per property. With no edits the form simply shows what is
  // saved, so changes made elsewhere appear without any syncing code.
  const [drafts, setDrafts] = useState({});
  const [errors, setErrors] = useState({});
  const [applyAll, setApplyAll] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingKey, setUploadingKey] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);
  const fileInputs = useRef({});

  const property = sortedProps.find((p) => p.id === selectedId) || null;
  const saved = useMemo(() => draftFromProperty(property), [property]);
  const savedJson = JSON.stringify(saved);
  const draft = drafts[selectedId] || saved;
  const dirty = Boolean(property) && Boolean(drafts[selectedId]) && JSON.stringify(drafts[selectedId]) !== savedJson;
  const updateDraft = (fn) => setDrafts((prev) => ({ ...prev, [selectedId]: fn(prev[selectedId] || saved) }));
  const dropDrafts = (ids) =>
    setDrafts((prev) => {
      const next = { ...prev };
      ids.forEach((id) => delete next[id]);
      return next;
    });

  // Warn before closing the tab with unsaved changes
  useEffect(() => {
    if (!dirty) return undefined;
    const handler = (e) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  const changeProperty = (id) => {
    if (dirty && !window.confirm("You have unsaved changes. Switch property and discard them?")) return;
    dropDrafts([selectedId]);
    setErrors({});
    setPickedId(id);
  };

  const setMethod = (key, patch) => {
    updateDraft((d) => ({ ...d, methods: { ...d.methods, [key]: { ...d.methods[key], ...patch } } }));
    setErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const pickQr = async (key, event) => {
    const file = event.target.files?.[0];
    event.target.value = ""; // so the same file can be chosen again
    if (!file) return;
    if (!/^image\//i.test(file.type)) {
      showToast("Please choose an image of your QR code (PNG or JPG).", "error");
      return;
    }
    if (file.size > QR_MAX_MB * 1024 * 1024) {
      showToast(`That image is over ${QR_MAX_MB} MB. Try a smaller screenshot.`, "error");
      return;
    }
    setUploadingKey(key);
    try {
      const url = await uploadToCloudinary(file);
      if (!url) throw new Error("No link came back from the upload.");
      setMethod(key, { qrUrl: url });
      showToast("QR uploaded. Don't forget to save.");
    } catch (err) {
      console.error("QR upload failed:", err);
      showToast(err?.message || "Couldn't upload the QR. Check your connection and try again.", "error");
    } finally {
      setUploadingKey("");
    }
  };

  const handleSave = async () => {
    if (!property || saving || uploadingKey) return;
    const errs = validateAccounts(draft);
    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      showToast("Please fix the highlighted fields first.", "error");
      return;
    }
    const payload = {
      paymentMethods: cleanMethods(draft.methods),
      paymentNote: draft.note.trim(),
      paymentUpdatedAt: serverTimestamp(),
    };
    setSaving(true);
    try {
      const targets = applyAll ? sortedProps : [property];
      if (targets.length > 1) {
        const batch = writeBatch(db);
        targets.forEach((p) => batch.update(doc(db, "properties", p.id), payload));
        await batch.commit();
      } else {
        await updateDoc(doc(db, "properties", property.id), payload);
      }
      // The saved values now come from the property itself, so the "unsaved" state clears
      dropDrafts(targets.map((p) => p.id));
      setApplyAll(false);
      showToast(targets.length > 1 ? `Saved for all ${targets.length} properties.` : "Payment accounts saved. Tenants will see them now.");
    } catch (err) {
      console.error("Error saving payment accounts:", err);
      showToast(
        err?.code === "permission-denied"
          ? "You don't have permission to change this property."
          : "Couldn't save. Check your connection and try again.",
        "error"
      );
    } finally {
      setSaving(false);
    }
  };

  const discard = () => {
    dropDrafts([selectedId]);
    setErrors({});
  };

  if (sortedProps.length === 0) {
    return (
      <Paper elevation={0} sx={{ ...groupShellSx, borderStyle: "dashed", py: 7, px: 3, textAlign: "center" }}>
        <Box sx={{ width: 64, height: 64, borderRadius: "50%", mx: "auto", mb: 2, ...row, justifyContent: "center", bgcolor: "rgba(255, 69, 0, 0.10)" }}>
          <QrCode2Icon sx={{ fontSize: 32, color: "primary.main" }} />
        </Box>
        <Typography sx={{ fontWeight: 700, mb: 0.5 }}>Add a property first</Typography>
        <Typography variant="body2" color="text.secondary">
          Payment accounts are saved per property. Create one and come back here.
        </Typography>
      </Paper>
    );
  }

  const enabledDefs = METHOD_DEFS.filter((d) => draft.methods[d.key].enabled);
  const noneEnabled = enabledDefs.length === 0;

  return (
    <Box sx={{ pb: dirty ? { xs: 11, sm: 10 } : 0 }}>
      <Box sx={{ ...row, justifyContent: "space-between", alignItems: "flex-start", gap: 2, mb: 2, flexWrap: "wrap" }}>
        <Box sx={{ flex: "1 1 260px", minWidth: 0 }}>
          <Typography sx={{ fontFamily: '"Inter", sans-serif', fontWeight: 800, fontSize: "1.1rem", lineHeight: 1.3 }}>Where tenants send rent</Typography>
          <Typography variant="body2" color="text.secondary">
            Tenants see these accounts when they tap <strong>Pay rent</strong>. Upload the QR code from your own GCash or Maya app, or a QR Ph code from your bank.
          </Typography>
          <Typography variant="caption" color="text.secondary" component="div" sx={{ mt: 0.5 }}>
            <Box component="span" sx={{ color: "error.main" }}>*</Box> Required for each method you turn on.
          </Typography>
        </Box>
        <Button
          variant="outlined"
          startIcon={<VisibilityOutlinedIcon />}
          onClick={() => setPreviewOpen(true)}
          disabled={noneEnabled}
          sx={{ fontWeight: 700, borderRadius: 2.5, minHeight: 44, textTransform: "none", flexShrink: 0 }}
        >
          Preview as tenant
        </Button>
      </Box>

      {sortedProps.length > 1 && (
        <TextField
          select
          fullWidth
          label="Property"
          value={selectedId}
          onChange={(e) => changeProperty(e.target.value)}
          sx={{ mb: 2, maxWidth: { sm: 420 } }}
          helperText="Each property can have its own accounts."
        >
          {sortedProps.map((p) => (
            <MenuItem key={p.id} value={p.id}>
              {p.propertyName || p.name || "Unnamed property"}
              {hasPaymentSetup(p) ? "" : " — not set up"}
            </MenuItem>
          ))}
        </TextField>
      )}

      {noneEnabled && (
        <Alert severity="warning" sx={{ mb: 2, borderRadius: 2.5 }}>
          No payment method is turned on, so tenants can't see where to pay. Switch on at least one below.
        </Alert>
      )}

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "repeat(2, minmax(0, 1fr))" }, gap: 2, alignItems: "start" }}>
        {METHOD_DEFS.map((def) => {
          const m = draft.methods[def.key];
          const e = errors[def.key] || {};
          const Icon = def.icon;
          const uploading = uploadingKey === def.key;
          return (
            <Paper key={def.key} elevation={0} sx={{ ...cardSx, overflow: "hidden", borderColor: m.enabled ? "primary.main" : "divider" }}>
              <Box sx={{ ...row, justifyContent: "space-between", gap: 1.5, px: 2, py: 1.25, bgcolor: (t) => alpha(t.palette.primary.main, m.enabled ? 0.06 : 0) }}>
                <Box sx={{ ...row, gap: 1.25, minWidth: 0 }}>
                  <Box sx={{ width: 36, height: 36, borderRadius: 2, flexShrink: 0, ...row, justifyContent: "center", bgcolor: "rgba(255, 69, 0, 0.10)" }}>
                    <Icon color="primary" fontSize="small" />
                  </Box>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography sx={{ fontWeight: 800, lineHeight: 1.25 }}>{def.label}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {m.enabled ? (methodUsable(m) ? "Shown to tenants" : "Add details below") : "Off"}
                    </Typography>
                  </Box>
                </Box>
                <Switch
                  checked={m.enabled}
                  onChange={(ev) => setMethod(def.key, { enabled: ev.target.checked })}
                  slotProps={{ input: { "aria-label": `Accept ${def.label}` } }}
                />
              </Box>

              {m.enabled && (
                <Box sx={{ p: 2, display: "flex", flexDirection: "column", gap: 2 }}>
                  <TextField
                    required
                    label="Account name"
                    value={m.accountName}
                    onChange={(ev) => setMethod(def.key, { accountName: ev.target.value })}
                    error={Boolean(e.accountName)}
                    helperText={e.accountName || "Exactly as it appears in the app, so tenants can check it before sending."}
                    fullWidth
                    slotProps={{ htmlInput: { maxLength: 60 } }}
                  />
                  {def.kind === "wallet" && (
                    <TextField
                      required
                      label="Mobile number"
                      value={m.accountNumber}
                      onChange={(ev) => setMethod(def.key, { accountNumber: ev.target.value })}
                      error={Boolean(e.accountNumber)}
                      helperText={e.accountNumber || "The number linked to your account"}
                      fullWidth
                      slotProps={{ htmlInput: { inputMode: "tel", maxLength: 25 } }}
                    />
                  )}

                  {/* QR image */}
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.5 }}>
                      QR code{" "}
                      <Box component="span" aria-hidden="true" sx={{ color: "error.main" }}>*</Box>
                    </Typography>
                    <Typography variant="caption" color="text.secondary" component="div" sx={{ mb: 1 }}>
                      {def.qrHint}
                    </Typography>
                    <input
                      ref={(el) => {
                        fileInputs.current[def.key] = el;
                      }}
                      type="file"
                      accept="image/*"
                      hidden
                      onChange={(ev) => pickQr(def.key, ev)}
                    />
                    {m.qrUrl ? (
                      <Box sx={{ ...row, gap: 2, alignItems: "flex-start", flexWrap: "wrap" }}>
                        <Box
                          component="a"
                          href={m.qrUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label="Open QR full size"
                          sx={{ display: "block", flexShrink: 0 }}
                        >
                          <Box component="img" src={m.qrUrl} alt={`${def.label} QR code`} sx={{ display: "block", width: 148, height: 148, objectFit: "contain", bgcolor: "#fff", borderRadius: 2, border: "1px solid", borderColor: "divider" }} />
                        </Box>
                        <Box sx={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 0 }}>
                          <Button
                            variant="outlined"
                            size="small"
                            startIcon={uploading ? <CircularProgress size={16} /> : <AddPhotoAlternateOutlinedIcon />}
                            disabled={uploading}
                            onClick={() => fileInputs.current[def.key]?.click()}
                            sx={{ fontWeight: 700, minHeight: 40, textTransform: "none" }}
                          >
                            {uploading ? "Uploading…" : "Replace QR"}
                          </Button>
                          <Button
                            size="small"
                            color="error"
                            startIcon={<DeleteOutlineIcon />}
                            disabled={uploading}
                            onClick={() => setMethod(def.key, { qrUrl: "" })}
                            sx={{ fontWeight: 700, minHeight: 40, textTransform: "none", justifyContent: "flex-start" }}
                          >
                            Remove
                          </Button>
                        </Box>
                      </Box>
                    ) : (
                      <Button
                        fullWidth
                        variant="outlined"
                        color={e.qrUrl ? "error" : "primary"}
                        startIcon={uploading ? <CircularProgress size={18} /> : <QrCode2Icon />}
                        disabled={uploading}
                        onClick={() => fileInputs.current[def.key]?.click()}
                        sx={{ minHeight: 76, borderStyle: "dashed", borderRadius: 2.5, fontWeight: 700, textTransform: "none", flexDirection: "column", gap: 0.25 }}
                      >
                        {uploading ? "Uploading…" : "Upload QR image"}
                        <Typography variant="caption" color="text.secondary" component="span">
                          PNG or JPG, up to {QR_MAX_MB} MB
                        </Typography>
                      </Button>
                    )}
                    {e.qrUrl && (
                      <Typography variant="caption" color="error" component="div" sx={{ mt: 0.75 }}>
                        {e.qrUrl}
                      </Typography>
                    )}
                  </Box>
                </Box>
              )}
            </Paper>
          );
        })}

        {/* Note */}
        <Paper elevation={0} sx={{ ...cardSx, p: 2, gridColumn: { md: "1 / -1" } }}>
          <TextField
            label="Payment instructions (optional)"
            value={draft.note}
            onChange={(ev) => {
              updateDraft((d) => ({ ...d, note: ev.target.value }));
              setErrors((prev) => (prev._note ? { ...prev, _note: undefined } : prev));
            }}
            multiline
            minRows={2}
            fullWidth
            placeholder="Example: Pay on or before the 5th. Put your room number in the message."
            error={Boolean(errors._note)}
            helperText={errors._note || `${draft.note.length}/300 · Shown to tenants above the accounts. Cash is always accepted if you say so here.`}
          />
        </Paper>
      </Box>

      {sortedProps.length > 1 && (
        <FormControlLabel
          sx={{ mt: 1.5, alignItems: "flex-start", "& .MuiCheckbox-root": { pt: 0.75 } }}
          control={<Checkbox checked={applyAll} onChange={(ev) => setApplyAll(ev.target.checked)} />}
          label={
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 700 }}>Use these for all {sortedProps.length} properties</Typography>
              <Typography variant="caption" color="text.secondary">Replaces the accounts saved on your other properties.</Typography>
            </Box>
          }
        />
      )}

      {/* Save bar (only when something changed) */}
      {dirty && (
        <Paper
          elevation={6}
          sx={{
            position: "fixed",
            left: { xs: 12, sm: "auto" },
            right: { xs: 12, sm: 24 },
            bottom: { xs: `calc(${BOTTOM_NAV_H + 12}px + env(safe-area-inset-bottom, 0px))`, sm: 24 },
            zIndex: (t) => t.zIndex.appBar - 1,
            borderRadius: 3,
            px: 2,
            py: 1.25,
            ...row,
            gap: 1.5,
            justifyContent: "space-between",
          }}
        >
          <Typography variant="body2" sx={{ fontWeight: 700, display: { xs: "none", sm: "block" } }}>
            Unsaved changes
          </Typography>
          <Box sx={{ display: "flex", gap: 1, flex: { xs: 1, sm: "none" } }}>
            <Button onClick={discard} color="inherit" disabled={saving} sx={{ fontWeight: 600, flex: { xs: 1, sm: "none" }, minHeight: 44 }}>
              Discard
            </Button>
            <Button
              variant="contained"
              disableElevation
              onClick={handleSave}
              disabled={saving || Boolean(uploadingKey)}
              startIcon={saving ? <CircularProgress size={18} color="inherit" /> : <SaveOutlinedIcon />}
              sx={{ fontWeight: 700, flex: { xs: 1, sm: "none" }, minHeight: 44, borderRadius: 2.5 }}
            >
              {saving ? "Saving…" : "Save"}
            </Button>
          </Box>
        </Paper>
      )}

      {/* Preview */}
      <Dialog open={previewOpen} onClose={() => setPreviewOpen(false)} fullWidth maxWidth="xs" slotProps={{ paper: { sx: dialogPaperSx } }}>
        <DialogTitle sx={{ ...row, justifyContent: "space-between", fontWeight: 800 }}>
          What tenants see
          <IconButton onClick={() => setPreviewOpen(false)} size="small" aria-label="Close preview">
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          {draft.note.trim() && (
            <Alert severity="info" icon={false} sx={{ mb: 2, borderRadius: 2, whiteSpace: "pre-line" }}>
              {draft.note.trim()}
            </Alert>
          )}
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
            {enabledDefs.map((def) => (
              <MethodPreviewCard key={def.key} def={def} m={draft.methods[def.key]} />
            ))}
          </Box>
          {dirty && (
            <Typography variant="caption" color="text.secondary" component="div" sx={{ mt: 1.5 }}>
              This preview includes changes you haven't saved yet.
            </Typography>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button variant="contained" disableElevation onClick={() => setPreviewOpen(false)} sx={{ fontWeight: 700 }}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

/* ---------------------------------------------------------------------------
   PAGE
--------------------------------------------------------------------------- */
// Most urgent first. "Not due" = lease ended, starts later, or not an active tenant.
const STATUS_FILTERS = ["All", "Overdue", "Unpaid", "Pending", "Partial", "Paid", "Not due"];

export default function PaymentsPage() {
  const { currentUser } = useAuth() || {};

  const [tab, setTab] = useState(0); // 0 = Rent, 1 = Payment accounts
  const [tenants, setTenants] = useState([]);
  const [payments, setPayments] = useState([]);
  const [properties, setProperties] = useState([]);
  const [ownerProfile, setOwnerProfile] = useState({});
  const [loading, setLoading] = useState(true);
  // "Today" for due dates, fixed when the page opens
  const [today] = useState(() => new Date());

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  const [openRecordPayment, setOpenRecordPayment] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formErrors, setFormErrors] = useState({});
  const [processingPaymentId, setProcessingPaymentId] = useState("");
  const [rejectTarget, setRejectTarget] = useState(null);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [historyTenant, setHistoryTenant] = useState(null);
  const [toast, setToast] = useState({ open: false, severity: "success", message: "" });

  const [paymentForm, setPaymentForm] = useState({
    tenantId: "",
    amount: "",
    amountTouched: false,
    statusTouched: false,
    paymentMethod: "GCash",
    periodMonth: "",
    status: "Paid",
    paymentDate: "",
    remarks: "",
  });

  const showToast = (message, severity = "success") => setToast({ open: true, severity, message });

  // ------------------------------------------------------------
  // CURRENT BILLING PERIOD
  // ------------------------------------------------------------

  const currentPeriodValue = useMemo(() => periodLabel(new Date()), []);
  const periodOptions = useMemo(() => buildPeriodOptions(), []);

  // ------------------------------------------------------------
  // LOAD TENANTS, PAYMENTS AND PROPERTIES
  // ------------------------------------------------------------

  useEffect(() => {
    if (!currentUser?.uid) return undefined;

    // A tenant can have a `tenants` record, a `users` account, or both:
    // merge the two so nobody is missing from rent tracking.
    const sources = { tenants: [], users: [] };
    const publish = () => {
      const byId = new Map();
      [...sources.users, ...sources.tenants].forEach((t) => byId.set(t.id, { ...(byId.get(t.id) || {}), ...t }));
      setTenants(withoutRemoved([...byId.values()]));
      setLoading(false);
    };

    const unsubscribeTenants = onSnapshot(
      query(collection(db, "tenants"), where("ownerUid", "==", currentUser.uid)),
      (snapshot) => {
        sources.tenants = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        publish();
      },
      (error) => {
        console.error("Error loading tenants:", error);
        setLoading(false);
      }
    );
    const unsubscribeTenantUsers = onSnapshot(
      query(collection(db, "users"), where("ownerUid", "==", currentUser.uid)),
      (snapshot) => {
        sources.users = snapshot.docs.map((d) => ({ id: d.id, ...d.data() })).filter((u) => u.role === "tenant");
        publish();
      },
      (error) => console.warn("Tenant accounts unavailable:", error?.code || error)
    );

    // Payments: only this month's (rent tracking) and anything still waiting
    // for review (any month). All-time payments grow every month, so they are
    // never loaded in one go; a tenant's history is read when it is opened.
    const paymentSources = { month: [], pending: [], verification: [] };
    const publishPayments = () => {
      const byId = new Map();
      Object.values(paymentSources).flat().forEach((p) => byId.set(p.id, p));
      setPayments([...byId.values()]);
    };
    const watchPayments = (key, ...filters) =>
      onSnapshot(
        query(collection(db, "payments"), where("ownerUid", "==", currentUser.uid), ...filters),
        (snapshot) => {
          paymentSources[key] = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
          publishPayments();
        },
        (error) => console.error(`Error loading payments (${key}):`, error)
      );
    const paymentUnsubs = [
      // Every screen that records a payment saves the month it covers, e.g. "October 2026"
      watchPayments("month", where("periodMonth", "==", periodLabel(new Date()))),
      watchPayments("pending", where("status", "in", ["Pending", "pending"])),
      watchPayments("verification", where("verificationStatus", "in", ["Pending", "pending"])),
    ];
    const unsubscribePayments = () => paymentUnsubs.forEach((u) => u());

    // Property names (two properties can both have a "Room 101") and their payment accounts
    const unsubscribeProperties = onSnapshot(
      query(collection(db, "properties"), where("ownerUid", "==", currentUser.uid)),
      (snapshot) => setProperties(snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (error) => console.error("Error loading properties:", error)
    );

    // Registered name / TIN / address for receipts
    const unsubscribeOwner = onSnapshot(
      doc(db, "users", currentUser.uid),
      (snap) => setOwnerProfile(snap.exists() ? snap.data() : {}),
      (error) => console.warn("Owner profile unavailable:", error?.code || error)
    );

    return () => {
      unsubscribeTenants();
      unsubscribeTenantUsers();
      unsubscribePayments();
      unsubscribeProperties();
      unsubscribeOwner();
    };
  }, [currentUser]);

  // ------------------------------------------------------------
  // HELPERS
  // ------------------------------------------------------------

  const propertyNameById = useMemo(() => {
    const map = new Map();
    properties.forEach((p) => map.set(p.id, p.propertyName || p.name || "Unnamed property"));
    return map;
  }, [properties]);

  const normalizedTenants = useMemo(
    () =>
      tenants.map((tenant) => ({
        ...tenant,
        fullName: tenant.fullName || tenant.name || "Unnamed Tenant",
        roomNumber: tenant.roomNumber || tenant.roomId || "Unassigned",
        propertyName: propertyNameById.get(tenant.propertyId) || tenant.propertyName || "Dormitory",
        monthlyRent: Number(tenant.monthlyRent ?? tenant.rentAmount ?? tenant.monthlyRate ?? tenant.rent ?? 0) || 0,
        status: tenant.status || "Active",
      })),
    [tenants, propertyNameById]
  );

  const formatCurrency = (amount) =>
    new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", minimumFractionDigits: 2 }).format(Number(amount) || 0);

  // Whole pesos when there are no centavos (keeps the summary strip compact)
  const formatCompact = (amount) =>
    new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(Number(amount) || 0);

  const getPaymentDate = (payment) => {
    const value = payment.paymentDate || payment.createdAt;
    if (!value) return null;
    if (typeof value?.toDate === "function") return value.toDate();
    if (value instanceof Date) return value;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  };

  const formatDate = (payment) => {
    const date = getPaymentDate(payment);
    if (!date) return "—";
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  const getPaymentStatus = (payment) => String(payment.status || "").toLowerCase();

  // Money actually received: a Partial payment is real money too
  const isReceived = (payment) => ["paid", "partial"].includes(getPaymentStatus(payment));

  // Rent for the current billing period. The period the payment was FOR decides this
  // (an October rent paid on September 30 is still October's). Used for the totals
  // AND every tenant row, so they always add up.
  const isForCurrentPeriod = (payment) => {
    if (payment.periodMonth) return String(payment.periodMonth).trim().toLowerCase() === currentPeriodValue.toLowerCase();
    const date = getPaymentDate(payment);
    return Boolean(date) && date.getMonth() === today.getMonth() && date.getFullYear() === today.getFullYear();
  };

  // Inactive tenants and tenants who haven't finished onboarding aren't expected to pay yet.
  // (Statuses are "Active", "Pending Onboarding", "Inactive".)
  const countsTowardRent = (tenant) => {
    const s = String(tenant.status).toLowerCase();
    return s !== "inactive" && !s.startsWith("pending");
  };

  const printReceipt = async (payment, tenantFallback = {}) => {
    if (!payment || !isReceiptable(getPaymentStatus(payment))) {
      showToast("Receipts are for money received: paid or partial payments.", "warning");
      return;
    }

    const tenant = normalizedTenants.find((item) => item.id === payment.tenantId) || tenantFallback;

    // Older payments were confirmed before numbering existed: give them a number now
    let receiptNo = payment.receiptNo;
    let issuer = payment.receiptIssuer;
    if (!receiptNo) {
      try {
        receiptNo = await issueReceipt(db, currentUser.uid, payment.id);
      } catch (error) {
        console.error("Could not number the receipt:", error);
        showToast("Couldn't assign a receipt number. Please try again.", "error");
        return;
      }
      issuer = undefined;
    }

    printReceiptDoc({
      receiptNo,
      issuer: issuer || issuerFromProfile(ownerProfile),
      tenant: payment.tenantName || tenant.fullName || tenant.name,
      property: payment.propertyName || tenant.propertyName,
      room: payment.roomNumber || tenant.roomNumber || tenant.roomId,
      period: payment.periodMonth,
      dateText: formatDate(payment),
      method: payment.paymentMethod,
      amountText: formatCurrency(payment.amount),
      remarks: payment.remarks,
      partial: getPaymentStatus(payment) === "partial",
    });
  };

  // A tenant's full payment history, read only while their history dialog is open
  const [history, setHistory] = useState({ tenantId: "", list: [], loading: false });
  useEffect(() => {
    if (!historyTenant?.id || !currentUser?.uid) return undefined;
    const tenantId = historyTenant.id;
    return onSnapshot(
      query(collection(db, "payments"), where("ownerUid", "==", currentUser.uid), where("tenantId", "==", tenantId)),
      (snapshot) => setHistory({ tenantId, list: snapshot.docs.map((d) => ({ id: d.id, ...d.data() })), loading: false }),
      (error) => {
        console.error("Error loading payment history:", error);
        setHistory({ tenantId, list: [], loading: false });
      }
    );
  }, [historyTenant, currentUser]);
  const historyLoading = Boolean(historyTenant) && history.tenantId !== historyTenant.id;
  const paymentHistoryForTenant = useMemo(() => {
    if (!historyTenant || history.tenantId !== historyTenant.id) return [];
    return [...history.list].sort((a, b) => (getPaymentDate(b)?.getTime() || 0) - (getPaymentDate(a)?.getTime() || 0));
  }, [history, historyTenant]);

  // ------------------------------------------------------------
  // SUMMARY
  // ------------------------------------------------------------

  // Money received for this month (paid + partial)
  const totalRentCollectedThisMonth = payments
    .filter((p) => isForCurrentPeriod(p) && isReceived(p))
    .reduce((total, p) => total + Number(p.amount || 0), 0);


  // ------------------------------------------------------------
  // PENDING PAYMENT VERIFICATION
  // ------------------------------------------------------------

  const pendingVerificationPayments = useMemo(
    () =>
      [...payments]
        .filter((payment) => {
          const status = getPaymentStatus(payment);
          const verificationStatus = String(payment.verificationStatus || "").toLowerCase();
          return status === "pending" || (verificationStatus === "pending" && status !== "rejected" && status !== "paid");
        })
        .sort((a, b) => (getPaymentDate(b)?.getTime() || 0) - (getPaymentDate(a)?.getTime() || 0)),
    [payments]
  );

  // ------------------------------------------------------------
  // PAYMENT STATUS FOR TENANT
  // ------------------------------------------------------------

  // Statuses: Paid, Pending (proof to review), Partial, Overdue (past the due day),
  // Unpaid (not due yet), Not due (lease ended / starts later / not active).
  // Due dates use the same rules as the Tenants pages and overdue reminders.
  const getTenantPaymentInfo = (tenant) => {
    const tenantPayments = payments.filter((payment) => payment.tenantId === tenant.id && isForCurrentPeriod(payment));
    const paidAmount = tenantPayments.filter(isReceived).reduce((total, payment) => total + Number(payment.amount || 0), 0);
    const latestPayment = [...tenantPayments].sort((a, b) => (getPaymentDate(b)?.getTime() || 0) - (getPaymentDate(a)?.getTime() || 0))[0];
    const rent = Number(tenant.monthlyRent || 0);
    const due = rentStatusOf(tenant, tenantPayments, today);
    const owes = countsTowardRent(tenant) && ["paid", "review", "due", "overdue"].includes(due.key);

    let status;
    if (rent > 0 && paidAmount >= rent) status = "Paid";
    else if (tenantPayments.some((p) => getPaymentStatus(p) === "pending")) status = "Pending";
    else if (paidAmount > 0) status = "Partial";
    else if (!owes) status = "Not due";
    else if (due.key === "overdue") status = "Overdue";
    else status = "Unpaid";

    return {
      paidAmount,
      rent,
      expected: owes ? rent : 0,
      balance: owes ? Math.max(rent - paidAmount, 0) : 0,
      status,
      // e.g. "Overdue 4 days" / "Due in 3 days", shown under the tenant's name
      dueText: status === "Overdue" || status === "Unpaid" || status === "Partial" ? due.label : "",
      latestPayment,
    };
  };

  // ------------------------------------------------------------
  // PROPERTY → ROOM GROUPS (keyed by property AND room), with search + status filter
  // ------------------------------------------------------------

  const propertyGroups = useMemo(() => {
    const props = new Map();
    const needle = search.trim().toLowerCase();

    normalizedTenants.forEach((tenant) => {
      const propKey = tenant.propertyId || "none";
      if (!props.has(propKey)) {
        props.set(propKey, { key: propKey, name: tenant.propertyName || "Unassigned property", rooms: new Map(), collected: 0, expected: 0, tenantCount: 0 });
      }
      const prop = props.get(propKey);

      const roomNumber = tenant.roomNumber || "Unassigned";
      if (!prop.rooms.has(roomNumber)) {
        prop.rooms.set(roomNumber, { roomNumber, tenants: [], collected: 0, expected: 0 });
      }
      const room = prop.rooms.get(roomNumber);

      const info = getTenantPaymentInfo(tenant);
      const expected = info.expected;

      // Totals always cover everyone; the filter only decides which rows are listed
      room.collected += info.paidAmount;
      room.expected += expected;
      prop.collected += info.paidAmount;
      prop.expected += expected;
      prop.tenantCount += 1;

      const matchesSearch =
        !needle ||
        [tenant.fullName, tenant.roomNumber, tenant.propertyName].some((v) => String(v || "").toLowerCase().includes(needle));
      const matchesStatus = statusFilter === "All" || info.status === statusFilter;
      if (matchesSearch && matchesStatus) room.tenants.push({ tenant, info });
    });

    return [...props.values()]
      .map((prop) => ({
        ...prop,
        rooms: [...prop.rooms.values()]
          .filter((r) => r.tenants.length > 0)
          .sort((a, b) => String(a.roomNumber).localeCompare(String(b.roomNumber), undefined, { numeric: true })),
      }))
      .filter((prop) => prop.rooms.length > 0)
      .sort((a, b) => a.name.localeCompare(b.name));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [normalizedTenants, payments, currentPeriodValue, search, statusFilter, today]);

  const filtersActive = Boolean(search.trim()) || statusFilter !== "All";

  // Properties whose tenants can't see any place to pay yet
  const propertiesWithoutAccounts = useMemo(() => properties.filter((p) => !hasPaymentSetup(p)), [properties]);

  // ------------------------------------------------------------
  // PAYMENT VERIFICATION
  // ------------------------------------------------------------

  const notifyTenant = (payment, fields) => {
    if (!payment?.tenantId) return;
    addDoc(collection(db, "notifications"), {
      userId: payment.tenantId,
      kind: "payment",
      category: "payment",
      paymentId: payment.id || "",
      ownerId: currentUser.uid,
      createdBy: currentUser.uid,
      createdByRole: "owner",
      isRead: false,
      createdAt: new Date().toISOString(),
      ...fields,
    }).catch((err) => console.warn("Payment notice failed:", err?.code || err));
  };

  const handleVerifyPayment = async (paymentId, approved) => {
    if (!currentUser?.uid || !paymentId) {
      showToast("Unable to update this payment.", "error");
      return;
    }

    const payment = payments.find((item) => item.id === paymentId);

    if (!payment) {
      showToast("Payment could not be found.", "error");
      return;
    }

    if (payment.ownerUid && payment.ownerUid !== currentUser.uid) {
      showToast("You are not authorized to update this payment.", "error");
      return;
    }

    setProcessingPaymentId(paymentId);

    try {
      const verification = {
        status: approved ? "Paid" : "Rejected",
        verificationStatus: approved ? "Approved" : "Rejected",
        verifiedAt: new Date(),
        verifiedBy: currentUser.uid,
      };
      let receiptNo = payment.receiptNo || "";
      if (approved) {
        // Approving makes it a confirmed receipt, so it gets the next receipt number in the same step
        await runTransaction(db, async (tx) => {
          const paymentRef = doc(db, "payments", paymentId);
          const snap = await tx.get(paymentRef);
          const issued = snap.data()?.receiptNo ? {} : await reserveReceiptNo(tx, db, currentUser.uid);
          receiptNo = snap.data()?.receiptNo || issued.receiptNo || "";
          tx.update(paymentRef, { ...verification, ...issued });
        });
      } else {
        await updateDoc(doc(db, "payments", paymentId), verification);
      }
      // Tell the tenant (best effort: the update above already went through)
      notifyTenant(payment, {
        type: approved ? "success" : "error",
        title: approved ? "Payment received" : "Payment rejected",
        message: approved
          ? `Your ${formatCurrency(payment.amount)} rent payment for ${payment.periodMonth || "this month"} was verified. Thank you!${receiptNo ? ` Your receipt (No. ${receiptNo}) is ready: open the payment in your Payments tab to print or save it.` : ""}`
          : `Your ${formatCurrency(payment.amount)} payment for ${payment.periodMonth || "this month"} couldn't be verified. Please check the details or ask your landlord, then submit it again.`,
      });
      showToast(approved ? "Payment approved." : "Payment rejected.");
    } catch (error) {
      console.error("Error verifying payment:", error);
      showToast(approved ? "Failed to approve the payment. Please try again." : "Failed to reject the payment. Please try again.", "error");
    } finally {
      setProcessingPaymentId("");
    }
  };

  // ------------------------------------------------------------
  // RECORD PAYMENT
  // ------------------------------------------------------------

  // Money maths in whole centavos, so ₱0.10 + ₱0.20 never becomes ₱0.30000000000000004
  const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

  const handleOpenRecordPayment = () => {
    setPaymentForm({
      tenantId: "",
      amount: "",
      amountTouched: false, // false = use the suggested amount (the balance)
      paymentMethod: "Cash",
      periodMonth: currentPeriodValue,
      status: "Paid",
      statusTouched: false, // false = Paid / Partial follows the amount
      paymentDate: todayInput(),
      remarks: "",
    });
    setFormErrors({});
    setOpenRecordPayment(true);
  };

  const handleCloseRecordPayment = () => {
    if (saving) return;
    setOpenRecordPayment(false);
  };

  const handleFormChange = (event) => {
    const { name, value } = event.target;

    setFormErrors((prev) => {
      if (!prev[name] && !prev._form) return prev;
      const next = { ...prev };
      delete next[name];
      delete next._form;
      return next;
    });

    setPaymentForm((prev) => {
      const next = { ...prev, [name]: value };
      if (name === "amount") next.amountTouched = true;
      if (name === "status") next.statusTouched = true;
      // A different tenant or month has a different balance: go back to suggesting it
      if (name === "tenantId" || name === "periodMonth") {
        next.amountTouched = false;
        next.amount = "";
        next.statusTouched = false;
      }
      return next;
    });
  };

  // The selected tenant's payments (every month), read while the dialog is open,
  // so the balance is right for whichever month is being paid
  const [formTenantPayments, setFormTenantPayments] = useState({ tenantId: "", list: [] });
  useEffect(() => {
    if (!openRecordPayment || !paymentForm.tenantId || !currentUser?.uid) return undefined;
    const tenantId = paymentForm.tenantId;
    return onSnapshot(
      query(collection(db, "payments"), where("ownerUid", "==", currentUser.uid), where("tenantId", "==", tenantId)),
      (snapshot) => setFormTenantPayments({ tenantId, list: snapshot.docs.map((d) => ({ id: d.id, ...d.data() })) }),
      (error) => {
        console.error("Error loading the tenant's payments:", error);
        setFormTenantPayments({ tenantId, list: [] });
      }
    );
  }, [openRecordPayment, paymentForm.tenantId, currentUser]);

  const selectedFormTenant = normalizedTenants.find((t) => t.id === paymentForm.tenantId);
  const formInfoLoading = Boolean(selectedFormTenant) && formTenantPayments.tenantId !== paymentForm.tenantId;

  // Rent, received and balance for the tenant and month chosen in the form
  const selectedFormInfo = useMemo(() => {
    if (!selectedFormTenant || formInfoLoading) return null;
    const period = String(paymentForm.periodMonth || "").trim().toLowerCase();
    const forPeriod = formTenantPayments.list.filter((p) => String(p.periodMonth || "").trim().toLowerCase() === period);
    const sum = (list) => round2(list.reduce((t, p) => t + Number(p.amount || 0), 0));
    const statusOf = (p) => String(p.status || "").toLowerCase();
    const rent = round2(selectedFormTenant.monthlyRent);
    const received = sum(forPeriod.filter((p) => ["paid", "partial"].includes(statusOf(p))));
    const pending = forPeriod.filter((p) => statusOf(p) === "pending");
    return {
      rent,
      received,
      balance: round2(Math.max(rent - received, 0)),
      pendingAmount: sum(pending),
      pendingCount: pending.length,
    };
  }, [selectedFormTenant, formInfoLoading, formTenantPayments, paymentForm.periodMonth]);

  // What the form actually uses: the owner's own entries, or the suggestions
  const suggestedAmount = selectedFormInfo && selectedFormInfo.balance > 0 ? String(selectedFormInfo.balance) : "";
  const effectiveAmount = paymentForm.amountTouched ? paymentForm.amount : suggestedAmount;
  const amountNumber = round2(effectiveAmount);
  const autoStatus = selectedFormInfo && amountNumber > 0 && amountNumber < selectedFormInfo.balance ? "Partial" : "Paid";
  const effectiveStatus = paymentForm.statusTouched ? paymentForm.status : autoStatus;
  const balanceAfter = selectedFormInfo && effectiveStatus !== "Pending" ? round2(Math.max(selectedFormInfo.balance - amountNumber, 0)) : null;
  const overBy = selectedFormInfo && effectiveStatus !== "Pending" ? round2(amountNumber - selectedFormInfo.balance) : 0;

  const validateForm = () => {
    const e = {};
    if (!paymentForm.tenantId) e.tenantId = "Select a tenant.";

    const raw = String(effectiveAmount).trim();
    const amount = Number(raw);
    if (raw === "" || Number.isNaN(amount) || amount <= 0) e.amount = "Enter an amount greater than 0.";
    else if (amount > MAX_AMOUNT) e.amount = "That amount looks too large.";
    else if (!/^\d+(\.\d{1,2})?$/.test(raw)) e.amount = "Use at most 2 decimal places.";

    if (!paymentForm.periodMonth) e.periodMonth = "Select the month this payment is for.";

    if (!paymentForm.paymentDate) e.paymentDate = "Choose the payment date.";
    else if (Number.isNaN(new Date(`${paymentForm.paymentDate}T12:00:00`).getTime())) e.paymentDate = "Enter a valid date.";
    else if (paymentForm.paymentDate > todayInput()) e.paymentDate = "The payment date can't be in the future.";

    if (paymentForm.remarks.length > 300) e.remarks = "Keep notes under 300 characters.";
    return e;
  };

  const handleRecordPayment = async () => {
    if (saving) return;

    if (!currentUser?.uid) {
      showToast("You must be logged in to record a payment.", "error");
      return;
    }

    const errs = validateForm();
    setFormErrors(errs);
    if (Object.keys(errs).length > 0) return;

    const selectedTenant = normalizedTenants.find((tenant) => tenant.id === paymentForm.tenantId);
    if (!selectedTenant) {
      setFormErrors({ tenantId: "That tenant could not be found." });
      return;
    }

    const amount = round2(effectiveAmount);
    const status = effectiveStatus;

    setSaving(true);
    try {
      const payload = {
        tenantId: selectedTenant.id,
        tenantName: selectedTenant.fullName,
        propertyId: selectedTenant.propertyId || selectedTenant.assignedPropertyId || "",
        propertyName: selectedTenant.propertyName || "Dormitory",
        roomNumber: selectedTenant.roomId || (selectedTenant.roomNumber !== "Unassigned" ? selectedTenant.roomNumber : "") || "N/A",
        amount,
        paymentMethod: paymentForm.paymentMethod,
        periodMonth: paymentForm.periodMonth,
        status,
        verificationStatus: status === "Pending" ? "Pending" : "Approved",
        remarks: paymentForm.remarks.trim(),
        ownerUid: currentUser.uid,
        recordedBy: currentUser.uid,
        recordedByRole: "owner",
        paymentDate: new Date(`${paymentForm.paymentDate}T12:00:00`),
        createdAt: serverTimestamp(),
      };
      const ref = doc(collection(db, "payments"));
      let receiptNo = "";
      await runTransaction(db, async (tx) => {
        // Money received (Paid or Partial) is a confirmed receipt: number it
        const issued = isReceiptable(status) ? await reserveReceiptNo(tx, db, currentUser.uid) : {};
        receiptNo = issued.receiptNo || "";
        tx.set(ref, { ...payload, ...issued });
      });

      if (status !== "Pending") {
        notifyTenant(
          { id: ref.id, tenantId: selectedTenant.id },
          {
            type: "success",
            title: "Payment recorded",
            message:
              status === "Paid"
                ? `Your landlord recorded a ${formatCurrency(amount)} rent payment for ${paymentForm.periodMonth}. Thank you!${receiptNo ? ` Your receipt (No. ${receiptNo}) is ready: open the payment in your Payments tab to print or save it.` : ""}`
                : `Your landlord recorded a ${formatCurrency(amount)} partial payment for ${paymentForm.periodMonth}.${balanceAfter > 0 ? ` ${formatCurrency(balanceAfter)} is still due for that month.` : ""}${receiptNo ? ` Your receipt (No. ${receiptNo}) is in your Payments tab.` : ""}`,
          }
        );
      }

      setOpenRecordPayment(false);
      showToast(`Payment recorded for ${selectedTenant.fullName}.`);
    } catch (error) {
      console.error("Error recording payment:", error);
      setFormErrors({ _form: "Failed to record payment. Please try again." });
    } finally {
      setSaving(false);
    }
  };

  // Current tenants first; former tenants can't be picked
  const recordableTenants = [...normalizedTenants]
    .filter((t) => !["inactive", "archived", "deactivated"].includes(String(t.status || "").trim().toLowerCase()))
    .sort((a, b) => a.fullName.localeCompare(b.fullName));

  // ------------------------------------------------------------
  // TENANT ROW (grid on laptops, compact card on phones)
  // ------------------------------------------------------------

  const COLS = "minmax(0, 1.7fr) minmax(0, 0.9fr) minmax(0, 0.9fr) minmax(0, 0.9fr) 112px 132px";

  const rowActions = (tenant, info) => {
    const canReceipt = info.latestPayment && isReceiptable(getPaymentStatus(info.latestPayment));
    return (
      <Box sx={{ display: "flex", gap: 0.25, justifyContent: { xs: "flex-end", lg: "flex-start" } }}>
        <Tooltip title={info.latestPayment ? "View latest payment" : "No payment this month"}>
          <span>
            <IconButton aria-label="View latest payment" disabled={!info.latestPayment} onClick={() => setSelectedPayment(info.latestPayment)} sx={{ width: 38, height: 38 }}>
              <VisibilityIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title="Payment history">
          <IconButton aria-label="Payment history" onClick={() => setHistoryTenant(tenant)} sx={{ width: 38, height: 38 }}>
            <HistoryIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title={canReceipt ? "Print receipt" : "Receipts are for paid or partial payments"}>
          <span>
            <IconButton aria-label="Print receipt" disabled={!canReceipt} onClick={() => printReceipt(info.latestPayment, tenant)} sx={{ width: 38, height: 38 }}>
              <PrintIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
      </Box>
    );
  };

  const initialsOf = (name) =>
    String(name || "?").split(" ").filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("");

  const renderTenantRow = ({ tenant, info }) => {
    const dim = info.status === "Not due";
    return (
      <Box
        key={tenant.id}
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "minmax(0, 1fr) auto", lg: COLS },
          alignItems: "center",
          columnGap: 2,
          rowGap: 0.75,
          px: { xs: 2, sm: 2.5 },
          py: 1.25,
          transition: "background-color .15s",
          "&:hover": { bgcolor: "action.hover" },
        }}
      >
        <Box sx={{ ...row, gap: 1.25, minWidth: 0, opacity: dim ? 0.6 : 1 }}>
          <Avatar sx={{ width: 34, height: 34, fontSize: 13, fontWeight: 800, fontFamily: '"Inter", sans-serif', bgcolor: dim ? "action.selected" : "primary.main", color: "#fff" }}>
            {initialsOf(tenant.fullName)}
          </Avatar>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="subtitle2" sx={{ fontWeight: 700 }} noWrap>
              {tenant.fullName}
            </Typography>
            <Typography
              variant="caption"
              noWrap
              component="div"
              sx={{ fontWeight: info.status === "Overdue" ? 700 : 400, color: info.status === "Overdue" ? "error.main" : "text.secondary" }}
            >
              {!countsTowardRent(tenant)
                ? String(tenant.status).toLowerCase().startsWith("pending") ? "Pending onboarding" : tenant.status
                : info.dueText || " "}
            </Typography>
          </Box>
        </Box>

        {/* Phones: status top right */}
        <Box sx={{ display: { xs: "block", lg: "none" } }}>
          <StatusPill status={info.status} />
        </Box>

        {/* Phones: one quiet money line */}
        <Typography variant="body2" color="text.secondary" sx={{ display: { xs: "block", lg: "none" }, gridColumn: "1 / -1", pl: "46px", opacity: dim ? 0.6 : 1 }}>
          Rent {formatCompact(info.rent)} · Paid{" "}
          <Box component="span" sx={{ color: "text.primary", fontWeight: 600 }}>{formatCompact(info.paidAmount)}</Box>
          {" "}· Balance{" "}
          <Box component="span" sx={{ color: info.balance > 0 ? "warning.dark" : "text.primary", fontWeight: 600 }}>
            {formatCompact(info.balance)}
          </Box>
        </Typography>

        {/* Laptops */}
        <Typography variant="body2" sx={{ display: { xs: "none", lg: "block" }, opacity: dim ? 0.6 : 1 }}>{formatCompact(info.rent)}</Typography>
        <Typography variant="body2" sx={{ display: { xs: "none", lg: "block" }, fontWeight: 600, opacity: dim ? 0.6 : 1 }}>
          {formatCompact(info.paidAmount)}
        </Typography>
        <Typography variant="body2" sx={{ display: { xs: "none", lg: "block" }, fontWeight: 700, opacity: dim ? 0.6 : 1, color: info.balance > 0 ? "warning.dark" : "text.secondary" }}>
          {formatCompact(info.balance)}
        </Typography>
        <Box sx={{ display: { xs: "none", lg: "block" } }}>
          <StatusPill status={info.status} />
        </Box>

        {/* Actions: own line on phones, last column on laptops */}
        <Box sx={{ gridColumn: { xs: "1 / -1", lg: "auto" } }}>{rowActions(tenant, info)}</Box>
      </Box>
    );
  };

  const columnHeader = (
    <Box
      sx={{
        display: { xs: "none", lg: "grid" },
        gridTemplateColumns: COLS,
        columnGap: 2,
        px: 2.5,
        py: 1,
        borderBottom: "1px solid",
        borderColor: "divider",
        "& > *": { fontWeight: 700, color: "text.secondary", fontSize: "0.72rem", letterSpacing: ".06em", textTransform: "uppercase" },
      }}
    >
      <Box>Tenant</Box>
      <Box>Rent</Box>
      <Box>Paid</Box>
      <Box>Balance</Box>
      <Box>Status</Box>
      <Box>Details</Box>
    </Box>
  );

  // ------------------------------------------------------------
  // THIS MONTH AT A GLANCE (same per-tenant info as the rows)
  // ------------------------------------------------------------

  const tenantInfos = normalizedTenants.map((tenant) => ({ tenant, info: getTenantPaymentInfo(tenant) }));
  // Only tenants who actually owe rent this month
  const expectedRent = tenantInfos.reduce((total, { info }) => total + info.expected, 0);
  const stillToCollect = tenantInfos.reduce((total, { info }) => total + info.balance, 0);
  const overdueTenants = tenantInfos.filter(({ info }) => info.status === "Overdue").length;
  const statusCounts = tenantInfos.reduce((acc, { info }) => ({ ...acc, [info.status]: (acc[info.status] || 0) + 1 }), {});
  const collectionRate = expectedRent > 0 ? Math.min(100, Math.round((totalRentCollectedThisMonth / expectedRent) * 100)) : null;
  const monthName = today.toLocaleDateString("en-US", { month: "long" });

  // ------------------------------------------------------------
  // LOADING
  // ------------------------------------------------------------

  if (loading && currentUser?.uid) {
    return (
      <Box sx={{ minWidth: 0 }}>
        <Skeleton variant="rounded" height={170} sx={{ borderRadius: "22px", mb: 2.5 }} />
        <Skeleton variant="rounded" height={46} sx={{ borderRadius: "14px", mb: 2.5 }} />
        {[0, 1].map((i) => (
          <Paper key={i} elevation={0} sx={{ ...groupShellSx, p: 2, mb: 2 }}>
            <Skeleton width="35%" height={28} />
            <Skeleton variant="rounded" height={52} sx={{ mt: 1.5, borderRadius: "10px" }} />
            <Skeleton variant="rounded" height={52} sx={{ mt: 1, borderRadius: "10px" }} />
          </Paper>
        ))}
      </Box>
    );
  }

  // ------------------------------------------------------------
  // UI
  // ------------------------------------------------------------

  const needsAccountSetup = properties.length > 0 && propertiesWithoutAccounts.length > 0;
  const toReview = pendingVerificationPayments.length;

  const headerTiles = [
    {
      label: `Collected · ${monthName}`,
      icon: <PaymentsOutlinedIcon />,
      value: formatCompact(totalRentCollectedThisMonth),
      sub: collectionRate !== null ? `${collectionRate}% of ${formatCompact(expectedRent)}` : "No rent expected yet",
      progress: collectionRate,
    },
    { label: "Still to collect", icon: <AccountBalanceWalletOutlinedIcon />, value: formatCompact(stillToCollect), sub: "This month's balances", accent: stillToCollect > 0 ? "warning.dark" : undefined },
    { label: "To review", icon: <PendingActionsOutlinedIcon />, value: toReview, sub: toReview === 1 ? "payment submitted" : "payments submitted", accent: toReview > 0 ? "info.dark" : undefined },
    { label: "Overdue", icon: <ErrorOutlineRoundedIcon />, value: overdueTenants, sub: overdueTenants === 1 ? "tenant past due" : "tenants past due", accent: overdueTenants > 0 ? "error.main" : undefined },
  ];

  return (
    <Box sx={{ minWidth: 0 }}>
      {/* HEADER: same pattern as Properties / Tenants */}
      <Paper elevation={0} component="section" sx={{ ...cardSx, borderRadius: "22px", position: "relative", overflow: "hidden", p: { xs: 2, sm: 3 }, mb: { xs: 2, sm: 2.5 } }}>
        <Box aria-hidden sx={{ position: "absolute", top: -180, right: -120, width: 380, height: 380, borderRadius: "50%", background: "rgba(255,69,0,.10)", filter: "blur(70px)", pointerEvents: "none" }} />
        {/* The main action, visible on every screen size (full width on phones) */}
        <Box sx={{ position: "relative", display: "flex", flexDirection: { xs: "column", sm: "row" }, alignItems: { xs: "stretch", sm: "center" }, justifyContent: "space-between", gap: { xs: 1.5, sm: 2 }, mb: { xs: 2, sm: 2.5 } }}>
          <Typography color="text.secondary" sx={{ minWidth: 0, fontSize: { xs: 14, sm: 15 } }}>
            Rent collection for <strong>{currentPeriodValue}</strong>
          </Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleOpenRecordPayment}
            sx={{ flexShrink: 0, fontWeight: 700, borderRadius: "10px", minHeight: 44, boxShadow: "0 10px 22px -14px rgba(255,69,0,.9)" }}
          >
            Record payment
          </Button>
        </Box>

        <Box sx={{ position: "relative", display: "grid", gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", md: "repeat(4, minmax(0, 1fr))" }, gap: { xs: 1, sm: 1.5 } }}>
          {headerTiles.map((t) => (
            <Box key={t.label} sx={{ minWidth: 0, display: "flex", alignItems: "flex-start", gap: 1.25, p: { xs: 1.25, sm: 1.75 }, borderRadius: "14px", bgcolor: (th) => alpha(th.palette.background.paper, 0.55) }}>
              <Box sx={{ width: { xs: 32, sm: 38 }, height: { xs: 32, sm: 38 }, flexShrink: 0, borderRadius: "10px", display: "grid", placeItems: "center", bgcolor: "#fff", color: "primary.main", "& svg": { fontSize: { xs: 18, sm: 20 } } }}>
                {t.icon}
              </Box>
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography variant="caption" color="text.secondary" noWrap sx={{ fontWeight: 600, display: "block" }}>
                  {t.label}
                </Typography>
                <Typography noWrap sx={{ fontFamily: '"Inter", sans-serif', fontWeight: 800, letterSpacing: "-0.02em", fontSize: { xs: "1.15rem", sm: "1.4rem" }, lineHeight: 1.2, color: t.accent || "text.primary" }}>
                  {t.value}
                </Typography>
                {t.progress !== undefined && t.progress !== null && (
                  <LinearProgress
                    variant="determinate"
                    value={t.progress}
                    color={t.progress >= 100 ? "success" : "primary"}
                    sx={{ my: 0.6, height: 5, borderRadius: 3, bgcolor: (th) => alpha(th.palette.text.primary, 0.08) }}
                  />
                )}
                <Typography variant="caption" color="text.secondary" noWrap component="div">
                  {t.sub}
                </Typography>
              </Box>
            </Box>
          ))}
        </Box>
      </Paper>

      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v)}
        sx={{
          mb: { xs: 2, sm: 2.5 },
          minHeight: 46,
          borderBottom: "1px solid",
          borderColor: "divider",
          "& .MuiTabs-indicator": { height: 3, borderRadius: "3px 3px 0 0" },
          "& .MuiTab-root": { minWidth: 0, minHeight: 46, px: 0, fontWeight: 700, fontSize: 14.5, textTransform: "none", color: "text.secondary" },
          "& .MuiTab-root:not(:last-of-type)": { mr: 3.5 },
          "& .MuiTab-root.Mui-selected": { color: "text.primary" },
        }}
      >
        <Tab
          label={
            <Box sx={{ ...row, gap: 0.75 }}>
              Rent
              {toReview > 0 && (
                <Box component="span" sx={{ px: 0.75, borderRadius: 99, fontSize: 11.5, fontWeight: 800, bgcolor: (t) => alpha(t.palette.info.main, 0.14), color: "info.dark" }}>
                  {toReview}
                </Box>
              )}
            </Box>
          }
        />
        <Tab
          label={
            <Box sx={{ ...row, gap: 0.75 }}>
              Payment accounts
              {needsAccountSetup && <Box component="span" aria-label="Needs setup" sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: "warning.main" }} />}
            </Box>
          }
        />
      </Tabs>

      {/* ======================================================
          TAB 0 — RENT
      ====================================================== */}
      <Box sx={{ display: tab === 0 ? "block" : "none" }}>
        {needsAccountSetup && (
          <Alert
            severity="warning"
            sx={{ mb: 2.5, borderRadius: "14px", alignItems: "center" }}
            action={
              <Button color="inherit" size="small" onClick={() => setTab(1)} sx={{ fontWeight: 700, whiteSpace: "nowrap" }}>
                Set up
              </Button>
            }
          >
            Tenants can't see where to send rent
            {propertiesWithoutAccounts.length === 1
              ? ` at ${propertiesWithoutAccounts[0].propertyName || propertiesWithoutAccounts[0].name || "your property"}`
              : ` at ${propertiesWithoutAccounts.length} of your properties`}{" "}
            yet.
          </Alert>
        )}

        {/* PENDING PAYMENT VERIFICATION */}
        {toReview > 0 && (
          <Box sx={{ mb: { xs: 3, sm: 3.5 } }}>
            <SectionTitle
              title="Needs your review"
              sub="Payments submitted by tenants. Check the proof, then approve or reject."
              right={<Chip size="small" label={toReview} sx={{ fontWeight: 800, bgcolor: (t) => alpha(t.palette.info.main, 0.14), color: "info.dark" }} />}
            />

            <Box sx={{ display: "flex", flexDirection: "column", gap: 1.25 }}>
              {pendingVerificationPayments.map((payment) => {
                const isProcessing = processingPaymentId === payment.id;
                return (
                  <Paper key={payment.id} elevation={0} sx={{ ...cardSx, p: { xs: 1.75, sm: 2 }, position: "relative", overflow: "hidden" }}>
                    <Box aria-hidden sx={{ position: "absolute", left: 0, top: 12, bottom: 12, width: 3, borderRadius: "0 3px 3px 0", bgcolor: "info.main" }} />
                    <Box sx={{ display: "flex", flexDirection: { xs: "column", md: "row" }, alignItems: { md: "center" }, gap: { xs: 1.5, md: 2.5 } }}>
                      {/* proof thumbnail */}
                      {payment.proofUrl ? (
                        <Box component="a" href={payment.proofUrl} target="_blank" rel="noopener noreferrer" aria-label="Open proof of payment" sx={{ display: { xs: "none", sm: "block" }, flexShrink: 0 }}>
                          <Box component="img" src={payment.proofUrl} alt="Proof of payment" loading="lazy" sx={{ display: "block", width: 72, height: 72, objectFit: "cover", borderRadius: "12px", border: "1px solid", borderColor: "divider" }} />
                        </Box>
                      ) : null}

                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Box sx={{ ...row, justifyContent: "space-between", gap: 1.5 }}>
                          <Typography sx={{ fontWeight: 800 }} noWrap>
                            {payment.tenantName || "Unnamed Tenant"}
                          </Typography>
                          <Typography sx={{ fontFamily: '"Inter", sans-serif', fontWeight: 800, fontSize: "1.15rem", flexShrink: 0, display: { md: "none" } }}>
                            {formatCurrency(payment.amount)}
                          </Typography>
                        </Box>
                        <Typography variant="body2" color="text.secondary" noWrap>
                          Room {payment.roomNumber || "—"} · {payment.propertyName || "Dormitory"}
                        </Typography>
                        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75, mt: 0.75 }}>
                          {[payment.periodMonth || "No billing month", payment.paymentMethod || "Unknown method", formatDate(payment)].map((t) => (
                            <Box key={t} component="span" sx={{ px: 0.9, py: 0.25, borderRadius: "6px", fontSize: 12, fontWeight: 700, bgcolor: (th) => alpha(th.palette.background.paper, 0.75) }}>
                              {t}
                            </Box>
                          ))}
                        </Box>
                        {(payment.referenceNumber || payment.remarks || payment.recordedByName) && (
                          <Typography variant="caption" color="text.secondary" component="div" sx={{ mt: 0.75, overflowWrap: "anywhere" }}>
                            {[
                              payment.referenceNumber && `Ref. ${payment.referenceNumber}`,
                              payment.remarks && `“${payment.remarks}”`,
                              payment.recordedByName && `Recorded by ${payment.recordedByName}${payment.recordedByRole ? ` (${payment.recordedByRole})` : ""}`,
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </Typography>
                        )}
                        {payment.proofUrl && (
                          <Box component="a" href={payment.proofUrl} target="_blank" rel="noopener noreferrer" sx={{ display: { xs: "inline-block", sm: "none" }, mt: 1 }}>
                            <Box component="img" src={payment.proofUrl} alt="Proof of payment" loading="lazy" sx={{ display: "block", width: 120, height: 120, objectFit: "cover", borderRadius: "12px", border: "1px solid", borderColor: "divider" }} />
                          </Box>
                        )}
                      </Box>

                      <Typography sx={{ fontFamily: '"Inter", sans-serif', fontWeight: 800, fontSize: "1.25rem", flexShrink: 0, display: { xs: "none", md: "block" } }}>
                        {formatCurrency(payment.amount)}
                      </Typography>

                      <Box sx={{ display: "flex", gap: 1, flexShrink: 0 }}>
                        <Button
                          variant="contained"
                          color="success"
                          disableElevation
                          disabled={isProcessing}
                          onClick={() => handleVerifyPayment(payment.id, true)}
                          startIcon={isProcessing ? <CircularProgress size={16} color="inherit" /> : <CheckIcon />}
                          sx={{ flex: { xs: 1, md: "none" }, fontWeight: 700, minHeight: 42, borderRadius: "10px" }}
                        >
                          {isProcessing ? "Updating…" : "Approve"}
                        </Button>
                        <Button
                          variant="outlined"
                          color="error"
                          disabled={isProcessing}
                          onClick={() => setRejectTarget(payment)}
                          sx={{ flex: { xs: 1, md: "none" }, fontWeight: 700, minHeight: 42, borderRadius: "10px" }}
                        >
                          Reject
                        </Button>
                      </Box>
                    </Box>
                  </Paper>
                );
              })}
            </Box>
          </Box>
        )}

        {/* RENT BY ROOM */}
        <SectionTitle title="Rent by room" sub={`Who has paid for ${currentPeriodValue}`} />

        {normalizedTenants.length > 0 && (
          <Box sx={{ display: "flex", flexDirection: { xs: "column", md: "row" }, alignItems: { md: "center" }, gap: 1.25, mb: 2 }}>
            <Paper
              elevation={0}
              sx={{
                ...cardSx,
                ...row,
                gap: 1,
                px: 1.5,
                height: 44,
                borderRadius: "10px",
                flex: { md: "0 1 320px" },
                minWidth: 0,
                transition: "border-color .15s, box-shadow .15s",
                "&:focus-within": { borderColor: "primary.main", boxShadow: "0 0 0 3px rgba(255,69,0,.12)" },
              }}
            >
              <SearchIcon sx={{ color: "text.secondary" }} />
              <InputBase fullWidth placeholder="Search tenant or room" value={search} onChange={(e) => setSearch(e.target.value)} inputProps={{ "aria-label": "Search tenants" }} />
              {search && (
                <IconButton size="small" aria-label="Clear search" onClick={() => setSearch("")}>
                  <CloseIcon fontSize="small" />
                </IconButton>
              )}
            </Paper>

            {/* Segmented status filter with counts */}
            <Box
              role="group"
              aria-label="Filter by status"
              sx={{ display: "flex", gap: 0.5, p: 0.5, ...cardSx, borderRadius: "14px", overflowX: "auto", scrollbarWidth: "none", "&::-webkit-scrollbar": { display: "none" } }}
            >
              {STATUS_FILTERS.filter((f) => f === "All" || f === statusFilter || statusCounts[f] > 0).map((f) => {
                const on = statusFilter === f;
                const count = f === "All" ? normalizedTenants.length : statusCounts[f] || 0;
                return (
                  <Box
                    key={f}
                    component="button"
                    type="button"
                    aria-pressed={on}
                    onClick={() => setStatusFilter(f)}
                    sx={{
                      ...row,
                      gap: 0.6,
                      px: 1.4,
                      height: 34,
                      border: 0,
                      borderRadius: "10px",
                      cursor: "pointer",
                      flexShrink: 0,
                      fontFamily: '"Inter", sans-serif',
                      fontWeight: 700,
                      fontSize: 13.5,
                      whiteSpace: "nowrap",
                      color: on ? "primary.main" : "text.secondary",
                      bgcolor: on ? "rgba(255,69,0,.1)" : "transparent",
                      "&:hover": { color: on ? "primary.main" : "text.primary" },
                      "&:focus-visible": { outline: "2px solid", outlineColor: "primary.main", outlineOffset: 1 },
                    }}
                  >
                    {f}
                    <Box component="span" sx={{ fontSize: 12, opacity: 0.7 }}>{count}</Box>
                  </Box>
                );
              })}
            </Box>
          </Box>
        )}

        {propertyGroups.length === 0 ? (
          <Paper elevation={0} sx={{ ...groupShellSx, borderStyle: "dashed", py: 7, px: 3, textAlign: "center" }}>
            <Box sx={{ width: 64, height: 64, borderRadius: "14px", mx: "auto", mb: 2, ...row, justifyContent: "center", bgcolor: "rgba(255, 69, 0, 0.10)" }}>
              <PaymentsOutlinedIcon sx={{ fontSize: 32, color: "primary.main" }} />
            </Box>
            {filtersActive ? (
              <>
                <Typography sx={{ fontWeight: 700, mb: 0.5 }}>No tenants match</Typography>
                <Button onClick={() => { setSearch(""); setStatusFilter("All"); }} sx={{ fontWeight: 700, textTransform: "none" }}>
                  Clear filters
                </Button>
              </>
            ) : (
              <>
                <Typography sx={{ fontWeight: 700, mb: 0.5 }}>Nothing to collect yet</Typography>
                <Typography variant="body2" color="text.secondary">
                  Register tenants and assign them rooms to track rent here.
                </Typography>
              </>
            )}
          </Paper>
        ) : (
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
            {propertyGroups.map((prop, index) => {
              const pct = prop.expected > 0 ? Math.min(100, Math.round((prop.collected / prop.expected) * 100)) : 0;
              return (
                <Accordion key={`${prop.key}-${filtersActive}`} defaultExpanded={index === 0 || filtersActive} disableGutters elevation={0} sx={groupShellSx}>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ px: { xs: 2, sm: 2.5 }, "& .MuiAccordionSummary-content": { alignItems: "center", my: 1.5, minWidth: 0 } }}>
                    <Box sx={{ ...row, gap: 1.5, minWidth: 0, flex: 1 }}>
                      <Box sx={{ width: 38, height: 38, borderRadius: "10px", flexShrink: 0, ...row, justifyContent: "center", bgcolor: "rgba(255, 69, 0, 0.10)" }}>
                        <ApartmentOutlinedIcon color="primary" fontSize="small" />
                      </Box>
                      <Box sx={{ minWidth: 0, flex: 1 }}>
                        <Typography sx={{ fontFamily: '"Inter", sans-serif', fontWeight: 800, lineHeight: 1.25 }} noWrap>
                          {prop.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" noWrap component="div">
                          {prop.tenantCount} {prop.tenantCount === 1 ? "tenant" : "tenants"} · {formatCompact(prop.collected)} of {formatCompact(prop.expected)} collected
                        </Typography>
                      </Box>
                      <Box sx={{ width: { xs: 48, sm: 120 }, flexShrink: 0, mr: 1 }}>
                        <LinearProgress
                          variant="determinate"
                          value={pct}
                          color={pct >= 100 ? "success" : "primary"}
                          sx={{ height: 6, borderRadius: 3, bgcolor: (t) => alpha(t.palette.text.primary, 0.08) }}
                        />
                        <Typography variant="caption" sx={{ display: { xs: "none", sm: "block" }, mt: 0.25, textAlign: "right", fontWeight: 700 }}>
                          {pct}%
                        </Typography>
                      </Box>
                    </Box>
                  </AccordionSummary>

                  <AccordionDetails sx={{ p: 0, borderTop: "1px solid", borderColor: "divider" }}>
                    {columnHeader}
                    {prop.rooms.map((room, roomIndex) => (
                      <Box key={room.roomNumber}>
                        {/* Room sub-header */}
                        <Box
                          sx={{
                            ...row,
                            justifyContent: "space-between",
                            gap: 2,
                            px: { xs: 2, sm: 2.5 },
                            py: 0.75,
                            bgcolor: (t) => alpha(t.palette.background.paper, 0.45),
                            borderTop: roomIndex === 0 ? "none" : "1px solid",
                            borderBottom: "1px solid",
                            borderColor: "divider",
                          }}
                        >
                          <Typography variant="body2" sx={{ fontWeight: 800 }}>
                            {room.roomNumber === "Unassigned" ? "No room yet" : `Room ${room.roomNumber}`}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                            {formatCompact(room.collected)} / {formatCompact(room.expected)}
                          </Typography>
                        </Box>
                        {room.tenants.map((entry, i) => (
                          <Fragment key={entry.tenant.id}>
                            {i > 0 && <Divider />}
                            {renderTenantRow(entry)}
                          </Fragment>
                        ))}
                      </Box>
                    ))}
                  </AccordionDetails>
                </Accordion>
              );
            })}
          </Box>
        )}
      </Box>

      {/* ======================================================
          TAB 1 — PAYMENT ACCOUNTS (stays mounted so edits survive tab switches)
      ====================================================== */}
      <Box sx={{ display: tab === 1 ? "block" : "none" }}>
        <PaymentAccountsPanel properties={properties} showToast={showToast} />
      </Box>

      {/* ======================================================
          REJECT CONFIRMATION
      ====================================================== */}
      <Dialog open={Boolean(rejectTarget)} onClose={() => setRejectTarget(null)} maxWidth="xs" fullWidth slotProps={{ paper: { sx: dialogPaperSx } }}>
        <DialogTitle sx={{ fontFamily: '"Inter", sans-serif', fontWeight: 800 }}>Reject this payment?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            {rejectTarget
              ? `${rejectTarget.tenantName || "This tenant"}'s ${formatCurrency(rejectTarget.amount)} payment will be marked as rejected and won't count toward rent collected. They'll be notified.`
              : ""}
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button color="inherit" onClick={() => setRejectTarget(null)} sx={{ fontWeight: 700 }}>
            Keep pending
          </Button>
          <Button
            color="error"
            variant="contained"
            disableElevation
            onClick={() => {
              const id = rejectTarget?.id;
              setRejectTarget(null);
              handleVerifyPayment(id, false);
            }}
            sx={{ fontWeight: 700, borderRadius: "10px" }}
          >
            Reject payment
          </Button>
        </DialogActions>
      </Dialog>

      {/* ======================================================
          PAYMENT DETAILS
      ====================================================== */}
      <Dialog open={Boolean(selectedPayment)} onClose={() => setSelectedPayment(null)} fullWidth maxWidth="sm" slotProps={{ paper: { sx: dialogPaperSx } }}>
        {selectedPayment && (
          <>
            <Box sx={{ px: { xs: 2, sm: 3 }, pt: 2.5, pb: 2, borderBottom: "1px solid", borderColor: "divider" }}>
              <Box sx={{ ...row, justifyContent: "space-between", gap: 1 }}>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                  Payment · {selectedPayment.periodMonth || "No billing month"}
                </Typography>
                <IconButton onClick={() => setSelectedPayment(null)} size="small" aria-label="Close payment details" sx={{ bgcolor: "action.hover" }}>
                  <CloseIcon fontSize="small" />
                </IconButton>
              </Box>
              <Box sx={{ ...row, gap: 1.5, flexWrap: "wrap" }}>
                <Typography sx={{ fontFamily: '"Inter", sans-serif', fontWeight: 900, fontSize: "1.8rem", letterSpacing: "-0.02em" }}>
                  {formatCurrency(selectedPayment.amount)}
                </Typography>
                <StatusPill status={selectedPayment.status || "—"} />
              </Box>
              <Typography variant="body2" color="text.secondary">
                {selectedPayment.tenantName || "—"} · Room {selectedPayment.roomNumber || "—"} · {selectedPayment.propertyName || "—"}
              </Typography>
            </Box>
            <DialogContent sx={{ pt: 2 }}>
              <Box sx={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 1.25 }}>
                {[
                  ["Payment date", formatDate(selectedPayment)],
                  ["Method", selectedPayment.paymentMethod || "—"],
                  ["Reference no.", selectedPayment.referenceNumber || "—"],
                  ["Receipt no.", selectedPayment.receiptNo || "—"],
                ].map(([label, value]) => (
                  <Box key={label} sx={{ p: 1.25, borderRadius: "10px", bgcolor: (t) => alpha(t.palette.background.paper, 0.5), minWidth: 0 }}>
                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, display: "block" }}>{label}</Typography>
                    <Typography sx={{ fontWeight: 700, fontSize: "0.92rem", overflowWrap: "anywhere" }}>{value}</Typography>
                  </Box>
                ))}
              </Box>
              {selectedPayment.remarks && (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1.5, overflowWrap: "anywhere" }}>
                  <strong>Remarks:</strong> {selectedPayment.remarks}
                </Typography>
              )}
              {selectedPayment.proofUrl && (
                <Box component="a" href={selectedPayment.proofUrl} target="_blank" rel="noopener noreferrer" sx={{ display: "block", mt: 2 }}>
                  <Typography variant="caption" color="text.secondary" component="div" sx={{ mb: 0.5, fontWeight: 600 }}>Proof of payment</Typography>
                  <Box component="img" src={selectedPayment.proofUrl} alt="Proof of payment" loading="lazy" sx={{ display: "block", width: "100%", maxHeight: 320, objectFit: "contain", borderRadius: "12px", border: "1px solid", borderColor: "divider", bgcolor: "action.hover" }} />
                </Box>
              )}
            </DialogContent>
            <DialogActions sx={{ p: 2, gap: 1, borderTop: "1px solid", borderColor: "divider" }}>
              <Button onClick={() => setSelectedPayment(null)} color="inherit" sx={{ fontWeight: 700 }}>
                Close
              </Button>
              <Button
                startIcon={<PrintIcon />}
                variant="contained"
                disableElevation
                disabled={!isReceiptable(getPaymentStatus(selectedPayment))}
                onClick={() => printReceipt(selectedPayment)}
                sx={{ fontWeight: 700, borderRadius: "10px" }}
              >
                Print receipt
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      {/* ======================================================
          TENANT PAYMENT HISTORY
      ====================================================== */}
      <Dialog open={Boolean(historyTenant)} onClose={() => setHistoryTenant(null)} fullWidth maxWidth="sm" slotProps={{ paper: { sx: dialogPaperSx } }}>
        <DialogTitle sx={{ ...row, justifyContent: "space-between", gap: 1, fontFamily: '"Inter", sans-serif', fontWeight: 800 }}>
          <Box component="span" sx={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            Payment history{historyTenant ? ` · ${historyTenant.fullName}` : ""}
          </Box>
          <IconButton onClick={() => setHistoryTenant(null)} size="small" aria-label="Close payment history" sx={{ bgcolor: "action.hover" }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers sx={{ p: 0 }}>
          {historyLoading ? (
            <Box sx={{ py: 4, display: "grid", placeItems: "center" }}>
              <CircularProgress size={26} />
            </Box>
          ) : paymentHistoryForTenant.length === 0 ? (
            <Typography color="text.secondary" sx={{ py: 4, textAlign: "center" }}>
              No payments recorded for this tenant yet.
            </Typography>
          ) : (
            paymentHistoryForTenant.map((payment, i) => (
              <Fragment key={payment.id}>
                {i > 0 && <Divider />}
                <Box sx={{ ...row, gap: 1.5, px: 2, py: 1.5, alignItems: "flex-start" }}>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <Typography sx={{ fontWeight: 800 }}>{formatCurrency(payment.amount)}</Typography>
                    <Typography variant="body2" color="text.secondary" noWrap>
                      {payment.periodMonth || "—"} · {payment.paymentMethod || "—"}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">{formatDate(payment)}</Typography>
                  </Box>
                  <Box sx={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 0.5, flexShrink: 0 }}>
                    <StatusPill status={payment.status || "Paid"} />
                    <Box sx={{ display: "flex" }}>
                      <IconButton aria-label="View payment" onClick={() => { setHistoryTenant(null); setSelectedPayment(payment); }} sx={{ width: 38, height: 38 }}>
                        <VisibilityIcon fontSize="small" />
                      </IconButton>
                      <IconButton aria-label="Print receipt" disabled={!isReceiptable(getPaymentStatus(payment))} onClick={() => printReceipt(payment, historyTenant)} sx={{ width: 38, height: 38 }}>
                        <PrintIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  </Box>
                </Box>
              </Fragment>
            ))
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setHistoryTenant(null)} sx={{ fontWeight: 700 }}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* ======================================================
          RECORD PAYMENT (centred pop-up, scrolls inside on phones)
      ====================================================== */}
      <Dialog open={openRecordPayment} onClose={handleCloseRecordPayment} fullWidth maxWidth="sm" slotProps={{ paper: { sx: dialogPaperSx } }}>
        <Box sx={{ ...row, justifyContent: "space-between", gap: 1, px: { xs: 2, sm: 3 }, pt: 2.5, pb: 2, borderBottom: "1px solid", borderColor: "divider" }}>
          <Box sx={{ ...row, gap: 1.25, minWidth: 0 }}>
            <Box sx={{ width: 38, height: 38, borderRadius: "10px", display: "grid", placeItems: "center", bgcolor: "rgba(255,69,0,.1)", color: "primary.main", flexShrink: 0 }}>
              <PaymentsOutlinedIcon fontSize="small" />
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontFamily: '"Inter", sans-serif', fontWeight: 800, fontSize: "1.15rem", lineHeight: 1.2 }}>Record payment</Typography>
              <Typography variant="caption" color="text.secondary">For cash or payments you received yourself</Typography>
            </Box>
          </Box>
          <IconButton onClick={handleCloseRecordPayment} size="small" aria-label="Close" disabled={saving} sx={{ bgcolor: "action.hover" }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>

        <DialogContent sx={{ p: { xs: 2, sm: 3 }, "& .MuiOutlinedInput-root": { borderRadius: "10px" } }}>
          {formErrors._form && <Alert severity="error" sx={{ mb: 2.5, borderRadius: "10px" }}>{formErrors._form}</Alert>}

          <Box sx={{ display: "flex", flexDirection: "column", gap: 2.5, pt: 0.5 }}>
            {/* 1. Who and which month */}
            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "minmax(0, 1.4fr) minmax(0, 1fr)" }, gap: 2 }}>
              <Autocomplete
                options={recordableTenants}
                value={selectedFormTenant || null}
                onChange={(_, t) => handleFormChange({ target: { name: "tenantId", value: t?.id || "" } })}
                getOptionLabel={(t) => t.fullName}
                isOptionEqualToValue={(a, b) => a.id === b.id}
                noOptionsText="No tenants match"
                renderOption={(props, t) => {
                  const { key, ...rest } = props;
                  return (
                    <Box component="li" key={key} {...rest} sx={{ display: "flex", gap: 1.25, alignItems: "center" }}>
                      <Avatar sx={{ width: 30, height: 30, fontSize: 12, fontWeight: 800, bgcolor: "primary.main", color: "#fff" }}>{initialsOf(t.fullName)}</Avatar>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography variant="body2" sx={{ fontWeight: 700 }} noWrap>{t.fullName}</Typography>
                        <Typography variant="caption" color="text.secondary" noWrap component="div">
                          Room {t.roomNumber} · {t.propertyName}
                        </Typography>
                      </Box>
                    </Box>
                  );
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    required
                    label="Tenant"
                    placeholder="Search by name"
                    error={Boolean(formErrors.tenantId)}
                    helperText={formErrors.tenantId || ""}
                  />
                )}
              />
              <TextField
                select
                required
                fullWidth
                label="For the month of"
                name="periodMonth"
                value={paymentForm.periodMonth}
                onChange={handleFormChange}
                error={Boolean(formErrors.periodMonth)}
                helperText={formErrors.periodMonth || ""}
              >
                {periodOptions.map((p) => (
                  <MenuItem key={p} value={p}>
                    {p}
                    {p === currentPeriodValue ? " (this month)" : ""}
                  </MenuItem>
                ))}
              </TextField>
            </Box>

            {/* What this tenant owes for that month */}
            {selectedFormTenant && (
              <Box sx={{ borderRadius: "14px", border: "1px solid", borderColor: "divider", overflow: "hidden" }}>
                {formInfoLoading || !selectedFormInfo ? (
                  <Box sx={{ ...row, gap: 1.25, px: 2, py: 1.75 }}>
                    <CircularProgress size={18} />
                    <Typography variant="body2" color="text.secondary">Checking {selectedFormTenant.fullName}'s payments for {paymentForm.periodMonth}…</Typography>
                  </Box>
                ) : (
                  <>
                    <Box sx={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", bgcolor: (t) => alpha(t.palette.background.paper, 0.45) }}>
                      {[
                        ["Rent", formatCompact(selectedFormInfo.rent)],
                        ["Already paid", formatCompact(selectedFormInfo.received)],
                        ["Balance", formatCompact(selectedFormInfo.balance)],
                      ].map(([label, value], i) => (
                        <Box key={label} sx={{ px: 1.75, py: 1.25, borderLeft: i ? "1px solid" : "none", borderColor: "divider", minWidth: 0 }}>
                          <Typography variant="caption" color="text.secondary" noWrap component="div" sx={{ fontWeight: 600 }}>{label}</Typography>
                          <Typography sx={{ fontFamily: '"Inter", sans-serif', fontWeight: 800, color: label === "Balance" && selectedFormInfo.balance > 0 ? "warning.dark" : "text.primary" }}>
                            {value}
                          </Typography>
                        </Box>
                      ))}
                    </Box>
                    {selectedFormInfo.rent > 0 && (
                      <LinearProgress
                        variant="determinate"
                        value={Math.min(100, (selectedFormInfo.received / selectedFormInfo.rent) * 100)}
                        color={selectedFormInfo.balance === 0 ? "success" : "primary"}
                        sx={{ height: 4, bgcolor: (t) => alpha(t.palette.text.primary, 0.06) }}
                      />
                    )}
                  </>
                )}
              </Box>
            )}

            {/* Things to double-check before saving */}
            {selectedFormInfo && selectedFormInfo.pendingCount > 0 && (
              <Alert severity="info" sx={{ borderRadius: "12px", py: 0.25 }}>
                {formatCurrency(selectedFormInfo.pendingAmount)} for {paymentForm.periodMonth} is already waiting for your review. If it's the same payment, approve that one instead of recording it again.
              </Alert>
            )}
            {selectedFormInfo && selectedFormInfo.rent > 0 && selectedFormInfo.balance === 0 && (
              <Alert severity="success" sx={{ borderRadius: "12px", py: 0.25 }}>
                {paymentForm.periodMonth} is already fully paid. Anything you record now is extra.
              </Alert>
            )}

            {/* 2. How much */}
            <Box>
              <TextField
                required
                fullWidth
                label="Amount received"
                name="amount"
                type="number"
                value={effectiveAmount}
                onChange={handleFormChange}
                error={Boolean(formErrors.amount)}
                helperText={
                  formErrors.amount ||
                  (overBy > 0 && selectedFormInfo?.balance > 0
                    ? `${formatCurrency(overBy)} more than the balance. The extra isn't carried over to another month automatically.`
                    : !paymentForm.amountTouched && suggestedAmount
                    ? "Filled in with the balance. Change it if they paid a different amount."
                    : "")
                }
                sx={overBy > 0 && selectedFormInfo?.balance > 0 && !formErrors.amount ? { "& .MuiFormHelperText-root": { color: "warning.dark" } } : undefined}
                slotProps={{
                  input: { startAdornment: <InputAdornment position="start">₱</InputAdornment> },
                  htmlInput: { min: 0, step: "0.01", inputMode: "decimal" },
                }}
              />
              {selectedFormInfo && selectedFormInfo.balance > 0 && (
                <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap", mt: 1 }}>
                  {[
                    ["Full balance", selectedFormInfo.balance],
                    ["Half", round2(selectedFormInfo.balance / 2)],
                  ].map(([label, value]) => (
                    <Chip
                      key={label}
                      size="small"
                      clickable
                      label={`${label} · ${formatCompact(value)}`}
                      onClick={() => handleFormChange({ target: { name: "amount", value: String(value) } })}
                      variant={amountNumber === value ? "filled" : "outlined"}
                      color={amountNumber === value ? "primary" : "default"}
                      sx={{ fontWeight: 700, borderRadius: "8px" }}
                    />
                  ))}
                </Box>
              )}
            </Box>

            {/* 3. How and when */}
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.75 }}>Method</Typography>
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75 }}>
                {PAYMENT_METHODS.map((m) => {
                  const on = paymentForm.paymentMethod === m;
                  return (
                    <Chip
                      key={m}
                      label={m}
                      clickable
                      color={on ? "primary" : "default"}
                      variant={on ? "filled" : "outlined"}
                      onClick={() => handleFormChange({ target: { name: "paymentMethod", value: m } })}
                      sx={{ fontWeight: 700, borderRadius: "8px", height: 34 }}
                    />
                  );
                })}
              </Box>
            </Box>

            <TextField
              required
              fullWidth
              label="Date received"
              name="paymentDate"
              type="date"
              value={paymentForm.paymentDate}
              onChange={handleFormChange}
              error={Boolean(formErrors.paymentDate)}
              helperText={formErrors.paymentDate || ""}
              slotProps={{ inputLabel: { shrink: true }, htmlInput: { max: todayInput() } }}
            />

            {/* 4. Status (follows the amount unless the owner picks one) */}
            <Box>
              <Box sx={{ ...row, justifyContent: "space-between", gap: 1, mb: 0.75 }}>
                <Typography variant="body2" sx={{ fontWeight: 700 }}>Status</Typography>
                {!paymentForm.statusTouched && selectedFormInfo && (
                  <Typography variant="caption" color="text.secondary">Set from the amount</Typography>
                )}
              </Box>
              <ToggleButtonGroup
                exclusive
                fullWidth
                value={effectiveStatus}
                onChange={(e, value) => value && handleFormChange({ target: { name: "status", value } })}
                aria-label="Payment status"
                sx={{
                  p: 0.5,
                  gap: 0.5,
                  borderRadius: "12px",
                  bgcolor: (t) => alpha(t.palette.background.paper, 0.6),
                  "& .MuiToggleButton-root": { textTransform: "none", fontWeight: 700, py: 0.85, border: "none", borderRadius: "9px !important", color: "text.secondary" },
                  "& .MuiToggleButton-root.Mui-selected": { bgcolor: "#fff", color: "primary.main", boxShadow: "0 2px 8px rgba(0,0,0,.08)", "&:hover": { bgcolor: "#fff" } },
                }}
              >
                {PAYMENT_STATUSES.map((s) => (
                  <ToggleButton key={s} value={s}>{s}</ToggleButton>
                ))}
              </ToggleButtonGroup>
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.75 }}>
                {effectiveStatus === "Paid"
                  ? "Counts toward rent collected right away. The tenant gets a notice and a numbered receipt."
                  : effectiveStatus === "Partial"
                  ? "Part of the month's rent. It counts toward what they've paid; the rest stays as their balance."
                  : "Not confirmed yet. It goes to “Needs your review” and doesn't count until you approve it."}
              </Typography>
            </Box>

            <TextField
              fullWidth
              label="Remarks"
              name="remarks"
              value={paymentForm.remarks}
              onChange={handleFormChange}
              multiline
              minRows={2}
              placeholder="Optional, e.g. paid in cash to the caretaker"
              error={Boolean(formErrors.remarks)}
              helperText={formErrors.remarks || `${paymentForm.remarks.length}/300`}
            />
          </Box>
        </DialogContent>

        {/* Footer: what saving will do, then the actions */}
        <Box sx={{ borderTop: "1px solid", borderColor: "divider", bgcolor: (t) => alpha(t.palette.background.paper, 0.35) }}>
          {selectedFormInfo && amountNumber > 0 && (
            <Typography variant="body2" sx={{ px: { xs: 2, sm: 3 }, pt: 1.5, color: "text.secondary" }}>
              {effectiveStatus === "Pending" ? (
                <>Saves {formatCurrency(amountNumber)} as waiting for review.</>
              ) : (
                <>
                  {formatCurrency(amountNumber)} for {paymentForm.periodMonth} · balance after:{" "}
                  <Box component="strong" sx={{ color: balanceAfter > 0 ? "warning.dark" : "success.dark" }}>
                    {balanceAfter > 0 ? formatCurrency(balanceAfter) : "fully paid"}
                  </Box>
                </>
              )}
            </Typography>
          )}
          <DialogActions sx={{ px: { xs: 2, sm: 3 }, py: 1.5, gap: 1 }}>
            <Button onClick={handleCloseRecordPayment} color="inherit" disabled={saving} sx={{ fontWeight: 700, borderRadius: "10px", flex: { xs: 1, sm: "none" } }}>
              Cancel
            </Button>
            <Button
              variant="contained"
              disableElevation
              onClick={handleRecordPayment}
              disabled={saving || formInfoLoading}
              startIcon={saving ? <CircularProgress size={18} color="inherit" /> : <SaveOutlinedIcon />}
              sx={{ px: 3, fontWeight: 700, borderRadius: "10px", flex: { xs: 1, sm: "none" } }}
            >
              {saving ? "Saving…" : "Save payment"}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

      <Snackbar
        open={toast.open}
        autoHideDuration={3500}
        onClose={() => setToast((t) => ({ ...t, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        sx={{ bottom: { xs: `calc(${BOTTOM_NAV_H + (tab === 1 ? 88 : 8)}px + env(safe-area-inset-bottom, 0px)) !important`, sm: undefined } }}
      >
        <Alert severity={toast.severity} variant="filled" onClose={() => setToast((t) => ({ ...t, open: false }))} sx={{ width: "100%" }}>
          {toast.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}