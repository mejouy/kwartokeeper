import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
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
  Paper,
  Stack,
  Divider,
  Alert,
  CircularProgress,
  Grid,
  LinearProgress,
  Card,
  CardContent,
  Chip,
  InputAdornment
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import LayersIcon from '@mui/icons-material/Layers';
import MeetingRoomIcon from '@mui/icons-material/MeetingRoom';
import KingBedIcon from '@mui/icons-material/KingBed';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import AnalyticsIcon from '@mui/icons-material/Analytics';

import {
  buildUniformRooms,
  buildPerFloorRooms,
  computeSummary,
} from '../../../utils/roomGenerator';
import { saveProperty } from '../../../services/propertyService';
import { useAuth } from '../../../context/AuthContext';

const CAPACITY_OPTIONS = [1, 2, 3, 4, 6, 8];

export default function Step3Rooms({ wizardData = {}, updateWizardData, onBack }) {
  const navigate = useNavigate();
  const auth = useAuth?.() || {}; 
  const currentUser = auth.currentUser;

  // Handles both key conventions seamlessly from previous wizard steps
  const totalFloors = wizardData?.floors || wizardData?.totalFloors || 1;

  const [namingPattern, setNamingPattern] = useState('floor');
  const [configMode, setConfigMode] = useState(
    totalFloors > 1 ? 'perFloor' : 'uniform'
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

  // --- Derived rooms + live summary computation ---
  const rooms = useMemo(() => {
    if (configMode === 'uniform') {
      return buildUniformRooms({
        totalFloors,
        roomsPerFloor: uniform.roomsPerFloor,
        capacityPerRoom: uniform.capacityPerRoom,
        monthlyRate: uniform.monthlyRate,
        namingPattern,
      });
    }
    return buildPerFloorRooms({ floorConfigs, namingPattern });
  }, [configMode, uniform, floorConfigs, namingPattern, totalFloors]);

  const summary = useMemo(() => computeSummary(rooms), [rooms]);

  // --- Handlers ---
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
      const finalWizardData = { ...wizardData, namingPattern, configMode };
      updateWizardData?.(finalWizardData);

      const ownerUid = currentUser?.uid || 'temp-owner-id';
      const propertyId = await saveProperty(finalWizardData, rooms, ownerUid);

      navigate('/wizard-success', {
        state: { summary, propertyId },
      });
    } catch (err) {
      setError(
        err.message || 'Something went wrong while saving your property layout.'
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Box sx={{ width: '100%', maxWidth: 1440, mx: 'auto', px: { xs: 2, sm: 4, lg: 6 }, py: { xs: 3, md: 5 } }}>
      <Grid container spacing={{ xs: 4, lg: 8 }}>
        
        {/* Left Sidebar: Context, Progress & Dynamic Summary */}
        <Grid item xs={12} md={4} lg={3.5}>
          <Box sx={{ position: 'sticky', top: 32 }}>
            
            {/* Progress Indicator */}
            <Box sx={{ mb: 4 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
                <Typography variant="overline" sx={{ fontWeight: 800, color: 'primary.main', letterSpacing: 1.2 }}>
                  Step 3 of 3
                </Typography>
                <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary' }}>
                  100%
                </Typography>
              </Stack>
              <LinearProgress 
                variant="determinate" 
                value={100} 
                color="success"
                sx={{ 
                  height: 8, 
                  borderRadius: 4, 
                  backgroundColor: 'action.hover',
                  '& .MuiLinearProgress-bar': { borderRadius: 4 }
                }} 
              />
            </Box>

            <Typography variant="h4" sx={{ fontWeight: 800, color: 'text.primary', mb: 2, fontSize: { xs: '1.75rem', md: '2.25rem' }, letterSpacing: '-0.02em' }}>
              Set Up Rooms & Beds
            </Typography>
            <Typography variant="body1" sx={{ color: 'text.secondary', mb: 4, lineHeight: 1.7, fontSize: '1.05rem' }}>
              Configure individual floor configurations, set pricing per bed, and choose how your rooms are indexed across the KwartoKeeper matrix.
            </Typography>

            {/* Live Aggregate Summary Widget */}
            <Paper 
              elevation={0} 
              sx={{ 
                p: 3, 
                backgroundColor: 'background.paper', 
                borderRadius: 3,
                border: '1px solid',
                borderColor: 'divider',
                boxShadow: '0 8px 24px rgba(0,0,0,0.04)'
              }}
            >
              <Stack direction="row" spacing={1.5} alignItems="center" mb={2}>
                <AnalyticsIcon color="primary" />
                <Typography variant="subtitle1" sx={{ fontWeight: 800, color: 'text.primary' }}>
                  Live Capacity Summary
                </Typography>
              </Stack>
              
              <Divider sx={{ mb: 2.5 }} />

              <Grid container spacing={2} sx={{ mb: 3 }}>
                <Grid item xs={6}>
                  <Box sx={{ p: 2, borderRadius: 2, bgcolor: 'action.hover', textAlign: 'center' }}>
                    <MeetingRoomIcon color="action" sx={{ mb: 0.5 }} />
                    <Typography variant="h4" sx={{ fontWeight: 800, color: 'primary.main' }}>
                      {summary.totalRooms || 0}
                    </Typography>
                    <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary' }}>
                      TOTAL ROOMS
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={6}>
                  <Box sx={{ p: 2, borderRadius: 2, bgcolor: 'action.hover', textAlign: 'center' }}>
                    <KingBedIcon color="action" sx={{ mb: 0.5 }} />
                    <Typography variant="h4" sx={{ fontWeight: 800, color: 'success.main' }}>
                      {summary.totalBeds || 0}
                    </Typography>
                    <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary' }}>
                      TOTAL BEDS
                    </Typography>
                  </Box>
                </Grid>
              </Grid>

              {/* Per-floor Breakdown List */}
              <Typography variant="caption" sx={{ fontWeight: 800, color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', mb: 1.5 }}>
                Floor Breakdown
              </Typography>
              <Stack spacing={1.5} sx={{ maxHeight: 220, overflowY: 'auto', pr: 0.5 }}>
                {Object.entries(summary.perFloorBreakdown || {}).map(([floorNum, data]) => (
                  <Stack 
                    key={floorNum} 
                    direction="row" 
                    justifyContent="space-between" 
                    alignItems="center"
                    sx={{ p: 1.25, borderRadius: 1.5, bgcolor: 'background.default', border: '1px solid', borderColor: 'divider' }}
                  >
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>
                      {ordinal(Number(floorNum))} Floor
                    </Typography>
                    <Chip 
                      label={`${data.rooms} rooms • ${data.beds} beds`} 
                      size="small" 
                      variant="outlined" 
                      sx={{ fontWeight: 600, fontSize: '0.75rem' }} 
                    />
                  </Stack>
                ))}
              </Stack>
            </Paper>
          </Box>
        </Grid>

        {/* Right Form Body */}
        <Grid item xs={12} md={8} lg={8.5}>
          <Paper 
            elevation={0} 
            sx={{ 
              borderRadius: 4, 
              border: '1px solid', 
              borderColor: 'divider',
              boxShadow: '0px 16px 48px rgba(0, 0, 0, 0.04)',
              overflow: 'hidden',
              backgroundColor: 'background.paper',
              mb: 4
            }}
          >
            {/* Section 1: Naming & Allocation Strategy */}
            <Box sx={{ p: { xs: 3, sm: 5 } }}>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 3, color: 'text.primary' }}>
                Strategy & Naming Scheme
              </Typography>

              <Grid container spacing={3}>
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth variant="outlined">
                    <InputLabel id="naming-pattern-label">Room Naming Pattern</InputLabel>
                    <Select
                      labelId="naming-pattern-label"
                      value={namingPattern}
                      label="Room Naming Pattern"
                      onChange={(e) => setNamingPattern(e.target.value)}
                    >
                      <MenuItem value="floor">Floor-based (101, 102... / 201, 202...)</MenuItem>
                      <MenuItem value="alpha">Alphabetical (A1, A2... / B1, B2...)</MenuItem>
                      <MenuItem value="sequential">Sequential Numbers (1, 2, 3...)</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>

                <Grid item xs={12} sm={6}>
                  <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', mb: 1, display: 'block' }}>
                    CONFIG MODE
                  </Typography>
                  <ToggleButtonGroup
                    value={configMode}
                    exclusive
                    onChange={(_, val) => val && setConfigMode(val)}
                    fullWidth
                    color="primary"
                    sx={{ height: 56 }}
                  >
                    <ToggleButton value="uniform" sx={{ fontWeight: 700 }}>Uniform</ToggleButton>
                    <ToggleButton value="perFloor" sx={{ fontWeight: 700 }}>Per Floor</ToggleButton>
                  </ToggleButtonGroup>
                </Grid>
              </Grid>
            </Box>

            <Divider />

            {/* Section 2: Room Layout Configurations */}
            <Box sx={{ p: { xs: 3, sm: 5 }, backgroundColor: 'action.hover' }}>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 1, color: 'text.primary' }}>
                {configMode === 'uniform' ? 'Uniform Floor Setup' : 'Custom Floor Configuration'}
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary', mb: 4 }}>
                {configMode === 'uniform' 
                  ? 'Apply a standardized room count, capacity, and rate across all building levels.' 
                  : 'Customize capacity and rates on a floor-by-floor basis.'}
              </Typography>

              {/* Uniform Layout Mode */}
              {configMode === 'uniform' && (
                <Paper elevation={0} sx={{ p: 4, borderRadius: 3, border: '1px solid', borderColor: 'divider', bgcolor: 'background.paper' }}>
                  <Grid container spacing={3.5} alignItems="center">
                    
                    {/* Rooms count stepper */}
                    <Grid item xs={12} sm={4}>
                      <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', mb: 1, display: 'block' }}>
                        ROOMS PER FLOOR
                      </Typography>
                      <Stack direction="row" alignItems="center" spacing={1} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 0.5 }}>
                        <IconButton 
                          onClick={() => setUniform((u) => ({ ...u, roomsPerFloor: Math.max(1, u.roomsPerFloor - 1) }))} 
                          color="primary" 
                          size="small"
                        >
                          <RemoveIcon />
                        </IconButton>
                        <Typography sx={{ flexGrow: 1, textAlign: 'center', fontWeight: 800, fontSize: '1.1rem' }}>
                          {uniform.roomsPerFloor}
                        </Typography>
                        <IconButton 
                          onClick={() => setUniform((u) => ({ ...u, roomsPerFloor: u.roomsPerFloor + 1 }))} 
                          color="primary" 
                          size="small"
                        >
                          <AddIcon />
                        </IconButton>
                      </Stack>
                    </Grid>

                    {/* Capacity */}
                    <Grid item xs={12} sm={4}>
                      <FormControl fullWidth variant="outlined">
                        <InputLabel id="uniform-capacity-label">Beds per Room</InputLabel>
                        <Select
                          labelId="uniform-capacity-label"
                          value={uniform.capacityPerRoom}
                          label="Beds per Room"
                          onChange={(e) => setUniform((u) => ({ ...u, capacityPerRoom: Number(e.target.value) }))}
                        >
                          {CAPACITY_OPTIONS.map((n) => (
                            <MenuItem key={n} value={n}>
                              {n} {n === 1 ? 'Bed' : 'Beds'} / Room
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>
                    </Grid>

                    {/* Rate */}
                    <Grid item xs={12} sm={4}>
                      <TextField
                        fullWidth
                        label="Monthly Rate / Bed"
                        type="number"
                        value={uniform.monthlyRate}
                        onChange={(e) => setUniform((u) => ({ ...u, monthlyRate: Number(e.target.value) }))}
                        InputProps={{
                          startAdornment: <InputAdornment position="start">₱</InputAdornment>,
                        }}
                      />
                    </Grid>

                  </Grid>
                </Paper>
              )}

              {/* Configure Per Floor Mode */}
              {configMode === 'perFloor' && (
                <Stack spacing={3}>
                  {floorConfigs.map((floor, index) => (
                    <Paper 
                      key={floor.floorNumber} 
                      elevation={0} 
                      sx={{ p: 3, borderRadius: 3, border: '1px solid', borderColor: 'divider', bgcolor: 'background.paper' }}
                    >
                      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
                        <Stack direction="row" spacing={1.5} alignItems="center">
                          <LayersIcon color="primary" />
                          <Typography variant="h6" sx={{ fontWeight: 800, fontSize: '1.1rem' }}>
                            {ordinal(floor.floorNumber)} Floor
                          </Typography>
                        </Stack>

                        {index + 1 < floorConfigs.length && (
                          <Button
                            size="small"
                            variant="text"
                            startIcon={<ContentCopyIcon />}
                            onClick={() => handleCopyToNextFloor(index)}
                            sx={{ fontWeight: 700, fontSize: '0.8rem' }}
                          >
                            Copy to Floor {floor.floorNumber + 1}
                          </Button>
                        )}
                      </Stack>

                      <Grid container spacing={3} alignItems="center">
                        <Grid item xs={12} sm={4}>
                          <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary', mb: 0.5, display: 'block' }}>
                            ROOM COUNT
                          </Typography>
                          <Stack direction="row" alignItems="center" spacing={1} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2, p: 0.5 }}>
                            <IconButton 
                              onClick={() => handleFloorFieldChange(index, 'numberOfRooms', Math.max(1, floor.numberOfRooms - 1))} 
                              size="small" 
                              color="primary"
                            >
                              <RemoveIcon />
                            </IconButton>
                            <Typography sx={{ flexGrow: 1, textAlign: 'center', fontWeight: 800 }}>
                              {floor.numberOfRooms}
                            </Typography>
                            <IconButton 
                              onClick={() => handleFloorFieldChange(index, 'numberOfRooms', floor.numberOfRooms + 1)} 
                              size="small" 
                              color="primary"
                            >
                              <AddIcon />
                            </IconButton>
                          </Stack>
                        </Grid>

                        <Grid item xs={12} sm={4}>
                          <FormControl fullWidth variant="outlined">
                            <InputLabel id={`capacity-label-${index}`}>Capacity / Room</InputLabel>
                            <Select
                              labelId={`capacity-label-${index}`}
                              value={floor.capacityPerRoom}
                              label="Capacity / Room"
                              onChange={(e) => handleFloorFieldChange(index, 'capacityPerRoom', Number(e.target.value))}
                            >
                              {CAPACITY_OPTIONS.map((n) => (
                                <MenuItem key={n} value={n}>
                                  {n}-Person Room
                                </MenuItem>
                              ))}
                            </Select>
                          </FormControl>
                        </Grid>

                        <Grid item xs={12} sm={4}>
                          <TextField
                            fullWidth
                            label="Monthly Rate / Bed"
                            type="number"
                            value={floor.monthlyRate}
                            onChange={(e) => handleFloorFieldChange(index, 'monthlyRate', Number(e.target.value))}
                            InputProps={{
                              startAdornment: <InputAdornment position="start">₱</InputAdornment>,
                            }}
                          />
                        </Grid>
                      </Grid>
                    </Paper>
                  ))}
                </Stack>
              )}
            </Box>
          </Paper>

          {error && (
            <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>
              {error}
            </Alert>
          )}

          {/* Bottom Navigation Actions */}
          <Paper 
            elevation={0}
            sx={{ 
              p: 2.5, 
              borderRadius: 3, 
              border: '1px solid', 
              borderColor: 'divider', 
              bgcolor: 'background.paper',
              position: 'sticky',
              bottom: 16,
              boxShadow: '0 -8px 24px rgba(0,0,0,0.06)'
            }}
          >
            <Stack direction="row" spacing={2} justifyContent="space-between">
              <Button 
                variant="outlined" 
                onClick={onBack} 
                disabled={saving}
                startIcon={<ArrowBackIcon />}
                sx={{ px: 3, fontWeight: 700, borderRadius: 2 }}
              >
                Back
              </Button>
              <Button
                variant="contained"
                onClick={handleGenerate}
                disabled={saving}
                size="large"
                startIcon={saving ? <CircularProgress size={20} color="inherit" /> : <CheckCircleOutlineIcon />}
                sx={{ px: 4, fontWeight: 700, borderRadius: 2, minWidth: 280 }}
              >
                {saving
                  ? 'Saving Matrix...'
                  : `Generate ${summary.totalRooms || 0} Rooms & Finish`}
              </Button>
            </Stack>
          </Paper>

        </Grid>
      </Grid>
    </Box>
  );
}

function ordinal(n) {
  const suffixes = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (suffixes[(v - 20) % 10] || suffixes[v] || suffixes[0]);
}