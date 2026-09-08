import React, { useState } from 'react';
import { Box, Button, Stepper, Step, StepLabel, Paper } from '@mui/material';

import Step1Basics from './components/Step1Basics';
import Step2Rules from './components/Step2Policies';
import Step3Rooms from './components/Step3Rooms';

const STEPS = ['Basic Details', 'Rules & Amenities', 'Rooms & Layout'];

export default function PropertyWizard() {
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
    totalFloors: 1,
    amenities: [],
    curfewEnabled: false,
    curfewTime: '10:00 PM',
    namingPattern: 'floor',
    configMode: 'uniform',
  });

  const updateWizardData = (newData) => {
    setWizardData((prev) => ({
      ...prev,
      ...newData,
    }));
    
    // Clear errors for fields as they are edited
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
    if (!wizardData.totalFloors || wizardData.totalFloors < 1) {
      newErrors.totalFloors = 'Total floors must be at least 1.';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (activeStep === 0) {
      const isStep1Valid = validateStep1();
      if (!isStep1Valid) return; // Stop user from going to Step 2
    } else if (activeStep === 1) {
      const isStep2Valid = validateStep2();
      if (!isStep2Valid) return; // Stop user from going to Step 3
    }

    setActiveStep((prev) => Math.min(prev + 1, STEPS.length - 1));
  };

  const handleBack = () => {
    setErrors({});
    setActiveStep((prev) => Math.max(prev - 1, 0));
  };

  return (
    <Box sx={{ maxWidth: 800, mx: 'auto', p: { xs: 2, md: 4 } }}>
      <Paper elevation={2} sx={{ p: { xs: 2, md: 4 }, borderRadius: 2 }}>
        <Stepper activeStep={activeStep} alternativeLabel sx={{ mb: 4 }}>
          {STEPS.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        <Box sx={{ minHeight: 350, mb: 4 }}>
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
          <Box sx={{ display: 'flex', justifyContent: 'space-between', pt: 2, borderTop: '1px solid #eee' }}>
            <Button
              variant="outlined"
              disabled={activeStep === 0}
              onClick={handleBack}
            >
              Back
            </Button>
            <Button
              variant="contained"
              onClick={handleNext}
              sx={{ bgcolor: '#1976d2', '&:hover': { bgcolor: '#115293' } }}
            >
              Next Step
            </Button>
          </Box>
        )}
      </Paper>
    </Box>
  );
}