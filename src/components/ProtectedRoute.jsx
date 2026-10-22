import { useState, useEffect } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../config/firebase"; // Adjust path to your firebase config
import { Box, CircularProgress } from "@mui/material";
import { ownerAccessOf, RESTRICTED_OWNER_PATHS } from "../utils/ownerAccess";
import { loadPlatformSettings } from "../utils/platformSettings";
import { SIGNED_OUT_REASON_KEY } from "../utils/accountState";
import MaintenanceScreen from "./MaintenanceScreen";

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
  const [settings, setSettings] = useState(null); // only read for non-admins (maintenance mode)
  const location = useLocation();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        
        // Fetch the user's document from Firestore to check their status
        let role = "";
        try {
          const docRef = doc(db, "users", currentUser.uid);
          const docSnap = await getDoc(docRef);
          
          if (docSnap.exists()) {
            role = docSnap.data().role || "";
            // Deleted or disabled in Firebase (marked by scripts/sync-auth-accounts.cjs)
            if (docSnap.data().accountRemoved) {
              try {
                sessionStorage.setItem(SIGNED_OUT_REASON_KEY, docSnap.data().accountRemoved === "disabled" ? "disabled" : "deleted");
              } catch {
                /* storage blocked */
              }
              await signOut(auth).catch(() => {});
              return; // onAuthStateChanged runs again with no user
            }
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
        // Admins are never locked out by maintenance mode
        if (role !== "admin") setSettings(await loadPlatformSettings());
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

  // Maintenance mode (Admin → Settings): everyone but admins sees the maintenance screen
  if (settings?.maintenanceMode && userDoc?.role !== "admin") {
    return <MaintenanceScreen settings={settings} />;
  }

  // 3. ROUTE GUARD: If the user is suspended, redirect them to the suspended page
  // We make sure they aren't already ON the suspended page to prevent an infinite redirect loop.
  // Owners use the shared rule, so a declined (rejected) owner can still re-submit documents.
  const ownerAccess = userDoc?.role === "owner" ? ownerAccessOf(userDoc) : null;
  const isSuspended = ownerAccess ? ownerAccess === "suspended" : userDoc?.status === "suspended";
  if (isSuspended && location.pathname !== "/suspended") {
    return <Navigate to="/suspended" replace />;
  }

  // Signed in with a temporary password (invited caretakers): choose their own first
  if (userDoc?.mustChangePassword === true && location.pathname !== "/set-password") {
    return <Navigate to="/set-password" replace />;
  }

  if (allowedRoles.length > 0) {
    const role = userDoc?.role;
    if (!role) {
      return <Navigate to="/login" state={{ from: location }} replace />;
    }
    if (!allowedRoles.includes(role)) {
      return <Navigate to={ROLE_HOME_PATHS[role] || "/login"} replace />;
    }

    // Pending or declined owners can only use the dashboard, Account and the setup wizard
    const restricted = ownerAccess === "pending" || ownerAccess === "rejected";
    if (restricted && !RESTRICTED_OWNER_PATHS.includes(location.pathname)) {
      return <Navigate to="/owner" replace />;
    }
  }

  // 4. If logged in, not suspended, and authorized, render the requested page.
  return children;
}