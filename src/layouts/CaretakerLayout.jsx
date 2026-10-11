import React, { useEffect, useState } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  Box,
  Divider,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Paper,
  BottomNavigation,
  BottomNavigationAction,
  Toolbar,
  Typography,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import DashboardIcon from "@mui/icons-material/Dashboard";
import PeopleAltIcon from "@mui/icons-material/PeopleAlt";
import PaymentIcon from "@mui/icons-material/Payment";
import BuildOutlinedIcon from "@mui/icons-material/BuildOutlined";
import MeetingRoomOutlinedIcon from "@mui/icons-material/MeetingRoomOutlined";
import LogoutIcon from "@mui/icons-material/Logout";
import NotificationFeed from "../components/NotificationFeed";
import { signOut, onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../config/firebase";
import { checkLeaseEndsOnOwnerAppOpen } from "../utils/leaseEndNotifications";

const drawerWidth = 288;
const BAR_H = { xs: 56, md: 80 }; // shared by the top bar and the sidebar header so their dividers line up
const BOTTOM_NAV_H = 64;

// permKeys = the owner permissions that unlock the tab (any one of them is enough)
const ALL_NAV_ITEMS = [
  { id: "overview", label: "Overview & Property", short: "Overview", icon: <DashboardIcon />, permKeys: null },
  { id: "tenants", label: "Tenant Directory & Curfew", short: "Tenants", icon: <PeopleAltIcon />, permKeys: ["manageTenants", "logOccupancy"] },
  { id: "maintenance", label: "Maintenance", short: "Repairs", icon: <BuildOutlinedIcon />, permKeys: ["handleReports"] },
  { id: "payments", label: "Financials & Unpaid", short: "Payments", icon: <PaymentIcon />, permKeys: ["viewFinancials"] },
  { id: "rooms", label: "Rooms & Rates", short: "Rooms", icon: <MeetingRoomOutlinedIcon />, permKeys: ["modifyLayout"] },
];

const formatToday = () =>
  new Date().toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });

// Today's date, kept correct for apps that stay open for days (common on
// phones): refreshes just after midnight and whenever the app returns to the
// foreground.
function useTodayLabel() {
  const [label, setLabel] = useState(formatToday);

  useEffect(() => {
    let timer;
    const refresh = () => setLabel(formatToday());

    const scheduleMidnightRefresh = () => {
      const now = new Date();
      const nextMidnight = new Date(now);
      nextMidnight.setHours(24, 0, 5, 0);
      timer = setTimeout(() => {
        refresh();
        scheduleMidnightRefresh();
      }, nextMidnight - now);
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") refresh();
    };

    scheduleMidnightRefresh();
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  return label;
}

// The open tab lives in the URL hash (/caretaker/dashboard#payments). Reloading
// keeps the tab, the browser's Back button works, and no route changes are needed.
const tabFromHash = (hash, items) => {
  const id = String(hash || "").replace(/^#/, "");
  return items.some((i) => i.id === id) ? id : "overview";
};

export default function CaretakerLayout({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const todayLabel = useTodayLabel();
  const [permissions, setPermissions] = useState({});
  const [permsLoaded, setPermsLoaded] = useState(false);

  // Owner-granted permissions decide which tabs exist
  useEffect(() => {
    let active = true;
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        navigate("/login", { replace: true });
        return;
      }
      try {
        const [userProfile, caretakerProfile] = await Promise.all([
          getDoc(doc(db, "users", user.uid)),
          getDoc(doc(db, "caretakers", user.uid)),
        ]);
        const profile = {
          ...(userProfile.exists() ? userProfile.data() : {}),
          ...(caretakerProfile.exists() ? caretakerProfile.data() : {}),
        };
        const ownerUid = profile.ownerUid || profile.invitedBy || "";
        if (ownerUid) {
          checkLeaseEndsOnOwnerAppOpen(ownerUid, user.uid).catch((error) =>
            console.error("Unable to check lease-end notifications:", error)
          );
        }
        if (active) setPermissions(profile.permissions || {});
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
  const isOverview = activeNavItem.id === "overview";

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
    if (rootEl) {
      const originalMaxWidth = rootEl.style.maxWidth;
      const originalMargin = rootEl.style.margin;
      const originalPadding = rootEl.style.padding;
      const originalWidth = rootEl.style.width;

      rootEl.style.setProperty("max-width", "none", "important");
      rootEl.style.setProperty("width", "100%", "important");
      rootEl.style.setProperty("margin", "0", "important");
      rootEl.style.setProperty("padding", "0", "important");

      return () => {
        rootEl.style.maxWidth = originalMaxWidth;
        rootEl.style.margin = originalMargin;
        rootEl.style.padding = originalPadding;
        rootEl.style.width = originalWidth;
      };
    }
    return undefined;
  }, []);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate("/login", { replace: true });
    } catch (error) {
      console.error("Failed to log out:", error);
    }
  };

  const sidebar = (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Brand header: same height as the top bar so the divider lines up */}
      <Toolbar sx={{ px: 2.5, height: BAR_H, minHeight: BAR_H }}>
        <Box
          component="img"
          src="/KwartoKeeper-Secondary-Logo.png"
          alt="KwartoKeeper"
          sx={{ display: "block", height: 64, maxWidth: "100%", width: "auto", objectFit: "contain" }}
        />
      </Toolbar>
      <Divider />

      <Box sx={{ flexGrow: 1, overflowY: "auto" }}>
        <Typography
          variant="caption"
          sx={{ display: "block", px: 3, pt: 2, pb: 0.5, fontWeight: 800, letterSpacing: 0.8, color: "text.secondary" }}
        >
          CARETAKER PORTAL
        </Typography>
        <List sx={{ py: 0.5 }}>
          {NAV_ITEMS.map((item) => (
            <ListItem key={item.id} disablePadding>
              <ListItemButton
                selected={activeNavItem.id === item.id}
                onClick={() => setActiveTab(item.id)}
                sx={{
                  mx: 1.5,
                  my: 0.25,
                  borderRadius: 2,
                  "&.Mui-selected": {
                    bgcolor: "rgba(255, 69, 0, 0.10)",
                    color: "primary.main",
                    "&:hover": { bgcolor: "rgba(255, 69, 0, 0.14)" },
                  },
                  "&.Mui-selected .MuiListItemIcon-root": { color: "primary.main" },
                }}
              >
                <ListItemIcon sx={{ minWidth: 40 }}>{item.icon}</ListItemIcon>
                <ListItemText primary={item.label} slotProps={{ primary: { sx: { fontWeight: 600 } } }} />
              </ListItemButton>
            </ListItem>
          ))}
        </List>
      </Box>

      <Divider />
      <Box sx={{ p: 1.5 }}>
        <ListItemButton
          onClick={handleLogout}
          sx={{ borderRadius: 2, color: "error.main", "&:hover": { bgcolor: "rgba(211, 47, 47, 0.08)" } }}
        >
          <ListItemIcon sx={{ color: "error.main", minWidth: 40 }}>
            <LogoutIcon />
          </ListItemIcon>
          <ListItemText primary="Logout" slotProps={{ primary: { sx: { fontWeight: 600 } } }} />
        </ListItemButton>
      </Box>
    </Box>
  );

  return (
    <Box
      sx={{
        display: "flex",
        minHeight: "100dvh", // dvh: phone browser toolbars don't push the bottom nav off-screen
        width: "100%",
        bgcolor: (theme) => alpha(theme.palette.background.paper, 0.35),
      }}
    >
      {/* Desktop sidebar */}
      <Box
        component="aside"
        sx={{
          display: { xs: "none", md: "block" },
          width: drawerWidth,
          flexShrink: 0,
          position: "fixed",
          top: 0,
          bottom: 0,
          left: 0,
          bgcolor: "background.paper",
          borderRight: "1px solid",
          borderColor: "divider",
          zIndex: (theme) => theme.zIndex.appBar + 1,
        }}
      >
        {sidebar}
      </Box>
      <Box sx={{ display: { xs: "none", md: "block" }, width: drawerWidth, flexShrink: 0 }} />

      {/* Main column */}
      <Box sx={{ flexGrow: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        {/* Top bar */}
        <Box
          component="header"
          sx={{
            position: "sticky",
            top: 0,
            zIndex: (theme) => theme.zIndex.appBar,
            height: BAR_H,
            px: { xs: 2, sm: 3 },
            bgcolor: "background.default",
            color: "text.primary",
            borderBottom: "1px solid",
            borderColor: "divider",
            display: "flex",
            alignItems: "center",
          }}
        >
          {/* Phones: brand mark, since there is no sidebar */}
          <Box
            component="img"
            src="/KwartoKeeper-Icon.png"
            alt="KwartoKeeper"
            sx={{ display: { xs: "block", md: "none" }, height: 28, width: "auto", mr: 1.5 }}
          />
          {!isOverview && (
            <Typography variant="h6" noWrap component="div" sx={{ minWidth: 0, fontFamily: '"Inter", sans-serif', fontWeight: 700 }}>
              {activeNavItem.label}
            </Typography>
          )}
          <Box sx={{ ml: "auto", display: "flex", alignItems: "center", gap: 1, flexShrink: 0 }}>
            {isOverview && (
              <Typography variant="body2" noWrap sx={{ color: "text.secondary", fontWeight: 600 }}>
                {todayLabel}
              </Typography>
            )}
            <NotificationFeed />
            <IconButton
              onClick={handleLogout}
              aria-label="Log out"
              sx={{ display: { xs: "inline-flex", md: "none" }, color: "error.main" }}
            >
              <LogoutIcon />
            </IconButton>
          </Box>
        </Box>

        {/* Content */}
        <Box
          component="main"
          sx={{
            p: { xs: 2, sm: 3 },
            flexGrow: 1,
            minWidth: 0,
            boxSizing: "border-box",
            // leave room for the fixed bottom bar (and the iPhone home indicator)
            pb: { xs: NAV_ITEMS.length > 1 ? `calc(${BOTTOM_NAV_H + 24}px + env(safe-area-inset-bottom, 0px))` : 3, md: 3 },
          }}
        >
          {typeof children === "function"
            ? children(activeTab, setActiveTab)
            : children || <Outlet context={{ activeTab, setActiveTab }} />}
        </Box>
      </Box>

      {/* Phone-only bottom navigation */}
      <Paper
        elevation={0}
        sx={{
          display: { xs: NAV_ITEMS.length > 1 ? "block" : "none", md: "none" },
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: (theme) => theme.zIndex.appBar,
          borderTop: "1px solid",
          borderColor: "divider",
          borderRadius: 0,
          bgcolor: "background.default",
          pb: "env(safe-area-inset-bottom, 0px)",
        }}
      >
        <BottomNavigation
          showLabels
          value={NAV_ITEMS.findIndex((i) => i.id === activeNavItem.id)}
          onChange={(event, v) => setActiveTab(NAV_ITEMS[v].id)}
          sx={{ bgcolor: "transparent", height: BOTTOM_NAV_H }}
        >
          {NAV_ITEMS.map((item) => (
            <BottomNavigationAction
              key={item.id}
              label={item.short}
              icon={item.icon}
              sx={{ minWidth: 0, "& .MuiBottomNavigationAction-label": { fontWeight: 600 } }}
            />
          ))}
        </BottomNavigation>
      </Paper>
    </Box>
  );
}