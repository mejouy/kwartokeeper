// src/components/PushRegistrar.jsx
//
// Registers this device for push notifications after login (native app only)
// and saves the FCM token on the user's own doc: users/{uid}.fcmTokens.
// Firestore rules already allow a user to update their own doc as long as
// role/approvalStatus/status are untouched.
//
// Renders nothing. Mounted once in App.jsx.

import { useEffect, useRef } from "react";
import { Capacitor } from "@capacitor/core";
import { FirebaseMessaging } from "@capacitor-firebase/messaging";
import { doc, updateDoc, arrayUnion } from "firebase/firestore";
import { db } from "../config/firebase";
import { useAuth } from "../context/AuthContext";

async function saveToken(uid, token) {
  if (!uid || !token) return;
  await updateDoc(doc(db, "users", uid), { fcmTokens: arrayUnion(token) });
}

export default function PushRegistrar() {
  const { currentUser } = useAuth();
  const uid = currentUser?.uid || null;
  const previousUid = useRef(null);

  useEffect(() => {
    // Push only exists in the native app, not in the browser.
    if (!Capacitor.isNativePlatform()) return;

    // Signed out: delete this device's token so the previous user's
    // notifications stop arriving on this phone.
    if (!uid) {
      if (previousUid.current) {
        FirebaseMessaging.deleteToken().catch(() => {});
      }
      previousUid.current = null;
      return;
    }
    previousUid.current = uid;

    let cancelled = false;
    let listener = null;

    (async () => {
      try {
        let { receive } = await FirebaseMessaging.checkPermissions();
        if (receive !== "granted") {
          ({ receive } = await FirebaseMessaging.requestPermissions());
        }
        if (receive !== "granted" || cancelled) return;

        const { token } = await FirebaseMessaging.getToken();
        if (!cancelled) await saveToken(uid, token);

        // FCM can rotate the token later, keep the user doc in sync.
        listener = await FirebaseMessaging.addListener(
          "tokenReceived",
          ({ token: newToken }) => {
            saveToken(uid, newToken).catch(() => {});
          },
        );
        if (cancelled) listener.remove();
      } catch (error) {
        console.warn("Push registration skipped:", error);
      }
    })();

    return () => {
      cancelled = true;
      listener?.remove();
    };
  }, [uid]);

  return null;
}
