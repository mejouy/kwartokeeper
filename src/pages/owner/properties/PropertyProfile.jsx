import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Box, Typography, Button, IconButton, Chip, CircularProgress, Paper,
  TextField, ToggleButton, ToggleButtonGroup, Divider, Alert, Drawer,
  Skeleton, useMediaQuery, GlobalStyles,
} from "@mui/material";
import { alpha } from "@mui/material/styles";

import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import EditIcon from "@mui/icons-material/Edit";
import PolicyOutlinedIcon from "@mui/icons-material/PolicyOutlined";
import WifiOutlinedIcon from "@mui/icons-material/WifiOutlined";
import InsertDriveFileOutlinedIcon from "@mui/icons-material/InsertDriveFileOutlined";
import GridViewOutlinedIcon from "@mui/icons-material/GridViewOutlined";
import HandymanOutlinedIcon from "@mui/icons-material/HandymanOutlined";
import CloseIcon from "@mui/icons-material/Close";
import SaveIcon from "@mui/icons-material/Save";
import PlaceOutlinedIcon from "@mui/icons-material/PlaceOutlined";
import TouchAppOutlinedIcon from "@mui/icons-material/TouchAppOutlined";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutlined";
import MeetingRoomOutlinedIcon from "@mui/icons-material/MeetingRoomOutlined";
import BedOutlinedIcon from "@mui/icons-material/BedOutlined";
import PeopleOutlinedIcon from "@mui/icons-material/PeopleOutlined";
import OpenInNewRoundedIcon from "@mui/icons-material/OpenInNewRounded";

import { collection, doc, getDoc, onSnapshot, query, where, updateDoc } from "firebase/firestore";
import { db } from "../../../config/firebase";
import { getPropertyCoverPhotoUrl } from "../../../utils/getPropertyCoverPhotoUrl";
import { formatPropertyAddress } from "../../../utils/formatPropertyAddress";
import { holdsBed } from "../../../utils/occupancy";
import { withoutRemoved } from "../../../utils/accountState";

const INK = "#202020";
const ORANGE = "#ff4500";
const HEAD = '"Inter", sans-serif';
const R = { sm: "10px", md: "14px", lg: "18px", xl: "22px" };

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

// Date formatting helper
const formatDate = (value) => {
  if (!value) return null;
  try {
    const date = typeof value?.toDate === "function" ? value.toDate() : new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return null;
  }
};

const getMoveOutDate = (tenant) =>
  formatDate(tenant?.leaseEndDate || tenant?.moveOutDate || tenant?.leaseEnd || tenant?.endDate);

const peso = (n) => `₱${Number(n || 0).toLocaleString()}`;

// One rule for a room's bed count, used by the tiles, the panel and the totals
const capacityOf = (room) => Number(room?.capacity || room?.beds || room?.totalBeds || 0);
const isMaintenance = (room) => room?.status === "maintenance" || Boolean(room?.underMaintenance);
const roomKey = (room) => String(room?.roomName || room?.roomNumber || room?.id || "");

// Same rule as everywhere else: Active and Pending tenants hold their bed
const isActiveTenant = holdsBed;

// Calculate status: vacant | partial | full | maintenance
const getRoomStatus = (room, roomTenants) => {
  if (isMaintenance(room)) return "maintenance";
  const capacity = capacityOf(room);
  const occupied = roomTenants.length;
  if (occupied === 0) return "vacant";
  if (capacity > 0 && occupied >= capacity) return "full";
  return "partial";
};

const STATUS_STYLES = {
  vacant: { fill: "rgba(202, 220, 246, 0.55)", label: "Vacant", text: "text.primary" },
  partial: { fill: "rgba(255, 69, 0, 0.45)", label: "Partially occupied", text: "text.primary" },
  full: { fill: ORANGE, label: "Fully occupied", text: "#ffffff" },
  maintenance: { fill: "rgba(0, 0, 0, 0.12)", label: "Under maintenance", text: "text.primary" },
};

const row = { display: "flex", alignItems: "center" };

// Desktop details card: always this tall (and never taller than the viewport).
const DETAILS_CARD_H = "min(500px, calc(100vh - 128px))";

// Which active tenants live in a room
const getRoomTenants = (room, tenants) => {
  const name = roomKey(room);
  return tenants.filter((tenant) => {
    if (!isActiveTenant(tenant)) return false;
    const assignedRoom = tenant.roomId || tenant.roomNumber || tenant.room || "";
    return String(assignedRoom) === name;
  });
};

const cardSx = {
  bgcolor: "background.default",
  border: "1px solid",
  borderColor: "divider",
  borderRadius: R.lg,
};

function SectionTitle({ icon, children, aside }) {
  return (
    <Box sx={{ ...row, justifyContent: "space-between", gap: 1, mb: 2 }}>
      <Box sx={{ ...row, gap: 1.25, minWidth: 0 }}>
        <Box sx={{ width: 34, height: 34, borderRadius: R.sm, flexShrink: 0, display: "grid", placeItems: "center", bgcolor: "rgba(255,69,0,.1)", color: "primary.main", "& svg": { fontSize: 19 } }}>
          {icon}
        </Box>
        <Typography component="h2" sx={{ fontFamily: HEAD, fontWeight: 800, fontSize: "1.08rem", letterSpacing: "-0.01em" }} noWrap>
          {children}
        </Typography>
      </Box>
      {aside}
    </Box>
  );
}

/* ---------------------------------------------------------------------------
   Cover banner: the photo (or the lit-squares building used on the property
   list) with the name, type and address on top.
   ------------------------------------------------------------------------- */
const COVER_SQUARES = 32; // 16 x 2
function SquaresBackdrop({ pct }) {
  const lit = pct > 0 ? Math.max(1, Math.round((pct / 100) * COVER_SQUARES)) : 0;
  const order = [5, 22, 13, 30, 2, 18, 9, 27, 15, 0, 24, 11, 6, 29, 19, 3, 26, 14, 8, 21, 31, 1, 17, 10, 28, 4, 23, 12, 7, 25, 16, 20];
  const rank = order.reduce((acc, cell, r) => ({ ...acc, [cell]: r }), {});
  return (
    <Box aria-hidden sx={{ position: "absolute", top: { xs: 18, sm: 24 }, right: { xs: -40, sm: 24 }, display: "grid", gridTemplateColumns: "repeat(16, 18px)", gap: "7px", opacity: 0.9 }}>
      {Array.from({ length: COVER_SQUARES }).map((_, i) => (
        <Box key={i} sx={{ width: 18, height: 18, borderRadius: "4px", bgcolor: rank[i] < lit ? ORANGE : "rgba(202,220,246,.14)", animation: `kkPop .4s ease-out ${i * 14}ms both` }} />
      ))}
    </Box>
  );
}

function CoverBanner({ property, coverPhotoUrl, occPct, onBack, onEdit }) {
  return (
    <Box
      component="section"
      sx={{ position: "relative", overflow: "hidden", borderRadius: R.xl, bgcolor: INK, color: "#fff", minHeight: { xs: 200, sm: 240 }, display: "flex", flexDirection: "column", justifyContent: "space-between", p: { xs: 2, sm: 3 }, mb: { xs: 2, md: 2.5 } }}
    >
      {coverPhotoUrl ? (
        <>
          <Box component="img" src={coverPhotoUrl} alt="" sx={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
          <Box aria-hidden sx={{ position: "absolute", inset: 0, background: "linear-gradient(180deg, rgba(0,0,0,.35) 0%, rgba(0,0,0,0) 35%, rgba(0,0,0,.72) 100%)" }} />
        </>
      ) : (
        <>
          <Box aria-hidden sx={{ position: "absolute", top: -200, right: -140, width: 440, height: 440, borderRadius: "50%", background: "rgba(255,69,0,.24)", filter: "blur(100px)" }} />
          <SquaresBackdrop pct={occPct} />
        </>
      )}

      {/* top row: back + edit */}
      <Box sx={{ position: "relative", ...row, justifyContent: "space-between", gap: 1 }}>
        <IconButton aria-label="Back to properties" onClick={onBack} sx={{ color: "#fff", bgcolor: "rgba(0,0,0,.35)", backdropFilter: "blur(6px)", "&:hover": { bgcolor: "rgba(0,0,0,.5)" } }}>
          <ArrowBackIcon />
        </IconButton>
        <Button
          startIcon={<EditIcon />}
          onClick={onEdit}
          sx={{ fontWeight: 700, borderRadius: R.sm, color: INK, bgcolor: "#fff", px: 2, "&:hover": { bgcolor: "#f3f3f3" } }}
        >
          Edit<Box component="span" sx={{ display: { xs: "none", sm: "inline" } }}>&nbsp;property</Box>
        </Button>
      </Box>

      {/* bottom: name, type, address */}
      <Box sx={{ position: "relative", mt: 4, minWidth: 0 }}>
        <Box sx={{ display: "inline-flex", px: 1, py: 0.3, mb: 1, borderRadius: "6px", bgcolor: "rgba(255,255,255,.94)", color: INK, fontSize: 12, fontWeight: 700 }}>
          {property.propertyType || "Dormitory"}
        </Box>
        <Typography component="h1" sx={{ fontFamily: HEAD, fontWeight: 900, letterSpacing: "-0.03em", lineHeight: 1.1, fontSize: { xs: "1.6rem", sm: "2.3rem" }, overflowWrap: "anywhere", textShadow: coverPhotoUrl ? "0 2px 12px rgba(0,0,0,.35)" : "none" }}>
          {property.propertyName || "Unnamed property"}
        </Typography>
        <Box sx={{ ...row, alignItems: "flex-start", gap: 0.5, mt: 0.75, color: "rgba(255,255,255,.85)", minWidth: 0 }}>
          <PlaceOutlinedIcon sx={{ fontSize: 17, flexShrink: 0, mt: "2px" }} />
          <Typography variant="body2" sx={{ overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
            {formatPropertyAddress(property)}
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}

/** Four stat tiles under the banner (same look as the property list header). */
function StatTiles({ items }) {
  return (
    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", md: "repeat(4, minmax(0, 1fr))" }, gap: { xs: 1, sm: 1.5 }, mb: { xs: 2, md: 3 } }}>
      {items.map((t) => (
        <Paper key={t.label} elevation={0} sx={{ ...cardSx, minWidth: 0, display: "flex", alignItems: "flex-start", gap: 1.25, p: { xs: 1.5, sm: 2 } }}>
          <Box sx={{ width: { xs: 34, sm: 40 }, height: { xs: 34, sm: 40 }, flexShrink: 0, borderRadius: R.sm, display: "grid", placeItems: "center", bgcolor: t.tint || "rgba(255,69,0,.1)", color: t.iconColor || "primary.main", "& svg": { fontSize: { xs: 18, sm: 21 } } }}>
            {t.icon}
          </Box>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography variant="caption" color="text.secondary" noWrap sx={{ fontWeight: 600, display: "block" }}>
              {t.label}
            </Typography>
            <Typography noWrap sx={{ fontFamily: HEAD, fontWeight: 800, letterSpacing: "-0.02em", fontSize: { xs: "1.25rem", sm: "1.5rem" }, lineHeight: 1.2, color: t.color || "text.primary" }}>
              {t.value}
              {t.suffix && (
                <Box component="span" sx={{ fontWeight: 600, fontSize: "0.6em", color: "text.secondary" }}>
                  {" "}{t.suffix}
                </Box>
              )}
            </Typography>
            {t.progress !== undefined && (
              <Box sx={{ mt: 0.75, height: 5, borderRadius: 3, bgcolor: (th) => alpha(th.palette.text.primary, 0.08), overflow: "hidden" }}>
                <Box sx={{ height: "100%", width: `${t.progress}%`, bgcolor: t.progress >= 80 ? "success.main" : "primary.main", borderRadius: 3, transition: "width .4s ease" }} />
              </Box>
            )}
          </Box>
        </Paper>
      ))}
    </Box>
  );
}

/* ---------------------------------------------------------------------------
   Room map, drawn as the building: floors stacked top to bottom (highest
   floor on top, ground floor on the street), each room a tile whose beds are
   little squares — orange when taken, empty when free.
   ------------------------------------------------------------------------- */
const MAX_BED_SQUARES = 12; // a very big room shows "+N" instead of a wall of squares
const tenantName = (t) => t?.name || t?.fullName || t?.email || "Tenant";

function BedSquares({ capacity, roomTenants, maintenance }) {
  const shown = Math.min(capacity, MAX_BED_SQUARES);
  const cols = Math.min(Math.max(shown, 1), 4);
  return (
    <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
      <Box sx={{ display: "grid", gridTemplateColumns: `repeat(${cols}, 14px)`, gap: "4px" }}>
        {Array.from({ length: shown }).map((_, i) => {
          const taken = !maintenance && i < roomTenants.length;
          return (
            <Box
              key={i}
              title={taken ? tenantName(roomTenants[i]) : maintenance ? "Unavailable" : "Free bed"}
              sx={{
                width: 14,
                height: 14,
                borderRadius: "4px",
                boxSizing: "border-box",
                bgcolor: taken ? ORANGE : maintenance ? (t) => alpha(t.palette.text.primary, 0.1) : "transparent",
                border: taken || maintenance ? "none" : "1.5px solid",
                borderColor: (t) => alpha(t.palette.text.primary, 0.28),
              }}
            />
          );
        })}
      </Box>
      {capacity > MAX_BED_SQUARES && (
        <Typography variant="caption" sx={{ fontWeight: 700, color: "text.secondary" }}>
          +{capacity - MAX_BED_SQUARES}
        </Typography>
      )}
    </Box>
  );
}

// One room on the building
function RoomTile({ room, roomTenants, isSelected, onSelect, delay }) {
  const status = getRoomStatus(room, roomTenants);
  const capacity = capacityOf(room);
  const free = Math.max(capacity - roomTenants.length, 0);
  const maintenance = status === "maintenance";
  const full = status === "full";

  const caption = maintenance ? "Maintenance" : capacity === 0 ? "No beds" : full ? "Full" : `${free} free`;

  return (
    <Box
      component="button"
      type="button"
      onClick={() => onSelect(roomKey(room))}
      aria-label={`${room.roomName}, ${STATUS_STYLES[status].label}${capacity ? `, ${roomTenants.length} of ${capacity} beds taken` : ""}`}
      aria-pressed={isSelected}
      sx={{
        position: "relative",
        minWidth: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        gap: 0.75,
        p: 1.1,
        textAlign: "left",
        fontFamily: "inherit",
        color: "text.primary",
        cursor: "pointer",
        borderRadius: "10px",
        border: "1px solid",
        borderColor: full ? "rgba(255,69,0,.35)" : "divider",
        bgcolor: maintenance ? (t) => alpha(t.palette.text.primary, 0.05) : full ? "rgba(255,69,0,.06)" : "background.default",
        boxShadow: isSelected ? `0 0 0 2px #fff, 0 0 0 4px ${INK}` : "none",
        transform: isSelected ? "translateY(-2px)" : "none",
        transition: "transform .12s ease, box-shadow .12s ease, border-color .12s ease",
        animation: `kkPop .35s ease-out ${delay}ms both`,
        "&:hover": { transform: "translateY(-2px)", borderColor: maintenance ? "divider" : "primary.main" },
        "&:focus-visible": { outline: "none", boxShadow: `0 0 0 2px #fff, 0 0 0 4px ${ORANGE}` },
      }}
    >
      <Box sx={{ ...row, justifyContent: "space-between", gap: 0.5, width: "100%", minWidth: 0 }}>
        <Typography noWrap sx={{ fontFamily: HEAD, fontWeight: 800, fontSize: "0.82rem", lineHeight: 1.2, minWidth: 0 }}>
          {room.roomName}
        </Typography>
        {maintenance && <HandymanOutlinedIcon sx={{ fontSize: 15, color: "text.secondary", flexShrink: 0 }} />}
      </Box>
      {capacity > 0 && <BedSquares capacity={capacity} roomTenants={roomTenants} maintenance={maintenance} />}
      <Typography
        variant="caption"
        sx={{ fontWeight: 700, lineHeight: 1, color: maintenance ? "text.secondary" : full ? "primary.main" : free > 0 ? "success.main" : "text.secondary" }}
      >
        {caption}
      </Typography>
    </Box>
  );
}

// "Unassigned" (or any non-number) floors go last; numbered floors are drawn
// highest first, like looking at the building from the street.
const floorOrder = (key) => (Number.isNaN(Number(key)) ? -Infinity : Number(key));
const floorLabel = (key) => (key === "Unassigned" ? "Unassigned" : `Floor ${key}`);

function RoomMap({ rooms, tenants, selectedKey, onSelectRoom }) {
  const isDesktop = useMediaQuery((theme) => theme.breakpoints.up("md"));

  const floors = useMemo(() => {
    const byFloor = new Map();
    rooms.forEach((room) => {
      const floorKey = room.floor ?? "Unassigned";
      if (!byFloor.has(floorKey)) byFloor.set(floorKey, []);
      byFloor.get(floorKey).push(room);
    });
    return [...byFloor.entries()]
      .sort((a, b) => floorOrder(b[0]) - floorOrder(a[0]))
      .map(([key, floorRooms]) => {
        const withTenants = floorRooms.map((room) => ({ room, roomTenants: getRoomTenants(room, tenants) }));
        const freeBeds = withTenants.reduce(
          (sum, { room, roomTenants }) => sum + (isMaintenance(room) ? 0 : Math.max(capacityOf(room) - roomTenants.length, 0)),
          0
        );
        return { key, rooms: withTenants, freeBeds };
      });
  }, [rooms, tenants]);

  // Phones show one floor at a time (a whole building is too cramped).
  // Starts on the ground floor, the one owners walk into.
  const [phoneFloor, setPhoneFloor] = useState(null);
  const groundFloor = floors.length ? floors[floors.length - 1].key : null;
  const activePhoneFloor = floors.some((f) => f.key === phoneFloor) ? phoneFloor : groundFloor;
  const visibleFloors = isDesktop || floors.length <= 1 ? floors : floors.filter((f) => f.key === activePhoneFloor);

  let tileIdx = 0;
  const wall = (t) => alpha(t.palette.text.primary, 0.14);

  return (
    <Box>
      {/* Legend */}
      <Box sx={{ display: "flex", flexWrap: "wrap", columnGap: 2, rowGap: 0.75, mb: 2 }}>
        {[
          ["Bed taken", { bgcolor: ORANGE }],
          ["Bed free", { border: "1.5px solid", borderColor: (t) => alpha(t.palette.text.primary, 0.28) }],
          ["Full room", { bgcolor: "rgba(255,69,0,.12)", border: "1px solid rgba(255,69,0,.35)" }],
          ["Maintenance", { bgcolor: (t) => alpha(t.palette.text.primary, 0.1) }],
        ].map(([label, swatch]) => (
          <Box key={label} sx={{ ...row, gap: 0.75 }}>
            <Box sx={{ width: 12, height: 12, borderRadius: "3px", boxSizing: "border-box", ...swatch }} />
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
              {label}
            </Typography>
          </Box>
        ))}
      </Box>

      {/* Phone floor picker */}
      {!isDesktop && floors.length > 1 && (
        <Box sx={{ display: "flex", gap: 0.75, overflowX: "auto", pb: 1, mb: 1.5, mx: -0.5, px: 0.5, scrollbarWidth: "none", "&::-webkit-scrollbar": { display: "none" } }}>
          {floors.map((f) => {
            const on = f.key === activePhoneFloor;
            return (
              <Box
                key={f.key}
                component="button"
                type="button"
                onClick={() => setPhoneFloor(f.key)}
                aria-pressed={on}
                sx={{
                  flexShrink: 0,
                  px: 1.5,
                  py: 0.75,
                  borderRadius: R.sm,
                  border: "1px solid",
                  borderColor: on ? INK : "divider",
                  bgcolor: on ? INK : "background.default",
                  color: on ? "#fff" : "text.primary",
                  fontFamily: HEAD,
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                {floorLabel(f.key)}
                <Box component="span" sx={{ ml: 0.75, fontWeight: 600, opacity: 0.7 }}>
                  {f.freeBeds} free
                </Box>
              </Box>
            );
          })}
        </Box>
      )}

      {/* The building */}
      <Box>
        {/* roof */}
        <Box sx={{ height: 10, mx: -0.75, borderRadius: "8px 8px 2px 2px", bgcolor: INK }} />
        <Box sx={{ borderLeft: "3px solid", borderRight: "3px solid", borderColor: wall, bgcolor: (t) => alpha(t.palette.background.paper, 0.4) }}>
          {visibleFloors.map((floor, fIdx) => (
            <Box
              key={floor.key}
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "64px minmax(0, 1fr)" },
                gap: { xs: 1, sm: 1.5 },
                alignItems: "center",
                px: { xs: 1, sm: 1.5 },
                py: 1.5,
                // floor slab between storeys
                borderTop: fIdx ? "3px solid" : "none",
                borderColor: wall,
              }}
            >
              <Box sx={{ display: { xs: isDesktop || floors.length <= 1 ? "flex" : "none", sm: "block" }, alignItems: "baseline", gap: 1 }}>
                <Typography sx={{ fontFamily: HEAD, fontWeight: 900, fontSize: "0.95rem", lineHeight: 1.1 }}>
                  {floor.key === "Unassigned" ? "—" : `${floor.key}F`}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, display: "block", lineHeight: 1.3 }}>
                  {floor.freeBeds} free
                </Typography>
              </Box>
              <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(96px, 1fr))", gap: 1 }}>
                {floor.rooms.map(({ room, roomTenants }, idx) => (
                  <RoomTile
                    key={`${roomKey(room)}-${idx}`}
                    room={room}
                    roomTenants={roomTenants}
                    isSelected={selectedKey === roomKey(room)}
                    onSelect={onSelectRoom}
                    delay={Math.min(tileIdx++, 40) * 15}
                  />
                ))}
              </Box>
            </Box>
          ))}
        </Box>
        {/* ground */}
        <Box sx={{ height: 6, mx: -1.5, borderRadius: 3, bgcolor: INK }} />
      </Box>
    </Box>
  );
}

export default function PropertyProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isDesktop = useMediaQuery((theme) => theme.breakpoints.up("md"));

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [property, setProperty] = useState(null);
  const [tenants, setTenants] = useState([]);
  const [loadingTenants, setLoadingTenants] = useState(true);

  // The selected room is kept by name, so the panel always shows live data
  const [selectedKey, setSelectedKey] = useState(null);

  // Form states for status updates inside the room details panel
  const [statusMode, setStatusMode] = useState("operational"); // "operational" | "maintenance"
  const [maintenanceNote, setMaintenanceNote] = useState("");
  const [savingStatus, setSavingStatus] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    const fetchProperty = async () => {
      try {
        const docSnap = await getDoc(doc(db, "properties", id));
        if (docSnap.exists()) setProperty(docSnap.data());
      } catch (error) {
        console.error("Error fetching property:", error);
        setLoadError(true);
      } finally {
        setLoading(false);
      }
    };
    fetchProperty();
  }, [id]);

  useEffect(() => {
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
        setTenants(withoutRemoved([...tenantsById.values()]));
        setLoadingTenants(false);
      }
    };

    const unsubscribeUsers = onSnapshot(
      query(collection(db, "users"), where("propertyId", "==", id)),
      (snapshot) => {
        tenantSources.set("users", snapshot.docs
          .map((tenantDoc) => ({ id: tenantDoc.id, ...tenantDoc.data() }))
          .filter((tenant) => tenant.role === "tenant"));
        publishTenants();
      },
      (error) => {
        console.error("Error fetching property tenant profiles:", error);
        if (active) setLoadingTenants(false);
      }
    );

    const unsubscribeLegacyTenants = onSnapshot(
      query(collection(db, "tenants"), where("propertyId", "==", id)),
      (snapshot) => {
        tenantSources.set("tenants", snapshot.docs.map((tenantDoc) => ({
          id: tenantDoc.id,
          ...tenantDoc.data(),
        })));
        publishTenants();
      },
      (error) => {
        console.error("Error fetching legacy property tenants:", error);
        if (active) setLoadingTenants(false);
      }
    );

    return () => {
      active = false;
      unsubscribeUsers();
      unsubscribeLegacyTenants();
    };
  }, [id]);

  const rooms = useMemo(() => property?.rooms || [], [property]);

  // Live data for the selected room (re-derived whenever rooms or tenants change)
  const selectedRoom = selectedKey ? rooms.find((r) => roomKey(r) === selectedKey) : null;
  const selectedTenants = selectedRoom ? getRoomTenants(selectedRoom, tenants) : [];
  const selectedStatus = selectedRoom ? getRoomStatus(selectedRoom, selectedTenants) : null;

  // Picking a room also loads its saved status into the form (done here rather
  // than in an effect, so saving doesn't wipe the "updated" message).
  const selectRoom = (key) => {
    const room = rooms.find((r) => roomKey(r) === key);
    setSelectedKey(key);
    setStatusMode(isMaintenance(room) ? "maintenance" : "operational");
    setMaintenanceNote(room?.maintenanceNote || "");
    setSaveSuccess(false);
    setSaveError("");
  };
  const closeRoom = () => setSelectedKey(null);

  // Totals for the stat tiles
  const overallMetrics = useMemo(() => {
    let totalCapacity = 0;
    let availableBeds = 0;
    let maintenanceRooms = 0;
    rooms.forEach((room) => {
      const cap = capacityOf(room);
      totalCapacity += cap;
      if (isMaintenance(room)) {
        maintenanceRooms += 1;
        return; // beds in a room under maintenance can't be offered
      }
      availableBeds += Math.max(0, cap - getRoomTenants(room, tenants).length);
    });
    const occupiedBeds = tenants.filter(isActiveTenant).length;
    return { totalRooms: rooms.length, totalCapacity, occupiedBeds, availableBeds, maintenanceRooms };
  }, [rooms, tenants]);

  // Handle setting/saving room status to Firestore
  const handleSaveRoomStatus = async () => {
    if (!selectedRoom) return;

    setSavingStatus(true);
    setSaveSuccess(false);
    setSaveError("");

    try {
      const isMaint = statusMode === "maintenance";
      const updatedRooms = rooms.map((r) =>
        roomKey(r) === selectedKey
          ? {
              ...r,
              status: isMaint ? "maintenance" : "operational",
              underMaintenance: isMaint,
              maintenanceNote: isMaint ? maintenanceNote.trim() : "",
            }
          : r
      );

      await updateDoc(doc(db, "properties", id), { rooms: updatedRooms });
      setProperty((prev) => ({ ...prev, rooms: updatedRooms }));
      setSaveSuccess(true);
    } catch (error) {
      console.error("Failed to update room status:", error);
      setSaveError("Couldn't update the room status. Check your connection and try again.");
    } finally {
      setSavingStatus(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ maxWidth: 1100, mx: "auto" }}>
        <Skeleton variant="rounded" height={240} sx={{ borderRadius: R.xl, mb: 2.5 }} />
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2, 1fr)", md: "repeat(4, 1fr)" }, gap: 1.5, mb: 3 }}>
          {[0, 1, 2, 3].map((k) => <Skeleton key={k} variant="rounded" height={84} sx={{ borderRadius: R.lg }} />)}
        </Box>
        <Skeleton variant="rounded" height={320} sx={{ borderRadius: R.lg }} />
      </Box>
    );
  }
  if (!property) {
    return (
      <Box sx={{ maxWidth: 480, mx: "auto", mt: 8, textAlign: "center" }}>
        <Typography sx={{ fontFamily: HEAD, fontWeight: 800, fontSize: "1.2rem", mb: 1 }}>
          {loadError ? "Couldn't load this property" : "Property not found"}
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 2.5 }}>
          {loadError ? "Check your connection and try again." : "It may have been removed, or the link is wrong."}
        </Typography>
        <Button variant="contained" startIcon={<ArrowBackIcon />} onClick={() => navigate("/owner/properties")} sx={{ fontWeight: 700, borderRadius: R.sm }}>
          Back to properties
        </Button>
      </Box>
    );
  }

  const coverPhotoUrl = getPropertyCoverPhotoUrl(property);
  const occPct = overallMetrics.totalCapacity > 0
    ? Math.min(Math.round((overallMetrics.occupiedBeds / overallMetrics.totalCapacity) * 100), 100)
    : 0;

  // Has the owner changed anything in the status form yet?
  const selectedIsMaint = isMaintenance(selectedRoom);
  const statusDirty = selectedRoom
    ? (statusMode === "maintenance") !== selectedIsMaint ||
      (statusMode === "maintenance" && maintenanceNote.trim() !== (selectedRoom.maintenanceNote || "").trim())
    : false;

  // Details for the selected room. A side card on desktop, a bottom sheet on phones.
  const roomPanel = selectedRoom ? (
    <Box>
      <Box sx={{ ...row, justifyContent: "space-between", alignItems: "flex-start", gap: 1 }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase" }}>
            {selectedRoom.floor != null ? `Floor ${selectedRoom.floor}` : "Room"}
          </Typography>
          <Typography noWrap sx={{ fontFamily: HEAD, fontWeight: 900, fontSize: "1.5rem", lineHeight: 1.15, letterSpacing: "-0.02em" }}>
            {selectedRoom.roomName}
          </Typography>
          <Box sx={{ display: "inline-flex", alignItems: "center", gap: 0.75, mt: 0.75, px: 1, py: 0.35, borderRadius: "8px", bgcolor: (t) => alpha(t.palette.background.paper, 0.6) }}>
            <Box sx={{ width: 10, height: 10, borderRadius: "3px", bgcolor: STATUS_STYLES[selectedStatus].fill }} />
            <Typography variant="caption" sx={{ fontWeight: 700 }}>
              {STATUS_STYLES[selectedStatus].label}
            </Typography>
          </Box>
        </Box>
        <IconButton size="small" aria-label="Close room details" onClick={closeRoom} sx={{ mt: -0.5, mr: -0.5, bgcolor: "action.hover" }}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>

      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 1, mt: 2 }}>
        {[
          ["Beds", capacityOf(selectedRoom)],
          ["Occupied", selectedTenants.length],
          ["Rate / bed", selectedRoom.monthlyRatePerBed ? peso(selectedRoom.monthlyRatePerBed) : "—"],
        ].map(([label, value]) => (
          <Box key={label} sx={{ p: 1.25, borderRadius: R.sm, bgcolor: (t) => alpha(t.palette.background.paper, 0.45), minWidth: 0 }}>
            <Typography variant="caption" color="text.secondary" noWrap component="div" sx={{ fontWeight: 600 }}>{label}</Typography>
            <Typography noWrap sx={{ fontFamily: HEAD, fontWeight: 800, fontSize: "1rem" }}>{value}</Typography>
          </Box>
        ))}
      </Box>

      {/* TENANTS — what owners check most, so it comes first */}
      <Typography variant="subtitle2" sx={{ fontWeight: 800, mt: 3, mb: 1.25 }}>
        Tenants
        <Typography component="span" variant="subtitle2" color="text.secondary" sx={{ fontWeight: 600 }}>
          {" "}· {selectedTenants.length} of {capacityOf(selectedRoom)}
        </Typography>
      </Typography>
      {selectedTenants.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ p: 2, textAlign: "center", border: "1px dashed", borderColor: "divider", borderRadius: R.sm }}>
          No tenants assigned to this room.
        </Typography>
      ) : (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
          {selectedTenants.map((tenant) => {
            const moveOut = getMoveOutDate(tenant);
            const tenantId = tenant.uid || tenant.id;
            const name = tenant.name || tenant.fullName || tenant.email || "Unnamed Tenant";
            return (
              <Box
                key={tenantId}
                component="button"
                type="button"
                onClick={() => navigate(`/owner/tenants/${tenantId}`)}
                sx={{
                  ...row,
                  gap: 1.5,
                  width: "100%",
                  textAlign: "left",
                  p: 1.25,
                  fontFamily: "inherit",
                  color: "inherit",
                  bgcolor: "transparent",
                  border: "1px solid",
                  borderColor: "divider",
                  borderRadius: R.sm,
                  cursor: "pointer",
                  transition: "background-color .15s, border-color .15s",
                  "&:hover": { bgcolor: "action.hover", borderColor: "primary.main" },
                  "&:focus-visible": { outline: "2px solid", outlineColor: "primary.main", outlineOffset: 2 },
                }}
              >
                <Box sx={{ width: 36, height: 36, borderRadius: "50%", flexShrink: 0, ...row, justifyContent: "center", bgcolor: ORANGE, color: "#fff", fontFamily: HEAD, fontWeight: 800, fontSize: 14 }}>
                  {name.toString().trim().charAt(0).toUpperCase()}
                </Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="body2" noWrap sx={{ fontWeight: 700 }}>
                    {name}
                  </Typography>
                  <Typography variant="caption" color="text.secondary" noWrap component="div">
                    {(tenant.bedId || tenant.bedNumber) ? `Bed ${tenant.bedId || tenant.bedNumber} · ` : ""}
                    {moveOut ? `Move-out ${moveOut}` : "No scheduled move-out"}
                  </Typography>
                </Box>
                <ChevronRightIcon sx={{ color: "text.disabled" }} />
              </Box>
            );
          })}
        </Box>
      )}

      <Divider sx={{ my: 3 }} />

      {/* ROOM STATUS */}
      <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1.25 }}>
        Room status
      </Typography>
      <ToggleButtonGroup
        exclusive
        fullWidth
        size="small"
        value={statusMode}
        onChange={(e, value) => {
          if (value) {
            setStatusMode(value);
            setSaveSuccess(false);
          }
        }}
        sx={{
          mb: 1.5,
          p: 0.5,
          gap: 0.5,
          borderRadius: R.sm,
          bgcolor: (t) => alpha(t.palette.background.paper, 0.6),
          "& .MuiToggleButton-root": { textTransform: "none", fontWeight: 700, py: 0.9, border: "none", borderRadius: "8px !important", color: "text.secondary" },
          "& .MuiToggleButton-root.Mui-selected": {
            bgcolor: "#fff",
            color: "primary.main",
            boxShadow: "0 2px 8px rgba(0,0,0,.08)",
            "&:hover": { bgcolor: "#fff" },
          },
        }}
      >
        <ToggleButton value="operational">Available</ToggleButton>
        <ToggleButton value="maintenance">
          <HandymanOutlinedIcon sx={{ fontSize: 16, mr: 0.75 }} />
          Maintenance
        </ToggleButton>
      </ToggleButtonGroup>

      {statusMode === "maintenance" && (
        <TextField
          fullWidth
          size="small"
          multiline
          minRows={2}
          label="Maintenance reason"
          placeholder="e.g. Plumbing repairs in progress"
          value={maintenanceNote}
          onChange={(e) => {
            setMaintenanceNote(e.target.value);
            setSaveSuccess(false);
          }}
          sx={{ mb: 1.5, "& .MuiOutlinedInput-root": { borderRadius: R.sm } }}
        />
      )}

      <Button
        variant="contained"
        size="medium"
        startIcon={savingStatus ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
        onClick={handleSaveRoomStatus}
        disabled={savingStatus || !statusDirty}
        fullWidth
        sx={{ fontWeight: 700, borderRadius: R.sm, boxShadow: "none" }}
      >
        {savingStatus ? "Saving..." : "Update status"}
      </Button>

      {saveSuccess && (
        <Alert icon={<CheckCircleOutlineIcon fontSize="inherit" />} severity="success" sx={{ mt: 1.5, py: 0, borderRadius: R.sm }}>
          Room status updated
        </Alert>
      )}
      {saveError && (
        <Alert severity="error" sx={{ mt: 1.5, py: 0, borderRadius: R.sm }}>
          {saveError}
        </Alert>
      )}
    </Box>
  ) : null;

  return (
    <Box sx={{ maxWidth: 1100, mx: "auto", minWidth: 0 }}>
      {AnimationStyles}

      <CoverBanner
        property={property}
        coverPhotoUrl={coverPhotoUrl}
        occPct={occPct}
        onBack={() => navigate("/owner/properties")}
        onEdit={() => navigate(`/owner/properties/${id}/edit`)}
      />

      <StatTiles
        items={[
          { label: "Rooms", icon: <MeetingRoomOutlinedIcon />, value: overallMetrics.totalRooms },
          { label: "Beds occupied", icon: <PeopleOutlinedIcon />, value: overallMetrics.occupiedBeds, suffix: `/ ${overallMetrics.totalCapacity}`, progress: occPct },
          { label: "Beds available", icon: <BedOutlinedIcon />, value: overallMetrics.availableBeds, color: overallMetrics.availableBeds > 0 ? "success.main" : undefined, tint: "rgba(46,125,50,.1)", iconColor: "success.main" },
          {
            label: "Under maintenance",
            icon: <HandymanOutlinedIcon />,
            value: overallMetrics.maintenanceRooms,
            suffix: overallMetrics.maintenanceRooms === 1 ? "room" : "rooms",
            color: overallMetrics.maintenanceRooms > 0 ? "warning.main" : undefined,
            tint: "rgba(237,108,2,.1)",
            iconColor: "warning.main",
          },
        ]}
      />

      {/* ROOM MAP + DETAILS */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "minmax(0, 7fr) minmax(0, 5fr)" },
          gap: 3,
          alignItems: "start",
          mb: 3,
        }}
      >
        <Paper elevation={0} sx={{ ...cardSx, p: { xs: 2, sm: 3 } }}>
          <SectionTitle
            icon={<GridViewOutlinedIcon />}
            aside={
              <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600, flexShrink: 0 }}>
                {loadingTenants ? "Loading tenants…" : `${overallMetrics.occupiedBeds} ${overallMetrics.occupiedBeds === 1 ? "tenant" : "tenants"}`}
              </Typography>
            }
          >
            Room map
          </SectionTitle>
          {rooms.length > 0 ? (
            <RoomMap rooms={rooms} tenants={tenants} selectedKey={selectedRoom ? selectedKey : null} onSelectRoom={selectRoom} />
          ) : (
            <Typography color="text.secondary" sx={{ p: 3, textAlign: "center", border: "1px dashed", borderColor: "divider", borderRadius: R.sm }}>
              No rooms have been added to this property yet.
            </Typography>
          )}
        </Paper>

        {/* Desktop: side card (sticks while the map scrolls). Phones use the bottom sheet below. */}
        {isDesktop && (
          <Paper
            elevation={0}
            sx={{
              ...cardSx,
              p: 3,
              position: "sticky",
              top: 96,
              // Fixed size: the card never grows or shrinks as you pick rooms,
              // tenants or the maintenance box; long content scrolls inside.
              height: DETAILS_CARD_H,
              overflowY: "auto",
              overscrollBehavior: "contain",
            }}
          >
            {roomPanel || (
              <Box sx={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", px: 2 }}>
                <Box sx={{ width: 60, height: 60, borderRadius: R.md, mx: "auto", mb: 1.5, ...row, justifyContent: "center", bgcolor: "rgba(255, 69, 0, 0.08)" }}>
                  <TouchAppOutlinedIcon sx={{ color: "primary.main" }} />
                </Box>
                <Typography sx={{ fontFamily: HEAD, fontWeight: 800 }}>Select a room</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, maxWidth: 260 }}>
                  Tap any room on the map to see its tenants or change its status.
                </Typography>
              </Box>
            )}
          </Paper>
        )}
      </Box>

      {!isDesktop && (
        <Drawer
          anchor="bottom"
          open={Boolean(selectedRoom)}
          onClose={closeRoom}
          slotProps={{
            paper: {
              sx: {
                borderTopLeftRadius: 20,
                borderTopRightRadius: 20,
                maxHeight: "85vh",
                "@supports (height: 1dvh)": { maxHeight: "85dvh" },
                overscrollBehavior: "contain",
                p: 2.5,
                pb: "calc(20px + env(safe-area-inset-bottom, 0px))",
              },
            },
          }}
        >
          <Box sx={{ width: 40, height: 4, borderRadius: 2, bgcolor: "divider", mx: "auto", mb: 2 }} />
          {roomPanel}
        </Drawer>
      )}

      {/* AMENITIES & HOUSE RULES */}
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "repeat(2, minmax(0, 1fr))" }, gap: 3, alignItems: "stretch" }}>
        <Paper elevation={0} sx={{ ...cardSx, p: { xs: 2, sm: 3 } }}>
          <SectionTitle icon={<WifiOutlinedIcon />}>Amenities</SectionTitle>
          {property.amenities?.length > 0 ? (
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
              {property.amenities.map((amenity) => (
                <Chip
                  key={amenity}
                  label={amenity}
                  icon={<CheckCircleOutlineIcon />}
                  sx={{ bgcolor: "rgba(202, 220, 246, 0.45)", color: "text.primary", fontWeight: 600, border: "none", borderRadius: "8px", "& .MuiChip-icon": { color: "primary.main", fontSize: 17 } }}
                />
              ))}
            </Box>
          ) : (
            <Typography variant="body2" color="text.secondary">No amenities listed.</Typography>
          )}
        </Paper>

        <Paper elevation={0} sx={{ ...cardSx, p: { xs: 2, sm: 3 } }}>
          <SectionTitle icon={<PolicyOutlinedIcon />}>House rules</SectionTitle>
          <Typography variant="body2" sx={{ whiteSpace: "pre-line", color: "text.secondary", lineHeight: 1.7 }}>
            {property.rulesText || "No house rules specified."}
          </Typography>

          {property.ruleFiles?.length > 0 && (
            <Box sx={{ display: "flex", flexDirection: "column", gap: 1, mt: 2.5 }}>
              {property.ruleFiles.map((file, idx) => (
                <Box
                  key={idx}
                  component="a"
                  href={file.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  sx={{
                    ...row,
                    gap: 1.25,
                    p: 1.25,
                    color: "text.primary",
                    textDecoration: "none",
                    border: "1px solid",
                    borderColor: "divider",
                    borderRadius: R.sm,
                    minWidth: 0,
                    transition: "border-color .15s, color .15s",
                    "&:hover": { borderColor: "primary.main", color: "primary.main" },
                  }}
                >
                  <InsertDriveFileOutlinedIcon sx={{ fontSize: 20, color: "text.secondary", flexShrink: 0 }} />
                  <Typography variant="body2" noWrap sx={{ fontWeight: 600, flex: 1, minWidth: 0 }}>
                    {file.name}
                  </Typography>
                  <OpenInNewRoundedIcon sx={{ fontSize: 16, color: "text.disabled", flexShrink: 0 }} />
                </Box>
              ))}
            </Box>
          )}
        </Paper>
      </Box>
    </Box>
  );
}
