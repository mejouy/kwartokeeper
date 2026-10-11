import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Paper,
  Typography,
  Button,
  Chip,
  LinearProgress,
  Skeleton,
  Alert,
  InputBase,
  IconButton,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import AddIcon from "@mui/icons-material/Add";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import HomeWorkOutlinedIcon from "@mui/icons-material/HomeWorkOutlined";
import SearchIcon from "@mui/icons-material/Search";
import CloseIcon from "@mui/icons-material/Close";
import PlaceOutlinedIcon from "@mui/icons-material/PlaceOutlined";

import { db, auth } from "../../../config/firebase";
import { collection, query, where, getDocs } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { getPropertyCoverPhotoUrl } from "../../../utils/getPropertyCoverPhotoUrl";
import { formatPropertyAddress } from "../../../utils/formatPropertyAddress";

// Occupancy colour tiers (same rule as before: 80%+ is healthy, below is "room to fill").
const occupancyColor = (pct) => (pct >= 80 ? "success" : "warning");

// Every cover is the same height, with or without a photo, so tiles in a row
// always match instead of stretching to the tallest one.
const COVER_H = { xs: 120, sm: 130 };

const row = { display: "flex", alignItems: "center" };

// One compact strip instead of four tall tiles.
function SummaryStrip({ items }) {
  return (
    <Paper
      elevation={0}
      sx={{
        bgcolor: "background.default",
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 3,
        display: "grid",
        gridTemplateColumns: `repeat(${items.length}, 1fr)`,
        mb: { xs: 2, sm: 2.5 },
      }}
    >
      {items.map((item, i) => (
        <Box
          key={item.label}
          sx={{
            px: { xs: 1.5, sm: 2.5 },
            py: { xs: 1.25, sm: 1.75 },
            minWidth: 0,
            borderLeft: i === 0 ? "none" : "1px solid",
            borderColor: "divider",
          }}
        >
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }} noWrap component="div">
            {item.label}
          </Typography>
          <Typography noWrap sx={{ fontFamily: '"Inter", sans-serif', fontWeight: 800, fontSize: { xs: "1.15rem", sm: "1.45rem" }, lineHeight: 1.25 }}>
            {item.value}
            {item.suffix && (
              <Typography component="span" color="text.secondary" sx={{ fontWeight: 600, fontSize: "0.8em" }}>
                {" "}{item.suffix}
              </Typography>
            )}
          </Typography>
        </Box>
      ))}
    </Paper>
  );
}

function PropertyTile({ p, onOpen }) {
  const occ = p.totalBeds > 0 ? Math.min(Math.round(((p.occupiedBeds || 0) / p.totalBeds) * 100), 100) : 0;
  const coverPhotoUrl = getPropertyCoverPhotoUrl(p);
  const propertyName = p.propertyName || p.name || "Untitled Property";
  const place = formatPropertyAddress(p);

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
        bgcolor: "background.default",
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 3,
        overflow: "hidden",
        cursor: "pointer",
        display: "flex",
        flexDirection: "column",
        minWidth: 0,
        transition: "transform .18s ease, box-shadow .18s ease, border-color .18s ease",
        "&:hover, &:focus-visible": {
          borderColor: "primary.main",
          boxShadow: (t) => `0 10px 24px ${alpha(t.palette.common.black, 0.08)}`,
          transform: { sm: "translateY(-2px)" },
          outline: "none",
        },
        "&:hover .kk-arrow, &:focus-visible .kk-arrow": { color: "primary.main", transform: "translateX(3px)" },
      }}
    >
      {/* Cover: a real photo gets a proper banner; no photo gets a slim one
          (a big empty box says nothing). */}
      {coverPhotoUrl ? (
        <Box
          component="img"
          src={coverPhotoUrl}
          alt=""
          loading="lazy"
          sx={{ width: "100%", height: COVER_H, objectFit: "cover", display: "block", flexShrink: 0 }}
        />
      ) : (
        <Box
          sx={{
            height: COVER_H,
            flexShrink: 0,
            ...row,
            justifyContent: "center",
            bgcolor: "rgba(255, 69, 0, 0.07)",
          }}
        >
          <HomeWorkOutlinedIcon sx={{ color: "primary.main", fontSize: 38, opacity: 0.8 }} />
        </Box>
      )}

      <Box sx={{ p: 2, display: "flex", flexDirection: "column", gap: 1.5, flex: 1 }}>
        <Box sx={{ ...row, alignItems: "flex-start", justifyContent: "space-between", gap: 1 }}>
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontFamily: '"Inter", sans-serif', fontWeight: 700, fontSize: "1.05rem", lineHeight: 1.3 }} noWrap>
              {propertyName}
            </Typography>
            <Typography variant="body2" color="text.secondary" noWrap>
              {p.propertyType || "Dormitory"}
            </Typography>
            {["inactive", "archived", "deactivated"].includes(String(p.status || "Active").trim().toLowerCase()) && (
              <Chip label="Inactive" size="small" sx={{ mt: 0.75, fontWeight: 700, width: "fit-content" }} />
            )}
            {place && (
              <Box sx={{ ...row, gap: 0.5, color: "text.secondary", mt: 0.25, minWidth: 0 }}>
                <PlaceOutlinedIcon sx={{ fontSize: 15, flexShrink: 0 }} />
                <Typography variant="body2" noWrap>
                  {place}
                </Typography>
              </Box>
            )}
          </Box>
          <ArrowForwardIcon className="kk-arrow" sx={{ color: "text.disabled", fontSize: 20, mt: 0.5, flexShrink: 0, transition: "all .18s ease" }} />
        </Box>

        <Box sx={{ mt: "auto", pt: 0.5 }}>
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

function TileSkeleton() {
  return (
    <Paper elevation={0} sx={{ bgcolor: "background.default", border: "1px solid", borderColor: "divider", borderRadius: 3, overflow: "hidden" }}>
      <Skeleton variant="rectangular" sx={{ height: COVER_H }} />
      <Box sx={{ p: 2 }}>
        <Skeleton width="60%" height={28} />
        <Skeleton width="40%" />
        <Skeleton height={10} sx={{ mt: 2, borderRadius: 5 }} />
      </Box>
    </Paper>
  );
}

export default function PropertyList() {  const navigate = useNavigate();

  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Helper function to calculate total capacity across top-level fields or nested room arrays
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

  // Fetch properties and compute live occupancy from tenants collection
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

          // Map active tenant count by property ID
          const tenantCountByProperty = {};
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

          tenantsById.forEach((tData) => {
            const rawStatus = (tData.status || "active").toString().toLowerCase();

            // Count tenant if active and assigned to a property
            if (rawStatus !== "inactive" && rawStatus !== "archived") {
              if (tData.propertyId) {
                tenantCountByProperty[tData.propertyId] = (tenantCountByProperty[tData.propertyId] || 0) + 1;
              }
            }
          });

          if (isMounted) {
            const processedProps = propsSnapshot.docs.map((doc) => {
              const data = doc.data();
              const totalBeds = calculateTotalBeds(data);
              // Use live tenant count if available; fallback to document field
              const occupiedBeds = tenantCountByProperty[doc.id] ?? Number(data.occupiedBeds || 0);

              return {
                id: doc.id,
                ...data,
                totalBeds,
                occupiedBeds,
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
      } else {
        if (isMounted) {
          setProperties([]);
        }
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


  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return properties;
    return properties.filter((p) =>
      [p.propertyName, p.name, p.propertyType, p.address, p.city]
        .filter((v) => typeof v === "string")
        .some((v) => v.toLowerCase().includes(q))
    );
  }, [properties, search]);

  const totals = useMemo(() => {
    const activeProperties = properties.filter(
      (property) => !["inactive", "archived", "deactivated"].includes(String(property.status || "Active").trim().toLowerCase())
    );
    const beds = activeProperties.reduce((sum, p) => sum + (p.totalBeds || 0), 0);
    const occupied = activeProperties.reduce((sum, p) => sum + (p.occupiedBeds || 0), 0);
    return { beds, occupied, activeCount: activeProperties.length, pct: beds > 0 ? Math.min(Math.round((occupied / beds) * 100), 100) : 0 };
  }, [properties]);

  const openProperty = (id) => navigate(`/owner/properties/${id}`);

  return (
    <Box sx={{ minWidth: 0 }}>
      {/* The top bar already says "Properties", so the page only adds the
          one-line description and the primary action. */}
      <Box sx={{ ...row, justifyContent: "space-between", gap: 2, mb: { xs: 2, sm: 2.5 } }}>
        <Typography color="text.secondary" sx={{ minWidth: 0 }}>
          Manage buildings, rooms, and bed capacity
        </Typography>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => navigate("/setup")}
          sx={{ flexShrink: 0, fontWeight: 700, borderRadius: 2.5, display: { xs: "none", sm: "inline-flex" } }}
        >
          Add Property
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {!loading && properties.length > 0 && (
        <SummaryStrip
          items={[
            { label: "Active properties", value: totals.activeCount },
            { label: "Beds occupied", value: totals.occupied, suffix: `/ ${totals.beds}` },
            { label: "Occupancy", value: `${totals.pct}%` },
          ]}
        />
      )}

      {/* Search only earns its place once there are several properties */}
      {!loading && properties.length > 3 && (
        <Paper
          elevation={0}
          sx={{ ...row, gap: 1, px: 1.5, mb: { xs: 2, sm: 2.5 }, bgcolor: "background.default", border: "1px solid", borderColor: "divider", borderRadius: 3, height: 44 }}
        >
          <SearchIcon sx={{ color: "text.secondary" }} />
          <InputBase
            fullWidth
            placeholder="Search properties"
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
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", lg: "repeat(3, 1fr)" }, gap: 2.5 }}>
          {[0, 1, 2].map((i) => (
            <TileSkeleton key={i} />
          ))}
        </Box>
      ) : properties.length === 0 ? (
        <Paper elevation={0} sx={{ bgcolor: "background.default", border: "1px dashed", borderColor: "divider", borderRadius: 3, py: 7, px: 3, textAlign: "center" }}>
          <Box sx={{ width: 64, height: 64, borderRadius: "50%", mx: "auto", mb: 2, ...row, justifyContent: "center", bgcolor: "rgba(255, 69, 0, 0.10)" }}>
            <HomeWorkOutlinedIcon sx={{ fontSize: 32, color: "primary.main" }} />
          </Box>
          <Typography sx={{ fontWeight: 700, mb: 0.5 }}>No properties yet</Typography>
          <Typography color="text.secondary" variant="body2" sx={{ mb: 2.5 }}>
            Add your first property to start tracking rooms, beds, and tenants.
          </Typography>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => navigate("/setup")} sx={{ fontWeight: 700, borderRadius: 2.5 }}>
            Add Property
          </Button>
        </Paper>
      ) : filtered.length === 0 ? (
        <Paper elevation={0} sx={{ bgcolor: "background.default", border: "1px solid", borderColor: "divider", borderRadius: 3, py: 5, textAlign: "center" }}>
          <Typography sx={{ fontWeight: 700 }}>No matches for "{search}"</Typography>
          <Button size="small" onClick={() => setSearch("")} sx={{ mt: 1 }}>
            Clear search
          </Button>
        </Paper>
      ) : (
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "1fr", sm: "repeat(2, 1fr)", lg: "repeat(3, 1fr)" }, gap: { xs: 2, sm: 2.5 } }}>
          {filtered.map((p) => (
            <PropertyTile key={p.id} p={p} onOpen={() => openProperty(p.id)} />
          ))}
        </Box>
      )}

      {/* Phone: floating add button so the primary action stays reachable */}
      <Button
        variant="contained"
        onClick={() => navigate("/setup")}
        startIcon={<AddIcon />}
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
        Add Property
      </Button>
    </Box>
  );
}