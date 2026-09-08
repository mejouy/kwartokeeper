// src/pages/services/propertyService.js
import { db } from "../../config/firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";

/**
 * Placeholder for image uploads. Bypasses Firebase Storage to prevent CORS blocks on localhost.
 */
export const uploadPropertyPhoto = async (file, ownerUid) => {
  console.warn("Firebase Storage upload bypassed locally.");
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
  // Safe total calculations
  const totalRooms = Array.isArray(rooms) ? rooms.length : 0;
  const totalBeds = Array.isArray(rooms)
    ? rooms.reduce((sum, room) => sum + (Number(room.capacity) || 0), 0)
    : 0;

  // Handle address whether passed as an object or flat fields
  const addressPayload =
    typeof wizardData.address === "object" && wizardData.address !== null
      ? {
          street: wizardData.address.street?.trim() || null,
          barangay: wizardData.address.barangay?.trim() || null,
          cityMunicipality: wizardData.address.cityMunicipality?.trim() || null,
          province: wizardData.address.province?.trim() || null,
          region: wizardData.address.region?.trim() || null,
        }
      : {
          street: wizardData.street?.trim() || wizardData.address?.trim() || null,
          barangay: wizardData.barangay?.trim() || null,
          cityMunicipality: wizardData.cityMunicipality?.trim() || null,
          province: wizardData.province?.trim() || null,
          region: wizardData.region?.trim() || null,
        };

  const propertyPayload = {
    // Basic Details
    propertyName:
      wizardData.propertyName?.trim() ||
      wizardData.name?.trim() ||
      "Untitled Property",
    propertyType: wizardData.propertyType || "Dormitory",
    emergencyPhone: wizardData.emergencyPhone?.trim() || null,
    coverPhotoUrl: typeof wizardData.coverPhotoUrl === "string" ? wizardData.coverPhotoUrl : null,

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
      startTime: wizardData.curfewTime || "10:00 PM",
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
    ownerUid: ownerUid || wizardData.ownerUid || "anonymous_owner",
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