import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Paper,
  Typography,
  Button,
  ButtonBase,
  LinearProgress,
  Skeleton,
  Alert,
  InputBase,
  IconButton,
  GlobalStyles,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import AddIcon from "@mui/icons-material/Add";
import AddHomeWorkOutlinedIcon from "@mui/icons-material/AddHomeWorkOutlined";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import HomeWorkOutlinedIcon from "@mui/icons-material/HomeWorkOutlined";
import SearchIcon from "@mui/icons-material/Search";
import CloseIcon from "@mui/icons-material/Close";
import PlaceOutlinedIcon from "@mui/icons-material/PlaceOutlined";
import BedOutlinedIcon from "@mui/icons-material/BedOutlined";
import MeetingRoomOutlinedIcon from "@mui/icons-material/MeetingRoomOutlined";
import PieChartOutlineRoundedIcon from "@mui/icons-material/PieChartOutlineRounded";

import { db, auth } from "../../../config/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { getPropertyCoverPhotoUrl } from "../../../utils/getPropertyCoverPhotoUrl";
import { formatPropertyAddress } from "../../../utils/formatPropertyAddress";
import { occupancyOf as bedOccupancy } from "../../../utils/occupancy";

const INK = "#202020";
const ORANGE = "#ff4500";
const HEAD = '"Inter", sans-serif';
const R = { sm: "10px", md: "14px", lg: "18px", xl: "22px" };
const panelSx = { bgcolor: "background.default", border: "1px solid", borderColor: "divider", borderRadius: R.lg };

// Same statuses everywhere on this page
const INACTIVE_PROPERTY = ["inactive", "archived", "deactivated"];
const isInactiveProperty = (p) => INACTIVE_PROPERTY.includes(String(p.status || "Active").trim().toLowerCase());
// Same rule as reconcilePropertyOccupancy (what Register Tenant / Tenant Detail use)

const NO_ADDRESS = "No address specified";

// Occupancy colour tiers: 80%+ is healthy, below is "room to fill".
const occupancyColor = (pct) => (pct >= 80 ? "success" : "warning");

// Every cover is the same height, with or without a photo, so tiles in a row
// always match instead of stretching to the tallest one.
const COVER_H = { xs: 136, sm: 150 };

const row = { display: "flex", alignItems: "center" };

const occupancyOf = (p) => (p.totalBeds > 0 ? Math.min(Math.round(((p.occupiedBeds || 0) / p.totalBeds) * 100), 100) : 0);

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

/* ---------------------------------------------------------------------------
   Header: a light card with a soft orange glow, the headline number, the main
   action, and four stat tiles. Occupancy is drawn as a row of room squares.
   ------------------------------------------------------------------------- */
const MINI_SQUARES = 10;

function MiniSquares({ pct }) {
  const lit = pct > 0 ? Math.max(1, Math.round((pct / 100) * MINI_SQUARES)) : 0;
  return (
    <Box aria-hidden sx={{ display: "grid", gridTemplateColumns: `repeat(${MINI_SQUARES}, minmax(0, 1fr))`, gap: "3px", mt: 0.75, maxWidth: 150 }}>
      {Array.from({ length: MINI_SQUARES }).map((_, i) => (
        <Box key={i} sx={{ aspectRatio: "1", borderRadius: "3px", bgcolor: i < lit ? ORANGE : (t) => alpha(t.palette.text.primary, 0.09), animation: `kkPop .35s ease-out ${i * 30}ms both` }} />
      ))}
    </Box>
  );
}

function PortfolioHeader({ totals, total, onAdd, loading }) {
  const open = Math.max(totals.beds - totals.occupied, 0);
  const tiles = [
    { label: "Properties", icon: <HomeWorkOutlinedIcon />, value: totals.activeCount, suffix: totals.activeCount !== total ? `of ${total}` : "" },
    { label: "Beds filled", icon: <BedOutlinedIcon />, value: totals.occupied, suffix: `/ ${totals.beds}` },
    { label: "Beds open", icon: <MeetingRoomOutlinedIcon />, value: open, accent: open > 0 },
    { label: "Occupancy", icon: <PieChartOutlineRoundedIcon />, value: `${totals.pct}%`, squares: true },
  ];

  return (
    <Paper
      component="section"
      elevation={0}
      sx={{ ...panelSx, position: "relative", overflow: "hidden", borderRadius: R.xl, p: { xs: 2, sm: 3 }, mb: { xs: 2, sm: 2.5 } }}
    >
      <Box aria-hidden sx={{ position: "absolute", top: -180, right: -120, width: 380, height: 380, borderRadius: "50%", background: "rgba(255,69,0,.10)", filter: "blur(70px)", pointerEvents: "none" }} />

      <Box sx={{ position: "relative", display: "flex", flexDirection: { xs: "column", sm: "row" }, alignItems: { xs: "stretch", sm: "center" }, justifyContent: "space-between", gap: { xs: 1.5, sm: 2 }, mb: { xs: 2, sm: 2.5 } }}>
        <Typography color="text.secondary" sx={{ minWidth: 0, fontSize: { xs: 14, sm: 15 } }}>
          Manage buildings, rooms, and bed capacity
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={onAdd}
          sx={{ flexShrink: 0, fontWeight: 700, borderRadius: R.sm, minHeight: 44, boxShadow: "0 10px 22px -14px rgba(255,69,0,.9)" }}
        >
          Add Property
        </Button>
      </Box>

      <Box sx={{ position: "relative", display: "grid", gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", md: "repeat(4, minmax(0, 1fr))" }, gap: { xs: 1, sm: 1.5 } }}>
        {tiles.map((t) => (
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
              {t.squares && !loading && <MiniSquares pct={totals.pct} />}
            </Box>
          </Box>
        ))}
      </Box>
    </Paper>
  );
}

/* ---------------------------------------------------------------------------
   Cover for a property without a photo: a little building of room squares,
   lit to match its occupancy (same motif as the dashboard and login pages).
   ------------------------------------------------------------------------- */
const COVER_SQUARES = 24; // 8 x 3
const LIGHT_ORDER = [5, 17, 2, 11, 22, 8, 14, 0, 19, 6, 12, 23, 3, 16, 9, 20, 1, 13, 7, 18, 10, 21, 4, 15];
const SQUARE_RANK = LIGHT_ORDER.reduce((acc, cell, rank) => ({ ...acc, [cell]: rank }), {});

function SquaresCover({ occ, inactive }) {
  const lit = occ > 0 ? Math.max(1, Math.round((occ / 100) * COVER_SQUARES)) : 0;
  return (
    <Box sx={{ position: "absolute", inset: 0, bgcolor: INK, display: "grid", placeItems: "center", overflow: "hidden" }}>
      <Box aria-hidden sx={{ position: "absolute", top: -80, right: -60, width: 200, height: 200, borderRadius: "50%", background: "rgba(255,69,0,.22)", filter: "blur(50px)" }} />
      <Box sx={{ position: "relative", display: "grid", gridTemplateColumns: "repeat(8, 16px)", gap: "6px", mt: 3 }}>
        {Array.from({ length: COVER_SQUARES }).map((_, i) => (
          <Box
            key={i}
            sx={{
              width: 16,
              height: 16,
              borderRadius: "4px",
              bgcolor: !inactive && SQUARE_RANK[i] < lit ? ORANGE : "rgba(202,220,246,.16)",
              animation: `kkPop .4s ease-out ${i * 15}ms both`,
            }}
          />
        ))}
      </Box>
    </Box>
  );
}

function PropertyTile({ p, onOpen }) {
  const occ = occupancyOf(p);
  const coverPhotoUrl = getPropertyCoverPhotoUrl(p);
  const propertyName = p.propertyName || p.name || "Untitled Property";
  const place = formatPropertyAddress(p);
  const inactive = isInactiveProperty(p);
  const rooms = Array.isArray(p.rooms) ? p.rooms.length : Number(p.totalRooms) || 0;
  const vacant = Math.max((p.totalBeds || 0) - (p.occupiedBeds || 0), 0);

  return (
    <Paper
      elevation={0}
      onClick={onOpen}
      role="link"
      tabIndex={0}
      aria-label={`Open ${propertyName}`}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      sx={{
        ...panelSx,
        overflow: "hidden",
        cursor: "pointer",
        display: "flex",
        flexDirection: "column",
        minWidth: 0,
        height: "100%",
        transition: "transform .18s ease, box-shadow .18s ease, border-color .18s ease",
        "&:hover, &:focus-visible": {
          borderColor: "primary.main",
          boxShadow: "0 18px 34px -22px rgba(32,32,32,.5)",
          transform: { sm: "translateY(-3px)" },
          outline: "none",
        },
        "&:hover .kk-photo": { transform: "scale(1.04)" },
        "&:hover .kk-arrow, &:focus-visible .kk-arrow": { color: "#fff", bgcolor: "primary.main", borderColor: "primary.main" },
      }}
    >
      {/* Cover */}
      <Box sx={{ position: "relative", height: COVER_H, flexShrink: 0, overflow: "hidden" }}>
        {coverPhotoUrl ? (
          <>
            <Box
              className="kk-photo"
              component="img"
              src={coverPhotoUrl}
              alt=""
              loading="lazy"
              sx={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", display: "block", transition: "transform .4s ease", filter: inactive ? "grayscale(1)" : "none" }}
            />
            <Box aria-hidden sx={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(0,0,0,.28) 0%, rgba(0,0,0,0) 40%)" }} />
          </>
        ) : (
          <SquaresCover occ={occ} inactive={inactive} />
        )}

        {/* type + status labels */}
        <Box sx={{ position: "absolute", top: 10, left: 10, right: 10, ...row, gap: 0.75, flexWrap: "wrap" }}>
          <Box sx={{ px: 1, py: 0.3, borderRadius: "6px", bgcolor: "rgba(255,255,255,.94)", fontSize: 11.5, fontWeight: 700, color: INK }}>
            {p.propertyType || "Dormitory"}
          </Box>
          {inactive && (
            <Box sx={{ px: 1, py: 0.3, borderRadius: "6px", bgcolor: "rgba(32,32,32,.88)", border: "1px solid rgba(255,255,255,.25)", fontSize: 11.5, fontWeight: 700, color: "#fff" }}>
              Inactive
            </Box>
          )}
        </Box>
      </Box>

      <Box sx={{ p: 2, display: "flex", flexDirection: "column", gap: 1.75, flex: 1, minWidth: 0 }}>
        {/* name + address */}
        <Box sx={{ ...row, alignItems: "flex-start", justifyContent: "space-between", gap: 1 }}>
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontFamily: HEAD, fontWeight: 800, letterSpacing: "-0.01em", fontSize: "1.1rem", lineHeight: 1.3 }} noWrap>
              {propertyName}
            </Typography>
            <Box sx={{ ...row, gap: 0.5, color: "text.secondary", mt: 0.25, minWidth: 0 }}>
              <PlaceOutlinedIcon sx={{ fontSize: 15, flexShrink: 0 }} />
              <Typography variant="body2" noWrap sx={{ fontStyle: place === NO_ADDRESS ? "italic" : "normal" }}>
                {place}
              </Typography>
            </Box>
          </Box>
          <Box className="kk-arrow" sx={{ width: 32, height: 32, borderRadius: "50%", flexShrink: 0, display: "grid", placeItems: "center", color: "text.secondary", border: "1px solid", borderColor: "divider", transition: "all .18s ease" }}>
            <ArrowForwardIcon sx={{ fontSize: 17 }} />
          </Box>
        </Box>

        {/* numbers */}
        <Box sx={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", borderRadius: R.md, bgcolor: (t) => alpha(t.palette.background.paper, 0.55) }}>
          {[
            ["Rooms", rooms],
            ["Beds", p.totalBeds || 0],
            ["Vacant", vacant],
          ].map(([label, value], i) => (
            <Box key={label} sx={{ px: 1.25, py: 1, minWidth: 0, borderLeft: i ? "1px solid" : "none", borderColor: "divider" }}>
              <Typography sx={{ fontFamily: HEAD, fontWeight: 800, fontSize: "1.05rem", lineHeight: 1.2, color: label === "Vacant" && value > 0 ? "primary.main" : "text.primary" }}>
                {value}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }} noWrap component="div">
                {label}
              </Typography>
            </Box>
          ))}
        </Box>

        {/* occupancy */}
        <Box sx={{ mt: "auto" }}>
          {p.totalBeds > 0 ? (
            <>
              <Box sx={{ ...row, justifyContent: "space-between", gap: 1, mb: 0.75 }}>
                <Typography variant="caption" sx={{ fontWeight: 600, color: "text.secondary" }}>
                  {p.occupiedBeds || 0} of {p.totalBeds} beds occupied
                </Typography>
                <Typography variant="caption" sx={{ fontWeight: 800 }}>
                  {occ}%
                </Typography>
              </Box>
              <LinearProgress
                variant="determinate"
                value={occ}
                color={occupancyColor(occ)}
                sx={{ height: 8, borderRadius: 4, bgcolor: (t) => alpha(t.palette.text.primary, 0.08) }}
              />
            </>
          ) : (
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
              No beds set up yet
            </Typography>
          )}
        </Box>
      </Box>
    </Paper>
  );
}

/** Dashed "add" tile that closes the grid. */
function AddTile({ onAdd }) {
  return (
    <ButtonBase
      onClick={onAdd}
      sx={{
        display: { xs: "none", sm: "flex" },
        flexDirection: "column",
        gap: 1.25,
        minHeight: 300,
        height: "100%",
        borderRadius: R.lg,
        border: "2px dashed",
        borderColor: "divider",
        color: "text.secondary",
        transition: "border-color .15s, color .15s, background-color .15s",
        "&:hover, &.Mui-focusVisible": { borderColor: "primary.main", color: "primary.main", bgcolor: "rgba(255,69,0,.03)" },
      }}
    >
      <Box sx={{ width: 52, height: 52, borderRadius: R.md, display: "grid", placeItems: "center", bgcolor: "rgba(255,69,0,.1)", color: "primary.main" }}>
        <AddHomeWorkOutlinedIcon />
      </Box>
      <Typography sx={{ fontFamily: HEAD, fontWeight: 800, color: "inherit" }}>Add a property</Typography>
      <Typography variant="caption" sx={{ color: "text.secondary", maxWidth: 220, textAlign: "center" }}>
        Set up its rooms and beds in a few steps
      </Typography>
    </ButtonBase>
  );
}

function TileSkeleton() {
  return (
    <Paper elevation={0} sx={{ ...panelSx, overflow: "hidden" }}>
      <Skeleton variant="rectangular" sx={{ height: COVER_H }} />
      <Box sx={{ p: 2 }}>
        <Skeleton width="60%" height={28} />
        <Skeleton width="40%" />
        <Skeleton variant="rounded" height={52} sx={{ mt: 1.5, borderRadius: R.md }} />
        <Skeleton height={10} sx={{ mt: 2, borderRadius: 5 }} />
      </Box>
    </Paper>
  );
}

// Total capacity from the rooms list, else from a top-level field
const calculateTotalBeds = (data) => {
  let roomCapacity = 0;
  if (Array.isArray(data.rooms) && data.rooms.length > 0) {
    data.rooms.forEach((room) => {
      roomCapacity += Number(room.capacity || room.beds || room.totalBeds || 0);
    });
  }

  const topLevelCapacity =
    Number(data.totalBeds) ||
    Number(data.capacity) ||
    Number(data.beds) ||
    Number(data.totalCapacity) ||
    0;

  return roomCapacity > 0 ? roomCapacity : topLevelCapacity;
};

const GRID = { display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "repeat(2, minmax(0, 1fr))", lg: "repeat(3, minmax(0, 1fr))" }, gap: { xs: 2, sm: 2.5 } };

export default function PropertyList() {
  const navigate = useNavigate();

  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");

  // Fetch properties and compute live occupancy from the tenant records
  useEffect(() => {
    let isMounted = true;

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          // 1. Fetch properties for this owner
          const propsQuery = query(collection(db, "properties"), where("ownerUid", "==", user.uid));
          const propsSnapshot = await getDocs(propsQuery);

          // Include older tenant records linked by propertyId but missing ownerUid.
          const propertyIds = propsSnapshot.docs.map((propertyDoc) => propertyDoc.id);
          const tenantSnapshots = await Promise.all([
            getDocs(query(collection(db, "tenants"), where("ownerUid", "==", user.uid))),
            ...propertyIds.flatMap((propertyId) => [
              getDocs(query(collection(db, "tenants"), where("propertyId", "==", propertyId))),
              getDocs(query(collection(db, "users"), where("propertyId", "==", propertyId))),
            ]),
          ]);

          // One record per tenant, merged across the sources
          const tenantsById = new Map();
          tenantSnapshots.forEach((snapshot) => {
            snapshot.docs.forEach((tenantDoc) => {
              const tenant = { id: tenantDoc.id, ...tenantDoc.data() };
              if (tenant.role && tenant.role !== "tenant") return;
              const tenantId = tenant.uid || tenant.id;
              tenantsById.set(tenantId, {
                ...(tenantsById.get(tenantId) || {}),
                ...tenant,
              });
            });
          });

          // Occupied beds per property: same rule as the dashboard and reports
          const occ = bedOccupancy(
            propsSnapshot.docs.map((propertyDoc) => ({ id: propertyDoc.id, beds: calculateTotalBeds(propertyDoc.data()) })),
            [...tenantsById.values()]
          );

          if (isMounted) {
            const processedProps = propsSnapshot.docs.map((propertyDoc) => {
              const data = propertyDoc.data();
              return {
                id: propertyDoc.id,
                ...data,
                totalBeds: calculateTotalBeds(data),
                // Every tenant source for this property was read above, so "none
                // found" really means 0 (not the possibly stale stored field).
                occupiedBeds: occ.byProperty.get(propertyDoc.id)?.occupied || 0,
              };
            });

            setProperties(processedProps);
            setError(null);
          }
        } catch (err) {
          console.error("Error fetching properties/tenants:", err);
          if (isMounted) {
            setError("Failed to load properties. Please try again.");
          }
        }
      } else if (isMounted) {
        setProperties([]);
      }

      if (isMounted) {
        setLoading(false);
      }
    });

    return () => {
      isMounted = false;
      unsubscribe();
    };
  }, []);

  // Active properties first, then A–Z
  const sorted = useMemo(
    () =>
      [...properties].sort(
        (a, b) =>
          Number(isInactiveProperty(a)) - Number(isInactiveProperty(b)) ||
          String(a.propertyName || a.name || "").localeCompare(String(b.propertyName || b.name || ""))
      ),
    [properties]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sorted;
    return sorted.filter((p) =>
      // the formatted address covers both string and structured addresses
      [p.propertyName, p.name, p.propertyType, formatPropertyAddress(p)]
        .filter((v) => typeof v === "string")
        .some((v) => v.toLowerCase().includes(q))
    );
  }, [sorted, search]);

  const totals = useMemo(() => {
    const activeProperties = properties.filter((property) => !isInactiveProperty(property));
    const beds = activeProperties.reduce((sum, p) => sum + (p.totalBeds || 0), 0);
    const occupied = activeProperties.reduce((sum, p) => sum + (p.occupiedBeds || 0), 0);
    return { beds, occupied, activeCount: activeProperties.length, pct: beds > 0 ? Math.min(Math.round((occupied / beds) * 100), 100) : 0 };
  }, [properties]);

  const openProperty = (id) => navigate(`/owner/properties/${id}`);
  const addProperty = () => navigate("/setup");

  return (
    <Box sx={{ minWidth: 0, }}>
      {AnimationStyles}

      {(loading || properties.length > 0) && (
        <PortfolioHeader totals={totals} total={properties.length} onAdd={addProperty} loading={loading} />
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 3, borderRadius: R.md }}>
          {error}
        </Alert>
      )}

      {/* Search only earns its place once there are several properties */}
      {!loading && properties.length > 3 && (
        <Paper
          elevation={0}
          sx={{
            ...panelSx,
            ...row,
            gap: 1,
            px: 1.5,
            mb: { xs: 2, sm: 2.5 },
            height: 48,
            transition: "border-color .15s, box-shadow .15s",
            "&:focus-within": { borderColor: "primary.main", boxShadow: "0 0 0 3px rgba(255,69,0,.12)" },
          }}
        >
          <SearchIcon sx={{ color: "text.secondary" }} />
          <InputBase
            fullWidth
            placeholder="Search by name, type or address"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            inputProps={{ "aria-label": "Search properties" }}
          />
          {search && (
            <IconButton size="small" aria-label="Clear search" onClick={() => setSearch("")}>
              <CloseIcon fontSize="small" />
            </IconButton>
          )}
        </Paper>
      )}

      {loading ? (
        <Box sx={GRID}>
          {[0, 1, 2].map((i) => (
            <TileSkeleton key={i} />
          ))}
        </Box>
      ) : properties.length === 0 ? (
        <Paper elevation={0} sx={{ ...panelSx, borderStyle: "dashed", py: 7, px: 3, textAlign: "center" }}>
          <Box sx={{ width: 64, height: 64, borderRadius: R.md, mx: "auto", mb: 2, ...row, justifyContent: "center", bgcolor: "rgba(255, 69, 0, 0.10)" }}>
            <HomeWorkOutlinedIcon sx={{ fontSize: 32, color: "primary.main" }} />
          </Box>
          <Typography sx={{ fontFamily: HEAD, fontWeight: 800, mb: 0.5 }}>No properties yet</Typography>
          <Typography color="text.secondary" variant="body2" sx={{ mb: 2.5 }}>
            Add your first property to start tracking rooms, beds, and tenants.
          </Typography>
          <Button variant="contained" startIcon={<AddIcon />} onClick={addProperty} sx={{ fontWeight: 700, borderRadius: R.sm }}>
            Add Property
          </Button>
        </Paper>
      ) : filtered.length === 0 ? (
        <Paper elevation={0} sx={{ ...panelSx, py: 5, px: 2, textAlign: "center" }}>
          <Typography sx={{ fontWeight: 700, overflowWrap: "anywhere" }}>No matches for “{search}”</Typography>
          <Button size="small" onClick={() => setSearch("")} sx={{ mt: 1 }}>
            Clear search
          </Button>
        </Paper>
      ) : (
        <>
          {search && (
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
              {filtered.length} of {properties.length} properties
            </Typography>
          )}
          <Box sx={GRID}>
            {filtered.map((p) => (
              <PropertyTile key={p.id} p={p} onOpen={() => openProperty(p.id)} />
            ))}
            {!search && <AddTile onAdd={addProperty} />}
          </Box>
        </>
      )}

    </Box>
  );
}
