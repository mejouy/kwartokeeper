// src/services/propertyService.js
//
// NOTE: adjust the import path for `db` below to match wherever
// Dev 1 / your firebase.js config file actually lives (src/config/firebase.js
// per the folder structure doc).

import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../config/firebase";

/**
 * Saves the complete property profile (Steps 1-3 combined) as ONE document
 * in the `properties` Firestore collection, with rooms embedded as an array.
 *
 * @param {object} wizardData - accumulated Step 1 & 2 data (built by Dev 3),
 *                              plus namingPattern/configMode from Step 3
 * @param {Array}  rooms      - generated room objects (see roomGenerator.js)
 * @param {string} ownerUid   - uid of the logged-in owner (from AuthContext, Dev 1)
 * @returns {Promise<string>} the new property document's id
 */
export async function saveProperty(wizardData, rooms, ownerUid) {
  if (!ownerUid) {
    throw new Error(
      "Missing ownerUid — make sure the owner is logged in before saving.",
    );
  }

  const propertiesRef = collection(db, "properties");

  const propertyDoc = {
    ownerUid,
    propertyName: wizardData.propertyName || null,
    propertyType: wizardData.propertyType || null, // Dormitory | Apartment | Boarding House
    address: {
      street: wizardData.street || null,
      barangay: wizardData.barangay || null,
      cityMunicipality: wizardData.cityMunicipality || null,
    },
    emergencyPhone: wizardData.emergencyPhone || null,
    coverPhotoUrl: wizardData.coverPhotoUrl || null,
    totalFloors: wizardData.totalFloors,
    amenities: wizardData.amenities || [],
    curfew: {
      enabled: wizardData.curfewEnabled || false,
      startTime: wizardData.curfewStartTime || null,
    },
    namingPattern: wizardData.namingPattern, // 'floor' | 'alpha' | 'sequential'
    configMode: wizardData.configMode, // 'uniform' | 'perFloor'
    rooms, // embedded array from roomGenerator.js
    totalRooms: rooms.length,
    totalBeds: rooms.reduce((sum, r) => sum + r.capacity, 0),
    occupiedBeds: 0,
    createdAt: serverTimestamp(),
  };

  const docRef = await addDoc(propertiesRef, propertyDoc);
  return docRef.id;
}
