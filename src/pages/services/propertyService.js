// src/pages/services/propertyService.js
import { auth, db } from "../../config/firebase";
import {
  collection,
  addDoc,
  serverTimestamp,
  doc,
  getDoc,
} from "firebase/firestore";

// Cloudinary Configuration
const CLOUD_NAME = "pdgumr5m"; 
const UPLOAD_PRESET = "kwartokeeper-preset"; 

const normalizeText = (value) =>
  typeof value === "string" ? value.trim() : "";

/**
 * Core utility to upload an image file directly to Cloudinary.
 */
export const uploadToCloudinary = async (file) => {
  if (!(file instanceof File)) {
    throw new Error("The selected file is not a valid file instance.");
  }

  if (!file.type.startsWith("image/")) {
    throw new Error("The selected file must be an image.");
  }

  const MAX_SIZE_MB = 5;
  if (file.size > MAX_SIZE_MB * 1024 * 1024) {
    throw new Error(`File "${file.name}" exceeds the ${MAX_SIZE_MB}MB size limit.`);
  }

  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", UPLOAD_PRESET);

  try {
    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
      {
        method: "POST",
        body: formData,
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("Cloudinary API Error Response:", data);
      throw new Error(data.error?.message || "Failed to upload image to Cloudinary.");
    }

    return data.secure_url;
  } catch (error) {
    console.error("Cloudinary upload failure details:", error);
    throw error; // Preserves exact Cloudinary error message
  }
};

/**
 * Backward-compatible wrapper for components like PropertyWizard.jsx
 * returning the Cloudinary URL in both object and string forms.
 */
export const uploadPropertyPhoto = async (file, ownerUid) => {
  const downloadUrl = await uploadToCloudinary(file);
  return {
    downloadUrl,
    url: downloadUrl,
    storagePath: null, // Legacy Firebase storage path replaced by Cloudinary
  };
};

/**
 * Saves a new property document to Firestore.
 */
export const saveProperty = async (
  wizardData = {},
  rooms = [],
  ownerUid = "",
  coverPhotoFile = null
) => {
  const ownerUidFromAuth = auth.currentUser?.uid || "";
  const callerOwnerUid = normalizeText(ownerUid);
  const primaryOwnerUid = ownerUidFromAuth || callerOwnerUid;

  let resolvedOwnerUid = primaryOwnerUid;
  if (primaryOwnerUid) {
    const userDocRef = doc(db, "users", primaryOwnerUid);
    const userDoc = await getDoc(userDocRef);
    if (userDoc.exists()) {
      const userData = userDoc.data();
      resolvedOwnerUid = normalizeText(userData?.uid) || primaryOwnerUid;
    }
  }

  if (!resolvedOwnerUid) {
    throw new Error(
      "Missing ownerUid — make sure the owner is logged in before saving."
    );
  }

  // Safe total calculations
  const totalRooms = Array.isArray(rooms) ? rooms.length : 0;
  const totalBeds = Array.isArray(rooms)
    ? rooms.reduce((sum, room) => sum + (Number(room.capacity) || 0), 0)
    : 0;

  // Street comes from the Step-1 field named streetAddress in the wizard state.
  const streetValue =
    normalizeText(wizardData.streetAddress) ||
    normalizeText(wizardData.street) ||
    normalizeText(wizardData.address?.street) ||
    normalizeText(wizardData.address);

  const addressPayload = {
    street: streetValue || null,
    barangay: normalizeText(wizardData.barangay) || normalizeText(wizardData.address?.barangay) || null,
    cityMunicipality:
      normalizeText(wizardData.cityMunicipality) ||
      normalizeText(wizardData.address?.cityMunicipality) ||
      null,
    province: normalizeText(wizardData.province) || normalizeText(wizardData.address?.province) || null,
    region: normalizeText(wizardData.region) || normalizeText(wizardData.address?.region) || null,
  };

  let uploadedCoverPhotoUrl =
    normalizeText(wizardData.coverPhotoUrl) ||
    normalizeText(wizardData.coverPhotoPreview) ||
    normalizeText(wizardData.coverPhoto);

  if (coverPhotoFile instanceof File) {
    const photoResult = await uploadPropertyPhoto(coverPhotoFile, resolvedOwnerUid);
    uploadedCoverPhotoUrl = photoResult.downloadUrl;
  }

  const normalizedCoverPhotoUrl = uploadedCoverPhotoUrl || null;

  const propertyPayload = {
    // Basic Details
    propertyName:
      normalizeText(wizardData.propertyName) ||
      normalizeText(wizardData.name) ||
      "Untitled Property",
    propertyType: wizardData.propertyType || "Dormitory",
    emergencyPhone: normalizeText(wizardData.emergencyPhone) || null,
    
    // Cloudinary Image URLs
    coverPhotoUrl: normalizedCoverPhotoUrl,
    coverPhoto: normalizedCoverPhotoUrl,
    imageUrl: normalizedCoverPhotoUrl,
    photoUrl: normalizedCoverPhotoUrl,

    // Hierarchical Address Details
    address: addressPayload,

    // Structure & Layout Setup
    totalFloors: Math.max(1, Number(wizardData.totalFloors) || 1),
    estimatedRooms: Number(wizardData.estimatedRooms) || totalRooms,
    totalRooms,
    totalBeds,
    occupiedBeds: 0,
    namingPattern: wizardData.namingPattern || "floor",
    configMode: wizardData.configMode || "uniform",

    // Rules & Amenities
    amenities: Array.isArray(wizardData.amenities) ? wizardData.amenities : [],
    rules: Array.isArray(wizardData.rules) ? wizardData.rules : [],
    curfew: {
      enabled: Boolean(wizardData.curfewEnabled),
      startTime: wizardData.curfewTime || "22:00",
    },

    // Individual Room & Bed Schema
    rooms: (Array.isArray(rooms) ? rooms : []).map((room, index) => ({
      id: room.id || `room_${index + 1}`,
      roomName: String(room.roomNumber || room.roomName || `Room ${index + 1}`),
      floor: Number(room.floorNumber || room.floor) || 1,
      capacity: Number(room.capacity) || 1,
      roomType: room.roomType || "Bedspace",
      monthlyRatePerBed: Number(room.rate || room.monthlyRatePerBed) || 0,
      occupiedBeds: 0,
    })),

    // Ownership & Timestamps
    ownerUid: resolvedOwnerUid,
    createdAt: serverTimestamp(),
  };

  try {
    const docRef = await addDoc(collection(db, "properties"), propertyPayload);
    return {
      id: docRef.id,
      coverPhotoUrl: normalizedCoverPhotoUrl,
    };
  } catch (error) {
    console.error("Error saving property to Firestore:", error);
    throw new Error(error.message || "Failed to save property. Please try again.");
  }
};