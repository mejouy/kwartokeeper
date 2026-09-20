import React from 'react';
import {
  Box,
  Typography,
  TextField,
  MenuItem,
  Button,
  Grid,
  Paper,
  Stack,
  Avatar,
  InputAdornment,
  Divider,
  LinearProgress
} from '@mui/material';
import HomeWorkIcon from '@mui/icons-material/HomeWork';
import CategoryIcon from '@mui/icons-material/Category';
import PhoneIcon from '@mui/icons-material/Phone';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import DeleteIcon from '@mui/icons-material/Delete';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';

export const Step1Basics = ({ wizardData = {}, updateWizardData }) => {
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
    <Box sx={{ width: '100%', maxWidth: 1440, mx: 'auto', px: { xs: 2, sm: 4, lg: 6 }, py: { xs: 3, md: 5 } }}>
      <Grid container spacing={{ xs: 4, lg: 8 }}>
        
        {/* Left Column: Context, Progress & Instructions */}
        <Grid item xs={12} md={4} lg={3.5}>
          <Box sx={{ position: 'sticky', top: 32 }}>
            
            {/* MUI Progress Indicator */}
            <Box sx={{ mb: 4 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
                <Typography variant="overline" sx={{ fontWeight: 800, color: 'primary.main', letterSpacing: 1.2 }}>
                  Step 1 of 3
                </Typography>
                <Typography variant="caption" sx={{ fontWeight: 700, color: 'text.secondary' }}>
                  33%
                </Typography>
              </Stack>
              <LinearProgress 
                variant="determinate" 
                value={33} 
                sx={{ 
                  height: 8, 
                  borderRadius: 4, 
                  backgroundColor: 'action.hover',
                  '& .MuiLinearProgress-bar': { borderRadius: 4 }
                }} 
              />
            </Box>

            <Typography variant="h4" sx={{ fontWeight: 800, color: 'text.primary', mb: 2, fontSize: { xs: '1.75rem', md: '2.25rem' }, letterSpacing: '-0.02em' }}>
              Property Profile
            </Typography>
            <Typography variant="body1" sx={{ color: 'text.secondary', mb: 4, lineHeight: 1.7, fontSize: '1.05rem' }}>
              Set up the core identity of your building. This information will be visible to your tenants in their portal and used for your administrative reporting.
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
                <AdminPanelSettingsIcon sx={{ mt: 0.5, opacity: 0.9 }} />
                <Box>
                  <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5, letterSpacing: 0.5 }}>
                    OWNER REGISTRATION
                  </Typography>
                  <Typography variant="body2" sx={{ opacity: 0.85, lineHeight: 1.6 }}>
                    As the property owner, you are creating the master profile. Tenant accounts will be linked to this property later.
                  </Typography>
                </Box>
              </Stack>
            </Paper>
          </Box>
        </Grid>

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
            {/* Section 1: Basic Details */}
            <Box sx={{ p: { xs: 3, sm: 5 } }}>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 4, color: 'text.primary' }}>
                General Information
              </Typography>
              <Grid container spacing={3.5}>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Property Name"
                    placeholder="e.g., KwartoKeeper Dormitories"
                    value={wizardData.propertyName || ''}
                    onChange={handleChange('propertyName')}
                    variant="outlined"
                    required
                    InputProps={{
                      startAdornment: <InputAdornment position="start"><HomeWorkIcon color="primary" /></InputAdornment>,
                    }}
                  />
                </Grid>

                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    select
                    label="Property Type"
                    value={wizardData.propertyType || 'Dormitory'}
                    onChange={handleChange('propertyType')}
                    variant="outlined"
                    InputProps={{
                      startAdornment: <InputAdornment position="start"><CategoryIcon color="primary" /></InputAdornment>,
                    }}
                  >
                    <MenuItem value="Dormitory">Dormitory</MenuItem>
                    <MenuItem value="Apartment">Apartment</MenuItem>
                    <MenuItem value="Boarding House">Boarding House</MenuItem>
                    <MenuItem value="Transient / Commercial">Transient / Commercial</MenuItem>
                  </TextField>
                </Grid>

                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Desk / Emergency Phone"
                    placeholder="e.g., 0917 123 4567"
                    value={wizardData.emergencyPhone || ''}
                    onChange={handleChange('emergencyPhone')}
                    variant="outlined"
                    InputProps={{
                      startAdornment: <InputAdornment position="start"><PhoneIcon color="primary" /></InputAdornment>,
                    }}
                  />
                </Grid>
              </Grid>
            </Box>

            <Divider />

            {/* Section 2: Location (Stretched Layout) */}
            <Box sx={{ p: { xs: 3, sm: 5 }, backgroundColor: 'action.hover' }}>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 4, color: 'text.primary' }}>
                Location Details
              </Typography>
              <Grid container spacing={3.5}>
                {/* Street address gets 7 columns to stretch, Barangay gets 5 */}
                <Grid item xs={12} md={7}>
                  <TextField
                    fullWidth
                    label="Street Address / Subdivision"
                    placeholder="e.g., 123 Mabini St., College Heights"
                    value={wizardData.streetAddress || ''}
                    onChange={handleChange('streetAddress')}
                    variant="outlined"
                    required
                    sx={{ backgroundColor: 'background.paper', borderRadius: 1 }}
                    InputProps={{
                      startAdornment: <InputAdornment position="start"><LocationOnIcon color="primary" /></InputAdornment>,
                    }}
                  />
                </Grid>

                <Grid item xs={12} md={5}>
                  <TextField
                    fullWidth
                    label="Barangay & City / Municipality"
                    placeholder="e.g., Brgy. Don Mariano Perez, Bayombong"
                    value={wizardData.cityBarangay || ''}
                    onChange={handleChange('cityBarangay')}
                    variant="outlined"
                    required
                    sx={{ backgroundColor: 'background.paper', borderRadius: 1 }}
                    InputProps={{
                      startAdornment: <InputAdornment position="start"><LocationOnIcon color="primary" /></InputAdornment>,
                    }}
                  />
                </Grid>
              </Grid>
            </Box>

            <Divider />

            {/* Section 3: Media */}
            <Box sx={{ p: { xs: 3, sm: 5 } }}>
              <Typography variant="h6" sx={{ fontWeight: 700, mb: 1, color: 'text.primary' }}>
                Property Visuals
              </Typography>
              <Typography variant="body1" sx={{ color: 'text.secondary', mb: 4 }}>
                Upload a high-resolution cover photo to make your property easily recognizable in the system.
              </Typography>

              <Paper
                variant="outlined"
                sx={{
                  p: { xs: 4, sm: 6 },
                  borderStyle: wizardData.coverPhotoPreview ? 'solid' : 'dashed',
                  borderWidth: 2,
                  borderColor: wizardData.coverPhotoPreview ? 'primary.main' : 'divider',
                  borderRadius: 3,
                  backgroundColor: wizardData.coverPhotoPreview ? 'primary.lighter' : 'background.default',
                  textAlign: 'center',
                  transition: 'all 0.2s ease-in-out',
                  '&:hover': {
                    borderColor: 'primary.main',
                    backgroundColor: wizardData.coverPhotoPreview ? 'primary.lighter' : 'action.hover'
                  }
                }}
              >
                {wizardData.coverPhotoPreview ? (
                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={3} alignItems="center" justifyContent="space-between">
                    <Stack direction="row" spacing={3} alignItems="center">
                      <Avatar
                        src={wizardData.coverPhotoPreview}
                        alt="Cover Preview"
                        variant="rounded"
                        sx={{ width: 88, height: 88, boxShadow: 2 }}
                      />
                      <Box sx={{ textAlign: 'left' }}>
                        <Stack direction="row" alignItems="center" spacing={1} mb={0.5}>
                          <CheckCircleIcon color="success" fontSize="small" />
                          <Typography variant="h6" sx={{ fontWeight: 700 }}>
                            {wizardData.coverPhotoName}
                          </Typography>
                        </Stack>
                        <Typography variant="body2" color="text.secondary">
                          Image ready for upload
                        </Typography>
                      </Box>
                    </Stack>
                    <Button
                      variant="outlined"
                      color="error"
                      size="large"
                      startIcon={<DeleteIcon />}
                      onClick={handleRemovePhoto}
                      sx={{ textTransform: 'none', fontWeight: 700, borderRadius: 2 }}
                    >
                      Remove
                    </Button>
                  </Stack>
                ) : (
                  <Box>
                    <CloudUploadIcon sx={{ fontSize: 56, color: 'primary.main', mb: 2 }} />
                    <Typography variant="h6" sx={{ fontWeight: 700, color: 'text.primary', mb: 1 }}>
                      Click to upload property cover photo
                    </Typography>
                    <Typography variant="body1" sx={{ color: 'text.secondary', display: 'block', mb: 3 }}>
                      Recommended format: JPG or PNG, maximum 5MB
                    </Typography>
                    <Button
                      component="label"
                      variant="contained"
                      size="large"
                      sx={{ 
                        px: 5, 
                        py: 1.5, 
                        fontWeight: 700, 
                        textTransform: 'none', 
                        borderRadius: 2, 
                        boxShadow: '0 4px 14px rgba(0,0,0,0.1)' 
                      }}
                    >
                      Browse Files
                      <input type="file" hidden accept="image/*" onChange={handlePhotoUpload} />
                    </Button>
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