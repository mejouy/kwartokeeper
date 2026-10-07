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

const sanitizeFileName = (fileName) =>
  String(fileName || "cover-photo")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_+/g, "_");

export const uploadPropertyPhoto = async (file, ownerUid) => {
  if (!(file instanceof File)) {
    throw new Error("The selected cover photo is not a valid file.");
  }

  if (!file.type.startsWith("image/")) {
    throw new Error("The selected cover photo must be an image file.");
  }

  if (file.size > 10 * 1024 * 1024) {
    throw new Error("The cover photo must be smaller than 10 MB.");
  }

  const uploadPath = `properties/${ownerUid}/${Date.now()}_${sanitizeFileName(file.name)}`;
  const photoRef = ref(storage, uploadPath);
  const metadata = {
    contentType: file.type,
    cacheControl: "public,max-age=31536000,immutable",
  };

  const snapshot = await uploadBytes(photoRef, file, metadata);
  const downloadUrl = await getDownloadURL(snapshot.ref);

  if (!downloadUrl.startsWith("https://")) {
    throw new Error("Firebase Storage did not return a valid download URL.");
  }

  return { downloadUrl, storagePath: uploadPath };
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
    const uploadedPhoto = await uploadPropertyPhoto(coverPhotoFile, resolvedOwnerUid);
    uploadedCoverPhotoUrl = uploadedPhoto.downloadUrl;
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
    coverPhotoUrl: normalizedCoverPhotoUrl,
    coverPhoto: normalizedCoverPhotoUrl,
    imageUrl: normalizedCoverPhotoUrl,
    photoUrl: normalizedCoverPhotoUrl,
    coverPhotoStoragePath: coverPhotoFile instanceof File
      ? `properties/${resolvedOwnerUid}/${Date.now()}_${sanitizeFileName(coverPhotoFile.name)}`
      : null,

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
    return docRef.id;
  } catch (error) {
    console.error("Error saving property to Firestore:", error);
    throw new Error(error.message || "Failed to save property. Please try again.");
  }
};