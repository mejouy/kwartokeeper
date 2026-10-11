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
  Paper,
  BottomNavigation,
  BottomNavigationAction,
} from "@mui/material";
import DashboardIcon from "@mui/icons-material/Dashboard";
import HomeWorkIcon from "@mui/icons-material/HomeWork";
import PeopleIcon from "@mui/icons-material/People";
import AssignmentIndIcon from "@mui/icons-material/AssignmentInd";
import PaymentsIcon from "@mui/icons-material/Payments";
import BuildIcon from "@mui/icons-material/Build";
import CampaignIcon from "@mui/icons-material/Campaign";
import LogoutIcon from "@mui/icons-material/Logout";
import ManageAccountsIcon from "@mui/icons-material/ManageAccounts";
import AssessmentOutlinedIcon from "@mui/icons-material/AssessmentOutlined";
import MenuIcon from "@mui/icons-material/Menu";
import { alpha } from "@mui/material/styles";
import NotificationFeed from "../components/NotificationFeed";

// Firebase Auth imports
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
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

// The four destinations owners reach for most get a spot in the phone's
// bottom bar; everything else lives behind "Menu" (the drawer).
const BOTTOM_NAV_PATHS = ["/owner", "/owner/properties", "/owner/tenants", "/owner/payments"];

export default function OwnerLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [approvalStatus, setApprovalStatus] = useState("loading");
  const navigate = useNavigate();
  const location = useLocation();
  const todayLabel = useTodayLabel();

  useEffect(() => {
    let active = true;
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        if (active) setApprovalStatus("");
        return;
      }
      try {
        const snapshot = await getDoc(doc(db, "users", user.uid));
        const profile = snapshot.exists() ? snapshot.data() : {};
        const status = String(profile.approvalStatus || profile.status || "").toLowerCase();
        if (active) setApprovalStatus(status);
      } catch (error) {
        console.error("Failed to load owner approval status:", error);
        if (active) setApprovalStatus("");
      }
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate("/login", { replace: true });
    } catch (error) {
      console.error("Failed to log out:", error);
    }
  };

  const menuItems = [
    { text: "Overview", path: "/owner", aliases: ["/owner/dashboard"], icon: <DashboardIcon /> },
    { text: "Properties", path: "/owner/properties", icon: <HomeWorkIcon /> },
    { text: "Tenants", path: "/owner/tenants", icon: <PeopleIcon /> },
    { text: "Caretakers", path: "/owner/caretakers", icon: <AssignmentIndIcon /> },
    { text: "Payments", path: "/owner/payments", icon: <PaymentsIcon /> },
    { text: "Maintenance", path: "/owner/maintenance", icon: <BuildIcon /> },
    { text: "Reports", path: "/owner/reports", icon: <AssessmentOutlinedIcon /> },
    { text: "Announcements", path: "/owner/announcements", icon: <CampaignIcon /> },
    { text: "Account", path: "/owner/account", icon: <ManageAccountsIcon /> },
  ];
  const isPendingOwner = approvalStatus === "pending";
  const visibleMenuItems = isPendingOwner
    ? [
        menuItems[0],
        { text: "Property setup", path: "/setup", icon: <HomeWorkIcon /> },
      ]
    : menuItems;

  const isActive = (item) =>
    location.pathname === item.path ||
    (item.aliases || []).includes(location.pathname) ||
    (item.path !== "/owner" && location.pathname.startsWith(item.path + "/"));

  const activeItem = visibleMenuItems.find(isActive);
  // Overview opens with its own "Welcome" heading and is highlighted in the
  // nav, so the bar leaves the title empty there and shows today's date next
  // to the notification bell instead.
  const isOverview = activeItem?.path === "/owner";
  const currentTitle = isOverview ? "" : activeItem?.text || "Dashboard";

  const bottomItems = visibleMenuItems.filter((item) => BOTTOM_NAV_PATHS.includes(item.path));
  const activeBottomIndex = bottomItems.findIndex(isActive);
  // Anything not in the bottom bar (Caretakers, Maintenance, ...) highlights "Menu".
  const bottomValue = activeBottomIndex === -1 ? bottomItems.length : activeBottomIndex;

  const drawer = (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Brand header — same height as the app bar so the divider lines up */}
      <Toolbar sx={{ px: 2.5, height: BAR_H, minHeight: BAR_H }}>
        <Box
          component="img"
          src="/KwartoKeeper-Secondary-Logo.png"
          alt="KwartoKeeper"
          sx={{ display: "block", height: { xs: 34, md: 64 }, maxWidth: "100%", width: "auto", objectFit: "contain" }}
        />
      </Toolbar>
      <Divider />

      {/* Main Navigation Links */}
      <Box sx={{ flexGrow: 1, overflowY: "auto" }}>
        <List sx={{ py: 1.5 }}>
          {visibleMenuItems.map((item) => (
            <ListItem key={item.text} disablePadding>
              <ListItemButton
                selected={isActive(item)}
                onClick={() => {
                  navigate(item.path);
                  setMobileOpen(false);
                }}
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
                <ListItemText
                  primary={item.text}
                  slotProps={{ primary: { sx: { fontWeight: 600 } } }}
                />
              </ListItemButton>
            </ListItem>
          ))}
        </List>
      </Box>

      {/* Bottom Pinned Section with Logout */}
      <Divider />
      <Box sx={{ p: 1.5, pb: "calc(12px + env(safe-area-inset-bottom, 0px))" }}>
        <ListItemButton
          onClick={handleLogout}
          sx={{
            borderRadius: 2,
            color: "error.main",
            "&:hover": { bgcolor: "rgba(211, 47, 47, 0.08)" },
          }}
        >
          <ListItemIcon sx={{ color: "error.main", minWidth: 40 }}>
            <LogoutIcon />
          </ListItemIcon>
          <ListItemText
            primary="Logout"
            slotProps={{ primary: { sx: { fontWeight: 600 } } }}
          />
        </ListItemButton>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: "flex", minHeight: "100vh", bgcolor: (theme) => alpha(theme.palette.background.paper, 0.35) }}>
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
            <NotificationFeed />
          </Box>
        </Toolbar>
      </AppBar>

      <Box component="nav" sx={{ width: { md: drawerWidth }, flexShrink: { md: 0 } }}>
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{ keepMounted: true }}
          sx={{ display: { xs: "block", md: "none" }, "& .MuiDrawer-paper": { boxSizing: "border-box", width: drawerWidth } }}
        >
          {drawer}
        </Drawer>
        <Drawer
          variant="permanent"
          sx={{ display: { xs: "none", md: "block" }, "& .MuiDrawer-paper": { boxSizing: "border-box", width: drawerWidth } }}
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
          onChange={(event, newValue) => {
            if (newValue === bottomItems.length) {
              setMobileOpen(true);
            } else {
              navigate(bottomItems[newValue].path);
            }
          }}
          sx={{ bgcolor: "transparent", height: 64 }}
        >
          {bottomItems.map((item) => (
            <BottomNavigationAction
              key={item.text}
              label={item.text}
              icon={item.icon}
              sx={{ minWidth: 0, "& .MuiBottomNavigationAction-label": { fontWeight: 600 } }}
            />
          ))}
          <BottomNavigationAction
            label="Menu"
            icon={<MenuIcon />}
            sx={{ minWidth: 0, "& .MuiBottomNavigationAction-label": { fontWeight: 600 } }}
          />
        </BottomNavigation>
      </Paper>
    </Box>
  );
}