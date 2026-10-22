// src/pages/admin/AdminOverview.jsx

import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Alert, Avatar, Box, Button, Skeleton, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import SupervisorAccountOutlinedIcon from "@mui/icons-material/SupervisorAccountOutlined";
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";
import TaskAltIcon from "@mui/icons-material/TaskAlt";
import PersonAddAltOutlinedIcon from "@mui/icons-material/PersonAddAltOutlined";
import HomeWorkOutlinedIcon from "@mui/icons-material/HomeWorkOutlined";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import FactCheckOutlinedIcon from "@mui/icons-material/FactCheckOutlined";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import ConstructionOutlinedIcon from "@mui/icons-material/ConstructionOutlined";
import DonutLargeOutlinedIcon from "@mui/icons-material/DonutLargeOutlined";
import { collection, doc, getDoc, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../../config/firebase";
import { useAuth } from "../../context/AuthContext";
import { ownerAccessOf } from "../../utils/ownerAccess";
import { occupancyOf, bedsInProperty, holdsBed } from "../../utils/occupancy";
import { loadPlatformSettings } from "../../utils/platformSettings";
import { HeaderCard, Panel, Pill } from "./adminUi";
import { withoutRemoved } from "../../utils/accountState";

const R = { sm: "10px", md: "14px" };
const row = { display: "flex", alignItems: "center" };

const toMillis = (ts) => {
  if (!ts) return 0;
  if (ts.toMillis) return ts.toMillis();
  const n = new Date(ts).getTime();
  return Number.isNaN(n) ? 0 : n;
};
const formatDate = (ts) => {
  const ms = toMillis(ts);
  return ms ? new Date(ms).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "Recently";
};
const ownerName = (o) => (o.firstName && o.lastName ? `${o.firstName} ${o.lastName}` : o.fullName || o.name || o.displayName || "New owner");
const initials = (name) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("") || "?";
const docsComplete = (o) => Boolean(o.verificationDocs?.idUrl && o.verificationDocs?.clearanceUrl);
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

// Owner accounts by where they are in the approval flow
const ACCOUNT_STATES = [
  { key: "active", label: "Active", color: "success.main" },
  { key: "pending", label: "Waiting for review", color: "warning.main" },
  { key: "rejected", label: "Declined", color: "error.light" },
  { key: "suspended", label: "Suspended", color: "error.main" },
];

export default function AdminOverview() {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [ready, setReady] = useState({ owners: false, properties: false, tenants: false });
  const [error, setError] = useState("");
  const [owners, setOwners] = useState([]);
  const [properties, setProperties] = useState([]);
  const [tenantSources, setTenantSources] = useState({ tenants: [], users: [] });
  const [adminName, setAdminName] = useState("");
  const [settings, setSettings] = useState(null);

  useEffect(() => {
    const markReady = (key) => setReady((r) => (r[key] ? r : { ...r, [key]: true }));
    const fail = (what, key) => (err) => {
      console.error(`Error loading ${what}:`, err);
      setError(`Some ${what} couldn't be loaded, so a few numbers may be off.`);
      markReady(key);
    };
    const unsubs = [
      onSnapshot(
        query(collection(db, "users"), where("role", "==", "owner")),
        (snap) => {
          setOwners(withoutRemoved(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));
          markReady("owners");
        },
        fail("owners", "owners")
      ),
      onSnapshot(
        collection(db, "properties"),
        (snap) => {
          setProperties(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
          markReady("properties");
        },
        fail("properties", "properties")
      ),
      // Tenants live in "tenants" and/or "users" (same id); both are read and merged
      onSnapshot(
        collection(db, "tenants"),
        (snap) => {
          setTenantSources((s) => ({ ...s, tenants: snap.docs.map((d) => ({ id: d.id, ...d.data() })) }));
          markReady("tenants");
        },
        fail("tenants", "tenants")
      ),
      onSnapshot(
        query(collection(db, "users"), where("role", "==", "tenant")),
        (snap) => setTenantSources((s) => ({ ...s, users: snap.docs.map((d) => ({ id: d.id, ...d.data() })) })),
        (err) => console.warn("Tenant profiles unavailable:", err?.code || err)
      ),
    ];
    loadPlatformSettings({ fresh: true }).then(setSettings);
    return () => unsubs.forEach((u) => u());
  }, []);

  useEffect(() => {
    if (!currentUser?.uid) return;
    getDoc(doc(db, "users", currentUser.uid))
      .then((snap) => setAdminName(snap.data()?.fullName || snap.data()?.name || ""))
      .catch(() => {});
  }, [currentUser]);

  const byState = useMemo(() => {
    const m = { active: [], pending: [], rejected: [], suspended: [] };
    owners.forEach((o) => m[ownerAccessOf(o)].push(o));
    m.pending.sort((a, b) => toMillis(a.verificationDocs?.submittedAt || a.createdAt) - toMillis(b.verificationDocs?.submittedAt || b.createdAt)); // oldest waiting first
    return m;
  }, [owners]);

  // Same occupancy rule as the owner pages
  const occ = useMemo(() => {
    const merged = new Map();
    [...tenantSources.tenants, ...tenantSources.users].forEach((t) => {
      const id = t.uid || t.id;
      merged.set(id, { ...(merged.get(id) || {}), ...t });
    });
    const tenants = [...merged.values()];
    const result = occupancyOf(properties.map((p) => ({ id: p.id, beds: bedsInProperty(p) })), tenants);
    // Current tenants only (Active or Pending), same as everywhere else
    return { ...result, residents: tenants.filter(holdsBed).length };
  }, [properties, tenantSources]);

  const loading = !(ready.owners && ready.properties && ready.tenants);
  const pending = byState.pending;
  const name = adminName || currentUser?.displayName || (currentUser?.email ? currentUser.email.split("@")[0] : "") || "Admin";
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const totalOwners = owners.length;

  if (loading) {
    return (
      <Box>
        {error && <Alert severity="warning" sx={{ mb: 2, borderRadius: R.md }}>{error}</Alert>}
        <Skeleton variant="rounded" height={220} sx={{ borderRadius: "22px", mb: 2.5 }} />
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1.3fr 1fr" }, gap: 2.5 }}>
          <Skeleton variant="rounded" height={300} sx={{ borderRadius: "18px" }} />
          <Skeleton variant="rounded" height={300} sx={{ borderRadius: "18px" }} />
        </Box>
      </Box>
    );
  }

  return (
    <Box sx={{ maxWidth: 1200, mx: "auto" }}>
      {error && <Alert severity="warning" sx={{ mb: 2, borderRadius: R.md }}>{error}</Alert>}
      {settings?.maintenanceMode && (
        <Alert
          severity="warning"
          icon={<ConstructionOutlinedIcon />}
          sx={{ mb: 2, borderRadius: R.md, alignItems: "center" }}
          action={
            <Button color="inherit" size="small" onClick={() => navigate("/admin/settings")} sx={{ fontWeight: 700 }}>
              Settings
            </Button>
          }
        >
          <strong>Maintenance mode is on.</strong> Owners, caretakers and tenants are seeing the maintenance screen.
        </Alert>
      )}

      <HeaderCard
        eyebrow={
          <Box sx={{ mb: 1 }}>
            <Pill label={pending.length > 0 ? `${pending.length} to review` : "All clear"} tone={pending.length > 0 ? "warning" : "success"} />
          </Box>
        }
        title={`${greeting}, ${name}`}
        description={
          pending.length > 0
            ? `${plural(pending.length, "owner registration is", "owner registrations are")} waiting for your approval.`
            : `Nothing waiting. ${plural(properties.length, "property", "properties")} and ${plural(occ.residents, "tenant", "tenants")} on the platform.`
        }
        action={
          <Button variant="contained" disableElevation startIcon={<FactCheckOutlinedIcon />} onClick={() => navigate("/admin/owners")} sx={{ fontWeight: 700, borderRadius: R.sm, minHeight: 44, boxShadow: "0 10px 22px -14px rgba(255,69,0,.9)" }}>
            {pending.length > 0 ? "Review registrations" : "Manage owners"}
          </Button>
        }
        tiles={[
          { label: "Waiting for review", value: pending.length, sub: pending.length ? `Oldest from ${formatDate(pending[0].verificationDocs?.submittedAt || pending[0].createdAt)}` : "Nothing waiting", icon: <PersonAddAltOutlinedIcon />, tone: pending.length ? "warning" : undefined, onClick: () => navigate("/admin/owners") },
          { label: "Active owners", value: byState.active.length, sub: `${totalOwners} signed up in total`, icon: <SupervisorAccountOutlinedIcon />, onClick: () => navigate("/admin/owners") },
          { label: "Properties", value: properties.length, sub: `${occ.beds} beds`, icon: <HomeWorkOutlinedIcon /> },
          { label: "Occupancy", value: `${occ.rate}%`, sub: `${occ.occupied} of ${occ.beds} beds filled`, icon: <DonutLargeOutlinedIcon /> },
        ]}
      />

      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "minmax(0, 1.35fr) minmax(0, 1fr)" }, gap: { xs: 2, md: 2.5 }, alignItems: "stretch" }}>
        {/* Who needs a decision */}
        <Panel
          title="Needs your review"
          icon={<FactCheckOutlinedIcon />}
          action={
            pending.length > 0 && (
              <Button size="small" endIcon={<ChevronRightIcon />} onClick={() => navigate("/admin/owners")} sx={{ fontWeight: 700, flexShrink: 0 }}>
                All {pending.length}
              </Button>
            )
          }
        >
          {pending.length === 0 ? (
            <Box sx={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", py: 4 }}>
              <Box sx={{ width: 56, height: 56, borderRadius: "50%", mb: 1.5, display: "grid", placeItems: "center", bgcolor: (t) => alpha(t.palette.success.main, 0.12) }}>
                <TaskAltIcon sx={{ fontSize: 28, color: "success.main" }} />
              </Box>
              <Typography sx={{ fontWeight: 800 }}>All caught up</Typography>
              <Typography variant="body2" color="text.secondary">
                New owner registrations show up here.
              </Typography>
            </Box>
          ) : (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
              {pending.slice(0, 6).map((owner) => {
                const nm = ownerName(owner);
                const complete = docsComplete(owner);
                return (
                  <Box
                    key={owner.id}
                    component="button"
                    type="button"
                    onClick={() => navigate(`/admin/owners/${owner.id}`)}
                    sx={{
                      ...row,
                      gap: 1.5,
                      width: "100%",
                      textAlign: "left",
                      font: "inherit",
                      color: "inherit",
                      cursor: "pointer",
                      p: 1.25,
                      borderRadius: R.md,
                      bgcolor: "transparent",
                      border: "1px solid",
                      borderColor: "divider",
                      transition: "border-color .15s, background-color .15s",
                      "&:hover": { borderColor: "primary.main", bgcolor: (t) => alpha(t.palette.primary.main, 0.03) },
                      "&:focus-visible": { outline: "2px solid", outlineColor: "primary.main", outlineOffset: 2 },
                    }}
                  >
                    <Avatar sx={{ width: 40, height: 40, bgcolor: (t) => alpha(t.palette.warning.main, 0.16), color: "warning.dark", fontWeight: 800, fontSize: 14 }}>{initials(nm)}</Avatar>
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Typography noWrap sx={{ fontWeight: 700, fontSize: 14.5 }}>
                        {nm}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" noWrap component="div">
                        {owner.email || "No email"} · {formatDate(owner.verificationDocs?.submittedAt || owner.createdAt)}
                      </Typography>
                    </Box>
                    <Pill label={complete ? "Docs ready" : "Docs missing"} tone={complete ? "success" : "default"} sx={{ display: { xs: "none", sm: "inline-flex" } }} />
                    <ChevronRightIcon sx={{ color: "text.disabled", flexShrink: 0 }} />
                  </Box>
                );
              })}
              {pending.length > 6 && (
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textAlign: "center", mt: 0.5 }}>
                  +{pending.length - 6} more waiting
                </Typography>
              )}
            </Box>
          )}
        </Panel>

        <Box sx={{ display: "flex", flexDirection: "column", gap: { xs: 2, md: 2.5 }, minWidth: 0 }}>
          {/* Owner accounts at a glance */}
          <Panel title="Owner accounts" icon={<SupervisorAccountOutlinedIcon />} action={<Typography variant="body2" color="text.secondary" sx={{ fontWeight: 700 }}>{totalOwners}</Typography>}>
            {totalOwners === 0 ? (
              <Typography variant="body2" color="text.secondary">
                No owners have signed up yet.
              </Typography>
            ) : (
              <>
                <Box sx={{ display: "flex", height: 10, borderRadius: 99, overflow: "hidden", bgcolor: (t) => alpha(t.palette.text.primary, 0.06), mb: 1.75 }}>
                  {ACCOUNT_STATES.map((s) =>
                    byState[s.key].length ? <Box key={s.key} sx={{ width: `${(byState[s.key].length / totalOwners) * 100}%`, bgcolor: s.color }} /> : null
                  )}
                </Box>
                <Box sx={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 1 }}>
                  {ACCOUNT_STATES.map((s) => (
                    <Box key={s.key} sx={{ ...row, gap: 1, minWidth: 0 }}>
                      <Box sx={{ width: 10, height: 10, borderRadius: "3px", bgcolor: s.color, flexShrink: 0 }} />
                      <Typography variant="body2" color="text.secondary" noWrap sx={{ flex: 1, minWidth: 0 }}>
                        {s.label}
                      </Typography>
                      <Typography variant="body2" sx={{ fontWeight: 800 }}>
                        {byState[s.key].length}
                      </Typography>
                    </Box>
                  ))}
                </Box>
              </>
            )}
          </Panel>

          {/* Platform switches */}
          <Panel
            title="Platform"
            icon={<SettingsOutlinedIcon />}
            action={
              <Button size="small" endIcon={<ChevronRightIcon />} onClick={() => navigate("/admin/settings")} sx={{ fontWeight: 700, flexShrink: 0 }}>
                Settings
              </Button>
            }
          >
            {[
              { label: "Maintenance mode", value: settings?.maintenanceMode ? "On" : "Off", tone: settings?.maintenanceMode ? "warning" : "success" },
              { label: "New owners", value: settings?.autoApproveOwners ? "Auto-approved" : "Reviewed by you", tone: settings?.autoApproveOwners ? "warning" : "default" },
              { label: "Property limit", value: settings ? `${settings.maxPropertiesPerOwner} per owner` : "—" },
              { label: "Tenants on the platform", value: String(occ.residents), icon: <GroupsOutlinedIcon /> },
            ].map((it, i) => (
              <Box key={it.label} sx={{ ...row, justifyContent: "space-between", gap: 1, py: 1, borderTop: i ? "1px solid" : "none", borderColor: "divider" }}>
                <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
                  {it.label}
                </Typography>
                {it.tone ? <Pill label={it.value} tone={it.tone} /> : <Typography variant="body2" sx={{ fontWeight: 800 }}>{it.value}</Typography>}
              </Box>
            ))}
          </Panel>
        </Box>
      </Box>
    </Box>
  );
}
