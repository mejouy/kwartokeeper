import React from 'react';
import {Box,Typography,Switch,Checkbox,FormControlLabel,FormGroup} from '@mui/material';

const labelStyle = {
  fontSize: '0.9rem',
  color: '#333',
  fontWeight: 500,
  textAlign: 'right',
  whiteSpace: 'nowrap'
};

const amenitiesList = [
  'Wi-Fi',
  'Air Conditioning',
  'CCTV',
  'Shared Kitchen'
];

export const Step2Policies = ({ wizardData, updateWizardData }) => {
  const handleFloorsChange = (delta) => {
    const newFloors = Math.max(1, wizardData.floors + delta);
    updateWizardData({ floors: newFloors });
  };

  const handleAmenityToggle = (amenity) => {
    const current = wizardData.amenities;
    const updated = current.includes(amenity)
      ? current.filter((a) => a !== amenity)
      : [...current, amenity];
    updateWizardData({ amenities: updated });
  };

  return (
    <Box sx={{ width: '100%', maxWidth: 700, mx: 'auto', px: 2 }}>
      {/* Header Info */}
      <Box sx={{ mb: 4 }}>
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

      {/* Form Fields */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>

        {/* Floors & Total Rooms Row */}
        <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 3 }}>
          {/* Number of Floors */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Typography sx={labelStyle}>Number of Floors:</Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography
                onClick={() => handleFloorsChange(-1)}
                sx={{ cursor: 'pointer', fontSize: '1.2rem', fontWeight: 'bold', userSelect: 'none', px: 0.5 }}
              >
                ━
              </Typography>
              <Box
                sx={{
                  backgroundColor: '#D9D9D9',
                  width: 80,
                  height: 32,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '0.875rem',
                  borderRadius: '2px'
                }}
              >
                {wizardData.floors}
              </Box>
              <Typography
                onClick={() => handleFloorsChange(1)}
                sx={{ cursor: 'pointer', fontSize: '1.2rem', fontWeight: 'bold', userSelect: 'none', px: 0.5 }}
              >
                +
              </Typography>
            </Box>
          </Box>

          {/* Estimated Total Rooms */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, ml: 'auto' }}>
            <Typography sx={labelStyle}>Estimated Total Rooms:</Typography>
            <input
              type="number"
              style={{
                backgroundColor: '#D9D9D9',
                border: 'none',
                outline: 'none',
                width: 70,
                height: 32,
                textAlign: 'center',
                borderRadius: '2px',
                fontSize: '0.875rem'
              }}
              value={wizardData.estimatedRooms}
              onChange={(e) => updateWizardData({ estimatedRooms: Number(e.target.value) || '' })}
            />
          </Box>
        </Box>

        {/* Amenities Offered */}
        <Box sx={{ display: 'grid', gridTemplateColumns: '200px 1fr', alignItems: 'start', gap: 2 }}>
          <Typography sx={{ ...labelStyle, pt: 0.5 }}>Amenities Offered:</Typography>
          <FormGroup sx={{ gap: 0.5 }}>
            {amenitiesList.map((amenity) => (
              <FormControlLabel
                key={amenity}
                control={
                  <Checkbox
                    checked={wizardData.amenities.includes(amenity)}
                    onChange={() => handleAmenityToggle(amenity)}
                    size="small"
                    sx={{
                      p: 0.5,
                      color: '#bbb',
                      '&.Mui-checked': { color: '#555' }
                    }}
                  />
                }
                label={<Typography sx={{ fontSize: '0.875rem', color: '#333' }}>{amenity}</Typography>}
              />
            ))}
          </FormGroup>
        </Box>

        {/* Curfew Policy Card Toggle */}
        <Box sx={{ display: 'grid', gridTemplateColumns: '200px 1fr', alignItems: 'center', gap: 2 }}>
          <Typography sx={labelStyle}>Curfew Policy Card:</Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Switch
              checked={wizardData.curfewEnabled}
              onChange={(e) => updateWizardData({ curfewEnabled: e.target.checked })}
              sx={{
                '& .MuiSwitch-switchBase.Mui-checked': { color: '#000' },
                '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': { backgroundColor: '#000' }
              }}
            />
            <Typography sx={{ fontSize: '0.875rem', color: '#333' }}>
              Enable Curfew
            </Typography>
          </Box>
        </Box>

        {/* Curfew Start Time */}
        <Box sx={{ display: 'grid', gridTemplateColumns: '200px 1fr', alignItems: 'center', gap: 2 }}>
          <Typography sx={labelStyle}>Curfew Start Time:</Typography>
          <input
            type="text"
            placeholder="e.g., 10:00 PM"
            style={{
              backgroundColor: '#D9D9D9',
              border: 'none',
              outline: 'none',
              padding: '8px 12px',
              fontSize: '0.875rem',
              borderRadius: '2px',
              width: '180px',
              color: '#555'
            }}
            value={wizardData.curfewTime}
            onChange={(e) => updateWizardData({ curfewTime: e.target.value })}
          />
        </Box>

      </Box>
    </Box>
  );
};