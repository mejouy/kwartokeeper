import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Button, Typography, Alert } from '@mui/material';
import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined';
import RuleOutlinedIcon from '@mui/icons-material/RuleOutlined';
import GridViewOutlinedIcon from '@mui/icons-material/GridViewOutlined';

import { auth, db, storage } from '../../config/firebase'; // Adjust path
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

import Step1Basics from './components/Step1Basics';
import Step2Rules from './components/Step2Policies';
import Step3Rooms from './components/Step3Rooms';

const STEPS = ['Basic Details', 'Rules & Amenities', 'Rooms & Layout'];
const STEP_ICONS = [HomeOutlinedIcon, RuleOutlinedIcon, GridViewOutlinedIcon];

// Same night-facade motif as Login/Register — deterministic lit pattern so
// it doesn't reshuffle on every render.
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
      aria-label="Illustration of a dormitory building at night, with some rooms lit to show occupancy"
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

// The single source of truth for wizard progress — replaces the old
// stacked combination of a dot strip, a "Step X of 3" caption, and a
// numbered Stepper. One vertical list, always visible on desktop.
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
                }}
              >
                <IconComponent sx={{ fontSize: 18 }} />
              </Box>
              {i < STEPS.length - 1 && (
                <Box sx={{ width: '2px', flex: 1, minHeight: 28, bgcolor: isDone ? 'primary.main' : 'rgba(202, 220, 246, 0.16)', my: 0.5 }} />
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
  
  // Added states for submission handling
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const [wizardData, setWizardData] = useState({
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
    coverPhoto: null,
    totalFloors: 1,
    amenities: [],
    curfewEnabled: false,
    curfewTime: '22:00',
    namingPattern: 'floor',
    configMode: 'uniform',
  });

  const updateWizardData = (newData) => {
    setWizardData((prev) => ({
      ...prev,
      ...newData,
    }));
    
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
    if (!wizardData.streetAddress?.trim()) newErrors.streetAddress = 'Street address is required.'; 
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
    if (!wizardData.totalFloors || wizardData.totalFloors < 1) {
      newErrors.totalFloors = 'Total floors must be at least 1.';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (activeStep === 0) {
      const isStep1Valid = validateStep1();
      if (!isStep1Valid) return; 
    } else if (activeStep === 1) {
      const isStep2Valid = validateStep2();
      if (!isStep2Valid) return; 
    }

    setActiveStep((prev) => Math.min(prev + 1, STEPS.length - 1));
  };

  const handleBack = () => {
    setErrors({});

    // On the first step there's no previous step to return to within the
    // wizard, so "Back" exits setup instead of sitting there disabled.
    if (activeStep === 0) {
      navigate('/login');
      return;
    }

    setActiveStep((prev) => Math.max(prev - 1, 0));
  };

  // The core function to handle image upload and database saving
  const submitPropertyToFirebase = async () => {
    setIsSubmitting(true);
    setSubmitError('');

    // Debug trace: check state right before submission
    console.log("=== PRE-SUBMIT STATE CHECK ===");
    console.log("Street Address:", wizardData.streetAddress);
    console.log("Cover Photo File:", wizardData.coverPhoto);

    // Safety catch: If street is missing here, it means Step 2 or 3 wiped it.
    if (!wizardData.streetAddress?.trim()) {
      setSubmitError("System Error: Street Address data was lost before submission. Check console logs.");
      setIsSubmitting(false);
      return;
    }

    try {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error("Authentication error: No property owner is logged in.");
      }

      let uploadedPhotoUrl = ''; // Default to empty string instead of null

      // 1. Upload Cover Photo to Storage (if selected)
      if (wizardData.coverPhoto) {
        try {
          const fileName = `${Date.now()}_${wizardData.coverPhoto.name.replace(/[^a-zA-Z0-9.]/g, '')}`;
          const photoRef = ref(storage, `properties/${currentUser.uid}/${fileName}`);
          
          // Await the upload and fetch the URL
          const snapshot = await uploadBytes(photoRef, wizardData.coverPhoto);
          uploadedPhotoUrl = await getDownloadURL(snapshot.ref);
          console.log("Photo uploaded successfully:", uploadedPhotoUrl);
        } catch (uploadError) {
          console.error("Photo upload failed:", uploadError);
          // Don't crash the whole save if just the photo fails, but let the user know
          setSubmitError("Property saved, but cover photo failed to upload.");
        }
      } else {
        console.warn("No cover photo was found in wizardData.");
      }

      // 2. Map data specifically for Firestore
      const finalPropertyData = {
        ownerUid: currentUser.uid, 
        
        // Address
        street: wizardData.streetAddress || '', // Fallback to prevent undefined errors
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
        
        // Step 2 & 3 Details
        totalFloors: wizardData.totalFloors || 1,
        amenities: wizardData.amenities || [],
        curfewEnabled: wizardData.curfewEnabled || false,
        curfewTime: wizardData.curfewTime || '',
        namingPattern: wizardData.namingPattern || 'floor',
        configMode: wizardData.configMode || 'uniform',
        
        createdAt: serverTimestamp(),
      };

      console.log("Final Payload mapped for Firestore:", finalPropertyData);

      // 3. Save to Firestore
      const docRef = await addDoc(collection(db, 'properties'), finalPropertyData);
      console.log("Property successfully created with ID:", docRef.id);
      
      // TODO: Redirect the user

    } catch (error) {
      console.error("Error saving property:", error);
      setSubmitError(error.message || "An error occurred while saving the property.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: { xs: 'column', md: 'row' } }}>

      {/* Left sidebar — same identity as Login/Register, and the ONLY progress indicator */}
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

        {/* Mobile: compact single-line progress instead of the full list below */}
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
                }}
              />
            ))}
          </Box>
        </Box>

        <Box sx={{ display: { xs: 'none', md: 'block' } }}>
          <StepList activeStep={activeStep} />
        </Box>

        <Box sx={{ display: { xs: 'none', md: 'block' }, mt: 'auto' }}>
          <DormFacade />
        </Box>
      </Box>

      {/* Right content — full-bleed, no floating card */}
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
                onSubmit={submitPropertyToFirebase} // Passed handler to Step 3
                isSubmitting={isSubmitting}         // Passed loading state to Step 3
              />
            )}
          </Box>

          {activeStep < 2 && (
            <Box sx={{ display: 'flex', justifyContent: 'space-between', pt: 3, borderTop: '1px solid', borderColor: 'divider' }}>
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