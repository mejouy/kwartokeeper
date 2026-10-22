import { useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import DashboardOutlinedIcon from "@mui/icons-material/DashboardOutlined";
import AccountCircleOutlinedIcon from "@mui/icons-material/AccountCircleOutlined";
import PaymentsOutlinedIcon from "@mui/icons-material/PaymentsOutlined";
import BuildOutlinedIcon from "@mui/icons-material/BuildOutlined";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../config/firebase";
import { checkLeaseEndsOnTenantAppOpen } from "../utils/leaseEndNotifications";
import AppShell from "./AppShell";

// Phone order = how often tenants need them: home, pay, repairs, profile
const NAV_ITEMS = [
  { id: "overview", text: "Overview", short: "Home", icon: <DashboardOutlinedIcon /> },
  { id: "payments", text: "Payments", short: "Payments", icon: <PaymentsOutlinedIcon /> },
  { id: "maintenance", text: "Repairs", short: "Repairs", icon: <BuildOutlinedIcon /> },
  { id: "profile", text: "My room & rules", short: "Profile", icon: <AccountCircleOutlinedIcon /> },
];

// The open tab lives in the URL hash (/tenant#payments). Reloading keeps the
// tab, the browser's Back button works, and no route changes are needed in App.
const tabFromHash = (hash) => {
  const id = String(hash || "").replace(/^#/, "");
  return NAV_ITEMS.some((i) => i.id === id) ? id : "overview";
};

export default function TenantLayout({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const activeTab = tabFromHash(location.hash);
  const activeNavItem = NAV_ITEMS.find((item) => item.id === activeTab) || NAV_ITEMS[0];
  const [profile, setProfile] = useState({ name: "", subtitle: "" });

  // Who's signed in (for the profile card) + the lease-end reminder check on app open
  useEffect(() => {
    let active = true;
    let tenantUid = "";
    const check = () => {
      if (!active || !tenantUid || document.visibilityState !== "visible") return;
      checkLeaseEndsOnTenantAppOpen(tenantUid).catch((error) => console.error("Unable to check tenant lease-end notification:", error));
    };
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      tenantUid = user?.uid || "";
      check();
      if (!user) return;
      getDoc(doc(db, "users", user.uid))
        .then((snap) => {
          if (!active) return;
          const d = snap.exists() ? snap.data() : {};
          const room = d.roomId || d.roomNumber;
          setProfile({ name: d.fullName || d.name || user.displayName || "Tenant", subtitle: room ? `Tenant · Room ${room}` : user.email || "Tenant" });
        })
        .catch(() => active && setProfile({ name: user.displayName || "Tenant", subtitle: user.email || "Tenant" }));
    });
    document.addEventListener("visibilitychange", check);
    return () => {
      active = false;
      unsubscribe();
      document.removeEventListener("visibilitychange", check);
    };
  }, []);

  const setActiveTab = (id) => {
    if (id === activeTab) return;
    navigate({ pathname: location.pathname, search: location.search, hash: id === "overview" ? "" : `#${id}` });
  };

  // Start each tab at the top
  useEffect(() => {
    window.scrollTo?.({ top: 0 });
  }, [activeTab]);

  // Forcefully override parent #root styles from inside this layout component alone
  useEffect(() => {
    const rootEl = document.getElementById("root");
    if (!rootEl) return undefined;
    const original = { maxWidth: rootEl.style.maxWidth, margin: rootEl.style.margin, padding: rootEl.style.padding, width: rootEl.style.width };
    rootEl.style.setProperty("max-width", "none", "important");
    rootEl.style.setProperty("width", "100%", "important");
    rootEl.style.setProperty("margin", "0", "important");
    rootEl.style.setProperty("padding", "0", "important");
    return () => {
      rootEl.style.maxWidth = original.maxWidth;
      rootEl.style.margin = original.margin;
      rootEl.style.padding = original.padding;
      rootEl.style.width = original.width;
    };
  }, []);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate("/login", { replace: true });
    } catch (error) {
      console.error("Failed to log out:", error);
    }
  };

  return (
    <AppShell
      groups={[{ heading: null, items: NAV_ITEMS }]}
      activeId={activeNavItem.id}
      onSelect={setActiveTab}
      title={activeNavItem.id === "overview" ? "" : activeNavItem.text}
      profile={profile}
      roleLabel="Tenant"
      navLabel="Tenant pages"
      onLogout={handleLogout}
    >
      {typeof children === "function" ? children(activeTab, setActiveTab) : children || <Outlet context={{ activeTab, setActiveTab }} />}
    </AppShell>
  );
}
