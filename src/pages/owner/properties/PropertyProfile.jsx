import React, { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Box, Typography, Button, IconButton, Chip, CircularProgress, Paper,
  TextField, ToggleButton, ToggleButtonGroup, Divider, Alert, Drawer,
  LinearProgress, useMediaQuery,
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
import HomeWorkOutlinedIcon from "@mui/icons-material/HomeWorkOutlined";
import TouchAppOutlinedIcon from "@mui/icons-material/TouchAppOutlined";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutlined";

import { collection, doc, getDoc, onSnapshot, query, where, updateDoc } from "firebase/firestore";
import { db } from "../../../config/firebase";
import { getPropertyCoverPhotoUrl } from "../../../utils/getPropertyCoverPhotoUrl";
import { formatPropertyAddress } from "../../../utils/formatPropertyAddress";

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

// Calculate status: vacant | partial | full | maintenance
const getRoomStatus = (room, roomTenants) => {
  if (room?.status === "maintenance" || room?.underMaintenance) return "maintenance";
  const capacity = Number(room?.capacity) || 0;
  const occupied = roomTenants.length;
  if (occupied === 0) return "vacant";
  if (capacity > 0 && occupied >= capacity) return "full";
  return "partial";
};

const STATUS_STYLES = {
  vacant: { fill: "rgba(202, 220, 246, 0.55)", label: "Vacant", text: "text.primary" },
  partial: { fill: "rgba(255, 69, 0, 0.45)", label: "Partially occupied", text: "text.primary" },
  full: { fill: "#ff4500", label: "Fully occupied", text: "#ffffff" },
  maintenance: { fill: "rgba(0, 0, 0, 0.14)", label: "Under maintenance", text: "text.primary" },
};

const row = { display: "flex", alignItems: "center" };

// Desktop details card: always this tall (and never taller than the viewport).
const DETAILS_CARD_H = "min(460px, calc(100vh - 128px))";

// Which tenants live in a room (same matching rule as before)
const getRoomTenants = (room, tenants) => {
  const roomName = String(room.roomName || room.roomNumber || room.id || "");
  return tenants.filter((tenant) => {
    if (["inactive", "archived", "deactivated"].includes(String(tenant.status || "Active").trim().toLowerCase())) return false;
    const assignedRoom = tenant.roomId || tenant.roomNumber || tenant.room || "";
    return String(assignedRoom) === roomName;
  });
};

const cardSx = {
  bgcolor: "background.default",
  border: "1px solid",
  borderColor: "divider",
  borderRadius: 3,
};

function SectionTitle({ icon, children, aside }) {
  return (
    <Box sx={{ ...row, justifyContent: "space-between", gap: 1, mb: 2 }}>
      <Box sx={{ ...row, gap: 1.25, minWidth: 0 }}>
        {icon}
        <Typography variant="h6" sx={{ fontFamily: '"Inter", sans-serif', fontWeight: 700, fontSize: "1.05rem" }} noWrap>
          {children}
        </Typography>
      </Box>
      {aside}
    </Box>
  );
}

function SummaryStrip({ items }) {
  return (
    <Paper
      elevation={0}
      sx={{
        ...cardSx,
        display: "grid",
        gridTemplateColumns: { xs: "repeat(2, 1fr)", md: `repeat(${items.length}, 1fr)` },
        overflow: "hidden",
        mb: { xs: 2, md: 3 },
      }}
    >
      {items.map((item, i) => (
        <Box
          key={item.label}
          sx={{
            px: { xs: 1.75, md: 2.5 },
            py: { xs: 1.25, md: 1.75 },
            minWidth: 0,
            borderTop: { xs: i > 1 ? "1px solid" : "none", md: "none" },
            borderLeft: { xs: i % 2 === 1 ? "1px solid" : "none", md: i === 0 ? "none" : "1px solid" },
            borderColor: "divider",
          }}
        >
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }} noWrap component="div">
            {item.label}
          </Typography>
          <Typography noWrap sx={{ fontFamily: '"Inter", sans-serif', fontWeight: 800, fontSize: { xs: "1.2rem", md: "1.45rem" }, lineHeight: 1.25, color: item.color }}>
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

// Single clickable tile in the room map
function RoomTile({ room, roomTenants, isSelected, onSelect }) {
  const status = getRoomStatus(room, roomTenants);
  const style = STATUS_STYLES[status];
  const capacity = Number(room.capacity) || 0;

  return (
    <Box
      component="button"
      type="button"
      onClick={() => onSelect({ room, roomTenants, status })}
      aria-label={`${room.roomName}, ${style.label}`}
      aria-pressed={isSelected}
      sx={{
        height: 64,
        minWidth: 0,
        borderRadius: 2,
        border: "none",
        outline: isSelected ? "2px solid" : "none",
        outlineColor: "text.primary",
        outlineOffset: 2,
        bgcolor: style.fill,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        gap: 0.25,
        px: 0.5,
        fontFamily: "inherit",
        transition: "transform 0.12s ease",
        "&:hover": { transform: "scale(1.05)" },
        "&:focus-visible": { outline: "2px solid", outlineColor: "text.primary", outlineOffset: 2 },
      }}
    >
      {status === "maintenance" && <HandymanOutlinedIcon sx={{ fontSize: 15, color: "text.secondary" }} />}
      <Typography noWrap sx={{ fontWeight: 800, fontSize: "0.78rem", color: style.text, lineHeight: 1.1, maxWidth: "100%" }}>
        {room.roomName}
      </Typography>
      {status !== "maintenance" && capacity > 0 && (
        <Typography sx={{ fontSize: "0.66rem", fontWeight: 600, color: style.text, opacity: 0.8, lineHeight: 1 }}>
          {roomTenants.length}/{capacity}
        </Typography>
      )}
    </Box>
  );
}

// At-a-glance map of every room, grouped by floor
function RoomMap({ rooms, tenants, selectedRoomData, onSelectRoom }) {
  const floors = useMemo(() => {
    const byFloor = new Map();
    rooms.forEach((room) => {
      const floorKey = room.floor ?? "Unassigned";
      if (!byFloor.has(floorKey)) byFloor.set(floorKey, []);
      byFloor.get(floorKey).push(room);
    });
    return [...byFloor.entries()].sort((a, b) => {
      const an = Number(a[0]);
      const bn = Number(b[0]);
      if (Number.isNaN(an) || Number.isNaN(bn)) return 0;
      return an - bn;
    });
  }, [rooms]);

  return (
    <Box>
      {/* Legend */}
      <Box sx={{ display: "flex", flexWrap: "wrap", columnGap: 2, rowGap: 0.75, mb: 2.5 }}>
        {Object.entries(STATUS_STYLES).map(([key, s]) => (
          <Box key={key} sx={{ ...row, gap: 0.75 }}>
            <Box sx={{ width: 12, height: 12, borderRadius: "4px", bgcolor: s.fill }} />
            <Typography variant="caption" color="text.secondary">{s.label}</Typography>
          </Box>
        ))}
      </Box>

      <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
        {floors.map(([floorKey, floorRooms], fIdx) => (
          <Box key={floorKey}>
            {fIdx > 0 && <Divider sx={{ mb: 2.5 }} />}
            <Typography variant="body2" sx={{ fontWeight: 700, mb: 1.25 }}>
              {floorKey === "Unassigned" ? "Unassigned" : `Floor ${floorKey}`}
              <Typography component="span" variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
                {" "}· {floorRooms.length} {floorRooms.length === 1 ? "room" : "rooms"}
              </Typography>
            </Typography>
            <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(72px, 1fr))", gap: 1.25 }}>
              {floorRooms.map((room, idx) => (
                <RoomTile
                  key={idx}
                  room={room}
                  roomTenants={getRoomTenants(room, tenants)}
                  isSelected={selectedRoomData?.room?.roomName === room.roomName}
                  onSelect={onSelectRoom}
                />
              ))}
            </Box>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

export default function PropertyProfile() {  const { id } = useParams();
  const navigate = useNavigate();
  const isDesktop = useMediaQuery((theme) => theme.breakpoints.up("md"));

  const [loading, setLoading] = useState(true);
  const [property, setProperty] = useState(null);
  const [tenants, setTenants] = useState([]);
  const [loadingTenants, setLoadingTenants] = useState(true);
  
  // Lifted state for the selected room
  const [selectedRoomData, setSelectedRoomData] = useState(null);

  // Form states for status updates inside the room details panel
  const [statusMode, setStatusMode] = useState("operational"); // "operational" | "maintenance"
  const [maintenanceNote, setMaintenanceNote] = useState("");
  const [savingStatus, setSavingStatus] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    const fetchProperty = async () => {
      try {
        const docRef = doc(db, "properties", id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setProperty(docSnap.data());
        }
      } catch (error) {
        console.error("Error fetching property:", error);
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
        setTenants([...tenantsById.values()]);
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

  // Sync state whenever selectedRoomData changes
  useEffect(() => {
    if (selectedRoomData) {
      const isMaint = selectedRoomData.room.status === "maintenance" || selectedRoomData.room.underMaintenance;
      setStatusMode(isMaint ? "maintenance" : "operational");
      setMaintenanceNote(selectedRoomData.room.maintenanceNote || "");
      setSaveSuccess(false);
    }
  }, [selectedRoomData]);

  // Overall Metrics Calculation for Default Card View
  const overallMetrics = useMemo(() => {
    if (!property?.rooms) return { totalRooms: 0, totalCapacity: 0, occupiedBeds: 0, vacantBeds: 0, maintenanceRooms: 0 };
    
    let totalCapacity = 0;
    let maintenanceRooms = 0;

    property.rooms.forEach((r) => {
      totalCapacity += Number(r.capacity || r.totalBeds || 0);
      if (r.status === "maintenance" || r.underMaintenance) maintenanceRooms++;
    });

    const occupiedBeds = tenants.filter(
      (tenant) => !["inactive", "archived", "deactivated"].includes(String(tenant.status || "Active").trim().toLowerCase())
    ).length;
    const vacantBeds = Math.max(0, totalCapacity - occupiedBeds);

    return {
      totalRooms: property.rooms.length,
      totalCapacity,
      occupiedBeds,
      vacantBeds,
      maintenanceRooms,
    };
  }, [property, tenants]);

  // Handle setting/saving room status to Firestore
  const handleSaveRoomStatus = async () => {
    if (!selectedRoomData || !property?.rooms) return;

    setSavingStatus(true);
    setSaveSuccess(false);

    try {
      const targetRoomName = selectedRoomData.room.roomName;
      const isMaint = statusMode === "maintenance";

      const updatedRooms = property.rooms.map((r) => {
        if (r.roomName === targetRoomName) {
          return {
            ...r,
            status: isMaint ? "maintenance" : "operational",
            underMaintenance: isMaint,
            maintenanceNote: isMaint ? maintenanceNote.trim() : "",
          };
        }
        return r;
      });

      const propRef = doc(db, "properties", id);
      await updateDoc(propRef, { rooms: updatedRooms });

      // Local State Update
      setProperty((prev) => ({ ...prev, rooms: updatedRooms }));
      
      const updatedTargetRoom = updatedRooms.find((r) => r.roomName === targetRoomName);
      const computedStatus = getRoomStatus(updatedTargetRoom, selectedRoomData.roomTenants);
      
      setSelectedRoomData({
        room: updatedTargetRoom,
        roomTenants: selectedRoomData.roomTenants,
        status: computedStatus,
      });

      setSaveSuccess(true);
    } catch (error) {
      console.error("Failed to update room status:", error);
    } finally {
      setSavingStatus(false);
    }
  };

  if (loading) return <Box sx={{ display: "flex", justifyContent: "center", mt: 10 }}><CircularProgress /></Box>;
  if (!property) return <Typography align="center" mt={10}>Property not found.</Typography>;

  const coverPhotoUrl = getPropertyCoverPhotoUrl(property);
  const rooms = property.rooms || [];
  const occPct = overallMetrics.totalCapacity > 0
    ? Math.min(Math.round((overallMetrics.occupiedBeds / overallMetrics.totalCapacity) * 100), 100)
    : 0;

  // Has the owner changed anything in the status form yet?
  const selectedIsMaint = selectedRoomData
    ? selectedRoomData.room.status === "maintenance" || selectedRoomData.room.underMaintenance
    : false;
  const statusDirty = selectedRoomData
    ? (statusMode === "maintenance") !== !!selectedIsMaint ||
      (statusMode === "maintenance" && maintenanceNote.trim() !== (selectedRoomData.room.maintenanceNote || "").trim())
    : false;

  // Details for the selected room. A side card on desktop, a bottom sheet on phones.
  const roomPanel = selectedRoomData ? (
    <Box>
      <Box sx={{ ...row, justifyContent: "space-between", alignItems: "flex-start", gap: 1 }}>
        <Box sx={{ minWidth: 0 }}>
          <Box sx={{ ...row, gap: 1.25 }}>
            <Box sx={{ width: 14, height: 14, borderRadius: "4px", flexShrink: 0, bgcolor: STATUS_STYLES[selectedRoomData.status].fill }} />
            <Typography variant="h6" noWrap sx={{ fontFamily: '"Inter", sans-serif', fontWeight: 800 }}>
              {selectedRoomData.room.roomName}
            </Typography>
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
            {STATUS_STYLES[selectedRoomData.status].label}
          </Typography>
        </Box>
        <IconButton size="small" aria-label="Close room details" onClick={() => setSelectedRoomData(null)} sx={{ mt: -0.5, mr: -0.5 }}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>

      <Box sx={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 1, mt: 2 }}>
        {[
          ["Floor", selectedRoomData.room.floor ?? "—"],
          ["Capacity", `${selectedRoomData.room.capacity || 0} beds`],
          ["Rate / bed", selectedRoomData.room.monthlyRatePerBed ? `₱${selectedRoomData.room.monthlyRatePerBed}` : "—"],
        ].map(([label, value]) => (
          <Box key={label} sx={{ p: 1.25, borderRadius: 2, bgcolor: (t) => alpha(t.palette.background.paper, 0.45), minWidth: 0 }}>
            <Typography variant="caption" color="text.secondary" noWrap component="div">{label}</Typography>
            <Typography variant="body2" noWrap sx={{ fontWeight: 700 }}>{value}</Typography>
          </Box>
        ))}
      </Box>

      {/* TENANTS — what owners check most, so it comes first */}
      <Typography variant="subtitle2" sx={{ fontWeight: 700, mt: 3, mb: 1.25 }}>
        Tenants ({selectedRoomData.roomTenants.length}/{selectedRoomData.room.capacity || 0})
      </Typography>
      {selectedRoomData.roomTenants.length === 0 ? (
        <Typography variant="body2" color="text.secondary" sx={{ p: 2, textAlign: "center", border: "1px dashed", borderColor: "divider", borderRadius: 2 }}>
          No tenants assigned to this room.
        </Typography>
      ) : (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
          {selectedRoomData.roomTenants.map((tenant) => {
            const moveOut = getMoveOutDate(tenant);
            const tenantId = tenant.uid || tenant.id;
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
                  borderRadius: 2,
                  cursor: "pointer",
                  transition: "background-color .15s, border-color .15s",
                  "&:hover": { bgcolor: "action.hover", borderColor: "primary.main" },
                }}
              >
                <Box sx={{ width: 36, height: 36, borderRadius: "50%", flexShrink: 0, ...row, justifyContent: "center", bgcolor: "rgba(255, 69, 0, 0.10)", color: "primary.main", fontWeight: 800 }}>
                  {(tenant.name || tenant.fullName || tenant.email || "?").toString().trim().charAt(0).toUpperCase()}
                </Box>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="body2" noWrap sx={{ fontWeight: 700 }}>
                    {tenant.name || tenant.fullName || tenant.email || "Unnamed Tenant"}
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
      <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.25 }}>
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
          "& .MuiToggleButton-root": { textTransform: "none", fontWeight: 600, py: 0.9 },
          "& .MuiToggleButton-root.Mui-selected": {
            bgcolor: "rgba(255, 69, 0, 0.10)",
            color: "primary.main",
            "&:hover": { bgcolor: "rgba(255, 69, 0, 0.14)" },
          },
        }}
      >
        <ToggleButton value="operational">Available</ToggleButton>
        <ToggleButton value="maintenance">Maintenance</ToggleButton>
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
          sx={{ mb: 1.5 }}
        />
      )}

      <Button
        variant="contained"
        size="medium"
        startIcon={savingStatus ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
        onClick={handleSaveRoomStatus}
        disabled={savingStatus || !statusDirty}
        fullWidth
        sx={{ fontWeight: 700, borderRadius: 2.5 }}
      >
        {savingStatus ? "Saving..." : "Update status"}
      </Button>

      {saveSuccess && (
        <Alert icon={<CheckCircleOutlineIcon fontSize="inherit" />} severity="success" sx={{ mt: 1.5, py: 0, borderRadius: 2 }}>
          Room status updated
        </Alert>
      )}
    </Box>
  ) : null;

  return (
    <Box sx={{ maxWidth: 1100, mx: "auto", minWidth: 0 }}>
      {/* HEADER */}
      <Box sx={{ ...row, alignItems: "flex-start", gap: { xs: 1, sm: 2 }, mb: { xs: 2, md: 3 } }}>
        <IconButton aria-label="Back to properties" onClick={() => navigate("/owner/properties")} sx={{ ml: -1, mt: { xs: 0, sm: 0.5 } }}>
          <ArrowBackIcon />
        </IconButton>

        {coverPhotoUrl ? (
          <Box
            component="img"
            src={coverPhotoUrl}
            alt=""
            sx={{ width: { xs: 52, sm: 72 }, height: { xs: 52, sm: 72 }, borderRadius: 2.5, objectFit: "cover", flexShrink: 0 }}
          />
        ) : (
          <Box sx={{ width: { xs: 52, sm: 72 }, height: { xs: 52, sm: 72 }, borderRadius: 2.5, flexShrink: 0, ...row, justifyContent: "center", bgcolor: "rgba(255, 69, 0, 0.08)" }}>
            <HomeWorkOutlinedIcon sx={{ color: "primary.main" }} />
          </Box>
        )}

        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography
            sx={{ fontFamily: '"Inter", sans-serif', fontWeight: 800, fontSize: { xs: "1.25rem", sm: "1.7rem" }, lineHeight: 1.2 }}
            noWrap
          >
            {property.propertyName || "Unnamed property"}
          </Typography>
          <Box sx={{ ...row, gap: 1, mt: 0.5, flexWrap: "wrap" }}>
            <Chip
              label={property.propertyType || "Dormitory"}
              size="small"
              sx={{ bgcolor: "rgba(255, 69, 0, 0.08)", color: "primary.main", fontWeight: 700, border: "none" }}
            />
            <Box sx={{ ...row, gap: 0.5, color: "text.secondary", minWidth: 0 }}>
              <PlaceOutlinedIcon sx={{ fontSize: 16, flexShrink: 0 }} />
              <Typography variant="body2" sx={{ overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                {formatPropertyAddress(property)}
              </Typography>
            </Box>
          </Box>
        </Box>

        <Button
          variant="contained"
          startIcon={<EditIcon />}
          onClick={() => navigate(`/owner/properties/${id}/edit`)}
          sx={{ fontWeight: 700, borderRadius: 2.5, flexShrink: 0, display: { xs: "none", sm: "inline-flex" } }}
        >
          Edit property
        </Button>
        <IconButton
          aria-label="Edit property"
          onClick={() => navigate(`/owner/properties/${id}/edit`)}
          sx={{ display: { xs: "inline-flex", sm: "none" }, bgcolor: "primary.main", color: "#fff", "&:hover": { bgcolor: "primary.dark" } }}
        >
          <EditIcon fontSize="small" />
        </IconButton>
      </Box>

      {/* AT A GLANCE */}
      <SummaryStrip
        items={[
          { label: "Rooms", value: overallMetrics.totalRooms },
          { label: "Beds occupied", value: overallMetrics.occupiedBeds, suffix: `/ ${overallMetrics.totalCapacity}` },
          { label: "Beds available", value: overallMetrics.vacantBeds, color: "success.main" },
          { label: "Under maintenance", value: overallMetrics.maintenanceRooms, suffix: overallMetrics.maintenanceRooms === 1 ? "room" : "rooms", color: overallMetrics.maintenanceRooms > 0 ? "warning.main" : undefined },
        ]}
      />
      {overallMetrics.totalCapacity > 0 && (
        <LinearProgress
          variant="determinate"
          value={occPct}
          aria-label={`${occPct}% occupied`}
          sx={{ height: 6, borderRadius: 3, mt: -1.5, mb: { xs: 2, md: 3 }, bgcolor: (t) => alpha(t.palette.text.primary, 0.08) }}
        />
      )}

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
            icon={<GridViewOutlinedIcon sx={{ color: "primary.main" }} />}
            aside={
              <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600, flexShrink: 0 }}>
                {loadingTenants ? "Loading tenants…" : `${tenants.length} ${tenants.length === 1 ? "tenant" : "tenants"}`}
              </Typography>
            }
          >
            Room map
          </SectionTitle>
          {rooms.length > 0 ? (
            <RoomMap rooms={rooms} tenants={tenants} selectedRoomData={selectedRoomData} onSelectRoom={setSelectedRoomData} />
          ) : (
            <Typography color="text.secondary" sx={{ p: 3, textAlign: "center", border: "1px dashed", borderColor: "divider", borderRadius: 2 }}>
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
              <Box sx={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center" }}>
                <Box sx={{ width: 56, height: 56, borderRadius: "50%", mx: "auto", mb: 1.5, ...row, justifyContent: "center", bgcolor: "rgba(255, 69, 0, 0.08)" }}>
                  <TouchAppOutlinedIcon sx={{ color: "primary.main" }} />
                </Box>
                <Typography sx={{ fontWeight: 700 }}>Select a room</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
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
          open={Boolean(selectedRoomData)}
          onClose={() => setSelectedRoomData(null)}
          PaperProps={{
            sx: {
              borderTopLeftRadius: 20,
              borderTopRightRadius: 20,
              maxHeight: "85vh",
              "@supports (height: 1dvh)": { maxHeight: "85dvh" },
              overscrollBehavior: "contain",
              p: 2.5,
              pb: "calc(20px + env(safe-area-inset-bottom, 0px))",
            },
          }}
        >
          <Box sx={{ width: 40, height: 4, borderRadius: 2, bgcolor: "divider", mx: "auto", mb: 2 }} />
          {roomPanel}
        </Drawer>
      )}

      {/* AMENITIES & HOUSE RULES */}
      <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "repeat(2, minmax(0, 1fr))" }, gap: 3 }}>
        <Paper elevation={0} sx={{ ...cardSx, p: { xs: 2, sm: 3 } }}>
          <SectionTitle icon={<WifiOutlinedIcon sx={{ color: "primary.main" }} />}>Amenities</SectionTitle>
          {property.amenities?.length > 0 ? (
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
              {property.amenities.map((amenity) => (
                <Chip
                  key={amenity}
                  label={amenity}
                  sx={{ bgcolor: "rgba(202, 220, 246, 0.45)", color: "text.primary", fontWeight: 600, border: "none" }}
                />
              ))}
            </Box>
          ) : (
            <Typography variant="body2" color="text.secondary">No amenities listed.</Typography>
          )}
        </Paper>

        <Paper elevation={0} sx={{ ...cardSx, p: { xs: 2, sm: 3 } }}>
          <SectionTitle icon={<PolicyOutlinedIcon sx={{ color: "primary.main" }} />}>House rules</SectionTitle>
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
                    borderRadius: 2,
                    minWidth: 0,
                    "&:hover": { borderColor: "primary.main", color: "primary.main" },
                  }}
                >
                  <InsertDriveFileOutlinedIcon sx={{ fontSize: 20, color: "text.secondary", flexShrink: 0 }} />
                  <Typography variant="body2" noWrap sx={{ fontWeight: 600 }}>
                    {file.name}
                  </Typography>
                </Box>
              ))}
            </Box>
          )}
        </Paper>
      </Box>
    </Box>
  );
}