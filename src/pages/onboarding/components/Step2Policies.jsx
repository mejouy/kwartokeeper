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
          </Box>
        </Box>

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

      </Box>
    </Box>
  );
};

export default Step2Policies;