import { useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import DashboardOutlinedIcon from "@mui/icons-material/DashboardOutlined";
import PeopleAltOutlinedIcon from "@mui/icons-material/PeopleAltOutlined";
import PaymentsOutlinedIcon from "@mui/icons-material/PaymentsOutlined";
import BuildOutlinedIcon from "@mui/icons-material/BuildOutlined";
import MeetingRoomOutlinedIcon from "@mui/icons-material/MeetingRoomOutlined";
import { signOut, onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../config/firebase";
import { checkLeaseEndsOnOwnerAppOpen } from "../utils/leaseEndNotifications";
import AppShell from "./AppShell";

// permKeys = the owner permissions that unlock the tab (any one of them is enough)
const ALL_NAV_ITEMS = [
  { id: "overview", text: "Overview", short: "Home", icon: <DashboardOutlinedIcon />, permKeys: null, group: 0 },
  { id: "tenants", text: "Tenants & curfew", short: "Tenants", icon: <PeopleAltOutlinedIcon />, permKeys: ["manageTenants", "logOccupancy"], group: 1 },
  { id: "maintenance", text: "Repairs", short: "Repairs", icon: <BuildOutlinedIcon />, permKeys: ["handleReports"], group: 1 },
  { id: "payments", text: "Payments", short: "Payments", icon: <PaymentsOutlinedIcon />, permKeys: ["viewFinancials"], group: 2 },
  { id: "rooms", text: "Rooms & rates", short: "Rooms", icon: <MeetingRoomOutlinedIcon />, permKeys: ["modifyLayout"], group: 2 },
];
const GROUP_HEADINGS = [null, "Daily work", "Property"];

// The open tab lives in the URL hash (/caretaker/dashboard#payments). Reloading
// keeps the tab, the browser's Back button works, and no route changes are needed.
const tabFromHash = (hash, items) => {
  const id = String(hash || "").replace(/^#/, "");
  return items.some((i) => i.id === id) ? id : "overview";
};

export default function CaretakerLayout({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [permissions, setPermissions] = useState({});
  const [permsLoaded, setPermsLoaded] = useState(false);
  const [profile, setProfile] = useState({ name: "", subtitle: "" });

  // Owner-granted permissions decide which tabs exist
  useEffect(() => {
    let active = true;
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        navigate("/login", { replace: true });
        return;
      }
      try {
        const [userProfile, caretakerProfile] = await Promise.all([getDoc(doc(db, "users", user.uid)), getDoc(doc(db, "caretakers", user.uid))]);
        const data = {
          ...(userProfile.exists() ? userProfile.data() : {}),
          ...(caretakerProfile.exists() ? caretakerProfile.data() : {}),
        };
        const ownerUid = data.ownerUid || data.invitedBy || "";
        if (ownerUid) {
          checkLeaseEndsOnOwnerAppOpen(ownerUid, user.uid).catch((error) => console.error("Unable to check lease-end notifications:", error));
        }
        if (active) {
          setPermissions(data.permissions || {});
          setProfile({ name: data.name || data.fullName || user.displayName || "Caretaker", subtitle: user.email || "Caretaker" });
        }
      } catch (err) {
        console.error("Failed to load caretaker permissions for layout:", err);
      } finally {
        if (active) setPermsLoaded(true);
      }
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [navigate]);

  // Until permissions arrive every tab is "known" so a reload on #payments doesn't flash the overview
  const NAV_ITEMS = permsLoaded ? ALL_NAV_ITEMS.filter((item) => !item.permKeys || item.permKeys.some((k) => permissions[k] === true)) : ALL_NAV_ITEMS;
  const activeTab = tabFromHash(location.hash, NAV_ITEMS);
  const activeNavItem = NAV_ITEMS.find((item) => item.id === activeTab) || NAV_ITEMS[0];
  const groups = GROUP_HEADINGS.map((heading, i) => ({ heading, items: NAV_ITEMS.filter((n) => n.group === i) })).filter((g) => g.items.length > 0);

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
      groups={groups}
      activeId={activeNavItem.id}
      onSelect={setActiveTab}
      title={activeNavItem.id === "overview" ? "" : activeNavItem.text}
      profile={profile}
      roleLabel="Caretaker"
      navLabel="Caretaker pages"
      onLogout={handleLogout}
    >
      {typeof children === "function" ? children(activeTab, setActiveTab) : children || <Outlet context={{ activeTab, setActiveTab }} />}
    </AppShell>
  );
}
