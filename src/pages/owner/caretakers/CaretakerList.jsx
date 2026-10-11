// src/pages/owner/caretakers/CaretakerList.jsx

import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Typography,
  Paper,
  Chip,
  Avatar,
  Button,
  Alert,
  Divider,
  Skeleton,
  InputBase,
  IconButton,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import PersonAddAltOutlinedIcon from "@mui/icons-material/PersonAddAltOutlined";
import SearchIcon from "@mui/icons-material/Search";
import CloseIcon from "@mui/icons-material/Close";
import ApartmentOutlinedIcon from "@mui/icons-material/ApartmentOutlined";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import SupervisorAccountOutlinedIcon from "@mui/icons-material/SupervisorAccountOutlined";
import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
} from "firebase/firestore";
import { db } from "../../../config/firebase";
import { useAuth } from "../../../context/AuthContext";

const row = { display: "flex", alignItems: "center" };
const MAX_VISIBLE_PERMISSIONS = 2;
const COLS = "minmax(0, 1.6fr) minmax(0, 1.2fr) minmax(0, 1.5fr) 128px";

const PERMISSION_LABELS = {
  manageTenants: "Manage Tenants",
  logOccupancy: "Log Occupancy",
  handleReports: "Handle Reports",
  viewFinancials: "View Financials",
  modifyLayout: "Modify Layout",
};

const FILTERS = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "pending", label: "Pending" },
];

const isPending = (c) => Boolean(c.mustChangePassword);

const grantedLabels = (c) =>
  Object.entries(c.permissions || {})
    .filter(([, granted]) => granted)
    .map(([key]) => PERMISSION_LABELS[key] || key);

const groupShellSx = {
  bgcolor: "background.default",
  border: "1px solid",
  borderColor: "divider",
  borderRadius: "12px !important",
  overflow: "hidden",
  "&:before": { display: "none" },
};

// Soft tinted pill, same as the tenant list
function StatusPill({ pending }) {
  const tone = pending ? "warning" : "success";
  return (
    <Chip
      size="small"
      label={pending ? "Pending" : "Active"}
      sx={{
        fontWeight: 700,
        border: "none",
        bgcolor: (t) => alpha(t.palette[tone].main, 0.12),
        color: (t) => t.palette[tone].dark,
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
        gridTemplateColumns: `repeat(${items.length}, 1fr)`,
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
            borderLeft: i === 0 ? "none" : "1px solid",
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

function PermissionChips({ caretaker }) {
  const permissions = grantedLabels(caretaker);
  if (permissions.length === 0) {
    return <Typography variant="body2" color="text.secondary">None granted</Typography>;
  }
  const visible = permissions.slice(0, MAX_VISIBLE_PERMISSIONS);
  const extra = permissions.length - visible.length;
  return (
    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5 }}>
      {visible.map((label) => (
        <Chip key={label} size="small" label={label} sx={{ bgcolor: (t) => alpha(t.palette.text.primary, 0.06), fontWeight: 500 }} />
      ))}
      {extra > 0 && (
        <Chip size="small" label={`+${extra}`} sx={{ bgcolor: "rgba(255, 69, 0, 0.1)", color: "primary.main", fontWeight: 700 }} />
      )}
    </Box>
  );
}

function CaretakerRow({ caretaker, onOpen }) {
  const name = caretaker.name || "Unnamed Caretaker";
  const permissionCount = grantedLabels(caretaker).length;

  return (
    <Box
      component="button"
      type="button"
      onClick={onOpen}
      aria-label={`Manage ${name}`}
      sx={{
        display: "grid",
        gridTemplateColumns: { xs: "minmax(0, 1fr) auto", md: COLS },
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
        <Avatar sx={{ width: 40, height: 40, fontSize: "0.95rem", fontWeight: 700, bgcolor: "rgba(255, 69, 0, 0.12)", color: "primary.main" }}>
          {name.charAt(0).toUpperCase()}
        </Avatar>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }} noWrap>
            {name}
          </Typography>
          <Typography variant="caption" color="text.secondary" noWrap component="div">
            {caretaker.email || "No email"}
          </Typography>
        </Box>
      </Box>

      {/* Phones: status + chevron */}
      <Box sx={{ display: { xs: "flex", md: "none" }, alignItems: "center", gap: 0.5 }}>
        <StatusPill pending={isPending(caretaker)} />
        <ChevronRightIcon className="kk-chev" sx={{ color: "text.disabled", transition: "all .15s ease" }} />
      </Box>

      {/* Phones: phone + permissions on one quiet line */}
      <Box sx={{ display: { xs: "flex", md: "none" }, gridColumn: "1 / -1", alignItems: "center", gap: 1, flexWrap: "wrap", pl: "52px" }}>
        <Typography variant="body2" sx={{ fontWeight: 600 }}>{caretaker.phone || "No phone"}</Typography>
        <Typography variant="body2" color="text.secondary">
          · {permissionCount === 0 ? "No permissions" : `${permissionCount} ${permissionCount === 1 ? "permission" : "permissions"}`}
        </Typography>
      </Box>

      {/* Laptops: phone */}
      <Box sx={{ display: { xs: "none", md: "block" }, minWidth: 0 }}>
        <Typography variant="body2" color={caretaker.phone ? "text.primary" : "text.secondary"} noWrap>
          {caretaker.phone || "—"}
        </Typography>
      </Box>

      {/* Laptops: permissions */}
      <Box sx={{ display: { xs: "none", md: "block" }, minWidth: 0 }}>
        <PermissionChips caretaker={caretaker} />
      </Box>

      {/* Laptops: status + chevron */}
      <Box sx={{ display: { xs: "none", md: "flex" }, alignItems: "center", gap: 0.5, justifyContent: "flex-end" }}>
        <StatusPill pending={isPending(caretaker)} />
        <ChevronRightIcon className="kk-chev" sx={{ color: "text.disabled", transition: "all .15s ease" }} />
      </Box>
    </Box>
  );
}

const columnHeader = (
  <Box
    sx={{
      display: { xs: "none", md: "grid" },
      gridTemplateColumns: COLS,
      columnGap: 2,
      px: 3,
      py: 1,
      bgcolor: (t) => alpha(t.palette.background.paper, 0.35),
      borderBottom: "1px solid",
      borderColor: "divider",
      "& > *": { fontWeight: 700, color: "text.secondary", fontSize: "0.75rem", letterSpacing: 0.3 },
    }}
  >
    <Box>CARETAKER</Box>
    <Box>PHONE</Box>
    <Box>PERMISSIONS</Box>
    <Box sx={{ textAlign: "right", pr: 3 }}>STATUS</Box>
  </Box>
);

export default function CaretakerList() {
  const navigate = useNavigate();
  const { currentUser } = useAuth() || {};

  const [caretakers, setCaretakers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    async function fetchCaretakers() {
      if (!currentUser?.uid) {
        setLoading(false);
        return;
      }
      try {
        const q = query(
          collection(db, "users"),
          where("role", "==", "caretaker"),
          where("invitedBy", "==", currentUser.uid)
        );
        const snap = await getDocs(q);
        const rawCaretakers = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

        // Resolve each caretaker's assignedPropertyId into a readable name.
        const propertyCache = new Map();
        const withPropertyNames = await Promise.all(
          rawCaretakers.map(async (c) => {
            if (!c.assignedPropertyId) return { ...c, propertyName: null };
            if (propertyCache.has(c.assignedPropertyId)) {
              return {
                ...c,
                propertyName: propertyCache.get(c.assignedPropertyId),
              };
            }
            try {
              const propSnap = await getDoc(
                doc(db, "properties", c.assignedPropertyId)
              );
              let name = null;
              if (propSnap.exists()) {
                const propData = propSnap.data();
                name = propData.name || propData.propertyName || null;
              }
              propertyCache.set(c.assignedPropertyId, name);
              return { ...c, propertyName: name };
            } catch {
              return { ...c, propertyName: null };
            }
          })
        );

        setCaretakers(withPropertyNames);
      } catch (err) {
        console.error("Error loading caretakers:", err);
        setError("Failed to load caretakers. Please refresh and try again.");
      } finally {
        setLoading(false);
      }
    }
    fetchCaretakers();
  }, [currentUser?.uid]);

  const counts = useMemo(() => {
    const pending = caretakers.filter(isPending).length;
    return { total: caretakers.length, pending, active: caretakers.length - pending };
  }, [caretakers]);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return caretakers.filter((c) => {
      if (filter === "active" && isPending(c)) return false;
      if (filter === "pending" && !isPending(c)) return false;
      if (!term) return true;
      return [c.name, c.email, c.phone, c.propertyName].some((v) => String(v || "").toLowerCase().includes(term));
    });
  }, [caretakers, search, filter]);

  const isFiltering = Boolean(search.trim()) || filter !== "all";

  // Group by assigned property
  const groups = useMemo(() => {
    const map = new Map();
    visible.forEach((c) => {
      const key = c.assignedPropertyId || "__none";
      if (!map.has(key)) {
        map.set(key, { key, name: c.assignedPropertyId ? c.propertyName || "Unknown property" : "No property assigned", unassigned: !c.assignedPropertyId, items: [] });
      }
      map.get(key).items.push(c);
    });
    // unassigned group last
    return [...map.values()].sort((a, b) => Number(a.unassigned) - Number(b.unassigned) || a.name.localeCompare(b.name));
  }, [visible]);

  const goInvite = () => navigate("/owner/caretakers/invite");
  const open = (c) => navigate(`/owner/caretakers/${c.id}`);

  return (
    <Box sx={{ minWidth: 0 }}>
      {/* The top bar already says "Caretakers", so the page only adds a one-line
          description and the primary action. */}
      <Box sx={{ ...row, justifyContent: "space-between", gap: 2, mb: { xs: 2, sm: 2.5 } }}>
        <Typography color="text.secondary" sx={{ minWidth: 0 }}>
          Manage access and permissions for the people helping run your properties
        </Typography>
        <Button
          variant="contained"
          startIcon={<PersonAddAltOutlinedIcon />}
          onClick={goInvite}
          sx={{ flexShrink: 0, fontWeight: 700, borderRadius: 2.5, display: { xs: "none", sm: "inline-flex" } }}
        >
          Invite caretaker
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {!loading && !error && caretakers.length > 0 && (
        <SummaryStrip
          items={[
            { label: "Caretakers", value: counts.total },
            { label: "Active", value: counts.active, color: "success.main" },
            { label: "Pending login", value: counts.pending, color: counts.pending > 0 ? "warning.main" : undefined },
          ]}
        />
      )}

      {/* Search + status filter */}
      {!loading && !error && caretakers.length > 0 && (
        <Box sx={{ mb: { xs: 2, sm: 2.5 } }}>
          <Paper
            elevation={0}
            sx={{ ...row, gap: 1, px: 1.5, bgcolor: "background.default", border: "1px solid", borderColor: "divider", borderRadius: 3, height: 46 }}
          >
            <SearchIcon sx={{ color: "text.secondary" }} />
            <InputBase
              fullWidth
              placeholder="Search name, email or property"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              inputProps={{ "aria-label": "Search caretakers" }}
            />
            {search && (
              <IconButton size="small" aria-label="Clear search" onClick={() => setSearch("")}>
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
            {FILTERS.map((f) => (
              <Chip
                key={f.value}
                label={f.label}
                clickable
                onClick={() => setFilter(f.value)}
                color={filter === f.value ? "primary" : "default"}
                variant={filter === f.value ? "filled" : "outlined"}
                sx={{ fontWeight: 700, flexShrink: 0, height: 34, borderRadius: 17 }}
              />
            ))}
          </Box>
        </Box>
      )}

      {/* CONTENT */}
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
      ) : error ? null : caretakers.length === 0 ? (
        <Paper elevation={0} sx={{ ...groupShellSx, borderStyle: "dashed", py: 7, px: 3, textAlign: "center" }}>
          <Box sx={{ width: 64, height: 64, borderRadius: "50%", mx: "auto", mb: 2, ...row, justifyContent: "center", bgcolor: "rgba(255, 69, 0, 0.10)" }}>
            <SupervisorAccountOutlinedIcon sx={{ fontSize: 32, color: "primary.main" }} />
          </Box>
          <Typography sx={{ fontWeight: 700, mb: 0.5 }}>No caretakers yet</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
            Invite someone to help manage a property. You choose what they can see and do.
          </Typography>
          <Button variant="contained" startIcon={<PersonAddAltOutlinedIcon />} onClick={goInvite} sx={{ fontWeight: 700, borderRadius: 2.5 }}>
            Invite caretaker
          </Button>
        </Paper>
      ) : visible.length === 0 ? (
        <Paper elevation={0} sx={{ ...groupShellSx, py: 5, textAlign: "center" }}>
          <Typography sx={{ fontWeight: 700 }}>No caretakers match</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Try a different search or filter.
          </Typography>
          <Button size="small" onClick={() => { setSearch(""); setFilter("all"); }} sx={{ mt: 1 }}>
            Clear filters
          </Button>
        </Paper>
      ) : (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {groups.map((group, index) => (
            <Accordion
              key={`${group.key}-${isFiltering}`}
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
                  <Box
                    sx={{
                      width: 36, height: 36, borderRadius: 2, flexShrink: 0, ...row, justifyContent: "center",
                      bgcolor: (t) => group.unassigned ? alpha(t.palette.warning.main, 0.14) : "rgba(255, 69, 0, 0.10)",
                    }}
                  >
                    <ApartmentOutlinedIcon color={group.unassigned ? undefined : "primary"} sx={group.unassigned ? { color: "warning.dark" } : undefined} fontSize="small" />
                  </Box>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 800, lineHeight: 1.25 }} noWrap>
                      {group.name}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" noWrap component="div">
                      {group.items.length} {group.items.length === 1 ? "caretaker" : "caretakers"}
                    </Typography>
                  </Box>
                </Box>
              </AccordionSummary>

              <AccordionDetails sx={{ p: 0, borderTop: "1px solid", borderColor: "divider" }}>
                {columnHeader}
                {group.items.map((c, i) => (
                  <React.Fragment key={c.id}>
                    {i > 0 && <Divider />}
                    <CaretakerRow caretaker={c} onOpen={() => open(c)} />
                  </React.Fragment>
                ))}
              </AccordionDetails>
            </Accordion>
          ))}
        </Box>
      )}

      {/* Phone: floating invite button so the primary action stays reachable */}
      <Button
        variant="contained"
        onClick={goInvite}
        startIcon={<PersonAddAltOutlinedIcon />}
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
        Invite
      </Button>
    </Box>
  );
}