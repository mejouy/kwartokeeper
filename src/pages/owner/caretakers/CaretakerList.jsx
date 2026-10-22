// src/pages/owner/caretakers/CaretakerList.jsx

import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Typography,
  Paper,
  Avatar,
  Button,
  Alert,
  Skeleton,
  InputBase,
  IconButton,
  Tooltip,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import PersonAddAltOutlinedIcon from "@mui/icons-material/PersonAddAltOutlined";
import SearchIcon from "@mui/icons-material/Search";
import CloseIcon from "@mui/icons-material/Close";
import ApartmentOutlinedIcon from "@mui/icons-material/ApartmentOutlined";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import SupervisorAccountOutlinedIcon from "@mui/icons-material/SupervisorAccountOutlined";
import HowToRegOutlinedIcon from "@mui/icons-material/HowToRegOutlined";
import MarkEmailUnreadOutlinedIcon from "@mui/icons-material/MarkEmailUnreadOutlined";
import DomainDisabledOutlinedIcon from "@mui/icons-material/DomainDisabledOutlined";
import PhoneOutlinedIcon from "@mui/icons-material/PhoneOutlined";
import PeopleAltOutlinedIcon from "@mui/icons-material/PeopleAltOutlined";
import NightsStayOutlinedIcon from "@mui/icons-material/NightsStayOutlined";
import BuildOutlinedIcon from "@mui/icons-material/BuildOutlined";
import PaymentsOutlinedIcon from "@mui/icons-material/PaymentsOutlined";
import MeetingRoomOutlinedIcon from "@mui/icons-material/MeetingRoomOutlined";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../../../config/firebase";
import { useAuth } from "../../../context/AuthContext";
import { withoutRemoved } from "../../../utils/accountState";

const HEAD = '"Inter", sans-serif';
const R = { sm: "10px", md: "14px", lg: "18px", xl: "22px" };
const row = { display: "flex", alignItems: "center" };
const panelSx = { bgcolor: "background.default", border: "1px solid", borderColor: "divider", borderRadius: R.lg };

// Every permission, in the order the invite form shows them
const PERMISSIONS = [
  { key: "manageTenants", label: "Manage tenants", icon: PeopleAltOutlinedIcon },
  { key: "logOccupancy", label: "Log occupancy & curfew", icon: NightsStayOutlinedIcon },
  { key: "handleReports", label: "Handle repair reports", icon: BuildOutlinedIcon },
  { key: "viewFinancials", label: "View financials", icon: PaymentsOutlinedIcon },
  { key: "modifyLayout", label: "Modify rooms & rates", icon: MeetingRoomOutlinedIcon },
];

const FILTERS = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "pending", label: "Not logged in yet" },
];

// A caretaker is "pending" until they log in and replace their temporary password
const isPending = (c) => Boolean(c.mustChangePassword);
const grantedCount = (c) => PERMISSIONS.filter((p) => c.permissions?.[p.key]).length;
const initialsOf = (name) =>
  String(name || "?").split(" ").filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("");

function StatusPill({ pending }) {
  const tone = pending ? "warning" : "success";
  return (
    <Box
      component="span"
      sx={{
        ...row,
        px: 1,
        height: 24,
        borderRadius: 99,
        fontSize: 12.5,
        fontWeight: 700,
        whiteSpace: "nowrap",
        flexShrink: 0,
        bgcolor: (t) => alpha(t.palette[tone].main, 0.12),
        color: (t) => t.palette[tone].dark,
      }}
    >
      {pending ? "Not logged in yet" : "Active"}
    </Box>
  );
}

/** One caretaker: who, where, how to reach them, and what they can do. */
function CaretakerCard({ caretaker, onOpen }) {
  const name = caretaker.name || caretaker.fullName || "Unnamed caretaker";
  const pending = isPending(caretaker);
  const count = grantedCount(caretaker);

  return (
    <Box
      component="button"
      type="button"
      onClick={onOpen}
      aria-label={`Manage ${name}`}
      sx={{
        ...panelSx,
        display: "flex",
        flexDirection: "column",
        gap: 1.5,
        p: 2,
        width: "100%",
        height: "100%",
        textAlign: "left",
        font: "inherit",
        color: "inherit",
        cursor: "pointer",
        transition: "border-color .15s, box-shadow .15s, transform .15s",
        "&:hover, &:focus-visible": { borderColor: "primary.main", boxShadow: "0 14px 30px -22px rgba(32,32,32,.5)", outline: "none" },
        "@media (hover: hover)": { "&:hover": { transform: "translateY(-2px)" } },
        "&:hover .kk-chev, &:focus-visible .kk-chev": { color: "primary.main", transform: "translateX(2px)" },
      }}
    >
      {/* Who */}
      <Box sx={{ ...row, gap: 1.5, width: "100%", minWidth: 0 }}>
        <Avatar sx={{ width: 44, height: 44, fontFamily: HEAD, fontWeight: 800, fontSize: "0.95rem", bgcolor: pending ? "warning.main" : "primary.main", color: "#fff" }}>
          {initialsOf(name)}
        </Avatar>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography sx={{ fontFamily: HEAD, fontWeight: 800, fontSize: "1rem", lineHeight: 1.25 }} noWrap>
            {name}
          </Typography>
          <Typography variant="caption" color="text.secondary" noWrap component="div">
            {caretaker.email || "No email"}
          </Typography>
        </Box>
        <ChevronRightIcon className="kk-chev" sx={{ color: "text.disabled", transition: "all .15s ease", flexShrink: 0 }} />
      </Box>

      {/* Where + status */}
      <Box sx={{ ...row, justifyContent: "space-between", gap: 1, width: "100%", flexWrap: "wrap" }}>
        <Box sx={{ ...row, gap: 0.75, minWidth: 0, color: caretaker.assignedPropertyId ? "text.primary" : "warning.dark" }}>
          <ApartmentOutlinedIcon sx={{ fontSize: 17, color: caretaker.assignedPropertyId ? "text.secondary" : "warning.main" }} />
          <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
            {caretaker.assignedPropertyId ? caretaker.propertyName || "Unknown property" : "No property assigned"}
          </Typography>
        </Box>
        <StatusPill pending={pending} />
      </Box>

      {/* Phone */}
      <Box sx={{ ...row, gap: 0.75, color: "text.secondary" }}>
        <PhoneOutlinedIcon sx={{ fontSize: 16 }} />
        <Typography variant="body2" color={caretaker.phone ? "text.primary" : "text.secondary"}>
          {caretaker.phone || "No phone number"}
        </Typography>
      </Box>

      {/* What they can do: every permission, on or off */}
      <Box sx={{ mt: "auto", pt: 1.25, width: "100%", borderTop: "1px solid", borderColor: "divider" }}>
        <Box sx={{ ...row, justifyContent: "space-between", mb: 0.75 }}>
          <Typography variant="caption" sx={{ fontWeight: 700, color: "text.secondary", letterSpacing: ".06em", textTransform: "uppercase" }}>
            Can do
          </Typography>
          <Typography variant="caption" sx={{ fontWeight: 700, color: count ? "text.secondary" : "warning.dark" }}>
            {count === 0 ? "No permissions yet" : `${count} of ${PERMISSIONS.length}`}
          </Typography>
        </Box>
        <Box sx={{ display: "flex", gap: 0.5 }}>
          {PERMISSIONS.map((p) => {
            const on = Boolean(caretaker.permissions?.[p.key]);
            const Icon = p.icon;
            return (
              <Tooltip key={p.key} title={`${p.label}: ${on ? "allowed" : "not allowed"}`}>
                <Box
                  aria-label={`${p.label}: ${on ? "allowed" : "not allowed"}`}
                  sx={{
                    width: 32,
                    height: 32,
                    borderRadius: "9px",
                    display: "grid",
                    placeItems: "center",
                    bgcolor: (t) => (on ? alpha(t.palette.primary.main, 0.12) : alpha(t.palette.text.primary, 0.04)),
                    color: on ? "primary.main" : "text.disabled",
                    border: "1px solid",
                    borderColor: on ? "transparent" : "divider",
                  }}
                >
                  <Icon sx={{ fontSize: 17 }} />
                </Box>
              </Tooltip>
            );
          })}
        </Box>
      </Box>
    </Box>
  );
}

export default function CaretakerList() {
  const navigate = useNavigate();
  const { currentUser } = useAuth() || {};

  const [caretakers, setCaretakers] = useState([]);
  const [properties, setProperties] = useState([]);
  // Nothing to load when signed out, so start "done" in that case
  const [loading, setLoading] = useState(() => Boolean(currentUser?.uid));
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    if (!currentUser?.uid) return undefined;
    let cancelled = false;

    (async () => {
      try {
        const uid = currentUser.uid;
        // Caretaker accounts carry both ownerUid and invitedBy; read both so
        // older records with only one of them are not missed.
        const [byInvite, byOwner, props] = await Promise.all([
          getDocs(query(collection(db, "users"), where("role", "==", "caretaker"), where("invitedBy", "==", uid))),
          getDocs(query(collection(db, "users"), where("role", "==", "caretaker"), where("ownerUid", "==", uid))).catch(() => null),
          // The owner's properties, read once (names + which have no caretaker)
          getDocs(query(collection(db, "properties"), where("ownerUid", "==", uid))),
        ]);
        if (cancelled) return;

        const propertyList = props.docs.map((d) => ({ id: d.id, ...d.data() }));
        const nameOf = new Map(propertyList.map((p) => [p.id, p.propertyName || p.name || "Unnamed property"]));

        const byId = new Map();
        [...byInvite.docs, ...(byOwner?.docs || [])].forEach((d) => byId.set(d.id, { id: d.id, ...d.data() }));
        setCaretakers(withoutRemoved([...byId.values()]).map((c) => ({ ...c, propertyName: c.assignedPropertyId ? nameOf.get(c.assignedPropertyId) || null : null })));
        setProperties(propertyList);
        setError(null);
      } catch (err) {
        console.error("Error loading caretakers:", err);
        if (!cancelled) setError("Failed to load caretakers. Please refresh and try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [currentUser?.uid]);

  const counts = useMemo(() => {
    const pending = caretakers.filter(isPending).length;
    return { all: caretakers.length, pending, active: caretakers.length - pending };
  }, [caretakers]);

  // Active properties nobody is looking after
  const uncovered = useMemo(() => {
    const covered = new Set(caretakers.map((c) => c.assignedPropertyId).filter(Boolean));
    return properties.filter(
      (p) => !covered.has(p.id) && !["inactive", "archived", "deactivated"].includes(String(p.status || "Active").trim().toLowerCase())
    );
  }, [caretakers, properties]);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return caretakers
      .filter((c) => {
        if (filter === "active" && isPending(c)) return false;
        if (filter === "pending" && !isPending(c)) return false;
        if (!term) return true;
        return [c.name, c.fullName, c.email, c.phone, c.propertyName].some((v) => String(v || "").toLowerCase().includes(term));
      })
      // by property, unassigned last, then by name
      .sort(
        (a, b) =>
          Number(!a.assignedPropertyId) - Number(!b.assignedPropertyId) ||
          String(a.propertyName || "").localeCompare(String(b.propertyName || "")) ||
          String(a.name || "").localeCompare(String(b.name || ""))
      );
  }, [caretakers, search, filter]);

  const isFiltering = Boolean(search.trim()) || filter !== "all";
  const clearFilters = () => {
    setSearch("");
    setFilter("all");
  };

  const goInvite = () => navigate("/owner/caretakers/invite");
  const open = (c) => navigate(`/owner/caretakers/${c.id}`);

  const tiles = [
    { label: "Caretakers", icon: <SupervisorAccountOutlinedIcon />, value: counts.all },
    { label: "Active", icon: <HowToRegOutlinedIcon />, value: counts.active, accent: counts.active > 0 ? "success.dark" : undefined },
    { label: "Not logged in yet", icon: <MarkEmailUnreadOutlinedIcon />, value: counts.pending, accent: counts.pending > 0 ? "warning.dark" : undefined },
    { label: "Properties without one", icon: <DomainDisabledOutlinedIcon />, value: uncovered.length, accent: uncovered.length > 0 ? "warning.dark" : undefined },
  ];

  return (
    <Box sx={{ minWidth: 0 }}>
      {/* HEADER: same pattern as the other owner pages */}
      <Paper elevation={0} component="section" sx={{ ...panelSx, borderRadius: R.xl, position: "relative", overflow: "hidden", p: { xs: 2, sm: 3 }, mb: { xs: 2, sm: 2.5 } }}>
        <Box aria-hidden sx={{ position: "absolute", top: -180, right: -120, width: 380, height: 380, borderRadius: "50%", background: "rgba(255,69,0,.10)", filter: "blur(70px)", pointerEvents: "none" }} />
        <Box sx={{ position: "relative", display: "flex", flexDirection: { xs: "column", sm: "row" }, alignItems: { xs: "stretch", sm: "center" }, justifyContent: "space-between", gap: { xs: 1.5, sm: 2 }, mb: { xs: 2, sm: 2.5 } }}>
          <Typography color="text.secondary" sx={{ minWidth: 0, fontSize: { xs: 14, sm: 15 } }}>
            The people helping run your properties, and what each one can do
          </Typography>
          <Button
            variant="contained"
            startIcon={<PersonAddAltOutlinedIcon />}
            onClick={goInvite}
            sx={{ flexShrink: 0, fontWeight: 700, borderRadius: R.sm, minHeight: 44, boxShadow: "0 10px 22px -14px rgba(255,69,0,.9)" }}
          >
            Invite caretaker
          </Button>
        </Box>
        <Box sx={{ position: "relative", display: "grid", gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", md: "repeat(4, minmax(0, 1fr))" }, gap: { xs: 1, sm: 1.5 } }}>
          {tiles.map((t) => (
            <Box key={t.label} sx={{ minWidth: 0, display: "flex", alignItems: "center", gap: 1.25, p: { xs: 1.25, sm: 1.75 }, borderRadius: R.md, bgcolor: (th) => alpha(th.palette.background.paper, 0.55) }}>
              <Box sx={{ width: { xs: 32, sm: 38 }, height: { xs: 32, sm: 38 }, flexShrink: 0, borderRadius: R.sm, display: "grid", placeItems: "center", bgcolor: "#fff", color: "primary.main", "& svg": { fontSize: { xs: 18, sm: 20 } } }}>
                {t.icon}
              </Box>
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="caption" color="text.secondary" noWrap sx={{ fontWeight: 600, display: "block" }}>
                  {t.label}
                </Typography>
                <Typography sx={{ fontFamily: HEAD, fontWeight: 800, letterSpacing: "-0.02em", fontSize: { xs: "1.2rem", sm: "1.45rem" }, lineHeight: 1.2, color: t.accent || "text.primary" }}>
                  {loading ? "–" : t.value}
                </Typography>
              </Box>
            </Box>
          ))}
        </Box>
      </Paper>

      {error && (
        <Alert severity="error" sx={{ mb: 2, borderRadius: R.md }}>
          {error}
        </Alert>
      )}

      {/* Properties nobody is looking after */}
      {!loading && !error && uncovered.length > 0 && caretakers.length > 0 && (
        <Alert
          severity="warning"
          icon={<DomainDisabledOutlinedIcon />}
          sx={{ mb: { xs: 2, sm: 2.5 }, borderRadius: R.md, alignItems: "center" }}
          action={
            <Button color="inherit" size="small" onClick={goInvite} sx={{ fontWeight: 700, whiteSpace: "nowrap" }}>
              Invite
            </Button>
          }
        >
          {uncovered.length === 1
            ? `${uncovered[0].propertyName || uncovered[0].name || "One property"} has no caretaker yet.`
            : `${uncovered.length} properties have no caretaker yet: ${uncovered.map((p) => p.propertyName || p.name || "Unnamed").join(", ")}.`}
        </Alert>
      )}

      {/* TOOLBAR: search + status */}
      {!loading && !error && caretakers.length > 0 && (
        <Box sx={{ display: "flex", flexDirection: { xs: "column", md: "row" }, alignItems: { md: "center" }, gap: 1.25, mb: { xs: 2, sm: 2.5 } }}>
          <Paper
            elevation={0}
            sx={{
              ...panelSx,
              ...row,
              gap: 1,
              px: 1.5,
              height: 44,
              borderRadius: R.sm,
              flex: { md: "0 1 340px" },
              minWidth: 0,
              transition: "border-color .15s, box-shadow .15s",
              "&:focus-within": { borderColor: "primary.main", boxShadow: "0 0 0 3px rgba(255,69,0,.12)" },
            }}
          >
            <SearchIcon sx={{ color: "text.secondary" }} />
            <InputBase fullWidth placeholder="Search name, email, phone or property" value={search} onChange={(e) => setSearch(e.target.value)} inputProps={{ "aria-label": "Search caretakers" }} />
            {search && (
              <IconButton size="small" aria-label="Clear search" onClick={() => setSearch("")}>
                <CloseIcon fontSize="small" />
              </IconButton>
            )}
          </Paper>

          <Box role="group" aria-label="Filter by status" sx={{ display: "flex", gap: 0.5, p: 0.5, ...panelSx, borderRadius: R.md, overflowX: "auto", scrollbarWidth: "none", "&::-webkit-scrollbar": { display: "none" } }}>
            {FILTERS.map((f) => {
              const on = filter === f.value;
              return (
                <Box
                  key={f.value}
                  component="button"
                  type="button"
                  aria-pressed={on}
                  onClick={() => setFilter(f.value)}
                  sx={{
                    ...row,
                    gap: 0.6,
                    px: 1.4,
                    height: 34,
                    border: 0,
                    borderRadius: R.sm,
                    cursor: "pointer",
                    flex: { xs: 1, md: "none" },
                    justifyContent: "center",
                    fontFamily: HEAD,
                    fontWeight: 700,
                    fontSize: 13.5,
                    whiteSpace: "nowrap",
                    color: on ? "primary.main" : "text.secondary",
                    bgcolor: on ? "rgba(255,69,0,.1)" : "transparent",
                    "&:hover": { color: on ? "primary.main" : "text.primary" },
                    "&:focus-visible": { outline: "2px solid", outlineColor: "primary.main", outlineOffset: 1 },
                  }}
                >
                  {f.label}
                  <Box component="span" sx={{ fontSize: 12, opacity: 0.7 }}>{counts[f.value]}</Box>
                </Box>
              );
            })}
          </Box>
        </Box>
      )}

      {/* CONTENT */}
      {loading ? (
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "repeat(2, minmax(0, 1fr))", lg: "repeat(3, minmax(0, 1fr))" }, gap: 2 }}>
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} variant="rounded" height={220} sx={{ borderRadius: R.lg }} />
          ))}
        </Box>
      ) : error ? null : caretakers.length === 0 ? (
        <Paper elevation={0} sx={{ ...panelSx, borderStyle: "dashed", py: 7, px: 3, textAlign: "center" }}>
          <Box sx={{ width: 64, height: 64, borderRadius: R.md, mx: "auto", mb: 2, ...row, justifyContent: "center", bgcolor: "rgba(255, 69, 0, 0.10)" }}>
            <SupervisorAccountOutlinedIcon sx={{ fontSize: 32, color: "primary.main" }} />
          </Box>
          <Typography sx={{ fontFamily: HEAD, fontWeight: 800, mb: 0.5 }}>No caretakers yet</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5, maxWidth: 420, mx: "auto" }}>
            Invite someone to help run a property: curfew checks, repairs, cash payments. You choose exactly what they can see and do.
          </Typography>
          <Button variant="contained" startIcon={<PersonAddAltOutlinedIcon />} onClick={goInvite} sx={{ fontWeight: 700, borderRadius: R.sm }}>
            Invite caretaker
          </Button>
        </Paper>
      ) : visible.length === 0 ? (
        <Paper elevation={0} sx={{ ...panelSx, py: 5, px: 2, textAlign: "center" }}>
          <Typography sx={{ fontWeight: 700 }}>No caretakers match</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Try a different search or filter.
          </Typography>
          <Button size="small" onClick={clearFilters} sx={{ mt: 1, fontWeight: 700 }}>
            Clear filters
          </Button>
        </Paper>
      ) : (
        <>
          {isFiltering && (
            <Box sx={{ ...row, justifyContent: "space-between", gap: 1, mb: 1.25 }}>
              <Typography variant="body2" color="text.secondary">
                Showing {visible.length} of {caretakers.length} caretakers
              </Typography>
              <Button size="small" onClick={clearFilters} sx={{ fontWeight: 700 }}>
                Clear filters
              </Button>
            </Box>
          )}
          <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "repeat(2, minmax(0, 1fr))", lg: "repeat(3, minmax(0, 1fr))" }, gap: 2 }}>
            {visible.map((c) => (
              <CaretakerCard key={c.id} caretaker={c} onOpen={() => open(c)} />
            ))}
          </Box>
        </>
      )}
    </Box>
  );
}
