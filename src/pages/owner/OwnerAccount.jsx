// src/pages/owner/OwnerAccount.jsx

import { useEffect, useRef, useState } from "react";
import {
  Alert,
  Avatar,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  InputAdornment,
  MenuItem,
  Skeleton,
  Snackbar,
  TextField,
  Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import PersonOutlineIcon from "@mui/icons-material/PersonOutlined";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import CheckCircleOutlinedIcon from "@mui/icons-material/CheckCircleOutlined";
import CheckIcon from "@mui/icons-material/Check";
import HourglassTopIcon from "@mui/icons-material/HourglassTop";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutlined";
import MailOutlineIcon from "@mui/icons-material/MailOutlined";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import VerifiedUserOutlinedIcon from "@mui/icons-material/VerifiedUserOutlined";
import ReceiptLongOutlinedIcon from "@mui/icons-material/ReceiptLongOutlined";
import StorefrontOutlinedIcon from "@mui/icons-material/StorefrontOutlined";
import ShieldOutlinedIcon from "@mui/icons-material/ShieldOutlined";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import { doc, onSnapshot, runTransaction, setDoc } from "firebase/firestore";
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
  updateProfile,
  verifyBeforeUpdateEmail,
} from "firebase/auth";
import { auth, db } from "../../config/firebase";
import { uploadFileToCloudinary } from "../../utils/cloudinary";
import { formatReceiptNo } from "../../utils/receipt";
import { resubmissionPatch } from "../../utils/ownerAccess";
import FilePreviewDialog from "../../components/FilePreviewDialog";

const HEAD = '"Inter", sans-serif';
const R = { sm: "10px", md: "14px", lg: "18px", xl: "22px" };
const row = { display: "flex", alignItems: "center" };
const MAX_DOC_MB = 10;
const panelSx = { bgcolor: "background.default", border: "1px solid", borderColor: "divider", borderRadius: R.lg, minWidth: 0 };
const fieldSx = { "& .MuiOutlinedInput-root": { borderRadius: R.sm } };

const STATUS = {
  pending: { label: "Under review", tone: "warning" },
  approved: { label: "Verified", tone: "success" },
  verified: { label: "Verified", tone: "success" },
  rejected: { label: "Needs attention", tone: "error" },
};

const DOC_SLOTS = [
  { key: "idUrl", label: "Government ID", hint: "A clear photo or PDF of a valid ID (PhilID, driver's license, passport...)." },
  { key: "clearanceUrl", label: "Proof of ownership", hint: "Land title, tax declaration, lease / authorization letter, or a business permit." },
];

const VAT_OPTIONS = [
  { value: "", label: "Not shown on receipts" },
  { value: "non_vat", label: "NON-VAT Registered" },
  { value: "vat", label: "VAT Registered" },
];

const SECTIONS = [
  { id: "profile", label: "Profile", Icon: PersonOutlineIcon },
  { id: "business", label: "Business & receipts", Icon: StorefrontOutlinedIcon },
  { id: "security", label: "Sign-in & security", Icon: ShieldOutlinedIcon },
  { id: "verification", label: "Verification", Icon: VerifiedUserOutlinedIcon },
];

const initials = (name) =>
  (name || "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("") || "?";

const prettySize = (bytes) => (bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`);
const formatDate = (v) => {
  if (!v) return "";
  const d = v?.toDate ? v.toDate() : new Date(v);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
};
const isPdfUrl = (u) => /\.pdf(\?|$)/i.test(u || "");

const validPhone = (v) => /^(09\d{9}|\+639\d{9})$/.test(v.replace(/[\s-]/g, ""));
const validTin = (v) => /^\d{3}-?\d{3}-?\d{3}(-?\d{3,5})?$/.test(v.trim());

// Business details as saved on the profile (the same fields the printed receipt reads)
const bizFrom = (o = {}) => ({
  registeredName: o.registeredName || "",
  tinNumber: o.tinNumber || "",
  businessAddress: o.businessAddress || "",
  vatStatus: o.vatStatus || "",
  receiptPrefix: o.receiptPrefix || "",
  receiptNextNo: String(Math.max(1, Math.floor(Number(o.receiptNextNo)) || 1)),
});

function Pill({ label, tone = "default", icon }) {
  return (
    <Box
      component="span"
      sx={{
        ...row,
        gap: 0.5,
        px: 1,
        height: 24,
        borderRadius: 99,
        fontSize: 12.5,
        fontWeight: 700,
        whiteSpace: "nowrap",
        "& svg": { fontSize: 15 },
        bgcolor: (t) => (tone === "default" ? alpha(t.palette.text.primary, 0.06) : alpha(t.palette[tone].main, 0.12)),
        color: (t) => (tone === "default" ? t.palette.text.secondary : t.palette[tone].dark),
      }}
    >
      {icon}
      {label}
    </Box>
  );
}

// One settings card: icon + title + description, the fields, then a footer with the save button
function Section({ id, icon: Icon, title, subtitle, children, footer }) {
  return (
    <Box component="section" id={id} sx={{ ...panelSx, overflow: "hidden", scrollMarginTop: { xs: 72, md: 96 } }}>
      <Box sx={{ ...row, alignItems: "flex-start", gap: 1.5, px: { xs: 2, sm: 3 }, pt: { xs: 2, sm: 2.5 }, pb: 2 }}>
        <Box sx={{ width: 38, height: 38, borderRadius: R.sm, flexShrink: 0, display: "grid", placeItems: "center", bgcolor: "rgba(255,69,0,.1)", color: "primary.main" }}>
          <Icon sx={{ fontSize: 20 }} />
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontFamily: HEAD, fontWeight: 800, fontSize: "1.05rem", lineHeight: 1.3 }}>{title}</Typography>
          {subtitle && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25, overflowWrap: "anywhere" }}>
              {subtitle}
            </Typography>
          )}
        </Box>
      </Box>
      <Box sx={{ px: { xs: 2, sm: 3 }, pb: footer ? 2.5 : { xs: 2, sm: 3 } }}>{children}</Box>
      {footer && (
        <Box
          sx={{
            display: "flex",
            flexDirection: { xs: "column-reverse", sm: "row" },
            alignItems: { xs: "stretch", sm: "center" },
            justifyContent: "flex-end",
            gap: 1.25,
            px: { xs: 2, sm: 3 },
            py: 1.5,
            borderTop: "1px solid",
            borderColor: "divider",
            bgcolor: (t) => alpha(t.palette.background.paper, 0.35),
          }}
        >
          {footer}
        </Box>
      )}
    </Box>
  );
}

// A heading inside a section (e.g. "Email" and "Password" under Sign-in & security)
function SubHeading({ icon: Icon, children, first }) {
  return (
    <Box sx={{ ...row, gap: 1, mb: 1.5, ...(first ? {} : { mt: 3, pt: 2.5, borderTop: "1px solid", borderColor: "divider" }) }}>
      <Icon sx={{ fontSize: 18, color: "text.secondary" }} />
      <Typography sx={{ fontWeight: 800, fontSize: "0.95rem" }}>{children}</Typography>
    </Box>
  );
}

function SaveButton({ busy, disabled, children, ...rest }) {
  return (
    <Button
      variant="contained"
      disableElevation
      disabled={busy || disabled}
      startIcon={busy ? <CircularProgress size={16} color="inherit" /> : null}
      sx={{ fontWeight: 700, borderRadius: R.sm, minHeight: 44, px: 2.5 }}
      {...rest}
    >
      {children}
    </Button>
  );
}

function PasswordField({ label, value, onChange, error, helperText, autoComplete }) {
  const [show, setShow] = useState(false);
  return (
    <TextField
      label={label}
      type={show ? "text" : "password"}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      fullWidth
      autoComplete={autoComplete}
      error={!!error}
      helperText={error || helperText}
      sx={fieldSx}
      slotProps={{
        input: {
          endAdornment: (
            <InputAdornment position="end">
              <IconButton edge="end" aria-label={show ? "Hide password" : "Show password"} onClick={() => setShow((v) => !v)}>
                {show ? <VisibilityOff /> : <Visibility />}
              </IconButton>
            </InputAdornment>
          ),
        },
      }}
    />
  );
}

const friendlyAuthError = (err) => {
  switch (err?.code) {
    case "auth/wrong-password":
    case "auth/invalid-credential":
    case "auth/invalid-login-credentials":
      return "That current password isn't right.";
    case "auth/too-many-requests":
      return "Too many attempts. Please wait a few minutes and try again.";
    case "auth/weak-password":
      return "Choose a stronger password (at least 8 characters).";
    case "auth/email-already-in-use":
      return "That email is already used by another account.";
    case "auth/invalid-email":
      return "That email address isn't valid.";
    case "auth/requires-recent-login":
      return "For your security, please log out and log in again, then retry.";
    default:
      return "Something went wrong. Check your connection and try again.";
  }
};

// One verification document: thumbnail, state, and replace / view actions.
function DocCard({ slot, current, file, onPick, onUndo, onView }) {
  const [imgFailed, setImgFailed] = useState(false);
  const showThumb = current && !file && !isPdfUrl(current) && !imgFailed;
  const state = file ? { label: "New file ready", tone: "info" } : current ? { label: "On file", tone: "success" } : { label: "Missing", tone: "warning" };

  return (
    <Box sx={{ border: "1px solid", borderColor: file ? "primary.main" : "divider", borderRadius: R.md, p: 1.5, bgcolor: file ? (t) => alpha(t.palette.primary.main, 0.03) : "transparent" }}>
      <Box sx={{ ...row, alignItems: "flex-start", gap: 1.5 }}>
        <Box
          component={current && !file ? "button" : "div"}
          type={current && !file ? "button" : undefined}
          onClick={current && !file ? onView : undefined}
          aria-label={current && !file ? `View ${slot.label}` : undefined}
          sx={{
            width: 64, height: 64, borderRadius: R.sm, flexShrink: 0, overflow: "hidden", display: "grid", placeItems: "center", border: 0, p: 0,
            bgcolor: (t) => alpha(t.palette.text.primary, 0.05), cursor: current && !file ? "pointer" : "default",
          }}
        >
          {showThumb ? (
            <Box component="img" src={current} alt={slot.label} onError={() => setImgFailed(true)} sx={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <DescriptionOutlinedIcon sx={{ fontSize: 28, color: "text.disabled" }} />
          )}
        </Box>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Box sx={{ ...row, justifyContent: "space-between", gap: 1, flexWrap: "wrap" }}>
            <Typography sx={{ fontWeight: 700 }}>{slot.label}</Typography>
            <Pill label={state.label} tone={state.tone} />
          </Box>
          <Typography variant="caption" color="text.secondary" component="div" sx={{ mt: 0.25, overflowWrap: "anywhere" }}>
            {file ? `${file.name} · ${prettySize(file.size)}` : slot.hint}
          </Typography>
        </Box>
      </Box>

      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mt: 1.5 }}>
        <Button component="label" variant="outlined" size="small" startIcon={<UploadFileIcon />} sx={{ fontWeight: 700, minHeight: 40, borderRadius: R.sm, flex: { xs: 1, sm: "none" } }}>
          {current || file ? "Replace" : "Upload"}
          <input type="file" hidden accept="image/*,.pdf" onChange={(e) => { onPick(e.target.files?.[0] || null); e.target.value = ""; }} />
        </Button>
        {current && !file && (
          <Button size="small" onClick={onView} sx={{ fontWeight: 700, minHeight: 40, flex: { xs: 1, sm: "none" } }}>
            View
          </Button>
        )}
        {file && (
          <Button size="small" color="inherit" onClick={onUndo} sx={{ fontWeight: 700, minHeight: 40, flex: { xs: 1, sm: "none" } }}>
            Undo
          </Button>
        )}
      </Box>
    </Box>
  );
}

export default function OwnerAccount() {
  const user = auth.currentUser;
  const uid = user?.uid;
  // Google / other sign-ins have no password here, so those sections are hidden.
  const hasPassword = !!user?.providerData?.some((p) => p.providerId === "password");

  const [owner, setOwner] = useState(null);
  const [loading, setLoading] = useState(() => Boolean(uid)); // signed out: nothing to load
  const [toast, setToast] = useState({ open: false, message: "", severity: "success" });
  const notify = (message, severity = "success") => setToast({ open: true, message, severity });

  // profile
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [profileTouched, setProfileTouched] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);

  // business & receipts
  const [biz, setBiz] = useState(() => bizFrom());
  const [bizTouched, setBizTouched] = useState(false);
  const [savingBiz, setSavingBiz] = useState(false);

  // email
  const [newEmail, setNewEmail] = useState("");
  const [emailPassword, setEmailPassword] = useState("");
  const [emailError, setEmailError] = useState("");
  const [emailSent, setEmailSent] = useState(false);
  const [savingEmail, setSavingEmail] = useState(false);

  // password
  const [curPw, setCurPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwError, setPwError] = useState("");
  const [savingPw, setSavingPw] = useState(false);

  // documents
  const [files, setFiles] = useState({});
  const [docError, setDocError] = useState("");
  const [confirmDocs, setConfirmDocs] = useState(false);
  const [savingDocs, setSavingDocs] = useState(false);
  const [previewFile, setPreviewFile] = useState(null);

  // Fill the forms once, from the first snapshot (don't overwrite what's being typed)
  const seeded = useRef(false);
  useEffect(() => {
    if (!uid) return undefined;
    return onSnapshot(
      doc(db, "users", uid),
      (snap) => {
        const data = snap.exists() ? { id: snap.id, ...snap.data() } : null;
        setOwner(data);
        if (data && !seeded.current) {
          seeded.current = true;
          setName(data.fullName || data.name || auth.currentUser?.displayName || "");
          setPhone(data.phoneNumber || data.phone || data.mobile || "");
          setBiz(bizFrom(data));
        }
        setLoading(false);
      },
      (err) => {
        console.error("Error loading account:", err);
        setLoading(false);
      }
    );
  }, [uid]);

  // After the owner confirms a new email from the link we send, Auth has the new
  // address but the profile record still has the old one. Sync it here.
  useEffect(() => {
    if (!owner || !user?.email) return;
    if (owner.email && owner.email.toLowerCase() !== user.email.toLowerCase()) {
      setDoc(doc(db, "users", uid), { email: user.email, updatedAt: new Date().toISOString() }, { merge: true }).catch(() => {});
    }
  }, [owner, user, uid]);

  // ---------- profile ----------
  const nameError = !name.trim() ? "Enter your name." : "";
  const phoneError = phone.trim() && !validPhone(phone) ? "Use a PH mobile number like 09171234567." : "";
  const profileDirty =
    name.trim() !== (owner?.fullName || owner?.name || "") ||
    phone.trim() !== (owner?.phoneNumber || owner?.phone || owner?.mobile || "");

  const saveProfile = async () => {
    setProfileTouched(true);
    if (nameError || phoneError || savingProfile) return;
    setSavingProfile(true);
    try {
      const cleanName = name.trim();
      const cleanPhone = phone.replace(/[\s-]/g, "");
      // Write to the field names the account already uses, so nothing else breaks.
      const update = { fullName: cleanName, updatedAt: new Date().toISOString() };
      if (owner?.name !== undefined) update.name = cleanName;
      if (owner?.phone !== undefined && owner?.phoneNumber === undefined) update.phone = cleanPhone;
      else update.phoneNumber = cleanPhone;
      await setDoc(doc(db, "users", uid), update, { merge: true });
      if (user) await updateProfile(user, { displayName: cleanName }).catch(() => {});
      setProfileTouched(false);
      notify("Profile saved.");
    } catch (err) {
      console.error(err);
      notify("Couldn't save your profile. Try again.", "error");
    } finally {
      setSavingProfile(false);
    }
  };

  // ---------- business & receipts ----------
  // Numbers already issued can't be reused, so the next number never goes below the saved one
  const minNextNo = Math.max(1, Math.floor(Number(owner?.receiptNextNo)) || 1);
  const nextNoNum = Number(biz.receiptNextNo);
  const bizErrors = {
    tinNumber: biz.tinNumber.trim() && !validTin(biz.tinNumber) ? "Use the 9 to 14 digit TIN, e.g. 123-456-789-000." : "",
    receiptPrefix: /[^A-Za-z0-9-]/.test(biz.receiptPrefix) ? "Letters, numbers and dashes only." : biz.receiptPrefix.length > 10 ? "Keep it to 10 characters." : "",
    receiptNextNo: !Number.isInteger(nextNoNum) || nextNoNum < 1
      ? "Enter a whole number."
      : nextNoNum < minNextNo
        ? `Can't go below ${minNextNo}: earlier numbers are already used.`
        : "",
    businessAddress: biz.businessAddress.length > 200 ? "Keep it under 200 characters." : "",
  };
  const bizHasErrors = Object.values(bizErrors).some(Boolean);
  const bizSaved = bizFrom(owner || {});
  const bizDirty = Object.keys(bizSaved).some((k) => String(biz[k]).trim() !== String(bizSaved[k]).trim());
  const setBizField = (k) => (e) => setBiz((b) => ({ ...b, [k]: k === "receiptPrefix" ? e.target.value.toUpperCase() : e.target.value }));

  const saveBiz = async () => {
    setBizTouched(true);
    if (bizHasErrors || savingBiz) return;
    setSavingBiz(true);
    try {
      const requested = Math.floor(nextNoNum);
      // A receipt may be issued while this form is open: never move the counter backwards
      await runTransaction(db, async (tx) => {
        const ref = doc(db, "users", uid);
        const snap = await tx.get(ref);
        const current = Math.max(1, Math.floor(Number(snap.data()?.receiptNextNo)) || 1);
        tx.set(
          ref,
          {
            registeredName: biz.registeredName.trim(),
            tinNumber: biz.tinNumber.trim(),
            businessAddress: biz.businessAddress.trim(),
            vatStatus: biz.vatStatus,
            receiptPrefix: biz.receiptPrefix.trim(),
            receiptNextNo: Math.max(requested, current),
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        );
      });
      setBizTouched(false);
      notify("Business details saved. New receipts will use them.");
    } catch (err) {
      console.error(err);
      notify("Couldn't save your business details. Try again.", "error");
    } finally {
      setSavingBiz(false);
    }
  };

  // ---------- email ----------
  const changeEmail = async () => {
    setEmailError("");
    const next = newEmail.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(next)) return setEmailError("Enter a valid email address.");
    if (next === user.email.toLowerCase()) return setEmailError("That's already your email.");
    if (!emailPassword) return setEmailError("Enter your current password to confirm.");
    setSavingEmail(true);
    try {
      await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, emailPassword));
      await verifyBeforeUpdateEmail(user, next);
      setEmailSent(true);
      setNewEmail("");
      setEmailPassword("");
    } catch (err) {
      console.error(err);
      setEmailError(friendlyAuthError(err));
    } finally {
      setSavingEmail(false);
    }
  };

  // ---------- password ----------
  const pwChecks = [
    { ok: newPw.length >= 8, label: "At least 8 characters" },
    { ok: newPw.length > 0 && newPw !== curPw, label: "Different from your current password" },
    { ok: confirmPw.length > 0 && confirmPw === newPw, label: "Both new passwords match" },
  ];

  const changePassword = async () => {
    setPwError("");
    if (!curPw) return setPwError("Enter your current password.");
    if (newPw.length < 8) return setPwError("The new password must be at least 8 characters.");
    if (newPw === curPw) return setPwError("The new password must be different from the current one.");
    if (newPw !== confirmPw) return setPwError("The new passwords don't match.");
    setSavingPw(true);
    try {
      await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, curPw));
      await updatePassword(user, newPw);
      setCurPw("");
      setNewPw("");
      setConfirmPw("");
      notify("Password changed.");
    } catch (err) {
      console.error(err);
      setPwError(friendlyAuthError(err));
    } finally {
      setSavingPw(false);
    }
  };

  // ---------- documents ----------
  const pickFile = (key, file) => {
    setDocError("");
    setFiles((f) => ({ ...f, [key]: file }));
  };
  const chosen = Object.entries(files).filter(([, f]) => f);

  const askToSubmitDocs = () => {
    for (const [key, f] of chosen) {
      const label = DOC_SLOTS.find((s) => s.key === key).label;
      if (!/^image\//i.test(f.type) && f.type !== "application/pdf") return setDocError(`${label} must be a photo or a PDF.`);
      if (f.size > MAX_DOC_MB * 1024 * 1024) return setDocError(`${label} is over ${MAX_DOC_MB} MB. Please use a smaller file.`);
    }
    setConfirmDocs(true);
  };

  const submitDocs = async () => {
    if (savingDocs) return;
    setSavingDocs(true);
    setDocError("");
    try {
      const uploaded = {};
      await Promise.all(
        chosen.map(async ([key, f]) => {
          uploaded[key] = await uploadFileToCloudinary(f, MAX_DOC_MB);
        })
      );
      const verificationDocs = { ...(owner?.verificationDocs || {}), ...uploaded, submittedAt: new Date().toISOString() };
      await setDoc(doc(db, "users", uid), { verificationDocs, ...resubmissionPatch(owner) }, { merge: true });
      setFiles({});
      setConfirmDocs(false);
      notify("Documents submitted for review.");
    } catch (err) {
      console.error(err);
      setConfirmDocs(false);
      setDocError(
        err?.message && /size limit|Cloudinary|upload/i.test(err.message)
          ? err.message
          : "Couldn't submit your documents. Check your connection and try again."
      );
    } finally {
      setSavingDocs(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ maxWidth: 1100, mx: "auto" }}>
        <Skeleton variant="rounded" height={180} sx={{ borderRadius: R.xl, mb: 2.5 }} />
        <Skeleton variant="rounded" height={280} sx={{ borderRadius: R.lg, mb: 2 }} />
        <Skeleton variant="rounded" height={280} sx={{ borderRadius: R.lg }} />
      </Box>
    );
  }

  if (!owner) {
    return <Alert severity="error" sx={{ borderRadius: R.md }}>Couldn't load your account. Please refresh the page.</Alert>;
  }

  const statusKey = String(owner.approvalStatus || "pending").toLowerCase();
  const status = STATUS[statusKey] || STATUS.pending;
  const docs = owner.verificationDocs || {};
  const docsOnFile = DOC_SLOTS.filter((s) => docs[s.key]).length;
  const wasApproved = ["approved", "verified"].includes(statusKey);
  const displayName = owner.fullName || owner.name || user?.displayName || "Property owner";
  const memberSince = formatDate(owner.createdAt || user?.metadata?.creationTime);
  const receiptPreview = formatReceiptNo(biz.receiptPrefix.trim(), Number.isInteger(nextNoNum) && nextNoNum > 0 ? nextNoNum : minNextNo);
  const showBizErr = (k) => (bizTouched ? bizErrors[k] : k === "receiptNextNo" || k === "receiptPrefix" ? bizErrors[k] : "");

  const statusNote = {
    pending: { Icon: HourglassTopIcon, severity: "warning", text: "Your documents are being reviewed by our admin team. You'll get a notification when it's done." },
    approved: { Icon: CheckCircleOutlinedIcon, severity: "success", text: "Your account is verified. Replacing a document sends your account back for review." },
    verified: { Icon: CheckCircleOutlinedIcon, severity: "success", text: "Your account is verified. Replacing a document sends your account back for review." },
    rejected: { Icon: ErrorOutlineIcon, severity: "error", text: "Your last submission was declined. Replace the documents below and submit them again." },
  }[statusKey] || null;

  const tiles = [
    { label: "Verification", icon: <VerifiedUserOutlinedIcon />, value: status.label, tone: status.tone, sub: `${docsOnFile} of ${DOC_SLOTS.length} documents on file` },
    { label: "Next receipt", icon: <ReceiptLongOutlinedIcon />, value: formatReceiptNo(owner.receiptPrefix, minNextNo), sub: owner.registeredName ? `Issued as ${owner.registeredName}` : "Add business details below" , tone: owner.registeredName ? null : "warning" },
    { label: "Sign-in", icon: <LockOutlinedIcon />, value: hasPassword ? "Email & password" : "Outside account", sub: user?.email || owner.email || "" },
    { label: "Member since", icon: <PersonOutlineIcon />, value: memberSince || "—", sub: owner.phoneNumber || owner.phone || "No mobile number" },
  ];

  const jump = (id) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  const formSx = { display: "flex", flexDirection: "column", gap: 2 };
  const twoCols = { display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "repeat(2, minmax(0, 1fr))" }, gap: 2 };
  const onSubmit = (fn) => (e) => {
    e.preventDefault();
    fn();
  };

  return (
    <Box sx={{ maxWidth: 1100, mx: "auto" }}>
      {/* ───── Header: who, status, key facts ───── */}
      <Box component="section" sx={{ ...panelSx, position: "relative", overflow: "hidden", borderRadius: R.xl, p: { xs: 2, sm: 3 }, mb: { xs: 2, sm: 2.5 } }}>
        <Box aria-hidden sx={{ position: "absolute", top: -180, right: -120, width: 380, height: 380, borderRadius: "50%", background: "rgba(255,69,0,.10)", filter: "blur(70px)", pointerEvents: "none" }} />

        <Box sx={{ position: "relative", ...row, gap: { xs: 1.5, sm: 2 }, mb: { xs: 2, sm: 2.5 } }}>
          <Avatar sx={{ width: { xs: 56, sm: 68 }, height: { xs: 56, sm: 68 }, fontFamily: HEAD, fontWeight: 800, fontSize: { xs: "1.2rem", sm: "1.45rem" }, bgcolor: "primary.main", color: "#fff", flexShrink: 0 }}>
            {initials(displayName)}
          </Avatar>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Box sx={{ display: "flex", alignItems: "center", flexWrap: "wrap", columnGap: 1.25, rowGap: 0.5 }}>
              <Typography component="h1" sx={{ fontFamily: HEAD, fontWeight: 900, letterSpacing: "-0.02em", fontSize: { xs: "1.3rem", sm: "1.7rem" }, lineHeight: 1.2, overflowWrap: "anywhere" }}>
                {displayName}
              </Typography>
              <Pill label={status.label} tone={status.tone} icon={status.tone === "success" ? <CheckCircleOutlinedIcon /> : status.tone === "error" ? <ErrorOutlineIcon /> : <HourglassTopIcon />} />
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25, overflowWrap: "anywhere" }}>
              Property owner · {user?.email || owner.email}
            </Typography>
          </Box>
        </Box>

        <Box sx={{ position: "relative", display: "grid", gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", md: "repeat(4, minmax(0, 1fr))" }, gap: { xs: 1, sm: 1.5 } }}>
          {tiles.map((t) => (
            <Box key={t.label} sx={{ minWidth: 0, display: "flex", alignItems: "flex-start", gap: 1.25, p: { xs: 1.25, sm: 1.75 }, borderRadius: R.md, bgcolor: (th) => alpha(th.palette.background.paper, 0.55) }}>
              <Box sx={{ width: { xs: 32, sm: 38 }, height: { xs: 32, sm: 38 }, flexShrink: 0, borderRadius: R.sm, display: { xs: "none", sm: "grid" }, placeItems: "center", bgcolor: "#fff", color: t.tone ? `${t.tone}.main` : "primary.main", "& svg": { fontSize: 20 } }}>
                {t.icon}
              </Box>
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography variant="caption" color="text.secondary" noWrap sx={{ fontWeight: 600, display: "block" }}>
                  {t.label}
                </Typography>
                <Typography noWrap sx={{ fontFamily: HEAD, fontWeight: 800, letterSpacing: "-0.01em", fontSize: { xs: "0.98rem", sm: "1.1rem" }, lineHeight: 1.4, color: t.tone ? `${t.tone}.dark` : "text.primary" }}>
                  {t.value}
                </Typography>
                {t.sub && (
                  <Typography variant="caption" color="text.secondary" noWrap component="div">
                    {t.sub}
                  </Typography>
                )}
              </Box>
            </Box>
          ))}
        </Box>
      </Box>

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "210px minmax(0, 1fr)" }, gap: { xs: 2, md: 3 }, alignItems: "start" }}>
        {/* ───── Section nav: sticky list on desktop, scrolling pills on phones ───── */}
        <Box
          component="nav"
          aria-label="Account sections"
          sx={{
            position: { md: "sticky" },
            top: { md: 96 },
            display: "flex",
            flexDirection: { xs: "row", md: "column" },
            gap: 0.5,
            overflowX: { xs: "auto", md: "visible" },
            mx: { xs: -2, sm: 0 },
            px: { xs: 2, sm: 0 },
            scrollbarWidth: "none",
            "&::-webkit-scrollbar": { display: "none" },
          }}
        >
          {SECTIONS.filter((s) => s.id !== "security" || hasPassword).map(({ id, label, Icon }) => (
            <Box
              key={id}
              component="button"
              type="button"
              onClick={() => jump(id)}
              sx={{
                ...row,
                gap: 1.25,
                flexShrink: 0,
                height: { xs: 36, md: 42 },
                px: { xs: 1.5, md: 1.5 },
                borderRadius: { xs: 99, md: R.sm },
                border: { xs: "1px solid", md: 0 },
                borderColor: "divider",
                font: "inherit",
                fontSize: 14,
                fontWeight: 700,
                cursor: "pointer",
                textAlign: "left",
                color: "text.secondary",
                bgcolor: { xs: "background.default", md: "transparent" },
                "&:hover": { color: "text.primary", bgcolor: (t) => alpha(t.palette.text.primary, 0.05) },
              }}
            >
              <Icon sx={{ fontSize: 19, display: { xs: "none", md: "block" } }} />
              {label}
            </Box>
          ))}
        </Box>

        <Box sx={{ display: "flex", flexDirection: "column", gap: { xs: 2, sm: 2.5 }, minWidth: 0 }}>
          {/* ───── Profile ───── */}
          <Box component="form" noValidate onSubmit={onSubmit(saveProfile)}>
            <Section
              id="profile"
              icon={PersonOutlineIcon}
              title="Profile"
              subtitle="How you appear to your tenants and caretakers."
              footer={
                <>
                  {profileDirty && (
                    <Button color="inherit" onClick={() => { setName(owner.fullName || owner.name || ""); setPhone(owner.phoneNumber || owner.phone || owner.mobile || ""); setProfileTouched(false); }} sx={{ fontWeight: 700 }}>
                      Discard
                    </Button>
                  )}
                  <SaveButton type="submit" busy={savingProfile} disabled={!profileDirty}>
                    {savingProfile ? "Saving…" : "Save profile"}
                  </SaveButton>
                </>
              }
            >
              <Box sx={twoCols}>
                <TextField
                  label="Full name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  fullWidth
                  required
                  autoComplete="name"
                  error={profileTouched && !!nameError}
                  helperText={profileTouched ? nameError : ""}
                  sx={fieldSx}
                />
                <TextField
                  label="Mobile number"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  fullWidth
                  placeholder="09171234567"
                  autoComplete="tel"
                  error={profileTouched && !!phoneError}
                  helperText={profileTouched && phoneError ? phoneError : "Optional · tenants can call you from their app"}
                  slotProps={{ htmlInput: { inputMode: "tel" } }}
                  sx={fieldSx}
                />
              </Box>
            </Section>
          </Box>

          {/* ───── Business & receipts ───── */}
          <Box component="form" noValidate onSubmit={onSubmit(saveBiz)}>
            <Section
              id="business"
              icon={StorefrontOutlinedIcon}
              title="Business & receipts"
              subtitle="Printed at the top of every rent receipt. Match your BIR-registered receipt booklet."
              footer={
                <>
                  {bizDirty && (
                    <Button color="inherit" onClick={() => { setBiz(bizFrom(owner)); setBizTouched(false); }} sx={{ fontWeight: 700 }}>
                      Discard
                    </Button>
                  )}
                  <SaveButton type="submit" busy={savingBiz} disabled={!bizDirty}>
                    {savingBiz ? "Saving…" : "Save business details"}
                  </SaveButton>
                </>
              }
            >
              <Box sx={formSx}>
                <Box sx={twoCols}>
                  <TextField
                    label="Registered name"
                    value={biz.registeredName}
                    onChange={setBizField("registeredName")}
                    fullWidth
                    placeholder={displayName}
                    helperText="Your name or business name as registered. Leave empty to use your profile name."
                    sx={fieldSx}
                  />
                  <TextField
                    label="TIN"
                    value={biz.tinNumber}
                    onChange={setBizField("tinNumber")}
                    fullWidth
                    placeholder="123-456-789-000"
                    error={!!showBizErr("tinNumber")}
                    helperText={showBizErr("tinNumber") || "Optional"}
                    slotProps={{ htmlInput: { inputMode: "numeric" } }}
                    sx={fieldSx}
                  />
                </Box>
                <TextField
                  label="Business address"
                  value={biz.businessAddress}
                  onChange={setBizField("businessAddress")}
                  fullWidth
                  multiline
                  minRows={2}
                  error={!!showBizErr("businessAddress")}
                  helperText={showBizErr("businessAddress") || "Optional"}
                  sx={fieldSx}
                />
                <TextField select label="VAT status" value={biz.vatStatus} onChange={setBizField("vatStatus")} fullWidth sx={{ ...fieldSx, maxWidth: { sm: "calc(50% - 8px)" } }}>
                  {VAT_OPTIONS.map((o) => (
                    <MenuItem key={o.value || "none"} value={o.value}>
                      {o.label}
                    </MenuItem>
                  ))}
                </TextField>

                {/* Receipt numbering */}
                <Box sx={{ mt: 0.5, p: { xs: 1.5, sm: 2 }, borderRadius: R.md, bgcolor: (t) => alpha(t.palette.background.paper, 0.55) }}>
                  <Box sx={{ ...row, justifyContent: "space-between", gap: 1.5, flexWrap: "wrap", mb: 1.5 }}>
                    <Box sx={{ ...row, gap: 1 }}>
                      <ReceiptLongOutlinedIcon sx={{ fontSize: 19, color: "text.secondary" }} />
                      <Typography sx={{ fontWeight: 800, fontSize: "0.95rem" }}>Receipt numbers</Typography>
                    </Box>
                    <Box sx={{ ...row, gap: 0.75 }}>
                      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>Next receipt</Typography>
                      <Box component="span" sx={{ px: 1.25, py: 0.4, borderRadius: R.sm, bgcolor: "#fff", border: "1px dashed", borderColor: "divider", fontFamily: "ui-monospace, Menlo, Consolas, monospace", fontWeight: 800, fontSize: 14 }}>
                        No. {receiptPreview}
                      </Box>
                    </Box>
                  </Box>
                  <Box sx={twoCols}>
                    <TextField
                      label="Prefix"
                      value={biz.receiptPrefix}
                      onChange={setBizField("receiptPrefix")}
                      fullWidth
                      placeholder="e.g. OR-"
                      error={!!showBizErr("receiptPrefix")}
                      helperText={showBizErr("receiptPrefix") || "Optional"}
                      sx={{ ...fieldSx, "& .MuiOutlinedInput-root": { borderRadius: R.sm, bgcolor: "background.default" } }}
                    />
                    <TextField
                      label="Next number"
                      value={biz.receiptNextNo}
                      onChange={(e) => setBiz((b) => ({ ...b, receiptNextNo: e.target.value.replace(/\D/g, "") }))}
                      fullWidth
                      error={!!showBizErr("receiptNextNo")}
                      helperText={showBizErr("receiptNextNo") || "Start from your booklet's next unused number."}
                      slotProps={{ htmlInput: { inputMode: "numeric" } }}
                      sx={{ ...fieldSx, "& .MuiOutlinedInput-root": { borderRadius: R.sm, bgcolor: "background.default" } }}
                    />
                  </Box>
                </Box>
                <Typography variant="caption" color="text.secondary">
                  Changes apply to new receipts. Receipts already issued keep the details they were printed with.
                </Typography>
              </Box>
            </Section>
          </Box>

          {/* ───── Sign-in & security ───── */}
          {hasPassword ? (
            <Section id="security" icon={ShieldOutlinedIcon} title="Sign-in & security" subtitle={`You sign in with ${user.email}`}>
              <SubHeading icon={MailOutlineIcon} first>
                Change email
              </SubHeading>
              {emailSent ? (
                <Box sx={formSx}>
                  <Alert severity="success" sx={{ borderRadius: R.sm }}>
                    We sent a confirmation link to your new address. Open it to finish the change. Until then, keep logging in with your current email.
                  </Alert>
                  <Button onClick={() => setEmailSent(false)} sx={{ fontWeight: 700, alignSelf: "flex-start" }}>
                    Use a different email
                  </Button>
                </Box>
              ) : (
                <Box component="form" noValidate onSubmit={onSubmit(changeEmail)} sx={formSx}>
                  <input type="text" name="username" autoComplete="username" value={user.email} readOnly hidden />
                  {emailError && <Alert severity="error" sx={{ borderRadius: R.sm }}>{emailError}</Alert>}
                  <Box sx={twoCols}>
                    <TextField
                      label="New email"
                      type="email"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      fullWidth
                      autoComplete="email"
                      slotProps={{ htmlInput: { inputMode: "email", autoCapitalize: "none" } }}
                      sx={fieldSx}
                    />
                    <PasswordField label="Current password" value={emailPassword} onChange={setEmailPassword} autoComplete="current-password" helperText="Needed to confirm it's you." />
                  </Box>
                  <Box sx={{ display: "flex", justifyContent: "flex-end" }}>
                    <SaveButton type="submit" busy={savingEmail} disabled={!newEmail || !emailPassword} sx={{ fontWeight: 700, borderRadius: R.sm, minHeight: 44, px: 2.5, width: { xs: "100%", sm: "auto" } }}>
                      {savingEmail ? "Sending…" : "Send confirmation link"}
                    </SaveButton>
                  </Box>
                </Box>
              )}

              <SubHeading icon={LockOutlinedIcon}>Change password</SubHeading>
              <Box component="form" noValidate onSubmit={onSubmit(changePassword)} sx={formSx}>
                <input type="text" name="username" autoComplete="username" value={user.email} readOnly hidden />
                {pwError && <Alert severity="error" sx={{ borderRadius: R.sm }}>{pwError}</Alert>}
                <PasswordField label="Current password" value={curPw} onChange={setCurPw} autoComplete="current-password" />
                <Box sx={twoCols}>
                  <PasswordField label="New password" value={newPw} onChange={setNewPw} autoComplete="new-password" />
                  <PasswordField label="Confirm new password" value={confirmPw} onChange={setConfirmPw} autoComplete="new-password" />
                </Box>
                <Box sx={{ display: "flex", flexDirection: { xs: "column", sm: "row" }, alignItems: { sm: "center" }, justifyContent: "space-between", gap: 1.5 }}>
                  <Box component="ul" sx={{ listStyle: "none", m: 0, p: 0, display: "flex", flexDirection: "column", gap: 0.4 }}>
                    {pwChecks.map((c) => (
                      <Box component="li" key={c.label} sx={{ ...row, gap: 0.75, fontSize: 13, color: c.ok ? "success.dark" : "text.secondary", fontWeight: c.ok ? 700 : 500 }}>
                        <Box sx={{ width: 16, height: 16, borderRadius: "5px", display: "grid", placeItems: "center", bgcolor: c.ok ? "success.main" : (t) => alpha(t.palette.text.primary, 0.08), color: "#fff" }}>
                          {c.ok && <CheckIcon sx={{ fontSize: 12 }} />}
                        </Box>
                        {c.label}
                      </Box>
                    ))}
                  </Box>
                  <SaveButton type="submit" busy={savingPw} disabled={!curPw || !pwChecks.every((c) => c.ok)} sx={{ fontWeight: 700, borderRadius: R.sm, minHeight: 44, px: 2.5, width: { xs: "100%", sm: "auto" }, flexShrink: 0 }}>
                    {savingPw ? "Changing…" : "Change password"}
                  </SaveButton>
                </Box>
              </Box>
            </Section>
          ) : (
            <Alert severity="info" sx={{ borderRadius: R.md }}>
              You sign in with an outside account, so your email and password are managed there.
            </Alert>
          )}

          {/* ───── Verification ───── */}
          <Section
            id="verification"
            icon={VerifiedUserOutlinedIcon}
            title="Verification documents"
            subtitle={docs.submittedAt ? `Last submitted ${formatDate(docs.submittedAt)}` : "What our admin team checks to verify you."}
            footer={
              chosen.length > 0 ? (
                <SaveButton onClick={askToSubmitDocs}>
                  Submit {chosen.length === 1 ? "document" : `${chosen.length} documents`} for review
                </SaveButton>
              ) : null
            }
          >
            {statusNote && (
              <Alert severity={statusNote.severity} icon={<statusNote.Icon fontSize="small" />} sx={{ borderRadius: R.sm, mb: 2 }}>
                {statusNote.text}
                {statusKey === "rejected" && owner.rejectionReason && (
                  <Box component="div" sx={{ mt: 0.5, fontWeight: 700 }}>Reason: {owner.rejectionReason}</Box>
                )}
              </Alert>
            )}
            {docError && <Alert severity="error" sx={{ borderRadius: R.sm, mb: 2 }}>{docError}</Alert>}

            <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", lg: "repeat(2, minmax(0, 1fr))" }, gap: 1.5 }}>
              {DOC_SLOTS.map((slot) => (
                <DocCard
                  key={slot.key}
                  slot={slot}
                  current={docs[slot.key]}
                  file={files[slot.key]}
                  onPick={(f) => pickFile(slot.key, f)}
                  onUndo={() => pickFile(slot.key, null)}
                  onView={() => setPreviewFile({ url: docs[slot.key], name: slot.label })}
                />
              ))}
            </Box>
          </Section>
        </Box>
      </Box>

      <FilePreviewDialog file={previewFile} onClose={() => setPreviewFile(null)} />

      <Dialog open={confirmDocs} onClose={() => !savingDocs && setConfirmDocs(false)} fullWidth maxWidth="xs" slotProps={{ paper: { sx: { borderRadius: R.xl } } }}>
        <DialogTitle sx={{ fontFamily: HEAD, fontWeight: 800 }}>Submit for review?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {wasApproved
              ? "Your account will go back to \"Under review\" until our admin team approves the new documents. You can still use the dashboard, but adding properties, tenants and caretakers is locked in the meantime."
              : "Our admin team will review your updated documents."}
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
          <Button onClick={() => setConfirmDocs(false)} color="inherit" disabled={savingDocs} sx={{ fontWeight: 700 }}>Cancel</Button>
          <SaveButton onClick={submitDocs} busy={savingDocs}>
            {savingDocs ? "Submitting…" : "Submit"}
          </SaveButton>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={toast.open}
        autoHideDuration={4000}
        onClose={() => setToast((t) => ({ ...t, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        sx={{ bottom: { xs: "calc(80px + env(safe-area-inset-bottom)) !important", sm: undefined } }}
      >
        <Alert severity={toast.severity} variant="filled" sx={{ borderRadius: R.sm }}>{toast.message}</Alert>
      </Snackbar>
    </Box>
  );
}
