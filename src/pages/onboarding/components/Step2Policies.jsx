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
  FormHelperText,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import WifiIcon from '@mui/icons-material/Wifi';
import AcUnitIcon from '@mui/icons-material/AcUnit';
import VideocamOutlinedIcon from '@mui/icons-material/VideocamOutlined';
import SoupKitchenOutlinedIcon from '@mui/icons-material/SoupKitchenOutlined';
import SecurityIcon from '@mui/icons-material/Security';
import NightlightRoundIcon from '@mui/icons-material/NightlightRound';

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

export const Step2Policies = ({ wizardData = {}, updateWizardData, errors = {} }) => {
  // Floor counter handlers (persisted directly to wizardData)
  const handleFloorChange = (delta) => {
    const current = Number(wizardData.totalFloors) || 1;
    const nextVal = Math.max(1, current + delta);
    updateWizardData({ totalFloors: nextVal });
  };

  // Estimated rooms handler
  const handleRoomsChange = (e) => {
    const rawVal = e.target.value;
    if (rawVal === '') {
      updateWizardData({ estimatedRooms: '' });
      return;
    }
    const val = parseInt(rawVal, 10);
    updateWizardData({ estimatedRooms: isNaN(val) ? '' : Math.max(0, val) });
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

  // Toggle Curfew with '10:00 PM' as default
  const handleCurfewToggle = (e) => {
    const checked = e.target.checked;
    updateWizardData({
      curfewEnabled: checked,
      curfewTime: checked ? (wizardData.curfewTime || '10:00 PM') : wizardData.curfewTime,
    });
  };

  const selectedAmenities = Array.isArray(wizardData.amenities) ? wizardData.amenities : [];
  const curfewEnabled = Boolean(wizardData.curfewEnabled);

  return (
    <Box sx={{ width: '100%', maxWidth: 700, mx: 'auto', px: { xs: 1, sm: 2 } }}>
      {/* Header */}
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
            <Box sx={{ display: 'inline-flex', flexDirection: 'column' }}>
              <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1 }}>
                <IconButton
                  size="small"
                  onClick={() => handleFloorChange(-1)}
                  aria-label="Decrease floors"
                  sx={{
                    border: '1px solid',
                    borderColor: errors.totalFloors ? 'error.main' : 'divider',
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
                    border: '1px solid',
                    borderColor: errors.totalFloors ? 'error.main' : 'divider',
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
                    borderColor: errors.totalFloors ? 'error.main' : 'divider',
                    borderRadius: '4px',
                    color: 'text.primary',
                    '&:hover': { borderColor: 'primary.main', color: 'primary.main' },
                  }}
                >
                  <AddIcon fontSize="small" />
                </IconButton>
              </Box>

              {errors.totalFloors && (
                <FormHelperText error sx={{ mt: 0.5, ml: 0 }}>
                  {errors.totalFloors}
                </FormHelperText>
              )}
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
              inputProps={{ min: 0 }}
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
                borderColor: errors.curfewTime
                  ? 'error.main'
                  : curfewEnabled
                  ? 'primary.main'
                  : 'divider',
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
                  onChange={handleCurfewToggle}
                  color="primary"
                />
              </Box>

              {curfewEnabled && (
                <Box sx={{ mt: 2, pt: 2, borderTop: '1px dashed', borderColor: 'primary.main' }}>
                  <TextField
                    fullWidth
                    label="Curfew time or rule"
                    placeholder="e.g. 10:00 PM"
                    value={wizardData.curfewTime ?? ''}
                    onChange={(e) => updateWizardData({ curfewTime: e.target.value })}
                    error={Boolean(errors.curfewTime)}
                    helperText={errors.curfewTime}
                    InputProps={{
                      startAdornment: (
                        <InputAdornment position="start">
                          <NightlightRoundIcon sx={{ fontSize: 18, color: 'primary.main' }} />
                        </InputAdornment>
                      ),
                    }}
                    sx={{ maxWidth: 300 }}
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