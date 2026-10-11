import React, { useEffect, useState } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import {
  Box,
  Drawer,
  AppBar,
  Toolbar,
  List,
  Typography,
  Divider,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  IconButton,
  Paper,
  BottomNavigation,
  BottomNavigationAction,
  Badge,
} from "@mui/material";
import DashboardIcon from "@mui/icons-material/Dashboard";
import SupervisorAccountIcon from "@mui/icons-material/SupervisorAccount";
import CampaignIcon from "@mui/icons-material/Campaign";
import SettingsIcon from "@mui/icons-material/Settings";
import LogoutIcon from "@mui/icons-material/Logout";
import { alpha } from "@mui/material/styles";

// Firebase Auth imports
import { signOut } from "firebase/auth";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { auth, db } from "../config/firebase";

const drawerWidth = 288;
const BAR_H = { xs: 56, md: 80 }; // shared by the top bar and the sidebar header so their dividers line up

const formatToday = () =>
  new Date().toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });

// Today's date, kept correct for apps that stay open for days (common on
// phones): refreshes just after midnight and whenever the tab/app returns to
// the foreground, since timers are paused while a phone is asleep.
function useTodayLabel() {
  const [label, setLabel] = useState(formatToday);

  useEffect(() => {
    let timer;
    const refresh = () => setLabel(formatToday());

    const scheduleMidnightRefresh = () => {
      const now = new Date();
      const nextMidnight = new Date(now);
      nextMidnight.setHours(24, 0, 5, 0); // a few seconds past midnight
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

// How many owner applications are waiting, so the admin sees it from any page.
// Same rule as the owner page: status or approvalStatus is "pending".
function usePendingOwners() {
  const [count, setCount] = useState(0);
  useEffect(() => {
    return onSnapshot(
      query(collection(db, "users"), where("role", "==", "owner")),
      (snap) => setCount(snap.docs.filter((d) => d.data().status === "pending" || d.data().approvalStatus === "pending").length),
      () => setCount(0)
    );
  }, []);
  return count;
}

export default function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const todayLabel = useTodayLabel();
  const pendingOwners = usePendingOwners();

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate("/login", { replace: true });
    } catch (error) {
      console.error("Failed to log out:", error);
    }
  };

  const menuItems = [
    { text: "Overview", path: "/admin/overview", aliases: ["/admin", "/admin/dashboard"], icon: <DashboardIcon /> },
    { text: "Owners", path: "/admin/owners", icon: <SupervisorAccountIcon />, badge: pendingOwners },
    { text: "Announcements", path: "/admin/announcements", icon: <CampaignIcon /> },
    { text: "Settings", path: "/admin/settings", icon: <SettingsIcon /> },
  ];

  const isActive = (item) =>
    location.pathname === item.path ||
    (item.aliases || []).includes(location.pathname) ||
    location.pathname.startsWith(item.path + "/");

  const activeItem = menuItems.find(isActive);
  const isOverview = activeItem?.path === "/admin/overview";
  const currentTitle = isOverview ? "" : activeItem?.text || "Admin";
  const bottomValue = Math.max(0, menuItems.findIndex(isActive));

  const logoutButton = (
    <ListItemButton
      onClick={handleLogout}
      sx={{ borderRadius: 2, color: "#ff8a80", "&:hover": { bgcolor: "rgba(255, 138, 128, 0.12)" } }}
    >
      <ListItemIcon sx={{ color: "#ff8a80", minWidth: 40 }}>
        <LogoutIcon />
      </ListItemIcon>
      <ListItemText primary="Logout" slotProps={{ primary: { sx: { fontWeight: 600 } } }} />
    </ListItemButton>
  );

  const drawer = (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <Toolbar sx={{ px: 2.5, height: BAR_H, minHeight: BAR_H, gap: 1.5 }}>
        <Box component="img" src="/KwartoKeeper-DarkMode-Icon.png" alt="" sx={{ height: 34, width: "auto" }} />
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontFamily: '"Inter", sans-serif', fontWeight: 800, fontSize: "1.1rem", lineHeight: 1.2, color: "#fff" }}>
            KwartoKeeper
          </Typography>
          <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.6)", fontWeight: 600 }}>
            System admin
          </Typography>
        </Box>
      </Toolbar>
      <Divider sx={{ borderColor: "rgba(255,255,255,0.1)" }} />

      <Box sx={{ flexGrow: 1, overflowY: "auto" }}>
        <Typography
          variant="caption"
          sx={{ display: "block", px: 3, pt: 2, pb: 0.5, fontWeight: 800, letterSpacing: 0.8, color: "rgba(255,255,255,0.45)" }}
        >
          MENU
        </Typography>
        <List sx={{ py: 0.5 }}>
          {menuItems.map((item) => (
            <ListItem key={item.text} disablePadding>
              <ListItemButton
                selected={isActive(item)}
                onClick={() => navigate(item.path)}
                sx={{
                  mx: 1.5,
                  my: 0.25,
                  borderRadius: 2,
                  color: "rgba(255,255,255,0.78)",
                  "&:hover": { bgcolor: "rgba(255,255,255,0.07)" },
                  "& .MuiListItemIcon-root": { color: "rgba(255,255,255,0.6)" },
                  "&.Mui-selected": {
                    bgcolor: "rgba(255, 69, 0, 0.18)",
                    color: "#fff",
                    "&:hover": { bgcolor: "rgba(255, 69, 0, 0.26)" },
                  },
                  "&.Mui-selected .MuiListItemIcon-root": { color: "#ff6a33" },
                }}
              >
                <ListItemIcon sx={{ minWidth: 40 }}>
                  <Badge badgeContent={item.badge || 0} color="primary" max={99}>{item.icon}</Badge>
                </ListItemIcon>
                <ListItemText primary={item.text} slotProps={{ primary: { sx: { fontWeight: 600 } } }} />
              </ListItemButton>
            </ListItem>
          ))}
        </List>
      </Box>

      <Divider sx={{ borderColor: "rgba(255,255,255,0.1)" }} />
      <Box sx={{ p: 1.5 }}>{logoutButton}</Box>
    </Box>
  );

  return (
    <Box sx={{ display: "flex", minHeight: "100dvh", bgcolor: (theme) => alpha(theme.palette.background.paper, 0.35) }}>
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          width: { md: `calc(100% - ${drawerWidth}px)` },
          ml: { md: `${drawerWidth}px` },
          bgcolor: "background.default",
          color: "text.primary",
          borderBottom: "1px solid",
          borderColor: "divider",
        }}
      >
        <Toolbar sx={{ height: BAR_H, minHeight: BAR_H }}>
          {/* Phones: brand mark replaces the (now unneeded) hamburger. The
              drawer opens from "Menu" in the bottom bar. */}
          <Box
            component="img"
            src="/KwartoKeeper-Icon.png"
            alt="KwartoKeeper"
            sx={{ display: { xs: "block", md: "none" }, height: 28, width: "auto", mr: 1.5 }}
          />
          {currentTitle && (
            <Typography
              variant="h6"
              noWrap
              component="div"
              sx={{ minWidth: 0, fontFamily: '"Inter", sans-serif', fontWeight: 700 }}
            >
              {currentTitle}
            </Typography>
          )}
          <Box sx={{ ml: "auto", display: "flex", alignItems: "center", gap: 1, flexShrink: 0 }}>
            {isOverview && (
              <Typography variant="body2" noWrap sx={{ color: "text.secondary", fontWeight: 600 }}>
                {todayLabel}
              </Typography>
            )}
            <IconButton
              onClick={handleLogout}
              aria-label="Log out"
              sx={{ display: { xs: "inline-flex", md: "none" }, color: "error.main" }}
            >
              <LogoutIcon />
            </IconButton>
          </Box>
        </Toolbar>
      </AppBar>

      <Box component="nav" sx={{ width: { md: drawerWidth }, flexShrink: { md: 0 } }}>
        <Drawer
          variant="permanent"
          sx={{ display: { xs: "none", md: "block" }, "& .MuiDrawer-paper": { boxSizing: "border-box", width: drawerWidth, bgcolor: "#202020", color: "#fff", borderRight: "none" } }}
          open
        >
          {drawer}
        </Drawer>
      </Box>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          minWidth: 0, // lets wide children shrink instead of pushing the page sideways on phones
          width: { md: `calc(100% - ${drawerWidth}px)` },
          p: { xs: 2, sm: 3 },
          // leave room for the fixed bottom bar (and the iPhone home indicator)
          pb: { xs: "calc(88px + env(safe-area-inset-bottom, 0px))", md: 3 },
        }}
      >
        <Box sx={{ height: BAR_H }} />
        <Outlet />
      </Box>

      {/* Phone-only bottom navigation */}
      <Paper
        elevation={0}
        sx={{
          display: { xs: "block", md: "none" },
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
          value={bottomValue}
          onChange={(event, v) => navigate(menuItems[v].path)}
          sx={{ bgcolor: "transparent", height: 64 }}
        >
          {menuItems.map((item) => (
            <BottomNavigationAction
              key={item.text}
              label={item.text}
              icon={<Badge badgeContent={item.badge || 0} color="error" max={99}>{item.icon}</Badge>}
              sx={{ minWidth: 0, "& .MuiBottomNavigationAction-label": { fontWeight: 600 } }}
            />
          ))}
        </BottomNavigation>
      </Paper>
    </Box>
  );
}