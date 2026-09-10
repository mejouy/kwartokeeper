// src/pages/onboarding/components/Step3Rooms.jsx
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

const CAPACITY_OPTIONS = [1, 2, 3, 4, 6, 8];

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

// Counter control matching Step 2 styling
function Counter({ value, onDecrement, onIncrement, decrementLabel, incrementLabel }) {
  return (
    <Box sx={{ display: "inline-flex", alignItems: "center", gap: 1 }}>
      <IconButton
        size="small"
        onClick={onDecrement}
        aria-label={decrementLabel}
        sx={{
          border: "1px solid",
          borderColor: "divider",
          borderRadius: "4px",
          color: "text.primary",
          "&:hover": { borderColor: "primary.main", color: "primary.main" },
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
  const [configMode, setConfigMode] = useState(
    totalFloors > 1 ? "perFloor" : "uniform"
  );

  const [uniform, setUniform] = useState({
    roomsPerFloor: 5,
    capacityPerRoom: 4,
    monthlyRate: 2500,
  });

  const [floorConfigs, setFloorConfigs] = useState(() =>
    Array.from({ length: totalFloors }, (_, i) => ({
      floorNumber: i + 1,
      numberOfRooms: 4,
      capacityPerRoom: 4,
      monthlyRate: 2500,
    }))
  );

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // Sync floorConfigs array dynamically if user went back to Step 2 and changed totalFloors
  useEffect(() => {
    setFloorConfigs((prev) => {
      if (prev.length === totalFloors) return prev;
      if (prev.length < totalFloors) {
        const added = Array.from({ length: totalFloors - prev.length }, (_, i) => {
          const lastConfig = prev[prev.length - 1];
          return {
            floorNumber: prev.length + i + 1,
            numberOfRooms: lastConfig?.numberOfRooms || 4,
            capacityPerRoom: lastConfig?.capacityPerRoom || 4,
            monthlyRate: lastConfig?.monthlyRate || 2500,
          };
        });
        return [...prev, ...added];
      }
      return prev.slice(0, totalFloors);
    });
  }, [totalFloors]);

  // Derived rooms + live summary computation
  const rooms = useMemo(() => {
    if (configMode === "uniform") {
      return buildUniformRooms({
        totalFloors,
        roomsPerFloor: Number(uniform.roomsPerFloor) || 0,
        capacityPerRoom: Number(uniform.capacityPerRoom) || 0,
        monthlyRate: Number(uniform.monthlyRate) || 0,
        namingPattern,
      });
    }
    return buildPerFloorRooms({ floorConfigs, namingPattern });
  }, [configMode, uniform, floorConfigs, namingPattern, totalFloors]);

  const summary = useMemo(() => computeSummary(rooms), [rooms]);

  const handleFloorFieldChange = (index, field, value) => {
    setFloorConfigs((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const handleCopyToNextFloor = (index) => {
    setFloorConfigs((prev) => {
      if (index + 1 >= prev.length) return prev;
      const next = [...prev];
      const { numberOfRooms, capacityPerRoom, monthlyRate } = next[index];
      next[index + 1] = {
        ...next[index + 1],
        numberOfRooms,
        capacityPerRoom,
        monthlyRate,
      };
      return next;
    });
  };

  const handleGenerate = async () => {
    setError(null);
    setSaving(true);
    try {
      const finalWizardData = {
        propertyName: wizardData?.propertyName || wizardData?.name || "Untitled Property",
        address: wizardData?.address || "",
        totalFloors: Number(wizardData?.totalFloors) || totalFloors,
        genderRestriction: wizardData?.genderRestriction || "coed",
        amenities: wizardData?.amenities || [],
        rules: wizardData?.rules || [],
        description: wizardData?.description || "",
        ...wizardData,
        namingPattern,
        configMode,
      };

      updateWizardData?.(finalWizardData);

      const ownerUid = currentUser?.uid || wizardData?.ownerUid || "";
      const coverPhotoFile = wizardData?.coverPhoto || null;

      const propertyId = await saveProperty(
        finalWizardData,
        rooms,
        ownerUid,
        coverPhotoFile
      );

      navigate("/wizard-success", {
        state: { summary, propertyId },
      });
    } catch (err) {
      setError(
        err.message || "Something went wrong while saving your property."
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
          Configure rooms uniformly, or customize capacity floor by floor.
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

        {/* Configuration Mode */}
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
                    value={uniform.roomsPerFloor || 0}
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
                        {n} beds / room
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
                      const val = parseInt(e.target.value, 10);
                      setUniform((u) => ({
                        ...u,
                        monthlyRate: isNaN(val) ? "" : val,
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
          floorConfigs.map((floor, index) => (
            <Paper
              key={floor.floorNumber}
              elevation={0}
              sx={{ border: "1px solid", borderColor: "divider", borderRadius: "4px", p: { xs: 2, sm: 3 } }}
            >
              <Typography
                sx={{ fontFamily: '"Inter", sans-serif', fontWeight: 600, mb: 2 }}
                color="text.primary"
              >
                {ordinal(floor.floorNumber)} floor
              </Typography>

              <Stack spacing={2.5}>
                <Box sx={rowSx}>
                  <Box sx={labelColSx}>
                    <Typography sx={labelColStyle}>Number of rooms</Typography>
                  </Box>
                  <Box sx={fieldColSx}>
                    <Counter
                      value={floor.numberOfRooms || 0}
                      decrementLabel={`Decrease rooms on floor ${floor.floorNumber}`}
                      incrementLabel={`Increase rooms on floor ${floor.floorNumber}`}
                      onDecrement={() =>
                        handleFloorFieldChange(
                          index,
                          "numberOfRooms",
                          Math.max(1, (Number(floor.numberOfRooms) || 1) - 1)
                        )
                      }
                      onIncrement={() =>
                        handleFloorFieldChange(
                          index,
                          "numberOfRooms",
                          (Number(floor.numberOfRooms) || 0) + 1
                        )
                      }
                    />
                  </Box>
                </Box>

                <Box sx={rowSx}>
                  <Box sx={labelColSx}>
                    <Typography sx={labelColStyle}>Room type / capacity</Typography>
                  </Box>
                  <Box sx={fieldColSx}>
                    <TextField
                      select
                      fullWidth
                      value={floor.capacityPerRoom ?? 4}
                      onChange={(e) =>
                        handleFloorFieldChange(
                          index,
                          "capacityPerRoom",
                          Number(e.target.value) || 0
                        )
                      }
                    >
                      {CAPACITY_OPTIONS.map((n) => (
                        <MenuItem key={n} value={n}>
                          {n}-person room
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
                      value={floor.monthlyRate ?? ""}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        handleFloorFieldChange(
                          index,
                          "monthlyRate",
                          isNaN(val) ? "" : val
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

                {index + 1 < floorConfigs.length && (
                  <Box sx={rowSx}>
                    <Box sx={labelColSx} />
                    <Box sx={fieldColSx}>
                      <Button
                        size="small"
                        startIcon={<ContentCopyIcon />}
                        onClick={() => handleCopyToNextFloor(index)}
                        sx={{
                          alignSelf: "flex-start",
                          color: "primary.main",
                          px: 0,
                          "&:hover": { bgcolor: "transparent", textDecoration: "underline" },
                        }}
                      >
                        Copy settings to floor {floor.floorNumber + 1}
                      </Button>
                    </Box>
                  </Box>
                )}
              </Stack>
            </Paper>
          ))}

        {/* Live summary preview */}
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
            {summary?.perFloorBreakdown &&
              Object.entries(summary.perFloorBreakdown).map(
                ([floorNum, data]) => {
                  const numRooms = Number(data?.rooms) || 0;
                  const numBeds = Number(data?.beds) || 0;
                  const bedsPerRoom = numRooms > 0 ? Math.round(numBeds / numRooms) : 0;
                  const rate = Number(data?.rate) || 0;

                  return (
                    <Typography key={floorNum} variant="body2" color="text.secondary">
                      {ordinal(Number(floorNum))} floor: {numRooms} rooms ×{" "}
                      {bedsPerRoom} beds = {numBeds} beds (₱{rate}/bed)
                    </Typography>
                  );
                }
              )}
          </Stack>

          <Divider sx={{ my: 1.5, borderColor: "rgba(255, 69, 0, 0.25)" }} />

          <Typography sx={{ fontWeight: 700 }} color="text.primary">
            Total building capacity: {summary?.totalRooms || 0} rooms |{" "}
            {summary?.totalBeds || 0} beds
          </Typography>
        </Paper>

        {error && <Alert severity="error">{error}</Alert>}

        {/* Bottom action bar */}
        <Stack
          direction="row"
          spacing={2}
          sx={{
            position: "sticky",
            bottom: 0,
            bgcolor: "background.default",
            py: 2,
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