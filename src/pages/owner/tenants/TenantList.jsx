// src/pages/owner/tenants/TenantList.jsx
//
// One searchable list of every tenant, with:
//  - "Needs attention" quick filters (overdue rent, payments to review,
//    leases ending, pending onboarding, no room, out past curfew)
//  - a property filter, status filter and sort
//  - this month's rent status per tenant instead of a bare "last paid" date

import { Fragment, useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Paper,
  Typography,
  Button,
  Chip,
  Avatar,
  Divider,
  Skeleton,
  InputBase,
  IconButton,
  TextField,
  MenuItem,
} from "@mui/material";
import { alpha } from "@mui/material/styles";

import PersonAddOutlinedIcon from "@mui/icons-material/PersonAddOutlined";
import SearchIcon from "@mui/icons-material/Search";
import CloseIcon from "@mui/icons-material/Close";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import PeopleOutlineIcon from "@mui/icons-material/PeopleOutlined";
import ScheduleIcon from "@mui/icons-material/Schedule";
import ErrorOutlineRoundedIcon from "@mui/icons-material/ErrorOutlineRounded";
import ReceiptLongOutlinedIcon from "@mui/icons-material/ReceiptLongOutlined";
import EventBusyOutlinedIcon from "@mui/icons-material/EventBusyOutlined";
import HourglassEmptyRoundedIcon from "@mui/icons-material/HourglassEmptyRounded";
import MeetingRoomOutlinedIcon from "@mui/icons-material/MeetingRoomOutlined";
import NightsStayOutlinedIcon from "@mui/icons-material/NightsStayOutlined";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutlined";
import PaymentsOutlinedIcon from "@mui/icons-material/PaymentsOutlined";
import PendingActionsOutlinedIcon from "@mui/icons-material/PendingActionsOutlined";
import PieChartOutlineRoundedIcon from "@mui/icons-material/PieChartOutlineRounded";

import { collection, query, where, onSnapshot } from "firebase/firestore";

import { auth, db } from "../../../config/firebase";
import { normalizePayment } from "../../../utils/normalizePayment";
import { MONTHS, DAY_MS, normalizeStatus, STATUS_TONE, rentStatusOf, leaseFlagOf } from "../../../utils/tenantRent";
import { withoutRemoved } from "../../../utils/accountState";

const HEAD = '"Inter", sans-serif';
const R = { sm: "10px", md: "14px", lg: "18px", xl: "22px" };
const row = { display: "flex", alignItems: "center" };
const panelSx = { bgcolor: "background.default", border: "1px solid", borderColor: "divider", borderRadius: R.lg };
const fieldSx = { "& .MuiOutlinedInput-root": { borderRadius: R.sm, bgcolor: "background.default" } };

const STATUS_FILTERS = ["All", "Active", "Pending", "Inactive"];

const tenantKey = (t) => t.uid || t.id;
const displayNameOf = (t) => t.fullName || t.name || "Unnamed Tenant";
const initialsOf = (name) =>
  String(name || "?").split(" ").filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("");


const dayKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

// Row of 10 room squares lit by a percentage (same as the Properties page)
const MINI_SQUARES = 10;
function MiniSquares({ pct }) {
  const lit = pct > 0 ? Math.max(1, Math.round((pct / 100) * MINI_SQUARES)) : 0;
  return (
    <Box aria-hidden sx={{ display: "grid", gridTemplateColumns: `repeat(${MINI_SQUARES}, minmax(0, 1fr))`, gap: "3px", mt: 0.75, maxWidth: 150 }}>
      {Array.from({ length: MINI_SQUARES }).map((_, i) => (
        <Box key={i} sx={{ aspectRatio: "1", borderRadius: "3px", bgcolor: i < lit ? "primary.main" : (t) => alpha(t.palette.text.primary, 0.09) }} />
      ))}
    </Box>
  );
}

// How many tenants to draw at once; "Show more" adds the next batch
const PAGE_SIZE = 50;

function Pill({ label, tone }) {
  if (tone === "none") return <Typography variant="body2" color="text.disabled">—</Typography>;
  return (
    <Box
      component="span"
      sx={{
        display: "inline-flex",
        alignItems: "center",
        px: 1,
        height: 24,
        borderRadius: 99,
        fontSize: 12.5,
        fontWeight: 700,
        whiteSpace: "nowrap",
        bgcolor: (t) => (tone === "default" ? alpha(t.palette.text.primary, 0.07) : alpha(t.palette[tone].main, 0.12)),
        color: (t) => (tone === "default" ? t.palette.text.secondary : t.palette[tone].dark),
      }}
    >
      {label}
    </Box>
  );
}

// "Needs attention" quick filters
const ATTENTION = [
  { key: "overdue", label: "Overdue rent", icon: <ErrorOutlineRoundedIcon />, tone: "error" },
  { key: "review", label: "Payment to review", icon: <ReceiptLongOutlinedIcon />, tone: "info" },
  { key: "lease", label: "Lease ending", icon: <EventBusyOutlinedIcon />, tone: "warning" },
  { key: "pending", label: "Pending onboarding", icon: <HourglassEmptyRoundedIcon />, tone: "warning" },
  { key: "noRoom", label: "No room", icon: <MeetingRoomOutlinedIcon />, tone: "warning" },
  { key: "curfew", label: "Out past curfew", icon: <NightsStayOutlinedIcon />, tone: "error" },
];

// Laptop column layout, shared by the header row and every tenant row
const COLUMNS = "minmax(0, 1.7fr) minmax(0, 1.3fr) minmax(0, 1fr) 128px";

export default function TenantList() {
  const navigate = useNavigate();

  const [tenants, setTenants] = useState([]);
  const [properties, setProperties] = useState([]);
  const [payments, setPayments] = useState([]);
  const [logs, setLogs] = useState([]);
  // Nothing to load when signed out, so start "done" in that case
  const [loading, setLoading] = useState(() => Boolean(auth.currentUser));
  // "Today", fixed when the page opens
  const [today] = useState(() => new Date());

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [propertyFilter, setPropertyFilter] = useState("all");
  const [attention, setAttention] = useState(null);
  const [sortBy, setSortBy] = useState("name");

  // =========================================================
  // DATA
  // =========================================================
  useEffect(() => {
    if (!auth.currentUser) return undefined;
    const unsubscribe = onSnapshot(
      query(collection(db, "properties"), where("ownerUid", "==", auth.currentUser.uid)),
      (snapshot) => setProperties(snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))),
      (error) => console.error("Error fetching properties:", error)
    );
    return () => unsubscribe();
  }, []);

  // Tenants: owner-linked records plus older records linked only by property
  useEffect(() => {
    if (!auth.currentUser) return undefined;

    const ownerId = auth.currentUser.uid;
    const tenantSources = new Map();
    let active = true;

    const publishTenants = () => {
      const tenantsById = new Map();
      tenantSources.forEach((sourceTenants) => {
        sourceTenants.forEach((tenant) => {
          const id = tenantKey(tenant);
          tenantsById.set(id, { ...(tenantsById.get(id) || {}), ...tenant });
        });
      });
      if (active) {
        setTenants(withoutRemoved([...tenantsById.values()]));
        setLoading(false);
      }
    };

    const subscribeToTenantSource = (sourceId, collectionName, field, value, usersOnly = false) =>
      onSnapshot(
        query(collection(db, collectionName), where(field, "==", value)),
        (snapshot) => {
          tenantSources.set(
            sourceId,
            snapshot.docs.map((d) => ({ id: d.id, ...d.data() })).filter((t) => !usersOnly || t.role === "tenant")
          );
          publishTenants();
        },
        (error) => {
          console.error(`Error fetching tenant records from ${collectionName}:`, error);
          if (active) setLoading(false);
        }
      );

    const unsubscribers = [
      subscribeToTenantSource("owner:tenants", "tenants", "ownerUid", ownerId),
      subscribeToTenantSource("owner:users", "users", "ownerUid", ownerId, true),
    ];
    properties.forEach((property) => {
      unsubscribers.push(
        subscribeToTenantSource(`property:${property.id}:tenants`, "tenants", "propertyId", property.id),
        subscribeToTenantSource(`property:${property.id}:users`, "users", "propertyId", property.id, true)
      );
    });

    return () => {
      active = false;
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, [properties]);

  // Curfew logs (written by the caretaker). Only tonight's and last night's
  // checks are needed, so only those are read: the log grows every night and
  // reading all of it would slow the page down over time.
  // Failing to read them must not break the list.
  useEffect(() => {
    if (!auth.currentUser) return undefined;
    const nights = [dayKey(today), dayKey(new Date(today.getTime() - DAY_MS))];
    const unsubscribe = onSnapshot(
      query(collection(db, "occupancy_logs"), where("ownerUid", "==", auth.currentUser.uid), where("date", "in", nights)),
      (snapshot) => {
        const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        list.sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
        setLogs(list);
      },
      (error) => {
        console.warn("Curfew logs unavailable:", error?.code || error);
        setLogs([]);
      }
    );
    return () => unsubscribe();
  }, [today]);

  // Payments: only this month's are needed for the rent column, so only this
  // month's are read (all-time payments grow every month). Every screen that
  // records a payment saves the month it covers as periodMonth, e.g. "October 2026".
  useEffect(() => {
    if (!auth.currentUser) return undefined;
    const period = `${MONTHS[today.getMonth()]} ${today.getFullYear()}`;
    const unsubscribe = onSnapshot(
      query(collection(db, "payments"), where("ownerUid", "==", auth.currentUser.uid), where("periodMonth", "==", period)),
      (snapshot) => setPayments(snapshot.docs.map((d) => normalizePayment({ id: d.id, ...d.data() }))),
      (error) => console.error("Error fetching payments:", error)
    );
    return () => unsubscribe();
  }, [today]);

  // =========================================================
  // DERIVED: one enriched row per tenant
  // =========================================================
  const propertyById = useMemo(() => {
    const map = new Map();
    properties.forEach((p) => {
      map.set(p.id, p);
      if (p.name) map.set(p.name, p); // very old records stored the name
    });
    return map;
  }, [properties]);

  const rows = useMemo(() => {
    const paymentsByTenant = new Map();
    payments.forEach((p) => {
      if (!p.tenantId) return;
      if (!paymentsByTenant.has(p.tenantId)) paymentsByTenant.set(p.tenantId, []);
      paymentsByTenant.get(p.tenantId).push(p);
    });

    const recentDays = new Set([dayKey(today), dayKey(new Date(today.getTime() - DAY_MS))]);
    const latestLogByProperty = new Map();
    logs.forEach((log) => {
      if (!latestLogByProperty.has(log.propertyId)) latestLogByProperty.set(log.propertyId, log);
    });

    return tenants.map((t) => {
      const status = normalizeStatus(t.status);
      const property = propertyById.get(t.propertyId) || null;
      const tenantPayments = [...(paymentsByTenant.get(t.uid) || []), ...(t.uid !== t.id ? paymentsByTenant.get(t.id) || [] : [])];
      const rent = rentStatusOf(t, tenantPayments, today);
      const lease = leaseFlagOf(t, today);

      // out / late on the property's latest curfew check (tonight or last night)
      const log = latestLogByProperty.get(t.propertyId);
      const curfewStatus = log && recentDays.has(log.date) ? (log.entries?.[t.uid] || log.entries?.[t.id])?.status : null;
      const curfew = curfewStatus === "out" || curfewStatus === "late" ? curfewStatus : null;

      const current = status !== "Inactive";
      const flags = {
        overdue: current && rent.key === "overdue",
        review: current && rent.key === "review",
        lease: Boolean(lease),
        pending: status === "Pending",
        noRoom: current && !t.roomId,
        curfew: curfew === "out",
      };

      return {
        t,
        key: tenantKey(t),
        name: displayNameOf(t),
        status,
        property,
        propertyName: property ? property.propertyName || property.name || "Unnamed Property" : "",
        rent,
        lease,
        curfew,
        flags,
      };
    });
  }, [tenants, payments, logs, propertyById, today]);

  const attentionCounts = useMemo(() => {
    const counts = {};
    ATTENTION.forEach((a) => {
      counts[a.key] = rows.filter((r) => r.flags[a.key]).length;
    });
    return counts;
  }, [rows]);
  const attentionShown = ATTENTION.filter((a) => attentionCounts[a.key] > 0);

  const hasUnlinked = rows.some((r) => !r.property);
  const statusCount = (s) => (s === "All" ? rows.length : rows.filter((r) => r.status === s).length);

  // Header numbers. "Payable" = current tenants who owe rent this month
  // (not those with no rent set, a lease that ended, or a first due date next month).
  const currentRows = rows.filter((r) => r.status !== "Inactive");
  const payable = currentRows.filter((r) => ["paid", "review", "due", "overdue"].includes(r.rent.key));
  const paidCount = payable.filter((r) => r.rent.key === "paid").length;
  const unpaidCount = payable.length - paidCount;
  const collectedPct = payable.length ? Math.round((paidCount / payable.length) * 100) : 0;
  const headerTiles = [
    { label: "Current tenants", icon: <PeopleOutlineIcon />, value: currentRows.length, suffix: rows.length > currentRows.length ? `+${rows.length - currentRows.length} former` : "" },
    { label: `Paid for ${MONTHS[today.getMonth()]}`, icon: <PaymentsOutlinedIcon />, value: paidCount, suffix: `/ ${payable.length}` },
    { label: "Still unpaid", icon: <PendingActionsOutlinedIcon />, value: unpaidCount, accent: unpaidCount > 0 },
    { label: "Rent collected", icon: <PieChartOutlineRoundedIcon />, value: `${collectedPct}%`, squares: true, pct: collectedPct },
  ];

  // =========================================================
  // FILTER + SORT
  // =========================================================
  const term = searchQuery.trim().toLowerCase();
  const visible = rows
    .filter((r) => {
      if (attention && !r.flags[attention]) return false;
      if (statusFilter !== "All" && r.status !== statusFilter) return false;
      if (propertyFilter === "unlinked" ? r.property : propertyFilter !== "all" && r.property?.id !== propertyFilter) return false;
      if (!term) return true;
      const haystack = [r.name, r.t.email, r.t.phone, r.t.roomId, r.t.bedId, r.propertyName].filter(Boolean).join(" ").toLowerCase();
      return haystack.includes(term);
    })
    .sort((a, b) => {
      // former tenants always sink to the bottom
      const inactive = Number(a.status === "Inactive") - Number(b.status === "Inactive");
      if (inactive) return inactive;
      if (sortBy === "rent") return a.rent.rank - b.rent.rank || a.name.localeCompare(b.name);
      if (sortBy === "property") {
        return (
          a.propertyName.localeCompare(b.propertyName) ||
          String(a.t.roomId || "").localeCompare(String(b.t.roomId || ""), undefined, { numeric: true }) ||
          a.name.localeCompare(b.name)
        );
      }
      return a.name.localeCompare(b.name);
    });

  const isFiltering = Boolean(term) || statusFilter !== "All" || propertyFilter !== "all" || Boolean(attention);

  // Draw the list in batches so hundreds of tenants stay fast. Changing any
  // filter starts again from the first batch.
  const filterKey = [term, statusFilter, propertyFilter, attention, sortBy].join("|");
  const [page, setPage] = useState({ key: "", count: PAGE_SIZE });
  const shownCount = page.key === filterKey ? page.count : PAGE_SIZE;
  const shown = visible.slice(0, shownCount);
  const remaining = visible.length - shown.length;
  const clearFilters = () => {
    setSearchQuery("");
    setStatusFilter("All");
    setPropertyFilter("all");
    setAttention(null);
  };

  // =========================================================
  // ONE TENANT ROW
  // =========================================================
  const renderRow = (r) => {
    const { t } = r;
    const roomText = t.roomId ? `Room ${t.roomId}${t.bedId ? ` · ${String(t.bedId).startsWith("Bed") ? t.bedId : `Bed ${t.bedId}`}` : ""}` : "";
    const contact = t.phone || t.email || "No contact details";
    const flagChips = (
      <>
        {r.curfew && (
          <Chip
            size="small"
            icon={<ScheduleIcon />}
            label={r.curfew === "out" ? "Out past curfew" : "Late"}
            color={r.curfew === "out" ? "error" : "warning"}
            sx={{ height: 22, fontWeight: 700, "& .MuiChip-icon": { fontSize: 14 } }}
          />
        )}
        {r.lease && (
          <Chip
            size="small"
            icon={<EventBusyOutlinedIcon />}
            label={r.lease.label}
            sx={{ height: 22, fontWeight: 700, color: "warning.dark", bgcolor: (th) => alpha(th.palette.warning.main, 0.12), "& .MuiChip-icon": { fontSize: 14, color: "inherit" } }}
          />
        )}
      </>
    );
    const place = (
      <>
        <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
          {r.propertyName || <Box component="span" sx={{ color: "warning.dark" }}>Not linked to a property</Box>}
        </Typography>
        <Typography variant="caption" noWrap component="div" sx={{ color: roomText ? "text.secondary" : "warning.dark", fontWeight: roomText ? 400 : 700 }}>
          {roomText || "No room"}
        </Typography>
      </>
    );

    return (
      <Box
        key={r.key}
        component="button"
        type="button"
        onClick={() => navigate(`/owner/tenants/${t.id}`)}
        aria-label={`Open ${r.name}`}
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "minmax(0, 1fr) auto", md: COLUMNS },
          alignItems: "center",
          columnGap: 2,
          rowGap: 1,
          width: "100%",
          textAlign: "left",
          font: "inherit",
          color: "inherit",
          bgcolor: "transparent",
          border: 0,
          cursor: "pointer",
          px: { xs: 2, sm: 2.5 },
          py: 1.5,
          opacity: r.status === "Inactive" ? 0.65 : 1,
          transition: "background-color .15s ease",
          "&:hover, &:focus-visible": { bgcolor: "action.hover", outline: "none" },
          "&:hover .kk-chev, &:focus-visible .kk-chev": { color: "primary.main", transform: "translateX(2px)" },
        }}
      >
        {/* Tenant */}
        <Box sx={{ ...row, gap: 1.5, minWidth: 0 }}>
          <Avatar
            src={t.idPhotoUrl || undefined}
            alt=""
            sx={{ width: 40, height: 40, fontFamily: HEAD, fontSize: "0.85rem", fontWeight: 800, bgcolor: r.status === "Inactive" ? "action.selected" : "primary.main", color: "#fff" }}
          >
            {initialsOf(r.name)}
          </Avatar>
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontWeight: 700, fontSize: "0.92rem" }} noWrap>
              {r.name}
            </Typography>
            <Typography variant="caption" color="text.secondary" noWrap component="div">
              {contact}
            </Typography>
            {(r.curfew || r.lease) && <Box sx={{ display: { xs: "none", md: "flex" }, gap: 0.5, flexWrap: "wrap", mt: 0.5 }}>{flagChips}</Box>}
          </Box>
        </Box>

        {/* Phones: status top right */}
        <Box sx={{ display: { xs: "flex", md: "none" }, alignItems: "center", gap: 0.25 }}>
          <Pill label={r.status} tone={STATUS_TONE[r.status]} />
          <ChevronRightIcon className="kk-chev" sx={{ color: "text.disabled", transition: "all .15s ease" }} />
        </Box>

        {/* Phones: where they live + rent + flags, under the name */}
        <Box sx={{ display: { xs: "flex", md: "none" }, gridColumn: "1 / -1", pl: "52px", flexDirection: "column", gap: 0.75, minWidth: 0 }}>
          <Box sx={{ minWidth: 0 }}>{place}</Box>
          <Box sx={{ display: "flex", gap: 0.5, flexWrap: "wrap", alignItems: "center" }}>
            <Pill label={r.rent.label} tone={r.rent.tone} />
            {flagChips}
          </Box>
        </Box>

        {/* Laptops: property / room */}
        <Box sx={{ display: { xs: "none", md: "block" }, minWidth: 0 }}>{place}</Box>

        {/* Laptops: rent this month */}
        <Box sx={{ display: { xs: "none", md: "block" } }}>
          <Pill label={r.rent.label} tone={r.rent.tone} />
        </Box>

        {/* Laptops: status + chevron */}
        <Box sx={{ display: { xs: "none", md: "flex" }, alignItems: "center", gap: 0.25, justifyContent: "flex-end" }}>
          <Pill label={r.status} tone={STATUS_TONE[r.status]} />
          <ChevronRightIcon className="kk-chev" sx={{ color: "text.disabled", transition: "all .15s ease" }} />
        </Box>
      </Box>
    );
  };

  const columnHeader = (
    <Box
      sx={{
        display: { xs: "none", md: "grid" },
        gridTemplateColumns: COLUMNS,
        columnGap: 2,
        px: 2.5,
        py: 1.1,
        borderBottom: "1px solid",
        borderColor: "divider",
        "& > *": { fontWeight: 700, color: "text.secondary", fontSize: "0.72rem", letterSpacing: ".06em", textTransform: "uppercase" },
      }}
    >
      <Box>Tenant</Box>
      <Box>Property · room</Box>
      <Box>Rent · {MONTHS[today.getMonth()]}</Box>
      <Box sx={{ textAlign: "right", pr: 3.5 }}>Status</Box>
    </Box>
  );

  return (
    <Box sx={{ minWidth: 0, }}>
      {/* HEADER: same pattern as the Properties page — description + main
          action, then four stat tiles */}
      <Paper elevation={0} component="section" sx={{ ...panelSx, borderRadius: R.xl, position: "relative", overflow: "hidden", p: { xs: 2, sm: 3 }, mb: { xs: 2, sm: 2.5 } }}>
        <Box aria-hidden sx={{ position: "absolute", top: -180, right: -120, width: 380, height: 380, borderRadius: "50%", background: "rgba(255,69,0,.10)", filter: "blur(70px)", pointerEvents: "none" }} />

        <Box sx={{ position: "relative", display: "flex", flexDirection: { xs: "column", sm: "row" }, alignItems: { xs: "stretch", sm: "center" }, justifyContent: "space-between", gap: { xs: 1.5, sm: 2 }, mb: { xs: 2, sm: 2.5 } }}>
          <Typography color="text.secondary" sx={{ minWidth: 0, fontSize: { xs: 14, sm: 15 } }}>
            View and manage tenants across your properties
          </Typography>
          <Button
            variant="contained"
            startIcon={<PersonAddOutlinedIcon />}
            onClick={() => navigate("/owner/tenants/register")}
            sx={{ flexShrink: 0, fontWeight: 700, borderRadius: R.sm, minHeight: 44, boxShadow: "0 10px 22px -14px rgba(255,69,0,.9)" }}
          >
            Register tenant
          </Button>
        </Box>

        <Box sx={{ position: "relative", display: "grid", gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", md: "repeat(4, minmax(0, 1fr))" }, gap: { xs: 1, sm: 1.5 } }}>
          {headerTiles.map((t) => (
            <Box
              key={t.label}
              sx={{ minWidth: 0, display: "flex", alignItems: "flex-start", gap: 1.25, p: { xs: 1.25, sm: 1.75 }, borderRadius: R.md, bgcolor: (th) => alpha(th.palette.background.paper, 0.55) }}
            >
              <Box sx={{ width: { xs: 32, sm: 38 }, height: { xs: 32, sm: 38 }, flexShrink: 0, borderRadius: R.sm, display: "grid", placeItems: "center", bgcolor: "#fff", color: "primary.main", "& svg": { fontSize: { xs: 18, sm: 20 } } }}>
                {t.icon}
              </Box>
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Typography variant="caption" color="text.secondary" noWrap sx={{ fontWeight: 600, display: "block" }}>
                  {t.label}
                </Typography>
                <Typography noWrap sx={{ fontFamily: HEAD, fontWeight: 800, letterSpacing: "-0.02em", fontSize: { xs: "1.2rem", sm: "1.45rem" }, lineHeight: 1.2, color: t.accent ? "primary.main" : "text.primary" }}>
                  {loading ? "–" : t.value}
                  {!loading && t.suffix && (
                    <Box component="span" sx={{ fontWeight: 600, fontSize: "0.62em", color: "text.secondary" }}>
                      {" "}{t.suffix}
                    </Box>
                  )}
                </Typography>
                {t.squares && !loading && <MiniSquares pct={t.pct} />}
              </Box>
            </Box>
          ))}
        </Box>
      </Paper>

      {/* NEEDS ATTENTION: one-tap filters for what the owner should act on */}
      {!loading && rows.length > 0 && (
        <Box sx={{ ...row, flexWrap: "wrap", gap: 1, mb: { xs: 2, sm: 2.5 } }}>
          <Typography variant="caption" sx={{ fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "text.secondary", mr: 0.5 }}>
            Needs attention
          </Typography>
          {attentionShown.length === 0 ? (
            <Box sx={{ ...row, gap: 0.75, color: "success.dark" }}>
              <CheckCircleOutlineIcon sx={{ fontSize: 18 }} />
              <Typography variant="body2" sx={{ fontWeight: 700 }}>
                Nothing right now
              </Typography>
            </Box>
          ) : (
            attentionShown.map((a) => {
              const on = attention === a.key;
              return (
                <Box
                  key={a.key}
                  component="button"
                  type="button"
                  aria-pressed={on}
                  onClick={() => setAttention(on ? null : a.key)}
                  sx={{
                    ...row,
                    gap: 0.75,
                    height: 34,
                    pl: 1,
                    pr: 1.25,
                    borderRadius: 99,
                    cursor: "pointer",
                    fontFamily: HEAD,
                    fontWeight: 700,
                    fontSize: 13,
                    border: "1px solid",
                    borderColor: (t) => (on ? t.palette[a.tone].main : alpha(t.palette[a.tone].main, 0.3)),
                    bgcolor: (t) => (on ? t.palette[a.tone].main : alpha(t.palette[a.tone].main, 0.08)),
                    color: (t) => (on ? "#fff" : t.palette[a.tone].dark),
                    transition: "background-color .15s, color .15s, border-color .15s",
                    "& svg": { fontSize: 17 },
                    "&:hover": { borderColor: (t) => t.palette[a.tone].main },
                    "&:focus-visible": { outline: "2px solid", outlineColor: "primary.main", outlineOffset: 2 },
                  }}
                >
                  {a.icon}
                  {a.label}
                  <Box component="span" sx={{ ml: 0.25, px: 0.75, borderRadius: 99, fontSize: 12, bgcolor: on ? "rgba(255,255,255,.25)" : "rgba(255,255,255,.7)" }}>
                    {attentionCounts[a.key]}
                  </Box>
                </Box>
              );
            })
          )}
        </Box>
      )}

      {/* TOOLBAR: search, property, status, sort */}
      {!loading && rows.length > 0 && (
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", md: "minmax(0, 1fr) auto auto auto" }, gap: 1.25, alignItems: "center", mb: { xs: 2, sm: 2.5 } }}>
          <Paper
            elevation={0}
            sx={{
              ...panelSx,
              ...row,
              gridColumn: { xs: "1 / -1", md: "auto" },
              gap: 1,
              px: 1.5,
              height: 44,
              minWidth: 0,
              borderRadius: R.sm,
              transition: "border-color .15s, box-shadow .15s",
              "&:focus-within": { borderColor: "primary.main", boxShadow: "0 0 0 3px rgba(255,69,0,.12)" },
            }}
          >
            <SearchIcon sx={{ color: "text.secondary" }} />
            <InputBase
              fullWidth
              placeholder="Search name, phone, email or room"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              inputProps={{ "aria-label": "Search tenants" }}
            />
            {searchQuery && (
              <IconButton size="small" aria-label="Clear search" onClick={() => setSearchQuery("")}>
                <CloseIcon fontSize="small" />
              </IconButton>
            )}
          </Paper>

          {(properties.length > 1 || hasUnlinked) && (
            <TextField select size="small" value={propertyFilter} onChange={(e) => setPropertyFilter(e.target.value)} sx={{ ...fieldSx, minWidth: { md: 190 } }} slotProps={{ htmlInput: { "aria-label": "Property" } }}>
              <MenuItem value="all">All properties</MenuItem>
              {[...properties]
                .sort((a, b) => String(a.propertyName || "").localeCompare(String(b.propertyName || "")))
                .map((p) => (
                  <MenuItem key={p.id} value={p.id}>{p.propertyName || p.name || "Unnamed Property"}</MenuItem>
                ))}
              {hasUnlinked && <MenuItem value="unlinked">Not linked to a property</MenuItem>}
            </TextField>
          )}

          <TextField select size="small" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} sx={{ ...fieldSx, minWidth: { md: 150 } }} slotProps={{ htmlInput: { "aria-label": "Status" } }}>
            {STATUS_FILTERS.map((s) => (
              <MenuItem key={s} value={s}>
                {s === "All" ? "All statuses" : s} ({statusCount(s)})
              </MenuItem>
            ))}
          </TextField>

          <TextField select size="small" value={sortBy} onChange={(e) => setSortBy(e.target.value)} sx={{ ...fieldSx, minWidth: { md: 170 }, gridColumn: { xs: properties.length > 1 || hasUnlinked ? "1 / -1" : "auto", md: "auto" } }} slotProps={{ htmlInput: { "aria-label": "Sort by" } }}>
            <MenuItem value="name">Sort: Name</MenuItem>
            <MenuItem value="rent">Sort: Rent status</MenuItem>
            <MenuItem value="property">Sort: Property & room</MenuItem>
          </TextField>
        </Box>
      )}

      {/* LIST */}
      {loading ? (
        <Paper elevation={0} sx={{ ...panelSx, p: 2 }}>
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} variant="rounded" height={56} sx={{ mt: i ? 1 : 0, borderRadius: R.sm }} />
          ))}
        </Paper>
      ) : rows.length === 0 ? (
        <Paper elevation={0} sx={{ ...panelSx, borderStyle: "dashed", py: 7, px: 3, textAlign: "center" }}>
          <Box sx={{ width: 64, height: 64, borderRadius: R.md, mx: "auto", mb: 2, display: "grid", placeItems: "center", bgcolor: "rgba(255, 69, 0, 0.10)" }}>
            <PeopleOutlineIcon sx={{ fontSize: 32, color: "primary.main" }} />
          </Box>
          <Typography sx={{ fontFamily: HEAD, fontWeight: 800, mb: 0.5 }}>No tenants enrolled yet</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
            Register your first tenant to assign them a room and track payments.
          </Typography>
          <Button variant="contained" startIcon={<PersonAddOutlinedIcon />} onClick={() => navigate("/owner/tenants/register")} sx={{ fontWeight: 700, borderRadius: R.sm }}>
            Register tenant
          </Button>
        </Paper>
      ) : (
        <>
          {isFiltering && (
            <Box sx={{ ...row, justifyContent: "space-between", gap: 1, mb: 1.25 }}>
              <Typography variant="body2" color="text.secondary">
                Showing {visible.length} of {rows.length} tenants
              </Typography>
              <Button size="small" onClick={clearFilters} sx={{ fontWeight: 700 }}>
                Clear filters
              </Button>
            </Box>
          )}

          <Paper elevation={0} sx={{ ...panelSx, overflow: "hidden" }}>
            {visible.length === 0 ? (
              <Box sx={{ py: 5, px: 2, textAlign: "center" }}>
                <Typography sx={{ fontWeight: 700 }}>No tenants match</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  Try a different search or filter.
                </Typography>
              </Box>
            ) : (
              <>
                {columnHeader}
                {shown.map((r, i) => (
                  <Fragment key={r.key}>
                    {i > 0 && <Divider />}
                    {renderRow(r)}
                  </Fragment>
                ))}
              </>
            )}
          </Paper>

          {remaining > 0 && (
            <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 0.5, mt: 2 }}>
              <Button
                variant="outlined"
                onClick={() => setPage({ key: filterKey, count: shownCount + PAGE_SIZE })}
                sx={{ fontWeight: 700, borderRadius: R.sm, minWidth: 200 }}
              >
                Show {Math.min(remaining, PAGE_SIZE)} more
              </Button>
              <Typography variant="caption" color="text.secondary">
                Showing {shown.length} of {visible.length}
              </Typography>
            </Box>
          )}
        </>
      )}

    </Box>
  );
}
