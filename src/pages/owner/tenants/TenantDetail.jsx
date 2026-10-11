// src/pages/owner/tenants/TenantDetail.jsx

import React, { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Box,
  Container,
  Typography,
  Grid,
  Stack,
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
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  IconButton,
  InputAdornment,
  LinearProgress,
  useMediaQuery,
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
import EmailOutlinedIcon from "@mui/icons-material/EmailOutlined";
import PhoneOutlinedIcon from "@mui/icons-material/PhoneOutlined";
import NightsStayOutlinedIcon from "@mui/icons-material/NightsStayOutlined";

import {
  doc,
  getDoc,
  getDocs,
  updateDoc,
  collection,
  query,
  where,
  onSnapshot,
  setDoc,
} from "firebase/firestore";
import { auth, db } from "../../../config/firebase";
import { normalizePayment } from "../../../utils/normalizePayment";
import { formatPropertyAddress } from "../../../utils/formatPropertyAddress";
import { addMonthsClamped } from "../../../utils/addMonthsClamped";
import { reconcilePropertyOccupancy } from "../../../utils/reconcilePropertyOccupancy";
import { useAuth } from "../../../context/AuthContext";

// ---------------------------------------------------------------------------
// Constants — lease codes deliberately match what RegisterTenant stores in
// `leaseDuration` ("6_months" etc.), so the value set at registration is the
// value the edit form starts from.
// ---------------------------------------------------------------------------
const LEASE_DURATIONS = [
  { value: "1_month", label: "1 month", months: 1 },
  { value: "3_months", label: "3 months", months: 3 },
  { value: "6_months", label: "6 months", months: 6 },
  { value: "12_months", label: "12 months", months: 12 },
  { value: "custom", label: "Custom…", months: null },
];

const ID_TYPE_LABELS = {
  student_id: "Student ID",
  national_id: "National ID",
  drivers_license: "Driver's license",
  passport: "Passport",
  other: "Other valid ID",
};

const STATUS_CHIP_STYLES = {
  Active: { bg: "rgba(46, 125, 50, 0.12)", color: "success.dark" },
  "Pending Onboarding": { bg: "rgba(237, 108, 2, 0.14)", color: "warning.dark" },
  Inactive: { bg: "rgba(0, 0, 0, 0.07)", color: "text.secondary" },
};

// Lease status colors, tuned for the dark lease card
const LEASE_TONES = {
  active: { bg: "rgba(76, 175, 80, 0.18)", color: "#81c784" },
  soon: { bg: "rgba(255, 167, 38, 0.18)", color: "#ffb74d" },
  ended: { bg: "rgba(244, 67, 54, 0.2)", color: "#ef9a9a" },
  neutral: { bg: "rgba(202, 220, 246, 0.16)", color: "#cadcf6" },
};

const HEADING_FONT = '"Inter", sans-serif';

// White card on the cream page, matching the other owner pages
const panelSx = {
  bgcolor: "background.default",
  border: "1px solid",
  borderColor: "divider",
  borderRadius: 3,
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
  let durationLabel = null;
  if (stored) {
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
  let statusLabel = "";
  let headline = "";

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

function OverviewItem({ icon: Icon, label, value, sub, valueColor = "text.primary" }) {
  return (
    <Box
      sx={{
        display: "flex",
        alignItems: "flex-start",
        gap: 1.75,
        py: { xs: 2, md: 0 },
        px: { md: 3 },
        minWidth: 0,
        "&:first-of-type": { pl: { md: 0 }, pt: { xs: 0 } },
        "&:last-of-type": { pr: { md: 0 }, pb: { xs: 0 } },
        "&:not(:first-of-type)": {
          borderTop: { xs: "1px solid", md: "none" },
          borderLeft: { xs: "none", md: "1px solid" },
          borderColor: "divider",
        },
      }}
    >
      <Box
        sx={{
          width: 40,
          height: 40,
          borderRadius: "50%",
          bgcolor: "rgba(255, 69, 0, 0.1)",
          color: "primary.main",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <Icon sx={{ fontSize: 20 }} />
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
          {label}
        </Typography>
        <Typography sx={{ fontFamily: HEADING_FONT, fontWeight: 700, color: valueColor, lineHeight: 1.3, wordBreak: "break-word" }}>
          {value}
        </Typography>
        {sub && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25, wordBreak: "break-word" }}>
            {sub}
          </Typography>
        )}
      </Box>
    </Box>
  );
}

function FormSectionTitle({ children }) {
  return (
    <Typography sx={{ fontFamily: HEADING_FONT, fontWeight: 700, fontSize: "0.95rem", mb: 2 }} color="text.primary">
      {children}
    </Typography>
  );
}


// ---------------------------------------------------------------------------
// Curfew record
// ---------------------------------------------------------------------------
const CURFEW_STATUS = {
  present: { label: "In on time", tone: "success", dot: "success.main" },
  late: { label: "Late", tone: "warning", dot: "warning.main" },
  out: { label: "Out past curfew", tone: "error", dot: "error.main" },
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
              On time{" "}
              <Box component="span" sx={{ color: onTimeRate >= 80 ? "success.main" : "warning.main", fontFamily: HEADING_FONT, fontWeight: 700 }}>
                {onTimeRate}%
              </Box>
            </Typography>
          )
        }
      >
        Curfew record
      </SectionHeading>

      {nights.length === 0 ? (
        <Typography color="text.secondary" variant="body2" sx={{ py: 4, textAlign: "center", border: "1px dashed", borderColor: "divider", borderRadius: 2 }}>
          No curfew checks recorded for this tenant yet. They appear here once the caretaker starts logging nights.
        </Typography>
      ) : (
        <>
          <Box sx={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: { xs: 1, sm: 2 }, mb: 2.5 }}>
            {[
              { label: "Nights checked", value: nights.length },
              { label: "On time", value: count("present"), color: "success.main" },
              { label: "Late", value: count("late"), color: count("late") > 0 ? "warning.main" : undefined },
              { label: "Out", value: count("out"), color: count("out") > 0 ? "error.main" : undefined },
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
              {showAll ? "Show fewer" : `Show all ${nights.length} nights`}
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Edit dialog state
  const [openEdit, setOpenEdit] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [formErrors, setFormErrors] = useState({});
  const [snackbar, setSnackbar] = useState(false);
  const [ownerProperties, setOwnerProperties] = useState([]);
  const [propertyTenants, setPropertyTenants] = useState([]);
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
    if (!tenantId) {
      setError("No tenant ID provided in URL.");
      setLoading(false);
      return;
    }
    // On a hard refresh Firebase restores the session asynchronously — wait
    // for it, otherwise the owner's properties silently fail to load.
    if (authLoading) return;

    const fetchTenantData = async () => {
      try {
        const tenantSnap = await getDoc(doc(db, "tenants", tenantId));

        if (!tenantSnap.exists()) {
          setError("Tenant not found in database.");
          setLoading(false);
          return;
        }

        const userSnap = await getDoc(doc(db, "users", tenantId));
        const userData = userSnap.exists() ? userSnap.data() : {};
        const tenantData = {
          ...userData,
          id: tenantSnap.id,
          ...tenantSnap.data(),
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
  useEffect(() => {
    if (!tenantId) return;

    const unsubscribe = onSnapshot(
      query(collection(db, "payments"), where("tenantId", "==", tenantId)),
      (snapshot) => {
        setPayments(snapshot.docs.map((d) => normalizePayment({ id: d.id, ...d.data() })));
      },
      (err) => {
        console.error("Error fetching tenant payments:", err);
      }
    );

    return () => unsubscribe();
  }, [tenantId]);

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
    if (!openEdit || !formData.propertyId) {
      setPropertyTenants([]);
      return;
    }

    let cancelled = false;
    setOccupancyLoading(true);

    (async () => {
      try {
        const snap = await getDocs(
          query(collection(db, "tenants"), where("propertyId", "==", formData.propertyId))
        );
        if (!cancelled) {
          setPropertyTenants(
            snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((t) => t.id !== tenantId)
          );
        }
      } catch (err) {
        console.warn("Could not load property occupancy:", err);
        if (!cancelled) setPropertyTenants([]);
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

  const roomOccupancy = useMemo(() => {
    const map = new Map();
    propertyTenants.forEach((t) => {
      const room = String(t.roomId || "");
      if (!room) return;
      if (!map.has(room)) map.set(room, { count: 0, beds: new Set() });
      const entry = map.get(room);
      entry.count += 1;
      if (t.bedId) entry.beds.add(String(t.bedId));
    });
    return map;
  }, [propertyTenants]);

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
        customLeaseDuration = String(stored);
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
      status: tenant.status || "Active",
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
            next.customLeaseDuration =
              m > 0 ? pluralize(m, "month") : pluralize(Math.round((e2 - s) / MS_PER_DAY), "day");
          }
        }
      }

      return next;
    });
  };

  const validateForm = () => {
    const e = {};
    if (!formData.fullName.trim()) e.fullName = "Full name is required.";
    if (formData.email.trim() && !/^\S+@\S+\.\S+$/.test(formData.email.trim())) {
      e.email = "Enter a valid email address.";
    }
    if (!formData.phone.trim()) e.phone = "Phone number is required.";
    if (!formData.propertyId) e.propertyId = "Select a property.";
    if (!formData.roomId) e.roomId = "Select a room.";
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
      const tenantRef = doc(db, "tenants", tenantId);
      const previousPropertyId = tenant?.propertyId || "";

      const isCustom = formData.leaseDuration === "custom";
      const finalDuration = isCustom ? formData.customLeaseDuration.trim() : formData.leaseDuration;
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
        status: formData.status,
        propertyId: formData.propertyId,
        roomId: formData.roomId,
        bedId: formData.bedId || null,
        monthlyRent: rent,
        rentAmount: rent,
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
        updateDoc(tenantRef, updatedPayload),
        setDoc(doc(db, "users", tenantId), updatedPayload, { merge: true }),
      ]);

      const propertyIds = [...new Set([previousPropertyId, formData.propertyId].filter(Boolean))];
      await Promise.all(propertyIds.map((pid) => reconcilePropertyOccupancy(pid)));

      setTenant((prev) => ({ ...prev, ...updatedPayload }));
      const newlyMatchedProp = ownerProperties.find((p) => p.id === formData.propertyId);
      if (newlyMatchedProp) setProperty(newlyMatchedProp);

      setOpenEdit(false);
      setSnackbar(true);
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
  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", py: 12, flexDirection: "column", gap: 2 }}>
        <CircularProgress />
        <Typography variant="body2" color="text.secondary">
          Loading tenant profile…
        </Typography>
      </Box>
    );
  }

  if (error || !tenant) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Alert severity="error" sx={{ mb: 2 }}>{error || "Tenant details unavailable."}</Alert>
        <Button variant="outlined" startIcon={<ArrowBackIcon />} onClick={() => navigate("/owner/tenants")}>
          Back to tenants
        </Button>
      </Container>
    );
  }

  // =========================================================
  // DERIVED DISPLAY VALUES
  // =========================================================
  const displayName = tenant.fullName || tenant.name || "Unnamed tenant";
  const phone = tenant.phone || tenant.contactNumber;
  const emergencyPhone = tenant.emergencyContact?.phone || tenant.emergencyPhone;
  const statusStyle = STATUS_CHIP_STYLES[tenant.status || "Active"] || STATUS_CHIP_STYLES.Inactive;

  const assignedRoom = property?.rooms?.find(
    (room) =>
      room.roomName === tenant.roomId ||
      room.roomNumber === tenant.roomId ||
      room.id === tenant.roomId
  );
  const monthlyRentValue =
    tenant.monthlyRent ?? tenant.rentAmount ?? tenant.roomMonthlyRate ?? tenant.monthlyRate ?? tenant.rent ?? assignedRoom?.monthlyRatePerBed ?? 0;
  const roomSub =
    [tenant.bedId, assignedRoom?.floor ? `Floor ${assignedRoom.floor}` : null].filter(Boolean).join(" · ") ||
    "No bed assigned";

  const lease = getLeaseInfo(tenant);
  const leaseTone = LEASE_TONES[lease.tone];
  const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);

  return (
    <Container maxWidth="lg" disableGutters sx={{ py: 0 }}>
      <Button
        startIcon={<ArrowBackIcon />}
        onClick={() => navigate("/owner/tenants")}
        sx={{ mb: 1.5, ml: -1, color: "text.secondary", fontWeight: 600 }}
      >
        Tenants
      </Button>

      {/* ───── Header ───── */}
      <Box
        sx={{
          display: "flex",
          flexDirection: { xs: "column", sm: "row" },
          alignItems: { xs: "stretch", sm: "center" },
          justifyContent: "space-between",
          gap: { xs: 2, sm: 3 },
          mb: 3,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: { xs: 2, sm: 2.5 }, minWidth: 0 }}>
          <Avatar
            alt={displayName}
            sx={{
              width: { xs: 60, sm: 76 },
              height: { xs: 60, sm: 76 },
              bgcolor: "rgba(255, 69, 0, 0.12)",
              color: "primary.main",
              fontFamily: HEADING_FONT,
              fontWeight: 800,
              fontSize: { xs: "1.5rem", sm: "1.9rem" },
              flexShrink: 0,
            }}
          >
            {displayName.charAt(0).toUpperCase()}
          </Avatar>

          <Box sx={{ minWidth: 0 }}>
            <Box sx={{ display: "flex", alignItems: "center", flexWrap: "wrap", columnGap: 1.5, rowGap: 0.5 }}>
              <Typography
                component="h1"
                sx={{ fontFamily: HEADING_FONT, fontWeight: 900, fontSize: { xs: "1.5rem", sm: "2rem" }, wordBreak: "break-word", lineHeight: 1.2 }}
                color="text.primary"
              >
                {displayName}
              </Typography>
              <Chip
                label={tenant.status || "Active"}
                size="small"
                sx={{ bgcolor: statusStyle.bg, color: statusStyle.color, fontWeight: 600, border: "none" }}
              />
            </Box>
            <Box sx={{ display: "flex", flexWrap: "wrap", columnGap: 2.5, rowGap: 0.5, mt: 0.75 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, minWidth: 0 }}>
                <EmailOutlinedIcon sx={{ fontSize: 17, color: "text.secondary" }} />
                {tenant.email ? (
                  <Link href={`mailto:${tenant.email}`} underline="hover" color="text.secondary" variant="body2" sx={{ wordBreak: "break-all" }}>
                    {tenant.email}
                  </Link>
                ) : (
                  <Typography variant="body2" color="text.secondary">No email provided</Typography>
                )}
              </Box>
              <Box sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
                <PhoneOutlinedIcon sx={{ fontSize: 17, color: "text.secondary" }} />
                {phone ? (
                  <Link href={`tel:${phone}`} underline="hover" color="text.secondary" variant="body2">
                    {phone}
                  </Link>
                ) : (
                  <Typography variant="body2" color="text.secondary">No phone number</Typography>
                )}
              </Box>
            </Box>
          </Box>
        </Box>

        <Button
          variant="contained"
          disableElevation
          startIcon={<EditOutlinedIcon />}
          onClick={handleOpenEdit}
          sx={{ py: 1.1, px: 3, fontWeight: 600, flexShrink: 0, alignSelf: { xs: "stretch", sm: "center" } }}
        >
          Edit details
        </Button>
      </Box>

      {/* ───── Overview ───── */}
      <Box
        sx={{
          ...panelSx,
          p: { xs: 2.5, md: 3 },
          mb: 2.5,
          display: "grid",
          gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "repeat(3, minmax(0, 1fr))" },
        }}
      >
        <OverviewItem
          icon={HomeWorkOutlinedIcon}
          label="Property"
          value={property?.name || property?.propertyName || tenant.propertyName || "Unassigned"}
          sub={formatPropertyAddress(property)}
        />
        <OverviewItem
          icon={MeetingRoomOutlinedIcon}
          label="Room & bed"
          value={tenant.roomId ? `Room ${tenant.roomId}` : "Unassigned"}
          sub={roomSub}
        />
        <OverviewItem
          icon={PaymentsOutlinedIcon}
          label="Monthly rent"
          value={formatAmount(monthlyRentValue)}
          valueColor="primary.main"
          sub="Per bed, per month"
        />
      </Box>

      {/* ───── Lease + payment summary ───── */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "minmax(0, 1.6fr) minmax(0, 1fr)" },
          gap: 2.5,
          mb: 2.5,
        }}
      >
        <Box sx={{ bgcolor: "#202020", color: "#ffffff", borderRadius: 3, p: { xs: 2.5, sm: 3.5 }, minWidth: 0 }}>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
              <CalendarMonthOutlinedIcon sx={{ color: "primary.main" }} />
              <Typography sx={{ fontFamily: HEADING_FONT, fontWeight: 700 }}>Lease</Typography>
            </Box>
            <Chip
              label={lease.statusLabel}
              size="small"
              sx={{ bgcolor: leaseTone.bg, color: leaseTone.color, fontWeight: 600, border: "none" }}
            />
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
              sx={{
                height: 6,
                borderRadius: 3,
                my: 2.5,
                bgcolor: "rgba(202, 220, 246, 0.18)",
                "& .MuiLinearProgress-bar": { bgcolor: "primary.main", borderRadius: 3 },
              }}
            />
          )}

          <Box sx={{ display: "flex", justifyContent: "space-between", gap: 2, mt: lease.progress != null ? 0 : 2.5 }}>
            <Box>
              <Typography variant="caption" sx={{ color: "#cadcf6", display: "block" }}>Start</Typography>
              <Typography sx={{ fontWeight: 600 }}>{formatDate(lease.start)}</Typography>
            </Box>
            <Box sx={{ textAlign: "right" }}>
              <Typography variant="caption" sx={{ color: "#cadcf6", display: "block" }}>End</Typography>
              <Typography sx={{ fontWeight: 600 }}>{formatDate(lease.end)}</Typography>
            </Box>
          </Box>
        </Box>

        <Box sx={{ ...panelSx, p: { xs: 2.5, sm: 3.5 }, display: "flex", flexDirection: "column", justifyContent: "space-between", gap: 2 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
            <ReceiptLongOutlinedIcon sx={{ color: "primary.main" }} />
            <Typography sx={{ fontFamily: HEADING_FONT, fontWeight: 700 }}>Payments</Typography>
          </Box>
          <Box>
            <Typography variant="caption" color="text.secondary">Total paid</Typography>
            <Typography sx={{ fontFamily: HEADING_FONT, fontWeight: 900, fontSize: { xs: "1.6rem", sm: "2rem" }, lineHeight: 1.2, color: "primary.main" }}>
              {formatAmount(totalPaid)}
            </Typography>
          </Box>
          <Typography variant="body2" color="text.secondary">
            {sortedPayments[0]
              ? `${pluralize(payments.length, "payment")} · last on ${formatDate(sortedPayments[0].paymentDate || sortedPayments[0].createdAt)}`
              : "No payments recorded yet."}
          </Typography>
        </Box>
      </Box>

      {/* ───── Emergency contact + Identification ───── */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "repeat(2, minmax(0, 1fr))" },
          gap: 2.5,
          mb: 2.5,
        }}
      >
        <Box sx={{ ...panelSx, p: { xs: 2.5, sm: 3 } }}>
          <SectionHeading icon={ContactEmergencyOutlinedIcon}>Emergency contact</SectionHeading>
          <Box>
            <DetailRow label="Name">{tenant.emergencyContact?.name || tenant.emergencyName || "Not provided"}</DetailRow>
            <DetailRow label="Relationship">{tenant.emergencyContact?.relationship || tenant.emergencyRelationship || "—"}</DetailRow>
            <DetailRow label="Phone">
              {emergencyPhone ? (
                <Link href={`tel:${emergencyPhone}`} underline="hover" color="inherit">
                  {emergencyPhone}
                </Link>
              ) : (
                "—"
              )}
            </DetailRow>
          </Box>
        </Box>

        <Box sx={{ ...panelSx, p: { xs: 2.5, sm: 3 } }}>
          <SectionHeading icon={BadgeOutlinedIcon}>Identification</SectionHeading>
          <Box>
            <DetailRow label="ID type">
              {tenant.idType ? ID_TYPE_LABELS[tenant.idType] || String(tenant.idType).replace(/_/g, " ") : "—"}
            </DetailRow>
            <DetailRow label="ID number">{tenant.idNumber || "—"}</DetailRow>
            <DetailRow label="ID photo">
              {tenant.idPhotoUrl ? (
                <Link
                  href={tenant.idPhotoUrl}
                  target="_blank"
                  rel="noopener"
                  underline="hover"
                  sx={{ display: "inline-flex", alignItems: "center", gap: 0.5 }}
                >
                  View photo <OpenInNewIcon sx={{ fontSize: 15 }} />
                </Link>
              ) : (
                "Not uploaded"
              )}
            </DetailRow>
            <DetailRow label="Registered">{formatDate(tenant.createdAt)}</DetailRow>
            <DetailRow label="Notes">
              <Box component="span" sx={{ fontWeight: 400, color: "text.secondary" }}>
                {tenant.notes || "No notes recorded."}
              </Box>
            </DetailRow>
          </Box>
        </Box>
      </Box>

      {/* ───── Curfew record ───── */}
      <CurfewRecord nights={curfewNights} showAll={showAllNights} onToggle={() => setShowAllNights((v) => !v)} />

      {/* ───── Payments ───── */}
      <Box sx={{ ...panelSx, p: { xs: 2.5, sm: 3 } }}>
        <SectionHeading
          icon={ReceiptLongOutlinedIcon}
          action={
            payments.length > 0 && (
              <Typography variant="body2" sx={{ fontWeight: 600, color: "text.secondary", textAlign: "right" }}>
                Total{" "}
                <Box component="span" sx={{ color: "primary.main", fontFamily: HEADING_FONT, fontWeight: 700 }}>
                  {formatAmount(totalPaid)}
                </Box>
              </Typography>
            )
          }
        >
          Payment records
        </SectionHeading>

        {payments.length === 0 ? (
          <Typography color="text.secondary" variant="body2" sx={{ py: 4, textAlign: "center", border: "1px dashed", borderColor: "divider", borderRadius: 2 }}>
            No payment records yet.
          </Typography>
        ) : (
          <>
            <Box sx={{ display: { xs: "none", sm: "block" } }}>
              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      {["Date", "Amount", "Method", "Reference / notes"].map((h) => (
                        <TableCell key={h} sx={{ fontWeight: 600, color: "text.secondary" }}>{h}</TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {sortedPayments.map((p) => (
                      <TableRow key={p.id} hover sx={{ "&:last-child td": { borderBottom: 0 } }}>
                        <TableCell>{formatDate(p.paymentDate || p.createdAt)}</TableCell>
                        <TableCell>
                          <Typography sx={{ fontWeight: 700 }} color="primary.main">
                            {formatAmount(p.amount)}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={p.paymentMethod || "Not specified"}
                            size="small"
                            sx={{ bgcolor: "rgba(202, 220, 246, 0.35)", fontWeight: 500, border: "none" }}
                          />
                        </TableCell>
                        <TableCell>{p.referenceNumber || p.notes || "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>

            {/* Stacked list on phones — a 4-column table doesn't fit */}
            <Box sx={{ display: { xs: "block", sm: "none" } }}>
              {sortedPayments.map((p) => (
                <Box
                  key={p.id}
                  sx={{ py: 1.5, borderBottom: "1px solid", borderColor: "divider", "&:last-of-type": { borderBottom: "none", pb: 0 }, "&:first-of-type": { pt: 0 } }}
                >
                  <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 2 }}>
                    <Typography sx={{ fontFamily: HEADING_FONT, fontWeight: 700 }} color="primary.main">
                      {formatAmount(p.amount)}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {formatDate(p.paymentDate || p.createdAt)}
                    </Typography>
                  </Box>
                  <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.25, wordBreak: "break-word" }}>
                    {[p.paymentMethod, p.referenceNumber || p.notes].filter(Boolean).join(" · ") || "—"}
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
        slotProps={{ paper: { sx: { borderRadius: fullScreen ? 0 : 3 } } }}
      >
        <DialogTitle sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontFamily: HEADING_FONT, fontWeight: 700 }}>
          Edit tenant details
          <IconButton onClick={() => setOpenEdit(false)} size="small" aria-label="Close" disabled={saving}>
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        <DialogContent dividers sx={{ p: { xs: 2, sm: 3 } }}>
          {saveError && <Alert severity="error" sx={{ mb: 3 }}>{saveError}</Alert>}

          <Stack spacing={4}>
            {/* Personal */}
            <Box>
              <FormSectionTitle>Personal information</FormSectionTitle>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, md: 4 }}>
                  <TextField required label="Full name" name="fullName" value={formData.fullName} onChange={handleChange} fullWidth {...fieldError("fullName")} />
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                  <TextField label="Email address" name="email" value={formData.email} onChange={handleChange} fullWidth {...fieldError("email")} />
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                  <TextField required label="Phone number" name="phone" type="tel" value={formData.phone} onChange={handleChange} fullWidth {...fieldError("phone")} />
                </Grid>
              </Grid>
            </Box>

            {/* Property & bed */}
            <Box>
              <FormSectionTitle>Property &amp; bed</FormSectionTitle>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField select required label="Assigned property" name="propertyId" value={formData.propertyId} onChange={handleChange} fullWidth {...fieldError("propertyId")}>
                    {ownerProperties.map((prop) => (
                      <MenuItem key={prop.id} value={prop.id}>{prop.name || prop.propertyName}</MenuItem>
                    ))}
                  </TextField>
                </Grid>
                <Grid size={{ xs: 12, sm: 6 }}>
                  <TextField select required label="Account status" name="status" value={formData.status} onChange={handleChange} fullWidth>
                    <MenuItem value="Active">Active</MenuItem>
                    <MenuItem value="Pending Onboarding">Pending onboarding</MenuItem>
                    <MenuItem value="Inactive">Inactive</MenuItem>
                  </TextField>
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                  <TextField
                    select
                    required
                    label="Room"
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
                      return (
                        <MenuItem key={rName} value={rName} disabled={isFull}>
                          {rName}
                          {room.floor ? ` · Floor ${room.floor}` : ""}
                          {cap > 0 ? (isFull ? " · Full" : ` · ${free} of ${cap} free`) : ""}
                        </MenuItem>
                      );
                    })}
                  </TextField>
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                  <TextField
                    select
                    required
                    label="Bed"
                    name="bedId"
                    value={formData.bedId}
                    onChange={handleChange}
                    fullWidth
                    disabled={!formData.roomId || availableBeds.length === 0}
                    {...fieldError("bedId")}
                    helperText={
                      formErrors.bedId ||
                      (formData.roomId && roomCapacity > 0 && availableBeds.length === 0 && !occupancyLoading
                        ? "No free beds in this room."
                        : "")
                    }
                  >
                    {availableBeds.map((bed) => (
                      <MenuItem key={bed} value={bed}>{bed}</MenuItem>
                    ))}
                  </TextField>
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                  <TextField
                    required
                    label="Monthly rent"
                    name="monthlyRent"
                    type="number"
                    value={formData.monthlyRent}
                    onChange={handleChange}
                    fullWidth
                    slotProps={{ input: { startAdornment: <InputAdornment position="start">₱</InputAdornment> } }}
                    {...fieldError("monthlyRent")}
                  />
                </Grid>
              </Grid>
            </Box>

            {/* Lease */}
            <Box>
              <FormSectionTitle>Lease</FormSectionTitle>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, md: 4 }}>
                  <TextField
                    required
                    label="Start date"
                    name="leaseStart"
                    type="date"
                    slotProps={{ inputLabel: { shrink: true } }}
                    value={formData.leaseStart}
                    onChange={handleChange}
                    fullWidth
                    {...fieldError("leaseStart")}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                  <TextField select required label="Duration" name="leaseDuration" value={formData.leaseDuration} onChange={handleChange} fullWidth {...fieldError("leaseDuration")}>
                    {LEASE_DURATIONS.map((opt) => (
                      <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                    ))}
                  </TextField>
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                  <TextField
                    required={formData.leaseDuration !== "custom"}
                    label="End date"
                    name="leaseEnd"
                    type="date"
                    slotProps={{ inputLabel: { shrink: true } }}
                    value={formData.leaseEnd}
                    onChange={handleChange}
                    fullWidth
                    {...fieldError("leaseEnd")}
                    helperText={
                      formErrors.leaseEnd ||
                      (formData.leaseDuration === "custom"
                        ? "Optional for custom terms."
                        : "Calculated from start date and duration — you can adjust it.")
                    }
                  />
                </Grid>
                {formData.leaseDuration === "custom" && (
                  <Grid size={{ xs: 12 }}>
                    <TextField
                      required
                      label="Custom lease term"
                      name="customLeaseDuration"
                      placeholder="e.g. Month-to-month, 2 years"
                      value={formData.customLeaseDuration}
                      onChange={handleChange}
                      fullWidth
                      {...fieldError("customLeaseDuration")}
                    />
                  </Grid>
                )}
              </Grid>
            </Box>

            {/* Emergency + notes */}
            <Box>
              <FormSectionTitle>Emergency contact &amp; notes</FormSectionTitle>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12, md: 4 }}>
                  <TextField label="Contact name" name="emergencyName" value={formData.emergencyName} onChange={handleChange} fullWidth />
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                  <TextField label="Relationship" name="emergencyRelationship" value={formData.emergencyRelationship} onChange={handleChange} fullWidth />
                </Grid>
                <Grid size={{ xs: 12, md: 4 }}>
                  <TextField label="Emergency phone" name="emergencyPhone" type="tel" value={formData.emergencyPhone} onChange={handleChange} fullWidth />
                </Grid>
                <Grid size={{ xs: 12 }}>
                  <TextField label="Owner notes / requirements" name="notes" multiline rows={3} value={formData.notes} onChange={handleChange} fullWidth />
                </Grid>
              </Grid>
            </Box>
          </Stack>
        </DialogContent>

        <DialogActions sx={{ p: 2, gap: 1 }}>
          <Button onClick={() => setOpenEdit(false)} color="inherit" disabled={saving} sx={{ fontWeight: 600, flex: { xs: 1, sm: "none" } }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSaveEdit}
            disabled={saving}
            sx={{ px: 4, py: 1.25, fontWeight: 600, flex: { xs: 1, sm: "none" } }}
          >
            {saving ? <CircularProgress size={22} color="inherit" /> : "Save changes"}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar}
        autoHideDuration={3500}
        onClose={() => setSnackbar(false)}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert severity="success" variant="filled" onClose={() => setSnackbar(false)} sx={{ width: "100%" }}>
          Tenant details updated.
        </Alert>
      </Snackbar>
    </Container>
  );
}