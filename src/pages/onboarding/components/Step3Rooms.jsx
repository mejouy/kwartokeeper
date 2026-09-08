// src/pages/onboarding/components/Step3Rooms.jsx
import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Typography,
  TextField,
  MenuItem,
  Select,
  InputLabel,
  FormControl,
  ToggleButtonGroup,
  ToggleButton,
  Button,
  IconButton,
  Card,
  CardContent,
  Stack,
  Divider,
  Alert,
  CircularProgress,
} from "@mui/material";
import AddIcon from "@mui/icons-material/Add";
import RemoveIcon from "@mui/icons-material/Remove";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";

import {
  buildUniformRooms,
  buildPerFloorRooms,
  computeSummary,
} from "../../../utils/roomGenerator";
import { saveProperty } from "../../services/propertyService";
import { useAuth } from "../../../context/AuthContext";

const CAPACITY_OPTIONS = [1, 2, 3, 4, 6, 8];

export default function Step3Rooms({ wizardData = {}, updateWizardData, onBack }) {
  const navigate = useNavigate();
  const { currentUser, loading: authLoading } = useAuth() || {};

  // Ensure totalFloors is safely parsed as a valid number
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

  const [floorConfigs, setFloorConfigs] = useState(
    Array.from({ length: totalFloors }, (_, i) => ({
      floorNumber: i + 1,
      numberOfRooms: 4,
      capacityPerRoom: 4,
      monthlyRate: 2500,
    }))
  );

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // --- derived rooms + live summary -----------------------------------
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

  // --- handlers ----------------------------------------------------------
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
      // 1. Package state while preserving existing wizard data
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

      // 2. Resolve owner UID
      const ownerUid =
        currentUser?.uid || wizardData?.ownerUid || "demo_owner_123";

      // 3. Bypass image upload explicitly to prevent CORS issues
      const coverPhotoFile = null;

      // 4. Save directly
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
    <Box sx={{ maxWidth: 600, mx: "auto", p: 2 }}>
      {/* Header */}
      <Typography variant="h4" fontWeight="bold" sx={{ mb: 0.5 }}>
        Set Up Rooms & Beds
      </Typography>
      <Typography variant="body1" sx={{ mb: 3, color: "text.secondary" }}>
        Configure rooms uniformly or customize capacity floor-by-floor.
      </Typography>

      {/* Naming scheme */}
      <FormControl fullWidth sx={{ mb: 3 }}>
        <InputLabel id="naming-pattern-label">Room Naming Pattern</InputLabel>
        <Select
          labelId="naming-pattern-label"
          value={namingPattern}
          label="Room Naming Pattern"
          onChange={(e) => setNamingPattern(e.target.value)}
        >
          <MenuItem value="floor">
            Floor-based (101, 102... / 201, 202...)
          </MenuItem>
          <MenuItem value="alpha">Alphabetical (A1, A2...)</MenuItem>
          <MenuItem value="sequential">
            Sequential Numbers (1, 2, 3...)
          </MenuItem>
        </Select>
      </FormControl>

      {/* Configuration mode toggle */}
      <ToggleButtonGroup
        value={configMode}
        exclusive
        onChange={(_, val) => val && setConfigMode(val)}
        fullWidth
        sx={{ mb: 3 }}
      >
        <ToggleButton value="uniform">Uniform Layout</ToggleButton>
        <ToggleButton value="perFloor">Configure per Floor</ToggleButton>
      </ToggleButtonGroup>

      {/* --- Uniform Layout --- */}
      {configMode === "uniform" && (
        <Card variant="outlined" sx={{ mb: 3 }}>
          <CardContent>
            <Stack spacing={2}>
              <Stack direction="row" sx={{ alignItems: "center" }} spacing={2}>
                <Typography sx={{ flexGrow: 1 }}>Rooms per Floor</Typography>
                <IconButton
                  onClick={() =>
                    setUniform((u) => ({
                      ...u,
                      roomsPerFloor: Math.max(1, (Number(u.roomsPerFloor) || 1) - 1),
                    }))
                  }
                >
                  <RemoveIcon />
                </IconButton>
                <Typography sx={{ minWidth: 24, textAlign: "center" }}>
                  {uniform.roomsPerFloor || 0}
                </Typography>
                <IconButton
                  onClick={() =>
                    setUniform((u) => ({
                      ...u,
                      roomsPerFloor: (Number(u.roomsPerFloor) || 0) + 1,
                    }))
                  }
                >
                  <AddIcon />
                </IconButton>
              </Stack>

              <FormControl fullWidth>
                <InputLabel id="capacity-label">Capacity per Room</InputLabel>
                <Select
                  labelId="capacity-label"
                  value={uniform.capacityPerRoom ?? 4}
                  label="Capacity per Room"
                  onChange={(e) =>
                    setUniform((u) => ({
                      ...u,
                      capacityPerRoom: Number(e.target.value) || 0,
                    }))
                  }
                >
                  {CAPACITY_OPTIONS.map((n) => (
                    <MenuItem key={n} value={n}>
                      {n} Beds / Room
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <TextField
                label="Monthly Rate per Bed"
                type="number"
                value={uniform.monthlyRate ?? ""}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  setUniform((u) => ({
                    ...u,
                    monthlyRate: isNaN(val) ? "" : val,
                  }));
                }}
                slotProps={{ input: { startAdornment: "₱" } }}
                fullWidth
              />
            </Stack>
          </CardContent>
        </Card>
      )}

      {/* --- Configure per Floor --- */}
      {configMode === "perFloor" &&
        floorConfigs.map((floor, index) => (
          <Card variant="outlined" sx={{ mb: 2 }} key={floor.floorNumber}>
            <CardContent>
              <Typography variant="h6" fontWeight="bold" sx={{ mb: 2 }}>
                {ordinal(floor.floorNumber)} Floor
              </Typography>
              <Stack spacing={2}>
                <Stack direction="row" sx={{ alignItems: "center" }} spacing={2}>
                  <Typography sx={{ flexGrow: 1 }}>Number of Rooms</Typography>
                  <IconButton
                    onClick={() =>
                      handleFloorFieldChange(
                        index,
                        "numberOfRooms",
                        Math.max(1, (Number(floor.numberOfRooms) || 1) - 1)
                      )
                    }
                  >
                    <RemoveIcon />
                  </IconButton>
                  <Typography sx={{ minWidth: 24, textAlign: "center" }}>
                    {floor.numberOfRooms || 0}
                  </Typography>
                  <IconButton
                    onClick={() =>
                      handleFloorFieldChange(
                        index,
                        "numberOfRooms",
                        (Number(floor.numberOfRooms) || 0) + 1
                      )
                    }
                  >
                    <AddIcon />
                  </IconButton>
                </Stack>

                <FormControl fullWidth>
                  <InputLabel id={`capacity-label-${index}`}>
                    Room Type / Capacity
                  </InputLabel>
                  <Select
                    labelId={`capacity-label-${index}`}
                    value={floor.capacityPerRoom ?? 4}
                    label="Room Type / Capacity"
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
                        {n}-Person Room
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <TextField
                  label="Monthly Rate per Bed"
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
                  slotProps={{ input: { startAdornment: "₱" } }}
                  fullWidth
                />

                {index + 1 < floorConfigs.length && (
                  <Button
                    size="small"
                    startIcon={<ContentCopyIcon />}
                    onClick={() => handleCopyToNextFloor(index)}
                    sx={{ alignSelf: "flex-start" }}
                  >
                    Copy settings to Floor {floor.floorNumber + 1}
                  </Button>
                )}
              </Stack>
            </CardContent>
          </Card>
        ))}

      {/* Live summary preview */}
      <Card variant="outlined" sx={{ mb: 3, bgcolor: "action.hover" }}>
        <CardContent>
          <Typography variant="h6" fontWeight="bold" sx={{ mb: 1 }}>
            📊 Property Layout Breakdown
          </Typography>
          <Stack spacing={0.5}>
            {summary?.perFloorBreakdown &&
              Object.entries(summary.perFloorBreakdown).map(
                ([floorNum, data]) => {
                  const numRooms = Number(data?.rooms) || 0;
                  const numBeds = Number(data?.beds) || 0;
                  const bedsPerRoom = numRooms > 0 ? Math.round(numBeds / numRooms) : 0;
                  const rate = Number(data?.rate) || 0;

                  return (
                    <Typography key={floorNum} variant="body2">
                      {ordinal(Number(floorNum))} Floor: {numRooms} rooms ×{" "}
                      {bedsPerRoom} beds = {numBeds} Beds (₱{rate}/bed)
                    </Typography>
                  );
                }
              )}
          </Stack>
          <Divider sx={{ my: 1 }} />
          <Typography variant="body1" fontWeight="bold">
            Total Building Capacity: {summary?.totalRooms || 0} Rooms |{" "}
            {summary?.totalBeds || 0} Beds
          </Typography>
        </CardContent>
      </Card>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Bottom action bar */}
      <Stack
        direction="row"
        spacing={2}
        sx={{
          position: "sticky",
          bottom: 0,
          bgcolor: "background.paper",
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
            : `Generate ${summary?.totalRooms || 0} Rooms & Finish Setup`}
        </Button>
      </Stack>
    </Box>
  );
}

function ordinal(n) {
  const num = Number(n) || 0;
  const suffixes = ["th", "st", "nd", "rd"];
  const v = num % 100;
  return num + (suffixes[(v - 20) % 10] || suffixes[v] || suffixes[0]);
}