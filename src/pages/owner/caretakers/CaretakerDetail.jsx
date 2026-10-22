// src/pages/owner/caretakers/CaretakerDetail.jsx

import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Box,
  Container,
  Typography,
  Button,
  Avatar,
  CircularProgress,
  Alert,
  Snackbar,
  Dialog,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  IconButton,
  Switch,
  Skeleton,
  useMediaQuery,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import CloseIcon from "@mui/icons-material/Close";
import CheckIcon from "@mui/icons-material/Check";
import HomeWorkOutlinedIcon from "@mui/icons-material/HomeWorkOutlined";
import SecurityOutlinedIcon from "@mui/icons-material/SecurityOutlined";
import PersonOutlineOutlinedIcon from "@mui/icons-material/PersonOutlineOutlined";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import SaveOutlinedIcon from "@mui/icons-material/SaveOutlined";
import MarkEmailUnreadOutlinedIcon from "@mui/icons-material/MarkEmailUnreadOutlined";
import VerifiedUserOutlinedIcon from "@mui/icons-material/VerifiedUserOutlined";
import PeopleAltOutlinedIcon from "@mui/icons-material/PeopleAltOutlined";
import NightsStayOutlinedIcon from "@mui/icons-material/NightsStayOutlined";
import BuildOutlinedIcon from "@mui/icons-material/BuildOutlined";
import PaymentsOutlinedIcon from "@mui/icons-material/PaymentsOutlined";
import MeetingRoomOutlinedIcon from "@mui/icons-material/MeetingRoomOutlined";
import LockResetOutlinedIcon from "@mui/icons-material/LockResetOutlined";
import ForwardToInboxOutlinedIcon from "@mui/icons-material/ForwardToInboxOutlined";

import { doc, getDoc, getDocs, updateDoc, collection, query, where } from "firebase/firestore";
import { auth, db } from "../../../config/firebase";
import { formatPropertyAddress } from "../../../utils/formatPropertyAddress";
import { useAuth } from "../../../context/AuthContext";
import { emailCaretakerResetLink } from "../../../services/caretakerService";
import { isRemovedAccount, removedLabel } from "../../../utils/accountState";

// Same wording as the Invite caretaker form
const PERMISSIONS = [
  { key: "manageTenants", label: "Manage tenants", desc: "Register tenants and assign rooms", icon: PeopleAltOutlinedIcon },
  { key: "logOccupancy", label: "Log occupancy", desc: "Daily occupancy and curfew checks", icon: NightsStayOutlinedIcon },
  { key: "handleReports", label: "Handle reports", desc: "Receive and update repair reports", icon: BuildOutlinedIcon },
  { key: "viewFinancials", label: "View financials", desc: "See rent payments and record cash payments", icon: PaymentsOutlinedIcon },
  { key: "modifyLayout", label: "Modify layout", desc: "Change rooms, beds and rates", icon: MeetingRoomOutlinedIcon },
];
const EMPTY_PERMISSIONS = Object.fromEntries(PERMISSIONS.map((p) => [p.key, false]));

const HEAD = '"Inter", sans-serif';
const R = { sm: "10px", md: "14px", lg: "18px", xl: "22px" };
const row = { display: "flex", alignItems: "center" };

// White card on the cream page, matching the other owner pages
const panelSx = {
  bgcolor: "background.default",
  border: "1px solid",
  borderColor: "divider",
  borderRadius: R.lg,
  minWidth: 0,
};

const propertyNameOf = (p) => p?.propertyName || p?.name || "Unnamed property";
const initialsOf = (name) =>
  String(name || "?").split(" ").filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("") || "?";

function formatDate(value) {
  const d = typeof value?.toDate === "function" ? value.toDate() : value ? new Date(value) : null;
  return d && !Number.isNaN(d.getTime()) ? d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : null;
}

function Pill({ label, tone }) {
  return (
    <Box
      component="span"
      sx={{
        ...row,
        px: 1,
        height: 24,
        borderRadius: 99,
        fontSize: 12.5,
        fontWeight: 700,
        whiteSpace: "nowrap",
        bgcolor: (t) => alpha(t.palette[tone].main, 0.12),
        color: (t) => t.palette[tone].dark,
      }}
    >
      {label}
    </Box>
  );
}

// One block of the edit form: icon, title and explanation on the left, fields on the right
function FormSection({ icon: Icon, title, description, children, first }) {
  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "200px minmax(0, 1fr)" },
        gap: { xs: 1.75, md: 3 },
        py: { xs: 2.5, md: 3 },
        borderTop: first ? "none" : "1px solid",
        borderColor: "divider",
      }}
    >
      <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.25, minWidth: 0 }}>
        <Box sx={{ width: 34, height: 34, flexShrink: 0, borderRadius: R.sm, display: "grid", placeItems: "center", bgcolor: "rgba(255,69,0,.1)", color: "primary.main" }}>
          <Icon sx={{ fontSize: 19 }} />
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontFamily: HEAD, fontWeight: 800, fontSize: "0.98rem", lineHeight: 1.3 }}>{title}</Typography>
          {description && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25, lineHeight: 1.5 }}>
              {description}
            </Typography>
          )}
        </Box>
      </Box>
      <Box sx={{ minWidth: 0 }}>{children}</Box>
    </Box>
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
  const [snackText, setSnackText] = useState("Caretaker details updated.");
  // New temporary password / reset link
  const [resetOpen, setResetOpen] = useState(false);
  const [resetBusy, setResetBusy] = useState(""); // "" | "password" | "email"
  const [resetError, setResetError] = useState("");
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
    // No id in the URL is handled when rendering. On a hard refresh Firebase
    // restores the session asynchronously — wait for it.
    if (!caretakerId || authLoading) return;

    const fetchCaretakerData = async () => {
      try {
        const userSnap = await getDoc(doc(db, "users", caretakerId));
        const data = userSnap.exists() ? userSnap.data() : null;

        // Only this owner's caretakers can be opened here
        const isMine = data && data.role === "caretaker" && ownerUid && (data.ownerUid === ownerUid || data.invitedBy === ownerUid);
        if (!isMine) {
          setError("We couldn't find this caretaker on your account.");
          setLoading(false);
          return;
        }

        const caretakerData = { id: userSnap.id, ...data };
        setCaretaker(caretakerData);

        const propsSnap = await getDocs(query(collection(db, "properties"), where("ownerUid", "==", ownerUid)));
        const propsList = propsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setOwnerProperties(propsList);
        setProperty(propsList.find((p) => p.id === caretakerData.assignedPropertyId) || null);
      } catch (err) {
        console.error("Error fetching caretaker details:", err);
        setError("Couldn't load this caretaker. Check your connection and try again.");
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
      name: caretaker.name || caretaker.fullName || "",
      email: caretaker.email || "",
      phone: caretaker.phone || "",
      assignedPropertyId: caretaker.assignedPropertyId || "",
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

  const setPermission = (key, value) => setFormData((prev) => ({ ...prev, permissions: { ...prev.permissions, [key]: value } }));
  const setAllPermissions = (value) =>
    setFormData((prev) => ({ ...prev, permissions: { ...prev.permissions, ...Object.fromEntries(PERMISSIONS.map((p) => [p.key, value])) } }));

  // ---- password reset (free plan: Firebase emails them a link to choose a new password) ----
  const sendResetLink = async () => {
    if (!caretaker?.email) return;
    setResetBusy("email");
    setResetError("");
    try {
      await emailCaretakerResetLink({ id: caretaker.id, email: caretaker.email });
      setCaretaker((c) => ({ ...c, mustChangePassword: false }));
      setResetOpen(false);
      setSnackText(`Reset link sent to ${caretaker.email}.`);
      setSnackbar(true);
    } catch (err) {
      console.error("Couldn't send the reset email:", err);
      setResetError(err?.code === "auth/user-not-found" ? "No sign-in account uses that email." : err?.message || "Couldn't send the email. Please try again.");
    } finally {
      setResetBusy("");
    }
  };

  const validateForm = () => {
    const e = {};
    if (!formData.name.trim()) e.name = "Full name is required.";
    if (formData.email.trim() && !/^\S+@\S+\.\S+$/.test(formData.email.trim())) e.email = "Enter a valid email address.";
    if (formData.phone.trim() && !/^[0-9+\-\s()]{7,20}$/.test(formData.phone.trim())) e.phone = "Enter a valid phone number.";
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
        // The caretakers record reads fullName; keep both names in step
        fullName: formData.name.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim(),
        assignedPropertyId: formData.assignedPropertyId,
        permissions: formData.permissions,
        updatedAt: new Date(),
      };

      // 1. The account itself
      await updateDoc(doc(db, "users", caretakerId), updatedPayload);

      // 2. The matching record in "caretakers" (same id; older records are looked up)
      try {
        const caretakerDocRef = doc(db, "caretakers", caretakerId);
        const caretakerSnap = await getDoc(caretakerDocRef);
        if (caretakerSnap.exists()) {
          await updateDoc(caretakerDocRef, updatedPayload);
        } else {
          const byUser = await getDocs(query(collection(db, "caretakers"), where("userId", "==", caretakerId)));
          const target = byUser.empty
            ? await getDocs(query(collection(db, "caretakers"), where("email", "==", (caretaker.email || "").trim().toLowerCase())))
            : byUser;
          if (!target.empty) await updateDoc(doc(db, "caretakers", target.docs[0].id), updatedPayload);
        }
      } catch (caretakerCollectionErr) {
        console.warn("Note: Secondary caretakers collection update skipped or failed:", caretakerCollectionErr);
      }

      setCaretaker((prev) => ({ ...prev, ...updatedPayload }));
      setProperty(ownerProperties.find((p) => p.id === formData.assignedPropertyId) || null);
      setOpenEdit(false);
      setSnackText("Caretaker details updated.");
      setSnackbar(true);
    } catch (err) {
      console.error("Error updating caretaker:", err);
      setSaveError("Couldn't save the changes. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  };

  // =========================================================
  // LOADING / ERROR STATES
  // =========================================================
  if (!caretakerId || error || (!loading && !caretaker)) {
    return (
      <Box sx={{ maxWidth: 520, mx: "auto", mt: { xs: 4, md: 8 }, textAlign: "center", px: 2 }}>
        <Typography sx={{ fontFamily: HEAD, fontWeight: 800, fontSize: "1.2rem", mb: 0.5 }}>Can't open this caretaker</Typography>
        <Typography color="text.secondary" sx={{ mb: 3 }}>
          {!caretakerId ? "This link is missing the caretaker." : error || "Caretaker details are unavailable."}
        </Typography>
        <Button variant="contained" startIcon={<ArrowBackIcon />} onClick={() => navigate("/owner/caretakers")} sx={{ fontWeight: 700, borderRadius: R.sm }}>
          Back to caretakers
        </Button>
      </Box>
    );
  }

  if (loading) {
    return (
      <Box sx={{ maxWidth: 1200, mx: "auto" }}>
        <Skeleton width={110} height={32} sx={{ mb: 1 }} />
        <Skeleton variant="rounded" height={190} sx={{ borderRadius: R.xl, mb: 2.5 }} />
        <Skeleton variant="rounded" height={320} sx={{ borderRadius: R.lg }} />
      </Box>
    );
  }

  // =========================================================
  // DERIVED DISPLAY VALUES
  // =========================================================
  const displayName = caretaker.name || caretaker.fullName || "Unnamed caretaker";
  const isPending = Boolean(caretaker.mustChangePassword);
  const addedOn = formatDate(caretaker.createdAt);
  const propertyMissing = Boolean(caretaker.assignedPropertyId) && !property;

  // Standard five first, then any extra keys that were granted at some point
  const extraKeys = Object.keys(caretaker.permissions || {}).filter((k) => !PERMISSIONS.some((p) => p.key === k));
  const permissionList = [...PERMISSIONS, ...extraKeys.map((k) => ({ key: k, label: k, desc: "", icon: SecurityOutlinedIcon }))];
  const grantedCount = permissionList.filter((p) => caretaker.permissions?.[p.key]).length;
  const formGranted = PERMISSIONS.filter((p) => formData.permissions[p.key]).length;

  const tiles = [
    {
      icon: HomeWorkOutlinedIcon,
      label: "Assigned property",
      value: property ? propertyNameOf(property) : propertyMissing ? "Property unavailable" : "Not assigned",
      sub: property ? formatPropertyAddress(property) : propertyMissing ? "The property couldn't be found" : "Assign one with Edit details",
      warn: !property,
      onClick: property ? () => navigate(`/owner/properties/${property.id}`) : null,
    },
    {
      icon: SecurityOutlinedIcon,
      label: "Access",
      value: `${grantedCount} of ${permissionList.length} permissions`,
      sub: grantedCount === 0 ? "They can't do anything yet" : grantedCount === permissionList.length ? "Full access" : "Limited access",
      warn: grantedCount === 0,
    },
    {
      icon: isPending ? MarkEmailUnreadOutlinedIcon : VerifiedUserOutlinedIcon,
      label: "Account",
      value: isPending ? "Hasn't signed in yet" : "Signed in",
      sub: [addedOn && `Added ${addedOn}`, formatDate(caretaker.updatedAt) && `updated ${formatDate(caretaker.updatedAt)}`].filter(Boolean).join(" · ") || "—",
      warn: isPending,
    },
  ];

  return (
    <Container maxWidth="lg" disableGutters sx={{ py: 0 }}>
      <Button startIcon={<ArrowBackIcon />} onClick={() => navigate("/owner/caretakers")} sx={{ mb: 1.25, ml: -1, color: "text.secondary", fontWeight: 600 }}>
        Caretakers
      </Button>

      {/* ───── Header: who, status, and the three key facts ───── */}
      <Box component="section" sx={{ ...panelSx, borderRadius: R.xl, position: "relative", overflow: "hidden", p: { xs: 2, sm: 3 }, mb: 2.5 }}>
        <Box aria-hidden sx={{ position: "absolute", top: -180, right: -120, width: 380, height: 380, borderRadius: "50%", background: "rgba(255,69,0,.10)", filter: "blur(70px)", pointerEvents: "none" }} />

        <Box sx={{ position: "relative", display: "flex", flexDirection: { xs: "column", sm: "row" }, alignItems: { sm: "center" }, justifyContent: "space-between", gap: 2, mb: 2.5 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: { xs: 1.75, sm: 2.25 }, minWidth: 0 }}>
            <Avatar sx={{ width: { xs: 56, sm: 68 }, height: { xs: 56, sm: 68 }, bgcolor: isPending ? "warning.main" : "primary.main", color: "#fff", fontFamily: HEAD, fontWeight: 800, fontSize: { xs: "1.25rem", sm: "1.5rem" }, flexShrink: 0 }}>
              {initialsOf(displayName)}
            </Avatar>
            <Box sx={{ minWidth: 0 }}>
              <Box sx={{ display: "flex", alignItems: "center", flexWrap: "wrap", columnGap: 1.25, rowGap: 0.5 }}>
                <Typography component="h1" sx={{ fontFamily: HEAD, fontWeight: 900, letterSpacing: "-0.02em", fontSize: { xs: "1.35rem", sm: "1.75rem" }, overflowWrap: "anywhere", lineHeight: 1.2 }}>
                  {displayName}
                </Typography>
                <Pill label={isPending ? "Not logged in yet" : "Active"} tone={isPending ? "warning" : "success"} />
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25, overflowWrap: "anywhere" }}>
                Caretaker · {[caretaker.phone, caretaker.email].filter(Boolean).join(" · ") || "No contact details"}
              </Typography>
            </Box>
          </Box>

          <Box sx={{ display: "flex", gap: 1, flexShrink: 0, width: { xs: "100%", sm: "auto" } }}>
            <Button
              variant="outlined"
              color="inherit"
              startIcon={<LockResetOutlinedIcon />}
              onClick={() => {
                setResetError("");
                setResetOpen(true);
              }}
              sx={{ fontWeight: 700, borderRadius: R.sm, minHeight: 42, px: 2, borderColor: "divider", bgcolor: "background.default", flex: { xs: 1, sm: "none" } }}
            >
              Reset password
            </Button>
            <Button variant="contained" disableElevation startIcon={<EditOutlinedIcon />} onClick={handleOpenEdit} sx={{ fontWeight: 700, borderRadius: R.sm, minHeight: 42, px: 2.5, flex: { xs: 1, sm: "none" } }}>
              Edit details
            </Button>
          </Box>
        </Box>

        <Box sx={{ position: "relative", display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "repeat(3, minmax(0, 1fr))" }, gap: 1.25 }}>
          {tiles.map((t) => {
            const Icon = t.icon;
            const inner = (
              <>
                <Box sx={{ width: 38, height: 38, flexShrink: 0, borderRadius: R.sm, display: "grid", placeItems: "center", bgcolor: "#fff", color: t.warn ? "warning.main" : "primary.main" }}>
                  <Icon sx={{ fontSize: 20 }} />
                </Box>
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography variant="caption" color="text.secondary" noWrap sx={{ fontWeight: 600, display: "block" }}>
                    {t.label}
                  </Typography>
                  <Typography noWrap sx={{ fontFamily: HEAD, fontWeight: 800, fontSize: "1.02rem", lineHeight: 1.3, color: t.warn ? "warning.dark" : "text.primary" }}>
                    {t.value}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" noWrap component="div">
                    {t.sub}
                  </Typography>
                </Box>
                {t.onClick && <ChevronRightIcon sx={{ color: "text.disabled", alignSelf: "center" }} />}
              </>
            );
            const sx = { minWidth: 0, display: "flex", alignItems: "flex-start", gap: 1.25, p: 1.75, borderRadius: R.md, textAlign: "left", bgcolor: (th) => alpha(th.palette.background.paper, 0.55), border: 0, font: "inherit", color: "inherit" };
            return t.onClick ? (
              <Box key={t.label} component="button" type="button" onClick={t.onClick} sx={{ ...sx, cursor: "pointer", "&:hover": { bgcolor: (th) => alpha(th.palette.background.paper, 0.85) } }}>
                {inner}
              </Box>
            ) : (
              <Box key={t.label} sx={sx}>
                {inner}
              </Box>
            );
          })}
        </Box>
      </Box>

      {isRemovedAccount(caretaker) && (
        <Alert severity="error" sx={{ mb: 2, borderRadius: "14px" }}>
          <strong>{removedLabel(caretaker)}</strong> They no longer appear in lists, counts or announcements. Their records are kept for your history.
        </Alert>
      )}

      {isPending && !isRemovedAccount(caretaker) && (
        <Alert severity="info" icon={<MarkEmailUnreadOutlinedIcon />} sx={{ mb: 2.5, borderRadius: R.md }}>
          {displayName} hasn't signed in yet. They log in with the email and temporary password from their invite, then set their own password.
        </Alert>
      )}

      {/* ───── What they can do ───── */}
      <Box sx={{ ...panelSx, p: { xs: 2, sm: 3 } }}>
        <Box sx={{ ...row, justifyContent: "space-between", gap: 2, mb: 1.5 }}>
          <Box sx={{ ...row, gap: 1.25, minWidth: 0 }}>
            <Box sx={{ width: 36, height: 36, borderRadius: R.sm, flexShrink: 0, display: "grid", placeItems: "center", bgcolor: "rgba(255,69,0,.1)", color: "primary.main" }}>
              <SecurityOutlinedIcon sx={{ fontSize: 20 }} />
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography sx={{ fontFamily: HEAD, fontWeight: 800, fontSize: "1.08rem" }}>What they can do</Typography>
              <Typography variant="body2" color="text.secondary">
                {grantedCount === 0 ? "Nothing yet. Turn on what they should handle." : `${grantedCount} of ${permissionList.length} allowed`}
              </Typography>
            </Box>
          </Box>
          <Button size="small" startIcon={<EditOutlinedIcon />} onClick={handleOpenEdit} sx={{ fontWeight: 700, flexShrink: 0 }}>
            Change
          </Button>
        </Box>

        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "repeat(2, minmax(0, 1fr))" }, gap: 1 }}>
          {permissionList.map((p) => {
            const on = Boolean(caretaker.permissions?.[p.key]);
            const Icon = p.icon;
            return (
              <Box
                key={p.key}
                sx={{
                  ...row,
                  gap: 1.5,
                  p: 1.5,
                  borderRadius: R.md,
                  border: "1px solid",
                  borderColor: on ? (t) => alpha(t.palette.primary.main, 0.3) : "divider",
                  bgcolor: on ? (t) => alpha(t.palette.primary.main, 0.04) : "transparent",
                }}
              >
                <Box sx={{ width: 36, height: 36, flexShrink: 0, borderRadius: R.sm, display: "grid", placeItems: "center", bgcolor: (t) => (on ? alpha(t.palette.primary.main, 0.12) : alpha(t.palette.text.primary, 0.05)), color: on ? "primary.main" : "text.disabled" }}>
                  <Icon sx={{ fontSize: 19 }} />
                </Box>
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography sx={{ fontWeight: 700, fontSize: "0.92rem", color: on ? "text.primary" : "text.secondary" }}>{p.label}</Typography>
                  {p.desc && (
                    <Typography variant="caption" color="text.secondary" sx={{ display: "block", lineHeight: 1.4 }}>
                      {p.desc}
                    </Typography>
                  )}
                </Box>
                <Box sx={{ ...row, gap: 0.5, flexShrink: 0, fontSize: 12.5, fontWeight: 700, color: on ? "success.dark" : "text.disabled" }}>
                  {on && <CheckIcon sx={{ fontSize: 16 }} />}
                  {on ? "Allowed" : "Off"}
                </Box>
              </Box>
            );
          })}
        </Box>
      </Box>

      {/* ───── Edit dialog (full-screen on phones) ───── */}
      <Dialog
        open={openEdit}
        onClose={() => !saving && setOpenEdit(false)}
        maxWidth="md"
        fullWidth
        fullScreen={fullScreen}
        slotProps={{ paper: { sx: { borderRadius: fullScreen ? 0 : R.xl, overflow: "hidden" } } }}
      >
        {/* Header: who is being edited */}
        <Box sx={{ position: "relative", overflow: "hidden", flexShrink: 0, px: { xs: 2, sm: 3 }, pt: { xs: 2, sm: 2.5 }, pb: 2, borderBottom: "1px solid", borderColor: "divider" }}>
          <Box aria-hidden sx={{ position: "absolute", top: -140, right: -100, width: 300, height: 300, borderRadius: "50%", background: "rgba(255,69,0,.10)", filter: "blur(60px)", pointerEvents: "none" }} />
          <Box sx={{ position: "relative", ...row, gap: 1.5 }}>
            <Avatar sx={{ width: 44, height: 44, bgcolor: "primary.main", color: "#fff", fontFamily: HEAD, fontWeight: 800, fontSize: "1rem" }}>
              {initialsOf(formData.name)}
            </Avatar>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, display: "block", lineHeight: 1.2 }}>
                Edit caretaker
              </Typography>
              <Typography noWrap sx={{ fontFamily: HEAD, fontWeight: 800, fontSize: "1.2rem", letterSpacing: "-0.01em" }}>
                {formData.name || "Unnamed caretaker"}
              </Typography>
            </Box>
            <IconButton onClick={() => setOpenEdit(false)} aria-label="Close" disabled={saving} sx={{ bgcolor: "action.hover" }}>
              <CloseIcon />
            </IconButton>
          </Box>
        </Box>

        <DialogContent sx={{ p: 0, "& .MuiOutlinedInput-root": { borderRadius: R.sm } }}>
          {saveError && (
            <Alert severity="error" sx={{ mx: { xs: 2, sm: 3 }, mt: 2.5, borderRadius: R.sm }}>
              {saveError}
            </Alert>
          )}

          <Box sx={{ px: { xs: 2, sm: 3 } }}>
            <FormSection first icon={PersonOutlineOutlinedIcon} title="Contact" description="How you and the tenants reach them.">
              <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <TextField required label="Full name" name="name" value={formData.name} onChange={handleChange} fullWidth error={Boolean(formErrors.name)} helperText={formErrors.name || ""} />
                <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "repeat(2, minmax(0, 1fr))" }, gap: 2 }}>
                  <TextField label="Phone number" name="phone" type="tel" value={formData.phone} onChange={handleChange} fullWidth error={Boolean(formErrors.phone)} helperText={formErrors.phone || ""} />
                  <TextField label="Email address" name="email" type="email" value={formData.email} onChange={handleChange} fullWidth error={Boolean(formErrors.email)} helperText={formErrors.email || ""} />
                </Box>
                <Typography variant="caption" color="text.secondary">
                  Changing the email here updates their profile only. They still sign in with the email from their invite.
                </Typography>
              </Box>
            </FormSection>

            <FormSection icon={HomeWorkOutlinedIcon} title="Property" description="The one property they look after.">
              <TextField
                select
                label="Assigned property"
                name="assignedPropertyId"
                value={formData.assignedPropertyId}
                onChange={handleChange}
                fullWidth
                slotProps={{ select: { displayEmpty: true }, inputLabel: { shrink: true } }}
                helperText={!formData.assignedPropertyId ? "Without a property they can't see any tenants or rooms." : ""}
              >
                <MenuItem value="">Not assigned</MenuItem>
                {ownerProperties.map((prop) => (
                  <MenuItem key={prop.id} value={prop.id}>
                    {propertyNameOf(prop)}
                  </MenuItem>
                ))}
              </TextField>
            </FormSection>

            <FormSection icon={SecurityOutlinedIcon} title="Permissions" description="Turn on only what they need. You can change this any time.">
              <Box sx={{ ...row, justifyContent: "space-between", gap: 1, mb: 1 }}>
                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                  {formGranted} of {PERMISSIONS.length} allowed
                </Typography>
                <Box sx={{ display: "flex", gap: 0.5 }}>
                  <Button size="small" onClick={() => setAllPermissions(true)} disabled={formGranted === PERMISSIONS.length} sx={{ fontWeight: 700 }}>
                    Allow all
                  </Button>
                  <Button size="small" color="inherit" onClick={() => setAllPermissions(false)} disabled={formGranted === 0} sx={{ fontWeight: 700 }}>
                    None
                  </Button>
                </Box>
              </Box>
              <Box sx={{ border: "1px solid", borderColor: "divider", borderRadius: R.md, overflow: "hidden" }}>
                {PERMISSIONS.map((p, i) => {
                  const on = Boolean(formData.permissions[p.key]);
                  const Icon = p.icon;
                  return (
                    <Box
                      key={p.key}
                      component="label"
                      sx={{
                        ...row,
                        gap: 1.5,
                        px: 1.5,
                        py: 1.1,
                        cursor: "pointer",
                        borderTop: i ? "1px solid" : "none",
                        borderColor: "divider",
                        bgcolor: on ? (t) => alpha(t.palette.primary.main, 0.04) : "transparent",
                        "&:hover": { bgcolor: "action.hover" },
                      }}
                    >
                      <Icon sx={{ fontSize: 20, color: on ? "primary.main" : "text.disabled", flexShrink: 0 }} />
                      <Box sx={{ minWidth: 0, flex: 1 }}>
                        <Typography sx={{ fontWeight: 700, fontSize: "0.92rem" }}>{p.label}</Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ display: "block", lineHeight: 1.4 }}>
                          {p.desc}
                        </Typography>
                      </Box>
                      <Switch checked={on} onChange={(e) => setPermission(p.key, e.target.checked)} slotProps={{ input: { "aria-label": p.label } }} />
                    </Box>
                  );
                })}
              </Box>
            </FormSection>
          </Box>
        </DialogContent>

        <DialogActions sx={{ px: { xs: 2, sm: 3 }, py: 1.75, gap: 1, borderTop: "1px solid", borderColor: "divider", bgcolor: (t) => alpha(t.palette.background.paper, 0.35) }}>
          <Button onClick={() => setOpenEdit(false)} color="inherit" disabled={saving} sx={{ fontWeight: 700, borderRadius: R.sm, flex: { xs: 1, sm: "none" } }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            disableElevation
            onClick={handleSaveEdit}
            disabled={saving}
            startIcon={saving ? <CircularProgress size={18} color="inherit" /> : <SaveOutlinedIcon />}
            sx={{ px: 3, fontWeight: 700, borderRadius: R.sm, flex: { xs: 1, sm: "none" } }}
          >
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar open={snackbar} autoHideDuration={3500} onClose={() => setSnackbar(false)} anchorOrigin={{ vertical: "bottom", horizontal: "center" }}>
        <Alert severity="success" variant="filled" onClose={() => setSnackbar(false)} sx={{ width: "100%" }}>
          {snackText}
        </Alert>
      </Snackbar>

      {/* ───── Reset password ───── */}
      <Dialog open={resetOpen} onClose={() => !resetBusy && setResetOpen(false)} fullWidth maxWidth="xs" slotProps={{ paper: { sx: { borderRadius: R.xl } } }}>
        <Box sx={{ px: 3, pt: 3, pb: 1 }}>
          <Box sx={{ width: 48, height: 48, borderRadius: R.md, display: "grid", placeItems: "center", bgcolor: "rgba(255,69,0,.1)", color: "primary.main", mb: 1.5 }}>
            <LockResetOutlinedIcon />
          </Box>
          <Typography sx={{ fontFamily: HEAD, fontWeight: 800, fontSize: "1.2rem", lineHeight: 1.3 }}>
            Send {caretaker?.name || caretaker?.fullName || "this caretaker"} a password reset link?
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
            The first temporary password was only shown once, so it can&apos;t be sent again. Instead, they get an email with a link to choose a new password themselves.
          </Typography>
        </Box>
        <DialogContent sx={{ pt: 1.5 }}>
          {resetError && (
            <Alert severity="error" sx={{ mb: 2, borderRadius: R.sm }}>
              {resetError}
            </Alert>
          )}
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1.25 }}>
            <Box sx={{ p: 1.75, borderRadius: R.md, border: "1px solid", borderColor: "divider", bgcolor: (t) => alpha(t.palette.background.paper, 0.35) }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, display: "block" }}>
                Sent to
              </Typography>
              <Typography sx={{ fontWeight: 800, fontSize: 15, overflowWrap: "anywhere" }}>{caretaker?.email || "No email on file"}</Typography>
              <Box component="ol" sx={{ m: 0, mt: 1.25, pl: 2.25, display: "grid", gap: 0.4, color: "text.secondary", fontSize: 13.5 }}>
                <li>They open the email (check Spam too) and tap the link.</li>
                <li>They choose a new password.</li>
                <li>They sign in with it. Their old password stops working.</li>
              </Box>
              {!caretaker?.email && (
                <Typography variant="caption" color="error" sx={{ display: "block", mt: 1 }}>
                  Add their email with Edit details first.
                </Typography>
              )}
              <Button
                fullWidth
                variant="contained"
                disableElevation
                disabled={Boolean(resetBusy) || !caretaker?.email}
                startIcon={resetBusy === "email" ? <CircularProgress size={16} color="inherit" /> : <ForwardToInboxOutlinedIcon />}
                onClick={sendResetLink}
                sx={{ mt: 1.25, fontWeight: 700, borderRadius: R.sm, minHeight: 42 }}
              >
                {resetBusy === "email" ? "Sending…" : "Send reset link"}
              </Button>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button color="inherit" onClick={() => setResetOpen(false)} disabled={Boolean(resetBusy)} sx={{ fontWeight: 700 }}>
            Cancel
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
}
