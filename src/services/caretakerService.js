// src/services/caretakerService.js
//
// Creates a caretaker account without logging the owner out.
//
// WHY A SECONDARY FIREBASE APP:
// Firebase's client SDK automatically signs in whoever createUserWithEmailAndPassword()
// just created, replacing the current session. Since the OWNER is the one clicking
// "Send Caretaker Invite" while logged in, we can't use the main `auth` instance for
// this or the owner gets logged out and replaced by the new caretaker account.
//
// The workaround: spin up a second, isolated Firebase App instance (same project,
// same config) just for this one operation. Its auth state is completely separate
// from the main app's auth state, so creating the caretaker account here does not
// touch the owner's session at all. We sign out of the secondary instance right
// after, since we don't need to keep that session alive.

import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../config/firebase";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

function getSecondaryApp() {
  const existing = getApps().find((app) => app.name === "Secondary");
  return existing || initializeApp(firebaseConfig, "Secondary");
}

/**
 * Creates a caretaker's Firebase Auth account + Firestore user document,
 * without disturbing the currently logged-in owner's session.
 *
 * @param {object} params
 * @param {string} params.fullName
 * @param {string} params.email
 * @param {string} params.mobilePhone
 * @param {string} params.tempPassword       - plaintext temp password (see generateTempPassword.js)
 * @param {string} params.assignedPropertyId - Firestore doc id of the property
 * @param {string} params.ownerUid           - uid of the inviting owner
 * @param {object} params.permissions        - { manageTenants, logOccupancy, handleReports, viewFinancials, modifyLayout }
 * @returns {Promise<string>} the new caretaker's uid
 */
export async function createCaretakerAccount({
  fullName,
  email,
  mobilePhone,
  tempPassword,
  assignedPropertyId,
  ownerUid,
  permissions,
}) {
  if (!email || !tempPassword) {
    throw new Error("Missing email or temporary password.");
  }
  if (!ownerUid) {
    throw new Error("Missing ownerUid — make sure the owner is logged in.");
  }

  const secondaryApp = getSecondaryApp();
  const secondaryAuth = getAuth(secondaryApp);

  let caretakerUid;
  try {
    const credential = await createUserWithEmailAndPassword(
      secondaryAuth,
      email.trim(),
      tempPassword,
    );
    caretakerUid = credential.user.uid;
  } finally {
    // Always clean up the secondary session, even if the Firestore write
    // below fails, so it never lingers.
    await signOut(secondaryAuth).catch(() => {});
  }

  // Write the caretaker's profile using the MAIN db instance (same Firestore
  // project either way — the secondary app was only needed for the Auth call).
  const caretakerProfile = {
    uid: caretakerUid,
    ownerUid,
    name: fullName.trim(),
    email: email.trim(),
    phone: mobilePhone.trim(),
    role: "caretaker",
    status: "Active",
    assignedPropertyId,
    permissions,
    invitedBy: ownerUid,
    mustChangePassword: true,
    createdAt: serverTimestamp(),
  };

  await setDoc(doc(db, "users", caretakerUid), caretakerProfile);
  await setDoc(doc(db, "caretakers", caretakerUid), {
    ...caretakerProfile,
    fullName: caretakerProfile.name,
  });

  return caretakerUid;
}
