import React, { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Button, Typography, Alert } from '@mui/material';
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined';
import RuleOutlinedIcon from '@mui/icons-material/RuleOutlined';
import GridViewOutlinedIcon from '@mui/icons-material/GridViewOutlined';

import { auth, db } from '../../config/firebase';
import { collection, addDoc, doc, updateDoc, serverTimestamp } from 'firebase/firestore';

import { uploadPropertyPhoto } from '../services/propertyService';
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

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
    namingPattern: 'floor',
  });

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [activeStep]);

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
    if (!wizardData.emergencyPhone?.trim()) newErrors.emergencyPhone = 'Emergency phone is required.';

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
    setSubmitError('');
    if (activeStep === 0) {
      if (!validateStep1()) return;
    } else if (activeStep === 1) {
      if (!validateStep2()) return;
    }

    setActiveStep((prev) => Math.min(prev + 1, STEPS.length - 1));
  };

  const handleBack = () => {
    if (activeStep === 0) {
      navigate('/owner/dashboard', { replace: true });
      return;
    }
    setErrors({});
    setSubmitError('');
    setActiveStep((prev) => Math.max(prev - 1, 0));
  };

  const submitPropertyToFirebase = async (roomsData = [], layoutMetrics = {}) => {
    setIsSubmitting(true);
    setSubmitError('');

    if (!wizardData.street?.trim() || !wizardData.propertyName?.trim()) {
      setSubmitError('Validation Error: Basic details are incomplete. Please review Step 1.');
      setIsSubmitting(false);
      return;
    }

    try {
      const currentUser = auth?.currentUser;
      if (!currentUser) {
        throw new Error('Authentication error: No property owner is currently logged in.');
      }

      // Extract photo string from base64 string or file preview
      const fallbackPhotoString =
        (typeof wizardData.coverPhotoUrl === 'string' && wizardData.coverPhotoUrl) ||
        (typeof wizardData.coverPhotoPreview === 'string' && wizardData.coverPhotoPreview) ||
        (typeof wizardData.coverPhoto === 'string' && wizardData.coverPhoto) ||
        '';

      let finalPhotoUrl = fallbackPhotoString;
      let photoUploadWarning = null;

      if (wizardData.coverPhoto instanceof File) {
        try {
          const uploadedPhoto = await uploadPropertyPhoto(
            wizardData.coverPhoto,
            currentUser.uid
          );
          finalPhotoUrl = uploadedPhoto.downloadUrl;
        } catch (uploadError) {
          console.error('Firebase Storage cover photo upload failed:', uploadError);
          throw new Error(
            `The cover photo could not be saved. ${uploadError.message || 'Please try another image.'}`
          );
        }
      }

      const normalizedPhotoUrl = finalPhotoUrl || null;

      const finalPropertyData = {
        ownerUid: currentUser.uid,
        createdBy: currentUser.uid,
        userId: currentUser.uid,

        street: wizardData.street || '',
        barangay: wizardData.barangay || '',
        cityMunicipality: wizardData.cityMunicipality || '',
        province: wizardData.province || '',
        region: wizardData.region || '',
        regionCode: wizardData.regionCode || '',
        provinceCode: wizardData.provinceCode || '',
        cityCode: wizardData.cityCode || '',

        propertyName: wizardData.propertyName || '',
        propertyType: wizardData.propertyType || '',
        emergencyPhone: wizardData.emergencyPhone || '',

        // Multi-field mapping to support any dashboard UI schema
        coverPhotoUrl: normalizedPhotoUrl,
        coverPhoto: normalizedPhotoUrl,
        imageUrl: normalizedPhotoUrl,
        photoUrl: normalizedPhotoUrl,

        totalFloors: Number(wizardData.totalFloors) || 1,
        amenities: wizardData.amenities || [],
        curfewEnabled: Boolean(wizardData.curfewEnabled),
        curfewTime: wizardData.curfewEnabled ? (wizardData.curfewTime || '') : '',

        namingPattern: wizardData.namingPattern || 'floor',
        configMode: wizardData.configMode || 'uniform',
        rooms: roomsData,
        totalRooms: Number(layoutMetrics.totalRooms) || roomsData.length,
        totalBeds: Number(layoutMetrics.totalBeds) || 0,

        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      const docRef = await addDoc(collection(db, 'properties'), finalPropertyData);

      // Update owner's profile document to set hasProperty flag
      try {
        const userRef = doc(db, 'users', currentUser.uid);
        await updateDoc(userRef, { hasProperty: true });
      } catch (userErr) {
        console.warn('Could not update user hasProperty flag:', userErr);
      }

      navigate('/wizard-success', {
        state: {
          propertyId: docRef.id,
          propertyName: finalPropertyData.propertyName,
          totalRooms: finalPropertyData.totalRooms,
          totalBeds: finalPropertyData.totalBeds,
          warning: photoUploadWarning,
        },
      });

    } catch (error) {
      console.error('Error saving property:', error);
      setSubmitError(error.message || 'An error occurred while saving the property.');
      setIsSubmitting(false);
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: { xs: 'column', md: 'row' } }}>
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
          <Typography sx={{ fontFamily: '"Inter", sans-serif', fontWeight: 700, fontSize: '1rem' }}>
            Property setup
          </Typography>
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
      <Box sx={{ flex: 1, bgcolor: 'background.default', display: 'flex', justifyContent: 'center', px: { xs: 3, md: 6 }, py: { xs: 4, md: 6 } }}>
        <Box sx={{ width: '100%', maxWidth: 760 }}>
          {submitError && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {submitError}
            </Alert>
          )}

          <Box sx={{ mb: 4 }}>
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
                onSubmit={submitPropertyToFirebase}
                isSubmitting={isSubmitting}
              />
            )}
          </Box>

          {activeStep < 2 && (
            <Box sx={{ display: 'flex', justifyContent: 'space-between', pt: 3, borderTop: '1px solid', borderColor: 'divider' }}>
              <Button
                variant="outlined"
                onClick={handleBack}
                disabled={isSubmitting}
                sx={{ py: 1.5, px: 3, fontWeight: 600 }}
              >
                Back
              </Button>
              <Button
                variant="contained"
                onClick={handleNext}
                disabled={isSubmitting}
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