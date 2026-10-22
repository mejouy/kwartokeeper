import { useEffect, useState } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import DashboardOutlinedIcon from "@mui/icons-material/DashboardOutlined";
import SupervisorAccountOutlinedIcon from "@mui/icons-material/SupervisorAccountOutlined";
import CampaignOutlinedIcon from "@mui/icons-material/CampaignOutlined";
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { collection, doc, getDoc, onSnapshot, query, where } from "firebase/firestore";
import { auth, db } from "../config/firebase";
import { ownerAccessOf } from "../utils/ownerAccess";
import AppShell from "./AppShell";

// How many owner applications are waiting, so the admin sees it from any page.
// Same rule as the route guard and the owner pages.
function usePendingOwners() {
  const [count, setCount] = useState(0);
  useEffect(
    () =>
      onSnapshot(
        query(collection(db, "users"), where("role", "==", "owner")),
        (snap) => setCount(snap.docs.filter((d) => ownerAccessOf(d.data()) === "pending").length),
        () => setCount(0)
      ),
    []
  );
  return count;
}

export default function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const pendingOwners = usePendingOwners();
  const [profile, setProfile] = useState({ name: "", subtitle: "" });

  useEffect(() => {
    let active = true;
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) return;
      getDoc(doc(db, "users", user.uid))
        .then((snap) => {
          if (!active) return;
          const d = snap.exists() ? snap.data() : {};
          setProfile({ name: d.fullName || d.name || user.displayName || "Administrator", subtitle: user.email || "System admin" });
        })
        .catch(() => active && setProfile({ name: user.displayName || "Administrator", subtitle: user.email || "System admin" }));
    });
    return () => {
      active = false;
      unsubscribe();
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

  const groups = [
    { heading: null, items: [{ id: "/admin/overview", aliases: ["/admin", "/admin/dashboard"], text: "Overview", short: "Home", icon: <DashboardOutlinedIcon /> }] },
    {
      heading: "Manage",
      items: [
        { id: "/admin/owners", text: "Owners", icon: <SupervisorAccountOutlinedIcon />, badge: pendingOwners },
        { id: "/admin/announcements", text: "Announcements", short: "News", icon: <CampaignOutlinedIcon /> },
      ],
    },
    { heading: "System", items: [{ id: "/admin/settings", text: "Settings", icon: <SettingsOutlinedIcon /> }] },
  ];
  const items = groups.flatMap((g) => g.items);
  const isActive = (item) => location.pathname === item.id || (item.aliases || []).includes(location.pathname) || location.pathname.startsWith(item.id + "/");
  const activeItem = items.find(isActive) || items[0];

  return (
    <AppShell
      groups={groups}
      activeId={activeItem.id}
      onSelect={(path) => navigate(path)}
      title={activeItem.id === "/admin/overview" ? "" : activeItem.text}
      profile={profile}
      roleLabel="System admin"
      navLabel="Admin pages"
      sidebarTone="dark"
      onLogout={handleLogout}
    >
      <Outlet />
    </AppShell>
  );
}
