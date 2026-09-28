import React from 'react';
import {
  Box,
  Typography,
  Switch,
  Checkbox,
  TextField,
  IconButton,
  Paper,
  InputAdornment,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import WifiIcon from '@mui/icons-material/Wifi';
import AcUnitIcon from '@mui/icons-material/AcUnit';
import VideocamOutlinedIcon from '@mui/icons-material/VideocamOutlined';
import SoupKitchenOutlinedIcon from '@mui/icons-material/SoupKitchenOutlined';
import SecurityIcon from '@mui/icons-material/Security';
import NightlightRoundIcon from '@mui/icons-material/NightlightRound';

// Helper to convert "10:00 PM" or non-standard strings into valid "HH:mm" (24-hour) format
const formatTo24Hour = (timeStr) => {
  if (!timeStr) return '22:00';

  // Already valid 24-hour format "HH:mm"
  if (/^([01]\d|2[0-3]):[0-5]\d$/.test(timeStr)) {
    return timeStr;
  }

  // Parses 12-hour format like "10:00 PM", "9:30 AM", "10:00PM"
  const match = String(timeStr).match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (match) {
    let [_, hoursStr, minutes, modifier] = match;
    let hours = parseInt(hoursStr, 10);
    if (modifier) {
      const isPM = modifier.toUpperCase() === 'PM';
      if (isPM && hours < 12) hours += 12;
      if (!isPM && hours === 12) hours = 0;
    }
    return `${String(hours).padStart(2, '0')}:${minutes}`;
  }

  return '22:00';
};

// Shared with Step1 — keep both files visually identical if you tweak one.
const labelColStyle = {
  fontSize: '0.875rem',
  color: 'text.secondary',
  fontWeight: 600,
  textAlign: { xs: 'left', sm: 'right' },
};

const rowSx = {
  display: 'flex',
  flexDirection: { xs: 'column', sm: 'row' },
  alignItems: { xs: 'stretch', sm: 'center' },
  gap: { xs: 0.8, sm: 3 },
};

const labelColSx = { width: { xs: '100%', sm: '34%' }, flexShrink: 0, textAlign: { sm: 'right' } };
const fieldColSx = { width: { xs: '100%', sm: '66%' } };

const AMENITIES_LIST = [
  { key: 'Wi-Fi', icon: WifiIcon },
  { key: 'Air Conditioning', icon: AcUnitIcon },
  { key: 'CCTV', icon: VideocamOutlinedIcon },
  { key: 'Shared Kitchen', icon: SoupKitchenOutlinedIcon },
];

export const Step2Policies = ({ wizardData = {}, updateWizardData }) => {
  // Floor counter handlers
  const handleFloorChange = (delta) => {
    const current = Number(wizardData.totalFloors) || 1;
    const nextVal = Math.max(1, current + delta);
    updateWizardData({ totalFloors: nextVal });
  };

  // Estimated rooms handler (prevents NaN)
  const handleRoomsChange = (e) => {
    const val = parseInt(e.target.value, 10);
    updateWizardData({ estimatedRooms: isNaN(val) ? '' : val });
  };

  // Amenities checkbox handler
  const handleAmenityToggle = (amenity) => {
    const currentList = Array.isArray(wizardData.amenities) ? wizardData.amenities : [];
    if (currentList.includes(amenity)) {
      updateWizardData({ amenities: currentList.filter((a) => a !== amenity) });
    } else {
      updateWizardData({ amenities: [...currentList, amenity] });
    }
  };

  const selectedAmenities = Array.isArray(wizardData.amenities) ? wizardData.amenities : [];
  const curfewEnabled = Boolean(wizardData.curfewEnabled);

  return (
    <Box sx={{ width: '100%', maxWidth: 700, mx: 'auto', px: { xs: 1, sm: 2 } }}>
      {/* Header — matches Step1's treatment */}
      <Box sx={{ mb: 4 }}>
        <Typography
          variant="h5"
          sx={{ fontFamily: '"Inter", sans-serif', fontWeight: 600 }}
          color="text.primary"
        >
          Building structure &amp; rules
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          Define your building scale and standard house rules.
        </Typography>
      </Box>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>

        {/* Number of Floors */}
        <Box sx={rowSx}>
          <Box sx={labelColSx}>
            <Typography sx={labelColStyle}>Number of floors</Typography>
          </Box>
          <Box sx={fieldColSx}>
            <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1 }}>
              <IconButton
                size="small"
                onClick={() => handleFloorChange(-1)}
                aria-label="Decrease floors"
                sx={{
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: '4px',
                  color: 'text.primary',
                  '&:hover': { borderColor: 'primary.main', color: 'primary.main' },
                }}
              >
                <RemoveIcon fontSize="small" />
              </IconButton>

              <Typography
                sx={{
                  minWidth: 44,
                  textAlign: 'center',
                  fontWeight: 700,
                  fontSize: '1rem',
                  bgcolor: 'background.paper',
                  borderRadius: '4px',
                  py: 0.75,
                }}
              >
                {Number(wizardData.totalFloors) || 1}
              </Typography>

              <IconButton
                size="small"
                onClick={() => handleFloorChange(1)}
                aria-label="Increase floors"
                sx={{
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: '4px',
                  color: 'text.primary',
                  '&:hover': { borderColor: 'primary.main', color: 'primary.main' },
                }}
              >
                <AddIcon fontSize="small" />
              </IconButton>
            </Box>
          </Box>
        </Box>

        {/* Estimated Total Rooms */}
        <Box sx={rowSx}>
          <Box sx={labelColSx}>
            <Typography sx={labelColStyle}>Estimated total rooms</Typography>
          </Box>
          <Box sx={fieldColSx}>
            <TextField
              type="number"
              placeholder="e.g. 24"
              value={wizardData.estimatedRooms ?? ''}
              onChange={handleRoomsChange}
              sx={{ maxWidth: 160 }}
              slotProps={{ htmlInput: { min: 0 } }}
            />
          </Box>
        </Box>

        {/* Amenities Offered */}
        <Box sx={{ ...rowSx, alignItems: { xs: 'stretch', sm: 'flex-start' } }}>
          <Box sx={{ ...labelColSx, pt: { sm: 1 } }}>
            <Typography sx={labelColStyle}>Amenities offered</Typography>
          </Box>
          <Box sx={fieldColSx}>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
                gap: 1.25,
              }}
            >
              {AMENITIES_LIST.map(({ key, icon: Icon }) => {
                const checked = selectedAmenities.includes(key);
                return (
                  <Paper
                    key={key}
                    elevation={0}
                    onClick={() => handleAmenityToggle(key)}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                      px: 1.5,
                      py: 1,
                      cursor: 'pointer',
                      border: '1px solid',
                      borderColor: checked ? 'primary.main' : 'divider',
                      bgcolor: checked ? 'rgba(255, 69, 0, 0.06)' : 'background.paper',
                      borderRadius: '4px',
                      transition: 'border-color 0.15s ease, background-color 0.15s ease',
                    }}
                  >
                    <Checkbox
                      checked={checked}
                      onChange={() => handleAmenityToggle(key)}
                      onClick={(e) => e.stopPropagation()}
                      size="small"
                      sx={{ p: 0.5, '&.Mui-checked': { color: 'primary.main' } }}
                    />
                    <Icon sx={{ fontSize: 18, color: checked ? 'primary.main' : 'text.secondary' }} />
                    <Typography sx={{ fontSize: '0.875rem', color: 'text.primary' }}>
                      {key}
                    </Typography>
                  </Paper>
                );
              })}
            </Box>
          </Box>
        </Box>

        {/* Curfew Policy */}
        <Box sx={{ ...rowSx, alignItems: { xs: 'stretch', sm: 'flex-start' } }}>
          <Box sx={{ ...labelColSx, pt: { sm: 1.75 } }}>
            <Typography sx={labelColStyle}>Curfew policy</Typography>
          </Box>
          <Box sx={fieldColSx}>
            <Paper
              elevation={0}
              sx={{
                border: '1px solid',
                borderColor: curfewEnabled ? 'primary.main' : 'divider',
                bgcolor: curfewEnabled ? 'rgba(255, 69, 0, 0.06)' : 'background.paper',
                borderRadius: '4px',
                p: 2,
                transition: 'border-color 0.2s ease, background-color 0.2s ease',
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Box
                    sx={{
                      width: 36,
                      height: 36,
                      borderRadius: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      bgcolor: curfewEnabled ? 'primary.main' : 'action.selected',
                      color: curfewEnabled ? '#fff' : 'text.secondary',
                      flexShrink: 0,
                    }}
                  >
                    <SecurityIcon fontSize="small" />
                  </Box>
                  <Box>
                    <Typography sx={{ fontWeight: 600, fontSize: '0.9rem', color: 'text.primary' }}>
                      Enforce curfew
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Tenants must be logged in by a set time
                    </Typography>
                  </Box>
                </Box>

                <Switch
                  checked={curfewEnabled}
                  onChange={(e) => updateWizardData({ curfewEnabled: e.target.checked })}
                  color="primary"
                />
              </Box>

              {curfewEnabled && (
                <Box sx={{ mt: 2, pt: 2, borderTop: '1px dashed', borderColor: 'primary.main' }}>
                  <TextField
                    fullWidth
                    type="time"
                    label="Curfew start time"
                    value={formatTo24Hour(wizardData.curfewTime)}
                    onChange={(e) => updateWizardData({ curfewTime: e.target.value })}
                    slotProps={{
                      inputLabel: { shrink: true },
                      input: {
                        startAdornment: (
                          <InputAdornment position="start">
                            <NightlightRoundIcon sx={{ fontSize: 18, color: 'primary.main' }} />
                          </InputAdornment>
                        ),
                      },
                    }}
                    sx={{ maxWidth: 260 }}
                  />
                </Box>
              )}
            </Paper>
          </Box>
        </Box>

      </Box>
    </Box>
  );
};

export default Step2Policies;