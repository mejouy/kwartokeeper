// src/pages/owner/PaymentsPage.jsx
//
// Owner payments, in two tabs:
//   "Rent"              — who has paid, what needs review, record a payment
//   "Payment accounts"  — where tenants send rent (GCash / Maya / QR Ph, each with a QR image)
//
// The accounts are saved on the property document (properties/{id}.paymentMethods
// and .paymentNote). The tenant dashboard reads them from there.

import React, { useEffect, useMemo, useRef, useState } from "react";

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
import { issueReceipt, reserveReceiptNo } from "../../utils/receipt";
import { issuerFromProfile, printReceipt as printReceiptDoc } from "../../utils/receiptPrint";

// ------------------------------------------------------------
// CONSTANTS + PURE HELPERS
// ------------------------------------------------------------

const row = { display: "flex", alignItems: "center" };
const BOTTOM_NAV_H = 64;
const PAYMENT_METHODS = ["GCash", "Cash", "QR Ph", "Maya", "Other"];
const PAYMENT_STATUSES = ["Paid", "Pending", "Partial", "Overdue"];
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
  borderRadius: 3,
};

const groupShellSx = {
  ...cardSx,
  borderRadius: "12px !important",
  overflow: "hidden",
  "&:before": { display: "none" },
};

// Dialogs: centred pop-ups on phones too (not full screen), scrolling inside
const dialogPaperSx = {
  borderRadius: 3,
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

function SummaryStrip({ items }) {
  return (
    <Paper
      elevation={0}
      sx={{
        ...cardSx,
        overflow: "hidden",
        display: "grid",
        gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", lg: "repeat(4, minmax(0, 1fr))" },
        mb: { xs: 2.5, sm: 3 },
      }}
    >
      {items.map((item, i) => (
        <Box
          key={item.label}
          sx={{
            px: { xs: 1.75, sm: 2.5 },
            py: { xs: 1.5, sm: 2 },
            minWidth: 0,
            borderTop: { xs: i > 1 ? "1px solid" : "none", lg: "none" },
            borderLeft: { xs: i % 2 === 1 ? "1px solid" : "none", lg: i === 0 ? "none" : "1px solid" },
            borderColor: "divider",
          }}
        >
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }} noWrap component="div">
            {item.label}
          </Typography>
          <Typography
            noWrap
            sx={{ fontFamily: '"Inter", sans-serif', fontWeight: 800, fontSize: { xs: "1.2rem", sm: "1.5rem" }, lineHeight: 1.25, color: item.color }}
          >
            {item.value}
          </Typography>
          {item.sub && (
            <Typography variant="caption" color="text.secondary" noWrap component="div">
              {item.sub}
            </Typography>
          )}
        </Box>
      ))}
    </Paper>
  );
}

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

  const [selectedId, setSelectedId] = useState("");
  const [draft, setDraft] = useState(() => draftFromProperty(null));
  const [errors, setErrors] = useState({});
  const [applyAll, setApplyAll] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingKey, setUploadingKey] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);
  const fileInputs = useRef({});

  // Pick the first property once they load (and recover if the selected one disappears)
  useEffect(() => {
    if (sortedProps.length === 0) {
      if (selectedId) setSelectedId("");
      return;
    }
    if (!sortedProps.some((p) => p.id === selectedId)) setSelectedId(sortedProps[0].id);
  }, [sortedProps, selectedId]);

  const property = sortedProps.find((p) => p.id === selectedId) || null;
  const savedJson = useMemo(() => JSON.stringify(draftFromProperty(property)), [property]);
  const draftJson = JSON.stringify(draft);
  const dirty = Boolean(property) && draftJson !== savedJson;

  // Load the saved values when the property changes, or when they change elsewhere and nothing is being edited
  const dirtyRef = useRef(false);
  dirtyRef.current = dirty;
  const lastLoaded = useRef({ id: "", json: "" });
  useEffect(() => {
    if (!property) return;
    const switched = lastLoaded.current.id !== property.id;
    if (switched || !dirtyRef.current) {
      setDraft(JSON.parse(savedJson));
      setErrors({});
    }
    lastLoaded.current = { id: property.id, json: savedJson };
  }, [property, savedJson]);

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
    setSelectedId(id);
  };

  const setMethod = (key, patch) => {
    setDraft((d) => ({ ...d, methods: { ...d.methods, [key]: { ...d.methods[key], ...patch } } }));
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
      // Show exactly what was stored (numbers tidied) so the "unsaved" state clears
      setDraft({ methods: normalizeMethods(payload.paymentMethods), note: payload.paymentNote });
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
    setDraft(JSON.parse(savedJson));
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
              setDraft((d) => ({ ...d, note: ev.target.value }));
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
const STATUS_FILTERS = ["All", "Unpaid", "Pending", "Partial", "Paid", "Overdue"];

export default function PaymentsPage() {
  const { currentUser } = useAuth() || {};

  const [tab, setTab] = useState(0); // 0 = Rent, 1 = Payment accounts
  const [tenants, setTenants] = useState([]);
  const [payments, setPayments] = useState([]);
  const [properties, setProperties] = useState([]);
  const [ownerProfile, setOwnerProfile] = useState({});
  const [loading, setLoading] = useState(true);

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
  const periodOptions = useMemo(buildPeriodOptions, []);

  // ------------------------------------------------------------
  // LOAD TENANTS, PAYMENTS AND PROPERTIES
  // ------------------------------------------------------------

  useEffect(() => {
    if (!currentUser?.uid) {
      setLoading(false);
      return undefined;
    }

    setLoading(true);

    const unsubscribeTenants = onSnapshot(
      query(collection(db, "tenants"), where("ownerUid", "==", currentUser.uid)),
      (snapshot) => {
        setTenants(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      (error) => {
        console.error("Error loading tenants:", error);
        setLoading(false);
      }
    );

    const unsubscribePayments = onSnapshot(
      query(collection(db, "payments"), where("ownerUid", "==", currentUser.uid)),
      (snapshot) => setPayments(snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (error) => console.error("Error loading payments:", error)
    );

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

  // Rent for the current billing period. The period the payment was FOR decides this
  // (an October rent paid on September 30 is still October's), like the per-tenant rows.
  const isForCurrentPeriod = (payment) => {
    if (payment.periodMonth) return payment.periodMonth === currentPeriodValue;
    const date = getPaymentDate(payment);
    const now = new Date();
    return Boolean(date) && date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
  };

  // Inactive tenants and tenants who haven't finished onboarding aren't expected to pay yet.
  // (Statuses are "Active", "Pending Onboarding", "Inactive".)
  const countsTowardRent = (tenant) => {
    const s = String(tenant.status).toLowerCase();
    return s !== "inactive" && !s.startsWith("pending");
  };

  const printReceipt = async (payment, tenantFallback = {}) => {
    if (!payment || getPaymentStatus(payment) !== "paid") {
      showToast("A receipt can only be printed for a confirmed paid payment.", "warning");
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
    });
  };

  const paymentHistoryForTenant = useMemo(() => {
    if (!historyTenant) return [];
    return payments
      .filter((payment) => payment.tenantId === historyTenant.id)
      .sort((a, b) => (getPaymentDate(b)?.getTime() || 0) - (getPaymentDate(a)?.getTime() || 0));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payments, historyTenant]);

  // ------------------------------------------------------------
  // SUMMARY
  // ------------------------------------------------------------

  const totalRentCollectedThisMonth = useMemo(
    () => payments.filter((p) => isForCurrentPeriod(p) && getPaymentStatus(p) === "paid").reduce((total, p) => total + Number(p.amount || 0), 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [payments, currentPeriodValue]
  );

  const expectedRent = useMemo(
    () => normalizedTenants.filter(countsTowardRent).reduce((total, t) => total + Number(t.monthlyRent || 0), 0),
    [normalizedTenants]
  );

  const pendingPayments = useMemo(
    () =>
      payments.filter((p) => {
        const s = getPaymentStatus(p);
        return s === "pending" || s === "partial";
      }).length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [payments]
  );

  const overduePayments = useMemo(
    () => payments.filter((p) => getPaymentStatus(p) === "overdue").length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [payments]
  );

  const collectionRate = expectedRent > 0 ? Math.min(100, Math.round((totalRentCollectedThisMonth / expectedRent) * 100)) : null;

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [payments]
  );

  // ------------------------------------------------------------
  // PAYMENT STATUS FOR TENANT
  // ------------------------------------------------------------

  const getTenantPaymentInfo = (tenant) => {
    const tenantPayments = payments.filter((payment) => payment.tenantId === tenant.id && payment.periodMonth === currentPeriodValue);

    const paidAmount = tenantPayments.filter((payment) => getPaymentStatus(payment) === "paid").reduce((total, payment) => total + Number(payment.amount || 0), 0);

    const latestPayment = [...tenantPayments].sort((a, b) => (getPaymentDate(b)?.getTime() || 0) - (getPaymentDate(a)?.getTime() || 0))[0];

    const rent = Number(tenant.monthlyRent || 0);

    let status = "Unpaid";

    if (latestPayment) {
      const paymentStatus = getPaymentStatus(latestPayment);

      if (paymentStatus === "overdue") status = "Overdue";
      else if (paidAmount >= rent && rent > 0) status = "Paid";
      else if (paidAmount > 0) status = "Partial";
      else if (paymentStatus === "pending") status = "Pending";
    }

    return { paidAmount, rent, balance: Math.max(rent - paidAmount, 0), status, latestPayment };
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
      const expected = countsTowardRent(tenant) ? info.rent : 0;

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
  }, [normalizedTenants, payments, currentPeriodValue, search, statusFilter]);

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

  const handleOpenRecordPayment = () => {
    setPaymentForm({
      tenantId: "",
      amount: "",
      paymentMethod: "GCash",
      periodMonth: currentPeriodValue,
      status: "Paid",
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
      if (!prev[name]) return prev;
      const next = { ...prev };
      delete next[name];
      return next;
    });

    setPaymentForm((prev) => {
      const next = { ...prev, [name]: value };

      // Picking a tenant suggests what they still owe this month (only if nothing typed yet)
      if (name === "tenantId" && !prev.amount) {
        const tenant = normalizedTenants.find((t) => t.id === value);
        if (tenant) {
          const { balance } = getTenantPaymentInfo(tenant);
          if (balance > 0) next.amount = String(balance);
        }
      }
      return next;
    });
  };

  const validateForm = () => {
    const e = {};
    if (!paymentForm.tenantId) e.tenantId = "Select a tenant.";

    const amount = Number(paymentForm.amount);
    if (paymentForm.amount === "" || Number.isNaN(amount) || amount <= 0) e.amount = "Enter an amount greater than 0.";
    else if (amount > MAX_AMOUNT) e.amount = "That amount looks too large.";
    else if (!/^\d+(\.\d{1,2})?$/.test(String(paymentForm.amount).trim())) e.amount = "Use at most 2 decimal places.";

    if (!paymentForm.periodMonth) e.periodMonth = "Select a billing period.";

    if (!paymentForm.paymentDate) e.paymentDate = "Choose the payment date.";
    else if (Number.isNaN(new Date(`${paymentForm.paymentDate}T12:00:00`).getTime())) e.paymentDate = "Enter a valid date.";

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

    setSaving(true);
    try {
      const payload = {
        tenantId: selectedTenant.id,
        tenantName: selectedTenant.fullName,
        propertyId: selectedTenant.propertyId || selectedTenant.assignedPropertyId || "",
        propertyName: selectedTenant.propertyName || "Dormitory",
        roomNumber: selectedTenant.roomNumber || "N/A",
        amount: Number(paymentForm.amount),
        paymentMethod: paymentForm.paymentMethod,
        periodMonth: paymentForm.periodMonth,
        status: paymentForm.status,
        verificationStatus: paymentForm.status === "Paid" ? "Approved" : paymentForm.status === "Pending" ? "Pending" : "",
        remarks: paymentForm.remarks.trim(),
        ownerUid: currentUser.uid,
        paymentDate: new Date(`${paymentForm.paymentDate}T12:00:00`),
        createdAt: serverTimestamp(),
      };
      const ref = doc(collection(db, "payments"));
      let receiptNo = "";
      await runTransaction(db, async (tx) => {
        // A payment recorded as Paid is a confirmed receipt: number it
        const issued = payload.status === "Paid" ? await reserveReceiptNo(tx, db, currentUser.uid) : {};
        receiptNo = issued.receiptNo || "";
        tx.set(ref, { ...payload, ...issued });
      });

      if (paymentForm.status === "Paid") {
        notifyTenant(
          { id: ref.id, tenantId: selectedTenant.id },
          {
            type: "success",
            title: "Payment recorded",
            message: `Your landlord recorded a ${formatCurrency(paymentForm.amount)} rent payment for ${paymentForm.periodMonth}. Thank you!${receiptNo ? ` Your receipt (No. ${receiptNo}) is ready: open the payment in your Payments tab to print or save it.` : ""}`,
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

  const selectedFormTenant = normalizedTenants.find((t) => t.id === paymentForm.tenantId);
  const selectedFormInfo = selectedFormTenant ? getTenantPaymentInfo(selectedFormTenant) : null;

  // ------------------------------------------------------------
  // TENANT ROW (grid on laptops, compact card on phones)
  // ------------------------------------------------------------

  const COLS = "minmax(0, 1.6fr) minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr) 100px 132px";

  const rowActions = (tenant, info) => {
    const canReceipt = info.latestPayment && getPaymentStatus(info.latestPayment) === "paid";
    return (
      <Box sx={{ display: "flex", gap: 0.5, justifyContent: { xs: "flex-end", lg: "flex-start" } }}>
        <Tooltip title={info.latestPayment ? "View latest payment" : "No payment this month"}>
          <span>
            <IconButton aria-label="View latest payment" disabled={!info.latestPayment} onClick={() => setSelectedPayment(info.latestPayment)} sx={{ width: 40, height: 40 }}>
              <VisibilityIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
        <Tooltip title="Payment history">
          <IconButton aria-label="Payment history" onClick={() => setHistoryTenant(tenant)} sx={{ width: 40, height: 40 }}>
            <HistoryIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Tooltip title={canReceipt ? "Print receipt" : "Receipts are for paid payments"}>
          <span>
            <IconButton aria-label="Print receipt" disabled={!canReceipt} onClick={() => printReceipt(info.latestPayment, tenant)} sx={{ width: 40, height: 40 }}>
              <PrintIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
      </Box>
    );
  };

  const renderTenantRow = ({ tenant, info }) => {
    const dim = !countsTowardRent(tenant);
    return (
      <Box
        key={tenant.id}
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "minmax(0, 1fr) auto", lg: COLS },
          alignItems: "center",
          columnGap: 2,
          rowGap: 0.5,
          px: { xs: 2, sm: 3 },
          py: { xs: 1.25, lg: 1 },
        }}
      >
        <Box sx={{ minWidth: 0, opacity: dim ? 0.65 : 1 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }} noWrap>
            {tenant.fullName}
          </Typography>
          {dim && (
            <Typography variant="caption" color="text.secondary" noWrap component="div">
              {String(tenant.status).toLowerCase().startsWith("pending") ? "Pending onboarding" : tenant.status}
            </Typography>
          )}
        </Box>

        {/* Phones: status top right */}
        <Box sx={{ display: { xs: "block", lg: "none" } }}>
          <StatusPill status={info.status} />
        </Box>

        {/* Phones: one quiet money line */}
        <Typography variant="body2" color="text.secondary" sx={{ display: { xs: "block", lg: "none" }, gridColumn: "1 / -1", opacity: dim ? 0.65 : 1 }}>
          Rent {formatCompact(info.rent)} · Paid{" "}
          <Box component="span" sx={{ color: "text.primary", fontWeight: 600 }}>{formatCompact(info.paidAmount)}</Box>
          {" "}· Balance{" "}
          <Box component="span" sx={{ color: info.balance > 0 && !dim ? "warning.dark" : "text.primary", fontWeight: 600 }}>
            {formatCompact(info.balance)}
          </Box>
        </Typography>

        {/* Laptops */}
        <Typography variant="body2" sx={{ display: { xs: "none", lg: "block" }, opacity: dim ? 0.65 : 1 }}>{formatCurrency(info.rent)}</Typography>
        <Typography variant="body2" sx={{ display: { xs: "none", lg: "block" }, fontWeight: 600, opacity: dim ? 0.65 : 1 }}>
          {formatCurrency(info.paidAmount)}
        </Typography>
        <Typography
          variant="body2"
          sx={{ display: { xs: "none", lg: "block" }, fontWeight: 600, opacity: dim ? 0.65 : 1, color: info.balance > 0 && !dim ? "warning.dark" : "text.primary" }}
        >
          {formatCurrency(info.balance)}
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
        px: 3,
        py: 1,
        bgcolor: (t) => alpha(t.palette.background.paper, 0.35),
        borderBottom: "1px solid",
        borderColor: "divider",
        "& > *": { fontWeight: 700, color: "text.secondary", fontSize: "0.75rem", letterSpacing: 0.3 },
      }}
    >
      <Box>TENANT</Box>
      <Box>MONTHLY RENT</Box>
      <Box>COLLECTED</Box>
      <Box>BALANCE</Box>
      <Box>STATUS</Box>
      <Box>DETAILS</Box>
    </Box>
  );

  // ------------------------------------------------------------
  // LOADING
  // ------------------------------------------------------------

  if (loading) {
    return (
      <Box sx={{ minWidth: 0 }}>
        <Skeleton variant="rounded" height={44} sx={{ borderRadius: 3, mb: 2 }} />
        <Skeleton variant="rounded" height={84} sx={{ borderRadius: 3, mb: 3 }} />
        {[0, 1].map((i) => (
          <Paper key={i} elevation={0} sx={{ ...groupShellSx, p: 2, mb: 2 }}>
            <Skeleton width="35%" height={28} />
            <Skeleton variant="rounded" height={52} sx={{ mt: 1.5 }} />
            <Skeleton variant="rounded" height={52} sx={{ mt: 1 }} />
          </Paper>
        ))}
      </Box>
    );
  }

  // ------------------------------------------------------------
  // UI
  // ------------------------------------------------------------

  const needsAccountSetup = properties.length > 0 && propertiesWithoutAccounts.length > 0;

  return (
    <Box sx={{ minWidth: 0, pb: { xs: 9, sm: 0 } }}>
      {/* The top bar already says "Payments", so the page adds a line of context and the main action */}
      <Box sx={{ ...row, justifyContent: "space-between", gap: 2, mb: { xs: 1.5, sm: 2 } }}>
        <Typography color="text.secondary" sx={{ minWidth: 0 }}>
          {tab === 0 ? `Rent collection by room · ${currentPeriodValue}` : "Set up where your tenants send their rent"}
        </Typography>
        {tab === 0 && (
          <Button
            variant="contained"
            disableElevation
            startIcon={<AddIcon />}
            onClick={handleOpenRecordPayment}
            sx={{ flexShrink: 0, fontWeight: 700, borderRadius: 2.5, display: { xs: "none", sm: "inline-flex" } }}
          >
            Record payment
          </Button>
        )}
      </Box>

      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v)}
        sx={{ mb: { xs: 2, sm: 2.5 }, borderBottom: "1px solid", borderColor: "divider", "& .MuiTab-root": { minHeight: 48, fontWeight: 700, textTransform: "none" } }}
      >
        <Tab label="Rent" />
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
            sx={{ mb: 2.5, borderRadius: 2.5, alignItems: "center" }}
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

        <SummaryStrip
          items={[
            {
              label: "Collected this month",
              value: formatCompact(totalRentCollectedThisMonth),
              sub: collectionRate !== null ? `${collectionRate}% of expected` : "No expected rent yet",
              color: "success.main",
            },
            { label: "Expected rent", value: formatCompact(expectedRent), sub: "Active tenants" },
            { label: "Pending", value: pendingPayments, color: pendingPayments > 0 ? "warning.main" : undefined, sub: pendingPayments === 1 ? "payment" : "payments" },
            { label: "Overdue", value: overduePayments, color: overduePayments > 0 ? "error.main" : undefined, sub: overduePayments === 1 ? "payment" : "payments" },
          ]}
        />

        {/* PENDING PAYMENT VERIFICATION */}
        {pendingVerificationPayments.length > 0 && (
          <Box sx={{ mb: { xs: 3, sm: 4 } }}>
            <SectionTitle
              title="Needs your review"
              sub="Payments submitted by tenants. Approve them to mark as paid."
              right={
                <Chip size="small" label={pendingVerificationPayments.length} sx={{ fontWeight: 800, bgcolor: (t) => alpha(t.palette.warning.main, 0.16), color: "warning.dark" }} />
              }
            />

            <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
              {pendingVerificationPayments.map((payment) => {
                const isProcessing = processingPaymentId === payment.id;

                return (
                  <Paper key={payment.id} elevation={0} sx={{ ...cardSx, p: { xs: 2, sm: 2.5 }, borderLeft: "3px solid", borderLeftColor: "warning.main" }}>
                    <Box
                      sx={{
                        display: "flex",
                        flexDirection: { xs: "column", lg: "row" },
                        alignItems: { xs: "stretch", lg: "center" },
                        justifyContent: "space-between",
                        gap: { xs: 1.5, lg: 3 },
                      }}
                    >
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography sx={{ fontWeight: 700 }} noWrap>
                          {payment.tenantName || "Unnamed Tenant"}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" noWrap>
                          Room {payment.roomNumber || "Unassigned"} • {payment.propertyName || "Dormitory"}
                        </Typography>
                        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75, mt: 1 }}>
                          <Chip label={payment.paymentMethod || "Unknown method"} size="small" variant="outlined" />
                          <Chip label={payment.periodMonth || "No billing period"} size="small" variant="outlined" />
                        </Box>
                      </Box>

                      <Box sx={{ textAlign: { xs: "left", lg: "right" }, minWidth: { lg: 150 } }}>
                        <Typography sx={{ fontFamily: '"Inter", sans-serif', fontWeight: 800, fontSize: "1.25rem" }}>{formatCurrency(payment.amount)}</Typography>
                        <Typography variant="body2" color="text.secondary">{formatDate(payment)}</Typography>
                      </Box>

                      <Box sx={{ display: "flex", gap: 1, flexShrink: 0 }}>
                        <Button
                          variant="contained"
                          color="success"
                          disableElevation
                          disabled={isProcessing}
                          onClick={() => handleVerifyPayment(payment.id, true)}
                          startIcon={isProcessing ? <CircularProgress size={16} color="inherit" /> : <CheckIcon />}
                          sx={{ flex: { xs: 1, lg: "none" }, fontWeight: 700, minHeight: 44 }}
                        >
                          {isProcessing ? "Updating…" : "Approve"}
                        </Button>
                        <Button
                          variant="outlined"
                          color="error"
                          disabled={isProcessing}
                          onClick={() => setRejectTarget(payment)}
                          sx={{ flex: { xs: 1, lg: "none" }, fontWeight: 700, minHeight: 44 }}
                        >
                          Reject
                        </Button>
                      </Box>
                    </Box>

                    {(payment.referenceNumber || payment.remarks || payment.proofUrl || payment.recordedByName) && (
                      <>
                        <Divider sx={{ my: 1.5 }} />
                        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.25 }}>
                          {payment.referenceNumber && (
                            <Typography variant="body2" sx={{ wordBreak: "break-word" }}>
                              <strong>Reference:</strong> {payment.referenceNumber}
                            </Typography>
                          )}
                          {payment.remarks && (
                            <Typography variant="body2" color="text.secondary" sx={{ wordBreak: "break-word" }}>
                              <strong>Remarks:</strong> {payment.remarks}
                            </Typography>
                          )}
                          {payment.recordedByName && (
                            <Typography variant="body2" color="text.secondary" sx={{ wordBreak: "break-word" }}>
                              <strong>Recorded by:</strong> {payment.recordedByName}
                              {payment.recordedByRole ? ` (${payment.recordedByRole})` : ""}
                            </Typography>
                          )}
                          {payment.proofUrl && (
                            <Box component="a" href={payment.proofUrl} target="_blank" rel="noopener noreferrer" sx={{ display: "inline-block", mt: 0.75 }}>
                              <Box component="img" src={payment.proofUrl} alt="Proof of payment" loading="lazy" sx={{ display: "block", width: 120, height: 120, objectFit: "cover", borderRadius: 2, border: "1px solid", borderColor: "divider" }} />
                            </Box>
                          )}
                        </Box>
                      </>
                    )}
                  </Paper>
                );
              })}
            </Box>
          </Box>
        )}

        {/* RENT BY ROOM */}
        <SectionTitle title="Rent by room" sub={`Billing period: ${currentPeriodValue}`} />

        {normalizedTenants.length > 0 && (
          <Box sx={{ mb: 2 }}>
            <TextField
              size="small"
              placeholder="Search tenant or room"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon fontSize="small" />
                    </InputAdornment>
                  ),
                  endAdornment: search ? (
                    <InputAdornment position="end">
                      <IconButton size="small" aria-label="Clear search" onClick={() => setSearch("")}>
                        <CloseIcon fontSize="small" />
                      </IconButton>
                    </InputAdornment>
                  ) : null,
                },
                htmlInput: { "aria-label": "Search tenants" },
              }}
              fullWidth
              sx={{ maxWidth: { sm: 360 } }}
            />
            <Box sx={{ display: "flex", gap: 1, mt: 1.25, flexWrap: "wrap" }}>
              {STATUS_FILTERS.map((f) => (
                <Chip
                  key={f}
                  label={f}
                  clickable
                  onClick={() => setStatusFilter(f)}
                  color={statusFilter === f ? "primary" : "default"}
                  variant={statusFilter === f ? "filled" : "outlined"}
                  sx={{ fontWeight: 700, height: 40, borderRadius: 20, flexShrink: 0 }}
                />
              ))}
            </Box>
          </Box>
        )}

        {propertyGroups.length === 0 ? (
          <Paper elevation={0} sx={{ ...groupShellSx, borderStyle: "dashed", py: 7, px: 3, textAlign: "center" }}>
            <Box sx={{ width: 64, height: 64, borderRadius: "50%", mx: "auto", mb: 2, ...row, justifyContent: "center", bgcolor: "rgba(255, 69, 0, 0.10)" }}>
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
          <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {propertyGroups.map((prop, index) => {
              const pct = prop.expected > 0 ? Math.min(100, Math.round((prop.collected / prop.expected) * 100)) : 0;
              return (
                <Accordion key={prop.key} defaultExpanded={index === 0 || filtersActive} disableGutters elevation={0} sx={groupShellSx}>
                  <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ "& .MuiAccordionSummary-content": { alignItems: "center", my: 1.5, minWidth: 0 } }}>
                    <Box sx={{ ...row, gap: 1.5, minWidth: 0, flex: 1 }}>
                      <Box sx={{ width: 36, height: 36, borderRadius: 2, flexShrink: 0, ...row, justifyContent: "center", bgcolor: "rgba(255, 69, 0, 0.10)" }}>
                        <ApartmentOutlinedIcon color="primary" fontSize="small" />
                      </Box>
                      <Box sx={{ minWidth: 0, flex: 1 }}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 800, lineHeight: 1.25 }} noWrap>
                          {prop.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" noWrap component="div">
                          {prop.tenantCount} {prop.tenantCount === 1 ? "tenant" : "tenants"} · {formatCompact(prop.collected)} of {formatCompact(prop.expected)}
                        </Typography>
                      </Box>
                      <Box sx={{ width: { xs: 48, sm: 120 }, flexShrink: 0, mr: 1 }}>
                        <LinearProgress
                          variant="determinate"
                          value={pct}
                          color={pct >= 100 ? "success" : "primary"}
                          sx={{ height: 6, borderRadius: 3, bgcolor: (t) => alpha(t.palette.text.primary, 0.08) }}
                        />
                        <Typography variant="caption" color="text.secondary" sx={{ display: { xs: "none", sm: "block" }, mt: 0.25, textAlign: "right" }}>
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
                            px: { xs: 2, sm: 3 },
                            py: 0.9,
                            bgcolor: (t) => alpha(t.palette.background.paper, 0.55),
                            borderTop: roomIndex === 0 ? "none" : "1px solid",
                            borderBottom: "1px solid",
                            borderColor: "divider",
                          }}
                        >
                          <Typography variant="body2" sx={{ fontWeight: 800 }}>
                            {room.roomNumber === "Unassigned" ? "No room yet" : `Room ${room.roomNumber}`}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                            {formatCompact(room.collected)} / {formatCompact(room.expected)}
                          </Typography>
                        </Box>
                        {room.tenants.map((entry, i) => (
                          <React.Fragment key={entry.tenant.id}>
                            {i > 0 && <Divider />}
                            {renderTenantRow(entry)}
                          </React.Fragment>
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

      {/* Phone: floating record button */}
      {tab === 0 && (
        <Button
          variant="contained"
          onClick={handleOpenRecordPayment}
          startIcon={<AddIcon />}
          sx={{
            display: { xs: "inline-flex", sm: "none" },
            position: "fixed",
            right: 16,
            bottom: `calc(${BOTTOM_NAV_H}px + 16px + env(safe-area-inset-bottom, 0px))`,
            zIndex: (t) => t.zIndex.appBar - 1,
            borderRadius: 6,
            px: 2.5,
            py: 1.2,
            fontWeight: 700,
            boxShadow: 6,
          }}
        >
          Record
        </Button>
      )}

      {/* ======================================================
          REJECT CONFIRMATION
      ====================================================== */}
      <Dialog open={Boolean(rejectTarget)} onClose={() => setRejectTarget(null)} maxWidth="xs" fullWidth slotProps={{ paper: { sx: dialogPaperSx } }}>
        <DialogTitle sx={{ fontWeight: 800 }}>Reject this payment?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            {rejectTarget
              ? `${rejectTarget.tenantName || "This tenant"}'s ${formatCurrency(rejectTarget.amount)} payment will be marked as rejected and won't count toward rent collected. They'll be notified.`
              : ""}
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button color="inherit" onClick={() => setRejectTarget(null)} sx={{ fontWeight: 600 }}>
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
            sx={{ fontWeight: 700 }}
          >
            Reject payment
          </Button>
        </DialogActions>
      </Dialog>

      {/* ======================================================
          PAYMENT DETAILS
      ====================================================== */}
      <Dialog open={Boolean(selectedPayment)} onClose={() => setSelectedPayment(null)} fullWidth maxWidth="sm" slotProps={{ paper: { sx: dialogPaperSx } }}>
        <DialogTitle sx={{ ...row, justifyContent: "space-between", fontWeight: 800 }}>
          Payment details
          <IconButton onClick={() => setSelectedPayment(null)} size="small" aria-label="Close payment details">
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          {selectedPayment && (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
              {[
                ["Tenant", selectedPayment.tenantName || "—"],
                ["Property", selectedPayment.propertyName || "—"],
                ["Room", selectedPayment.roomNumber || "—"],
                ["Billing period", selectedPayment.periodMonth || "—"],
                ["Payment date", formatDate(selectedPayment)],
                ["Amount", formatCurrency(selectedPayment.amount)],
                ["Method", selectedPayment.paymentMethod || "—"],
                ["Status", selectedPayment.status || "—"],
                ["Reference no.", selectedPayment.referenceNumber || "—"],
                ["Remarks", selectedPayment.remarks || "—"],
              ].map(([label, value]) => (
                <Box key={label} sx={{ display: "flex", justifyContent: "space-between", gap: 2 }}>
                  <Typography color="text.secondary">{label}</Typography>
                  <Typography fontWeight={600} sx={{ textAlign: "right", overflowWrap: "anywhere" }}>{value}</Typography>
                </Box>
              ))}
              {selectedPayment.proofUrl && (
                <Box component="a" href={selectedPayment.proofUrl} target="_blank" rel="noopener noreferrer" sx={{ display: "block", mt: 0.5 }}>
                  <Typography variant="caption" color="text.secondary" component="div" sx={{ mb: 0.5 }}>Proof of payment</Typography>
                  <Box component="img" src={selectedPayment.proofUrl} alt="Proof of payment" loading="lazy" sx={{ display: "block", width: "100%", maxHeight: 320, objectFit: "contain", borderRadius: 2, border: "1px solid", borderColor: "divider", bgcolor: "action.hover" }} />
                </Box>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button onClick={() => setSelectedPayment(null)} color="inherit" sx={{ fontWeight: 600 }}>
            Close
          </Button>
          <Button
            startIcon={<PrintIcon />}
            variant="contained"
            disableElevation
            disabled={!selectedPayment || getPaymentStatus(selectedPayment) !== "paid"}
            onClick={() => printReceipt(selectedPayment)}
            sx={{ fontWeight: 700 }}
          >
            Print receipt
          </Button>
        </DialogActions>
      </Dialog>

      {/* ======================================================
          TENANT PAYMENT HISTORY
      ====================================================== */}
      <Dialog open={Boolean(historyTenant)} onClose={() => setHistoryTenant(null)} fullWidth maxWidth="sm" slotProps={{ paper: { sx: dialogPaperSx } }}>
        <DialogTitle sx={{ ...row, justifyContent: "space-between", gap: 1, fontWeight: 800 }}>
          <Box component="span" sx={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            History{historyTenant ? ` — ${historyTenant.fullName}` : ""}
          </Box>
          <IconButton onClick={() => setHistoryTenant(null)} size="small" aria-label="Close payment history">
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers sx={{ p: 0 }}>
          {paymentHistoryForTenant.length === 0 ? (
            <Typography color="text.secondary" sx={{ py: 4, textAlign: "center" }}>
              No payments recorded for this tenant yet.
            </Typography>
          ) : (
            paymentHistoryForTenant.map((payment, i) => (
              <React.Fragment key={payment.id}>
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
                      <IconButton aria-label="View payment" onClick={() => { setHistoryTenant(null); setSelectedPayment(payment); }} sx={{ width: 40, height: 40 }}>
                        <VisibilityIcon fontSize="small" />
                      </IconButton>
                      <IconButton aria-label="Print receipt" disabled={getPaymentStatus(payment) !== "paid"} onClick={() => printReceipt(payment, historyTenant)} sx={{ width: 40, height: 40 }}>
                        <PrintIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  </Box>
                </Box>
              </React.Fragment>
            ))
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setHistoryTenant(null)} sx={{ fontWeight: 600 }}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* ======================================================
          RECORD PAYMENT (centred pop-up, scrolls inside on phones)
      ====================================================== */}
      <Dialog open={openRecordPayment} onClose={handleCloseRecordPayment} fullWidth maxWidth="sm" slotProps={{ paper: { sx: dialogPaperSx } }}>
        <DialogTitle sx={{ ...row, justifyContent: "space-between", fontWeight: 800 }}>
          Record payment
          <IconButton onClick={handleCloseRecordPayment} size="small" aria-label="Close" disabled={saving}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        <DialogContent dividers sx={{ p: { xs: 2, sm: 3 } }}>
          {formErrors._form && <Alert severity="error" sx={{ mb: 2.5 }}>{formErrors._form}</Alert>}

          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "repeat(2, minmax(0, 1fr))" }, gap: 2.25, pt: 0.5 }}>
            <TextField
              select
              required
              fullWidth
              label="Tenant"
              name="tenantId"
              value={paymentForm.tenantId}
              onChange={handleFormChange}
              error={Boolean(formErrors.tenantId)}
              helperText={
                formErrors.tenantId ||
                (selectedFormInfo
                  ? `Rent ${formatCompact(selectedFormInfo.rent)} · Paid ${formatCompact(selectedFormInfo.paidAmount)} · Balance ${formatCompact(selectedFormInfo.balance)} this month`
                  : "")
              }
              sx={{ gridColumn: { sm: "1 / -1" } }}
            >
              {[...normalizedTenants]
                .sort((a, b) => a.fullName.localeCompare(b.fullName))
                .map((tenant) => (
                  <MenuItem key={tenant.id} value={tenant.id}>
                    {tenant.fullName} — Room {tenant.roomNumber}
                  </MenuItem>
                ))}
            </TextField>

            <TextField
              required
              fullWidth
              label="Amount"
              name="amount"
              type="number"
              value={paymentForm.amount}
              onChange={handleFormChange}
              error={Boolean(formErrors.amount)}
              helperText={formErrors.amount || ""}
              slotProps={{
                input: { startAdornment: <InputAdornment position="start">₱</InputAdornment> },
                htmlInput: { min: 0, step: "0.01", inputMode: "decimal" },
              }}
            />

            <TextField select required fullWidth label="Payment method" name="paymentMethod" value={paymentForm.paymentMethod} onChange={handleFormChange}>
              {PAYMENT_METHODS.map((m) => (
                <MenuItem key={m} value={m}>{m}</MenuItem>
              ))}
            </TextField>

            <TextField
              select
              required
              fullWidth
              label="Billing period"
              name="periodMonth"
              value={paymentForm.periodMonth}
              onChange={handleFormChange}
              error={Boolean(formErrors.periodMonth)}
              helperText={formErrors.periodMonth || ""}
            >
              {periodOptions.map((p) => (
                <MenuItem key={p} value={p}>{p}</MenuItem>
              ))}
            </TextField>

            <TextField
              required
              fullWidth
              label="Payment date"
              name="paymentDate"
              type="date"
              value={paymentForm.paymentDate}
              onChange={handleFormChange}
              error={Boolean(formErrors.paymentDate)}
              helperText={formErrors.paymentDate || ""}
              slotProps={{ inputLabel: { shrink: true } }}
            />

            <TextField
              select
              required
              fullWidth
              label="Status"
              name="status"
              value={paymentForm.status}
              onChange={handleFormChange}
              helperText={paymentForm.status === "Paid" ? "Counts toward rent collected right away. The tenant gets a notice." : ""}
              sx={{ gridColumn: { sm: "1 / -1" } }}
            >
              {PAYMENT_STATUSES.map((s) => (
                <MenuItem key={s} value={s}>{s}</MenuItem>
              ))}
            </TextField>

            <TextField
              fullWidth
              label="Remarks"
              name="remarks"
              value={paymentForm.remarks}
              onChange={handleFormChange}
              multiline
              minRows={2}
              placeholder="Optional payment notes"
              error={Boolean(formErrors.remarks)}
              helperText={formErrors.remarks || `${paymentForm.remarks.length}/300`}
              sx={{ gridColumn: { sm: "1 / -1" } }}
            />
          </Box>
        </DialogContent>

        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button onClick={handleCloseRecordPayment} color="inherit" disabled={saving} sx={{ fontWeight: 600, flex: { xs: 1, sm: "none" } }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            disableElevation
            onClick={handleRecordPayment}
            disabled={saving}
            sx={{ px: 4, py: 1.1, fontWeight: 700, flex: { xs: 1, sm: "none" } }}
          >
            {saving ? <CircularProgress size={22} color="inherit" /> : "Save payment"}
          </Button>
        </DialogActions>
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