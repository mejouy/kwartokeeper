import React, { useState } from 'react';
import {
  Container,
  Box,
  Button,
  Typography,
  IconButton
} from '@mui/material';

import { Step1Basics } from './components/Step1Basics';
import { Step2Policies } from './components/Step2Policies';

export const PropertyWizard = ({ onComplete, onSaveDraft }) => {
  const [activeStep, setActiveStep] = useState(0);

  const [wizardData, setWizardData] = useState({
    propertyName: '',
    propertyType: 'Dormitory',
    streetAddress: '',
    cityBarangay: '',
    emergencyPhone: '',
    coverPhoto: null,
    floors: 2,
    estimatedRooms: 10,
    amenities: ['Wi-Fi'],
    curfewEnabled: true,
    curfewTime: '10:00 PM'
  });

  const updateWizardData = (fields) => {
    setWizardData((prev) => ({ ...prev, ...fields }));
  };

  const handleNext = () => setActiveStep((prev) => prev + 1);
  const handleBack = () => {
    if (activeStep > 0) setActiveStep((prev) => prev - 1);
  };

  return (
    <Container 
      maxWidth="lg" 
      sx={{ 
        minHeight: '100vh', 
        py: { xs: 2, sm: 4 }, 
        px: { xs: 2, sm: 6 },
        display: 'flex', 
        flexDirection: 'column' 
      }}
    >
      {/* Top Header Bar */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: { xs: 3, sm: 5 } }}>
        <IconButton onClick={handleBack} disabled={activeStep === 0} sx={{ p: 0.5, color: '#000' }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
          </svg>
        </IconButton>

        <Typography variant="h6" fontWeight="500" sx={{ fontSize: { xs: '1.1rem', sm: '1.25rem' }, color: '#111' }}>
          Setup your Property
        </Typography>

        <Button
          onClick={() => onSaveDraft && onSaveDraft(wizardData)}
          disableElevation
          sx={{
            backgroundColor: '#D9D9D9',
            color: '#222',
            textTransform: 'none',
            fontSize: '0.875rem',
            px: { xs: 2, sm: 3 },
            py: 1,
            borderRadius: '2px',
            fontWeight: 500,
            '&:hover': { backgroundColor: '#cccccc' }
          }}
        >
          Save and Exit
        </Button>
      </Box>

      {/* Main Step Body Content */}
      <Box sx={{ flexGrow: 1, mb: 4 }}>
        {activeStep === 0 && (
          <Step1Basics wizardData={wizardData} updateWizardData={updateWizardData} />
        )}
        {activeStep === 1 && (
          <Step2Policies wizardData={wizardData} updateWizardData={updateWizardData} />
        )}
        {activeStep === 2 && (
          <Box sx={{ textAlign: 'center', py: 6 }}>
            <Typography variant="h5" fontWeight="bold">Step 3: Room & Bed Generator</Typography>
            <Button
              variant="contained"
              disableElevation
              sx={{ mt: 3, backgroundColor: '#D9D9D9', color: '#000', textTransform: 'none' }}
              onClick={() => onComplete && onComplete(wizardData)}
            >
              Finish Setup
            </Button>
          </Box>
        )}
      </Box>

      {/* Bottom Action Buttons (Left and Right Aligned to Screen Boundaries) */}
      <Box 
        sx={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          width: '100%', 
          maxWidth: '1000px',
          mx: 'auto',
          px: { xs: 2, sm: 4 },
          mt: 'auto',
          pb: 2
        }}
      >
        <Button
          onClick={handleBack}
          disabled={activeStep === 0}
          disableElevation
          sx={{
            backgroundColor: '#D9D9D9',
            color: activeStep === 0 ? '#888888' : '#222222',
            textTransform: 'none',
            minWidth: { xs: 90, sm: 120 },
            px: 3,
            py: 1,
            fontSize: '0.9rem',
            borderRadius: '2px',
            fontWeight: 500,
            '&:hover': { backgroundColor: '#cccccc' },
            '&.Mui-disabled': { backgroundColor: '#EBEBEB', color: '#A0A0A0' }
          }}
        >
          Back
        </Button>

        <Button
          onClick={handleNext}
          disableElevation
          sx={{
            backgroundColor: '#D9D9D9',
            color: '#222222',
            textTransform: 'none',
            minWidth: { xs: 90, sm: 120 },
            px: 3,
            py: 1,
            fontSize: '0.9rem',
            borderRadius: '2px',
            fontWeight: 500,
            '&:hover': { backgroundColor: '#cccccc' }
          }}
        >
          Next
        </Button>
      </Box>

    </Container>
  );
};

export default PropertyWizard;