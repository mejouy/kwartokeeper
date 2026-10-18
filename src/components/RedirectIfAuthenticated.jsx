// src/components/RedirectIfAuthenticated.jsx
//
// Wraps public routes ("/" and "/login"). If the app opens while a Firebase
// session is already restored (e.g. relaunching the mobile app with
// "Remember me"), send the user straight to their role's home instead of
// showing the landing/login screen.
//
// IMPORTANT: we only check the session that existed when this component
// first mounted. A fresh login on /login does NOT trigger the redirect, so
// Login.jsx keeps full control of where a newly logged-in user goes
// (e.g. owners without a property yet).
//
// AuthProvider only renders its children after the first
// onAuthStateChanged callback, so currentUser is already accurate on mount.

import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { doc, getDoc } from "firebase/firestore";
import { Box, CircularProgress } from "@mui/material";
import { db } from "../config/firebase";
import { useAuth } from "../context/AuthContext";

// Same values as ROLE_HOME_PATHS in ProtectedRoute.jsx
const ROLE_HOME_PATHS = {
  owner: "/owner",
  admin: "/admin/overview",
  tenant: "/tenant/dashboard",
  caretaker: "/caretaker/dashboard",
};

const PROFILE_SOURCES = [
  { collectionName: "users", fallbackRole: null },
  { collectionName: "tenants", fallbackRole: "tenant" },
  { collectionName: "caretakers", fallbackRole: "caretaker" },
];

export default function RedirectIfAuthenticated({ children }) {
  const { currentUser } = useAuth();

  // Lazy initializer runs once, on mount only. Later logins on this page
  // do not change it, so they never trigger the auto-redirect.
  const [authedOnMount] = useState(() => Boolean(currentUser));
  const [checking, setChecking] = useState(authedOnMount);
  const [target, setTarget] = useState(null);

  useEffect(() => {
    if (!authedOnMount || !currentUser) return;
    let active = true;

    (async () => {
      try {
        let role = null;
        for (const source of PROFILE_SOURCES) {
          const snap = await getDoc(
            doc(db, source.collectionName, currentUser.uid),
          );
          if (snap.exists()) {
            role = snap.data().role || source.fallbackRole;
            if (role) break;
          }
        }
        if (active) setTarget(ROLE_HOME_PATHS[role] || null);
      } catch (error) {
        // If the profile can't be read, just show the normal public page.
        console.error("Auto-redirect check failed:", error);
      } finally {
        if (active) setChecking(false);
      }
    })();

    return () => {
      active = false;
    };
    // Intentionally runs once on mount (see note at top of file).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (checking) {
    return (
      <Box
        sx={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100vh",
        }}
      >
        <CircularProgress />
      </Box>
    );
  }

  if (target) {
    return <Navigate to={target} replace />;
  }

  return children;
}
