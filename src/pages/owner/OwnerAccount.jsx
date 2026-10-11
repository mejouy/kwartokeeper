// src/pages/owner/OwnerAccount.jsx

import { useEffect, useState } from "react";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  InputAdornment,
  Paper,
  Skeleton,
  Snackbar,
  TextField,
  Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import PersonOutlineIcon from "@mui/icons-material/PersonOutlined";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import CheckCircleOutlinedIcon from "@mui/icons-material/CheckCircleOutlined";
import HourglassTopIcon from "@mui/icons-material/HourglassTop";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutlined";
import MailOutlineIcon from "@mui/icons-material/MailOutlined";
import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import VerifiedUserOutlinedIcon from "@mui/icons-material/VerifiedUserOutlined";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
  updateProfile,
  verifyBeforeUpdateEmail,
} from "firebase/auth";
import { auth, db } from "../../config/firebase";
import { uploadFileToCloudinary } from "../../utils/cloudinary";
import FilePreviewDialog from "../../components/FilePreviewDialog";

const row = { display: "flex", alignItems: "center" };
const MAX_DOC_MB = 10;
const cardSx = { bgcolor: "background.default", border: "1px solid", borderColor: "divider", borderRadius: 3 };

const STATUS = {
  pending: { label: "Under review", color: "warning" },
  approved: { label: "Verified", color: "success" },
  verified: { label: "Verified", color: "success" },
  rejected: { label: "Needs attention", color: "error" },
};

const DOC_SLOTS = [
  { key: "idUrl", label: "Government ID", hint: "A clear photo or PDF of a valid ID (PhilID, driver's license, passport...)." },
  {
    key: "clearanceUrl",
    label: "Proof of ownership",
    hint: "Land title, tax declaration, lease / authorization letter, or a business permit.",
  },
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
  const d = v?.toDate ? v.toDate() : new Date(v);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
};
const isPdfUrl = (u) => /\.pdf(\?|$)/i.test(u || "");

const validPhone = (v) => /^(09\d{9}|\+639\d{9})$/.test(v.replace(/[\s-]/g, ""));

function Section({ icon, title, subtitle, action, children }) {
  return (
    <Paper elevation={0} sx={{ ...cardSx, p: { xs: 2, sm: 3 } }}>
      <Box sx={{ ...row, justifyContent: "space-between", alignItems: "flex-start", gap: 1.5, mb: 2 }}>
        <Box sx={{ ...row, gap: 1.25, minWidth: 0, alignItems: "flex-start" }}>
          <Box
            sx={{
              width: 36, height: 36, borderRadius: 2, flexShrink: 0, ...row, justifyContent: "center",
              bgcolor: "rgba(255, 69, 0, 0.10)", color: "primary.main",
            }}
          >
            {icon}
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontWeight: 800 }}>{title}</Typography>
            {subtitle && <Typography variant="body2" color="text.secondary">{subtitle}</Typography>}
          </Box>
        </Box>
        {action}
      </Box>
      {children}
    </Paper>
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
  const state = file ? { label: "New file ready", color: "primary" } : current ? { label: "On file", color: "success" } : { label: "Missing", color: "warning" };

  return (
    <Box sx={{ border: "1px solid", borderColor: file ? "primary.main" : "divider", borderRadius: 3, p: 1.5, bgcolor: "background.paper" }}>
      <Box sx={{ ...row, alignItems: "flex-start", gap: 1.5 }}>
        <Box
          onClick={current && !file ? onView : undefined}
          sx={{
            width: 64, height: 64, borderRadius: 2, flexShrink: 0, overflow: "hidden", ...row, justifyContent: "center",
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
            <Chip size="small" label={state.label} color={state.color} variant={current || file ? "filled" : "outlined"} sx={{ fontWeight: 700 }} />
          </Box>
          <Typography variant="caption" color="text.secondary" component="div" sx={{ mt: 0.25 }}>
            {file ? `${file.name} · ${prettySize(file.size)}` : slot.hint}
          </Typography>
        </Box>
      </Box>

      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mt: 1.5 }}>
        <Button component="label" variant="outlined" size="small" startIcon={<UploadFileIcon />} sx={{ fontWeight: 700, minHeight: 40, flex: { xs: 1, sm: "none" } }}>
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
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState({ open: false, message: "", severity: "success" });
  const notify = (message, severity = "success") => setToast({ open: true, message, severity });

  // profile
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [profileTouched, setProfileTouched] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);

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

  useEffect(() => {
    if (!uid) {
      setLoading(false);
      return undefined;
    }
    return onSnapshot(
      doc(db, "users", uid),
      (snap) => {
        const data = snap.exists() ? { id: snap.id, ...snap.data() } : null;
        setOwner(data);
        setLoading(false);
      },
      (err) => {
        console.error("Error loading account:", err);
        setLoading(false);
      }
    );
  }, [uid]);

  // Fill the form once, from the first snapshot (don't overwrite what's being typed).
  const [seeded, setSeeded] = useState(false);
  useEffect(() => {
    if (!owner || seeded) return;
    setName(owner.fullName || owner.name || user?.displayName || "");
    setPhone(owner.phoneNumber || owner.phone || owner.mobile || "");
    setSeeded(true);
  }, [owner, seeded, user]);

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
  const newPwShort = newPw.length > 0 && newPw.length < 8;
  const confirmMismatch = confirmPw.length > 0 && confirmPw !== newPw;

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
      await setDoc(doc(db, "users", uid), { verificationDocs, approvalStatus: "pending" }, { merge: true });
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
      <Box>
        <Skeleton variant="rounded" height={110} sx={{ borderRadius: 4, mb: 2 }} />
        <Skeleton variant="rounded" height={260} sx={{ borderRadius: 3, mb: 2 }} />
        <Skeleton variant="rounded" height={260} sx={{ borderRadius: 3 }} />
      </Box>
    );
  }

  if (!owner) {
    return <Alert severity="error">Couldn't load your account. Please refresh the page.</Alert>;
  }

  const statusKey = String(owner.approvalStatus || "pending").toLowerCase();
  const status = STATUS[statusKey] || STATUS.pending;
  const docs = owner.verificationDocs || {};
  const wasApproved = ["approved", "verified"].includes(statusKey);
  const displayName = owner.fullName || owner.name || user?.displayName || "Property owner";

  const statusNote = {
    pending: { Icon: HourglassTopIcon, severity: "warning", text: "Your documents are being reviewed by our admin team. You'll get a notification when it's done." },
    approved: { Icon: CheckCircleOutlinedIcon, severity: "success", text: "Your account is verified. Replacing a document sends your account back for review." },
    verified: { Icon: CheckCircleOutlinedIcon, severity: "success", text: "Your account is verified. Replacing a document sends your account back for review." },
    rejected: { Icon: ErrorOutlineIcon, severity: "error", text: "Your last submission was declined. Replace the documents below and submit them again." },
  }[statusKey] || null;

  const formSx = { display: "flex", flexDirection: "column", gap: 2 };
  const submitBtnSx = { fontWeight: 700, borderRadius: 2.5, minHeight: 46, width: { xs: "100%", sm: "auto" }, alignSelf: "flex-start" };
  const onSubmit = (fn) => (e) => {
    e.preventDefault();
    fn();
  };

  return (
    <Box>
      {/* Identity */}
      <Box
        sx={{
          position: "relative", overflow: "hidden", bgcolor: "#202020", color: "#fff", borderRadius: 4,
          p: { xs: 2, sm: 3 }, mb: { xs: 2, sm: 3 }, ...row, gap: { xs: 1.5, sm: 2 },
        }}
      >
        <Box sx={{ position: "absolute", top: -120, right: -80, width: 300, height: 300, borderRadius: "50%", background: "radial-gradient(circle, rgba(255, 69, 0, 0.22), transparent 70%)", pointerEvents: "none" }} />
        <Avatar sx={{ width: { xs: 52, sm: 64 }, height: { xs: 52, sm: 64 }, fontWeight: 800, bgcolor: "primary.main", color: "#fff", position: "relative" }}>
          {initials(displayName)}
        </Avatar>
        <Box sx={{ minWidth: 0, flex: 1, position: "relative" }}>
          <Typography component="h1" sx={{ fontFamily: '"Inter", sans-serif', fontWeight: 900, fontSize: { xs: "1.2rem", sm: "1.6rem" }, lineHeight: 1.2, overflowWrap: "anywhere" }}>
            {displayName}
          </Typography>
          <Typography variant="body2" sx={{ color: "#cadcf6", overflowWrap: "anywhere" }}>
            {user?.email || owner.email}
          </Typography>
          <Chip size="small" label={status.label} color={status.color} sx={{ fontWeight: 700, mt: 0.75 }} />
        </Box>
      </Box>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "minmax(0, 1fr)", lg: "minmax(0, 1fr) minmax(0, 1fr)" },
          gap: { xs: 2, sm: 2.5 },
          alignItems: "start",
        }}
      >
        {/* LEFT: profile + sign-in */}
        <Box sx={{ display: "flex", flexDirection: "column", gap: { xs: 2, sm: 2.5 }, minWidth: 0 }}>
          <Section icon={<PersonOutlineIcon fontSize="small" />} title="Profile" subtitle="How you appear to tenants and caretakers.">
            <Box component="form" noValidate onSubmit={onSubmit(saveProfile)} sx={formSx}>
              <TextField
                label="Full name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                fullWidth
                required
                autoComplete="name"
                error={profileTouched && !!nameError}
                helperText={profileTouched ? nameError : ""}
              />
              <TextField
                label="Mobile number"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                fullWidth
                placeholder="09171234567"
                autoComplete="tel"
                error={profileTouched && !!phoneError}
                helperText={profileTouched && phoneError ? phoneError : "Optional"}
                slotProps={{ htmlInput: { inputMode: "tel" } }}
              />
              <Button type="submit" variant="contained" disabled={savingProfile || !profileDirty} sx={submitBtnSx}>
                {savingProfile ? <CircularProgress size={22} color="inherit" /> : "Save changes"}
              </Button>
            </Box>
          </Section>

          {hasPassword ? (
            <>
              <Section icon={<MailOutlineIcon fontSize="small" />} title="Email" subtitle={`Currently ${user.email}`}>
                {emailSent ? (
                  <Box sx={formSx}>
                    <Alert severity="success" sx={{ borderRadius: 2 }}>
                      We sent a confirmation link to your new address. Open it to finish the change. Until then, keep logging in with your current email.
                    </Alert>
                    <Button onClick={() => setEmailSent(false)} sx={{ fontWeight: 700, alignSelf: "flex-start" }}>
                      Use a different email
                    </Button>
                  </Box>
                ) : (
                  <Box component="form" noValidate onSubmit={onSubmit(changeEmail)} sx={formSx}>
                    <input type="text" name="username" autoComplete="username" value={user.email} readOnly hidden />
                    {emailError && <Alert severity="error" sx={{ borderRadius: 2 }}>{emailError}</Alert>}
                    <TextField
                      label="New email"
                      type="email"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      fullWidth
                      autoComplete="email"
                      slotProps={{ htmlInput: { inputMode: "email", autoCapitalize: "none" } }}
                    />
                    <PasswordField label="Current password" value={emailPassword} onChange={setEmailPassword} autoComplete="current-password" helperText="Needed to confirm it's you." />
                    <Button type="submit" variant="contained" disabled={savingEmail || !newEmail || !emailPassword} sx={submitBtnSx}>
                      {savingEmail ? <CircularProgress size={22} color="inherit" /> : "Send confirmation link"}
                    </Button>
                  </Box>
                )}
              </Section>

              <Section icon={<LockOutlinedIcon fontSize="small" />} title="Password" subtitle="Use at least 8 characters.">
                <Box component="form" noValidate onSubmit={onSubmit(changePassword)} sx={formSx}>
                  <input type="text" name="username" autoComplete="username" value={user.email} readOnly hidden />
                  {pwError && <Alert severity="error" sx={{ borderRadius: 2 }}>{pwError}</Alert>}
                  <PasswordField label="Current password" value={curPw} onChange={setCurPw} autoComplete="current-password" />
                  <PasswordField
                    label="New password"
                    value={newPw}
                    onChange={setNewPw}
                    autoComplete="new-password"
                    error={newPwShort ? "At least 8 characters." : ""}
                    helperText={newPw.length >= 8 ? "Looks good." : ""}
                  />
                  <PasswordField
                    label="Confirm new password"
                    value={confirmPw}
                    onChange={setConfirmPw}
                    autoComplete="new-password"
                    error={confirmMismatch ? "Doesn't match the new password." : ""}
                  />
                  <Button type="submit" variant="contained" disabled={savingPw || !curPw || !newPw || !confirmPw} sx={submitBtnSx}>
                    {savingPw ? <CircularProgress size={22} color="inherit" /> : "Change password"}
                  </Button>
                </Box>
              </Section>
            </>
          ) : (
            <Alert severity="info" sx={{ borderRadius: 2 }}>
              You sign in with an outside account, so your email and password are managed there.
            </Alert>
          )}
        </Box>

        {/* RIGHT: verification */}
        <Box sx={{ minWidth: 0 }}>
          <Section
            icon={<VerifiedUserOutlinedIcon fontSize="small" />}
            title="Verification documents"
            subtitle={docs.submittedAt ? `Last submitted ${formatDate(docs.submittedAt)}` : "What our admin team checks to verify you."}
          >
            {statusNote && (
              <Alert severity={statusNote.severity} icon={<statusNote.Icon fontSize="small" />} sx={{ borderRadius: 2, mb: 2 }}>
                {statusNote.text}
                {statusKey === "rejected" && owner.rejectionReason && (
                  <Box component="div" sx={{ mt: 0.5, fontWeight: 700 }}>Reason: {owner.rejectionReason}</Box>
                )}
              </Alert>
            )}
            {docError && <Alert severity="error" sx={{ borderRadius: 2, mb: 2 }}>{docError}</Alert>}

            <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
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

            {chosen.length > 0 && (
              <Button variant="contained" onClick={askToSubmitDocs} sx={{ ...submitBtnSx, mt: 2 }}>
                Submit {chosen.length === 1 ? "document" : `${chosen.length} documents`} for review
              </Button>
            )}
          </Section>
        </Box>
      </Box>

      <FilePreviewDialog file={previewFile} onClose={() => setPreviewFile(null)} />

      <Dialog open={confirmDocs} onClose={() => !savingDocs && setConfirmDocs(false)} fullWidth maxWidth="xs" slotProps={{ paper: { sx: { borderRadius: 3 } } }}>
        <DialogTitle sx={{ fontWeight: 800 }}>Submit for review?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {wasApproved
              ? "Your account will go back to \"Under review\" until our admin team approves the new documents. You can still use the dashboard, but adding properties, tenants and caretakers is locked in the meantime."
              : "Our admin team will review your updated documents."}
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setConfirmDocs(false)} disabled={savingDocs} sx={{ fontWeight: 700 }}>Cancel</Button>
          <Button variant="contained" onClick={submitDocs} disabled={savingDocs} sx={{ fontWeight: 700, borderRadius: 2.5, minWidth: 96 }}>
            {savingDocs ? <CircularProgress size={22} color="inherit" /> : "Submit"}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={toast.open}
        autoHideDuration={4000}
        onClose={() => setToast((t) => ({ ...t, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        sx={{ bottom: { xs: "calc(80px + env(safe-area-inset-bottom)) !important", sm: undefined } }}
      >
        <Alert severity={toast.severity} variant="filled" sx={{ borderRadius: 2 }}>{toast.message}</Alert>
      </Snackbar>
    </Box>
  );
}