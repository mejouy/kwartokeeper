import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Button,
  Stepper,
  Step,
  StepLabel,
  Paper,
  Typography,
  Alert,
} from "@mui/material";

import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { auth, db, storage } from "../../config/firebase";

import Step1Basics from "./components/Step1Basics";
import Step2Rules from "./components/Step2Policies";
import Step3Rooms from "./components/Step3Rooms";

const STEPS = ["Basic Details", "Rules & Amenities", "Rooms & Layout"];

export default function PropertyWizard() {
  const navigate = useNavigate();
  const [activeStep, setActiveStep] = useState(0);
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const [wizardData, setWizardData] = useState({
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
    coverPhoto: null,
    totalFloors: 1,
    amenities: [],
    curfewEnabled: false,
    curfewTime: "10:00 PM",
    namingPattern: "floor",
    configMode: "uniform",
  });

  const updateWizardData = (newData) => {
    setWizardData((prev) => ({
      ...prev,
      ...newData,
    }));

    // Clear error highlights for fields as the user edits them
    const updatedFields = Object.keys(newData);
    setErrors((prevErrors) => {
      const newErrors = { ...prevErrors };
      updatedFields.forEach((field) => delete newErrors[field]);
      return newErrors;
    });
  };

  const validateStep1 = () => {
    const newErrors = {};
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

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateStep2 = () => {
    const newErrors = {};
    if (!wizardData.totalFloors || wizardData.totalFloors < 1) {
      newErrors.totalFloors = "Total floors must be at least 1.";
    }
    if (wizardData.curfewEnabled && !wizardData.curfewTime) {
      newErrors.curfewTime =
        "Please specify a curfew time when curfew is enabled.";
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    setSubmitError("");
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
    if (activeStep === 0) {
      navigate("/owner/dashboard", { replace: true });
      return;
    }

    setErrors({});
    setSubmitError("");
    setActiveStep((prev) => Math.max(prev - 1, 0));
  };

  // Handles image upload and database saving; receives room configurations from Step 3
  const submitPropertyToFirebase = async (roomsData = [], layoutMetrics = {}) => {
    setIsSubmitting(true);
    setSubmitError("");

    if (!wizardData.street?.trim() || !wizardData.propertyName?.trim()) {
      setSubmitError(
        "Validation Error: Basic details are incomplete. Please review Step 1."
      );
      setIsSubmitting(false);
      return;
    }

    try {
      const currentUser = auth?.currentUser;
      if (!currentUser) {
        throw new Error(
          "Authentication error: No property owner is currently logged in."
        );
      }

      let uploadedPhotoUrl = "";

      // 1. Upload Cover Photo to Storage (if selected)
      if (wizardData.coverPhoto) {
        try {
          const sanitizedFileName = wizardData.coverPhoto.name.replace(
            /[^a-zA-Z0-9.]/g,
            "_"
          );
          const fileName = `${Date.now()}_${sanitizedFileName}`;
          const photoRef = ref(
            storage,
            `properties/${currentUser.uid}/${fileName}`
          );

          const metadata = {
            contentType: wizardData.coverPhoto.type || "image/jpeg",
          };

          const snapshot = await uploadBytes(
            photoRef,
            wizardData.coverPhoto,
            metadata
          );
          uploadedPhotoUrl = await getDownloadURL(snapshot.ref);
        } catch (uploadError) {
          console.error("Photo upload failed:", uploadError);
          setSubmitError(
            "Property was saving, but cover photo upload failed. You can re-upload it later."
          );
        }
      }

      // 2. Format payload for Firestore with sanitization
      const finalPropertyData = {
        ownerUid: currentUser.uid,

        // Address Details
        street: wizardData.street || "",
        barangay: wizardData.barangay || "",
        cityMunicipality: wizardData.cityMunicipality || "",
        province: wizardData.province || "",
        region: wizardData.region || "",
        regionCode: wizardData.regionCode || "",
        provinceCode: wizardData.provinceCode || "",
        cityCode: wizardData.cityCode || "",

        // Basic Details
        propertyName: wizardData.propertyName || "",
        propertyType: wizardData.propertyType || "",
        emergencyPhone: wizardData.emergencyPhone || "",
        coverPhotoUrl: uploadedPhotoUrl,

        // Rules & Amenities
        totalFloors: Number(wizardData.totalFloors) || 1,
        amenities: wizardData.amenities || [],
        curfewEnabled: Boolean(wizardData.curfewEnabled),
        curfewTime: wizardData.curfewEnabled ? wizardData.curfewTime || "" : "",

        // Room & Layout Data
        namingPattern: wizardData.namingPattern || "floor",
        configMode: wizardData.configMode || "uniform",
        rooms: roomsData,
        totalRooms: layoutMetrics.totalRooms || roomsData.length,
        totalBeds: layoutMetrics.totalBeds || 0,

        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      // 3. Save to Firestore
      const docRef = await addDoc(
        collection(db, "properties"),
        finalPropertyData
      );

      // 4. Redirect to success screen
      navigate("/wizard-success", {
        state: {
          propertyId: docRef.id,
          propertyName: finalPropertyData.propertyName,
          totalRooms: finalPropertyData.totalRooms,
          totalBeds: finalPropertyData.totalBeds,
        },
      });
    } catch (error) {
      console.error("Error saving property:", error);
      setSubmitError(
        error.message || "An error occurred while saving the property."
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Box sx={{ maxWidth: 800, mx: "auto", p: { xs: 2, md: 4 } }}>
      <Paper elevation={2} sx={{ p: { xs: 2, md: 4 }, borderRadius: 2 }}>
        <Typography
          variant="h5"
          align="center"
          sx={{ fontWeight: 700, mb: 3 }}
        >
          Property Setup
        </Typography>

        <Stepper activeStep={activeStep} alternativeLabel sx={{ mb: 4 }}>
          {STEPS.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        {submitError && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {submitError}
          </Alert>
        )}

        {/* Step Content */}
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

        {/* Navigation Buttons for Steps 1 & 2 */}
        {activeStep < 2 && (
          <Box
            sx={{
              display: "flex",
              justifyContent: "space-between",
              pt: 3,
              borderTop: "1px solid",
              borderColor: "divider",
            }}
          >
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
                bgcolor: "primary.main",
                "&:hover": { bgcolor: "primary.dark" },
              }}
            >
              Next Step
            </Button>
          </Box>
        )}
      </Paper>
    </Box>
  );
}