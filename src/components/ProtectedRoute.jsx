import React, { useState, useEffect } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../config/firebase"; // Adjust path to your firebase config
import { Box, CircularProgress } from "@mui/material";

const ROLE_HOME_PATHS = {
  owner: "/owner",
  admin: "/admin/overview",
  tenant: "/tenant/dashboard",
  caretaker: "/caretaker/dashboard",
};

export default function ProtectedRoute({ children, allowedRoles = [] }) {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [userDoc, setUserDoc] = useState(null);
  const location = useLocation();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        
        // Fetch the user's document from Firestore to check their status
        try {
          const docRef = doc(db, "users", currentUser.uid);
          const docSnap = await getDoc(docRef);
          
          if (docSnap.exists()) {
            setUserDoc(docSnap.data());
          } else {
            const roleProfiles = await Promise.all([
              getDoc(doc(db, "tenants", currentUser.uid)),
              getDoc(doc(db, "caretakers", currentUser.uid)),
            ]);
            const profile = roleProfiles.find((profileDoc) => profileDoc.exists());
            if (profile) setUserDoc(profile.data());
          }
        } catch (error) {
          console.error("Error fetching user data:", error);
        }
      } else {
        setUser(null);
        setUserDoc(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // 1. Show loading spinner while checking auth state
  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh" }}>
        <CircularProgress />
      </Box>
    );
  }

  // 2. If no user is logged in, redirect to login page
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // 3. ROUTE GUARD: If the user is suspended, redirect them to the suspended page
  // We make sure they aren't already ON the suspended page to prevent an infinite redirect loop
  if (userDoc?.status === "suspended" && location.pathname !== "/suspended") {
    return <Navigate to="/suspended" replace />;
  }

  if (allowedRoles.length > 0) {
    const role = userDoc?.role;
    if (!role) {
      return <Navigate to="/login" state={{ from: location }} replace />;
    }
    if (!allowedRoles.includes(role)) {
      return <Navigate to={ROLE_HOME_PATHS[role] || "/login"} replace />;
    }
  }

  // 4. If logged in, not suspended, and authorized, render the requested page.
  return children;
}