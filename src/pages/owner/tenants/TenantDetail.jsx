// src/pages/owner/tenants/TenantDetail.jsx

import { useState, useEffect, useMemo, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Box,
  Container,
  Typography,
  Chip,
  Button,
  Avatar,
  Link,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
  Alert,
  Snackbar,
  Dialog,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  IconButton,
  InputAdornment,
  LinearProgress,
  useMediaQuery,
  Skeleton,
  ToggleButton,
  ToggleButtonGroup,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import CloseIcon from "@mui/icons-material/Close";
import HomeWorkOutlinedIcon from "@mui/icons-material/HomeWorkOutlined";
import MeetingRoomOutlinedIcon from "@mui/icons-material/MeetingRoomOutlined";
import PaymentsOutlinedIcon from "@mui/icons-material/PaymentsOutlined";
import ContactEmergencyOutlinedIcon from "@mui/icons-material/ContactEmergencyOutlined";
import BadgeOutlinedIcon from "@mui/icons-material/BadgeOutlined";
import CalendarMonthOutlinedIcon from "@mui/icons-material/CalendarMonthOutlined";
import ReceiptLongOutlinedIcon from "@mui/icons-material/ReceiptLongOutlined";
import OpenInNewIcon from "@mui/icons-material/OpenInNew";
import NightsStayOutlinedIcon from "@mui/icons-material/NightsStayOutlined";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import PersonOutlineOutlinedIcon from "@mui/icons-material/PersonOutlineOutlined";
import StickyNote2OutlinedIcon from "@mui/icons-material/StickyNote2Outlined";
import SaveOutlinedIcon from "@mui/icons-material/SaveOutlined";

import {
  doc,
  getDoc,
  getDocs,
  collection,
  query,
  where,
  onSnapshot,
  setDoc,
  addDoc,
} from "firebase/firestore";
import { auth, db } from "../../../config/firebase";
import { normalizePayment } from "../../../utils/normalizePayment";
import { formatPropertyAddress } from "../../../utils/formatPropertyAddress";
import { addMonthsClamped } from "../../../utils/addMonthsClamped";
import { reconcilePropertyOccupancy } from "../../../utils/reconcilePropertyOccupancy";
import { isRoomUnderMaintenance, MAINTENANCE_ROOM_MESSAGE } from "../../../utils/roomStatus";
import { useAuth } from "../../../context/AuthContext";
import { normalizeStatus, rentStatusOf, paymentPeriodOf, dueDayOf, STATUS_TONE, leaseLengthText } from "../../../utils/tenantRent";
import { isRemovedAccount, removedLabel } from "../../../utils/accountState";
import { isActiveCharge } from "../../../utils/charges";
import { findDuplicatePerson } from "../../../utils/duplicates";
import { AddFeeDialog, BillBreakdown, FeeList } from "../../../components/Fees";
import BoltOutlinedIcon from "@mui/icons-material/BoltOutlined";
import AddIcon from "@mui/icons-material/Add";
import { t } from "../../../i18n";

// ---------------------------------------------------------------------------
// Constants — lease codes deliberately match what RegisterTenant stores in
// `leaseDuration` ("6_months" etc.), so the value set at registration is the
// value the edit form starts from.
// ---------------------------------------------------------------------------
const LEASE_DURATIONS = [
  { value: "1_month", label: t("1 month"), months: 1 },
  { value: "3_months", label: t("3 months"), months: 3 },
  { value: "6_months", label: t("6 months"), months: 6 },
  { value: "12_months", label: t("12 months"), months: 12 },
  { value: "custom", label: t("Custom…"), months: null },
];

const ID_TYPE_LABELS = {
  student_id: "Student ID",
  national_id: "National ID",
  drivers_license: "Driver's license",
  passport: "Passport",
  other: "Other valid ID",
};

// Lease status colors, tuned for the dark lease card
const LEASE_TONES = {
  active: { bg: "rgba(76, 175, 80, 0.18)", color: "#81c784" },
  soon: { bg: "rgba(255, 167, 38, 0.18)", color: "#ffb74d" },
  ended: { bg: "rgba(244, 67, 54, 0.2)", color: "#ef9a9a" },
  neutral: { bg: "rgba(202, 220, 246, 0.16)", color: "#cadcf6" },
};

const HEADING_FONT = '"Inter", sans-serif';

// Payment status colours (same as the Payments page)
const PAYMENT_TONE = { paid: "success", pending: "info", partial: "warning", overdue: "error", rejected: "error", cancelled: "default" };

// 1 -> "1st", 22 -> "22nd", 13 -> "13th"
const ordinal = (n) => {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] || s[v] || s[0]}`;
};

// White card on the cream page, matching the other owner pages
const panelSx = {
  bgcolor: "background.default",
  border: "1px solid",
  borderColor: "divider",
  borderRadius: "18px",
  minWidth: 0,
};
const MS_PER_DAY = 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Date helpers. Everything is handled in LOCAL time — the old code used
// toISOString() to fill the date inputs, which shifts dates back a day for
// anyone east of UTC (e.g. the Philippines).
// ---------------------------------------------------------------------------
const pad = (n) => String(n).padStart(2, "0");

function toDate(value) {
  if (!value) return null;
  if (typeof value?.toDate === "function") return value.toDate(); // Firestore Timestamp
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [y, m, d] = value.split("-").map(Number);
    return new Date(y, m - 1, d);
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function toInputDate(value) {
  const d = toDate(value);
  return d ? `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` : "";
}

function addMonthsToInput(inputDate, months) {
  const d = toDate(inputDate);
  if (!d) return "";
  return toInputDate(addMonthsClamped(d, months));
}

function monthsBetween(start, end) {
  let months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
  if (end.getDate() < start.getDate()) months -= 1;
  return months;
}

const pluralize = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

function formatDate(value) {
  const d = toDate(value);
  return d
    ? d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : "—";
}

function formatAmount(amount) {
  return Number(amount || 0).toLocaleString("en-PH", {
    style: "currency",
    currency: "PHP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

// Reads lease data in the same precedence the page always used, so tenants
// edited before this version (which updated leaseStart/leaseEnd/startDate/
// endDate but not the registration fields) still show their latest dates.
function getLeaseInfo(tenant) {
  const start = toDate(tenant.leaseStart || tenant.startDate || tenant.leaseStartDate || tenant.moveInDate);
  const end = toDate(tenant.leaseEnd || tenant.endDate || tenant.leaseEndDate || tenant.moveOutDate);

  const stored = tenant.leaseDuration;
  // From the dates when there are both, so it always matches them; a saved label only otherwise
  let durationLabel = leaseLengthText(start, end);
  if (durationLabel) {
    // nothing else to work out
  } else if (stored) {
    const preset = LEASE_DURATIONS.find(
      (d) => d.value === stored || (d.months && d.months === Number(stored))
    );
    durationLabel = preset && preset.value !== "custom" ? preset.label : String(stored).replace(/_/g, " ");
  } else if (start && end) {
    const m = monthsBetween(start, end);
    if (m > 0) durationLabel = pluralize(m, "month");
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const startDay = start ? new Date(start.getFullYear(), start.getMonth(), start.getDate()) : null;
  const endDay = end ? new Date(end.getFullYear(), end.getMonth(), end.getDate()) : null;
  const daysLeft = endDay ? Math.round((endDay - today) / MS_PER_DAY) : null;
  const daysUntilStart = startDay ? Math.round((startDay - today) / MS_PER_DAY) : null;

  let progress = null;
  if (start && end && end > start) {
    progress = Math.min(100, Math.max(0, ((Date.now() - start.getTime()) / (end.getTime() - start.getTime())) * 100));
  }

  let tone = "neutral";
  let statusLabel;
  let headline;

  if (!start && !end) {
    statusLabel = "Not set";
    headline = "No lease on record";
  } else if (!end) {
    statusLabel = "Open-ended";
    headline = durationLabel || "Open-ended lease";
  } else if (daysUntilStart != null && daysUntilStart > 0) {
    statusLabel = "Upcoming";
    headline = `Starts in ${pluralize(daysUntilStart, "day")}`;
  } else if (daysLeft < 0) {
    tone = "ended";
    statusLabel = "Ended";
    headline = `Ended ${pluralize(Math.abs(daysLeft), "day")} ago`;
  } else if (daysLeft === 0) {
    tone = "soon";
    statusLabel = "Ending soon";
    headline = "Ends today";
  } else if (daysLeft <= 30) {
    tone = "soon";
    statusLabel = "Ending soon";
    headline = `${pluralize(daysLeft, "day")} remaining`;
  } else {
    tone = "active";
    statusLabel = "Active";
    headline = `${pluralize(daysLeft, "day")} remaining`;
  }

  let subline;
  if (!start && !end) {
    subline = "Add lease dates by editing this tenant.";
  } else if (!end) {
    subline = "No end date set.";
  } else {
    subline = [durationLabel && `${durationLabel} lease`, `ends ${formatDate(end)}`].filter(Boolean).join(" · ");
  }

  return { start, end, durationLabel, progress, tone, statusLabel, headline, subline };
}

// ---------------------------------------------------------------------------
// Small presentational pieces
// ---------------------------------------------------------------------------
function SectionHeading({ icon: Icon, children, action }) {
  return (
    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2, mb: 2 }}>
      <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
        <Icon sx={{ color: "primary.main" }} />
        <Typography variant="h6" sx={{ fontFamily: HEADING_FONT, fontWeight: 700 }} color="text.primary">
          {children}
        </Typography>
      </Box>
      {action}
    </Box>
  );
}

function DetailRow({ label, children }) {
  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: { xs: "1fr", sm: "150px 1fr" },
        columnGap: 2,
        rowGap: 0.25,
        py: 1.25,
        borderBottom: "1px solid",
        borderColor: "divider",
        "&:last-of-type": { borderBottom: "none" },
      }}
    >
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="body2" component="div" sx={{ fontWeight: 500, color: "text.primary", wordBreak: "break-word" }}>
        {children}
      </Typography>
    </Box>
  );
}

// One block of the edit form: icon, title and a short explanation on the
// left, the fields on the right (stacked on phones), thin lines between blocks.
function FormSection({ icon: Icon, title, description, children, first }) {
  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "220px minmax(0, 1fr)" },
        gap: { xs: 1.75, md: 3 },
        py: { xs: 2.5, md: 3 },
        borderTop: first ? "none" : "1px solid",
        borderColor: "divider",
      }}
    >
      <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1.25, minWidth: 0 }}>
        <Box sx={{ width: 34, height: 34, flexShrink: 0, borderRadius: "10px", display: "grid", placeItems: "center", bgcolor: "rgba(255,69,0,.1)", color: "primary.main" }}>
          <Icon sx={{ fontSize: 19 }} />
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontFamily: HEADING_FONT, fontWeight: 800, fontSize: "0.98rem", lineHeight: 1.3 }}>{title}</Typography>
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

const formStack = { display: "flex", flexDirection: "column", gap: 2 };
const formPair = { display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "repeat(2, minmax(0, 1fr))" }, gap: 2 };

// Segmented control look for the status buttons
const segmentedSx = {
  p: 0.5,
  gap: 0.5,
  borderRadius: "12px",
  bgcolor: (t) => alpha(t.palette.background.paper, 0.6),
  "& .MuiToggleButton-root": { textTransform: "none", fontWeight: 700, py: 0.85, border: "none", borderRadius: "9px !important", color: "text.secondary", lineHeight: 1.25 },
  "& .MuiToggleButton-root.Mui-selected": { bgcolor: "#fff", color: "primary.main", boxShadow: "0 2px 8px rgba(0,0,0,.08)", "&:hover": { bgcolor: "#fff" } },
};


// ---------------------------------------------------------------------------
// Curfew record
// ---------------------------------------------------------------------------
const CURFEW_STATUS = {
  present: { label: t("In on time"), tone: "success", dot: "success.main" },
  late: { label: t("Late"), tone: "warning", dot: "warning.main" },
  out: { label: t("Out past curfew"), tone: "error", dot: "error.main" },
};

function curfewNightLabel(key) {
  const d = toDate(key);
  if (!d) return "Unknown night";
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function clockLabel(value) {
  const d = toDate(value);
  return d ? d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }) : "";
}

function CurfewRecord({ nights, showAll, onToggle }) {
  const count = (status) => nights.filter((n) => n.status === status).length;
  const onTimeRate = nights.length ? Math.round((count("present") / nights.length) * 100) : null;
  const strip = nights.slice(0, 14).reverse(); // oldest -> newest, left to right
  const rows = showAll ? nights : nights.slice(0, 6);

  return (
    <Box sx={{ ...panelSx, p: { xs: 2.5, sm: 3 }, mb: 2.5 }}>
      <SectionHeading
        icon={NightsStayOutlinedIcon}
        action={
          onTimeRate != null && (
            <Typography variant="body2" sx={{ fontWeight: 600, color: "text.secondary", textAlign: "right" }}>
              {t("On time")}{" "}
              <Box component="span" sx={{ color: onTimeRate >= 80 ? "success.main" : "warning.main", fontFamily: HEADING_FONT, fontWeight: 700 }}>
                {onTimeRate}%
              </Box>
            </Typography>
          )
        }
      >
        {t("Curfew record")}
      </SectionHeading>

      {nights.length === 0 ? (
        <Typography color="text.secondary" variant="body2" sx={{ py: 4, textAlign: "center", border: "1px dashed", borderColor: "divider", borderRadius: 2 }}>
          {t("No curfew checks recorded for this tenant yet. They appear here once the caretaker starts logging nights.")}
        </Typography>
      ) : (
        <>
          <Box sx={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: { xs: 1, sm: 2 }, mb: 2.5 }}>
            {[
              { label: t("Nights checked"), value: nights.length },
              { label: t("On time"), value: count("present"), color: "success.main" },
              { label: t("Late"), value: count("late"), color: count("late") > 0 ? "warning.main" : undefined },
              { label: t("Out"), value: count("out"), color: count("out") > 0 ? "error.main" : undefined },
            ].map((x) => (
              <Box key={x.label} sx={{ minWidth: 0 }}>
                <Typography variant="caption" color="text.secondary" noWrap component="div">
                  {x.label}
                </Typography>
                <Typography sx={{ fontFamily: HEADING_FONT, fontWeight: 800, fontSize: { xs: "1.3rem", sm: "1.6rem" }, lineHeight: 1.2, color: x.color }}>
                  {x.value}
                </Typography>
              </Box>
            ))}
          </Box>

          {/* Last two weeks at a glance */}
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, letterSpacing: 0.3 }}>
            LAST {strip.length} {strip.length === 1 ? "NIGHT" : "NIGHTS"}
          </Typography>
          <Box sx={{ display: "flex", gap: 0.75, flexWrap: "wrap", mt: 1, mb: 2.5 }} role="img" aria-label={`Curfew results for the last ${strip.length} nights`}>
            {strip.map((n) => (
              <Box
                key={n.id}
                title={`${curfewNightLabel(n.date)} · ${CURFEW_STATUS[n.status]?.label || n.status}`}
                sx={{ width: 22, height: 22, borderRadius: "50%", bgcolor: CURFEW_STATUS[n.status]?.dot || "action.disabled" }}
              />
            ))}
          </Box>

          {rows.map((n) => {
            const st = CURFEW_STATUS[n.status] || { label: n.status, tone: "default" };
            return (
              <Box key={n.id} sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 2, py: 1.25, borderTop: "1px solid", borderColor: "divider" }}>
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {curfewNightLabel(n.date)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: "block", wordBreak: "break-word" }}>
                    {[
                      n.curfewTime && `Curfew ${n.curfewTime}`,
                      clockLabel(n.at) && `marked ${clockLabel(n.at)}`,
                      n.by && `by ${n.by}`,
                      n.noticeSent && "tenant notified",
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </Typography>
                </Box>
                <Chip
                  label={st.label}
                  size="small"
                  sx={{
                    fontWeight: 700,
                    border: "none",
                    flexShrink: 0,
                    bgcolor: (t) => (st.tone === "default" ? alpha(t.palette.text.primary, 0.08) : alpha(t.palette[st.tone].main, 0.12)),
                    color: (t) => (st.tone === "default" ? t.palette.text.secondary : t.palette[st.tone].dark),
                  }}
                />
              </Box>
            );
          })}

          {nights.length > 6 && (
            <Button onClick={onToggle} size="small" sx={{ mt: 1, fontWeight: 700 }}>
              {showAll ? t("Show fewer") : `Show all ${nights.length} nights`}
            </Button>
          )}
        </>
      )}
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function TenantDetail() {
  const { tenantId } = useParams();
  const navigate = useNavigate();
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down("sm"));
  const { currentUser, loading: authLoading } = useAuth() || {};
  const ownerUid = currentUser?.uid || auth.currentUser?.uid || null;

  const [tenant, setTenant] = useState(null);
  const [property, setProperty] = useState(null);
  const [payments, setPayments] = useState([]);
  const [curfewNights, setCurfewNights] = useState([]);
  const [showAllNights, setShowAllNights] = useState(false);
  // "Today" for this month's rent status, fixed when the page opens
  const [today] = useState(() => new Date());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Edit dialog state
  const [openEdit, setOpenEdit] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [formErrors, setFormErrors] = useState({});
  const [snackbar, setSnackbar] = useState(null); // { message, severity }
  // Extra fees on top of rent (utils/charges.js)
  const [charges, setCharges] = useState([]);
  const [feeDialog, setFeeDialog] = useState({ open: false, key: 0, editing: null });
  const [ownerProperties, setOwnerProperties] = useState([]);
  const [propertyTenants, setPropertyTenants] = useState({ propertyId: "", list: [] });
  const [occupancyLoading, setOccupancyLoading] = useState(false);
  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    phone: "",
    status: "Active",
    propertyId: "",
    roomId: "",
    bedId: "",
    monthlyRent: "",
    leaseStart: "",
    leaseDuration: "",
    customLeaseDuration: "",
    leaseEnd: "",
    emergencyName: "",
    emergencyRelationship: "",
    emergencyPhone: "",
    notes: "",
  });

  // =========================================================
  // LOAD TENANT & PROPERTY DETAILS
  // =========================================================
  useEffect(() => {
    // No id in the URL is handled when rendering. On a hard refresh Firebase
    // restores the session asynchronously — wait for it, otherwise the
    // owner's properties silently fail to load.
    if (!tenantId || authLoading) return;

    const fetchTenantData = async () => {
      try {
        // A tenant can have a `tenants` record, a `users` account, or both
        // (the Tenants list shows all of them), so read both.
        const [tenantSnap, userSnap] = await Promise.all([
          getDoc(doc(db, "tenants", tenantId)),
          getDoc(doc(db, "users", tenantId)).catch(() => null),
        ]);
        const userData = userSnap?.exists() ? userSnap.data() : null;

        if (!tenantSnap.exists() && !(userData && userData.role === "tenant")) {
          setError("We couldn't find this tenant. They may have been removed.");
          setLoading(false);
          return;
        }

        const tenantData = {
          ...(userData || {}),
          id: tenantId,
          ...(tenantSnap.exists() ? tenantSnap.data() : {}),
        };
        setTenant(tenantData);

        if (ownerUid) {
          const propsSnap = await getDocs(
            query(collection(db, "properties"), where("ownerUid", "==", ownerUid))
          );
          const propsList = propsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
          setOwnerProperties(propsList);

          if (tenantData.propertyId) {
            const matchedProp = propsList.find(
              (p) =>
                p.id === tenantData.propertyId ||
                p.name === tenantData.propertyId ||
                p.propertyName === tenantData.propertyId
            );
            if (matchedProp) {
              setProperty(matchedProp);
            } else {
              try {
                const propSnap = await getDoc(doc(db, "properties", tenantData.propertyId));
                if (propSnap.exists()) {
                  setProperty({ id: propSnap.id, ...propSnap.data() });
                }
              } catch (e) {
                console.warn("Direct property fetch fallback failed:", e);
              }
            }
          }
        }
      } catch (err) {
        console.error("Error fetching tenant details:", err);
        setError("Failed to load tenant details: " + err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchTenantData();
  }, [tenantId, authLoading, ownerUid]);

  // =========================================================
  // LOAD PAYMENTS RECORD FOR THIS TENANT
  // =========================================================
  const ownerPropsRef = useRef([]);
  useEffect(() => {
    ownerPropsRef.current = ownerProperties;
  }, [ownerProperties]);

  // Live tenant details: changes saved elsewhere (another device or tab) show without a reload.
  // Same merge as the first load: the tenant record wins over the account profile.
  useEffect(() => {
    if (!tenantId || authLoading) return undefined;
    const latest = { user: undefined, tenant: undefined };
    const publish = () => {
      if (latest.user === undefined || latest.tenant === undefined) return;
      if (!latest.tenant && !(latest.user && latest.user.role === "tenant")) return;
      const merged = { ...(latest.user || {}), id: tenantId, ...(latest.tenant || {}) };
      // Only refresh a tenant that's already on screen (the first load handles errors)
      setTenant((prev) => (prev ? merged : prev));
      // Moved to another of the owner's properties: show that one
      const match = ownerPropsRef.current.find((p) => p.id === merged.propertyId);
      if (match) setProperty((prev) => (prev?.id === match.id ? prev : match));
    };
    const watch = (path, key) =>
      onSnapshot(
        doc(db, path, tenantId),
        (snap) => {
          latest[key] = snap.exists() ? snap.data() : null;
          publish();
        },
        (err) => console.warn(`Live ${key} updates unavailable:`, err?.code || err)
      );
    const unsubs = [watch("tenants", "tenant"), watch("users", "user")];
    return () => unsubs.forEach((u) => u());
  }, [tenantId, authLoading]);


  // The database only shows an owner their own payments: those saved with their
  // ownerUid, and older ones that only have the property. Both are read and merged.
  const tenantPropertyId = tenant?.propertyId || "";
  useEffect(() => {
    if (!tenantId || !ownerUid) return undefined;

    const sources = { owner: [], property: [] };
    const publish = () => {
      const byId = new Map();
      [...sources.owner, ...sources.property].forEach((p) => byId.set(p.id, p));
      setPayments([...byId.values()]);
    };
    const watch = (key, ...filters) =>
      onSnapshot(
        query(collection(db, "payments"), ...filters, where("tenantId", "==", tenantId)),
        (snapshot) => {
          sources[key] = snapshot.docs.map((d) => normalizePayment({ id: d.id, ...d.data() }));
          publish();
        },
        (err) => console.error(`Error fetching tenant payments (${key}):`, err)
      );
    const unsubs = [watch("owner", where("ownerUid", "==", ownerUid))];
    if (tenantPropertyId) unsubs.push(watch("property", where("propertyId", "==", tenantPropertyId)));
    return () => unsubs.forEach((u) => u());
  }, [tenantId, ownerUid, tenantPropertyId]);

  // =========================================================
  // EXTRA FEES for this tenant (electricity, Wi-Fi...)
  // =========================================================
  useEffect(() => {
    if (!tenantId || !ownerUid) return undefined;
    return onSnapshot(
      query(collection(db, "charges"), where("ownerUid", "==", ownerUid), where("tenantId", "==", tenantId)),
      (snapshot) => setCharges(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })).filter(isActiveCharge)),
      (err) => console.warn("Fees unavailable:", err?.code || err)
    );
  }, [tenantId, ownerUid]);

  // =========================================================
  // CURFEW RECORD — this tenant's line from each night the caretaker
  // checked their property (occupancy_logs). Not being able to read
  // them must not break the page.
  // =========================================================
  useEffect(() => {
    if (!tenantId || !tenant?.propertyId || !ownerUid) return undefined;

    return onSnapshot(
      query(
        collection(db, "occupancy_logs"),
        where("ownerUid", "==", ownerUid),
        where("propertyId", "==", tenant.propertyId)
      ),
      (snapshot) => {
        const nights = snapshot.docs
          .map((d) => ({ id: d.id, ...d.data({ serverTimestamps: "estimate" }) }))
          .filter((log) => log.entries?.[tenantId]?.status)
          .map((log) => ({ id: log.id, date: log.date, curfewTime: log.curfewTime, ...log.entries[tenantId] }))
          .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
        setCurfewNights(nights);
      },
      (err) => {
        console.warn("Curfew record unavailable:", err?.code || err);
        setCurfewNights([]);
      }
    );
  }, [tenantId, tenant?.propertyId, ownerUid]);

  // =========================================================
  // WHO ELSE IS IN THE SELECTED PROPERTY (edit dialog only) —
  // so the room/bed pickers can't double-book a bed.
  // =========================================================
  useEffect(() => {
    if (!openEdit || !formData.propertyId) return undefined;

    let cancelled = false;
    const propertyId = formData.propertyId;

    (async () => {
      setOccupancyLoading(true);
      try {
        const snap = await getDocs(query(collection(db, "tenants"), where("propertyId", "==", propertyId)));
        if (!cancelled) {
          setPropertyTenants({
            propertyId,
            // Former tenants don't hold a bed
            list: snap.docs
              .map((d) => ({ id: d.id, ...d.data() }))
              .filter((t) => t.id !== tenantId && normalizeStatus(t.status) !== "Inactive"),
          });
        }
      } catch (err) {
        console.warn("Could not load property occupancy:", err);
        if (!cancelled) setPropertyTenants({ propertyId, list: [] });
      } finally {
        if (!cancelled) setOccupancyLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [openEdit, formData.propertyId, tenantId]);

  const sortedPayments = useMemo(
    () =>
      [...payments].sort((a, b) => {
        const da = toDate(a.paymentDate || a.createdAt)?.getTime() || 0;
        const db_ = toDate(b.paymentDate || b.createdAt)?.getTime() || 0;
        return db_ - da;
      }),
    [payments]
  );

  // Only counts while the dialog is open on the property they were loaded for
  const activePropertyTenants = useMemo(
    () => (openEdit && propertyTenants.propertyId === formData.propertyId ? propertyTenants.list : []),
    [openEdit, propertyTenants, formData.propertyId]
  );

  const roomOccupancy = useMemo(() => {
    const map = new Map();
    activePropertyTenants.forEach((t) => {
      const room = String(t.roomId || "");
      if (!room) return;
      if (!map.has(room)) map.set(room, { count: 0, beds: new Set() });
      const entry = map.get(room);
      entry.count += 1;
      if (t.bedId) entry.beds.add(String(t.bedId));
    });
    return map;
  }, [activePropertyTenants]);

  // Derived values for the edit dialog's property → room → bed selects
  const selectedFormProperty = ownerProperties.find((p) => p.id === formData.propertyId);
  const availableRooms = selectedFormProperty?.rooms || [];
  const selectedFormRoom = availableRooms.find(
    (r) =>
      r.id === formData.roomId ||
      r.roomName === formData.roomId ||
      r.roomNumber === formData.roomId
  );
  const roomCapacity = Number(selectedFormRoom?.capacity || 0);
  // The room this tenant already lives in. They can stay in it even while it
  // is under maintenance; nobody can be moved INTO a room under maintenance.
  const isTenantsCurrentRoom = (propertyId, roomName) =>
    Boolean(tenant) &&
    String(propertyId) === String(tenant.propertyId || "") &&
    String(roomName) === String(tenant.roomId || tenant.roomNumber || tenant.room || "");
  const blockedForMaintenance = (room, propertyId = formData.propertyId) =>
    isRoomUnderMaintenance(room) && !isTenantsCurrentRoom(propertyId, room?.roomName || room?.roomNumber || room?.id);
  const takenBeds = roomOccupancy.get(String(formData.roomId))?.beds || new Set();
  const availableBeds =
    roomCapacity > 0
      ? Array.from({ length: roomCapacity }, (_, i) => `Bed ${i + 1}`).filter((b) => !takenBeds.has(b))
      : [];

  // =========================================================
  // EDIT HANDLERS
  // =========================================================
  const handleOpenEdit = () => {
    if (!tenant) return;

    const lease = getLeaseInfo(tenant);

    // Start from what was chosen at registration (leaseDuration), falling
    // back to inferring it from the dates for older records.
    let leaseDuration = "";
    let customLeaseDuration = "";
    const stored = tenant.leaseDuration;
    if (stored) {
      const preset = LEASE_DURATIONS.find(
        (d) => d.value !== "custom" && (d.value === stored || d.months === Number(stored))
      );
      if (preset) {
        leaseDuration = preset.value;
      } else {
        leaseDuration = "custom";
        customLeaseDuration = leaseLengthText(lease.start, lease.end) || String(stored);
      }
    } else if (lease.start && lease.end) {
      const m = monthsBetween(lease.start, lease.end);
      const preset = LEASE_DURATIONS.find((d) => d.months === m);
      if (preset) {
        leaseDuration = preset.value;
      } else if (m > 0) {
        leaseDuration = "custom";
        customLeaseDuration = pluralize(m, "month");
      }
    }

    const assignedRoomForForm = property?.rooms?.find(
      (room) =>
        room.roomName === tenant.roomId ||
        room.roomNumber === tenant.roomId ||
        room.id === tenant.roomId
    );

    setFormData({
      fullName: tenant.fullName || tenant.name || "",
      email: tenant.email || "",
      phone: tenant.phone || tenant.contactNumber || "",
      // the dropdown only knows these three spellings
      status: { Active: "Active", Pending: "Pending Onboarding", Inactive: "Inactive" }[normalizeStatus(tenant.status)],
      propertyId: tenant.propertyId || property?.id || "",
      roomId: tenant.roomId || "",
      bedId: tenant.bedId || "",
      monthlyRent:
        tenant.monthlyRent ??
        tenant.rentAmount ??
        tenant.roomMonthlyRate ??
        tenant.monthlyRate ??
        tenant.rent ??
        assignedRoomForForm?.monthlyRatePerBed ??
        "",
      leaseStart: toInputDate(lease.start),
      leaseDuration,
      customLeaseDuration,
      leaseEnd: toInputDate(lease.end),
      emergencyName: tenant.emergencyContact?.name || tenant.emergencyName || "",
      emergencyRelationship: tenant.emergencyContact?.relationship || tenant.emergencyRelationship || "",
      emergencyPhone: tenant.emergencyContact?.phone || tenant.emergencyPhone || "",
      notes: tenant.notes || "",
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

    setFormData((prev) => {
      const next = { ...prev, [name]: value };

      if (name === "propertyId") {
        next.roomId = "";
        next.bedId = "";
      }

      if (name === "roomId") {
        next.bedId = "";
        // Auto-fill monthly rent from the selected room
        const prop = ownerProperties.find((p) => p.id === next.propertyId);
        const room = prop?.rooms?.find(
          (r) => r.id === value || r.roomName === value || r.roomNumber === value
        );
        if (room?.monthlyRatePerBed) next.monthlyRent = room.monthlyRatePerBed;
      }

      // Start date or duration changed → recompute the end date (still editable afterwards)
      if (name === "leaseStart" || name === "leaseDuration") {
        const preset = LEASE_DURATIONS.find((d) => d.value === next.leaseDuration);
        if (next.leaseStart && preset?.months) {
          next.leaseEnd = addMonthsToInput(next.leaseStart, preset.months);
        }
      }

      // A custom term follows its dates whenever either date changes
      if ((name === "leaseStart" || name === "leaseEnd") && next.leaseDuration === "custom") {
        next.customLeaseDuration = leaseLengthText(next.leaseStart, next.leaseEnd) || next.customLeaseDuration;
      }

      // End date edited by hand → keep the duration truthful
      if (name === "leaseEnd" && next.leaseDuration !== "custom" && next.leaseStart && value) {
        const s = toDate(next.leaseStart);
        const e2 = toDate(value);
        if (s && e2 && e2 > s) {
          const m = monthsBetween(s, e2);
          const preset = LEASE_DURATIONS.find((d) => d.months === m);
          if (preset) {
            next.leaseDuration = preset.value;
          } else {
            next.leaseDuration = "custom";
            next.customLeaseDuration = leaseLengthText(s, e2) || pluralize(Math.round((e2 - s) / MS_PER_DAY), "day");
          }
        }
      }

      return next;
    });
  };

  // For button-style inputs (status, duration): same path as typing in a field
  const setField = (name, value) => handleChange({ target: { name, value } });

  const validateForm = () => {
    const e = {};
    if (!formData.fullName.trim()) e.fullName = "Full name is required.";
    if (formData.email.trim() && !/^\S+@\S+\.\S+$/.test(formData.email.trim())) {
      e.email = "Enter a valid email address.";
    }
    if (!formData.phone.trim()) e.phone = "Phone number is required.";
    if (!formData.propertyId) e.propertyId = "Select a property.";
    if (!formData.roomId) e.roomId = "Select a room.";
    else if (selectedFormRoom && blockedForMaintenance(selectedFormRoom)) e.roomId = MAINTENANCE_ROOM_MESSAGE;
    if (formData.roomId && availableBeds.length > 0 && !formData.bedId) e.bedId = "Select a bed.";
    const rent = Number(formData.monthlyRent);
    if (formData.monthlyRent === "" || Number.isNaN(rent) || rent <= 0) {
      e.monthlyRent = "Enter a valid monthly rent.";
    }
    if (!formData.leaseStart) e.leaseStart = "Start date is required.";
    if (!formData.leaseDuration) e.leaseDuration = "Select a lease duration.";
    if (formData.leaseDuration === "custom" && !formData.customLeaseDuration.trim()) {
      e.customLeaseDuration = "Describe the custom lease term.";
    }
    if (formData.leaseDuration !== "custom" && !formData.leaseEnd) {
      e.leaseEnd = "End date is required.";
    }
    if (formData.leaseStart && formData.leaseEnd && formData.leaseEnd <= formData.leaseStart) {
      e.leaseEnd = "End date must be after the start date.";
    }
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
      // Another current tenant or caretaker already using this number?
      const dup = await findDuplicatePerson(ownerUid, { phone: formData.phone, excludeId: tenantId }).catch(() => null);
      if (dup) {
        setFormErrors({ phone: dup.message });
        setSaveError(dup.message);
        return;
      }

      const tenantRef = doc(db, "tenants", tenantId);
      const previousPropertyId = tenant?.propertyId || "";

      const isCustom = formData.leaseDuration === "custom";
      const finalDuration = isCustom ? leaseLengthText(formData.leaseStart, formData.leaseEnd) || formData.customLeaseDuration.trim() : formData.leaseDuration;
      const startDateObj = toDate(formData.leaseStart);
      const endDateObj = formData.leaseEnd ? toDate(formData.leaseEnd) : null;
      const leaseEndISO = endDateObj ? endDateObj.toISOString() : null;
      const rent = Number(formData.monthlyRent) || 0;

      const updatedPayload = {
        fullName: formData.fullName.trim(),
        name: formData.fullName.trim(),
        email: formData.email.trim(),
        phone: formData.phone.trim(),
        contactNumber: formData.phone.trim(),
        contact: formData.phone.trim(),
        status: formData.status,
        propertyId: formData.propertyId,
        roomId: formData.roomId,
        roomNumber: formData.roomId,
        bedId: formData.bedId || null,
        monthlyRent: rent,
        rentAmount: rent,
        roomMonthlyRate: rent,
        // Lease — every alias is written in step, so no reader (including the
        // property's room map) can pick up a stale value.
        leaseDuration: finalDuration,
        leaseStartDate: formData.leaseStart,
        leaseEndDate: leaseEndISO,
        leaseStart: startDateObj,
        leaseEnd: leaseEndISO,
        startDate: startDateObj,
        endDate: endDateObj,
        emergencyContact: {
          name: formData.emergencyName.trim(),
          relationship: formData.emergencyRelationship.trim(),
          phone: formData.emergencyPhone.trim(),
        },
        notes: formData.notes,
        updatedAt: new Date(),
      };

      await Promise.all([
        // merge: also creates the record for tenants who only had a user account
        setDoc(tenantRef, updatedPayload, { merge: true }),
        setDoc(doc(db, "users", tenantId), updatedPayload, { merge: true }),
      ]);

      const propertyIds = [...new Set([previousPropertyId, formData.propertyId].filter(Boolean))];
      await Promise.all(propertyIds.map((pid) => reconcilePropertyOccupancy(pid)));

      // Tell the tenant what changed about their stay (their dashboard already shows it live).
      // Best effort, and only for things they'd want to know: rent, lease, room, property, status.
      const before = tenant || {};
      const propName = (id) => ownerProperties.find((p) => p.id === id)?.propertyName || ownerProperties.find((p) => p.id === id)?.name || "another property";
      const day = (v) => (toDate(v) ? formatDate(v) : "not set");
      const beforeRent = Number(before.monthlyRent ?? before.rentAmount ?? before.roomMonthlyRate ?? 0) || 0;
      const changes = [
        beforeRent !== rent && `Monthly rent: ${formatAmount(beforeRent)} → ${formatAmount(rent)}`,
        day(before.leaseStartDate || before.leaseStart) !== day(formData.leaseStart) && `Lease start: ${day(before.leaseStartDate || before.leaseStart)} → ${day(formData.leaseStart)}`,
        day(before.leaseEndDate || before.leaseEnd) !== day(leaseEndISO) && `Lease end: ${day(before.leaseEndDate || before.leaseEnd)} → ${day(leaseEndISO)}`,
        (before.propertyId || "") !== formData.propertyId && `Property: ${propName(formData.propertyId)}`,
        String(before.roomId || before.roomNumber || "") !== String(formData.roomId || "") && `Room: ${before.roomId || before.roomNumber || "none"} → ${formData.roomId || "none"}`,
        String(before.bedId || "") !== String(formData.bedId || "") && `Bed: ${before.bedId || "none"} → ${formData.bedId || "none"}`,
        String(before.status || "Active") !== String(formData.status) && `Status: ${before.status || "Active"} → ${formData.status}`,
      ].filter(Boolean);
      if (changes.length) {
        addDoc(collection(db, "notifications"), {
          userId: tenantId,
          kind: "notice",
          category: "account",
          type: "info",
          title: "Your rental details were updated",
          message: `Your landlord updated your details. ${changes.join(". ")}.`,
          ownerId: ownerUid,
          createdBy: ownerUid,
          createdByRole: "owner",
          isRead: false,
          createdAt: new Date().toISOString(),
        }).catch((err) => console.warn("Tenant not notified of the change:", err?.code || err));
      }

      setTenant((prev) => ({ ...prev, ...updatedPayload }));
      const newlyMatchedProp = ownerProperties.find((p) => p.id === formData.propertyId);
      if (newlyMatchedProp) setProperty(newlyMatchedProp);

      setOpenEdit(false);
      setSnackbar({ message: t("Tenant details updated."), severity: "success" });
    } catch (err) {
      console.error("Error updating tenant:", err);
      setSaveError("Failed to update tenant details: " + err.message);
    } finally {
      setSaving(false);
    }
  };

  const fieldError = (name) => ({
    error: Boolean(formErrors[name]),
    helperText: formErrors[name] || "",
  });

  // =========================================================
  // LOADING / ERROR STATES
  // =========================================================
  if (!tenantId || error || (!loading && !tenant)) {
    return (
      <Box sx={{ maxWidth: 520, mx: "auto", mt: { xs: 4, md: 8 }, textAlign: "center", px: 2 }}>
        <Typography sx={{ fontFamily: HEADING_FONT, fontWeight: 800, fontSize: "1.2rem", mb: 0.5 }}>{t("Can't open this tenant")}</Typography>
        <Typography color="text.secondary" sx={{ mb: 3 }}>
          {!tenantId ? t("This link is missing the tenant.") : error || t("Tenant details are unavailable.")}
        </Typography>
        <Button variant="contained" startIcon={<ArrowBackIcon />} onClick={() => navigate("/owner/tenants")} sx={{ fontWeight: 700, borderRadius: "10px" }}>
          {t("Back to tenants")}
        </Button>
      </Box>
    );
  }

  if (loading) {
    return (
      <Box sx={{ maxWidth: 1200, mx: "auto" }}>
        <Skeleton width={90} height={32} sx={{ mb: 1 }} />
        <Skeleton variant="rounded" height={150} sx={{ borderRadius: "22px", mb: 2.5 }} />
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "repeat(2, 1fr)" }, gap: 2.5 }}>
          <Skeleton variant="rounded" height={200} sx={{ borderRadius: "18px" }} />
          <Skeleton variant="rounded" height={200} sx={{ borderRadius: "18px" }} />
        </Box>
      </Box>
    );
  }

  // =========================================================
  // DERIVED DISPLAY VALUES
  // =========================================================
  const displayName = tenant.fullName || tenant.name || "Unnamed tenant";
  const initials = displayName.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("");
  const phone = tenant.phone || tenant.contactNumber;
  const emergencyPhone = tenant.emergencyContact?.phone || tenant.emergencyPhone;
  const status = normalizeStatus(tenant.status);

  const assignedRoom = property?.rooms?.find(
    (room) =>
      room.roomName === tenant.roomId ||
      room.roomNumber === tenant.roomId ||
      room.id === tenant.roomId
  );
  const monthlyRentValue =
    tenant.monthlyRent ?? tenant.rentAmount ?? tenant.roomMonthlyRate ?? tenant.monthlyRate ?? tenant.rent ?? assignedRoom?.monthlyRatePerBed ?? 0;
  const bedText = tenant.bedId ? (String(tenant.bedId).startsWith("Bed") ? tenant.bedId : `Bed ${tenant.bedId}`) : null;
  const roomSub = [bedText, assignedRoom?.floor ? `Floor ${assignedRoom.floor}` : null].filter(Boolean).join(" · ") || "No bed assigned";
  const propertyAddress = property ? formatPropertyAddress(property) : "";

  const lease = getLeaseInfo(tenant);
  const leaseTone = LEASE_TONES[lease.tone];

  const statusOfPayment = (p) => String(p.status || "").toLowerCase();
  const paidPayments = sortedPayments.filter((p) => statusOfPayment(p) === "paid");
  const totalPaid = paidPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const underReview = sortedPayments.filter((p) => statusOfPayment(p) === "pending").length;
  const rent = rentStatusOf({ ...tenant, id: tenantId, monthlyRent: monthlyRentValue }, payments, today, charges);
  const thisMonthFees = rent.bill?.feeTotal || 0;
  const feeTenant = { id: tenantId, name: displayName, propertyId: tenant.propertyId || "", propertyName: property?.propertyName || property?.name || tenant.propertyName || "", roomNumber: tenant.roomId || "" };
  const tenantSince = formatDate(tenant.leaseStartDate || tenant.leaseStart || tenant.createdAt);

  const toneSx = (tone) => ({
    bgcolor: (t) => (tone === "default" || tone === "none" ? alpha(t.palette.text.primary, 0.07) : alpha(t.palette[tone].main, 0.12)),
    color: (t) => (tone === "default" || tone === "none" ? t.palette.text.secondary : t.palette[tone].dark),
  });
  const pillSx = (tone) => ({ display: "inline-flex", alignItems: "center", px: 1, height: 24, borderRadius: 99, fontSize: 12.5, fontWeight: 700, whiteSpace: "nowrap", ...toneSx(tone) });

  const tiles = [
    {
      icon: HomeWorkOutlinedIcon,
      label: t("Property"),
      value: property?.propertyName || property?.name || tenant.propertyName || "Not assigned",
      sub: propertyAddress && propertyAddress !== "No address specified" ? propertyAddress : null,
      onClick: property?.id ? () => navigate(`/owner/properties/${property.id}`) : null,
    },
    { icon: MeetingRoomOutlinedIcon, label: t("Room & bed"), value: tenant.roomId ? `Room ${tenant.roomId}` : "No room", sub: roomSub, warn: !tenant.roomId && status !== "Inactive" },
    {
      icon: PaymentsOutlinedIcon,
      label: t("Monthly rent"),
      value: formatAmount(monthlyRentValue),
      sub: thisMonthFees > 0 ? `+ ${formatAmount(thisMonthFees)} fees this month` : `Due every ${ordinal(dueDayOf(tenant))} of the month`,
    },
    { icon: ReceiptLongOutlinedIcon, label: `Rent for ${today.toLocaleDateString("en-US", { month: "long" })}`, pill: rent },
  ];

  const tileBox = (t) => {
    const Icon = t.icon;
    const inner = (
      <>
        <Box sx={{ width: 38, height: 38, flexShrink: 0, borderRadius: "10px", display: "grid", placeItems: "center", bgcolor: "#fff", color: t.warn ? "warning.main" : "primary.main" }}>
          <Icon sx={{ fontSize: 20 }} />
        </Box>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography variant="caption" color="text.secondary" noWrap sx={{ fontWeight: 600, display: "block" }}>
            {t.label}
          </Typography>
          {t.pill ? (
            t.pill.tone === "none" ? (
              <Typography sx={{ fontFamily: HEADING_FONT, fontWeight: 800 }}>—</Typography>
            ) : (
              <Box component="span" sx={{ ...pillSx(t.pill.tone), mt: 0.5, height: 26, fontSize: 13 }}>{t.pill.label}</Box>
            )
          ) : (
            <Typography noWrap sx={{ fontFamily: HEADING_FONT, fontWeight: 800, fontSize: "1.05rem", lineHeight: 1.3, color: t.warn ? "warning.dark" : "text.primary" }}>
              {t.value}
            </Typography>
          )}
          {t.sub && (
            <Typography variant="caption" color="text.secondary" noWrap component="div">
              {t.sub}
            </Typography>
          )}
        </Box>
        {t.onClick && <ChevronRightIcon sx={{ color: "text.disabled", alignSelf: "center" }} />}
      </>
    );
    const sx = {
      minWidth: 0,
      display: "flex",
      alignItems: "flex-start",
      gap: 1.25,
      p: 1.75,
      borderRadius: "14px",
      textAlign: "left",
      bgcolor: (th) => alpha(th.palette.background.paper, 0.55),
      border: 0,
      font: "inherit",
      color: "inherit",
    };
    return t.onClick ? (
      <Box key={t.label} component="button" type="button" onClick={t.onClick} sx={{ ...sx, cursor: "pointer", "&:hover": { bgcolor: (th) => alpha(th.palette.background.paper, 0.85) } }}>
        {inner}
      </Box>
    ) : (
      <Box key={t.label} sx={sx}>
        {inner}
      </Box>
    );
  };

  return (
    <Container maxWidth="lg" disableGutters sx={{ py: 0 }}>
      <Button
        startIcon={<ArrowBackIcon />}
        onClick={() => navigate("/owner/tenants")}
        sx={{ mb: 1.25, ml: -1, color: "text.secondary", fontWeight: 600 }}
      >
        {t("Tenants")}
      </Button>

      {isRemovedAccount(tenant) && (
        <Alert severity="error" sx={{ mb: 2, borderRadius: "14px" }}>
          <strong>{removedLabel(tenant)}</strong>{" "}{t("They no longer appear in lists, counts or announcements. Their records are kept for your history.")}
        </Alert>
      )}

      {/* ───── Header: who, status, how to reach them, and the key facts ───── */}
      <Box component="section" sx={{ ...panelSx, borderRadius: "22px", position: "relative", overflow: "hidden", p: { xs: 2, sm: 3 }, mb: 2.5 }}>
        <Box aria-hidden sx={{ position: "absolute", top: -180, right: -120, width: 380, height: 380, borderRadius: "50%", background: "rgba(255,69,0,.10)", filter: "blur(70px)", pointerEvents: "none" }} />

        <Box sx={{ position: "relative", display: "flex", flexDirection: { xs: "column", sm: "row" }, alignItems: { sm: "center" }, justifyContent: "space-between", gap: 2, mb: 2.5 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: { xs: 1.75, sm: 2.25 }, minWidth: 0 }}>
            <Avatar
              alt=""
              sx={{
                width: { xs: 56, sm: 68 },
                height: { xs: 56, sm: 68 },
                bgcolor: status === "Inactive" ? "action.selected" : "primary.main",
                color: "#fff",
                fontFamily: HEADING_FONT,
                fontWeight: 800,
                fontSize: { xs: "1.25rem", sm: "1.5rem" },
                flexShrink: 0,
              }}
            >
              {initials}
            </Avatar>
            <Box sx={{ minWidth: 0 }}>
              <Box sx={{ display: "flex", alignItems: "center", flexWrap: "wrap", columnGap: 1.25, rowGap: 0.5 }}>
                <Typography component="h1" sx={{ fontFamily: HEADING_FONT, fontWeight: 900, letterSpacing: "-0.02em", fontSize: { xs: "1.35rem", sm: "1.75rem" }, overflowWrap: "anywhere", lineHeight: 1.2 }}>
                  {displayName}
                </Typography>
                <Box component="span" sx={pillSx(STATUS_TONE[status])}>
                  {status === "Pending" ? t("Pending onboarding") : status}
                </Box>
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25, overflowWrap: "anywhere" }}>
                {[phone, tenant.email].filter(Boolean).join(" · ") || t("No contact details")}
                {tenantSince !== "—" ? ` · Tenant since ${tenantSince}` : ""}
              </Typography>
            </Box>
          </Box>

          <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", flexShrink: 0 }}>
            <Button
              variant="contained"
              disableElevation
              size="small"
              startIcon={<EditOutlinedIcon />}
              onClick={handleOpenEdit}
              sx={{ fontWeight: 700, borderRadius: "10px", minHeight: 38, px: 2, flex: { xs: 1, sm: "none" } }}
            >
              {t("Edit details")}
            </Button>
          </Box>
        </Box>

        <Box sx={{ position: "relative", display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "repeat(2, minmax(0, 1fr))", lg: "repeat(4, minmax(0, 1fr))" }, gap: 1.25 }}>
          {tiles.map(tileBox)}
        </Box>
      </Box>

      {/* ───── Lease + payments ───── */}
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "minmax(0, 1.5fr) minmax(0, 1fr)" }, gap: 2.5, mb: 2.5 }}>
        <Box sx={{ bgcolor: "#202020", color: "#ffffff", borderRadius: "18px", p: { xs: 2.5, sm: 3.5 }, minWidth: 0, position: "relative", overflow: "hidden" }}>
          <Box aria-hidden sx={{ position: "absolute", top: -160, right: -120, width: 320, height: 320, borderRadius: "50%", background: "rgba(255,69,0,.22)", filter: "blur(80px)", pointerEvents: "none" }} />
          <Box sx={{ position: "relative" }}>
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
                <CalendarMonthOutlinedIcon sx={{ color: "primary.main" }} />
                <Typography sx={{ fontFamily: HEADING_FONT, fontWeight: 700 }}>{t("Lease")}</Typography>
              </Box>
              <Chip label={lease.statusLabel} size="small" sx={{ bgcolor: leaseTone.bg, color: leaseTone.color, fontWeight: 700, border: "none" }} />
            </Box>

            <Typography sx={{ fontFamily: HEADING_FONT, fontWeight: 900, fontSize: { xs: "1.6rem", sm: "2rem" }, lineHeight: 1.2 }}>
              {lease.headline}
            </Typography>
            <Typography variant="body2" sx={{ color: "#cadcf6", mt: 0.5 }}>
              {lease.subline}
            </Typography>

            {lease.progress != null && (
              <LinearProgress
                variant="determinate"
                value={lease.progress}
                sx={{ height: 6, borderRadius: 3, my: 2.5, bgcolor: "rgba(202, 220, 246, 0.18)", "& .MuiLinearProgress-bar": { bgcolor: "primary.main", borderRadius: 3 } }}
              />
            )}

            <Box sx={{ display: "flex", justifyContent: "space-between", gap: 2, mt: lease.progress != null ? 0 : 2.5 }}>
              <Box>
                <Typography variant="caption" sx={{ color: "#cadcf6", display: "block" }}>{t("Start")}</Typography>
                <Typography sx={{ fontWeight: 700 }}>{formatDate(lease.start)}</Typography>
              </Box>
              <Box sx={{ textAlign: "right" }}>
                <Typography variant="caption" sx={{ color: "#cadcf6", display: "block" }}>{t("End")}</Typography>
                <Typography sx={{ fontWeight: 700 }}>{formatDate(lease.end)}</Typography>
              </Box>
            </Box>
          </Box>
        </Box>

        <Box sx={{ ...panelSx, p: { xs: 2.5, sm: 3 }, display: "flex", flexDirection: "column", gap: 2 }}>
          <SectionHeading
            icon={ReceiptLongOutlinedIcon}
            action={
              <Button size="small" endIcon={<ChevronRightIcon />} onClick={() => navigate("/owner/payments")} sx={{ fontWeight: 700 }}>
                {t("Payments")}
              </Button>
            }
          >
            {t("Payments")}
          </SectionHeading>
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>{t("Total paid")}</Typography>
            <Typography sx={{ fontFamily: HEADING_FONT, fontWeight: 900, fontSize: { xs: "1.6rem", sm: "1.9rem" }, lineHeight: 1.2, color: "primary.main" }}>
              {formatAmount(totalPaid)}
            </Typography>
          </Box>
          <Box sx={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 1, mt: "auto" }}>
            <Box sx={{ p: 1.25, borderRadius: "10px", bgcolor: (t) => alpha(t.palette.background.paper, 0.5) }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, display: "block" }}>{t("Last paid")}</Typography>
              <Typography sx={{ fontWeight: 700, fontSize: "0.92rem" }}>
                {paidPayments[0] ? formatDate(paidPayments[0].paymentDate || paidPayments[0].createdAt) : "—"}
              </Typography>
            </Box>
            <Box sx={{ p: 1.25, borderRadius: "10px", bgcolor: (t) => (underReview ? alpha(t.palette.info.main, 0.1) : alpha(t.palette.background.paper, 0.5)) }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, display: "block" }}>{t("Under review")}</Typography>
              <Typography sx={{ fontWeight: 700, fontSize: "0.92rem", color: underReview ? "info.dark" : "text.primary" }}>
                {underReview ? pluralize(underReview, "payment") : t("None")}
              </Typography>
            </Box>
          </Box>
        </Box>
      </Box>

      {/* ───── Emergency contact + Identification ───── */}
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "repeat(2, minmax(0, 1fr))" }, gap: 2.5, mb: 2.5 }}>
        <Box sx={{ ...panelSx, p: { xs: 2.5, sm: 3 } }}>
          <SectionHeading icon={ContactEmergencyOutlinedIcon}>{t("Emergency contact")}</SectionHeading>
          <Box>
            <DetailRow label={t("Name")}>{tenant.emergencyContact?.name || tenant.emergencyName || t("Not provided")}</DetailRow>
            <DetailRow label={t("Relationship")}>{tenant.emergencyContact?.relationship || tenant.emergencyRelationship || "—"}</DetailRow>
            <DetailRow label={t("Phone")}>
              {emergencyPhone ? (
                <Link href={`tel:${emergencyPhone}`} underline="hover" sx={{ fontWeight: 700 }}>
                  {emergencyPhone}
                </Link>
              ) : (
                "—"
              )}
            </DetailRow>
          </Box>
          {!(tenant.emergencyContact?.name || tenant.emergencyName) && (
            <Button size="small" onClick={handleOpenEdit} sx={{ mt: 1, fontWeight: 700 }}>
              {t("Add emergency contact")}
            </Button>
          )}
        </Box>

        <Box sx={{ ...panelSx, p: { xs: 2.5, sm: 3 } }}>
          <SectionHeading icon={BadgeOutlinedIcon}>{t("Identification")}</SectionHeading>
          <Box sx={{ display: "flex", gap: 2, alignItems: "flex-start" }}>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <DetailRow label={t("ID type")}>
                {tenant.idType ? ID_TYPE_LABELS[tenant.idType] || String(tenant.idType).replace(/_/g, " ") : "—"}
              </DetailRow>
              <DetailRow label={t("ID number")}>{tenant.idNumber || "—"}</DetailRow>
              <DetailRow label={t("Registered")}>{formatDate(tenant.createdAt)}</DetailRow>
              <DetailRow label={t("Notes")}>
                <Box component="span" sx={{ fontWeight: 400, color: "text.secondary" }}>
                  {tenant.notes || t("No notes recorded.")}
                </Box>
              </DetailRow>
            </Box>
            {tenant.idPhotoUrl && (
              <Box
                component="a"
                href={tenant.idPhotoUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={t("Open the ID photo")}
                sx={{ position: "relative", width: { xs: 96, sm: 120 }, aspectRatio: "4 / 3", flexShrink: 0, borderRadius: "10px", overflow: "hidden", border: "1px solid", borderColor: "divider", display: "block", "&:hover .kk-open": { opacity: 1 } }}
              >
                <Box component="img" src={tenant.idPhotoUrl} alt={t("ID photo")} sx={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                <Box className="kk-open" sx={{ position: "absolute", inset: 0, display: "grid", placeItems: "center", bgcolor: "rgba(0,0,0,.45)", color: "#fff", opacity: 0, transition: "opacity .15s" }}>
                  <OpenInNewIcon fontSize="small" />
                </Box>
              </Box>
            )}
          </Box>
        </Box>
      </Box>

      {/* ───── Extra fees (not included in the room / bed rate) ───── */}
      <Box sx={{ ...panelSx, p: { xs: 2.5, sm: 3 }, mb: 2.5 }}>
        <SectionHeading
          icon={BoltOutlinedIcon}
          action={
            status !== "Inactive" && (
              <Button size="small" variant="outlined" startIcon={<AddIcon />} onClick={() => setFeeDialog((d) => ({ open: true, key: d.key + 1, editing: null }))} sx={{ fontWeight: 700, borderRadius: "10px", flexShrink: 0 }}>
                {t("Add fee")}
              </Button>
            )
          }
        >
          {t("Extra fees")}
        </SectionHeading>
        {rent.bill && rent.bill.feeTotal > 0 && (
          <Box sx={{ mb: 1.5, p: 1.5, borderRadius: "12px", bgcolor: (t) => alpha(t.palette.background.paper, 0.5) }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, display: "block", mb: 0.5 }}>
              {today.toLocaleDateString("en-US", { month: "long", year: "numeric" }).toUpperCase()}
            </Typography>
            <BillBreakdown bill={rent.bill} />
          </Box>
        )}
        <FeeList
          charges={charges}
          emptyText={t("No extra fees. Add one for things not included in the rent, like electricity, Wi-Fi or kitchen access.")}
          onEdit={(c) => setFeeDialog((d) => ({ open: true, key: d.key + 1, editing: c }))}
          onDone={(message, severity = "success") => setSnackbar({ message, severity })}
        />
      </Box>

      {/* ───── Curfew record ───── */}
      <CurfewRecord nights={curfewNights} showAll={showAllNights} onToggle={() => setShowAllNights((v) => !v)} />

      {/* ───── Payment records ───── */}
      <Box sx={{ ...panelSx, p: { xs: 2.5, sm: 3 } }}>
        <SectionHeading
          icon={ReceiptLongOutlinedIcon}
          action={
            payments.length > 0 && (
              <Typography variant="body2" sx={{ fontWeight: 600, color: "text.secondary", textAlign: "right" }}>
                {pluralize(payments.length, "record")}
              </Typography>
            )
          }
        >
          {t("Payment records")}
        </SectionHeading>

        {payments.length === 0 ? (
          <Typography color="text.secondary" variant="body2" sx={{ py: 4, textAlign: "center", border: "1px dashed", borderColor: "divider", borderRadius: "12px" }}>
            {t("No payment records yet.")}
          </Typography>
        ) : (
          <>
            <Box sx={{ display: { xs: "none", sm: "block" } }}>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      {["For", "Paid on", "Amount", "Method", "Status", "Reference / notes"].map((h) => (
                        <TableCell key={h} sx={{ fontWeight: 700, color: "text.secondary", fontSize: "0.72rem", letterSpacing: ".06em", textTransform: "uppercase", whiteSpace: "nowrap" }}>{h}</TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {sortedPayments.map((p) => (
                      <TableRow key={p.id} hover sx={{ "&:last-child td": { borderBottom: 0 } }}>
                        <TableCell sx={{ fontWeight: 600, whiteSpace: "nowrap" }}>{paymentPeriodOf(p) || "—"}</TableCell>
                        <TableCell sx={{ whiteSpace: "nowrap" }}>{formatDate(p.paymentDate || p.createdAt)}</TableCell>
                        <TableCell sx={{ fontWeight: 700, whiteSpace: "nowrap" }}>{formatAmount(p.amount)}</TableCell>
                        <TableCell>{p.paymentMethod || "—"}</TableCell>
                        <TableCell>
                          <Box component="span" sx={pillSx(PAYMENT_TONE[statusOfPayment(p)] || "default")}>{p.status || "—"}</Box>
                        </TableCell>
                        <TableCell sx={{ color: "text.secondary", maxWidth: 260, overflowWrap: "anywhere" }}>{p.referenceNumber || p.notes || "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>

            {/* Stacked list on phones — a 6-column table doesn't fit */}
            <Box sx={{ display: { xs: "block", sm: "none" } }}>
              {sortedPayments.map((p) => (
                <Box
                  key={p.id}
                  sx={{ py: 1.5, borderBottom: "1px solid", borderColor: "divider", "&:last-of-type": { borderBottom: "none", pb: 0 }, "&:first-of-type": { pt: 0 } }}
                >
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 2 }}>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography sx={{ fontFamily: HEADING_FONT, fontWeight: 800 }}>{formatAmount(p.amount)}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {[paymentPeriodOf(p) && `For ${paymentPeriodOf(p)}`, formatDate(p.paymentDate || p.createdAt)].filter(Boolean).join(" · ")}
                      </Typography>
                    </Box>
                    <Box component="span" sx={pillSx(PAYMENT_TONE[statusOfPayment(p)] || "default")}>{p.status || "—"}</Box>
                  </Box>
                  <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.25, overflowWrap: "anywhere" }}>
                    {[p.paymentMethod, p.referenceNumber || p.notes].filter(Boolean).join(" · ")}
                  </Typography>
                </Box>
              ))}
            </Box>
          </>
        )}
      </Box>

      {/* ───── Edit dialog (full-screen on phones) ───── */}
      <Dialog
        open={openEdit}
        onClose={() => !saving && setOpenEdit(false)}
        maxWidth="md"
        fullWidth
        fullScreen={fullScreen}
        slotProps={{ paper: { sx: { borderRadius: fullScreen ? 0 : "22px", overflow: "hidden", bgcolor: "#fff" } } }}
      >
        {/* Header: who is being edited */}
        <Box sx={{ position: "relative", overflow: "hidden", flexShrink: 0, px: { xs: 2, sm: 3 }, pt: { xs: 2, sm: 2.5 }, pb: 2, borderBottom: "1px solid", borderColor: "divider" }}>
          <Box aria-hidden sx={{ position: "absolute", top: -140, right: -100, width: 300, height: 300, borderRadius: "50%", background: "rgba(255,69,0,.10)", filter: "blur(60px)", pointerEvents: "none" }} />
          <Box sx={{ position: "relative", display: "flex", alignItems: "center", gap: 1.5 }}>
            <Avatar sx={{ width: 44, height: 44, bgcolor: "primary.main", color: "#fff", fontFamily: HEADING_FONT, fontWeight: 800, fontSize: "1rem" }}>
              {(formData.fullName || "?").split(" ").filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("") || "?"}
            </Avatar>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, display: "block", lineHeight: 1.2 }}>
                {t("Edit tenant")}
              </Typography>
              <Typography noWrap sx={{ fontFamily: HEADING_FONT, fontWeight: 800, fontSize: "1.2rem", letterSpacing: "-0.01em" }}>
                {formData.fullName || t("Unnamed tenant")}
              </Typography>
            </Box>
            <IconButton onClick={() => setOpenEdit(false)} aria-label={t("Close")} disabled={saving} sx={{ bgcolor: "action.hover" }}>
              <CloseIcon />
            </IconButton>
          </Box>
        </Box>

        <DialogContent sx={{ p: 0, "& .MuiOutlinedInput-root": { borderRadius: "10px" } }}>
          {saveError && (
            <Alert severity="error" sx={{ mx: { xs: 2, sm: 3 }, mt: 2.5, borderRadius: "10px" }}>
              {saveError}
            </Alert>
          )}

          <Box sx={{ px: { xs: 2, sm: 3 } }}>
            {/* Personal */}
            <FormSection first icon={PersonOutlineOutlinedIcon} title={t("Personal information")} description="How you and the caretaker reach this tenant.">
              <Box sx={formStack}>
                <TextField required label={t("Full name")} name="fullName" value={formData.fullName} onChange={handleChange} fullWidth {...fieldError("fullName")} />
                <Box sx={formPair}>
                  <TextField required label={t("Phone number")} name="phone" type="tel" value={formData.phone} onChange={handleChange} fullWidth {...fieldError("phone")} />
                  <TextField label={t("Email address")} name="email" value={formData.email} onChange={handleChange} fullWidth {...fieldError("email")} />
                </Box>
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.75 }}>
                    {t("Status")}
                  </Typography>
                  <ToggleButtonGroup
                    exclusive
                    fullWidth
                    value={formData.status}
                    onChange={(e, value) => value && setField("status", value)}
                    aria-label={t("Tenant status")}
                    sx={segmentedSx}
                  >
                    <ToggleButton value="Active">{t("Active")}</ToggleButton>
                    <ToggleButton value="Pending Onboarding">{t("Pending onboarding")}</ToggleButton>
                    <ToggleButton value="Inactive">{t("Inactive")}</ToggleButton>
                  </ToggleButtonGroup>
                  {formData.status === "Inactive" && (
                    <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.75 }}>
                      {t("Inactive tenants no longer hold their bed and drop out of rent tracking.")}
                    </Typography>
                  )}
                </Box>
              </Box>
            </FormSection>

            {/* Room & rent */}
            <FormSection icon={MeetingRoomOutlinedIcon} title={t("Room & rent")} description="Where they stay and what they pay each month.">
              <Box sx={formStack}>
                <TextField select required label={t("Property")} name="propertyId" value={formData.propertyId} onChange={handleChange} fullWidth {...fieldError("propertyId")}>
                  {ownerProperties.map((prop) => (
                    <MenuItem key={prop.id} value={prop.id}>{prop.propertyName || prop.name}</MenuItem>
                  ))}
                </TextField>
                <Box sx={formPair}>
                  <TextField
                    select
                    required
                    label={t("Room")}
                    name="roomId"
                    value={formData.roomId}
                    onChange={handleChange}
                    fullWidth
                    disabled={!formData.propertyId || availableRooms.length === 0}
                    {...fieldError("roomId")}
                    helperText={formErrors.roomId || (occupancyLoading ? "Checking availability…" : "")}
                  >
                    {availableRooms.map((room) => {
                      const rName = room.roomName || room.roomNumber || room.id;
                      const cap = Number(room.capacity || 0);
                      const taken = roomOccupancy.get(String(rName))?.count || 0;
                      const free = Math.max(0, cap - taken);
                      const isFull = cap > 0 && free === 0;
                      const blocked = blockedForMaintenance(room);
                      return (
                        <MenuItem key={rName} value={rName} disabled={isFull || blocked}>
                          <Box sx={{ minWidth: 0 }}>
                            <Typography variant="body2" sx={{ fontWeight: 700 }}>
                              {rName}
                              {room.floor ? (
                                <Box component="span" sx={{ fontWeight: 400, color: "text.secondary" }}>{" "}{t("· Floor")}{" "}{room.floor}</Box>
                              ) : null}
                            </Typography>
                            <Typography variant="caption" sx={{ color: isRoomUnderMaintenance(room) ? "warning.main" : isFull ? "error.main" : "text.secondary" }}>
                              {isRoomUnderMaintenance(room)
                                ? t("Under maintenance")
                                : cap > 0
                                ? isFull ? t("Full") : `${free} of ${cap} beds free`
                                : ""}
                              {room.monthlyRatePerBed ? ` · ${formatAmount(room.monthlyRatePerBed)}/bed` : ""}
                            </Typography>
                          </Box>
                        </MenuItem>
                      );
                    })}
                  </TextField>
                  <TextField
                    select
                    required
                    label={t("Bed")}
                    name="bedId"
                    value={formData.bedId}
                    onChange={handleChange}
                    fullWidth
                    disabled={!formData.roomId || availableBeds.length === 0}
                    {...fieldError("bedId")}
                    helperText={
                      formErrors.bedId ||
                      (formData.roomId && roomCapacity > 0 && availableBeds.length === 0 && !occupancyLoading ? "No free beds in this room." : "")
                    }
                  >
                    {availableBeds.map((bed) => (
                      <MenuItem key={bed} value={bed}>{bed}</MenuItem>
                    ))}
                  </TextField>
                </Box>
                <TextField
                  required
                  label={t("Monthly rent")}
                  name="monthlyRent"
                  type="number"
                  value={formData.monthlyRent}
                  onChange={handleChange}
                  fullWidth
                  slotProps={{ input: { startAdornment: <InputAdornment position="start">₱</InputAdornment> } }}
                  {...fieldError("monthlyRent")}
                  helperText={formErrors.monthlyRent || "Filled in from the room's rate when you pick a room. You can change it."}
                />
              </Box>
            </FormSection>

            {/* Lease */}
            <FormSection icon={CalendarMonthOutlinedIcon} title={t("Lease")} description="Pick the start and how long. The end date is worked out for you.">
              <Box sx={formStack}>
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.75 }}>
                    {t("Duration")}
                  </Typography>
                  <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75 }}>
                    {LEASE_DURATIONS.map((opt) => {
                      const on = formData.leaseDuration === opt.value;
                      return (
                        <Chip
                          key={opt.value}
                          label={opt.value === "custom" ? "Custom" : opt.label}
                          clickable
                          color={on ? "primary" : "default"}
                          variant={on ? "filled" : "outlined"}
                          onClick={() => setField("leaseDuration", opt.value)}
                          sx={{ fontWeight: 700, borderRadius: "8px", height: 34 }}
                        />
                      );
                    })}
                  </Box>
                  {formErrors.leaseDuration && (
                    <Typography variant="caption" color="error" sx={{ display: "block", mt: 0.5 }}>
                      {formErrors.leaseDuration}
                    </Typography>
                  )}
                </Box>
                {formData.leaseDuration === "custom" && (
                  <TextField
                    required
                    label={t("Custom lease term")}
                    name="customLeaseDuration"
                    placeholder={t("e.g. Month-to-month, 2 years")}
                    value={formData.customLeaseDuration}
                    onChange={handleChange}
                    fullWidth
                    {...fieldError("customLeaseDuration")}
                  />
                )}
                <Box sx={formPair}>
                  <TextField
                    required
                    label={t("Start date")}
                    name="leaseStart"
                    type="date"
                    slotProps={{ inputLabel: { shrink: true } }}
                    value={formData.leaseStart}
                    onChange={handleChange}
                    fullWidth
                    {...fieldError("leaseStart")}
                  />
                  <TextField
                    required={formData.leaseDuration !== "custom"}
                    label={t("End date")}
                    name="leaseEnd"
                    type="date"
                    slotProps={{ inputLabel: { shrink: true } }}
                    value={formData.leaseEnd}
                    onChange={handleChange}
                    fullWidth
                    {...fieldError("leaseEnd")}
                    helperText={formErrors.leaseEnd || (formData.leaseDuration === "custom" ? "Optional for custom terms." : "")}
                  />
                </Box>
                {formData.leaseStart && formData.leaseEnd && formData.leaseEnd > formData.leaseStart && (
                  <Box sx={{ display: "flex", alignItems: "center", gap: 1, p: 1.25, borderRadius: "10px", bgcolor: (t) => alpha(t.palette.background.paper, 0.55) }}>
                    <CalendarMonthOutlinedIcon sx={{ fontSize: 18, color: "primary.main" }} />
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>
                      {formatDate(formData.leaseStart)} → {formatDate(formData.leaseEnd)}
                      <Box component="span" sx={{ color: "text.secondary", fontWeight: 400 }}>
                        {" "}· {formData.leaseDuration === "custom"
                          ? formData.customLeaseDuration || t("custom term")
                          : LEASE_DURATIONS.find((d) => d.value === formData.leaseDuration)?.label || ""}
                      </Box>
                    </Typography>
                  </Box>
                )}
              </Box>
            </FormSection>

            {/* Emergency contact */}
            <FormSection icon={ContactEmergencyOutlinedIcon} title={t("Emergency contact")} description="Who to call if something happens to this tenant.">
              <Box sx={formStack}>
                <Box sx={formPair}>
                  <TextField label={t("Contact name")} name="emergencyName" value={formData.emergencyName} onChange={handleChange} fullWidth />
                  <TextField label={t("Relationship")} name="emergencyRelationship" placeholder={t("e.g. Mother")} value={formData.emergencyRelationship} onChange={handleChange} fullWidth />
                </Box>
                <TextField label={t("Contact's phone")} name="emergencyPhone" type="tel" value={formData.emergencyPhone} onChange={handleChange} fullWidth />
              </Box>
            </FormSection>

            {/* Notes */}
            <FormSection icon={StickyNote2OutlinedIcon} title={t("Notes")} description="Only you can see these.">
              <TextField
                name="notes"
                multiline
                minRows={3}
                placeholder={t("Requirements, agreements, reminders…")}
                value={formData.notes}
                onChange={handleChange}
                fullWidth
                slotProps={{ htmlInput: { "aria-label": "Owner notes" } }}
              />
            </FormSection>
          </Box>
        </DialogContent>

        <DialogActions sx={{ px: { xs: 2, sm: 3 }, py: 1.75, gap: 1, borderTop: "1px solid", borderColor: "divider", bgcolor: (t) => alpha(t.palette.background.paper, 0.35) }}>
          <Button onClick={() => setOpenEdit(false)} color="inherit" disabled={saving} sx={{ fontWeight: 700, borderRadius: "10px", flex: { xs: 1, sm: "none" } }}>
            {t("Cancel")}
          </Button>
          <Button
            variant="contained"
            disableElevation
            onClick={handleSaveEdit}
            disabled={saving}
            startIcon={saving ? <CircularProgress size={18} color="inherit" /> : <SaveOutlinedIcon />}
            sx={{ px: 3, fontWeight: 700, borderRadius: "10px", flex: { xs: 1, sm: "none" } }}
          >
            {saving ? t("Saving…") : t("Save changes")}
          </Button>
        </DialogActions>
      </Dialog>

      {feeDialog.open && (
        <AddFeeDialog
          key={feeDialog.key}
          open
          onClose={() => setFeeDialog((d) => ({ ...d, open: false }))}
          onSaved={(message) => setSnackbar({ message, severity: "success" })}
          ownerUid={ownerUid}
          tenants={[feeTenant]}
          initialTenantIds={[feeTenant.id]}
          charges={charges}
          editing={feeDialog.editing}
        />
      )}

      <Snackbar
        open={Boolean(snackbar)}
        autoHideDuration={3500}
        onClose={() => setSnackbar(null)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity={snackbar?.severity || "success"} variant="filled" onClose={() => setSnackbar(null)} sx={{ width: "100%" }}>
          {snackbar?.message}
        </Alert>
      </Snackbar>
    </Container>
  );
}