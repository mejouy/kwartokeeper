<<<<<<< HEAD
import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Button, Typography, Alert, CircularProgress } from '@mui/material';
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined';
import RuleOutlinedIcon from '@mui/icons-material/RuleOutlined';
import GridViewOutlinedIcon from '@mui/icons-material/GridViewOutlined';

import { auth, db, storage } from '../../config/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
=======
import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Box, Button, Stepper, Step, StepLabel, Paper } from "@mui/material";
>>>>>>> origin/feature/admin

import Step1Basics from "./components/Step1Basics";
import Step2Rules from "./components/Step2Policies";
import Step3Rooms from "./components/Step3Rooms";

<<<<<<< HEAD
const STEPS = ['Basic Details', 'Rules & Amenities', 'Rooms & Layout'];
const STEP_ICONS = [HomeOutlinedIcon, RuleOutlinedIcon, GridViewOutlinedIcon];

// Night-facade building graphic with deterministic window lighting pattern
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

// Vertical progress navigation sidebar
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
=======
const STEPS = ["Basic Details", "Rules & Amenities", "Rooms & Layout"];
>>>>>>> origin/feature/admin

export default function PropertyWizard() {
  const navigate = useNavigate();
  const [activeStep, setActiveStep] = useState(0);
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const [wizardData, setWizardData] = useState({
<<<<<<< HEAD
    propertyName: '',
    propertyType: 'Dormitory',
    streetAddress: '',
    barangay: '',
    cityMunicipality: '',
    province: '',
    region: '',
    regionCode: '',
    provinceCode: '',
    cityCode: '',
    emergencyPhone: '',
=======
    propertyName: "",
    propertyType: "Dormitory",
    street: "",
    barangay: "",
    cityMunicipality: "",
    province: "",
    region: "",
    regionCode: "",
    provinceCode: "",
    cityCode: "",
    emergencyPhone: "",
>>>>>>> origin/feature/admin
    coverPhoto: null,
    totalFloors: 1,
    amenities: [],
    curfewEnabled: false,
<<<<<<< HEAD
    curfewTime: '22:00',
    namingPattern: 'floor',
    configMode: 'uniform',
=======
    curfewTime: "10:00 PM",
    namingPattern: "floor",
    configMode: "uniform",
>>>>>>> origin/feature/admin
  });

  const updateWizardData = (newData) => {
    setWizardData((prev) => ({
      ...prev,
      ...newData,
    }));

<<<<<<< HEAD
=======
    // Clear error highlights for fields as the user edits them
>>>>>>> origin/feature/admin
    const updatedFields = Object.keys(newData);
    setErrors((prevErrors) => {
      const newErrors = { ...prevErrors };
      updatedFields.forEach((field) => delete newErrors[field]);
      return newErrors;
    });
  };

  const validateStep1 = () => {
    const newErrors = {};
<<<<<<< HEAD
    if (!wizardData.propertyName?.trim()) newErrors.propertyName = 'Property Name is required.';
    if (!wizardData.propertyType) newErrors.propertyType = 'Property Type is required.';
    if (!wizardData.streetAddress?.trim()) newErrors.streetAddress = 'Street address is required.';
    if (!wizardData.regionCode) newErrors.regionCode = 'Please select a region.';
    if (!wizardData.provinceCode) newErrors.provinceCode = 'Please select a province.';
    if (!wizardData.cityCode) newErrors.cityCode = 'Please select a city/municipality.';
    if (!wizardData.barangay) newErrors.barangay = 'Please select a barangay.';
    if (!wizardData.emergencyPhone?.trim()) newErrors.emergencyPhone = 'Emergency phone is required.';
=======
    if (!wizardData.propertyName?.trim())
      newErrors.propertyName = "Property Name is required.";
    if (!wizardData.propertyType)
      newErrors.propertyType = "Property Type is required.";
    if (!wizardData.street?.trim())
      newErrors.street = "Street address is required.";
    if (!wizardData.regionCode)
      newErrors.regionCode = "Please select a region.";
    if (!wizardData.provinceCode)
      newErrors.provinceCode = "Please select a province.";
    if (!wizardData.cityCode)
      newErrors.cityCode = "Please select a city/municipality.";
    if (!wizardData.barangay)
      newErrors.barangay = "Please select a barangay.";
    if (!wizardData.emergencyPhone?.trim())
      newErrors.emergencyPhone = "Emergency phone is required.";
>>>>>>> origin/feature/admin

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateStep2 = () => {
    const newErrors = {};
    if (!wizardData.totalFloors || wizardData.totalFloors < 1) {
      newErrors.totalFloors = "Total floors must be at least 1.";
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
<<<<<<< HEAD
      if (!validateStep1()) return;
    } else if (activeStep === 1) {
      if (!validateStep2()) return;
=======
      const isStep1Valid = validateStep1();
      if (!isStep1Valid) return;
    } else if (activeStep === 1) {
      const isStep2Valid = validateStep2();
      if (!isStep2Valid) return;
>>>>>>> origin/feature/admin
    }

    setActiveStep((prev) => Math.min(prev + 1, STEPS.length - 1));
  };

  const handleBack = () => {
    if (activeStep === 0) {
      navigate("/owner/dashboard", { replace: true });
      return;
    }

    setErrors({});
    setSubmitError('');
    if (activeStep === 0) {
      // Navigate to previous page or dashboard instead of forcing login page
      navigate(-1);
      return;
    }
    setActiveStep((prev) => Math.max(prev - 1, 0));
  };

  // Handles image upload and database saving; receives room configurations from Step 3
  const submitPropertyToFirebase = async (roomsData = [], layoutMetrics = {}) => {
    setIsSubmitting(true);
    setSubmitError('');

    if (!wizardData.streetAddress?.trim() || !wizardData.propertyName?.trim()) {
      setSubmitError('Validation Error: Basic details are incomplete. Please review Step 1.');
      setIsSubmitting(false);
      return;
    }

    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error('Authentication error: No property owner is currently logged in.');
      }

      let uploadedPhotoUrl = '';

      // 1. Upload Cover Photo to Storage (if selected)
      if (wizardData.coverPhoto) {
        try {
          const sanitizedFileName = wizardData.coverPhoto.name.replace(/[^a-zA-Z0-9.]/g, '_');
          const fileName = `${Date.now()}_${sanitizedFileName}`;
          const photoRef = ref(storage, `properties/${currentUser.uid}/${fileName}`);
          
          const metadata = {
            contentType: wizardData.coverPhoto.type || 'image/jpeg',
          };

          const snapshot = await uploadBytes(photoRef, wizardData.coverPhoto, metadata);
          uploadedPhotoUrl = await getDownloadURL(snapshot.ref);
        } catch (uploadError) {
          console.error('Photo upload failed:', uploadError);
          // Non-blocking warning: save property and let user know
          setSubmitError('Property was saving, but cover photo upload failed. You can re-upload it later.');
        }
      }

      // 2. Format payload for Firestore with sanitization
      const finalPropertyData = {
        ownerUid: currentUser.uid,

        // Address Details
        street: wizardData.streetAddress || '',
        barangay: wizardData.barangay || '',
        cityMunicipality: wizardData.cityMunicipality || '',
        province: wizardData.province || '',
        region: wizardData.region || '',
        regionCode: wizardData.regionCode || '',
        provinceCode: wizardData.provinceCode || '',
        cityCode: wizardData.cityCode || '',

        // Basic Details
        propertyName: wizardData.propertyName || '',
        propertyType: wizardData.propertyType || '',
        emergencyPhone: wizardData.emergencyPhone || '',
        coverPhotoUrl: uploadedPhotoUrl,

        // Rules & Amenities
        totalFloors: Number(wizardData.totalFloors) || 1,
        amenities: wizardData.amenities || [],
        curfewEnabled: Boolean(wizardData.curfewEnabled),
        curfewTime: wizardData.curfewEnabled ? (wizardData.curfewTime || '') : '',

        // Room & Layout Data
        namingPattern: wizardData.namingPattern || 'floor',
        configMode: wizardData.configMode || 'uniform',
        rooms: roomsData,
        totalRooms: layoutMetrics.totalRooms || roomsData.length,
        totalBeds: layoutMetrics.totalBeds || 0,

        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      // 3. Save to Firestore
      const docRef = await addDoc(collection(db, 'properties'), finalPropertyData);

      // 4. Redirect to success screen
      navigate('/wizard-success', {
        state: {
          propertyId: docRef.id,
          propertyName: finalPropertyData.propertyName,
          totalRooms: finalPropertyData.totalRooms,
          totalBeds: finalPropertyData.totalBeds,
        },
      });

    } catch (error) {
      console.error('Error saving property:', error);
      setSubmitError(error.message || 'An error occurred while saving the property.');
    } fontFinally: {
      setIsSubmitting(false);
    }
  };

  return (
<<<<<<< HEAD
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: { xs: 'column', md: 'row' } }}>
=======
    <Box sx={{ maxWidth: 800, mx: "auto", p: { xs: 2, md: 4 } }}>
      <Paper elevation={2} sx={{ p: { xs: 2, md: 4 }, borderRadius: 2 }}>
        <Stepper activeStep={activeStep} alternativeLabel sx={{ mb: 4 }}>
          {STEPS.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>
>>>>>>> origin/feature/admin

      {/* Left Sidebar - Visual Indicator */}
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

<<<<<<< HEAD
        {/* Mobile progress view */}
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
=======
        {activeStep < 2 && (
          <Box
            sx={{
              display: "flex",
              justifyContent: "space-between",
              pt: 2,
              borderTop: "1px solid #eee",
            }}
          >
            <Button
              variant="outlined"
              onClick={handleBack}
            >
              Back
            </Button>
            <Button
              variant="contained"
              onClick={handleNext}
              sx={{ bgcolor: "#1976d2", "&:hover": { bgcolor: "#115293" } }}
            >
              Next Step
            </Button>
>>>>>>> origin/feature/admin
          </Box>
        </Box>

        {/* Desktop progress list */}
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