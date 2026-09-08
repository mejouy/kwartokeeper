import React, { useState, useEffect } from 'react';
import { Box, Typography, Select, MenuItem, Button, FormHelperText } from '@mui/material';
import {
  regions,
  provinces,
  cities,
  barangays
} from 'select-philippines-address';

const labelStyle = {
  fontSize: '0.875rem',
  color: '#333',
  fontWeight: 500,
  textAlign: { xs: 'left', sm: 'right' },
  whiteSpace: 'nowrap'
};

const inputStyle = (hasError) => ({
  backgroundColor: '#D9D9D9',
  border: hasError ? '1px solid #d32f2f' : 'none',
  outline: 'none',
  padding: '10px 12px',
  fontSize: '0.875rem',
  borderRadius: '2px',
  width: '100%',
  boxSizing: 'border-box',
  display: 'block'
});

const selectStyle = (hasError) => ({
  backgroundColor: '#D9D9D9',
  borderRadius: '2px',
  height: 38,
  px: 1.5,
  width: '100%',
  boxSizing: 'border-box',
  fontSize: '0.875rem',
  border: hasError ? '1px solid #d32f2f' : 'none',
  '& .MuiSelect-select': { py: 1, fontSize: '0.875rem' }
});

export default function Step1Basics({ wizardData = {}, updateWizardData, errors = {} }) {
  const [regionList, setRegionList] = useState([]);
  const [provinceList, setProvinceList] = useState([]);
  const [cityList, setCityList] = useState([]);
  const [barangayList, setBarangayList] = useState([]);

  // Load Regions on Initial Mount
  useEffect(() => {
    regions().then((res) => setRegionList(res || []));
  }, []);

  // Reload child address lists when stepping back or restoring wizard data
  useEffect(() => {
    if (wizardData.regionCode) {
      provinces(wizardData.regionCode).then((res) => setProvinceList(res || []));
    }
    if (wizardData.provinceCode) {
      cities(wizardData.provinceCode).then((res) => setCityList(res || []));
    }
    if (wizardData.cityCode) {
      barangays(wizardData.cityCode).then((res) => setBarangayList(res || []));
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

    setProvinceList([]);
    setCityList([]);
    setBarangayList([]);

    provinces(regionCode).then((res) => setProvinceList(res || []));
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

    setCityList([]);
    setBarangayList([]);

    cities(provinceCode).then((res) => setCityList(res || []));
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

    setBarangayList([]);

    barangays(cityCode).then((res) => setBarangayList(res || []));
  };

  // Handle Barangay Selection
  const handleBarangayChange = (e) => {
    updateWizardData({ barangay: e.target.value });
  };

  const handleChange = (field) => (e) => {
    updateWizardData({ [field]: e.target.value });
  };

  const handlePhotoUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      updateWizardData({ 
        coverPhoto: file,
        coverPhotoName: file.name,
        coverPhotoPreview: URL.createObjectURL(file)
      });
    }
  };

  const handleRemovePhoto = () => {
    updateWizardData({ 
      coverPhoto: null,
      coverPhotoName: '',
      coverPhotoPreview: ''
    });
  };

  return (
    <Box sx={{ width: '100%', maxWidth: 700, mx: 'auto', px: { xs: 1, sm: 2 } }}>
      {/* Header Info */}
      <Box sx={{ mb: 4, textAlign: 'center' }}>
        <Typography variant="caption" sx={{ color: '#888', display: 'block', mb: 0.5 }}>
          Step 1 of 3
        </Typography>
        <Typography variant="subtitle1" fontWeight="bold" sx={{ color: '#111', lineHeight: 1.2 }}>
          Tell us about your property
        </Typography>
        <Typography variant="body2" sx={{ color: '#666', mt: 0.5 }}>
          Basic details to identify your building in reports and tenant views.
        </Typography>
      </Box>

      {/* Form Grid with Strict Column Ratios */}
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
        
        {/* Property Name */}
        <Box sx={{ 
          display: 'flex', 
          flexDirection: { xs: 'column', sm: 'row' }, 
          alignItems: { xs: 'stretch', sm: 'center' }, 
          gap: { xs: 0.8, sm: 3 } 
        }}>
          <Box sx={{ width: { xs: '100%', sm: '38%' }, flexShrink: 0, textAlign: { sm: 'right' } }}>
            <Typography sx={labelStyle}>Property Name:</Typography>
          </Box>
          <Box sx={{ width: { xs: '100%', sm: '62%' } }}>
            <input
              type="text"
              style={inputStyle}
              value={wizardData.propertyName}
              onChange={handleChange('propertyName')}
            />
          </Box>
        </Box>

        {/* Property Type */}
        <Box sx={{ 
          display: 'flex', 
          flexDirection: { xs: 'column', sm: 'row' }, 
          alignItems: { xs: 'stretch', sm: 'center' }, 
          gap: { xs: 0.8, sm: 3 } 
        }}>
          <Box sx={{ width: { xs: '100%', sm: '38%' }, flexShrink: 0, textAlign: { sm: 'right' } }}>
            <Typography sx={labelStyle}>Property Type:</Typography>
          </Box>
          <Box sx={{ width: { xs: '100%', sm: '62%' } }}>
            <Select
              value={wizardData.propertyType}
              onChange={handleChange('propertyType')}
              displayEmpty
              variant="standard"
              disableUnderline
              sx={{
                backgroundColor: '#D9D9D9',
                borderRadius: '2px',
                height: 38,
                px: 1.5,
                width: '100%',
                boxSizing: 'border-box',
                '& .MuiSelect-select': { py: 1, fontSize: '0.875rem' }
              }}
            >
              <MenuItem value="Dormitory">Dormitory</MenuItem>
              <MenuItem value="Apartment">Apartment</MenuItem>
              <MenuItem value="Boarding House">Boarding House</MenuItem>
            </Select>
          </Box>
        </Box>

        {/* Address Details */}
        <Box sx={{ 
          display: 'flex', 
          flexDirection: { xs: 'column', sm: 'row' }, 
          alignItems: { xs: 'stretch', sm: 'flex-start' }, 
          gap: { xs: 0.8, sm: 3 } 
        }}>
          <Box sx={{ width: { xs: '100%', sm: '38%' }, flexShrink: 0, textAlign: { sm: 'right' }, pt: { sm: 1 } }}>
            <Typography sx={labelStyle}>Address Details:</Typography>
          </Box>
          <Box sx={{ width: { xs: '100%', sm: '62%' }, display: 'flex', flexDirection: 'column', gap: 1 }}>
            <input
              type="text"
              placeholder="Street Address / Subdivision"
              style={{ ...inputStyle, color: '#333' }}
              value={wizardData.streetAddress}
              onChange={handleChange('streetAddress')}
            />
            <input
              type="text"
              placeholder="Barangay & City/Municipality"
              style={{ ...inputStyle, color: '#333' }}
              value={wizardData.cityBarangay}
              onChange={handleChange('cityBarangay')}
            />
          </Box>
        </Box>

        {/* Emergency Contact */}
        <Box sx={{ 
          display: 'flex', 
          flexDirection: { xs: 'column', sm: 'row' }, 
          alignItems: { xs: 'stretch', sm: 'center' }, 
          gap: { xs: 0.8, sm: 3 } 
        }}>
          <Box sx={{ width: { xs: '100%', sm: '38%' }, flexShrink: 0, textAlign: { sm: 'right' } }}>
            <Typography sx={labelStyle}>Emergency Contact / Desk Phone:</Typography>
          </Box>
          <Box sx={{ width: { xs: '100%', sm: '62%' } }}>
            <input
              type="text"
              style={inputStyle}
              value={wizardData.emergencyPhone}
              onChange={handleChange('emergencyPhone')}
            />
          </Box>
        </Box>

        {/* Property Cover Photo */}
        <Box sx={{ 
          display: 'flex', 
          flexDirection: { xs: 'column', sm: 'row' }, 
          alignItems: { xs: 'stretch', sm: 'center' }, 
          gap: { xs: 0.8, sm: 3 } 
        }}>
          <Box sx={{ width: { xs: '100%', sm: '38%' }, flexShrink: 0, textAlign: { sm: 'right' } }}>
            <Typography sx={labelStyle}>Property Cover Photo:</Typography>
          </Box>
          <Box sx={{ width: { xs: '100%', sm: '62%' }, display: 'flex', alignItems: 'center', gap: 1 }}>
            <Button
              component="label"
              sx={{
                backgroundColor: '#D9D9D9',
                color: '#333',
                textTransform: 'none',
                boxShadow: 'none',
                px: 3,
                py: 0.8,
                fontSize: '0.85rem',
                borderRadius: '2px',
                width: { xs: '100%', sm: 'auto' },
                '&:hover': { backgroundColor: '#cccccc', boxShadow: 'none' }
              }}
            >
              Upload Photo
              <input type="file" hidden accept="image/*" onChange={handlePhotoUpload} />
            </Button>
            {wizardData.coverPhoto && (
              <Typography variant="caption" sx={{ color: '#2e7d32', fontWeight: 500 }}>
                Photo Selected
              </Typography>
            )}
          </Box>
        </Box>

      </Box>
    </Box>
  );
}