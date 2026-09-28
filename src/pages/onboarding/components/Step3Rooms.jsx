import React, { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Typography,
  TextField,
  MenuItem,
  ToggleButtonGroup,
  ToggleButton,
  Button,
  IconButton,
  Paper,
  Stack,
  Divider,
  Alert,
  CircularProgress,
  InputAdornment,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import RemoveIcon from "@mui/icons-material/Remove";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import AssessmentOutlinedIcon from "@mui/icons-material/AssessmentOutlined";

import {
  buildUniformRooms,
  buildPerFloorRooms,
  computeSummary,
} from "../../../utils/roomGenerator";
import { saveProperty } from "../../services/propertyService";
import { useAuth } from "../../../context/AuthContext";

const CAPACITY_OPTIONS = [1, 2, 3, 4, 6, 8, 10, 12];

const ROOM_TYPES = [
  "Bedspace",
  "Studio-type",
  "Solo / Single",
  "Private / Shared",
  "Custom",
];

const labelColStyle = {
  fontSize: "0.875rem",
  color: "text.secondary",
  fontWeight: 600,
  textAlign: { xs: "left", sm: "right" },
};

const rowSx = {
  display: "flex",
  flexDirection: { xs: "column", sm: "row" },
  alignItems: { xs: "stretch", sm: "center" },
  gap: { xs: 0.8, sm: 3 },
};

const labelColSx = { width: { xs: "100%", sm: "34%" }, flexShrink: 0, textAlign: { sm: "right" } };
const fieldColSx = { width: { xs: "100%", sm: "66%" } };

function ordinal(n) {
  const num = Number(n) || 0;
  const suffixes = ["th", "st", "nd", "rd"];
  const v = num % 100;
  return num + (suffixes[(v - 20) % 10] || suffixes[v] || suffixes[0]);
}

// Collision-free unique ID generator
const generateUniqueId = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

const generateDefaultGroup = () => ({
  id: generateUniqueId(),
  roomType: "Bedspace",
  customRoomType: "",
  numberOfRooms: 4,
  capacityPerRoom: 4,
  monthlyRate: 2500,
});

function Counter({ value, onDecrement, onIncrement, decrementLabel, incrementLabel, min = 1 }) {
  const isMin = value <= min;
  return (
    <Box sx={{ display: "inline-flex", alignItems: "center", gap: 1 }}>
      <IconButton
        size="small"
        onClick={onDecrement}
        disabled={isMin}
        aria-label={decrementLabel}
        sx={{
          border: "1px solid",
          borderColor: isMin ? "action.disabledBackground" : "divider",
          borderRadius: "4px",
          color: isMin ? "action.disabled" : "text.primary",
          "&:hover": {
            borderColor: isMin ? "action.disabledBackground" : "primary.main",
            color: isMin ? "action.disabled" : "primary.main",
          },
        }}
      >
        <RemoveIcon fontSize="small" />
      </IconButton>
      <Typography
        sx={{
          minWidth: 44,
          textAlign: "center",
          fontWeight: 700,
          fontSize: "1rem",
          bgcolor: "background.paper",
          borderRadius: "4px",
          py: 0.75,
          border: "1px solid",
          borderColor: "divider",
        }}
      >
        {value}
      </Typography>
      <IconButton
        size="small"
        onClick={onIncrement}
        aria-label={incrementLabel}
        sx={{
          border: "1px solid",
          borderColor: "divider",
          borderRadius: "4px",
          color: "text.primary",
          "&:hover": { borderColor: "primary.main", color: "primary.main" },
        }}
      >
        <AddIcon fontSize="small" />
      </IconButton>
    </Box>
  );
}

export default function Step3Rooms({ wizardData = {}, updateWizardData, onBack }) {
  const navigate = useNavigate();
  const { currentUser, loading: authLoading } = useAuth() || {};

  const totalFloors = Math.max(1, Number(wizardData?.totalFloors) || 1);

  const [namingPattern, setNamingPattern] = useState("floor");
  const [configMode, setConfigMode] = useState(totalFloors > 1 ? "perFloor" : "uniform");

  const [uniform, setUniform] = useState({
    roomsPerFloor: 5,
    capacityPerRoom: 4,
    monthlyRate: 2500,
  });

  const [floorConfigs, setFloorConfigs] = useState(() =>
    Array.from({ length: totalFloors }, (_, i) => ({
      floorNumber: i + 1,
      roomGroups: [generateDefaultGroup()],
    }))
  );

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // Sync floor configs array whenever totalFloors in wizardData changes
  useEffect(() => {
    setFloorConfigs((prev) => {
      if (prev.length === totalFloors) return prev;
      if (prev.length < totalFloors) {
        const added = Array.from({ length: totalFloors - prev.length }, (_, i) => {
          const lastConfig = prev[prev.length - 1];
          const copiedGroups = lastConfig?.roomGroups
            ? lastConfig.roomGroups.map((g) => ({ ...g, id: generateUniqueId() }))
            : [generateDefaultGroup()];
            
          return {
            floorNumber: prev.length + i + 1,
            roomGroups: copiedGroups,
          };
        });
        return [...prev, ...added];
      }
      return prev.slice(0, totalFloors);
    });
  }, [totalFloors]);

  // Derived generated rooms with robust safeguards against missing/NaN data
  const rooms = useMemo(() => {
    try {
      let generated = [];
      if (configMode === "uniform") {
        generated = buildUniformRooms({
          totalFloors: Number(totalFloors) || 1,
          roomsPerFloor: Math.max(0, Number(uniform.roomsPerFloor) || 0),
          capacityPerRoom: Math.max(0, Number(uniform.capacityPerRoom) || 0),
          monthlyRate: Math.max(0, Number(uniform.monthlyRate) || 0),
          namingPattern,
        });
      } else {
        // Deeply parse per-floor data and resolve custom room types
        const safeFloorConfigs = floorConfigs.map((floor) => ({
          ...floor,
          roomGroups: floor.roomGroups.map((group) => {
            const resolvedType =
              group.roomType === "Custom"
                ? group.customRoomType?.trim() || "Custom Room"
                : group.roomType;

            return {
              ...group,
              roomType: resolvedType,
              numberOfRooms: Math.max(0, Number(group.numberOfRooms) || 0),
              capacityPerRoom: Math.max(0, Number(group.capacityPerRoom) || 0),
              monthlyRate: Math.max(0, Number(group.monthlyRate) || 0),
            };
          }),
        }));
        
        generated = buildPerFloorRooms({ floorConfigs: safeFloorConfigs, namingPattern });
      }
      return generated || [];
    } catch (err) {
      console.error("Room generation utility failed:", err);
      return [];
    }
  }, [configMode, uniform, floorConfigs, namingPattern, totalFloors]);

  // Live room & bed layout summary computation
  const summary = useMemo(() => {
    if (!rooms || rooms.length === 0) return null;
    try {
      let result = computeSummary(rooms);
      
      // Fallback calculation if utility returns unexpected schema
      if (!result || !result.perFloorBreakdown || Object.keys(result.perFloorBreakdown).length === 0) {
        const perFloorBreakdown = {};
        let totalBeds = 0;
        
        rooms.forEach((room) => {
          const fNum = room.floorNumber || room.floor || 1;
          if (!perFloorBreakdown[fNum]) perFloorBreakdown[fNum] = { rooms: 0, beds: 0 };
          const capacity = Number(room.capacity || room.capacityPerRoom || 0);
          perFloorBreakdown[fNum].rooms += 1;
          perFloorBreakdown[fNum].beds += capacity;
          totalBeds += capacity;
        });

        result = { totalRooms: rooms.length, totalBeds, perFloorBreakdown };
      }
      return result;
    } catch (err) {
      console.error("Summary computation failed:", err);
      return null;
    }
  }, [rooms]);

  const handleGroupFieldChange = (floorIndex, groupIndex, field, value) => {
    setFloorConfigs((prev) => {
      const next = [...prev];
      const updatedGroups = [...next[floorIndex].roomGroups];
      let updatedGroup = { ...updatedGroups[groupIndex], [field]: value };

      // Reset customRoomType if switching room type away from "Custom"
      if (field === "roomType" && value !== "Custom") {
        updatedGroup.customRoomType = "";
      }

      updatedGroups[groupIndex] = updatedGroup;
      next[floorIndex] = { ...next[floorIndex], roomGroups: updatedGroups };
      return next;
    });
  };

  const handleAddRoomGroup = (floorIndex) => {
    setFloorConfigs((prev) => {
      const next = [...prev];
      next[floorIndex] = {
        ...next[floorIndex],
        roomGroups: [...next[floorIndex].roomGroups, generateDefaultGroup()],
      };
      return next;
    });
  };

  const handleRemoveRoomGroup = (floorIndex, groupIndex) => {
    setFloorConfigs((prev) => {
      const next = [...prev];
      const updatedGroups = next[floorIndex].roomGroups.filter((_, i) => i !== groupIndex);
      next[floorIndex] = { ...next[floorIndex], roomGroups: updatedGroups };
      return next;
    });
  };

  const handleCopyToNextFloor = (index) => {
    setFloorConfigs((prev) => {
      if (index + 1 >= prev.length) return prev;
      const next = [...prev];
      const copiedGroups = next[index].roomGroups.map((g) => ({
        ...g,
        id: generateUniqueId(),
      }));
      next[index + 1] = {
        ...next[index + 1],
        roomGroups: copiedGroups,
      };
      return next;
    });
  };

  const handleCopyToAllUpperFloors = (fromIndex) => {
    setFloorConfigs((prev) => {
      return prev.map((floor, idx) => {
        if (idx <= fromIndex) return floor;
        return {
          ...floor,
          roomGroups: prev[fromIndex].roomGroups.map((g) => ({
            ...g,
            id: generateUniqueId(),
          })),
        };
      });
    });
  };

  const handleGenerate = async () => {
    setError(null);

    // Validation check before proceeding
    if (!rooms || rooms.length === 0) {
      setError("Please configure at least 1 room for your property.");
      return;
    }

    setSaving(true);
    try {
      // 1. Strip undefined values from wizardData
      const cleanWizardData = { ...wizardData };
      Object.keys(cleanWizardData).forEach((key) => {
        if (cleanWizardData[key] === undefined) delete cleanWizardData[key];
      });

      // 2. Prepare payload with sensible defaults
      const finalWizardData = {
        ...cleanWizardData,
        propertyName: cleanWizardData.propertyName || cleanWizardData.name || "Untitled Property",
        address: cleanWizardData.address || "",
        totalFloors: Number(cleanWizardData.totalFloors) || totalFloors,
        genderRestriction: cleanWizardData.genderRestriction || "coed",
        amenities: cleanWizardData.amenities || [],
        rules: cleanWizardData.rules || [],
        description: cleanWizardData.description || "",
        namingPattern,
        configMode,
      };

      updateWizardData?.(finalWizardData);

      const ownerUid = currentUser?.uid || finalWizardData.ownerUid || "";
      const coverPhotoFile = finalWizardData.coverPhoto || null;

      // 3. Clean rooms array to prevent Firestore schema errors with undefined/NaN
      const safeRooms = rooms.map((room) => {
        const cleanRoom = { ...room };
        Object.keys(cleanRoom).forEach((key) => {
          if (cleanRoom[key] === undefined || Number.isNaN(cleanRoom[key])) {
            cleanRoom[key] = null;
          }
        });
        return cleanRoom;
      });

      const propertyId = await saveProperty(
        finalWizardData,
        safeRooms,
        ownerUid,
        coverPhotoFile
      );

      navigate("/wizard-success", {
        state: { summary, propertyId },
      });
    } catch (err) {
      console.error("Save Property Error:", err);
      setError(
        err.message || "Something went wrong while saving your property. Please try again."
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box sx={{ width: "100%", maxWidth: 700, mx: "auto", px: { xs: 1, sm: 2 } }}>
      <Box sx={{ mb: 4 }}>
        <Typography
          variant="h5"
          sx={{ fontFamily: '"Inter", sans-serif', fontWeight: 600 }}
          color="text.primary"
        >
          Set up rooms &amp; beds
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          Configure rooms uniformly, or customize capacities and room types floor by floor.
        </Typography>
      </Box>

      <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>

        {/* Room Naming Pattern */}
        <Box sx={rowSx}>
          <Box sx={labelColSx}>
            <Typography sx={labelColStyle}>Room naming pattern</Typography>
          </Box>
          <Box sx={fieldColSx}>
            <TextField
              select
              fullWidth
              value={namingPattern}
              onChange={(e) => setNamingPattern(e.target.value)}
            >
              <MenuItem value="floor">Floor-based (101, 102... / 201, 202...)</MenuItem>
              <MenuItem value="alpha">Alphabetical (A1, A2...)</MenuItem>
              <MenuItem value="sequential">Sequential numbers (1, 2, 3...)</MenuItem>
            </TextField>
          </Box>
        </Box>

        {/* Configuration Mode Toggle */}
        <Box sx={rowSx}>
          <Box sx={labelColSx}>
            <Typography sx={labelColStyle}>Configuration mode</Typography>
          </Box>
          <Box sx={fieldColSx}>
            <ToggleButtonGroup
              value={configMode}
              exclusive
              onChange={(_, val) => val && setConfigMode(val)}
              fullWidth
              sx={{
                "& .MuiToggleButton-root": {
                  textTransform: "none",
                  fontWeight: 600,
                  fontSize: "0.875rem",
                  borderColor: "divider",
                  color: "text.secondary",
                  "&.Mui-selected": {
                    bgcolor: "primary.main",
                    color: "#fff",
                    borderColor: "primary.main",
                    "&:hover": { bgcolor: "primary.main" },
                  },
                },
              }}
            >
              <ToggleButton value="uniform">Uniform layout</ToggleButton>
              <ToggleButton value="perFloor">Configure per floor</ToggleButton>
            </ToggleButtonGroup>
          </Box>
        </Box>

        {/* --- Uniform Layout Mode --- */}
        {configMode === "uniform" && (
          <Paper
            elevation={0}
            sx={{ border: "1px solid", borderColor: "divider", borderRadius: "4px", p: { xs: 2, sm: 3 } }}
          >
            <Stack spacing={2.5}>
              <Box sx={rowSx}>
                <Box sx={labelColSx}>
                  <Typography sx={labelColStyle}>Rooms per floor</Typography>
                </Box>
                <Box sx={fieldColSx}>
                  <Counter
                    value={uniform.roomsPerFloor || 1}
                    min={1}
                    decrementLabel="Decrease rooms per floor"
                    incrementLabel="Increase rooms per floor"
                    onDecrement={() =>
                      setUniform((u) => ({
                        ...u,
                        roomsPerFloor: Math.max(1, (Number(u.roomsPerFloor) || 1) - 1),
                      }))
                    }
                    onIncrement={() =>
                      setUniform((u) => ({
                        ...u,
                        roomsPerFloor: (Number(u.roomsPerFloor) || 0) + 1,
                      }))
                    }
                  />
                </Box>
              </Box>

              <Box sx={rowSx}>
                <Box sx={labelColSx}>
                  <Typography sx={labelColStyle}>Capacity per room</Typography>
                </Box>
                <Box sx={fieldColSx}>
                  <TextField
                    select
                    fullWidth
                    value={uniform.capacityPerRoom ?? 4}
                    onChange={(e) =>
                      setUniform((u) => ({
                        ...u,
                        capacityPerRoom: Number(e.target.value) || 0,
                      }))
                    }
                  >
                    {CAPACITY_OPTIONS.map((n) => (
                      <MenuItem key={n} value={n}>
                        {n} {n === 1 ? "bed" : "beds"} / room
                      </MenuItem>
                    ))}
                  </TextField>
                </Box>
              </Box>

              <Box sx={rowSx}>
                <Box sx={labelColSx}>
                  <Typography sx={labelColStyle}>Monthly rate per bed</Typography>
                </Box>
                <Box sx={fieldColSx}>
                  <TextField
                    type="number"
                    value={uniform.monthlyRate ?? ""}
                    onChange={(e) => {
                      const val = e.target.value;
                      setUniform((u) => ({
                        ...u,
                        monthlyRate: val === "" ? "" : Math.max(0, parseInt(val, 10) || 0),
                      }));
                    }}
                    slotProps={{
                      input: {
                        startAdornment: (
                          <InputAdornment position="start">₱</InputAdornment>
                        ),
                      },
                    }}
                    fullWidth
                    sx={{ maxWidth: 200 }}
                  />
                </Box>
              </Box>
            </Stack>
          </Paper>
        )}

        {/* --- Configure per Floor Mode --- */}
        {configMode === "perFloor" &&
          floorConfigs.map((floor, floorIndex) => (
            <Paper
              key={floor.floorNumber}
              elevation={0}
              sx={{ border: "1px solid", borderColor: "divider", borderRadius: "4px", p: { xs: 2, sm: 3 } }}
            >
              <Typography
                sx={{ fontFamily: '"Inter", sans-serif', fontWeight: 600, mb: 3 }}
                color="text.primary"
              >
                {ordinal(floor.floorNumber)} floor
              </Typography>

              <Stack spacing={4}>
                {floor.roomGroups.map((group, groupIndex) => (
                  <Box key={group.id} sx={{ position: "relative" }}>
                    
                    {floor.roomGroups.length > 1 && (
                      <IconButton
                        size="small"
                        color="error"
                        onClick={() => handleRemoveRoomGroup(floorIndex, groupIndex)}
                        aria-label="Remove room group"
                        sx={{ position: "absolute", top: -8, right: 0 }}
                      >
                        <RemoveIcon fontSize="small" />
                      </IconButton>
                    )}

                    <Stack spacing={2.5}>
                      <Box sx={rowSx}>
                        <Box sx={labelColSx}>
                          <Typography sx={labelColStyle}>Room type</Typography>
                        </Box>
                        <Box sx={fieldColSx}>
                          <Stack spacing={1}>
                            <TextField
                              select
                              fullWidth
                              value={group.roomType}
                              onChange={(e) =>
                                handleGroupFieldChange(floorIndex, groupIndex, "roomType", e.target.value)
                              }
                            >
                              {ROOM_TYPES.map((type) => (
                                <MenuItem key={type} value={type}>
                                  {type}
                                </MenuItem>
                              ))}
                            </TextField>
                            
                            {group.roomType === "Custom" && (
                              <TextField
                                fullWidth
                                placeholder="e.g. Quadruple sharing, Master's BR..."
                                value={group.customRoomType}
                                onChange={(e) =>
                                  handleGroupFieldChange(floorIndex, groupIndex, "customRoomType", e.target.value)
                                }
                                size="small"
                              />
                            )}
                          </Stack>
                        </Box>
                      </Box>

                      <Box sx={rowSx}>
                        <Box sx={labelColSx}>
                          <Typography sx={labelColStyle}>Number of rooms</Typography>
                        </Box>
                        <Box sx={fieldColSx}>
                          <Counter
                            value={group.numberOfRooms || 1}
                            min={1}
                            decrementLabel="Decrease rooms"
                            incrementLabel="Increase rooms"
                            onDecrement={() =>
                              handleGroupFieldChange(
                                floorIndex,
                                groupIndex,
                                "numberOfRooms",
                                Math.max(1, (Number(group.numberOfRooms) || 1) - 1)
                              )
                            }
                            onIncrement={() =>
                              handleGroupFieldChange(
                                floorIndex,
                                groupIndex,
                                "numberOfRooms",
                                (Number(group.numberOfRooms) || 0) + 1
                              )
                            }
                          />
                        </Box>
                      </Box>

                      <Box sx={rowSx}>
                        <Box sx={labelColSx}>
                          <Typography sx={labelColStyle}>Capacity</Typography>
                        </Box>
                        <Box sx={fieldColSx}>
                          <TextField
                            select
                            fullWidth
                            value={group.capacityPerRoom ?? 4}
                            onChange={(e) =>
                              handleGroupFieldChange(
                                floorIndex,
                                groupIndex,
                                "capacityPerRoom",
                                Number(e.target.value) || 0
                              )
                            }
                          >
                            {CAPACITY_OPTIONS.map((n) => (
                              <MenuItem key={n} value={n}>
                                {n} {n === 1 ? "bed" : "beds"}
                              </MenuItem>
                            ))}
                          </TextField>
                        </Box>
                      </Box>

                      <Box sx={rowSx}>
                        <Box sx={labelColSx}>
                          <Typography sx={labelColStyle}>Monthly rate per bed</Typography>
                        </Box>
                        <Box sx={fieldColSx}>
                          <TextField
                            type="number"
                            value={group.monthlyRate ?? ""}
                            onChange={(e) => {
                              const val = e.target.value;
                              handleGroupFieldChange(
                                floorIndex,
                                groupIndex,
                                "monthlyRate",
                                val === "" ? "" : Math.max(0, parseInt(val, 10) || 0)
                              );
                            }}
                            slotProps={{
                              input: {
                                startAdornment: (
                                  <InputAdornment position="start">₱</InputAdornment>
                                ),
                              },
                            }}
                            fullWidth
                            sx={{ maxWidth: 200 }}
                          />
                        </Box>
                      </Box>
                    </Stack>
                    
                    {groupIndex < floor.roomGroups.length - 1 && (
                      <Divider sx={{ mt: 4 }} />
                    )}
                  </Box>
                ))}

                <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, pt: 1 }}>
                  <Button
                    variant="text"
                    size="small"
                    startIcon={<AddIcon />}
                    onClick={() => handleAddRoomGroup(floorIndex)}
                    sx={{ alignSelf: "flex-start", fontWeight: 600 }}
                  >
                    Add another room type to this floor
                  </Button>

                  {floorIndex + 1 < floorConfigs.length && (
                    <Button
                      size="small"
                      startIcon={<ContentCopyIcon />}
                      onClick={() => handleCopyToNextFloor(floorIndex)}
                      sx={{
                        alignSelf: "flex-start",
                        color: "text.secondary",
                        "&:hover": { bgcolor: "transparent", color: "primary.main", textDecoration: "underline" },
                      }}
                    >
                      Copy entire floor settings to floor {floor.floorNumber + 1}
                    </Button>
                  )}

                  {floorIndex + 2 < floorConfigs.length && (
                    <Button
                      size="small"
                      startIcon={<ContentCopyIcon />}
                      onClick={() => handleCopyToAllUpperFloors(floorIndex)}
                      sx={{
                        alignSelf: "flex-start",
                        color: "text.secondary",
                        "&:hover": { bgcolor: "transparent", color: "primary.main", textDecoration: "underline" },
                      }}
                    >
                      Copy entire floor settings to all upper floors
                    </Button>
                  )}
                </Box>
              </Stack>
            </Paper>
          ))}

        {/* Live Summary Breakdown Preview */}
        <Paper
          elevation={0}
          sx={{
            border: "1px solid",
            borderColor: "primary.main",
            bgcolor: "rgba(255, 69, 0, 0.04)",
            borderRadius: "4px",
            p: { xs: 2, sm: 3 },
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1.5 }}>
            <AssessmentOutlinedIcon sx={{ fontSize: 20, color: "primary.main" }} />
            <Typography sx={{ fontFamily: '"Inter", sans-serif', fontWeight: 600 }} color="text.primary">
              Property layout breakdown
            </Typography>
          </Box>

          <Stack spacing={0.5}>
            {summary?.perFloorBreakdown && Object.keys(summary.perFloorBreakdown).length > 0 ? (
              Object.entries(summary.perFloorBreakdown).map(
                ([floorNum, data]) => {
                  const numRooms = Number(data?.rooms) || 0;
                  const numBeds = Number(data?.beds) || 0;
                  return (
                    <Typography key={floorNum} variant="body2" color="text.secondary">
                      {ordinal(Number(floorNum))} floor: {numRooms} rooms | {numBeds} total beds
                    </Typography>
                  );
                }
              )
            ) : (
              <Typography variant="body2" color="text.secondary">
                Configure floor settings above to view layout breakdown...
              </Typography>
            )}
          </Stack>

          <Divider sx={{ my: 1.5, borderColor: "rgba(255, 69, 0, 0.25)" }} />

          <Typography sx={{ fontWeight: 700 }} color="text.primary">
            Total building capacity: {summary?.totalRooms || 0} rooms |{" "}
            {summary?.totalBeds || 0} beds
          </Typography>
        </Paper>

        {error && <Alert severity="error">{error}</Alert>}

        {/* Sticky Action Footer */}
        <Stack
          direction="row"
          spacing={2}
          sx={{
            position: "sticky",
            bottom: 0,
            bgcolor: "background.default",
            py: 2,
            zIndex: 10,
            borderTop: "1px solid",
            borderColor: "divider",
          }}
        >
          <Button variant="outlined" onClick={onBack} disabled={saving || authLoading}>
            Back
          </Button>
          <Button
            variant="contained"
            fullWidth
            onClick={handleGenerate}
            disabled={saving || authLoading}
            startIcon={
              saving || authLoading ? (
                <CircularProgress size={18} color="inherit" />
              ) : null
            }
          >
            {saving
              ? "Saving..."
              : authLoading
              ? "Authenticating..."
              : `Generate ${summary?.totalRooms || 0} rooms & finish setup`}
          </Button>
        </Stack>
      </Box>
    </Box>
  );
}