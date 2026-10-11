import React, { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Button, Typography, Alert, IconButton } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined';
import RuleOutlinedIcon from '@mui/icons-material/RuleOutlined';
import GridViewOutlinedIcon from '@mui/icons-material/GridViewOutlined';

import Step1Basics from './components/Step1Basics';
import Step2Rules from './components/Step2Policies';
import Step3Rooms from './components/Step3Rooms';

const STEPS = ['Basic Details', 'Rules & Amenities', 'Rooms & Layout'];
const STEP_ICONS = [HomeOutlinedIcon, RuleOutlinedIcon, GridViewOutlinedIcon];

const FACADE_ROWS = 5;
const FACADE_COLS = 5;
const LIT_PATTERN = [
  1, 0, 0, 1, 0,
  0, 0, 1, 0, 0,
  1, 0, 0, 0, 1,
  0, 1, 0, 0, 0,
  0, 0, 1, 0, 1,
];

function DormFacade() {
  const windows = useMemo(() => {
    const w = [];
    const gap = 16;
    const size = 30;
    for (let row = 0; row < FACADE_ROWS; row++) {
      for (let col = 0; col < FACADE_COLS; col++) {
        const idx = row * FACADE_COLS + col;
        w.push({ x: col * (size + gap), y: row * (size + gap), lit: LIT_PATTERN[idx] === 1, size });
      }
    }
    return w;
  }, []);

  const width = FACADE_COLS * (30 + 16) - 16;
  const height = FACADE_ROWS * (30 + 16) - 16;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      style={{ maxWidth: 220, display: 'block' }}
      role="img"
      aria-label="Illustration of a dormitory building at night, with illuminated windows"
    >
      {windows.map((win, i) => (
        <rect
          key={i}
          x={win.x}
          y={win.y}
          width={win.size}
          height={win.size}
          rx={4}
          fill={win.lit ? '#ff4500' : 'rgba(202, 220, 246, 0.16)'}
          opacity={win.lit ? 0.92 : 1}
        />
      ))}
    </svg>
  );
}

function StepList({ activeStep }) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column' }}>
      {STEPS.map((label, i) => {
        const IconComponent = STEP_ICONS[i];
        const isActive = i === activeStep;
        const isDone = i < activeStep;
        const isFilled = isActive || isDone;
        return (
          <Box key={label} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <Box
                sx={{
                  width: 34,
                  height: 34,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  bgcolor: isFilled ? 'primary.main' : 'rgba(202, 220, 246, 0.16)',
                  color: isFilled ? '#ffffff' : '#cadcf6',
                  transition: 'background-color 0.2s ease, color 0.2s ease',
                }}
              >
                <IconComponent sx={{ fontSize: 18 }} />
              </Box>
              {i < STEPS.length - 1 && (
                <Box
                  sx={{
                    width: '2px',
                    flex: 1,
                    minHeight: 28,
                    bgcolor: isDone ? 'primary.main' : 'rgba(202, 220, 246, 0.16)',
                    my: 0.5,
                    transition: 'background-color 0.2s ease',
                  }}
                />
              )}
            </Box>
            <Typography
              variant="body2"
              sx={{
                pt: 0.9,
                pb: i < STEPS.length - 1 ? 3.5 : 0,
                fontWeight: isActive ? 700 : 400,
                color: isActive ? '#ffffff' : '#cadcf6',
              }}
            >
              {label}
            </Typography>
          </Box>
        );
      })}
    </Box>
  );
}

export default function PropertyWizard() {
  const navigate = useNavigate();
  const [activeStep, setActiveStep] = useState(0);
  const [errors, setErrors] = useState({});

  const [wizardData, setWizardData] = useState({
    propertyName: '',
    propertyType: 'Dormitory',
    street: '',
    barangay: '',
    cityMunicipality: '',
    province: '',
    region: '',
    regionCode: '',
    provinceCode: '',
    cityCode: '',
    emergencyPhone: '',
    coverPhoto: null,
    coverPhotoUrl: '',
    coverPhotoPreview: '',
    coverPhotoName: '',
    totalFloors: 1,
    amenities: [],
    curfewEnabled: false,
    curfewTime: '10:00 PM',
    estimatedRooms: '',
    namingPattern: 'floor',
  });

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [activeStep]);

  // Nothing is saved until the last step, so warn before a refresh or closed tab wipes the form
  const hasWork = Boolean(wizardData.propertyName.trim() || wizardData.street.trim() || wizardData.emergencyPhone.trim());
  useEffect(() => {
    if (!hasWork) return undefined;
    const warn = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [hasWork]);

  const leave = () => {
    if (hasWork && !window.confirm('Leave property setup? What you entered will be lost.')) return;
    navigate('/owner', { replace: true });
  };

  const updateWizardData = (newData) => {
    setWizardData((prev) => {
      const updated = { ...prev, ...newData };
      if (newData.totalFloors !== undefined) {
        updated.totalFloors = Math.max(1, Number(newData.totalFloors) || 1);
      }
      return updated;
    });

    const updatedFields = Object.keys(newData);
    setErrors((prevErrors) => {
      const newErrors = { ...prevErrors };
      updatedFields.forEach((field) => delete newErrors[field]);
      return newErrors;
    });
  };

  const validateStep1 = () => {
    const newErrors = {};
    if (!wizardData.propertyName?.trim()) newErrors.propertyName = 'Property Name is required.';
    if (!wizardData.propertyType) newErrors.propertyType = 'Property Type is required.';
    if (!wizardData.street?.trim()) newErrors.street = 'Street address is required.';
    if (!wizardData.regionCode) newErrors.regionCode = 'Please select a region.';
    if (!wizardData.provinceCode) newErrors.provinceCode = 'Please select a province.';
    if (!wizardData.cityCode) newErrors.cityCode = 'Please select a city/municipality.';
    if (!wizardData.barangay) newErrors.barangay = 'Please select a barangay.';
    const phoneDigits = String(wizardData.emergencyPhone || '').replace(/\D/g, '');
    if (!wizardData.emergencyPhone?.trim()) newErrors.emergencyPhone = 'Emergency phone is required.';
    else if (phoneDigits.length < 7 || phoneDigits.length > 13) newErrors.emergencyPhone = 'Enter a valid phone number.';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateStep2 = () => {
    const newErrors = {};
    const floorsNum = Number(wizardData.totalFloors);
    if (!floorsNum || floorsNum < 1) {
      newErrors.totalFloors = 'Total floors must be at least 1.';
    }
    const estimatedRooms = Number(wizardData.estimatedRooms);
    if (!Number.isInteger(estimatedRooms) || estimatedRooms < 1) {
      newErrors.estimatedRooms = 'Enter an estimated total of at least 1 room.';
    }
    if (wizardData.curfewEnabled && !wizardData.curfewTime) {
      newErrors.curfewTime = 'Please specify a curfew time when curfew is enabled.';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    const ok = activeStep === 0 ? validateStep1() : activeStep === 1 ? validateStep2() : true;
    if (!ok) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    setActiveStep((prev) => Math.min(prev + 1, STEPS.length - 1));
  };

  const handleBack = () => {
    if (activeStep === 0) {
      leave();
      return;
    }
    setErrors({});
    setActiveStep((prev) => Math.max(prev - 1, 0));
  };

  return (
    <Box sx={{ minHeight: '100dvh', display: 'flex', flexDirection: { xs: 'column', md: 'row' } }}>
      {/* Sidebar */}
      <Box
        sx={{
          flex: { xs: '0 0 auto', md: '0 0 300px' },
          bgcolor: '#202020',
          color: '#ffffff',
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          px: { xs: 3, md: 4 },
          py: { xs: 3, md: 5 },
          position: { md: 'sticky' },
          top: { md: 0 },
          height: { md: '100vh' },
          alignSelf: { md: 'flex-start' },
          overflowY: { md: 'auto' },
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Box component="img" src="/KwartoKeeper-DarkMode-Icon.png" alt="KwartoKeeper" sx={{ height: 28 }} />
          <Typography sx={{ fontFamily: '"Inter", sans-serif', fontWeight: 700, fontSize: '1rem', flex: 1 }}>
            Property setup
          </Typography>
          <IconButton aria-label="Leave property setup" onClick={leave} size="small" sx={{ color: '#cadcf6', display: { md: 'none' } }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>

        {/* Mobile Step Indicator */}
        <Box sx={{ display: { xs: 'block', md: 'none' } }}>
          <Typography variant="body2" sx={{ color: '#cadcf6', mb: 1 }}>
            Step {activeStep + 1} of {STEPS.length} — {STEPS[activeStep]}
          </Typography>
          <Box sx={{ display: 'flex', gap: 0.75 }}>
            {STEPS.map((label, i) => (
              <Box
                key={label}
                sx={{
                  flex: 1,
                  height: 4,
                  borderRadius: 2,
                  bgcolor: i <= activeStep ? 'primary.main' : 'rgba(202, 220, 246, 0.2)',
                  transition: 'background-color 0.2s ease',
                }}
              />
            ))}
          </Box>
        </Box>

        {/* Desktop Step Indicator */}
        <Box sx={{ display: { xs: 'none', md: 'block' } }}>
          <StepList activeStep={activeStep} />
        </Box>

        <Box sx={{ display: { xs: 'none', md: 'block' }, mt: 'auto' }}>
          <DormFacade />
        </Box>
      </Box>

      {/* Main Content Area */}
      <Box sx={{ flex: 1, minWidth: 0, bgcolor: 'background.default', display: 'flex', justifyContent: 'center', px: { xs: 3, md: 6 }, pt: { xs: 4, md: 6 }, pb: 0 }}>
        <Box sx={{ width: '100%', maxWidth: 760, display: 'flex', flexDirection: 'column' }}>
          {activeStep < 2 && Object.keys(errors).length > 0 && (
            <Alert severity="error" sx={{ mb: 3 }}>
              Please fix the highlighted fields.
            </Alert>
          )}
          <Box sx={{ mb: 4, flex: 1 }}>
            {activeStep === 0 && (
              <Step1Basics
                wizardData={wizardData}
                updateWizardData={updateWizardData}
                errors={errors}
              />
            )}

            {activeStep === 1 && (
              <Step2Rules
                wizardData={wizardData}
                updateWizardData={updateWizardData}
                errors={errors}
              />
            )}

            {activeStep === 2 && (
              <Step3Rooms
                wizardData={wizardData}
                updateWizardData={updateWizardData}
                onBack={handleBack}
              />
            )}
          </Box>

          {activeStep < 2 && (
            <Box
              sx={{
                position: 'sticky',
                bottom: 0,
                zIndex: 2,
                bgcolor: 'background.default',
                display: 'flex',
                justifyContent: 'space-between',
                gap: 2,
                pt: 2,
                pb: 'calc(16px + env(safe-area-inset-bottom, 0px))',
                borderTop: '1px solid',
                borderColor: 'divider',
              }}
            >
              <Button
                variant="outlined"
                onClick={handleBack}
                sx={{ py: 1.5, px: 3, fontWeight: 600 }}
              >
                Back
              </Button>
              <Button
                variant="contained"
                onClick={handleNext}
                sx={{
                  py: 1.5,
                  px: 3,
                  fontWeight: 600,
                  bgcolor: 'primary.main',
                  '&:hover': { bgcolor: 'primary.dark' },
                }}
              >
                Next step
              </Button>
            </Box>
          )}
        </Box>
      </Box>
    </Box>
  );
}