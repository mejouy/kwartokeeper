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

import { useMemo, useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Typography,
  TextField,
  MenuItem,
  ToggleButtonGroup,
  ToggleButton,
  Switch,
  Button,
  Alert,
  CircularProgress,
  IconButton,
  InputAdornment,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import CheckIcon from "@mui/icons-material/Check";
import PersonOutlinedIcon from "@mui/icons-material/PersonOutlined";
import SecurityOutlinedIcon from "@mui/icons-material/SecurityOutlined";
import SendOutlinedIcon from "@mui/icons-material/SendOutlined";
import PhoneOutlinedIcon from "@mui/icons-material/PhoneOutlined";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import { collection, query, where, getDocs } from "firebase/firestore";
import { auth, db } from "../../../config/firebase";
import { useAuth } from "../../../context/AuthContext";
import { createCaretakerAccount } from "../../../services/caretakerService";
import { generateTempPassword } from "../../../utils/generateTempPassword";

// ---------------------------------------------------------------------------
// Same layout as the property setup (PropertyWizard): dark sidebar with the
// step list and dorm facade on the left, white content column on the right.
// ---------------------------------------------------------------------------
const STEPS = [
  { title: "Caretaker details", heading: "Who are you inviting?", sub: "Their name and contact details. They will sign in with this email.", Icon: PersonOutlinedIcon },
  { title: "Property & access", heading: "What can they do?", sub: "Choose the property they will look after and what they are allowed to manage.", Icon: SecurityOutlinedIcon },
  { title: "Send invite", heading: "How should they get their login?", sub: "Pick how to send the sign-in details, then review before inviting.", Icon: SendOutlinedIcon },
];

const PERMISSION_OPTIONS = [
  { key: "manageTenants", label: "Manage tenants", desc: "Register tenants and assign rooms" },
  { key: "logOccupancy", label: "Log occupancy", desc: "Daily occupancy and curfew checks" },
  { key: "handleReports", label: "Handle reports", desc: "Receive and update incident / maintenance reports" },
  { key: "viewFinancials", label: "View financials", desc: "See rent payments and history" },
  { key: "modifyLayout", label: "Modify layout", desc: "Change property layout or room rates" },
];

// ---------------------------------------------------------------------------
// Validation helpers. Each returns an error message, or "" when the value is OK.
// ---------------------------------------------------------------------------
const cleanName = (v) => String(v || "").replace(/\s+/g, " ").trim();

function validateFullName(v) {
  const name = cleanName(v);
  if (!name) return "Full name is required.";
  if (name.length < 2) return "Enter at least 2 characters.";
  if (name.length > 80) return "Keep the name under 80 characters.";
  if (!/^\p{L}[\p{L}\s.'’-]*$/u.test(name)) return "Use letters only (spaces, . ' - are fine).";
  return "";
}

// Practical email check: one @, a dot in the domain, no spaces, sane lengths.
const EMAIL_RE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/;
function validateEmail(v) {
  const email = String(v || "").trim();
  if (!email) return "Email is required.";
  if (/\s/.test(email)) return "Email can't contain spaces.";
  if (email.length > 254) return "That email is too long.";
  if (!EMAIL_RE.test(email) || email.includes("..")) return "Enter a valid email, like name@example.com.";
  return "";
}

// Philippine mobile: 09XXXXXXXXX, 9XXXXXXXXX, 639XXXXXXXXX or +639XXXXXXXXX.
// Returns 11-digit local format ("09171234567") or null.
function toLocalPhMobile(raw) {
  const digits = String(raw || "").replace(/[^0-9]/g, "");
  let national = null;
  if (digits.length === 11 && digits.startsWith("09")) national = digits.slice(1);
  else if (digits.length === 10 && digits.startsWith("9")) national = digits;
  else if (digits.length === 12 && digits.startsWith("639")) national = digits.slice(2);
  return national && /^9\d{9}$/.test(national) ? `0${national}` : null;
}

function validatePhone(v) {
  const raw = String(v || "").trim();
  if (!raw) return "Mobile phone is required.";
  if (/[^0-9+\s()-]/.test(raw)) return "Use digits only.";
  if (!toLocalPhMobile(raw)) return "Enter a valid PH mobile number, like 09171234567.";
  return "";
}

const formatLocalPhone = (local) => (local ? `${local.slice(0, 4)} ${local.slice(4, 7)} ${local.slice(7)}` : "");

const FIELD_VALIDATORS = {
  fullName: validateFullName,
  email: validateEmail,
  mobilePhone: validatePhone,
};

// ---------------------------------------------------------------------------
// SMS sending. Lives here so the page works with no extra files. It calls the
// SMS worker (see sms-worker/SETUP.md) when VITE_SMS_WORKER_URL is set, and
// otherwise just reports "not set up" — it never throws, so a failed text can
// never lose the caretaker account that was already created.
// ---------------------------------------------------------------------------
async function sendCaretakerInviteSms({ phone, email, tempPassword, propertyId }) {
  const url = import.meta.env.VITE_SMS_WORKER_URL;
  if (!url) return { ok: false, error: "SMS isn't set up yet, so no text was sent." };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const idToken = await auth.currentUser?.getIdToken();
    if (!idToken) return { ok: false, error: "You're signed out. Sign in again and retry." };

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${idToken}` },
      body: JSON.stringify({ phone, email, tempPassword, propertyId }),
      signal: controller.signal,
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.ok) return { ok: true };
    return { ok: false, error: data.error || "The SMS could not be sent." };
  } catch (err) {
    console.error("SMS invite failed:", err?.name); // never log the payload (it has the password)
    return {
      ok: false,
      error: err?.name === "AbortError" ? "The SMS took too long. It may still arrive." : "Couldn't reach the SMS service.",
    };
  } finally {
    clearTimeout(timer);
  }
}

const permSwitchSx = {
  width: 46,
  height: 26,
  p: 0,
  flexShrink: 0,
  "& .MuiSwitch-switchBase": {
    p: "3px",
    "&.Mui-checked": {
      transform: "translateX(20px)",
      color: "#ffffff",
      "& + .MuiSwitch-track": { bgcolor: "primary.main", opacity: 1, border: 0 },
    },
    "&.Mui-focusVisible + .MuiSwitch-track": { outline: "2px solid", outlineColor: "primary.main", outlineOffset: 2 },
  },
  "& .MuiSwitch-thumb": { width: 20, height: 20, boxShadow: "none", bgcolor: "#ffffff" },
  "& .MuiSwitch-track": { borderRadius: 13, bgcolor: "rgba(32, 32, 32, 0.38)", opacity: 1 },
};

const FULL_PERMISSIONS = PERMISSION_OPTIONS.reduce((acc, p) => ({ ...acc, [p.key]: true }), {});
const NO_PERMISSIONS = PERMISSION_OPTIONS.reduce((acc, p) => ({ ...acc, [p.key]: false }), {});

const FACADE_ROWS = 5;
const FACADE_COLS = 5;
const LIT_PATTERN = [
  1, 0, 0, 1, 0,
  0, 0, 1, 0, 0,
  1, 0, 0, 0, 1,
  0, 1, 0, 0, 0,
  0, 0, 1, 0, 1,
];

function DormFacade() {
  const windows = useMemo(() => {
    const w = [];
    const gap = 16;
    const size = 30;
    for (let row = 0; row < FACADE_ROWS; row++) {
      for (let col = 0; col < FACADE_COLS; col++) {
        const idx = row * FACADE_COLS + col;
        w.push({ x: col * (size + gap), y: row * (size + gap), lit: LIT_PATTERN[idx] === 1, size });
      }
    }
    return w;
  }, []);

  const width = FACADE_COLS * (30 + 16) - 16;
  const height = FACADE_ROWS * (30 + 16) - 16;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      style={{ maxWidth: 220, display: "block" }}
      role="img"
      aria-label="Illustration of a dormitory building at night, with illuminated windows"
    >
      {windows.map((win, i) => (
        <rect
          key={i}
          x={win.x}
          y={win.y}
          width={win.size}
          height={win.size}
          rx={4}
          fill={win.lit ? "#ff4500" : "rgba(202, 220, 246, 0.16)"}
          opacity={win.lit ? 0.92 : 1}
        />
      ))}
    </svg>
  );
}

function StepList({ activeStep }) {
  return (
    <Box sx={{ display: "flex", flexDirection: "column" }}>
      {STEPS.map(({ title, Icon }, i) => {
        const isActive = i === activeStep;
        const isDone = i < activeStep;
        const isFilled = isActive || isDone;
        return (
          <Box key={title} sx={{ display: "flex", alignItems: "flex-start", gap: 1.5 }}>
            <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <Box
                sx={{
                  width: 34,
                  height: 34,
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  bgcolor: isFilled ? "primary.main" : "rgba(202, 220, 246, 0.16)",
                  color: isFilled ? "#ffffff" : "#cadcf6",
                  transition: "background-color 0.2s ease, color 0.2s ease",
                }}
              >
                {isDone ? <CheckIcon sx={{ fontSize: 18 }} /> : <Icon sx={{ fontSize: 18 }} />}
              </Box>
              {i < STEPS.length - 1 && (
                <Box
                  sx={{
                    width: "2px",
                    flex: 1,
                    minHeight: 28,
                    bgcolor: isDone ? "primary.main" : "rgba(202, 220, 246, 0.16)",
                    my: 0.5,
                    transition: "background-color 0.2s ease",
                  }}
                />
              )}
            </Box>
            <Typography
              variant="body2"
              sx={{
                pt: 0.9,
                pb: i < STEPS.length - 1 ? 3.5 : 0,
                fontWeight: isActive ? 700 : 400,
                color: isActive ? "#ffffff" : "#cadcf6",
              }}
            >
              {title}
            </Typography>
          </Box>
        );
      })}
    </Box>
  );
}

// Label-left rows, exactly like the property setup form
const rowSx = {
  display: "flex",
  flexDirection: { xs: "column", sm: "row" },
  alignItems: { xs: "stretch", sm: "center" },
  gap: { xs: 0.8, sm: 3 },
};
const labelColSx = { width: { xs: "100%", sm: "34%" }, flexShrink: 0, textAlign: { sm: "right" } };
const fieldColSx = { width: { xs: "100%", sm: "66%" }, minWidth: 0 };
const labelStyle = {
  fontSize: "0.875rem",
  color: "text.secondary",
  fontWeight: 600,
  textAlign: { xs: "left", sm: "right" },
};

const RequiredMark = () => (
  <Box component="span" sx={{ color: "primary.main", ml: 0.4 }}>*</Box>
);

function FormRow({ label, required, top, children }) {
  return (
    <Box sx={{ ...rowSx, ...(top ? { alignItems: { xs: "stretch", sm: "flex-start" } } : {}) }}>
      <Box sx={{ ...labelColSx, ...(top ? { pt: { sm: 1.75 } } : {}) }}>
        <Typography sx={labelStyle}>
          {label}
          {required && <RequiredMark />}
        </Typography>
      </Box>
      <Box sx={fieldColSx}>{children}</Box>
    </Box>
  );
}

// The blue-tinted, orange-edged group used for the address on the setup page
function Group({ icon, title, children }) {
  return (
    <Box
      sx={{
        borderLeft: "3px solid",
        borderColor: "primary.main",
        bgcolor: "rgba(202, 220, 246, 0.18)",
        borderRadius: "0 4px 4px 0",
        p: { xs: 1.5, sm: 2 },
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, mb: 1.5 }}>
        {icon}
        <Typography variant="body2" color="text.secondary" fontWeight={600}>
          {title}
        </Typography>
      </Box>
      <Box sx={{ display: "flex", flexDirection: "column", gap: 1.75 }}>{children}</Box>
    </Box>
  );
}

export default function InviteCaretaker() {
  const navigate = useNavigate();
  const { currentUser } = useAuth() || {};

  const [step, setStep] = useState(0);
  const isLast = step === STEPS.length - 1;

  const [properties, setProperties] = useState([]);
  const [loadingProperties, setLoadingProperties] = useState(true);

  const [form, setForm] = useState({
    assignedPropertyId: "",
    fullName: "",
    email: "",
    mobilePhone: "",
  });
  const [fieldErrors, setFieldErrors] = useState({});

  const [permissionMode, setPermissionMode] = useState("full"); // "full" | "custom"
  const [customPermissions, setCustomPermissions] = useState(NO_PERMISSIONS);

  const [dispatchMethod, setDispatchMethod] = useState("email"); // "sms" | "email"

  const [submitting, setSubmitting] = useState(false);
  const [sendingSms, setSendingSms] = useState(false);
  const [error, setError] = useState(null);

  const scrollRef = useRef(null); // whole screen (phones)
  const mainRef = useRef(null); // content column (laptops)
  const scrollTop = () => {
    scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    mainRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  };

  useEffect(() => {
    async function fetchProperties() {
      if (!currentUser?.uid) {
        setLoadingProperties(false);
        return;
      }
      try {
        const q = query(
          collection(db, "properties"),
          where("ownerUid", "==", currentUser.uid),
        );
        const snap = await getDocs(q);
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setProperties(list);
        if (list.length === 1) setForm((prev) => ({ ...prev, assignedPropertyId: list[0].id }));
      } catch (err) {
        setError("Failed to load properties. Please refresh and try again.");
      } finally {
        setLoadingProperties(false);
      }
    }
    fetchProperties();
  }, [currentUser?.uid]);

  const updateField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setFieldErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const toggleCustomPermission = (key) =>
    setCustomPermissions((prev) => ({ ...prev, [key]: !prev[key] }));

  const flag = (name) => ({
    error: Boolean(fieldErrors[name]),
    helperText: fieldErrors[name] || undefined,
  });

  const validateStep = (s) => {
    const e = {};
    if (s === 0) {
      Object.entries(FIELD_VALIDATORS).forEach(([field, check]) => {
        const msg = check(form[field]);
        if (msg) e[field] = msg;
      });
    }
    if (s === 1) {
      if (!form.assignedPropertyId) e.assignedPropertyId = "Please select a property.";
      else if (!loadingProperties && !properties.some((p) => p.id === form.assignedPropertyId)) {
        e.assignedPropertyId = "That property is no longer available. Pick another.";
      }
    }
    return e;
  };

  // Check a single field when the user leaves it, so mistakes show up early
  const validateOnBlur = (field) => () => {
    const msg = FIELD_VALIDATORS[field]?.(form[field]);
    setFieldErrors((prev) => {
      const next = { ...prev };
      if (msg) next[field] = msg;
      else delete next[field];
      return next;
    });
  };

  const handleNext = () => {
    setError(null);
    const errs = validateStep(step);
    setFieldErrors(errs);
    if (Object.keys(errs).length > 0) {
      setError("Please fix the highlighted fields.");
      scrollTop();
      return;
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
    scrollTop();
  };

  const handleBack = () => {
    setError(null);
    setFieldErrors({});
    if (step === 0) {
      navigate("/owner/caretakers");
      return;
    }
    setStep((s) => s - 1);
    scrollTop();
  };

  const handleSubmit = async (e) => {
    e?.preventDefault?.();
    if (!isLast) return handleNext();
    if (submitting) return; // ignore double taps / double Enter
    setError(null);

    const errs = { ...validateStep(0), ...validateStep(1) };
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      setError("Some details need fixing. Check the highlighted fields.");
      setStep(errs.fullName || errs.email || errs.mobilePhone ? 0 : 1);
      scrollTop();
      return;
    }

    setSubmitting(true);
    try {
      const tempPassword = generateTempPassword();
      const permissions =
        permissionMode === "full" ? FULL_PERMISSIONS : customPermissions;

      const payload = {
        fullName: cleanName(form.fullName),
        email: form.email.trim().toLowerCase(),
        mobilePhone: toLocalPhMobile(form.mobilePhone), // stored as 09XXXXXXXXX
      };

      await createCaretakerAccount({
        fullName: payload.fullName,
        email: payload.email,
        mobilePhone: payload.mobilePhone,
        tempPassword,
        assignedPropertyId: form.assignedPropertyId,
        ownerUid: currentUser?.uid,
        permissions,
      });

      // The account now exists, so whatever happens with the text, we MUST reach
      // the next screen with the password — otherwise it would be lost.
      let smsStatus = null; // null (not requested) | "sent" | "failed"
      let smsError = null;
      if (dispatchMethod === "sms") {
        setSendingSms(true);
        const result = await sendCaretakerInviteSms({
          phone: payload.mobilePhone,
          email: payload.email,
          tempPassword,
          propertyId: form.assignedPropertyId,
        });
        setSendingSms(false);
        smsStatus = result.ok ? "sent" : "failed";
        smsError = result.ok ? null : result.error;
      }

      navigate("/owner/caretakers/invited", {
        state: {
          email: payload.email,
          tempPassword,
          dispatchMethod,
          smsStatus,
          smsError,
        },
      });
    } catch (err) {
      const code = String(err?.code || "");
      const text = `${code} ${err?.message || ""}`;
      if (/email-already-in-use|already in use|already exists/i.test(text)) {
        setFieldErrors({ email: "An account with this email already exists." });
        setError("That email is already registered. Use a different email.");
        setStep(0);
      } else if (/invalid-email/i.test(text)) {
        setFieldErrors({ email: "Enter a valid email, like name@example.com." });
        setError("The email address was rejected. Check it and try again.");
        setStep(0);
      } else if (/network|unavailable/i.test(text)) {
        setError("Couldn't reach the server. Check your connection and try again.");
      } else if (/permission|insufficient/i.test(text)) {
        setError("You don't have permission to invite caretakers for this property.");
      } else {
        setError(err?.message || "Something went wrong while creating the caretaker account.");
      }
      scrollTop();
    } finally {
      setSubmitting(false);
    }
  };

  const activePermissions = permissionMode === "full" ? FULL_PERMISSIONS : customPermissions;
  const grantedCount = Object.values(activePermissions).filter(Boolean).length;
  const propertyLabel = (p) => p.propertyName || p.name || "Unnamed property";
  const selectedProperty = properties.find((p) => p.id === form.assignedPropertyId);
  const noProperties = !loadingProperties && properties.length === 0;

  const reviewRows = [
    ["Caretaker", cleanName(form.fullName) || "—"],
    ["Email", form.email.trim().toLowerCase() || "—"],
    ["Mobile phone", formatLocalPhone(toLocalPhMobile(form.mobilePhone)) || "—"],
    ["Property", selectedProperty ? propertyLabel(selectedProperty) : "—"],
    ["Permissions", `${grantedCount} of ${PERMISSION_OPTIONS.length}`],
    ["Send via", dispatchMethod === "email" ? "Email" : "SMS"],
  ];

  return (
    <Box
      ref={scrollRef}
      sx={{
        // A focused flow like the property setup: covers the dashboard chrome.
        position: "fixed",
        inset: 0,
        zIndex: (t) => t.zIndex.modal - 1,
        bgcolor: "background.default",
        overflowY: { xs: "auto", md: "hidden" },
        overscrollBehavior: "contain",
        display: "flex",
        flexDirection: { xs: "column", md: "row" },
      }}
    >
      {/* Sidebar */}
      <Box
        sx={{
          flex: { xs: "0 0 auto", md: "0 0 300px" },
          bgcolor: "#202020",
          color: "#ffffff",
          display: "flex",
          flexDirection: "column",
          gap: 4,
          px: { xs: 3, md: 4 },
          py: { xs: 3, md: 5 },
          overflowY: { md: "auto" },
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <Box component="img" src="/KwartoKeeper-DarkMode-Icon.png" alt="KwartoKeeper" sx={{ height: 28 }} />
          <Typography sx={{ fontFamily: '"Inter", sans-serif', fontWeight: 700, fontSize: "1rem", flex: 1 }}>
            Invite caretaker
          </Typography>
          <IconButton
            aria-label="Cancel invite"
            onClick={() => navigate("/owner/caretakers")}
            disabled={submitting}
            size="small"
            sx={{ color: "#cadcf6", display: { md: "none" } }}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>

        {/* Mobile step indicator */}
        <Box sx={{ display: { xs: "block", md: "none" } }}>
          <Typography variant="body2" sx={{ color: "#cadcf6", mb: 1 }}>
            Step {step + 1} of {STEPS.length} — {STEPS[step].title}
          </Typography>
          <Box sx={{ display: "flex", gap: 0.75 }}>
            {STEPS.map(({ title }, i) => (
              <Box
                key={title}
                sx={{
                  flex: 1,
                  height: 4,
                  borderRadius: 2,
                  bgcolor: i <= step ? "primary.main" : "rgba(202, 220, 246, 0.2)",
                  transition: "background-color 0.2s ease",
                }}
              />
            ))}
          </Box>
        </Box>

        {/* Desktop step indicator */}
        <Box sx={{ display: { xs: "none", md: "block" } }}>
          <StepList activeStep={step} />
        </Box>

        <Box sx={{ display: { xs: "none", md: "block" }, mt: "auto" }}>
          <DormFacade />
        </Box>
      </Box>

      {/* Main content */}
      <Box
        ref={mainRef}
        component="form"
        onSubmit={handleSubmit}
        noValidate
        sx={{
          flex: 1,
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
          overflowY: { md: "auto" },
          bgcolor: "background.default",
        }}
      >
        <Box sx={{ flex: 1, display: "flex", justifyContent: "center", px: { xs: 3, md: 6 }, pt: { xs: 4, md: 6 } }}>
          <Box sx={{ width: "100%", maxWidth: 760 }}>
            {error && (
              <Alert severity="error" sx={{ mb: 3 }}>
                {error}
              </Alert>
            )}

            <Box sx={{ width: "100%", maxWidth: 700, mx: "auto", px: { xs: 0, sm: 2 }, pb: 4 }}>
              <Box sx={{ mb: 4 }}>
                <Typography variant="h5" sx={{ fontFamily: '"Inter", sans-serif', fontWeight: 600 }} color="text.primary">
                  {STEPS[step].heading}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  {STEPS[step].sub}
                </Typography>
              </Box>

              <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
                {/* ---------------- STEP 1: DETAILS ---------------- */}
                {step === 0 && (
                  <>
                    <FormRow label="Full name" required>
                      <TextField
                        fullWidth
                        placeholder="e.g. Maria Santos"
                        value={form.fullName}
                        onChange={(e) => updateField("fullName", e.target.value)}
                        onBlur={validateOnBlur("fullName")}
                        autoComplete="off"
                        inputProps={{ maxLength: 80 }}
                        {...flag("fullName")}
                      />
                    </FormRow>

                    <FormRow label="Email" required>
                      <TextField
                        fullWidth
                        type="email"
                        placeholder="name@example.com"
                        value={form.email}
                        onChange={(e) => updateField("email", e.target.value.replace(/\s/g, ""))}
                        onBlur={validateOnBlur("email")}
                        autoComplete="off"
                        inputProps={{ maxLength: 254, autoCapitalize: "none", spellCheck: false }}
                        helperText={fieldErrors.email || "They will sign in with this email."}
                        error={Boolean(fieldErrors.email)}
                      />
                    </FormRow>

                    <FormRow label="Mobile phone" required>
                      <TextField
                        fullWidth
                        type="tel"
                        placeholder="e.g. 09171234567"
                        value={form.mobilePhone}
                        onChange={(e) => updateField("mobilePhone", e.target.value.replace(/[^0-9+\s()-]/g, ""))}
                        onBlur={validateOnBlur("mobilePhone")}
                        inputProps={{ maxLength: 18, inputMode: "tel" }}
                        helperText={fieldErrors.mobilePhone || "Philippine mobile number, e.g. 09171234567"}
                        error={Boolean(fieldErrors.mobilePhone)}
                        slotProps={{
                          input: {
                            startAdornment: (
                              <InputAdornment position="start">
                                <PhoneOutlinedIcon sx={{ fontSize: 18, color: "text.secondary" }} />
                              </InputAdornment>
                            ),
                          },
                        }}
                      />
                    </FormRow>
                  </>
                )}

                {/* ---------------- STEP 2: PROPERTY & ACCESS ---------------- */}
                {step === 1 && (
                  <>
                    {noProperties && (
                      <Alert severity="warning">
                        You need a property before you can invite a caretaker. Set one up from the Properties page first.
                      </Alert>
                    )}

                    <FormRow label="Assigned property" required>
                      <TextField
                        select
                        fullWidth
                        label={loadingProperties ? "Loading properties…" : "Property"}
                        value={form.assignedPropertyId}
                        onChange={(e) => updateField("assignedPropertyId", e.target.value)}
                        disabled={loadingProperties || noProperties}
                        {...flag("assignedPropertyId")}
                      >
                        {properties.map((p) => (
                          <MenuItem key={p.id} value={p.id}>{propertyLabel(p)}</MenuItem>
                        ))}
                      </TextField>
                    </FormRow>

                    <FormRow label="Permissions" top>
                      <ToggleButtonGroup
                        value={permissionMode}
                        exclusive
                        onChange={(_, val) => val && setPermissionMode(val)}
                        fullWidth
                        size="small"
                        sx={{
                          mb: 1.5,
                          p: 0.5,
                          gap: 0.5,
                          bgcolor: "rgba(32, 32, 32, 0.07)", // quiet track
                          borderRadius: "12px",
                          "& .MuiToggleButtonGroup-grouped": {
                            m: 0,
                            border: 0,
                            borderRadius: "9px !important",
                            py: 0.9,
                            fontWeight: 700,
                            textTransform: "none",
                            color: "text.secondary",
                            bgcolor: "transparent",
                            transition: "background-color .15s ease, color .15s ease",
                            "&:not(:first-of-type)": { ml: 0, borderLeft: 0 },
                            "&:hover": { bgcolor: "rgba(32, 32, 32, 0.07)" },
                            "&.Mui-focusVisible": { outline: "2px solid", outlineColor: "primary.main", outlineOffset: 1 },
                          },
                          // Selected segment: solid brand orange, white text
                          "& .MuiToggleButtonGroup-grouped.Mui-selected": {
                            bgcolor: "primary.main",
                            color: "#ffffff",
                            "&:hover": { bgcolor: "primary.dark" },
                          },
                        }}
                      >
                        <ToggleButton value="full">Full access</ToggleButton>
                        <ToggleButton value="custom">Custom</ToggleButton>
                      </ToggleButtonGroup>

                      <Group icon={<SecurityOutlinedIcon sx={{ fontSize: 18, color: "primary.main" }} />} title={permissionMode === "full" ? "Full access includes everything below" : "Switch on what they can do"}>
                        {PERMISSION_OPTIONS.map((p) => {
                          const on = Boolean(activePermissions[p.key]);
                          const custom = permissionMode === "custom";
                          return (
                            <Box
                              key={p.key}
                              component={custom ? "button" : "div"}
                              {...(custom ? { type: "button", onClick: () => toggleCustomPermission(p.key), "aria-pressed": on } : {})}
                              sx={{
                                display: "flex", alignItems: "center", gap: 1.5, width: "100%",
                                textAlign: "left", font: "inherit", color: "inherit",
                                bgcolor: "transparent", border: 0, p: 0,
                                cursor: custom ? "pointer" : "default",
                              }}
                            >
                              <Box sx={{ minWidth: 0, flex: 1 }}>
                                <Typography variant="body2" sx={{ fontWeight: on ? 700 : 500, color: on ? "text.primary" : "text.secondary" }}>{p.label}</Typography>
                                <Typography variant="caption" color="text.secondary">{p.desc}</Typography>
                              </Box>
                              <Switch
                                checked={on}
                                tabIndex={-1}
                                disableRipple
                                inputProps={{ "aria-label": p.label }}
                                sx={{ ...permSwitchSx, pointerEvents: "none" }}
                              />
                            </Box>
                          );
                        })}
                      </Group>
                      {permissionMode === "custom" && grantedCount === 0 && (
                        <Typography variant="caption" color="warning.dark" sx={{ display: "block", mt: 1, fontWeight: 600 }}>
                          Nothing selected yet. They could sign in but not do anything.
                        </Typography>
                      )}
                    </FormRow>
                  </>
                )}

                {/* ---------------- STEP 3: SEND ---------------- */}
                {step === 2 && (
                  <>
                    <FormRow label="Send invitation via" required>
                      <TextField select fullWidth value={dispatchMethod} onChange={(e) => setDispatchMethod(e.target.value)}>
                        <MenuItem value="email">Email invitation link</MenuItem>
                        <MenuItem value="sms">SMS with temporary password</MenuItem>
                      </TextField>
                    </FormRow>

                    <FormRow label="Review" top>
                      <Box sx={{ bgcolor: "background.paper", borderRadius: "4px", border: "1px solid", borderColor: "divider", p: 2 }}>
                        <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                          {reviewRows.map(([label, value]) => (
                            <Box key={label} sx={{ display: "flex", gap: 2, justifyContent: "space-between" }}>
                              <Typography variant="body2" color="text.secondary" sx={{ flexShrink: 0 }}>{label}</Typography>
                              <Typography variant="body2" sx={{ fontWeight: 700, textAlign: "right", minWidth: 0, wordBreak: "break-word" }}>{value}</Typography>
                            </Box>
                          ))}
                        </Box>
                      </Box>
                      <Box sx={{ display: "flex", gap: 1.25, alignItems: "flex-start", color: "text.secondary", mt: 1.5 }}>
                        <InfoOutlinedIcon sx={{ fontSize: 18, mt: "2px", color: "primary.main" }} />
                        <Typography variant="caption" sx={{ fontSize: "0.8rem" }}>
                          A temporary password is generated when you send the invite. You will always see it on the next screen too, in case a message doesn't arrive.
                        </Typography>
                      </Box>
                    </FormRow>
                  </>
                )}
              </Box>
            </Box>
          </Box>
        </Box>

        {/* Back / Next — pinned to the bottom of the column so it stays reachable on phones */}
        <Box
          sx={{
            position: "sticky",
            bottom: 0,
            bgcolor: "background.default",
            display: "flex",
            justifyContent: "center",
            px: { xs: 3, md: 6 },
            pb: "calc(16px + env(safe-area-inset-bottom, 0px))",
            pt: 2,
          }}
        >
          <Box sx={{ width: "100%", maxWidth: 760, display: "flex", justifyContent: "space-between", gap: 2, pt: 2, borderTop: "1px solid", borderColor: "divider" }}>
            <Button variant="outlined" onClick={handleBack} disabled={submitting} sx={{ py: 1.5, px: 3, fontWeight: 600 }}>
              {step === 0 ? "Cancel" : "Back"}
            </Button>
            <Button
              type={isLast ? "submit" : "button"}
              onClick={isLast ? undefined : handleNext}
              variant="contained"
              disabled={submitting || (step === 1 && noProperties)}
              sx={{ py: 1.5, px: 3, fontWeight: 600, minWidth: { xs: 140, sm: 160 }, bgcolor: "primary.main", "&:hover": { bgcolor: "primary.dark" } }}
            >
              {submitting ? (
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                  <CircularProgress size={20} color="inherit" />
                  {sendingSms ? "Sending SMS…" : "Creating…"}
                </Box>
              ) : isLast ? "Send invite" : "Next step"}
            </Button>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}