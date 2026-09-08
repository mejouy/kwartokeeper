<<<<<<< HEAD
import React from 'react';
import {
  Box,
  Typography,
  TextField,
  Switch,
  Checkbox,
  FormControlLabel,
  FormGroup,
  Grid,
  Paper,
  Stack,
  InputAdornment,
  Divider,
  LinearProgress,
  IconButton
} from '@mui/material';
import DomainIcon from '@mui/icons-material/Domain';
import MeetingRoomIcon from '@mui/icons-material/MeetingRoom';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import SecurityIcon from '@mui/icons-material/Security';
import NightlightRoundIcon from '@mui/icons-material/NightlightRound';
import RuleIcon from '@mui/icons-material/Rule';

const amenitiesList = [
  'Wi-Fi',
  'Air Conditioning',
  'CCTV',
  'Shared Kitchen',
  'Laundry Area',
  'Lounge / Study Area'
];

export const Step2Policies = ({ wizardData = {}, updateWizardData }) => {
  const handleFloorsChange = (delta) => {
    const newFloors = Math.max(1, (wizardData.floors || 1) + delta);
    updateWizardData({ floors: newFloors });
=======
import { Box, Typography, Switch, FormControlLabel, Checkbox } from '@mui/material';

const labelStyle = {
  fontSize: '0.875rem',
  color: '#333',
  fontWeight: 500,
  textAlign: { xs: 'left', sm: 'right' },
  whiteSpace: 'nowrap'
};

const inputStyle = {
  backgroundColor: '#D9D9D9',
  border: 'none',
  outline: 'none',
  padding: '8px 12px',
  fontSize: '0.875rem',
  borderRadius: '2px',
  boxSizing: 'border-box'
};

const AMENITIES_LIST = ['Wi-Fi', 'Air Conditioning', 'CCTV', 'Shared Kitchen'];

export const Step2Policies = ({ wizardData = {}, updateWizardData }) => {
  // Floor counter handlers
  const handleFloorChange = (delta) => {
    const current = Number(wizardData.totalFloors) || 1;
    const nextVal = Math.max(1, current + delta);
    updateWizardData({ totalFloors: nextVal });
>>>>>>> origin/feature/property-wizard
  };

  // Text / Input change handler
  const handleChange = (field) => (e) => {
    updateWizardData({ [field]: e.target.value });
  };

  // Estimated rooms handler (prevents NaN)
  const handleRoomsChange = (e) => {
    const val = parseInt(e.target.value, 10);
    updateWizardData({ estimatedRooms: isNaN(val) ? '' : val });
  };

  // Amenities Checkbox handler
  const handleAmenityToggle = (amenity) => {
<<<<<<< HEAD
    const current = wizardData.amenities || [];
    const updated = current.includes(amenity)
      ? current.filter((a) => a !== amenity)
      : [...current, amenity];
    updateWizardData({ amenities: updated });
  };

  return (
    <Box sx={{ width: '100%', maxWidth: 1440, mx: 'auto', px: { xs: 2, sm: 4, lg: 6 }, py: { xs: 3, md: 5 } }}>
      <Grid container spacing={{ xs: 4, lg: 8 }}>
        
        {/* Left Column: Context, Progress & Instructions */}
        <Grid item xs={12} md={4} lg={3.5}>
          <Box sx={{ position: 'sticky', top: 32 }}>
            
            {/* MUI Progress Indicator */}
            <Box sx={{ mb: 4 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
                <Typography variant="overline" sx={{ fontWeight: 800, color: 'primary.main', letterSpacing: 1.2 }}>
                  Step 2 of 3
                </Typography>
                <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary' }}>
                  66%
                </Typography>
              </Stack>
              <LinearProgress 
                variant="determinate" 
                value={66} 
                sx={{ 
                  height: 8, 
                  borderRadius: 4, 
                  backgroundColor: 'action.hover',
                  '& .MuiLinearProgress-bar': { borderRadius: 4 }
                }} 
              />
            </Box>

            <Typography variant="h4" sx={{ fontWeight: 800, color: 'text.primary', mb: 2, fontSize: { xs: '1.75rem', md: '2.25rem' }, letterSpacing: '-0.02em' }}>
              Building & Rules
            </Typography>
            <Typography variant="body1" sx={{ color: 'text.secondary', mb: 4, lineHeight: 1.7, fontSize: '1.05rem' }}>
              Define your building's scale, available amenities, and foundational house rules. This data builds the framework for your KwartoKeeper room management matrix.
            </Typography>

            <Paper 
              elevation={0} 
              sx={{ 
                p: 3, 
                backgroundColor: 'primary.main', 
                color: 'primary.contrastText',
                borderRadius: 3,
                boxShadow: '0 8px 24px rgba(0,0,0,0.12)'
              }}
            >
              <Stack direction="row" spacing={2} alignItems="flex-start">
                <RuleIcon sx={{ mt: 0.5, opacity: 0.9 }} />
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5, letterSpacing: 0.5 }}>
                    SYSTEM CONFIGURATION
                  </Typography>
                  <Typography variant="body2" sx={{ opacity: 0.85, lineHeight: 1.6 }}>
                    The floor count dictates how the app organizes your occupancy dashboard. Policies set here will automatically appear in your tenants' mobile view.
                  </Typography>
                </Box>
              </Stack>
            </Paper>
=======
    const currentList = Array.isArray(wizardData.amenities) ? wizardData.amenities : [];
    if (currentList.includes(amenity)) {
      updateWizardData({ amenities: currentList.filter((a) => a !== amenity) });
    } else {
      updateWizardData({ amenities: [...currentList, amenity] });
    }
  };

  return (
    <Box sx={{ width: '100%', maxWidth: 700, mx: 'auto', px: { xs: 1, sm: 2 } }}>
      {/* Header */}
      <Box sx={{ mb: 4, textAlign: 'left' }}>
        <Typography variant="caption" sx={{ color: '#888', display: 'block', mb: 0.5 }}>
          Step 2 of 3
        </Typography>
        <Typography variant="subtitle1" fontWeight="bold" sx={{ color: '#111', lineHeight: 1.2 }}>
          Building Structure & Rules
        </Typography>
        <Typography variant="body2" sx={{ color: '#666', mt: 0.5 }}>
          Define your building scale and standard house rules.
        </Typography>
      </Box>

      {/* Form Content */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        
        {/* Number of Floors & Estimated Total Rooms inline row */}
        <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 3 }}>
          
          {/* Number of Floors with - / + Controls */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Typography sx={labelStyle}>Number of Floors:</Typography>
            <button
              type="button"
              onClick={() => handleFloorChange(-1)}
              style={{
                border: 'none',
                background: 'none',
                fontSize: '1.2rem',
                fontWeight: 'bold',
                cursor: 'pointer',
                padding: '0 4px'
              }}
            >
              −
            </button>
            <input
              type="text"
              readOnly
              style={{
                ...inputStyle,
                width: '60px',
                textAlign: 'center'
              }}
              value={Number(wizardData.totalFloors) || 1}
            />
            <button
              type="button"
              onClick={() => handleFloorChange(1)}
              style={{
                border: 'none',
                background: 'none',
                fontSize: '1.2rem',
                fontWeight: 'bold',
                cursor: 'pointer',
                padding: '0 4px'
              }}
            >
              +
            </button>
          </Box>

          {/* Estimated Total Rooms */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Typography sx={labelStyle}>Estimated Total Rooms:</Typography>
            <input
              type="number"
              style={{ ...inputStyle, width: '80px' }}
              value={wizardData.estimatedRooms ?? ''}
              onChange={handleRoomsChange}
            />
>>>>>>> origin/feature/property-wizard
          </Box>
        </Grid>

<<<<<<< HEAD
        {/* Right Column: The Expanded Form */}
        <Grid item xs={12} md={8} lg={8.5}>
          <Paper 
            elevation={0} 
            sx={{ 
              borderRadius: 4, 
              border: '1px solid', 
              borderColor: 'divider',
              boxShadow: '0px 16px 48px rgba(0, 0, 0, 0.04)',
              overflow: 'hidden',
              backgroundColor: 'background.paper'
            }}
          >
            {/* Section 1: Capacity & Layout */}
            <Box sx={{ p: { xs: 3, sm: 5 } }}>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 4, color: 'text.primary' }}>
                Capacity & Layout
              </Typography>
              <Grid container spacing={3.5}>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Number of Floors"
                    variant="outlined"
                    value={wizardData.floors || 1}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <IconButton onClick={() => handleFloorsChange(-1)} edge="start" size="small" color="primary">
                            <RemoveIcon />
                          </IconButton>
                        </InputAdornment>
                      ),
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton onClick={() => handleFloorsChange(1)} edge="end" size="small" color="primary">
                            <AddIcon />
                          </IconButton>
                        </InputAdornment>
                      ),
                      inputProps: { 
                        style: { textAlign: 'center', fontWeight: 700, fontSize: '1.1rem' },
                        readOnly: true
                      }
                    }}
                  />
                </Grid>

                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    type="number"
                    label="Estimated Total Rooms"
                    placeholder="e.g., 24"
                    value={wizardData.estimatedRooms || ''}
                    onChange={(e) => updateWizardData({ estimatedRooms: Number(e.target.value) || '' })}
                    variant="outlined"
                    InputProps={{
                      startAdornment: <InputAdornment position="start"><MeetingRoomIcon color="primary" /></InputAdornment>,
                    }}
                  />
                </Grid>
              </Grid>
            </Box>

            <Divider />
=======
        {/* Amenities Offered */}
        <Box sx={{ display: 'flex', gap: 3, alignItems: 'flex-start' }}>
          <Box sx={{ width: '130px', textAlign: 'right', pt: 0.5 }}>
            <Typography sx={labelStyle}>Amenities Offered:</Typography>
          </Box>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            {AMENITIES_LIST.map((amenity) => {
              const checked = Array.isArray(wizardData.amenities) && wizardData.amenities.includes(amenity);
              return (
                <FormControlLabel
                  key={amenity}
                  control={
                    <Checkbox
                      checked={checked}
                      onChange={() => handleAmenityToggle(amenity)}
                      size="small"
                      sx={{
                        p: 0.5,
                        '&.Mui-checked': { color: '#444' }
                      }}
                    />
                  }
                  label={<Typography sx={{ fontSize: '0.875rem', color: '#333' }}>{amenity}</Typography>}
                  sx={{ ml: -0.5, mb: 0 }}
                />
              );
            })}
          </Box>
        </Box>

        {/* Curfew Policy Card Toggle */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box sx={{ width: '130px', textAlign: 'right' }}>
            <Typography sx={labelStyle}>Curfew Policy Card:</Typography>
          </Box>
          <FormControlLabel
            control={
              <Switch
                checked={Boolean(wizardData.curfewEnabled)}
                onChange={(e) => updateWizardData({ curfewEnabled: e.target.checked })}
                color="default"
                size="small"
              />
            }
            label={<Typography sx={{ fontSize: '0.875rem', color: '#333' }}>Enable Curfew</Typography>}
            sx={{ ml: 0 }}
          />
        </Box>

        {/* Curfew Start Time Input */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box sx={{ width: '130px', textAlign: 'right' }}>
            <Typography sx={labelStyle}>Curfew Start Time:</Typography>
          </Box>
          <input
            type="text"
            placeholder="e.g., 10:00 PM"
            style={{ ...inputStyle, width: '160px' }}
            value={wizardData.curfewTime || ''}
            onChange={handleChange('curfewTime')}
          />
        </Box>
>>>>>>> origin/feature/property-wizard

            {/* Section 2: Amenities */}
            <Box sx={{ p: { xs: 3, sm: 5 }, backgroundColor: 'action.hover' }}>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 1, color: 'text.primary' }}>
                Property Amenities
              </Typography>
              <Typography variant="body2" sx={{ color: 'text.secondary', mb: 3 }}>
                Select the facilities available to your tenants.
              </Typography>
              
              <FormGroup>
                <Grid container spacing={2}>
                  {amenitiesList.map((amenity) => (
                    <Grid item xs={12} sm={6} md={4} key={amenity}>
                      <Paper 
                        elevation={0}
                        sx={{ 
                          border: '1px solid',
                          borderColor: (wizardData.amenities || []).includes(amenity) ? 'primary.main' : 'divider',
                          backgroundColor: (wizardData.amenities || []).includes(amenity) ? 'primary.lighter' : 'background.paper',
                          borderRadius: 2,
                          px: 2,
                          py: 1,
                          transition: 'all 0.2s'
                        }}
                      >
                        <FormControlLabel
                          sx={{ m: 0, width: '100%' }}
                          control={
                            <Checkbox
                              checked={(wizardData.amenities || []).includes(amenity)}
                              onChange={() => handleAmenityToggle(amenity)}
                              color="primary"
                              sx={{ py: 0.5, pl: 0 }}
                            />
                          }
                          label={<Typography sx={{ fontWeight: 600, fontSize: '0.9rem' }}>{amenity}</Typography>}
                        />
                      </Paper>
                    </Grid>
                  ))}
                </Grid>
              </FormGroup>
            </Box>

            <Divider />

            {/* Section 3: Security & Policies */}
            <Box sx={{ p: { xs: 3, sm: 5 } }}>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 4, color: 'text.primary' }}>
                Security & Policies
              </Typography>
              
              <Paper 
                elevation={0}
                sx={{ 
                  p: 3, 
                  border: '1px solid', 
                  borderColor: wizardData.curfewEnabled ? 'primary.main' : 'divider',
                  borderRadius: 3,
                  backgroundColor: wizardData.curfewEnabled ? 'primary.lighter' : 'transparent',
                  transition: 'all 0.3s ease'
                }}
              >
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3} alignItems={{ xs: 'flex-start', sm: 'center' }} justifyContent="space-between">
                  
                  {/* Curfew Toggle */}
                  <Stack direction="row" spacing={2} alignItems="center">
                    <Box sx={{ 
                      backgroundColor: wizardData.curfewEnabled ? 'primary.main' : 'action.selected', 
                      p: 1.5, 
                      borderRadius: 2,
                      display: 'flex',
                      color: wizardData.curfewEnabled ? 'white' : 'text.secondary'
                    }}>
                      <SecurityIcon />
                    </Box>
                    <Box>
                      <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                        Enforce Curfew
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Require tenants to be logged in by a specific time
                      </Typography>
                    </Box>
                  </Stack>

                  <Switch
                    checked={wizardData.curfewEnabled || false}
                    onChange={(e) => updateWizardData({ curfewEnabled: e.target.checked })}
                    color="primary"
                    sx={{ transform: 'scale(1.1)' }}
                  />
                </Stack>

                {/* Conditional Time Input */}
                {wizardData.curfewEnabled && (
                  <Box sx={{ mt: 3, pt: 3, borderTop: '1px dashed', borderColor: 'primary.light' }}>
                    <Grid container alignItems="center">
                      <Grid item xs={12} sm={6}>
                        <TextField
                          fullWidth
                          type="time"
                          label="Curfew Start Time"
                          value={wizardData.curfewTime || ''}
                          onChange={(e) => updateWizardData({ curfewTime: e.target.value })}
                          variant="outlined"
                          InputLabelProps={{ shrink: true }}
                          InputProps={{
                            startAdornment: <InputAdornment position="start"><NightlightRoundIcon color="primary" /></InputAdornment>,
                          }}
                        />
                      </Grid>
                    </Grid>
                  </Box>
                )}
              </Paper>

            </Box>

          </Paper>
        </Grid>

      </Grid>
    </Box>
  );
};

export default Step2Policies;