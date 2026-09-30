import React, { useState, useEffect } from 'react';
import { Box, Typography, TextField, MenuItem, Button, IconButton, InputAdornment } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import CloudUploadIcon from '@mui/icons-material/CloudUploadOutlined';
import LocationOnOutlinedIcon from '@mui/icons-material/LocationOnOutlined';
import PhoneOutlinedIcon from '@mui/icons-material/PhoneOutlined';
import {
  regions,
  provinces,
  cities,
  barangays
} from 'select-philippines-address';

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

const RequiredMark = () => (
  <Box component="span" sx={{ color: 'primary.main', ml: 0.4 }}>*</Box>
);

export default function Step1Basics({ wizardData = {}, updateWizardData, errors = {} }) {
  const [regionList, setRegionList] = useState([]);
  const [provinceList, setProvinceList] = useState([]);
  const [cityList, setCityList] = useState([]);
  const [barangayList, setBarangayList] = useState([]);

  // Load Regions on Initial Mount
  useEffect(() => {
    regions()
      .then((res) => setRegionList(res || []))
      .catch((err) => console.error("Region fetch timeout:", err));
  }, []);

  // Reload child address lists when stepping back or restoring wizard data
  useEffect(() => {
    if (wizardData.regionCode) {
      provinces(wizardData.regionCode)
        .then((res) => setProvinceList(res || []))
        .catch((err) => console.error("Province fetch timeout:", err));
    } else {
      setProvinceList([]);
    }

    if (wizardData.provinceCode) {
      cities(wizardData.provinceCode)
        .then((res) => setCityList(res || []))
        .catch((err) => console.error("City fetch timeout:", err));
    } else {
      setCityList([]);
    }

    if (wizardData.cityCode) {
      barangays(wizardData.cityCode)
        .then((res) => setBarangayList(res || []))
        .catch((err) => console.error("Barangay fetch timeout:", err));
    } else {
      setBarangayList([]);
    }
  }, [wizardData.regionCode, wizardData.provinceCode, wizardData.cityCode]);

  // Handle Region Selection
  const handleRegionChange = (e) => {
    const regionCode = String(e.target.value);
    const selectedRegionObj = regionList.find((r) => String(r.region_code) === regionCode);

    updateWizardData({
      region: selectedRegionObj?.region_name || '',
      regionCode,
      province: '',
      provinceCode: '',
      cityMunicipality: '',
      cityCode: '',
      barangay: ''
    });
  };

  // Handle Province Selection
  const handleProvinceChange = (e) => {
    const provinceCode = String(e.target.value);
    const selectedProvObj = provinceList.find((p) => String(p.province_code) === provinceCode);

    updateWizardData({
      province: selectedProvObj?.province_name || '',
      provinceCode,
      cityMunicipality: '',
      cityCode: '',
      barangay: ''
    });
  };

  // Handle City / Municipality Selection
  const handleCityChange = (e) => {
    const cityCode = String(e.target.value);
    const selectedCityObj = cityList.find((c) => String(c.city_code) === cityCode);

    updateWizardData({
      cityMunicipality: selectedCityObj?.city_name || '',
      cityCode,
      barangay: ''
    });
  };

  // Handle Barangay Selection
  const handleBarangayChange = (e) => {
    updateWizardData({ barangay: e.target.value });
  };

  const handleChange = (field) => (e) => {
    updateWizardData({ [field]: e.target.value });
  };

  // Dedicated Emergency Contact Phone Handler (Numeric Only)
  const handleEmergencyPhoneChange = (e) => {
    const numericValue = e.target.value.replace(/[^0-9]/g, '');
    updateWizardData({ emergencyPhone: numericValue });
  };

  // Cover Photo Upload Handler (Converts File to Base64 String for Safe Firestore Storage)
  const handlePhotoUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result;
        updateWizardData({
          coverPhotoName: file.name,
          coverPhotoPreview: base64String,
          coverPhotoUrl: base64String, // Safe Base64 string that writes cleanly to Firestore
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemovePhoto = () => {
    updateWizardData({
      coverPhotoName: '',
      coverPhotoPreview: '',
      coverPhotoUrl: '',
    });
  };

  // Shared error/helperText plumbing for every field
  const fieldProps = (field) => ({
    error: Boolean(errors?.[field]),
    helperText: errors?.[field] || '',
  });

  return (
    <Box sx={{ width: '100%', maxWidth: 700, mx: 'auto', px: { xs: 1, sm: 2 } }}>
      <Box sx={{ mb: 4 }}>
        <Typography
          variant="h5"
          sx={{ fontFamily: '"Inter", sans-serif', fontWeight: 600 }}
          color="text.primary"
        >
          Tell us about your property
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          Basic details to identify your building in reports and tenant views.
        </Typography>
      </Box>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>

        {/* Property Name */}
        <Box sx={rowSx}>
          <Box sx={labelColSx}>
            <Typography sx={labelColStyle}>
              Property name<RequiredMark />
            </Typography>
          </Box>
          <Box sx={fieldColSx}>
            <TextField
              fullWidth
              placeholder="e.g. Casa Bonifacio Dormitory"
              value={wizardData.propertyName || ''}
              onChange={handleChange('propertyName')}
              {...fieldProps('propertyName')}
            />
          </Box>
        </Box>

        {/* Property Type */}
        <Box sx={rowSx}>
          <Box sx={labelColSx}>
            <Typography sx={labelColStyle}>
              Property type<RequiredMark />
            </Typography>
          </Box>
          <Box sx={fieldColSx}>
            <TextField
              select
              fullWidth
              value={wizardData.propertyType || ''}
              onChange={handleChange('propertyType')}
              {...fieldProps('propertyType')}
            >
              <MenuItem value="Dormitory">Dormitory</MenuItem>
              <MenuItem value="Apartment">Apartment</MenuItem>
              <MenuItem value="Boarding House">Boarding house</MenuItem>
            </TextField>
          </Box>
        </Box>

        {/* Cascading Address Details */}
        <Box sx={{ ...rowSx, alignItems: { xs: 'stretch', sm: 'flex-start' } }}>
          <Box sx={{ ...labelColSx, pt: { sm: 1.75 } }}>
            <Typography sx={labelColStyle}>
              Address details<RequiredMark />
            </Typography>
          </Box>
          <Box sx={fieldColSx}>
            <Box
              sx={{
                borderLeft: '3px solid',
                borderColor: 'primary.main',
                bgcolor: 'rgba(202, 220, 246, 0.18)',
                borderRadius: '0 4px 4px 0',
                p: { xs: 1.5, sm: 2 },
              }}
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mb: 1.5 }}>
                <LocationOnOutlinedIcon sx={{ fontSize: 18, color: 'primary.main' }} />
                <Typography variant="body2" color="text.secondary" fontWeight={600}>
                  Where is this property located?
                </Typography>
              </Box>

              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.75 }}>
                <TextField
                  select
                  fullWidth
                  label="Region"
                  value={wizardData.regionCode || ''}
                  onChange={handleRegionChange}
                  {...fieldProps('regionCode')}
                >
                  {regionList.map((r) => (
                    <MenuItem key={r.region_code} value={r.region_code}>
                      {r.region_name}
                    </MenuItem>
                  ))}
                </TextField>

                <TextField
                  select
                  fullWidth
                  label="Province"
                  value={wizardData.provinceCode || ''}
                  onChange={handleProvinceChange}
                  disabled={!wizardData.regionCode}
                  {...fieldProps('provinceCode')}
                >
                  {provinceList.map((p) => (
                    <MenuItem key={p.province_code} value={p.province_code}>
                      {p.province_name}
                    </MenuItem>
                  ))}
                </TextField>

                <TextField
                  select
                  fullWidth
                  label="City / Municipality"
                  value={wizardData.cityCode || ''}
                  onChange={handleCityChange}
                  disabled={!wizardData.provinceCode}
                  {...fieldProps('cityCode')}
                >
                  {cityList.map((c) => (
                    <MenuItem key={c.city_code} value={c.city_code}>
                      {c.city_name}
                    </MenuItem>
                  ))}
                </TextField>

                <TextField
                  select
                  fullWidth
                  label="Barangay"
                  value={wizardData.barangay || ''}
                  onChange={handleBarangayChange}
                  disabled={!wizardData.cityCode}
                  {...fieldProps('barangay')}
                >
                  {barangayList.map((b) => (
                    <MenuItem key={b.brgy_code} value={b.brgy_name}>
                      {b.brgy_name}
                    </MenuItem>
                  ))}
                </TextField>

                <TextField
                  fullWidth
                  placeholder="House/bldg no., street, subdivision"
                  value={wizardData.street || ''}
                  onChange={handleChange('street')}
                  {...fieldProps('street')}
                />
              </Box>
            </Box>
          </Box>
        </Box>

        {/* Emergency Contact Phone (Numbers Only) */}
        <Box sx={rowSx}>
          <Box sx={labelColSx}>
            <Typography sx={labelColStyle}>
              Emergency contact / desk phone<RequiredMark />
            </Typography>
          </Box>
          <Box sx={fieldColSx}>
            <TextField
              fullWidth
              placeholder="e.g. 09171234567"
              value={wizardData.emergencyPhone || ''}
              onChange={handleEmergencyPhoneChange}
              inputProps={{ maxLength: 15 }}
              slotProps={{
                input: {
                  startAdornment: (
                    <InputAdornment position="start">
                      <PhoneOutlinedIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                    </InputAdornment>
                  ),
                },
              }}
              {...fieldProps('emergencyPhone')}
            />
          </Box>
        </Box>

        {/* Property Cover Photo */}
        <Box sx={rowSx}>
          <Box sx={labelColSx}>
            <Typography sx={labelColStyle}>Property cover photo</Typography>
          </Box>
          <Box sx={fieldColSx}>
            {wizardData.coverPhotoPreview || wizardData.coverPhotoUrl ? (
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1.5,
                  bgcolor: 'background.paper',
                  borderRadius: '4px',
                  border: '1px solid',
                  borderColor: 'divider',
                  p: 1,
                }}
              >
                <Box
                  component="img"
                  src={wizardData.coverPhotoPreview || wizardData.coverPhotoUrl}
                  alt="Property cover preview"
                  sx={{ width: 56, height: 56, borderRadius: '4px', objectFit: 'cover', flexShrink: 0 }}
                />
                <Typography variant="body2" color="text.primary" sx={{ flex: 1, wordBreak: 'break-word' }}>
                  {wizardData.coverPhotoName || 'Cover Photo Loaded'}
                </Typography>
                <IconButton
                  size="small"
                  onClick={handleRemovePhoto}
                  aria-label="Remove cover photo"
                  sx={{
                    flexShrink: 0,
                    '&:hover': { bgcolor: 'rgba(255, 69, 0, 0.08)', color: 'primary.main' },
                  }}
                >
                  <CloseIcon fontSize="small" />
                </IconButton>
              </Box>
            ) : (
              <Box>
                <Button
                  component="label"
                  variant="outlined"
                  startIcon={<CloudUploadIcon />}
                  sx={{
                    color: 'text.primary',
                    borderColor: 'divider',
                    borderStyle: 'dashed',
                    borderWidth: '1.5px',
                    bgcolor: 'background.paper',
                    py: 1.5,
                    width: '100%',
                    justifyContent: 'flex-start',
                    '&:hover': {
                      borderColor: 'primary.main',
                      bgcolor: 'background.paper',
                    },
                  }}
                >
                  Upload photo
                  <input type="file" hidden accept="image/*" onChange={handlePhotoUpload} />
                </Button>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.75 }}>
                  Optional — this is what tenants see first when browsing your listing.
                </Typography>
              </Box>
            )}
          </Box>
        </Box>

      </Box>
    </Box>
  );
}