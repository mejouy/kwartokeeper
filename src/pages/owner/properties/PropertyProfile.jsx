import React, { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Box, Typography, Button, IconButton, Chip, CircularProgress,
  Grid, Stack, Collapse, Popover
} from "@mui/material";

import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import EditIcon from "@mui/icons-material/Edit";
import PolicyOutlinedIcon from "@mui/icons-material/PolicyOutlined";
import WifiOutlinedIcon from "@mui/icons-material/WifiOutlined";
import InsertDriveFileOutlinedIcon from "@mui/icons-material/InsertDriveFileOutlined";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import GridViewOutlinedIcon from "@mui/icons-material/GridViewOutlined";
import HandymanOutlinedIcon from "@mui/icons-material/HandymanOutlined";

import { collection, doc, getDoc, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../../../config/firebase"; // Adjust to your firebase path

// Helper function to safely render the address
const formatAddress = (address) => {
  if (!address) return "No address specified";
  if (typeof address === "string") return address;

  const { street, barangay, cityMunicipality, province } = address;
  const addressParts = [street, barangay, cityMunicipality, province].filter(Boolean);

  return addressParts.length > 0 ? addressParts.join(", ") : "Invalid address format";
};

// Tolerant date formatting — handles Firestore Timestamps, date strings,
// or nothing at all.
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

// vacant | partial | full | maintenance
const getRoomStatus = (room, roomTenants) => {
  if (room?.status === "maintenance" || room?.underMaintenance) return "maintenance";
  const capacity = Number(room?.capacity) || 0;
  const occupied = roomTenants.length;
  if (occupied === 0) return "vacant";
  if (capacity > 0 && occupied >= capacity) return "full";
  return "partial";
};

const STATUS_STYLES = {
  vacant: { fill: "rgba(202, 220, 246, 0.35)", label: "Vacant" },
  partial: { fill: "rgba(255, 69, 0, 0.45)", label: "Partially occupied" },
  full: { fill: "#ff4500", label: "Fully occupied" },
  maintenance: { fill: "rgba(0, 0, 0, 0.14)", label: "Under maintenance" },
};

// A single clickable tile in the room map — color communicates status at a
// glance, click opens a popover with the specifics (tenants + move-out
// dates, or a maintenance note).
function RoomTile({ room, roomTenants, onSelect }) {
  const status = getRoomStatus(room, roomTenants);
  const style = STATUS_STYLES[status];

  return (
    <Box
      component="button"
      type="button"
      onClick={(e) => onSelect(e.currentTarget, room, roomTenants, status)}
      sx={{
        width: 64,
        height: 64,
        borderRadius: 2,
        border: "none",
        bgcolor: style.fill,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        gap: 0.25,
        transition: "transform 0.12s ease",
        "&:hover": { transform: "scale(1.06)" },
      }}
      aria-label={`${room.roomName}, ${style.label}`}
    >
      {status === "maintenance" && <HandymanOutlinedIcon sx={{ fontSize: 16, color: "text.secondary" }} />}
      <Typography
        variant="caption"
        sx={{
          fontWeight: 700,
          fontSize: "0.7rem",
          color: status === "full" ? "#ffffff" : "text.primary",
          lineHeight: 1,
        }}
      >
        {room.roomName}
      </Typography>
    </Box>
  );
}

// Collapsible at-a-glance map of every room, grouped by floor.
function RoomMap({ rooms, tenants, loadingTenants }) {
  const [open, setOpen] = useState(true);
  const [popoverAnchor, setPopoverAnchor] = useState(null);
  const [selected, setSelected] = useState(null); // { room, roomTenants, status }

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

  const handleSelect = (anchorEl, room, roomTenants, status) => {
    setPopoverAnchor(anchorEl);
    setSelected({ room, roomTenants, status });
  };

  const handleClose = () => {
    setPopoverAnchor(null);
    setSelected(null);
  };

  if (!rooms?.length) return null;

  return (
    <Box sx={{ mb: 6 }}>
      <Box
        component="button"
        type="button"
        onClick={() => setOpen((o) => !o)}
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          width: "100%",
          p: 0,
          border: "none",
          bgcolor: "transparent",
          cursor: "pointer",
          mb: open ? 2.5 : 0,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.25 }}>
          <GridViewOutlinedIcon sx={{ color: "primary.main" }} />
          <Typography variant="h6" sx={{ fontFamily: '"Inter", sans-serif', fontWeight: 700 }} color="text.primary">
            Room mapping
          </Typography>
        </Box>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <Typography variant="body2" sx={{ color: "text.secondary", fontWeight: 600 }}>
            {loadingTenants ? "Loading tenants…" : `${tenants.length} ${tenants.length === 1 ? "tenant" : "tenants"} total`}
          </Typography>
          {open ? <ExpandLessIcon sx={{ color: "text.secondary" }} /> : <ExpandMoreIcon sx={{ color: "text.secondary" }} />}
        </Box>
      </Box>

      <Collapse in={open}>
        {/* Legend */}
        <Stack direction="row" flexWrap="wrap" spacing={2.5} sx={{ mb: 3 }}>
          {Object.entries(STATUS_STYLES).map(([key, s]) => (
            <Box key={key} sx={{ display: "flex", alignItems: "center", gap: 0.75 }}>
              <Box sx={{ width: 12, height: 12, borderRadius: "4px", bgcolor: s.fill }} />
              <Typography variant="caption" color="text.secondary">{s.label}</Typography>
            </Box>
          ))}
        </Stack>

        <Stack spacing={3}>
          {floors.map(([floorKey, floorRooms]) => (
            <Box key={floorKey}>
              <Typography variant="body2" sx={{ fontWeight: 600, color: "text.secondary", mb: 1.25 }}>
                {floorKey === "Unassigned" ? "Unassigned" : `Floor ${floorKey}`}
              </Typography>
              <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.25 }}>
                {floorRooms.map((room, idx) => {
                  const roomName = String(room.roomName || room.roomNumber || room.id || "");
                  const roomTenants = tenants.filter((tenant) => {
                    const assignedRoom = tenant.roomId || tenant.roomNumber || tenant.room || "";
                    return String(assignedRoom) === roomName;
                  });
                  return (
                    <RoomTile key={idx} room={room} roomTenants={roomTenants} onSelect={handleSelect} />
                  );
                })}
              </Box>
            </Box>
          ))}
        </Stack>
      </Collapse>

      <Popover
        open={Boolean(popoverAnchor)}
        anchorEl={popoverAnchor}
        onClose={handleClose}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
        transformOrigin={{ vertical: "top", horizontal: "center" }}
        slotProps={{ paper: { sx: { p: 2.5, minWidth: 220, borderRadius: 2 } } }}
      >
        {selected && (
          <Box>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
              <Box sx={{ width: 10, height: 10, borderRadius: "3px", bgcolor: STATUS_STYLES[selected.status].fill }} />
              <Typography sx={{ fontFamily: '"Inter", sans-serif', fontWeight: 700 }} color="text.primary">
                {selected.room.roomName}
              </Typography>
            </Box>
            <Box sx={{ mb: 1.5 }}>
              <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
                {STATUS_STYLES[selected.status].label}
                {selected.status !== "maintenance" && ` · ${selected.roomTenants.length}/${Number(selected.room.capacity) || 0} beds`}
              </Typography>
              {selected.room.monthlyRatePerBed != null && (
                <Typography variant="caption" sx={{ display: "block", fontWeight: 600, color: "primary.main" }}>
                  ₱{selected.room.monthlyRatePerBed} / bed
                </Typography>
              )}
            </Box>

            {selected.status === "maintenance" && (
              <Typography variant="body2" color="text.secondary">
                {selected.room.maintenanceNote || "No maintenance notes added."}
              </Typography>
            )}

            {selected.status !== "maintenance" && selected.roomTenants.length === 0 && (
              <Typography variant="body2" color="text.secondary">
                No tenants currently assigned.
              </Typography>
            )}

            {selected.status !== "maintenance" && selected.roomTenants.length > 0 && (
              <Stack spacing={1}>
                {selected.roomTenants.map((tenant) => {
                  const moveOut = getMoveOutDate(tenant);
                  return (
                    <Box key={tenant.uid || tenant.id}>
                      <Typography variant="body2" sx={{ fontWeight: 600 }} color="text.primary">
                        {tenant.name || tenant.fullName || tenant.email || "Tenant"}
                        {(tenant.bedId || tenant.bedNumber) ? ` · ${tenant.bedId || tenant.bedNumber}` : ""}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {moveOut ? `Move-out: ${moveOut}` : "No scheduled move-out"}
                      </Typography>
                    </Box>
                  );
                })}
              </Stack>
            )}
          </Box>
        )}
      </Popover>
    </Box>
  );
}

export default function PropertyProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [property, setProperty] = useState(null);
  const [tenants, setTenants] = useState([]);
  const [loadingTenants, setLoadingTenants] = useState(true);

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

  if (loading) return <Box sx={{ display: "flex", justifyContent: "center", mt: 10 }}><CircularProgress /></Box>;
  if (!property) return <Typography align="center" mt={10}>Property not found.</Typography>;

  return (
    <Box sx={{ maxWidth: 1100, mx: "auto", p: { xs: 2, md: 4 } }}>

      {/* HEADER */}
      <Box sx={{ display: "flex", alignItems: "flex-start", mb: 5, flexWrap: "wrap", gap: 2 }}>
        <IconButton onClick={() => navigate("/owner/properties")} sx={{ mt: 0.5 }}>
          <ArrowBackIcon />
        </IconButton>

        <Box sx={{ flexGrow: 1 }}>
          <Box sx={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 1.5, mb: 0.5 }}>
            <Typography
              variant="h4"
              sx={{ fontFamily: '"Inter", sans-serif', fontWeight: 900 }}
              color="text.primary"
            >
              {property.propertyName || "Unnamed property"}
            </Typography>
            <Chip
              label={property.propertyType || "Dormitory"}
              size="small"
              sx={{ bgcolor: "rgba(255, 69, 0, 0.08)", color: "primary.main", fontWeight: 600, border: "none" }}
            />
          </Box>
          <Typography variant="body1" color="text.secondary">
            {formatAddress(property.address)}
          </Typography>
        </Box>

        <Button
          variant="contained"
          startIcon={<EditIcon />}
          onClick={() => navigate(`/owner/properties/${id}/edit`)}
          sx={{ fontWeight: 600, px: 3, py: 1.25 }}
        >
          Edit property
        </Button>
      </Box>

      {/* ROOM MAPPING — collapsible at-a-glance view, replaces the old separate room-cards section */}
      {property.rooms?.length > 0 ? (
        <RoomMap rooms={property.rooms} tenants={tenants} loadingTenants={loadingTenants} />
      ) : (
        <Box sx={{ mb: 6 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, mb: 2.5 }}>
            <GridViewOutlinedIcon sx={{ color: "primary.main" }} />
            <Typography variant="h6" sx={{ fontFamily: '"Inter", sans-serif', fontWeight: 700 }} color="text.primary">
              Room mapping
            </Typography>
          </Box>
          <Typography color="text.secondary" sx={{ p: 3, bgcolor: "background.paper", borderRadius: 2 }}>
            No rooms have been added to this property yet.
          </Typography>
        </Box>
      )}

      {/* AMENITIES & HOUSE RULES */}
      <Grid container spacing={5}>

        <Grid size={{ xs: 12, md: 6 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, mb: 2.5 }}>
            <WifiOutlinedIcon sx={{ color: "primary.main" }} />
            <Typography variant="h6" sx={{ fontFamily: '"Inter", sans-serif', fontWeight: 700 }} color="text.primary">
              Amenities
            </Typography>
          </Box>
          {property.amenities?.length > 0 ? (
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
              {property.amenities.map((amenity) => (
                <Chip
                  key={amenity}
                  label={amenity}
                  size="small"
                  sx={{ bgcolor: "rgba(202, 220, 246, 0.35)", color: "text.primary", fontWeight: 500, border: "none" }}
                />
              ))}
            </Box>
          ) : (
            <Typography color="text.secondary">No amenities listed.</Typography>
          )}
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, mb: 2.5 }}>
            <PolicyOutlinedIcon sx={{ color: "primary.main" }} />
            <Typography variant="h6" sx={{ fontFamily: '"Inter", sans-serif', fontWeight: 700 }} color="text.primary">
              House rules
            </Typography>
          </Box>
          <Typography variant="body2" sx={{ whiteSpace: "pre-line", mb: 3, color: "text.secondary", lineHeight: 1.7 }}>
            {property.rulesText || "No house rules specified."}
          </Typography>

          {property.ruleFiles?.length > 0 && (
            <Stack spacing={1}>
              {property.ruleFiles.map((file, idx) => (
                <Box
                  key={idx}
                  component="a"
                  href={file.url}
                  target="_blank"
                  rel="noopener"
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    gap: 1,
                    color: "text.primary",
                    textDecoration: "none",
                    "&:hover": { color: "primary.main" },
                  }}
                >
                  <InsertDriveFileOutlinedIcon sx={{ fontSize: 18, color: "text.secondary" }} />
                  <Typography variant="body2" sx={{ fontWeight: 500 }}>
                    {file.name}
                  </Typography>
                </Box>
              ))}
            </Stack>
          )}
        </Grid>

      </Grid>

    </Box>
  );
}