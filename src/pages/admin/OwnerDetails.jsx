// src/pages/admin/OwnerDetails.jsx

import React, { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Alert,
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  GlobalStyles,
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
import MeetingRoomOutlinedIcon from "@mui/icons-material/MeetingRoomOutlined";
import BedOutlinedIcon from "@mui/icons-material/BedOutlined";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import MailOutlinedIcon from "@mui/icons-material/MailOutlined";
import PhoneOutlinedIcon from "@mui/icons-material/PhoneOutlined";
import CalendarTodayOutlinedIcon from "@mui/icons-material/CalendarTodayOutlined";
import PersonOutlinedIcon from "@mui/icons-material/PersonOutlined";
import FolderSharedOutlinedIcon from "@mui/icons-material/FolderSharedOutlined";
import FactCheckOutlinedIcon from "@mui/icons-material/FactCheckOutlined";
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

// Windows light up once on load; switched off for "reduce motion" users.
const AnimationStyles = (
  <GlobalStyles
    styles={{
      "@keyframes kkPop": { from: { opacity: 0, transform: "scale(0.6)" }, to: { opacity: 1, transform: "scale(1)" } },
      "@media (prefers-reduced-motion: reduce)": {
        "*, *::before, *::after": { animationDuration: "0.001ms !important", transitionDuration: "0.001ms !important" },
      },
    }}
  />
);

// Same dorm-facade windows as the owner dashboard: lit = occupied beds.
const WINDOW_COUNT = 30;
const LIGHT_ORDER = [3, 17, 8, 24, 1, 12, 27, 5, 20, 14, 9, 29, 2, 22, 11, 6, 25, 16, 0, 19, 28, 7, 13, 23, 4, 21, 10, 26, 15, 18];
const WINDOW_RANK = LIGHT_ORDER.reduce((acc, cell, rank) => ({ ...acc, [cell]: rank }), {});

function OccupancyWindows({ occupied, total }) {
  const rate = total > 0 ? occupied / total : 0;
  const lit = occupied > 0 ? Math.max(1, Math.round(rate * WINDOW_COUNT)) : 0;
  return (
    <Box>
      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(10, 1fr)", gap: { xs: 0.75, md: 1 }, width: "100%", maxWidth: 320 }}>
        {Array.from({ length: WINDOW_COUNT }).map((_, i) => (
          <Box
            key={i}
            sx={{
              aspectRatio: "1",
              borderRadius: "4px",
              bgcolor: WINDOW_RANK[i] < lit ? "primary.main" : "rgba(202, 220, 246, 0.14)",
              animation: `kkPop 0.4s ease-out ${i * 18}ms both`,
            }}
          />
        ))}
      </Box>
      <Typography variant="caption" sx={{ color: "#cadcf6", display: "block", mt: 1.25 }}>
        {total > 0 ? `${occupied} of ${total} beds occupied` : "No beds set up yet"}
      </Typography>
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

function MetricBox({ title, value, subtitle, icon }) {
  return (
    <Paper elevation={0} sx={{ ...cardSx, p: { xs: 1.75, sm: 2.25 }, height: "100%" }}>
      <Box sx={{ ...row, justifyContent: "space-between", alignItems: "flex-start", gap: 1, mb: 1 }}>
        <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600, lineHeight: 1.3 }}>
          {title}
        </Typography>
        <Box sx={{ p: 0.9, borderRadius: 2, bgcolor: "rgba(255, 69, 0, 0.1)", color: "primary.main", display: "flex", flexShrink: 0 }}>
          {icon}
        </Box>
      </Box>
      <Typography sx={{ fontFamily: '"Inter", sans-serif', fontWeight: 800, fontSize: { xs: "1.5rem", sm: "1.9rem" }, lineHeight: 1.15 }}>
        {value}
      </Typography>
      <Typography variant="caption" color="text.secondary">
        {subtitle}
      </Typography>
    </Paper>
  );
}

/* ---------------------------------------------------------------------------
   Page
--------------------------------------------------------------------------- */
export default function OwnerDetails() {
  const { ownerId, id } = useParams();
  const targetId = ownerId || id;
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
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
    if (!targetId) {
      setLoading(false);
      return undefined;
    }
    setLoading(true);

    // 1. Owner profile
    const unsubOwner = onSnapshot(
      doc(db, "users", targetId),
      (docSnap) => {
        setOwner(docSnap.exists() ? { id: docSnap.id, ...docSnap.data() } : null);
        setLoading(false);
      },
      (error) => {
        console.error("Error fetching owner:", error);
        setLoading(false);
      }
    );

    // 2. Properties, tenants and caretakers that belong to this owner
    const unsubProps = onSnapshot(
      query(collection(db, "properties"), where("ownerUid", "==", targetId)),
      (snap) => setProperties(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (e) => console.error("Properties:", e)
    );
    const unsubTenants = onSnapshot(
      query(collection(db, "tenants"), where("ownerUid", "==", targetId)),
      (snap) => setTenants(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (e) => console.error("Tenants:", e)
    );
    const unsubCaretakers = onSnapshot(
      query(collection(db, "caretakers"), where("ownerUid", "==", targetId)),
      (snap) => setCaretakers(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (e) => console.error("Caretakers:", e)
    );

    return () => {
      unsubOwner();
      unsubProps();
      unsubTenants();
      unsubCaretakers();
    };
  }, [targetId]);

  // Standard suspension toggle
  const handleToggleStatus = async () => {
    if (!owner) return;
    setUpdatingStatus(true);
    setActionError("");

    const currentStatus = owner.status || "active";
    const newStatus = currentStatus === "suspended" ? "active" : "suspended";

    try {
      await updateDoc(doc(db, "users", targetId), {
        status: newStatus,
        // If an admin manually activates a previously rejected account, update the approval status too
        ...(newStatus === "active" && owner.approvalStatus === "rejected" ? { approvalStatus: "approved" } : {}),
        updatedAt: new Date().toISOString(),
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
        status: newApprovalStatus === "approved" ? "active" : "suspended",
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
    else if (action === "suspend" || action === "activate") await handleToggleStatus();
  };

  // ---- derived ----
  const perProperty = useMemo(() => {
    const map = {};
    tenants.forEach((t) => {
      const pid = t.propertyId || t.assignedPropertyId;
      if (pid) map[pid] = (map[pid] || 0) + 1;
    });
    return map;
  }, [tenants]);

  const portfolio = useMemo(() => {
    const rooms = properties.reduce((s, p) => s + (Number(p.totalRooms) || 0), 0);
    const beds = properties.reduce((s, p) => s + (Number(p.totalBeds) || 0), 0);
    const occupied = properties.reduce((s, p) => s + (Number(p.occupiedBeds) || 0), 0);
    return { rooms, beds, occupied };
  }, [properties]);

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

  const isPending = owner.status === "pending" || owner.approvalStatus === "pending";
  const isRejected = owner.approvalStatus === "rejected";
  const isSuspended = owner.status === "suspended" && !isRejected;
  const viewKey = isPending ? "pending" : isRejected ? "rejected" : isSuspended ? "suspended" : "active";
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

  const heroTone = {
    pending: { bg: "rgba(255, 167, 38, 0.18)", fg: "#ffcc80" },
    rejected: { bg: "rgba(244, 67, 54, 0.18)", fg: "#ef9a9a" },
    suspended: { bg: "rgba(244, 67, 54, 0.18)", fg: "#ef9a9a" },
    active: { bg: "rgba(76, 175, 80, 0.18)", fg: "#a5d6a7" },
  }[viewKey];

  const heroLinkSx = {
    ...row,
    gap: 0.75,
    px: 1.5,
    py: 0.75,
    borderRadius: 5,
    fontSize: 13,
    fontWeight: 600,
    color: "#e8eef9",
    textDecoration: "none",
    bgcolor: "rgba(255,255,255,0.08)",
    maxWidth: "100%",
    "&:hover": { bgcolor: "rgba(255,255,255,0.14)" },
  };

  const CONFIRM_COPY = {
    approve: { title: "Approve this owner?", body: `${ownerName} will get full access to their dashboard and receive an in-app notification.`, cta: "Approve", color: "success" },
    reject: { title: "Reject this application?", body: `${ownerName} will be notified that verification was declined. You can add a reason below.`, cta: "Reject", color: "error" },
    suspend: { title: "Suspend this account?", body: `${ownerName} will be blocked from using their account until you activate it again.`, cta: "Suspend", color: "error" },
    activate: { title: "Activate this account?", body: `${ownerName} will regain access to their account.`, cta: "Activate", color: "success" },
  };
  const copy = confirm ? CONFIRM_COPY[confirm] : null;

  return (
    <Box sx={{ pb: isPending ? { xs: 9, md: 0 } : 0 }}>
      {AnimationStyles}
      <Button
        startIcon={<ArrowBackIcon />}
        onClick={() => navigate("/admin/owners")}
        size="small"
        sx={{ mb: 2, fontWeight: 700, ml: -1 }}
      >
        Back to owners
      </Button>

      {actionError && (
        <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }} onClose={() => setActionError("")}>
          {actionError}
        </Alert>
      )}

      {/* Hero: dark brand surface, same as the owner dashboard */}
      <Box
        sx={{
          position: "relative",
          overflow: "hidden",
          bgcolor: "#202020",
          color: "#ffffff",
          borderRadius: 4,
          p: { xs: 2.5, sm: 4 },
          mb: { xs: 2, sm: 3 },
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "1.25fr 0.75fr" },
          gap: { xs: 3, md: 4 },
          alignItems: "center",
        }}
      >
        <Box
          sx={{
            position: "absolute",
            top: -140,
            right: -100,
            width: 380,
            height: 380,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(255, 69, 0, 0.22), transparent 70%)",
            pointerEvents: "none",
          }}
        />

        <Box sx={{ position: "relative", minWidth: 0 }}>
          <Chip size="small" label={view.label} sx={{ bgcolor: heroTone.bg, color: heroTone.fg, fontWeight: 700, mb: 1.5 }} />

          <Box sx={{ ...row, gap: 2 }}>
            <Avatar sx={{ width: 60, height: 60, fontSize: "1.3rem", fontWeight: 800, bgcolor: "primary.main", color: "#fff", flexShrink: 0 }}>
              {initials(ownerName)}
            </Avatar>
            <Box sx={{ minWidth: 0 }}>
              <Typography
                component="h1"
                sx={{ fontFamily: '"Inter", sans-serif', fontWeight: 900, color: "#fff", fontSize: { xs: "1.5rem", sm: "2rem" }, lineHeight: 1.15, overflowWrap: "anywhere" }}
              >
                {ownerName}
              </Typography>
              <Typography variant="body2" sx={{ color: "#cadcf6", mt: 0.25 }}>
                Platform property owner
              </Typography>
            </Box>
          </Box>

          {/* contact chips */}
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mt: 2.25 }}>
            {owner.email && (
              <Box component="a" href={`mailto:${owner.email}`} sx={heroLinkSx}>
                <MailOutlinedIcon sx={{ fontSize: 16 }} /> <span style={{ overflowWrap: "anywhere" }}>{owner.email}</span>
              </Box>
            )}
            {phone && (
              <Box component="a" href={`tel:${phone}`} sx={heroLinkSx}>
                <PhoneOutlinedIcon sx={{ fontSize: 16 }} /> {phone}
              </Box>
            )}
            <Box sx={{ ...heroLinkSx, cursor: "default", "&:hover": undefined }}>
              <CalendarTodayOutlinedIcon sx={{ fontSize: 16 }} /> Joined {formatDate(owner.createdAt)}
            </Box>
          </Box>

          {isRejected && owner.rejectionReason && (
            <Typography variant="body2" sx={{ color: "#ef9a9a", mt: 1.5 }}>
              Rejected: {owner.rejectionReason}
            </Typography>
          )}
          {resubmitted && (
            <Typography variant="body2" sx={{ color: "#cadcf6", mt: 1.5, fontWeight: 600 }}>
              Resubmitted their documents on {formatDate(docs.submittedAt, true)}, after being rejected.
            </Typography>
          )}
          {isPending && (
            <Typography variant="body2" sx={{ color: "#ffcc80", mt: 1.5 }}>
              {docsComplete
                ? "Check the verification documents below, then approve or reject."
                : docs
                ? "Some documents are missing. Reject with a reason so the owner can resubmit."
                : "No verification documents uploaded yet. Reject with a reason so the owner can submit them."}
            </Typography>
          )}

          {/* actions */}
          <Box sx={{ display: isPending ? { xs: "none", md: "flex" } : "flex", flexWrap: "wrap", gap: 1.25, mt: 2.5 }}>
            {isPending ? (
              <>
                <Button
                  variant="contained"
                  color="success"
                  startIcon={<CheckCircleOutlinedIcon />}
                  onClick={() => setConfirm("approve")}
                  disabled={updatingStatus || !docsComplete}
                  sx={{ fontWeight: 700, borderRadius: 2.5, flex: { xs: 1, sm: "none" } }}
                >
                  Approve
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<CancelOutlinedIcon />}
                  onClick={() => setConfirm("reject")}
                  disabled={updatingStatus}
                  sx={{ fontWeight: 700, borderRadius: 2.5, flex: { xs: 1, sm: "none" }, color: "#ef9a9a", borderColor: "rgba(239,154,154,0.5)", "&:hover": { borderColor: "#ef9a9a", bgcolor: "rgba(239,154,154,0.08)" } }}
                >
                  Reject
                </Button>
              </>
            ) : isSuspended || isRejected ? (
              <Button
                variant="contained"
                color="success"
                startIcon={<LockOpenOutlinedIcon />}
                onClick={() => setConfirm("activate")}
                disabled={updatingStatus}
                sx={{ fontWeight: 700, borderRadius: 2.5, width: { xs: "100%", sm: "auto" } }}
              >
                Activate account
              </Button>
            ) : (
              <Button
                variant="outlined"
                startIcon={<BlockOutlinedIcon />}
                onClick={() => setConfirm("suspend")}
                disabled={updatingStatus}
                sx={{ fontWeight: 700, borderRadius: 2.5, width: { xs: "100%", sm: "auto" }, color: "#ef9a9a", borderColor: "rgba(239,154,154,0.5)", "&:hover": { borderColor: "#ef9a9a", bgcolor: "rgba(239,154,154,0.08)" } }}
              >
                Suspend account
              </Button>
            )}
          </Box>
        </Box>

        <Box sx={{ position: "relative" }}>
          <OccupancyWindows occupied={portfolio.occupied} total={portfolio.beds} />
        </Box>
      </Box>

      {/* Portfolio metrics */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", md: "repeat(5, minmax(0, 1fr))" },
          gap: { xs: 1.5, md: 2 },
          mb: { xs: 2, sm: 3 },
          "& > :last-child": { gridColumn: { xs: "span 2", md: "auto" } },
        }}
      >
        <MetricBox title="Properties" value={properties.length} subtitle="Registered dorms/apts" icon={<HomeWorkOutlinedIcon fontSize="small" />} />
        <MetricBox title="Rooms" value={portfolio.rooms} subtitle="Across all properties" icon={<MeetingRoomOutlinedIcon fontSize="small" />} />
        <MetricBox title="Beds" value={`${portfolio.occupied}/${portfolio.beds}`} subtitle={portfolio.beds > 0 ? `${occPct}% occupied` : "No beds yet"} icon={<BedOutlinedIcon fontSize="small" />} />
        <MetricBox title="Tenants" value={tenants.length} subtitle="On the platform" icon={<GroupsOutlinedIcon fontSize="small" />} />
        <MetricBox title="Caretakers" value={caretakers.length} subtitle="Staff accounts" icon={<BadgeOutlinedIcon fontSize="small" />} />
      </Box>

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
                  const beds = Number(prop.totalBeds) || 0;
                  const occ = Number(prop.occupiedBeds) || 0;
                  const pct = beds > 0 ? Math.min(100, Math.round((occ / beds) * 100)) : 0;
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
                            : "linear-gradient(135deg, #2b2b2b 0%, #202020 60%, rgba(255,69,0,0.35) 140%)",
                        }}
                      >
                        {!prop.coverPhotoUrl && <HomeWorkOutlinedIcon sx={{ fontSize: 34, color: "rgba(255,255,255,0.35)" }} />}
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
                            { k: "Rooms", v: prop.totalRooms || 0 },
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
                              {occ} / {beds} beds occupied
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
            bottom: "calc(64px + env(safe-area-inset-bottom, 0px))",
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
      <Dialog open={!!confirm} onClose={() => setConfirm(null)} fullWidth maxWidth="xs" slotProps={{ paper: { sx: { borderRadius: 3 } } }}>
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