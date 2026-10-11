// src/pages/owner/tenants/TenantList.jsx

import React, { useState, useEffect } from "react";
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
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from "@mui/material";
import { alpha } from "@mui/material/styles";

import PersonAddOutlinedIcon from "@mui/icons-material/PersonAddOutlined";
import ApartmentOutlinedIcon from "@mui/icons-material/ApartmentOutlined";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import SearchIcon from "@mui/icons-material/Search";
import CloseIcon from "@mui/icons-material/Close";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import PeopleOutlineIcon from "@mui/icons-material/PeopleOutlined";
import ScheduleIcon from "@mui/icons-material/Schedule";

import {
  collection,
  query,
  where,
  onSnapshot,
} from "firebase/firestore";

import { auth, db } from "../../../config/firebase";
import { normalizePayment } from "../../../utils/normalizePayment";
import { formatPropertyAddress } from "../../../utils/formatPropertyAddress";

const row = { display: "flex", alignItems: "center" };

// Single source of truth for a tenant status, so grouped and unassigned
// tenants are always colored the same way.
const getTenantStatusChip = (status) => {
  const label = status || "Active";
  if (label === "Pending Onboarding") return { label, tone: "warning" };
  if (label === "Inactive") return { label, tone: "default" };
  if (label === "Active") return { label, tone: "success" };
  return { label, tone: "default" };
};

const STATUS_FILTERS = ["All", "Active", "Pending Onboarding", "Inactive"];

// Soft tinted pill (reads calmer than a filled chip, and stays legible on white)
function StatusPill({ status }) {
  const { label, tone } = getTenantStatusChip(status);
  return (
    <Chip
      label={label === "Pending Onboarding" ? "Pending" : label}
      size="small"
      sx={{
        fontWeight: 700,
        border: "none",
        bgcolor: (t) =>
          tone === "default" ? alpha(t.palette.text.primary, 0.08) : alpha(t.palette[tone].main, 0.12),
        color: (t) => (tone === "default" ? t.palette.text.secondary : t.palette[tone].dark),
      }}
    />
  );
}

function SummaryStrip({ items }) {
  return (
    <Paper
      elevation={0}
      sx={{
        bgcolor: "background.default",
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 3,
        overflow: "hidden",
        display: "grid",
        gridTemplateColumns: { xs: "repeat(2, 1fr)", md: `repeat(${items.length}, 1fr)` },
        mb: { xs: 2, sm: 2.5 },
      }}
    >
      {items.map((item, i) => (
        <Box
          key={item.label}
          sx={{
            px: { xs: 1.75, sm: 2.5 },
            py: { xs: 1.25, sm: 1.75 },
            minWidth: 0,
            borderTop: { xs: i > 1 ? "1px solid" : "none", md: "none" },
            borderLeft: { xs: i % 2 === 1 ? "1px solid" : "none", md: i === 0 ? "none" : "1px solid" },
            borderColor: "divider",
          }}
        >
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }} noWrap component="div">
            {item.label}
          </Typography>
          <Typography noWrap sx={{ fontFamily: '"Inter", sans-serif', fontWeight: 800, fontSize: { xs: "1.2rem", sm: "1.45rem" }, lineHeight: 1.25, color: item.color }}>
            {item.value}
          </Typography>
        </Box>
      ))}
    </Paper>
  );
}

const groupShellSx = {
  bgcolor: "background.default",
  border: "1px solid",
  borderColor: "divider",
  borderRadius: "12px !important",
  overflow: "hidden",
  "&:before": { display: "none" },
};

export default function TenantList() {
  const navigate = useNavigate();

  const [tenants, setTenants] = useState([]);
  const [properties, setProperties] = useState([]);
  const [payments, setPayments] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState([]);

  // =========================================================
  // FORMAT ADDRESS HELPER (Fixes object rendering crash)
  // =========================================================
  const formatAddress = (addr) => {
    if (!addr) return "";
    if (typeof addr === "string") return addr;

    return [
      addr.street,
      addr.barangay,
      addr.cityMunicipality,
      addr.province,
      addr.region,
    ]
      .filter(Boolean)
      .join(", ");
  };

  // =========================================================
  // LOAD PROPERTIES
  // =========================================================
  useEffect(() => {
    if (!auth.currentUser) return;

    const q = query(
      collection(db, "properties"),
      where("ownerUid", "==", auth.currentUser.uid)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const propData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setProperties(propData);
      },
      (error) => {
        console.error("Error fetching properties:", error);
      }
    );

    return () => unsubscribe();
  }, []);

  // =========================================================
  // LOAD TENANTS
  // =========================================================
  useEffect(() => {
    if (!auth.currentUser) {
      setLoading(false);
      return;
    }

    const ownerId = auth.currentUser.uid;
    const tenantSources = new Map();
    let active = true;

    const publishTenants = () => {
      const tenantsById = new Map();
      tenantSources.forEach((sourceTenants) => {
        sourceTenants.forEach((tenant) => {
          const tenantId = tenant.uid || tenant.id;
          tenantsById.set(tenantId, {
            ...(tenantsById.get(tenantId) || {}),
            ...tenant,
          });
        });
      });
      if (active) {
        setTenants([...tenantsById.values()]);
        setLoading(false);
      }
    };

    const subscribeToTenantSource = (sourceId, collectionName, field, value, usersOnly = false) =>
      onSnapshot(
        query(collection(db, collectionName), where(field, "==", value)),
        (snapshot) => {
          const records = snapshot.docs
            .map((tenantDoc) => ({ id: tenantDoc.id, ...tenantDoc.data() }))
            .filter((tenant) => !usersOnly || tenant.role === "tenant");
          tenantSources.set(sourceId, records);
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

  // =========================================================
  // LOAD CURFEW LOGS (written by the caretaker). Used only to flag who is
  // out past curfew; failing to read them must not break the directory.
  // =========================================================
  useEffect(() => {
    if (!auth.currentUser) return;

    const unsubscribe = onSnapshot(
      query(collection(db, "occupancy_logs"), where("ownerUid", "==", auth.currentUser.uid)),
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
  }, []);

  // =========================================================
  // LOAD PAYMENTS
  // =========================================================
  useEffect(() => {
    if (!auth.currentUser) return;

    const q = query(
      collection(db, "payments"),
      where("ownerUid", "==", auth.currentUser.uid)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const paymentData = snapshot.docs.map((doc) => normalizePayment({
          id: doc.id,
          ...doc.data(),
        }));

        setPayments(paymentData);
      },
      (error) => {
        console.error("Error fetching payments:", error);
      }
    );

    return () => unsubscribe();
  }, []);

  // =========================================================
  // GET PAYMENT DATE & FORMAT HELPERS
  // =========================================================
  const getPaymentDate = (payment) => {
    const dateValue = payment?.paymentDate || payment?.createdAt;
    if (!dateValue) return null;

    if (typeof dateValue.toDate === "function") {
      return dateValue.toDate();
    }
    if (dateValue instanceof Date) {
      return dateValue;
    }

    const parsedDate = new Date(dateValue);
    if (isNaN(parsedDate.getTime())) return null;

    return parsedDate;
  };

  const formatPaymentDate = (payment) => {
    const date = getPaymentDate(payment);
    if (!date) return "No payment";

    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const getTenantPayments = (tenantId) => {
    return payments
      .filter((payment) => payment.tenantId === tenantId)
      .sort((a, b) => {
        const dateA = getPaymentDate(a);
        const dateB = getPaymentDate(b);

        if (!dateA && !dateB) return 0;
        if (!dateA) return 1;
        if (!dateB) return -1;

        return dateB.getTime() - dateA.getTime();
      });
  };

  const getLastPayment = (tenantId) => {
    const tenantPayments = getTenantPayments(tenantId);
    if (tenantPayments.length === 0) return null;
    return tenantPayments[0];
  };

  // =========================================================
  // CURFEW FLAGS — marked out/late on the property's latest check
  // (tonight or last night). The full history is on each tenant's page.
  // =========================================================
  const dayKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const recentKeys = new Set([dayKey(new Date()), dayKey(new Date(Date.now() - 86400000))]);
  const latestLogByProperty = new Map();
  logs.forEach((log) => {
    if (!latestLogByProperty.has(log.propertyId)) latestLogByProperty.set(log.propertyId, log);
  });
  const getCurfewFlag = (tenantId, propertyId) => {
    const log = latestLogByProperty.get(propertyId);
    if (!log || !recentKeys.has(log.date)) return null;
    const status = log.entries?.[tenantId]?.status;
    return status === "out" || status === "late" ? status : null;
  };
  const outPastCurfew = tenants.filter((t) => getCurfewFlag(t.id, t.propertyId) === "out");

  // =========================================================
  // SEARCH + STATUS FILTER
  // =========================================================
  const filteredTenants = tenants.filter((t) => {
    const name = t.fullName || t.name || "";
    const email = t.email || "";
    const room = String(t.roomId || "");
    const term = searchQuery.trim().toLowerCase();

    const matchesSearch =
      !term ||
      name.toLowerCase().includes(term) ||
      email.toLowerCase().includes(term) ||
      room.toLowerCase().includes(term);

    const matchesStatus = statusFilter === "All" || getTenantStatusChip(t.status).label === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const isFiltering = Boolean(searchQuery.trim()) || statusFilter !== "All";

  // =========================================================
  // GROUP TENANTS BY PROPERTY
  // =========================================================
  const groupedByProperty = properties.reduce((acc, property) => {
    acc[property.id] = {
      propertyName: property.name || property.propertyName || "Unnamed Property",
      propertyAddress: formatPropertyAddress(property),
      tenants: filteredTenants.filter(
        (t) => t.propertyId === property.id || t.propertyId === property.name
      ),
    };
    return acc;
  }, {});

  // Catch tenants that aren't tied to any loaded property ID/name
  const assignedPropertyIds = new Set(properties.map((p) => p.id));
  const assignedPropertyNames = new Set(properties.map((p) => p.name));

  const unassignedTenants = filteredTenants.filter(
    (t) =>
      !t.propertyId ||
      (!assignedPropertyIds.has(t.propertyId) && !assignedPropertyNames.has(t.propertyId))
  );


  // =========================================================
  // SHARED ROW RENDERER — one tenant, one tappable row. Used for the
  // per-property groups and the unassigned group so they never drift apart.
  // =========================================================
  const renderTenantRow = (t) => {
    const lastPayment = getLastPayment(t.id);
    const displayName = t.fullName || t.name || "Unnamed Tenant";
    const secondaryLine =
      t.email || (t.idType ? t.idType.replace("_", " ").toUpperCase() : "No ID provided");
    const roomText = t.roomId ? `${t.roomId}${t.bedId ? ` · Bed ${t.bedId}` : ""}` : "";
    const paidText = lastPayment ? formatPaymentDate(lastPayment) : "No payments yet";
    const curfewFlag = getCurfewFlag(t.id, t.propertyId);

    return (
      <Box
        key={t.id}
        component="button"
        type="button"
        onClick={() => navigate(`/owner/tenants/${t.id}`)}
        aria-label={`Open ${displayName}`}
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "minmax(0, 1fr) auto", md: "minmax(0, 1.7fr) minmax(0, 1fr) minmax(0, 1fr) 128px" },
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
          px: { xs: 2, sm: 3 },
          py: { xs: 1.5, md: 1.75 },
          transition: "background-color .15s ease",
          "&:hover, &:focus-visible": { bgcolor: "action.hover", outline: "none" },
          "&:hover .kk-chev, &:focus-visible .kk-chev": { color: "primary.main", transform: "translateX(2px)" },
        }}
      >
        {/* Identity */}
        <Box sx={{ ...row, gap: 1.5, minWidth: 0 }}>
          <Avatar
            src={t.idPhotoUrl || ""}
            alt=""
            sx={{ width: 40, height: 40, fontSize: "0.95rem", fontWeight: 700, bgcolor: "rgba(255, 69, 0, 0.12)", color: "primary.main" }}
          >
            {displayName.charAt(0).toUpperCase()}
          </Avatar>
          <Box sx={{ minWidth: 0 }}>
            <Box sx={{ ...row, gap: 0.75, minWidth: 0 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 700 }} noWrap>
                {displayName}
              </Typography>
              {curfewFlag && (
                <Chip
                  size="small"
                  icon={<ScheduleIcon />}
                  label={curfewFlag === "out" ? "Out past curfew" : "Late"}
                  color={curfewFlag === "out" ? "error" : "warning"}
                  sx={{ height: 22, fontWeight: 700, flexShrink: 0, "& .MuiChip-icon": { fontSize: 14 } }}
                />
              )}
            </Box>
            <Typography variant="caption" color="text.secondary" noWrap component="div">
              {secondaryLine}
            </Typography>
          </Box>
        </Box>

        {/* Phones: status on the right of the first line */}
        <Box sx={{ display: { xs: "flex", md: "none" }, alignItems: "center", gap: 0.5 }}>
          <StatusPill status={t.status} />
          <ChevronRightIcon className="kk-chev" sx={{ color: "text.disabled", transition: "all .15s ease" }} />
        </Box>

        {/* Phones: room + last payment on one quiet line */}
        <Box sx={{ display: { xs: "flex", md: "none" }, gridColumn: "1 / -1", alignItems: "center", gap: 1, flexWrap: "wrap", pl: "52px" }}>
          {roomText ? (
            <Typography variant="body2" sx={{ fontWeight: 600 }}>{roomText}</Typography>
          ) : (
            <Chip label="No room" size="small" variant="outlined" color="warning" sx={{ height: 22 }} />
          )}
          <Typography variant="body2" color="text.secondary">· Last paid {lastPayment ? paidText : "—"}</Typography>
        </Box>

        {/* Laptops: room */}
        <Box sx={{ display: { xs: "none", md: "block" }, minWidth: 0 }}>
          {roomText ? (
            <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>{roomText}</Typography>
          ) : (
            <Chip label="No room" size="small" variant="outlined" color="warning" />
          )}
        </Box>

        {/* Laptops: last payment */}
        <Box sx={{ display: { xs: "none", md: "block" }, minWidth: 0 }}>
          <Typography variant="body2" color={lastPayment ? "text.primary" : "text.secondary"} noWrap>
            {paidText}
          </Typography>
        </Box>

        {/* Laptops: status + chevron */}
        <Box sx={{ display: { xs: "none", md: "flex" }, alignItems: "center", gap: 0.5, justifyContent: "flex-end" }}>
          <StatusPill status={t.status} />
          <ChevronRightIcon className="kk-chev" sx={{ color: "text.disabled", transition: "all .15s ease" }} />
        </Box>
      </Box>
    );
  };

  // Column labels, laptops only (phones read as cards, no table header needed)
  const columnHeader = (
    <Box
      sx={{
        display: { xs: "none", md: "grid" },
        gridTemplateColumns: "minmax(0, 1.7fr) minmax(0, 1fr) minmax(0, 1fr) 128px",
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
      <Box>ROOM</Box>
      <Box>LAST PAYMENT</Box>
      <Box sx={{ textAlign: "right", pr: 3 }}>STATUS</Box>
    </Box>
  );

  // Summary counts use ALL tenants (not the filtered list) so they stay stable while searching
  const countByStatus = (label) => tenants.filter((t) => getTenantStatusChip(t.status).label === label).length;
  const unassignedCount = tenants.filter((t) => !t.roomId).length;

  return (
    <Box sx={{ minWidth: 0 }}>
      {/* The top bar already says "Tenants", so the page only adds a one-line
          description and the primary action. */}
      <Box sx={{ ...row, justifyContent: "space-between", gap: 2, mb: { xs: 2, sm: 2.5 } }}>
        <Typography color="text.secondary" sx={{ minWidth: 0 }}>
          View and manage tenants across your properties
        </Typography>
        <Button
          variant="contained"
          startIcon={<PersonAddOutlinedIcon />}
          onClick={() => navigate("/owner/tenants/register")}
          sx={{ flexShrink: 0, fontWeight: 700, borderRadius: 2.5, display: { xs: "none", sm: "inline-flex" } }}
        >
          Register tenant
        </Button>
      </Box>

      {!loading && tenants.length > 0 && (
        <SummaryStrip
          items={[
            { label: "Tenants", value: tenants.length },
            { label: "Active", value: countByStatus("Active"), color: "success.main" },
            { label: "Pending onboarding", value: countByStatus("Pending Onboarding"), color: countByStatus("Pending Onboarding") > 0 ? "warning.main" : undefined },
            { label: "No room yet", value: unassignedCount, color: unassignedCount > 0 ? "warning.main" : undefined },
          ]}
        />
      )}

      {/* Curfew heads-up from the caretaker's latest check */}
      {!loading && outPastCurfew.length > 0 && (
        <Box
          sx={{
            ...row,
            alignItems: "flex-start",
            gap: 1.25,
            p: 1.5,
            mb: { xs: 2, sm: 2.5 },
            borderRadius: 3,
            border: "1px solid",
            borderColor: (t) => alpha(t.palette.error.main, 0.45),
            bgcolor: (t) => alpha(t.palette.error.main, 0.07),
          }}
        >
          <ScheduleIcon color="error" sx={{ mt: 0.25 }} />
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontWeight: 800, lineHeight: 1.25 }}>
              {outPastCurfew.length} {outPastCurfew.length === 1 ? "tenant is" : "tenants are"} out past curfew
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ overflowWrap: "anywhere" }}>
              {outPastCurfew.map((t) => t.fullName || t.name || "Tenant").join(", ")}
            </Typography>
          </Box>
        </Box>
      )}

      {/* Search + status filter */}
      {!loading && tenants.length > 0 && (
        <Box sx={{ mb: { xs: 2, sm: 2.5 } }}>
          <Paper
            elevation={0}
            sx={{ ...row, gap: 1, px: 1.5, bgcolor: "background.default", border: "1px solid", borderColor: "divider", borderRadius: 3, height: 46 }}
          >
            <SearchIcon sx={{ color: "text.secondary" }} />
            <InputBase
              fullWidth
              placeholder="Search name, email or room"
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

          <Box
            sx={{
              display: "flex",
              gap: 1,
              mt: 1.5,
              overflowX: "auto",
              mx: { xs: -2, sm: 0 },
              px: { xs: 2, sm: 0 },
              scrollbarWidth: "none",
              "&::-webkit-scrollbar": { display: "none" },
            }}
          >
            {STATUS_FILTERS.map((s) => (
              <Chip
                key={s}
                label={s === "Pending Onboarding" ? "Pending" : s}
                clickable
                onClick={() => setStatusFilter(s)}
                color={statusFilter === s ? "primary" : "default"}
                variant={statusFilter === s ? "filled" : "outlined"}
                sx={{ fontWeight: 700, flexShrink: 0, height: 34, borderRadius: 17 }}
              />
            ))}
          </Box>
        </Box>
      )}

      {/* DIRECTORY CONTENT */}
      {loading ? (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {[0, 1].map((i) => (
            <Paper key={i} elevation={0} sx={{ ...groupShellSx, p: 2 }}>
              <Skeleton width="40%" height={28} />
              <Skeleton variant="rounded" height={56} sx={{ mt: 1.5 }} />
              <Skeleton variant="rounded" height={56} sx={{ mt: 1 }} />
            </Paper>
          ))}
        </Box>
      ) : tenants.length === 0 ? (
        <Paper elevation={0} sx={{ ...groupShellSx, borderStyle: "dashed", py: 7, px: 3, textAlign: "center" }}>
          <Box sx={{ width: 64, height: 64, borderRadius: "50%", mx: "auto", mb: 2, ...row, justifyContent: "center", bgcolor: "rgba(255, 69, 0, 0.10)" }}>
            <PeopleOutlineIcon sx={{ fontSize: 32, color: "primary.main" }} />
          </Box>
          <Typography sx={{ fontWeight: 700, mb: 0.5 }}>No tenants enrolled yet</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
            Register your first tenant to assign them a room and track payments.
          </Typography>
          <Button variant="contained" startIcon={<PersonAddOutlinedIcon />} onClick={() => navigate("/owner/tenants/register")} sx={{ fontWeight: 700, borderRadius: 2.5 }}>
            Register tenant
          </Button>
        </Paper>
      ) : filteredTenants.length === 0 ? (
        <Paper elevation={0} sx={{ ...groupShellSx, py: 5, textAlign: "center" }}>
          <Typography sx={{ fontWeight: 700 }}>No tenants match</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Try a different search or filter.
          </Typography>
          <Button
            size="small"
            onClick={() => {
              setSearchQuery("");
              setStatusFilter("All");
            }}
            sx={{ mt: 1 }}
          >
            Clear filters
          </Button>
        </Paper>
      ) : (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {Object.entries(groupedByProperty).map(([propId, group], index) => {
            if (group.tenants.length === 0 && isFiltering) return null; // hide empty groups while filtering

            const formattedAddress = formatAddress(group.propertyAddress);
            const count = group.tenants.length;

            return (
              <Accordion
                // remount when filtering starts/stops so groups open to show matches
                key={`${propId}-${isFiltering}`}
                defaultExpanded={index === 0 || isFiltering}
                disableGutters
                elevation={0}
                sx={groupShellSx}
              >
                <AccordionSummary
                  expandIcon={<ExpandMoreIcon />}
                  sx={{ "& .MuiAccordionSummary-content": { alignItems: "center", my: 1.5, minWidth: 0 } }}
                >
                  <Box sx={{ ...row, gap: 1.5, minWidth: 0, flex: 1 }}>
                    <Box sx={{ width: 36, height: 36, borderRadius: 2, flexShrink: 0, ...row, justifyContent: "center", bgcolor: "rgba(255, 69, 0, 0.10)" }}>
                      <ApartmentOutlinedIcon color="primary" fontSize="small" />
                    </Box>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant="subtitle1" sx={{ fontWeight: 800, lineHeight: 1.25 }} noWrap>
                        {group.propertyName}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" noWrap component="div">
                        {count} {count === 1 ? "tenant" : "tenants"}
                        {formattedAddress ? ` · ${formattedAddress}` : ""}
                      </Typography>
                    </Box>
                  </Box>
                </AccordionSummary>

                <AccordionDetails sx={{ p: 0, borderTop: "1px solid", borderColor: "divider" }}>
                  {group.tenants.length === 0 ? (
                    <Typography variant="body2" color="text.secondary" sx={{ px: 3, py: 3, textAlign: "center" }}>
                      No tenants assigned to this property yet.
                    </Typography>
                  ) : (
                    <>
                      {columnHeader}
                      {group.tenants.map((t, i) => (
                        <React.Fragment key={t.id}>
                          {i > 0 && <Divider />}
                          {renderTenantRow(t)}
                        </React.Fragment>
                      ))}
                    </>
                  )}
                </AccordionDetails>
              </Accordion>
            );
          })}

          {/* Tenants not tied to any loaded property */}
          {unassignedTenants.length > 0 && (
            <Accordion
              key={`unassigned-${isFiltering}`}
              defaultExpanded={isFiltering}
              disableGutters
              elevation={0}
              sx={groupShellSx}
            >
              <AccordionSummary
                expandIcon={<ExpandMoreIcon />}
                sx={{ "& .MuiAccordionSummary-content": { alignItems: "center", my: 1.5, minWidth: 0 } }}
              >
                <Box sx={{ ...row, gap: 1.5, minWidth: 0, flex: 1 }}>
                  <Box sx={{ width: 36, height: 36, borderRadius: 2, flexShrink: 0, ...row, justifyContent: "center", bgcolor: (t) => alpha(t.palette.warning.main, 0.14) }}>
                    <ApartmentOutlinedIcon sx={{ color: "warning.dark" }} fontSize="small" />
                  </Box>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 800, lineHeight: 1.25 }} noWrap>
                      Unassigned / other
                    </Typography>
                    <Typography variant="caption" color="text.secondary" noWrap component="div">
                      {unassignedTenants.length} {unassignedTenants.length === 1 ? "tenant" : "tenants"} not linked to a property
                    </Typography>
                  </Box>
                </Box>
              </AccordionSummary>

              <AccordionDetails sx={{ p: 0, borderTop: "1px solid", borderColor: "divider" }}>
                {columnHeader}
                {unassignedTenants.map((t, i) => (
                  <React.Fragment key={t.id}>
                    {i > 0 && <Divider />}
                    {renderTenantRow(t)}
                  </React.Fragment>
                ))}
              </AccordionDetails>
            </Accordion>
          )}
        </Box>
      )}

      {/* Phone: floating register button so the primary action stays reachable */}
      <Button
        variant="contained"
        onClick={() => navigate("/owner/tenants/register")}
        startIcon={<PersonAddOutlinedIcon />}
        sx={{
          display: { xs: "inline-flex", sm: "none" },
          position: "fixed",
          right: 16,
          bottom: "calc(80px + env(safe-area-inset-bottom, 0px))",
          zIndex: (t) => t.zIndex.appBar - 1,
          borderRadius: 6,
          px: 2.5,
          py: 1.2,
          fontWeight: 700,
          boxShadow: 6,
        }}
      >
        Register
      </Button>
    </Box>
  );
}