// src/pages/admin/OwnerDetails.jsx

import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  IconButton,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  LinearProgress,
  Link as MuiLink,
  Paper,
  Skeleton,
  Snackbar,
  Tooltip,
  TextField,
  Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import CheckCircleOutlinedIcon from "@mui/icons-material/CheckCircleOutlined";
import CancelOutlinedIcon from "@mui/icons-material/CancelOutlined";
import BlockOutlinedIcon from "@mui/icons-material/BlockOutlined";
import LockOpenOutlinedIcon from "@mui/icons-material/LockOpenOutlined";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import ContentCopyOutlinedIcon from "@mui/icons-material/ContentCopyOutlined";
import HomeWorkOutlinedIcon from "@mui/icons-material/HomeWorkOutlined";
import BadgeOutlinedIcon from "@mui/icons-material/BadgeOutlined";
import BedOutlinedIcon from "@mui/icons-material/BedOutlined";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import MailOutlinedIcon from "@mui/icons-material/MailOutlined";
import PhoneOutlinedIcon from "@mui/icons-material/PhoneOutlined";
import CalendarTodayOutlinedIcon from "@mui/icons-material/CalendarTodayOutlined";
import PersonOutlinedIcon from "@mui/icons-material/PersonOutlined";
import FolderSharedOutlinedIcon from "@mui/icons-material/FolderSharedOutlined";
import ListAltOutlinedIcon from "@mui/icons-material/ListAltOutlined";
import RadioButtonUncheckedIcon from "@mui/icons-material/RadioButtonUnchecked";
import ChecklistOutlinedIcon from "@mui/icons-material/ChecklistOutlined";
import {
  doc,
  collection,
  query,
  where,
  onSnapshot,
  updateDoc,
  writeBatch,
  deleteField,
} from "firebase/firestore";
import { db } from "../../config/firebase";
import FilePreviewDialog from "../../components/FilePreviewDialog";
import { ownerRefCode } from "../../utils/ownerRef";
import { ownerAccessOf } from "../../utils/ownerAccess";
import { occupancyOf, bedsInProperty, holdsBed } from "../../utils/occupancy";
import { HeaderCard, Pill as AdminPill } from "./adminUi";
import { withoutRemoved, isRemovedAccount, removedLabel } from "../../utils/accountState";

const row = { display: "flex", alignItems: "center" };
const cardSx = { bgcolor: "background.default", border: "1px solid", borderColor: "divider", borderRadius: 3 };

/* ---------------------------------------------------------------------------
   Helpers
--------------------------------------------------------------------------- */
const toMillis = (ts) => {
  if (!ts) return 0;
  if (ts.toMillis) return ts.toMillis();
  const n = new Date(ts).getTime();
  return Number.isNaN(n) ? 0 : n;
};

const formatDate = (ts, withTime = false) => {
  const ms = toMillis(ts);
  if (!ms) return "N/A";
  return new Date(ms).toLocaleString(
    undefined,
    withTime
      ? { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }
      : { month: "short", day: "numeric", year: "numeric" }
  );
};

const formatAddress = (addressData) => {
  if (!addressData) return "No address provided";
  if (typeof addressData === "string") return addressData;
  const parts = [addressData.street, addressData.barangay, addressData.cityMunicipality, addressData.province, addressData.region].filter(Boolean);
  return parts.join(", ") || "No address provided";
};

const propertyAddress = (p) => {
  if (p.address) return formatAddress(p.address);
  const parts = [p.street, p.barangay, p.cityMunicipality, p.province, p.region].filter(Boolean);
  return parts.join(", ") || "No address provided";
};

const initials = (name) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("") || "?";

// "businessName" -> "Business name"
const humanize = (key) => {
  const spaced = key.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/[_-]+/g, " ").trim().toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
};

// Fields that are shown elsewhere on the page, or must never be displayed.
const HIDDEN_KEYS = new Set([
  "id", "uid", "role", "status", "approvalStatus", "createdAt", "updatedAt",
  "email", "phone", "phoneNumber", "mobile",
  "fullName", "name", "firstName", "lastName", "displayName",
  "verificationDocs", "rejectionReason",
  "password", "tempPassword", "passwordHash", "token", "fcmToken", "fcmTokens", "pushToken",
]);

const isDateLike = (v) => v && typeof v === "object" && typeof v.toDate === "function";

// Turn whatever else the owner registered with into label/value rows.
function extraDetails(owner) {
  const out = [];
  Object.entries(owner).forEach(([key, value]) => {
    // internal ids (uid, userId, ownerUid...) are never shown
    if (HIDDEN_KEYS.has(key) || /password|token|secret|^id$|uid$|userid$|ownerid$/i.test(key)) return;
    if (value === null || value === undefined || value === "") return;

    if (isDateLike(value)) {
      out.push({ label: humanize(key), value: formatDate(value, true) });
    } else if (Array.isArray(value)) {
      const flat = value.filter((v) => ["string", "number"].includes(typeof v));
      if (flat.length) out.push({ label: humanize(key), value: flat.join(", ") });
    } else if (typeof value === "object") {
      if (key === "address") {
        out.push({ label: "Address", value: formatAddress(value) });
        return;
      }
      Object.entries(value).forEach(([k, v]) => {
        if (["string", "number", "boolean"].includes(typeof v) && v !== "" && !/password|token|secret|url/i.test(k)) {
          out.push({ label: `${humanize(key)} · ${humanize(k)}`, value: String(v) });
        }
      });
    } else if (typeof value === "boolean") {
      out.push({ label: humanize(key), value: value ? "Yes" : "No" });
    } else if (/^https?:\/\//i.test(String(value))) {
      out.push({ label: humanize(key), value: String(value), link: true });
    } else {
      out.push({ label: humanize(key), value: String(value) });
    }
  });
  return out;
}

const STATUS_VIEW = {
  pending: { label: "Pending approval", tone: "warning" },
  rejected: { label: "Application rejected", tone: "error" },
  suspended: { label: "Suspended", tone: "error" },
  active: { label: "Active", tone: "success" },
};

function Pill({ label, tone = "default" }) {
  return (
    <Chip
      label={label}
      size="small"
      sx={{
        fontWeight: 700,
        bgcolor: (t) => (tone === "default" ? alpha(t.palette.text.primary, 0.07) : alpha(t.palette[tone].main, 0.13)),
        color: (t) => (tone === "default" ? t.palette.text.secondary : t.palette[tone].dark),
      }}
    />
  );
}

function Panel({ title, icon, action, children, sx }) {
  return (
    <Paper elevation={0} sx={{ ...cardSx, p: { xs: 2, sm: 3 }, ...sx }}>
      <Box sx={{ ...row, justifyContent: "space-between", gap: 1.5, mb: 2 }}>
        <Box sx={{ ...row, gap: 1.25, minWidth: 0 }}>
          {icon && (
            <Box sx={{ width: 34, height: 34, borderRadius: 2, flexShrink: 0, ...row, justifyContent: "center", bgcolor: "rgba(255, 69, 0, 0.1)", color: "primary.main" }}>
              {icon}
            </Box>
          )}
          <Typography variant="h6" sx={{ fontFamily: '"Inter", sans-serif', fontWeight: 700, fontSize: "1.05rem" }} noWrap>
            {title}
          </Typography>
        </Box>
        {action}
      </Box>
      {children}
    </Paper>
  );
}

// A value with a small copy button (used for the reference number)
function CopyValue({ value }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard blocked: the number is still selectable */
    }
  };
  return (
    <Box sx={{ ...row, gap: 0.5, minWidth: 0 }}>
      <Typography variant="body2" sx={{ fontWeight: 600, fontVariantNumeric: "tabular-nums", letterSpacing: "0.02em", overflowWrap: "anywhere" }}>
        {value}
      </Typography>
      <Tooltip title={copied ? "Copied" : "Copy"}>
        <IconButton size="small" onClick={copy} aria-label="Copy reference number">
          <ContentCopyOutlinedIcon sx={{ fontSize: 16 }} />
        </IconButton>
      </Tooltip>
    </Box>
  );
}

// label / value rows
function Facts({ items }) {
  return (
    <Box sx={{ display: "flex", flexDirection: "column" }}>
      {items.map((it, i) => (
        <Box
          key={`${it.label}-${i}`}
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "minmax(0, 0.9fr) minmax(0, 1.4fr)", sm: "minmax(0, 0.8fr) minmax(0, 1.6fr)" },
            gap: 1.5,
            py: 1,
            borderTop: i === 0 ? "none" : "1px solid",
            borderColor: "divider",
          }}
        >
          <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
            {it.label}
          </Typography>
          {it.copy ? (
            <CopyValue value={it.value} />
          ) : it.link ? (
            <MuiLink href={it.value} target="_blank" rel="noopener noreferrer" variant="body2" sx={{ overflowWrap: "anywhere", fontWeight: 600 }}>
              Open link
            </MuiLink>
          ) : it.href ? (
            <MuiLink href={it.href} variant="body2" underline="hover" sx={{ overflowWrap: "anywhere", fontWeight: 600 }}>
              {it.value}
            </MuiLink>
          ) : (
            <Typography variant="body2" sx={{ fontWeight: 600, overflowWrap: "anywhere", color: it.muted ? "text.secondary" : undefined }}>
              {it.value}
            </Typography>
          )}
        </Box>
      ))}
    </Box>
  );
}

// An uploaded document: image preview when it is an image, file tile otherwise.
function DocTile({ title, url, onPreview }) {
  const [imgFailed, setImgFailed] = useState(false);
  const missing = !url;
  const isPdf = /\.pdf(\?|$)/i.test(url || "");

  return (
    <Box sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2.5, overflow: "hidden", bgcolor: "background.paper" }}>
      <Box
        sx={{
          height: 140,
          ...row,
          justifyContent: "center",
          bgcolor: (t) => alpha(t.palette.text.primary, 0.04),
          position: "relative",
        }}
      >
        {!missing && !imgFailed && !isPdf ? (
          <Box
            component="img"
            src={url}
            alt={title}
            onError={() => setImgFailed(true)}
            onClick={() => onPreview?.({ url, name: title })}
            sx={{ width: "100%", height: "100%", objectFit: "cover", cursor: onPreview ? "zoom-in" : "default" }}
          />
        ) : (
          <DescriptionOutlinedIcon sx={{ fontSize: 40, color: "text.disabled" }} />
        )}
      </Box>
      <Box sx={{ ...row, justifyContent: "space-between", gap: 1, p: 1.25 }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="body2" noWrap sx={{ fontWeight: 700 }}>{title}</Typography>
          <Typography variant="caption" color={missing ? "warning.main" : "text.secondary"}>
            {missing ? "Not uploaded" : isPdf ? "PDF document" : imgFailed ? "File (open to view)" : "Image"}
          </Typography>
        </Box>
        <Box sx={{ ...row, gap: 0.5, flexShrink: 0 }}>
          <Button size="small" onClick={() => onPreview?.({ url, name: title })} disabled={missing} sx={{ fontWeight: 700 }}>
            View
          </Button>
          <IconButton
            size="small"
            component="a"
            href={url || undefined}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Open ${title} in a new tab`}
            disabled={missing}
          >
            <OpenInNewIcon fontSize="small" />
          </IconButton>
        </Box>
      </Box>
    </Box>
  );
}

// What an admin should be able to tick off before approving
function ReviewChecklist({ items }) {
  return (
    <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
      {items.map((it) => (
        <Box key={it.label} sx={{ ...row, gap: 1.25, alignItems: "flex-start" }}>
          {it.ok ? (
            <CheckCircleOutlinedIcon sx={{ fontSize: 20, color: "success.main", mt: "1px" }} />
          ) : (
            <RadioButtonUncheckedIcon sx={{ fontSize: 20, color: "warning.main", mt: "1px" }} />
          )}
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="body2" sx={{ fontWeight: 700, color: it.ok ? "text.primary" : "text.secondary" }}>{it.label}</Typography>
            {it.note && <Typography variant="caption" color="text.secondary">{it.note}</Typography>}
          </Box>
        </Box>
      ))}
    </Box>
  );
}

/* ---------------------------------------------------------------------------
   Page
--------------------------------------------------------------------------- */
export default function OwnerDetails() {
  const { ownerId, id } = useParams();
  const targetId = ownerId || id;
  const navigate = useNavigate();

  // Loading until the profile for THIS id has answered (switching owners shows the skeleton again)
  const [loadedId, setLoadedId] = useState(null);
  const loading = Boolean(targetId) && loadedId !== targetId;
  const [owner, setOwner] = useState(null);
  const [properties, setProperties] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [caretakers, setCaretakers] = useState([]);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [actionError, setActionError] = useState("");
  const [confirm, setConfirm] = useState(null); // "approve" | "reject" | "suspend" | "activate"
  const [reason, setReason] = useState("");
  const [toast, setToast] = useState({ open: false, message: "" });
  const [previewFile, setPreviewFile] = useState(null);

  useEffect(() => {
    if (!targetId) return undefined;

    // 1. Owner profile
    const unsubOwner = onSnapshot(
      doc(db, "users", targetId),
      (docSnap) => {
        setOwner(docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } : null);
        setLoadedId(targetId);
      },
      (error) => {
        console.error("Error fetching owner:", error);
        setLoadedId(targetId);
      }
    );

    // 2. Properties, tenants and caretakers that belong to this owner
    const unsubProps = onSnapshot(
      query(collection(db, "properties"), where("ownerUid", "==", targetId)),
      (snap) => setProperties(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (e) => console.error("Properties:", e)
    );
    // Tenants can be saved in "tenants", in "users", or both (same id)
    const tenantSources = { tenants: [], users: [] };
    const publishTenants = () => {
      const merged = new Map();
      [...tenantSources.tenants, ...tenantSources.users].forEach((t) => {
        const tid = t.uid || t.id;
        merged.set(tid, { ...(merged.get(tid) || {}), ...t });
      });
      setTenants(withoutRemoved([...merged.values()]));
    };
    const unsubTenants = onSnapshot(
      query(collection(db, "tenants"), where("ownerUid", "==", targetId)),
      (snap) => {
        tenantSources.tenants = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        publishTenants();
      },
      (e) => console.error("Tenants:", e)
    );
    const unsubTenantUsers = onSnapshot(
      query(collection(db, "users"), where("ownerUid", "==", targetId), where("role", "==", "tenant")),
      (snap) => {
        tenantSources.users = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        publishTenants();
      },
      (e) => console.warn("Tenant profiles:", e?.code || e)
    );
    const unsubCaretakers = onSnapshot(
      query(collection(db, "caretakers"), where("ownerUid", "==", targetId)),
      (snap) => setCaretakers(withoutRemoved(snap.docs.map((d) => ({ id: d.id, ...d.data() })))),
      (e) => console.error("Caretakers:", e)
    );

    return () => {
      unsubOwner();
      unsubProps();
      unsubTenants();
      unsubTenantUsers();
      unsubCaretakers();
    };
  }, [targetId]);

  // Suspend or activate. Takes the action that was clicked: flipping the stored
  // status turned "Activate" on a declined owner (status "rejected") into a suspension.
  const handleToggleStatus = async (newStatus) => {
    if (!owner) return;
    setUpdatingStatus(true);
    setActionError("");

    try {
      const now = new Date().toISOString();
      await updateDoc(doc(db, "users", targetId), {
        status: newStatus,
        // Marks a deliberate suspension, so it's never mistaken for a declined application
        suspendedAt: newStatus === "suspended" ? now : deleteField(),
        // If an admin manually activates a previously rejected account, update the approval status too
        ...(newStatus === "active" && owner.approvalStatus === "rejected" ? { approvalStatus: "approved", rejectionReason: deleteField() } : {}),
        updatedAt: now,
      });
      setToast({ open: true, message: newStatus === "active" ? "Account activated." : "Account suspended." });
    } catch (err) {
      console.error("Failed to update status:", err);
      setActionError("Failed to update account status. Please check permissions.");
    } finally {
      setUpdatingStatus(false);
    }
  };

  // Approve / reject a pending account and send the in-app notification
  const handleApproval = async (newApprovalStatus, rejectionReason = "") => {
    if (!owner) return;
    setUpdatingStatus(true);
    setActionError("");

    try {
      const timestamp = new Date().toISOString();

      let notificationTitle = "";
      let notificationMessage = "";
      let notificationType = "info";

      if (newApprovalStatus === "approved") {
        notificationTitle = "Account Approved!";
        notificationMessage = "Congratulations! Your property owner account has been verified. You now have full access to your operational dashboard.";
        notificationType = "success";
      } else if (newApprovalStatus === "rejected") {
        notificationTitle = "Application Rejected";
        notificationMessage = `Unfortunately, your account verification was declined. Please review the reason and resubmit your documents.${rejectionReason ? ` Reason: ${rejectionReason}` : ""}`;
        notificationType = "error";
      }

      // One batch: the status change and the owner's notification succeed or fail together.
      const batch = writeBatch(db);
      batch.update(doc(db, "users", targetId), {
        approvalStatus: newApprovalStatus,
        // A declined owner keeps access to their dashboard and Account page to re-submit
        // documents; only the admin's Suspend button locks an account
        status: newApprovalStatus === "approved" ? "active" : "rejected",
        suspendedAt: deleteField(),
        ...(newApprovalStatus === "rejected" ? { rejectionReason } : { rejectionReason: deleteField() }),
        reviewedAt: timestamp,
        updatedAt: timestamp,
      });
      batch.set(doc(collection(db, "notifications")), {
        userId: targetId,
        title: notificationTitle,
        message: notificationMessage,
        type: notificationType,
        isRead: false,
        createdAt: timestamp,
      });
      await batch.commit();

      setToast({ open: true, message: newApprovalStatus === "approved" ? "Owner approved and notified." : "Application rejected and owner notified." });
    } catch (err) {
      console.error("Failed to update approval status:", err);
      setActionError("Failed to process approval and send notification. Please check permissions.");
    } finally {
      setUpdatingStatus(false);
    }
  };

  const runConfirmed = async () => {
    const action = confirm;
    const why = reason.trim();
    if (action === "reject" && why.length < 5) return; // the button is disabled too
    setConfirm(null);
    setReason("");
    if (action === "approve") await handleApproval("approved");
    else if (action === "reject") await handleApproval("rejected", why);
    else if (action === "suspend") await handleToggleStatus("suspended");
    else if (action === "activate") await handleToggleStatus("active");
  };

  // ---- derived ----
  // Same occupancy rule as the owner pages: beds from the rooms, occupied = current tenants
  const occ = useMemo(() => occupancyOf(properties.map((p) => ({ id: p.id, beds: bedsInProperty(p) })), tenants), [properties, tenants]);
  const currentTenants = useMemo(() => tenants.filter(holdsBed), [tenants]);
  const perProperty = useMemo(() => {
    const map = {};
    properties.forEach((p) => {
      map[p.id] = occ.byProperty.get(p.id)?.occupied || 0;
    });
    return map;
  }, [properties, occ]);

  const portfolio = useMemo(() => {
    const rooms = properties.reduce((s, p) => s + (Array.isArray(p.rooms) ? p.rooms.length : Number(p.totalRooms) || 0), 0);
    return { rooms, beds: occ.beds, occupied: occ.occupied };
  }, [properties, occ]);

  const propName = (pid) => {
    const p = properties.find((x) => x.id === pid);
    return p ? p.propertyName || p.name || "Property" : "";
  };

  const extras = useMemo(() => (owner ? extraDetails(owner) : []), [owner]);

  if (loading) {
    return (
      <Box>
        <Skeleton variant="rounded" width={140} height={34} sx={{ borderRadius: 2, mb: 2 }} />
        <Skeleton variant="rounded" height={150} sx={{ borderRadius: 3, mb: 2 }} />
        <Skeleton variant="rounded" height={76} sx={{ borderRadius: 3, mb: 2 }} />
        <Skeleton variant="rounded" height={280} sx={{ borderRadius: 3 }} />
      </Box>
    );
  }

  if (!owner) {
    return (
      <Box>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate("/admin/owners")} sx={{ mb: 2, fontWeight: 700 }}>
          Back to owners
        </Button>
        <Alert severity="error" sx={{ borderRadius: 2 }}>
          Owner account not found or has been removed.
        </Alert>
      </Box>
    );
  }

  const ownerName =
    owner.fullName || owner.name || (owner.firstName && owner.lastName ? `${owner.firstName} ${owner.lastName}` : "Unnamed owner");
  const phone = owner.phoneNumber || owner.phone || owner.mobile || "";

  // Same rule as the route guard, so this page shows what the owner can actually do
  const viewKey = ownerAccessOf(owner);
  const isPending = viewKey === "pending";
  const isRejected = viewKey === "rejected";
  const isSuspended = viewKey === "suspended";
  const view = STATUS_VIEW[viewKey];

  const docs = owner.verificationDocs;
  const docsComplete = !!(docs?.idUrl && docs?.clearanceUrl);
  const resubmitted =
    isPending && toMillis(owner.reviewedAt) > 0 && toMillis(docs?.submittedAt) > toMillis(owner.reviewedAt);
  const checklist = [
    { label: "Government ID uploaded", ok: !!docs?.idUrl, note: docs?.idUrl ? "Open it and check the name and photo are readable." : undefined },
    { label: "Proof of ownership uploaded", ok: !!docs?.clearanceUrl, note: docs?.clearanceUrl ? "Check it matches the property they registered." : undefined },
    { label: "Name and contact details", ok: !!(owner.email && phone), note: !phone ? "No phone number on file." : undefined },
    { label: "Registered a property", ok: properties.length > 0, note: properties.length === 0 ? "They haven't added a property yet." : undefined },
  ];
  const occPct = portfolio.beds > 0 ? Math.round((portfolio.occupied / portfolio.beds) * 100) : 0;

  const CONFIRM_COPY = {
    approve: { title: "Approve this owner?", body: `${ownerName} will get full access to their dashboard and receive an in-app notification.`, cta: "Approve", color: "success" },
    reject: { title: "Reject this application?", body: `${ownerName} will be notified that verification was declined. You can add a reason below.`, cta: "Reject", color: "error" },
    suspend: { title: "Suspend this account?", body: `${ownerName} will be blocked from using their account until you activate it again.`, cta: "Suspend", color: "error" },
    activate: { title: "Activate this account?", body: `${ownerName} will regain access to their account.`, cta: "Activate", color: "success" },
  };
  const copy = confirm ? CONFIRM_COPY[confirm] : null;

  return (
    <Box sx={{ pb: isPending ? { xs: 9, md: 0 } : 0 }}>
      <Button
        startIcon={<ArrowBackIcon />}
        onClick={() => navigate("/admin/owners")}
        size="small"
        sx={{ mb: 2, fontWeight: 700, ml: -1 }}
      >
        Back to owners
      </Button>

      {isRemovedAccount(owner) && (
        <Alert severity="error" sx={{ mb: 2, borderRadius: "14px" }}>
          <strong>{removedLabel(owner)}</strong> They no longer appear in lists, counts or announcements. Their records are kept for your history.
        </Alert>
      )}

      {actionError && (
        <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }} onClose={() => setActionError("")}>
          {actionError}
        </Alert>
      )}

      <HeaderCard
        eyebrow={
          <Box sx={{ mb: 1 }}>
            <AdminPill label={view.label} tone={view.tone} />
          </Box>
        }
        title={
          <Box component="span" sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            <Avatar sx={{ width: { xs: 48, sm: 60 }, height: { xs: 48, sm: 60 }, fontSize: { xs: "1.05rem", sm: "1.3rem" }, fontWeight: 800, bgcolor: "primary.main", color: "#fff", flexShrink: 0 }}>
              {initials(ownerName)}
            </Avatar>
            <Box component="span" sx={{ minWidth: 0 }}>{ownerName}</Box>
          </Box>
        }
        action={
          isPending ? (
            <>
              <Button variant="outlined" color="error" startIcon={<CancelOutlinedIcon />} onClick={() => setConfirm("reject")} disabled={updatingStatus} sx={{ display: { xs: "none", md: "inline-flex" }, fontWeight: 700, borderRadius: "10px", minHeight: 44 }}>
                Reject
              </Button>
              <Button variant="contained" color="success" disableElevation startIcon={<CheckCircleOutlinedIcon />} onClick={() => setConfirm("approve")} disabled={updatingStatus || !docsComplete} sx={{ display: { xs: "none", md: "inline-flex" }, fontWeight: 700, borderRadius: "10px", minHeight: 44 }}>
                Approve
              </Button>
            </>
          ) : isSuspended || isRejected ? (
            <Button variant="contained" color="success" disableElevation startIcon={<LockOpenOutlinedIcon />} onClick={() => setConfirm("activate")} disabled={updatingStatus} sx={{ fontWeight: 700, borderRadius: "10px", minHeight: 44 }}>
              Activate account
            </Button>
          ) : (
            <Button variant="outlined" color="error" startIcon={<BlockOutlinedIcon />} onClick={() => setConfirm("suspend")} disabled={updatingStatus} sx={{ fontWeight: 700, borderRadius: "10px", minHeight: 44 }}>
              Suspend account
            </Button>
          )
        }
        tiles={[
          { label: "Properties", value: properties.length, sub: `${portfolio.rooms} rooms`, icon: <HomeWorkOutlinedIcon /> },
          { label: "Beds filled", value: `${portfolio.occupied}/${portfolio.beds}`, sub: portfolio.beds > 0 ? `${occPct}% occupied` : "No beds yet", icon: <BedOutlinedIcon /> },
          { label: "Tenants", value: currentTenants.length, sub: "Current", icon: <GroupsOutlinedIcon /> },
          { label: "Caretakers", value: caretakers.length, sub: "Staff accounts", icon: <BadgeOutlinedIcon /> },
        ]}
      >
        {/* contact + what to do next */}
        <Box sx={{ position: "relative", mb: { xs: 2, sm: 2.5 } }}>
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75 }}>
            {owner.email && (
              <Button size="small" color="inherit" href={`mailto:${owner.email}`} startIcon={<MailOutlinedIcon />} sx={{ borderRadius: 99, px: 1.5, bgcolor: (t) => alpha(t.palette.text.primary, 0.05), fontWeight: 600, textTransform: "none", maxWidth: "100%", "& .MuiButton-startIcon": { mr: 0.75 } }}>
                <Box component="span" sx={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{owner.email}</Box>
              </Button>
            )}
            {phone && (
              <Button size="small" color="inherit" href={`tel:${phone}`} startIcon={<PhoneOutlinedIcon />} sx={{ borderRadius: 99, px: 1.5, bgcolor: (t) => alpha(t.palette.text.primary, 0.05), fontWeight: 600, textTransform: "none", "& .MuiButton-startIcon": { mr: 0.75 } }}>
                {phone}
              </Button>
            )}
            <Box sx={{ ...row, gap: 0.75, px: 1.5, height: 30, borderRadius: 99, fontSize: 13, fontWeight: 600, color: "text.secondary", bgcolor: (t) => alpha(t.palette.text.primary, 0.05) }}>
              <CalendarTodayOutlinedIcon sx={{ fontSize: 16 }} /> Joined {formatDate(owner.createdAt)}
            </Box>
          </Box>
          {isRejected && owner.rejectionReason && (
            <Alert severity="error" sx={{ mt: 1.5, borderRadius: "12px" }}>
              Declined: {owner.rejectionReason}
            </Alert>
          )}
          {resubmitted && (
            <Alert severity="info" sx={{ mt: 1.5, borderRadius: "12px" }}>
              They re-submitted their documents on {formatDate(docs.submittedAt, true)}, after being declined.
            </Alert>
          )}
          {isPending && (
            <Alert severity={docsComplete ? "warning" : "error"} sx={{ mt: 1.5, borderRadius: "12px" }}>
              {docsComplete
                ? "Check the verification documents below, then approve or reject."
                : docs
                ? "Some documents are missing. Reject with a reason so the owner can re-submit."
                : "No verification documents uploaded yet. Reject with a reason so the owner can submit them."}
            </Alert>
          )}
        </Box>
      </HeaderCard>

      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "minmax(0, 1.55fr) minmax(0, 1fr)" },
          gap: { xs: 2, sm: 3 },
          alignItems: "start",
        }}
      >
        {/* MAIN: portfolio */}
        <Box sx={{ display: "flex", flexDirection: "column", gap: { xs: 2, sm: 2.5 }, minWidth: 0 }}>
          <Panel
            title={`Properties (${properties.length})`}
            icon={<HomeWorkOutlinedIcon fontSize="small" />}
            action={portfolio.beds > 0 ? <Pill label={`${occPct}% occupied`} tone={occPct >= 70 ? "success" : "warning"} /> : null}
          >
            {properties.length === 0 ? (
              <Box sx={{ textAlign: "center", py: 3 }}>
                <Box sx={{ width: 56, height: 56, borderRadius: "50%", mx: "auto", mb: 1.5, ...row, justifyContent: "center", bgcolor: "rgba(255, 69, 0, 0.10)" }}>
                  <HomeWorkOutlinedIcon sx={{ fontSize: 28, color: "primary.main" }} />
                </Box>
                <Typography sx={{ fontWeight: 700 }}>No properties yet</Typography>
                <Typography variant="body2" color="text.secondary">
                  This owner hasn't registered any properties.
                </Typography>
              </Box>
            ) : (
              <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
                {properties.map((prop) => {
                  const o = occ.byProperty.get(prop.id) || { beds: bedsInProperty(prop), occupied: 0, rate: 0 };
                  const beds = o.beds;
                  const filled = o.occupied;
                  const pct = o.rate;
                  return (
                    <Box key={prop.id} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 3, overflow: "hidden", bgcolor: "background.paper" }}>
                      <Box
                        sx={{
                          height: 88,
                          position: "relative",
                          ...row,
                          justifyContent: "center",
                          bgcolor: (t) => alpha(t.palette.background.paper, 0.7),
                          background: prop.coverPhotoUrl
                            ? `url(${prop.coverPhotoUrl}) center / cover`
                            : "linear-gradient(135deg, #f2e9dd 0%, #faf7f3 60%, rgba(255,69,0,0.18) 140%)",
                        }}
                      >
                        {!prop.coverPhotoUrl && <HomeWorkOutlinedIcon sx={{ fontSize: 34, color: "rgba(255,69,0,0.45)" }} />}
                        <Box sx={{ position: "absolute", top: 10, right: 10 }}>
                          <Chip size="small" label={prop.propertyType || "N/A"} sx={{ fontWeight: 700, bgcolor: "rgba(255,255,255,0.92)", color: "#202020" }} />
                        </Box>
                      </Box>
                      <Box sx={{ p: 2 }}>
                        <Typography sx={{ fontWeight: 800, overflowWrap: "anywhere" }}>
                          {prop.propertyName || prop.name || "Unnamed Property"}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: "anywhere" }}>
                          {propertyAddress(prop)}
                        </Typography>

                        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 1, mt: 1.5 }}>
                          {[
                            { k: "Floors", v: prop.totalFloors || 1 },
                            { k: "Rooms", v: Array.isArray(prop.rooms) ? prop.rooms.length : prop.totalRooms || 0 },
                            { k: "Tenants", v: perProperty[prop.id] || 0 },
                          ].map((m) => (
                            <Box key={m.k} sx={{ textAlign: "center", py: 0.75, borderRadius: 2, bgcolor: (t) => alpha(t.palette.text.primary, 0.04) }}>
                              <Typography sx={{ fontWeight: 800, lineHeight: 1.2 }}>{m.v}</Typography>
                              <Typography variant="caption" color="text.secondary">{m.k}</Typography>
                            </Box>
                          ))}
                        </Box>

                        <Box sx={{ mt: 1.75 }}>
                          <Box sx={{ ...row, justifyContent: "space-between", mb: 0.5 }}>
                            <Typography variant="caption" sx={{ fontWeight: 700 }}>
                              {filled} / {beds} beds occupied
                            </Typography>
                            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                              {beds > 0 ? `${pct}%` : "—"}
                            </Typography>
                          </Box>
                          <LinearProgress
                            variant="determinate"
                            value={pct}
                            color={pct >= 70 ? "success" : "primary"}
                            sx={{ height: 6, borderRadius: 3, bgcolor: (t) => alpha(t.palette.text.primary, 0.08) }}
                          />
                        </Box>
                      </Box>
                    </Box>
                  );
                })}
              </Box>
            )}
          </Panel>

          <Panel title={`Caretakers (${caretakers.length})`} icon={<BadgeOutlinedIcon fontSize="small" />}>
            {caretakers.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                No caretakers added.
              </Typography>
            ) : (
              <Box sx={{ display: "flex", flexDirection: "column" }}>
                {caretakers.map((c, i) => {
                  const cName = c.fullName || c.name || `${c.firstName || ""} ${c.lastName || ""}`.trim() || "Caretaker";
                  const assigned = propName(c.assignedPropertyId || c.propertyId);
                  const loggedIn = c.status ? String(c.status) : "";
                  return (
                    <Box
                      key={c.id}
                      sx={{ ...row, gap: 1.5, py: 1.25, borderTop: i === 0 ? "none" : "1px solid", borderColor: "divider" }}
                    >
                      <Avatar sx={{ width: 36, height: 36, bgcolor: "rgba(255, 69, 0, 0.12)", color: "primary.main", fontWeight: 800, fontSize: 14 }}>
                        <BadgeOutlinedIcon fontSize="small" />
                      </Avatar>
                      <Box sx={{ minWidth: 0, flex: 1 }}>
                        <Typography variant="body2" noWrap sx={{ fontWeight: 700 }}>{cName}</Typography>
                        <Typography variant="caption" color="text.secondary" noWrap component="div">
                          {assigned || "No property assigned"}
                        </Typography>
                      </Box>
                      {loggedIn && <Pill label={loggedIn.charAt(0).toUpperCase() + loggedIn.slice(1)} />}
                    </Box>
                  );
                })}
              </Box>
            )}
          </Panel>
        </Box>

        {/* SIDE: account + verification */}
        <Box sx={{ display: "flex", flexDirection: "column", gap: { xs: 2, sm: 2.5 }, minWidth: 0 }}>
          {isPending && (
            <Panel
              title="Review checklist"
              icon={<ChecklistOutlinedIcon fontSize="small" />}
              action={<Pill label={`${checklist.filter((c) => c.ok).length}/${checklist.length}`} tone={checklist.every((c) => c.ok) ? "success" : "warning"} />}
            >
              <ReviewChecklist items={checklist} />
            </Panel>
          )}

          <Panel title="Account" icon={<PersonOutlinedIcon fontSize="small" />}>
            <Facts
              items={[
                { label: "Full name", value: ownerName },
                { label: "Email", value: owner.email || "Not provided", href: owner.email ? `mailto:${owner.email}` : undefined, muted: !owner.email },
                { label: "Phone", value: phone || "Not provided", href: phone ? `tel:${phone}` : undefined, muted: !phone },
                { label: "Account status", value: view.label },
                { label: "Registered", value: formatDate(owner.createdAt, true) },
                { label: "Last updated", value: formatDate(owner.updatedAt, true) },
                { label: "Reference no.", value: ownerRefCode(owner.id), copy: true },
              ]}
            />
          </Panel>

          {extras.length > 0 && (
            <Panel title="Registration details" icon={<ListAltOutlinedIcon fontSize="small" />}>
              <Facts items={extras} />
            </Panel>
          )}

          <Panel
            title="Verification documents"
            icon={<FolderSharedOutlinedIcon fontSize="small" />}
            action={docs ? <Pill label={docsComplete ? "Complete" : "Incomplete"} tone={docsComplete ? "success" : "warning"} /> : <Pill label="None" tone="warning" />}
          >
            {docs ? (
              <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
                <DocTile title="Government ID" url={docs.idUrl} onPreview={setPreviewFile} />
                <DocTile title="Proof of ownership" url={docs.clearanceUrl} onPreview={setPreviewFile} />
                {docs.submittedAt && (
                  <Typography variant="caption" color="text.secondary">
                    Submitted {formatDate(docs.submittedAt, true)}
                  </Typography>
                )}
              </Box>
            ) : (
              <Typography variant="body2" color="text.secondary">
                No verification documents submitted yet.
              </Typography>
            )}
          </Panel>
        </Box>
      </Box>

      {/* Phones: Approve / Reject stay within reach while scrolling through the documents */}
      {isPending && (
        <Box
          sx={{
            display: { xs: "flex", md: "none" },
            position: "fixed",
            left: 0,
            right: 0,
            bottom: "calc(66px + env(safe-area-inset-bottom, 0px))",
            zIndex: (t) => t.zIndex.appBar - 1,
            gap: 1.25,
            px: 2,
            py: 1.25,
            bgcolor: "background.default",
            borderTop: "1px solid",
            borderColor: "divider",
          }}
        >
          <Button
            variant="outlined"
            color="error"
            startIcon={<CancelOutlinedIcon />}
            onClick={() => setConfirm("reject")}
            disabled={updatingStatus}
            sx={{ flex: 1, fontWeight: 700, borderRadius: 2.5, minHeight: 44 }}
          >
            Reject
          </Button>
          <Button
            variant="contained"
            color="success"
            startIcon={<CheckCircleOutlinedIcon />}
            onClick={() => setConfirm("approve")}
            disabled={updatingStatus || !docsComplete}
            sx={{ flex: 1, fontWeight: 700, borderRadius: 2.5, minHeight: 44 }}
          >
            Approve
          </Button>
        </Box>
      )}

      <FilePreviewDialog file={previewFile} onClose={() => setPreviewFile(null)} />

      {/* Confirm dialog */}
      <Dialog open={!!confirm} onClose={() => setConfirm(null)} fullWidth maxWidth="xs" slotProps={{ paper: { sx: { borderRadius: "22px" } } }}>
        {copy && (
          <>
            <DialogTitle sx={{ fontWeight: 800 }}>{copy.title}</DialogTitle>
            <DialogContent>
              <DialogContentText>{copy.body}</DialogContentText>
              {confirm === "reject" && (
                <TextField
                  label="Reason (required)"
                  placeholder="e.g. ID photo is unreadable"
                  value={reason}
                  onChange={(e) => setReason(e.target.value.slice(0, 300))}
                  multiline
                  minRows={2}
                  fullWidth
                  size="small"
                  sx={{ mt: 2 }}
                  required
                  helperText={`${reason.length}/300 · the owner will see this, so say what to fix`}
                />
              )}
            </DialogContent>
            <DialogActions sx={{ px: 3, pb: 2 }}>
              <Button onClick={() => { setConfirm(null); setReason(""); }} sx={{ fontWeight: 700 }}>
                Cancel
              </Button>
              <Button
                variant="contained"
                color={copy.color}
                onClick={runConfirmed}
                disabled={confirm === "reject" && reason.trim().length < 5}
                sx={{ fontWeight: 700, borderRadius: 2.5 }}
              >
                {copy.cta}
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>

      {updatingStatus && (
        <Box sx={{ position: "fixed", right: 20, bottom: { xs: 84, md: 20 }, ...row, gap: 1, bgcolor: "#202020", color: "#fff", px: 2, py: 1, borderRadius: 3, zIndex: (t) => t.zIndex.snackbar }}>
          <CircularProgress size={16} color="inherit" />
          <Typography variant="body2" sx={{ fontWeight: 600 }}>Saving...</Typography>
        </Box>
      )}

      <Snackbar
        open={toast.open}
        autoHideDuration={4000}
        onClose={() => setToast((t) => ({ ...t, open: false }))}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        sx={{ bottom: { xs: `calc(${isPending ? 136 : 80}px + env(safe-area-inset-bottom)) !important`, sm: undefined } }}
      >
        <Alert severity="success" variant="filled" sx={{ borderRadius: 2 }}>
          {toast.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}