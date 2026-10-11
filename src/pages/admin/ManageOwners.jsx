// src/pages/admin/ManageOwners.jsx

import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Alert, Avatar, Box, Button, Chip, IconButton, InputBase, LinearProgress, MenuItem, Paper, Skeleton, TextField, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import SearchIcon from "@mui/icons-material/Search";
import CloseIcon from "@mui/icons-material/Close";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import SupervisorAccountOutlinedIcon from "@mui/icons-material/SupervisorAccountOutlined";
import FactCheckOutlinedIcon from "@mui/icons-material/FactCheckOutlined";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "../../config/firebase";

const row = { display: "flex", alignItems: "center" };
const cardSx = { bgcolor: "background.default", border: "1px solid", borderColor: "divider", borderRadius: 3 };
const COLS = "minmax(0, 1.8fr) 96px 84px minmax(0, 1.1fr) 84px 112px 24px";

// Firestore timestamps and ISO strings both show up in these records
const toMillis = (ts) => {
  if (!ts) return 0;
  if (ts.toMillis) return ts.toMillis();
  const n = new Date(ts).getTime();
  return Number.isNaN(n) ? 0 : n;
};
const fmtDate = (ts) => {
  const ms = toMillis(ts);
  return ms ? new Date(ms).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "Recently";
};
const keyOf = (v) => String(v || "").trim().toLowerCase();

const ownerNameOf = (o) =>
  o.fullName || o.name || (o.firstName && o.lastName ? `${o.firstName} ${o.lastName}` : "New owner");

// Same rule as the owner page and the dashboard: an owner is pending if either
// status or approvalStatus says so (this includes owners who resubmitted their
// documents), then rejected, then suspended, else active.
const statusOf = (o) => {
  if (o.status === "pending" || o.approvalStatus === "pending") return "pending";
  if (o.approvalStatus === "rejected") return "rejected";
  if (o.status === "suspended") return "suspended";
  return "active";
};

const docsComplete = (o) => !!(o.verificationDocs?.idUrl && o.verificationDocs?.clearanceUrl);

const SORTS = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "name", label: "Name A–Z" },
  { value: "properties", label: "Most properties" },
];

const STATUS_META = {
  pending: { label: "Pending", tone: "warning" },
  suspended: { label: "Suspended", tone: "error" },
  rejected: { label: "Rejected", tone: "error" },
  active: { label: "Active", tone: "success" },
};
const metaOf = (s) => STATUS_META[s] || STATUS_META.active;

const initials = (name) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("") || "?";

function StatusPill({ status }) {
  const { label, tone } = metaOf(status);
  return (
    <Chip
      label={label}
      size="small"
      sx={{
        fontWeight: 700,
        bgcolor: (t) => alpha(t.palette[tone].main, 0.13),
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
        ...cardSx,
        overflow: "hidden",
        display: "grid",
        gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", md: "repeat(4, minmax(0, 1fr))" },
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
          <Typography
            noWrap
            sx={{ fontFamily: '"Inter", sans-serif', fontWeight: 800, fontSize: { xs: "1.2rem", sm: "1.45rem" }, lineHeight: 1.25, color: item.color }}
          >
            {item.value}
          </Typography>
        </Box>
      ))}
    </Paper>
  );
}

export default function ManageOwners() {
  const navigate = useNavigate();
  const [owners, setOwners] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filterTab, setFilterTab] = useState("all");
  const [sortBy, setSortBy] = useState("newest");
  const [properties, setProperties] = useState([]);
  const [tenantCounts, setTenantCounts] = useState({});

  useEffect(() => {
    const q = query(collection(db, "users"), where("role", "==", "owner"));

    return onSnapshot(
      q,
      (snapshot) => {
        const ownerData = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));

        // Pending registrations first, then newest first
        ownerData.sort((a, b) => {
          const pa = statusOf(a) === "pending" ? 0 : 1;
          const pb = statusOf(b) === "pending" ? 0 : 1;
          if (pa !== pb) return pa - pb;
          return toMillis(b.createdAt) - toMillis(a.createdAt);
        });

        setOwners(ownerData);
        setError("");
        setLoading(false);
      },
      (err) => {
        console.error("Error loading owners:", err);
        setError("Could not load owners.");
        setLoading(false);
      }
    );
  }, []);

  // Portfolio numbers per owner (best effort: the list still works without them)
  useEffect(() => {
    const unsubProps = onSnapshot(
      collection(db, "properties"),
      (snap) => setProperties(snap.docs.map((d) => d.data())),
      (e) => console.warn("Could not load properties:", e)
    );
    const unsubTenants = onSnapshot(
      collection(db, "tenants"),
      (snap) => {
        const map = {};
        snap.docs.forEach((d) => {
          const k = keyOf(d.data().ownerUid);
          if (k) map[k] = (map[k] || 0) + 1;
        });
        setTenantCounts(map);
      },
      (e) => console.warn("Could not load tenants:", e)
    );
    return () => {
      unsubProps();
      unsubTenants();
    };
  }, []);

  const portfolioByOwner = useMemo(() => {
    const map = {};
    properties.forEach((p) => {
      const k = keyOf(p.ownerUid ?? p.ownerId ?? p.createdBy);
      if (!k) return;
      const m = (map[k] = map[k] || { properties: 0, beds: 0, occupied: 0 });
      m.properties += 1;
      m.beds += Number(p.totalBeds) || 0;
      m.occupied += Number(p.occupiedBeds) || 0;
    });
    return map;
  }, [properties]);

  const counts = useMemo(() => {
    const c = { all: owners.length, pending: 0, active: 0, suspended: 0, rejected: 0 };
    owners.forEach((o) => {
      const s = statusOf(o);
      if (c[s] !== undefined) c[s] += 1;
      else c.active += 1;
    });
    return c;
  }, [owners]);

  const tabs = useMemo(() => {
    const base = [
      { value: "all", label: "All" },
      { value: "pending", label: "Pending" },
      { value: "active", label: "Active" },
      { value: "suspended", label: "Suspended" },
    ];
    // Only show Rejected if there are any
    if (counts.rejected > 0) base.push({ value: "rejected", label: "Rejected" });
    return base;
  }, [counts.rejected]);

  const filteredOwners = useMemo(() => {
    const term = search.trim().toLowerCase();
    const list = owners.filter((o) => {
      const s = statusOf(o);
      if (filterTab !== "all" && s !== filterTab) return false;
      if (!term) return true;
      const name = ownerNameOf(o).toLowerCase();
      const email = (o.email || "").toLowerCase();
      const phone = (o.phoneNumber || o.phone || "").toLowerCase();
      return name.includes(term) || email.includes(term) || phone.includes(term);
    });
    const byNew = (a, b) => toMillis(b.createdAt) - toMillis(a.createdAt);
    const sorters = {
      newest: byNew,
      oldest: (a, b) => -byNew(a, b),
      name: (a, b) => ownerNameOf(a).localeCompare(ownerNameOf(b)),
      properties: (a, b) => (portfolioByOwner[keyOf(b.id)]?.properties || 0) - (portfolioByOwner[keyOf(a.id)]?.properties || 0) || byNew(a, b),
    };
    return list.sort(sorters[sortBy] || byNew);
  }, [owners, filterTab, search, sortBy, portfolioByOwner]);

  const pendingOwners = useMemo(() => owners.filter((o) => statusOf(o) === "pending"), [owners]);
  // Pending applications get their own cards on the default view; the table below then lists everyone else.
  const showPendingCards = filterTab === "all" && !search.trim() && pendingOwners.length > 0;
  const listOwners = showPendingCards ? filteredOwners.filter((o) => statusOf(o) !== "pending") : filteredOwners;

  const open = (id) => navigate(`/admin/owners/${id}`);

  return (
    <Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: { xs: 2, sm: 2.5 } }}>
        Manage registered platform owners and review pending applications.
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>{error}</Alert>}

      {loading ? (
        <>
          <Skeleton variant="rounded" height={72} sx={{ borderRadius: 3, mb: 2 }} />
          <Skeleton variant="rounded" height={46} sx={{ borderRadius: 3, mb: 2 }} />
          <Skeleton variant="rounded" height={260} sx={{ borderRadius: 3 }} />
        </>
      ) : (
        <>
          {owners.length > 0 && (
            <SummaryStrip
              items={[
                { label: "Owners", value: counts.all },
                { label: "Active", value: counts.active, color: counts.active > 0 ? "success.main" : undefined },
                { label: "Pending review", value: counts.pending, color: counts.pending > 0 ? "warning.main" : undefined },
                { label: "Suspended", value: counts.suspended, color: counts.suspended > 0 ? "error.main" : undefined },
              ]}
            />
          )}

          {owners.length > 0 && (
            <Box sx={{ mb: { xs: 2, sm: 2.5 } }}>
              <Box sx={{ display: "flex", flexDirection: { xs: "column", sm: "row" }, gap: 1.25, mb: 1.5 }}>
                <Paper elevation={0} sx={{ ...row, gap: 1, px: 1.5, ...cardSx, height: 46, flex: 1, maxWidth: { sm: 460 } }}>
                  <SearchIcon sx={{ color: "text.secondary" }} />
                  <InputBase
                    fullWidth
                    placeholder="Search name, email or phone"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    slotProps={{ input: { "aria-label": "Search owners" } }}
                  />
                  {search && (
                    <IconButton size="small" aria-label="Clear search" onClick={() => setSearch("")}>
                      <CloseIcon fontSize="small" />
                    </IconButton>
                  )}
                </Paper>
                <TextField
                  select
                  size="small"
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  slotProps={{ htmlInput: { "aria-label": "Sort owners" } }}
                  sx={{ minWidth: { sm: 190 }, "& .MuiOutlinedInput-root": { borderRadius: 3, height: 46 } }}
                >
                  {SORTS.map((o) => (
                    <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
                  ))}
                </TextField>
              </Box>

              <Box
                sx={{
                  display: "flex",
                  gap: 1,
                  overflowX: "auto",
                  mx: { xs: -2, sm: 0 },
                  px: { xs: 2, sm: 0 },
                  scrollbarWidth: "none",
                  "&::-webkit-scrollbar": { display: "none" },
                }}
              >
                {tabs.map((t) => (
                  <Chip
                    key={t.value}
                    label={`${t.label} · ${counts[t.value]}`}
                    clickable
                    onClick={() => setFilterTab(t.value)}
                    color={filterTab === t.value ? "primary" : "default"}
                    variant={filterTab === t.value ? "filled" : "outlined"}
                    sx={{ fontWeight: 700, flexShrink: 0, height: 34, borderRadius: 17 }}
                  />
                ))}
              </Box>
            </Box>
          )}

          {/* Needs review: pending applications as prominent cards */}
          {showPendingCards && (
            <Box sx={{ mb: { xs: 2.5, sm: 3 } }}>
              <Box sx={{ ...row, gap: 1, mb: 1.25 }}>
                <FactCheckOutlinedIcon sx={{ color: "warning.main" }} />
                <Typography sx={{ fontFamily: '"Inter", sans-serif', fontWeight: 800 }}>
                  Needs your review
                </Typography>
                <Chip size="small" label={pendingOwners.length} sx={{ fontWeight: 800, bgcolor: (t) => alpha(t.palette.warning.main, 0.16), color: "warning.dark" }} />
              </Box>
              <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "repeat(2, minmax(0, 1fr))", xl: "repeat(3, minmax(0, 1fr))" }, gap: { xs: 1.5, sm: 2 } }}>
                {pendingOwners.map((o) => {
                  const name = ownerNameOf(o);
                  const hasDocs = docsComplete(o);
                  const someDocs = !!o.verificationDocs && !hasDocs;
                  const resubmitted = toMillis(o.reviewedAt) > 0 && toMillis(o.verificationDocs?.submittedAt) > toMillis(o.reviewedAt);
                  return (
                    <Paper
                      key={o.id}
                      elevation={0}
                      sx={{
                        ...cardSx,
                        p: 2,
                        borderColor: (t) => alpha(t.palette.warning.main, 0.5),
                        bgcolor: (t) => alpha(t.palette.warning.main, 0.06),
                        display: "flex",
                        flexDirection: "column",
                        gap: 1.5,
                        minWidth: 0,
                      }}
                    >
                      <Box sx={{ ...row, gap: 1.5, minWidth: 0 }}>
                        <Avatar sx={{ width: 44, height: 44, bgcolor: (t) => alpha(t.palette.warning.main, 0.2), color: "warning.dark", fontWeight: 800 }}>
                          {initials(name)}
                        </Avatar>
                        <Box sx={{ minWidth: 0 }}>
                          <Typography noWrap sx={{ fontWeight: 800 }}>{name}</Typography>
                          <Typography variant="caption" color="text.secondary" noWrap component="div">
                            {o.email || "No email"}
                          </Typography>
                        </Box>
                      </Box>
                      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75 }}>
                        <Chip size="small" label={`${resubmitted ? "Resubmitted" : "Applied"} ${fmtDate(resubmitted ? o.verificationDocs.submittedAt : o.createdAt)}`} sx={{ fontWeight: 700 }} />
                        <Chip
                          size="small"
                          label={hasDocs ? "Documents complete" : someDocs ? "Documents incomplete" : "No documents yet"}
                          sx={{
                            fontWeight: 700,
                            bgcolor: (t) => alpha(t.palette[hasDocs ? "success" : someDocs ? "warning" : "error"].main, 0.13),
                            color: (t) => t.palette[hasDocs ? "success" : someDocs ? "warning" : "error"].dark,
                          }}
                        />
                      </Box>
                      <Button variant="contained" onClick={() => open(o.id)} sx={{ fontWeight: 700, borderRadius: 2.5 }}>
                        Review application
                      </Button>
                    </Paper>
                  );
                })}
              </Box>
            </Box>
          )}

          {listOwners.length === 0 && !showPendingCards ? (
            <Paper
              elevation={0}
              sx={{ ...cardSx, borderStyle: owners.length === 0 ? "dashed" : "solid", py: { xs: 5, sm: 7 }, px: 3, textAlign: "center" }}
            >
              <Box sx={{ width: 64, height: 64, borderRadius: "50%", mx: "auto", mb: 2, ...row, justifyContent: "center", bgcolor: "rgba(255, 69, 0, 0.10)" }}>
                <SupervisorAccountOutlinedIcon sx={{ fontSize: 30, color: "primary.main" }} />
              </Box>
              <Typography sx={{ fontWeight: 700 }}>
                {owners.length === 0 ? "No owners yet" : "No owners found"}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                {owners.length === 0
                  ? "Owners appear here after they register."
                  : search
                    ? "Try a different search."
                    : `No ${filterTab} owners.`}
              </Typography>
            </Paper>
          ) : listOwners.length > 0 ? (
            <>
              {showPendingCards && (
                <Typography sx={{ fontFamily: '"Inter", sans-serif', fontWeight: 800, mb: 1.25 }}>
                  All owners
                </Typography>
              )}
              {(search.trim() || filterTab !== "all") && (
                <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1, fontWeight: 600 }}>
                  Showing {listOwners.length} of {owners.length} owners
                </Typography>
              )}
              <Paper elevation={0} sx={{ ...cardSx, overflow: "hidden" }}>
                {/* Column headings (desktop) */}
                <Box
                  sx={{
                    display: { xs: "none", md: "grid" },
                    gridTemplateColumns: COLS,
                    columnGap: 2,
                    px: 2.5,
                    py: 1.25,
                    bgcolor: (t) => alpha(t.palette.text.primary, 0.035),
                    borderBottom: "1px solid",
                    borderColor: "divider",
                  }}
                >
                  {["Owner", "Joined", "Properties", "Beds occupied", "Tenants", "Status", ""].map((h, i) => (
                    <Typography key={i} variant="caption" color="text.secondary" sx={{ fontWeight: 800, letterSpacing: 0.4 }}>
                      {h.toUpperCase()}
                    </Typography>
                  ))}
                </Box>

                {listOwners.map((owner) => {
                  const name = ownerNameOf(owner);
                  const status = statusOf(owner);
                  const tone = metaOf(status).tone;
                  const phone = owner.phoneNumber || owner.phone || "";
                  const k = keyOf(owner.id);
                  const pf = portfolioByOwner[k] || { properties: 0, beds: 0, occupied: 0 };
                  const tenantsN = tenantCounts[k] || 0;
                  const pct = pf.beds > 0 ? Math.min(100, Math.round((pf.occupied / pf.beds) * 100)) : 0;

                  return (
                    <Box
                      key={owner.id}
                      component="button"
                      type="button"
                      onClick={() => open(owner.id)}
                      sx={{
                        display: "grid",
                        gridTemplateColumns: { xs: "minmax(0, 1fr) auto", md: COLS },
                        columnGap: 2,
                        rowGap: 1,
                        alignItems: "center",
                        width: "100%",
                        textAlign: "left",
                        font: "inherit",
                        color: "inherit",
                        cursor: "pointer",
                        bgcolor: "transparent",
                        border: 0,
                        borderTop: "1px solid",
                        borderColor: "divider",
                        px: { xs: 2, sm: 2.5 },
                        py: 1.5,
                        transition: "background-color .15s",
                        "&:first-of-type": { borderTop: "none" },
                        "&:hover": { bgcolor: (t) => alpha(t.palette.text.primary, 0.035) },
                        "&:focus-visible": { outline: "2px solid", outlineColor: "primary.main", outlineOffset: -2 },
                      }}
                    >
                      <Box sx={{ ...row, gap: 1.5, minWidth: 0 }}>
                        <Avatar
                          sx={{
                            width: 42,
                            height: 42,
                            fontWeight: 800,
                            fontSize: 15,
                            bgcolor: (t) => (tone === "success" ? "rgba(255, 69, 0, 0.12)" : alpha(t.palette[tone].main, 0.16)),
                            color: (t) => (tone === "success" ? t.palette.primary.main : t.palette[tone].dark),
                          }}
                        >
                          {initials(name)}
                        </Avatar>
                        <Box sx={{ minWidth: 0 }}>
                          <Typography noWrap sx={{ fontWeight: 700 }}>{name}</Typography>
                          <Typography variant="caption" color="text.secondary" noWrap component="div">
                            {owner.email || "No email"}
                            {phone ? ` · ${phone}` : ""}
                          </Typography>
                        </Box>
                      </Box>

                      {/* desktop columns */}
                      <Typography variant="body2" color="text.secondary" sx={{ display: { xs: "none", md: "block" } }}>
                        {fmtDate(owner.createdAt)}
                      </Typography>
                      <Typography variant="body2" sx={{ display: { xs: "none", md: "block" }, fontWeight: 700 }}>
                        {pf.properties}
                      </Typography>

                      <Box sx={{ display: { xs: "none", md: "block" }, minWidth: 0 }}>
                        {pf.beds > 0 ? (
                          <>
                            <Typography variant="caption" sx={{ fontWeight: 700 }}>
                              {pf.occupied}/{pf.beds} · {pct}%
                            </Typography>
                            <LinearProgress
                              variant="determinate"
                              value={pct}
                              color={pct >= 70 ? "success" : "primary"}
                              sx={{ height: 5, borderRadius: 3, mt: 0.5, bgcolor: (t) => alpha(t.palette.text.primary, 0.08) }}
                            />
                          </>
                        ) : (
                          <Typography variant="caption" color="text.secondary">—</Typography>
                        )}
                      </Box>

                      <Typography variant="body2" sx={{ display: { xs: "none", md: "block" }, fontWeight: 700 }}>
                        {tenantsN}
                      </Typography>

                      <Box sx={{ justifySelf: { xs: "end", md: "start" } }}>
                        <StatusPill status={status} />
                      </Box>

                      <ChevronRightIcon sx={{ color: "text.secondary", display: { xs: "none", md: "block" } }} />

                      {/* phone: portfolio line */}
                      <Box sx={{ display: { xs: "flex", md: "none" }, gridColumn: "1 / -1", gap: 0.75, flexWrap: "wrap" }}>
                        <Chip size="small" label={`${pf.properties} ${pf.properties === 1 ? "property" : "properties"}`} sx={{ fontWeight: 700 }} />
                        <Chip size="small" label={`${tenantsN} ${tenantsN === 1 ? "tenant" : "tenants"}`} sx={{ fontWeight: 700 }} />
                        <Chip size="small" variant="outlined" label={`Joined ${fmtDate(owner.createdAt)}`} sx={{ fontWeight: 600 }} />
                        {pf.beds > 0 && <Chip size="small" label={`${pct}% occupied`} sx={{ fontWeight: 700 }} />}
                      </Box>
                    </Box>
                  );
                })}
              </Paper>
            </>
          ) : null}
        </>
      )}
    </Box>
  );
}