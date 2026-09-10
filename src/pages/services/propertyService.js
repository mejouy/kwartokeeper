// src/pages/services/propertyService.js
import { auth, db, storage } from "../../config/firebase";
import {
  collection,
  addDoc,
  serverTimestamp,
  doc,
  getDoc,
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";

const normalizeText = (value) =>
  typeof value === "string" ? value.trim() : "";

/**
 * TEMPORARY DEV WORKAROUND:
 * Photo uploads are deliberately disabled for now because the
 * Firebase Storage / CORS path still needs work. Keep the setup flow
 * usable while the UI/UX and property creation flow are being finished.
 */
export const uploadPropertyPhoto = async (file, ownerUid) => {
  console.warn("Cover photo upload is intentionally disabled for now. Firebase Storage / CORS needs work.");
  return null;
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

  // TEMPORARY DEV WORKAROUND:
  // Deliberately persist null for the cover photo URL now.
  // Firebase Storage / CORS mapping still needs work, and we want
  // the UI/UX and property setup flow to continue without being blocked.
  let uploadedCoverPhotoUrl = null;

  const propertyPayload = {
    // Basic Details
    propertyName:
      normalizeText(wizardData.propertyName) ||
      normalizeText(wizardData.name) ||
      "Untitled Property",
    propertyType: wizardData.propertyType || "Dormitory",
    emergencyPhone: normalizeText(wizardData.emergencyPhone) || null,
    coverPhotoUrl: uploadedCoverPhotoUrl,

    // Hierarchical Address Details
    address: addressPayload,

    // Structure & Layout Setup
    totalFloors: Math.max(1, Number(wizardData.totalFloors) || 1),
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
      monthlyRatePerBed: Number(room.rate || room.monthlyRatePerBed) || 0,
      occupiedBeds: 0,
    })),

    // Ownership & Timestamps
    ownerUid: resolvedOwnerUid,
    createdAt: serverTimestamp(),
  };

  try {
    const docRef = await addDoc(collection(db, "properties"), propertyPayload);
    return docRef.id;
  } catch (error) {
    console.error("Error saving property to Firestore:", error);
    throw new Error(error.message || "Failed to save property. Please try again.");
  }
};