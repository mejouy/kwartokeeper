// src/pages/admin/AdminOverview.jsx

import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Alert, Avatar, Box, Button, Card, CardContent, Chip, GlobalStyles, Paper, Skeleton, Typography } from "@mui/material";
import { alpha } from "@mui/material/styles";
import SupervisorAccountOutlinedIcon from "@mui/icons-material/SupervisorAccountOutlined";
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";
import CampaignOutlinedIcon from "@mui/icons-material/CampaignOutlined";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import TaskAltIcon from "@mui/icons-material/TaskAlt";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import MapsHomeWorkIcon from "@mui/icons-material/MapsHomeWork";
import GroupIcon from "@mui/icons-material/Group";
import FactCheckOutlinedIcon from "@mui/icons-material/FactCheckOutlined";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../../config/firebase";
import { useAuth } from "../../context/AuthContext";

const row = { display: "flex", alignItems: "center" };
const cardSx = { bgcolor: "background.default", border: "1px solid", borderColor: "divider", borderRadius: 3 };

const toMillis = (ts) => {
  if (!ts) return 0;
  if (ts.toMillis) return ts.toMillis();
  const n = new Date(ts).getTime();
  return Number.isNaN(n) ? 0 : n;
};

// Helper to format Firestore timestamps safely
const formatDate = (timestamp) => {
  const ms = toMillis(timestamp);
  if (!ms) return "Recently";
  return new Date(ms).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
};

const ownerName = (o) => {
  if (o.firstName && o.lastName) return `${o.firstName} ${o.lastName}`;
  return o.fullName || o.name || o.displayName || "New owner";
};

const initials = (name) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("") || "?";

const QUICK_ACTIONS = [
  { label: "Manage owners", hint: "Approve, view or suspend registered owners.", path: "/admin/owners", Icon: SupervisorAccountOutlinedIcon },
  { label: "System broadcasts", hint: "Send updates or announcements to owners.", path: "/admin/announcements", Icon: CampaignOutlinedIcon },
  { label: "Global settings", hint: "Adjust platform settings and configurations.", path: "/admin/settings", Icon: SettingsOutlinedIcon },
];

// Windows light up once on load; switched off for "reduce motion" users.
const AnimationStyles = (
  <GlobalStyles
    styles={{
      "@keyframes kkPop": {
        from: { opacity: 0, transform: "scale(0.6)" },
        to: { opacity: 1, transform: "scale(1)" },
      },
      "@media (prefers-reduced-motion: reduce)": {
        "*, *::before, *::after": { animationDuration: "0.001ms !important", transitionDuration: "0.001ms !important" },
      },
    }}
  />
);

// Same dorm-facade windows as the owner overview. Here a lit window means an
// approved owner: 30 windows = every owner who has signed up.
const WINDOW_COUNT = 30;
const LIGHT_ORDER = [3, 17, 8, 24, 1, 12, 27, 5, 20, 14, 9, 29, 2, 22, 11, 6, 25, 16, 0, 19, 28, 7, 13, 23, 4, 21, 10, 26, 15, 18];
const WINDOW_RANK = LIGHT_ORDER.reduce((acc, cell, rank) => ({ ...acc, [cell]: rank }), {});

function ApprovalWindows({ approved, total }) {
  const rate = total > 0 ? approved / total : 0;
  const litCount = approved > 0 ? Math.max(1, Math.round(rate * WINDOW_COUNT)) : 0;
  return (
    <Box>
      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(10, 1fr)", gap: { xs: 0.75, md: 1 }, width: "100%", maxWidth: 320 }}>
        {Array.from({ length: WINDOW_COUNT }).map((_, i) => (
          <Box
            key={i}
            sx={{
              aspectRatio: "1",
              borderRadius: "4px",
              bgcolor: WINDOW_RANK[i] < litCount ? "primary.main" : "rgba(202, 220, 246, 0.14)",
              animation: `kkPop 0.4s ease-out ${i * 18}ms both`,
            }}
          />
        ))}
      </Box>
      <Typography variant="caption" sx={{ color: "#cadcf6", display: "block", mt: 1.25 }}>
        {total > 0 ? `${approved} of ${total} owners approved` : "No owners have signed up yet"}
      </Typography>
    </Box>
  );
}

function MetricBox({ title, value, subtitle, icon, subtitleColor = "text.secondary" }) {
  return (
    <Card elevation={0} sx={{ ...cardSx, height: "100%" }}>
      <CardContent sx={{ p: { xs: 1.75, sm: 2.5 }, "&:last-child": { pb: { xs: 1.75, sm: 2.5 } } }}>
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 1, mb: 1 }}>
          <Typography variant="body2" color="text.secondary" fontWeight="600" sx={{ lineHeight: 1.3 }}>
            {title}
          </Typography>
          <Box sx={{ p: { xs: 0.75, sm: 1 }, borderRadius: 2, bgcolor: "rgba(255, 69, 0, 0.1)", color: "primary.main", display: "flex", flexShrink: 0 }}>
            {icon}
          </Box>
        </Box>
        <Typography
          variant="h4"
          fontWeight="800"
          sx={{ fontFamily: '"Inter", sans-serif', fontSize: { xs: "1.5rem", sm: "2.125rem" }, wordBreak: "break-word" }}
        >
          {value}
        </Typography>
        <Typography variant="caption" sx={{ color: subtitleColor }}>
          {subtitle}
        </Typography>
      </CardContent>
    </Card>
  );
}

export default function AdminOverview() {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [ready, setReady] = useState({ users: false, properties: false, tenants: false });
  const [error, setError] = useState("");
  const [owners, setOwners] = useState({ approved: 0, pending: [] });
  const [totalProperties, setTotalProperties] = useState(0);
  const [totalTenants, setTotalTenants] = useState(0);

  useEffect(() => {
    const markReady = (key) => setReady((r) => (r[key] ? r : { ...r, [key]: true }));
    const fail = (what) => (err) => {
      console.error(`Error loading ${what}:`, err);
      setError(`Some ${what} could not be loaded.`);
      markReady(what);
    };

    // 1. ALL users, to split pending vs approved owners
    const unsubUsers = onSnapshot(
      collection(db, "users"),
      (snapshot) => {
        let approved = 0;
        const pending = [];

        snapshot.docs.forEach((d) => {
          const data = d.data();
          if (data.role === "owner") {
            // Adjust "status" field based on what you saved in Firebase during registration
            if (data.status === "pending") pending.push({ id: d.id, ...data });
            else approved++;
          }
        });

        pending.sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
        setOwners({ approved, pending });
        markReady("users");
      },
      fail("users")
    );

    // 2. ALL properties
    const unsubProperties = onSnapshot(
      collection(db, "properties"),
      (snapshot) => {
        setTotalProperties(snapshot.docs.length);
        markReady("properties");
      },
      fail("properties")
    );

    // 3. ALL tenants
    const unsubTenants = onSnapshot(
      collection(db, "tenants"),
      (snapshot) => {
        setTotalTenants(snapshot.docs.length);
        markReady("tenants");
      },
      fail("tenants")
    );

    return () => {
      unsubUsers();
      unsubProperties();
      unsubTenants();
    };
  }, []);

  const loading = !(ready.users && ready.properties && ready.tenants);
  const pendingCount = owners.pending.length;
  const pendingPreview = useMemo(() => owners.pending.slice(0, 5), [owners.pending]); // up to 5 in the feed

  const adminName =
    currentUser?.displayName || (currentUser?.email ? currentUser.email.split("@")[0] : "") || "Admin";
  const totalOwners = owners.approved + pendingCount;

  // Pill tuned for the dark hero
  const statusTone =
    pendingCount > 0
      ? { label: `${pendingCount} to review`, bg: "rgba(255, 167, 38, 0.18)", fg: "#ffcc80" }
      : { label: "All clear", bg: "rgba(76, 175, 80, 0.18)", fg: "#a5d6a7" };

  const welcomeSubtitle =
    pendingCount > 0
      ? `${pendingCount} owner ${pendingCount === 1 ? "registration is" : "registrations are"} waiting for your approval.`
      : `Nothing waiting. ${totalProperties} ${totalProperties === 1 ? "property" : "properties"} and ${totalTenants} ${totalTenants === 1 ? "tenant" : "tenants"} on the platform.`;

  const panelSx = { ...cardSx, p: { xs: 2, sm: 3 } };
  const panelTitleSx = { fontFamily: '"Inter", sans-serif', fontWeight: 700 };

  if (loading) {
    return (
      <Box>
        {error && <Alert severity="warning" sx={{ mb: 2, borderRadius: 2 }}>{error}</Alert>}
        <Skeleton variant="rounded" height={220} sx={{ borderRadius: 4, mb: 3 }} />
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2, 1fr)", md: "repeat(4, 1fr)" }, gap: { xs: 1.5, md: 2.5 }, mb: 4 }}>
          {[0, 1, 2, 3].map((k) => <Skeleton key={k} variant="rounded" height={118} sx={{ borderRadius: 3 }} />)}
        </Box>
        <Skeleton variant="rounded" height={280} sx={{ borderRadius: 3 }} />
      </Box>
    );
  }

  return (
    <Box>
      {AnimationStyles}

      {error && <Alert severity="warning" sx={{ mb: 2, borderRadius: 2 }}>{error}</Alert>}

      {/* Welcome hero — same dark brand surface as the owner overview */}
      <Box
        sx={{
          position: "relative",
          overflow: "hidden",
          bgcolor: "#202020",
          color: "#ffffff",
          borderRadius: 4,
          p: { xs: 2.5, sm: 4 },
          mb: 3,
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "1.2fr 0.8fr" },
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

        <Box sx={{ position: "relative" }}>
          <Chip size="small" label={statusTone.label} sx={{ bgcolor: statusTone.bg, color: statusTone.fg, fontWeight: 700, mb: 1.5 }} />
          <Typography
            variant="h4"
            component="h1"
            sx={{
              fontFamily: '"Inter", sans-serif',
              fontWeight: 900,
              color: "#ffffff",
              fontSize: { xs: "1.6rem", sm: "2.1rem" },
              lineHeight: 1.15,
              wordBreak: "break-word",
            }}
          >
            Welcome, {adminName}
          </Typography>
          <Typography variant="body2" sx={{ color: "#cadcf6", mt: 1, maxWidth: 460 }}>
            {welcomeSubtitle}
          </Typography>
          <Button
            variant="contained"
            startIcon={<FactCheckOutlinedIcon />}
            onClick={() => navigate("/admin/owners")}
            sx={{ mt: 2.5, width: { xs: "100%", sm: "auto" }, fontWeight: 700 }}
          >
            {pendingCount > 0 ? "Review registrations" : "Manage owners"}
          </Button>
        </Box>

        <Box sx={{ position: "relative" }}>
          <ApprovalWindows approved={owners.approved} total={totalOwners} />
        </Box>
      </Box>

      {/* Top metrics — 2x2 on phones, 4 across on desktop */}
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2, 1fr)", md: "repeat(4, 1fr)" }, gap: { xs: 1.5, md: 2.5 }, mb: 4 }}>
        <MetricBox
          title="Pending Approvals"
          value={pendingCount}
          subtitle="Owners awaiting verification"
          subtitleColor={pendingCount > 0 ? "warning.main" : "text.secondary"}
          icon={<PersonAddIcon fontSize="small" />}
        />
        <MetricBox title="Approved Owners" value={owners.approved} subtitle="Active platform clients" icon={<SupervisorAccountOutlinedIcon fontSize="small" />} />
        <MetricBox title="Total Properties" value={totalProperties} subtitle="System-wide dorms/apts" icon={<MapsHomeWorkIcon fontSize="small" />} />
        <MetricBox title="Total Tenants" value={totalTenants} subtitle="Across all properties" icon={<GroupIcon fontSize="small" />} />
      </Box>

      {/* Bottom panels */}
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" }, gap: { xs: 2, md: 3 }, mb: 2, alignItems: "start" }}>
        {/* Left: pending registrations */}
        <Paper elevation={0} sx={panelSx}>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 1.5, mb: 2 }}>
            <Typography variant="h6" sx={panelTitleSx}>Needs Your Review</Typography>
            <Button size="small" variant="outlined" onClick={() => navigate("/admin/owners")}>
              View All
            </Button>
          </Box>

          {pendingPreview.length === 0 ? (
            <Box sx={{ textAlign: "center", py: 3 }}>
              <Box sx={{ width: 56, height: 56, borderRadius: "50%", mx: "auto", mb: 1.5, ...row, justifyContent: "center", bgcolor: (t) => alpha(t.palette.success.main, 0.12) }}>
                <TaskAltIcon sx={{ fontSize: 28, color: "success.main" }} />
              </Box>
              <Typography sx={{ fontWeight: 700 }}>All caught up</Typography>
              <Typography variant="body2" color="text.secondary">No pending registrations.</Typography>
            </Box>
          ) : (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
              {pendingPreview.map((owner) => {
                const name = ownerName(owner);
                return (
                  <Box
                    key={owner.id}
                    component="button"
                    type="button"
                    onClick={() => navigate("/admin/owners")}
                    sx={{
                      ...row,
                      gap: 1.5,
                      width: "100%",
                      textAlign: "left",
                      font: "inherit",
                      color: "inherit",
                      cursor: "pointer",
                      p: 1.5,
                      borderRadius: 2,
                      bgcolor: (t) => alpha(t.palette.background.paper, 0.35),
                      border: "1px solid",
                      borderColor: "divider",
                      transition: "border-color .15s",
                      "&:hover": { borderColor: "primary.main" },
                      "&:focus-visible": { outline: "2px solid", outlineColor: "primary.main", outlineOffset: 2 },
                    }}
                  >
                    <Avatar sx={{ width: 40, height: 40, bgcolor: "rgba(255, 69, 0, 0.12)", color: "primary.main", fontWeight: 800, fontSize: 15 }}>
                      {initials(name)}
                    </Avatar>
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Typography noWrap variant="subtitle2" sx={{ fontWeight: 700 }}>{name}</Typography>
                      <Typography variant="caption" color="text.secondary" noWrap component="div">
                        {owner.email || "No email"} · Applied {formatDate(owner.createdAt)}
                      </Typography>
                    </Box>
                    <Chip label="Pending" color="warning" size="small" sx={{ flexShrink: 0 }} />
                  </Box>
                );
              })}
              {pendingCount > pendingPreview.length && (
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textAlign: "center" }}>
                  +{pendingCount - pendingPreview.length} more waiting
                </Typography>
              )}
            </Box>
          )}
        </Paper>

        {/* Right: quick actions */}
        <Paper elevation={0} sx={panelSx}>
          <Typography variant="h6" sx={{ ...panelTitleSx, mb: 2 }}>Quick Actions</Typography>
          <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
            {QUICK_ACTIONS.map(({ label, hint, path, Icon }) => (
              <Box
                key={path}
                component="button"
                type="button"
                onClick={() => navigate(path)}
                sx={{
                  ...row,
                  gap: 1.5,
                  width: "100%",
                  textAlign: "left",
                  font: "inherit",
                  color: "inherit",
                  cursor: "pointer",
                  p: 1.5,
                  borderRadius: 2,
                  bgcolor: (t) => alpha(t.palette.background.paper, 0.35),
                  border: "1px solid",
                  borderColor: "divider",
                  transition: "border-color .15s",
                  "&:hover": { borderColor: "primary.main" },
                  "&:focus-visible": { outline: "2px solid", outlineColor: "primary.main", outlineOffset: 2 },
                }}
              >
                <Box sx={{ width: 40, height: 40, borderRadius: "50%", flexShrink: 0, ...row, justifyContent: "center", bgcolor: "rgba(255, 69, 0, 0.1)" }}>
                  <Icon sx={{ fontSize: 20, color: "primary.main" }} />
                </Box>
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>{label}</Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: "block", lineHeight: 1.35 }}>{hint}</Typography>
                </Box>
                <ArrowForwardIcon fontSize="small" sx={{ color: "text.secondary" }} />
              </Box>
            ))}
          </Box>
        </Paper>
      </Box>
    </Box>
  );
}