import { useEffect, useState } from "react";
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
  Avatar,
  IconButton,
  Tooltip,
} from "@mui/material";
import DashboardOutlinedIcon from "@mui/icons-material/DashboardOutlined";
import HomeWorkOutlinedIcon from "@mui/icons-material/HomeWorkOutlined";
import PeopleOutlinedIcon from "@mui/icons-material/PeopleOutlined";
import AssignmentIndOutlinedIcon from "@mui/icons-material/AssignmentIndOutlined";
import PaymentsOutlinedIcon from "@mui/icons-material/PaymentsOutlined";
import BuildOutlinedIcon from "@mui/icons-material/BuildOutlined";
import CampaignOutlinedIcon from "@mui/icons-material/CampaignOutlined";
import LogoutIcon from "@mui/icons-material/Logout";
import ManageAccountsOutlinedIcon from "@mui/icons-material/ManageAccountsOutlined";
import AssessmentOutlinedIcon from "@mui/icons-material/AssessmentOutlined";
import AddHomeWorkOutlinedIcon from "@mui/icons-material/AddHomeWorkOutlined";
import HourglassTopRoundedIcon from "@mui/icons-material/HourglassTopRounded";
import MenuIcon from "@mui/icons-material/Menu";
import { alpha } from "@mui/material/styles";
import NotificationFeed from "../components/NotificationFeed";

// Firebase Auth imports
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { auth, db } from "../config/firebase";
import { ownerAccessOf } from "../utils/ownerAccess";

const drawerWidth = 288;
const BAR_H = { xs: 56, md: 72 }; // shared by the top bar and the sidebar header so their dividers line up
const HEAD = '"Inter", sans-serif';
const ACTIVE_BG = "rgba(255, 69, 0, 0.10)";

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

// Sidebar groups. "Overview" sits on its own at the top.
const MENU_GROUPS = [
  {
    heading: null,
    items: [{ text: "Overview", path: "/owner", aliases: ["/owner/dashboard"], icon: <DashboardOutlinedIcon /> }],
  },
  {
    heading: "Manage",
    items: [
      { text: "Properties", path: "/owner/properties", icon: <HomeWorkOutlinedIcon /> },
      { text: "Tenants", path: "/owner/tenants", icon: <PeopleOutlinedIcon /> },
      { text: "Caretakers", path: "/owner/caretakers", icon: <AssignmentIndOutlinedIcon /> },
    ],
  },
  {
    heading: "Money & upkeep",
    items: [
      { text: "Payments", path: "/owner/payments", icon: <PaymentsOutlinedIcon /> },
      { text: "Maintenance", path: "/owner/maintenance", icon: <BuildOutlinedIcon /> },
      { text: "Reports", path: "/owner/reports", icon: <AssessmentOutlinedIcon /> },
    ],
  },
  {
    heading: "Other",
    items: [
      { text: "Announcements", path: "/owner/announcements", icon: <CampaignOutlinedIcon /> },
      { text: "Account", path: "/owner/account", icon: <ManageAccountsOutlinedIcon /> },
    ],
  },
];

// A pending or declined owner can only reach the dashboard, the setup wizard and
// their Account (to upload documents); the route guard sends every other owner
// page back to /owner.
const PENDING_GROUPS = [
  {
    heading: null,
    items: [
      MENU_GROUPS[0].items[0],
      { text: "Property setup", path: "/setup", icon: <AddHomeWorkOutlinedIcon /> },
      { text: "Account", path: "/owner/account", icon: <ManageAccountsOutlinedIcon /> },
    ],
  },
];

const initialsOf = (name) =>
  String(name || "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("") || "O";

export default function OwnerLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [approvalStatus, setApprovalStatus] = useState("loading");
  const [profile, setProfile] = useState({ name: "", email: "" });
  const navigate = useNavigate();
  const location = useLocation();
  const todayLabel = useTodayLabel();

  // Live profile listener, so the menu unlocks the moment an admin approves the
  // account instead of after a reload.
  useEffect(() => {
    let unsubProfile;
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (unsubProfile) unsubProfile();
      unsubProfile = undefined;
      if (!user) {
        setApprovalStatus("");
        return;
      }
      unsubProfile = onSnapshot(
        doc(db, "users", user.uid),
        (snapshot) => {
          const data = snapshot.exists() ? snapshot.data() : {};
          // Same rule as the route guard (pending / rejected / suspended / active)
          setApprovalStatus(ownerAccessOf(data));
          setProfile({
            name: data.fullName || data.name || data.ownerName || user.displayName || "Owner",
            email: data.email || user.email || "",
          });
        },
        (error) => {
          console.error("Failed to load owner approval status:", error);
          setApprovalStatus("");
        }
      );
    });
    return () => {
      unsubscribeAuth();
      if (unsubProfile) unsubProfile();
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

  // While the profile loads, show the short menu so a pending owner never sees
  // the full menu flash up and then disappear.
  const isPendingOwner = approvalStatus === "pending" || approvalStatus === "rejected";
  const isRejectedOwner = approvalStatus === "rejected";
  const isLoadingStatus = approvalStatus === "loading";
  const groups = isPendingOwner || isLoadingStatus ? PENDING_GROUPS : MENU_GROUPS;
  const visibleMenuItems = groups.flatMap((g) => g.items);

  const isActive = (item) =>
    location.pathname === item.path ||
    (item.aliases || []).includes(location.pathname) ||
    (item.path !== "/owner" && location.pathname.startsWith(item.path + "/"));

  const activeItem = visibleMenuItems.find(isActive);
  // Overview opens with its own greeting and is highlighted in the nav, so the
  // bar leaves the title empty there and shows today's date instead.
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
          sx={{ display: "block", height: { xs: 34, md: 44 }, maxWidth: "100%", width: "auto", objectFit: "contain" }}
        />
      </Toolbar>
      <Divider />

      {/* Main navigation */}
      <Box component="nav" aria-label="Owner pages" sx={{ flexGrow: 1, overflowY: "auto", py: 1.5 }}>
        {groups.map((group, gIdx) => (
          <Box key={group.heading || gIdx} sx={{ mt: gIdx ? 1.5 : 0 }}>
            {group.heading && (
              <Typography sx={{ px: 3, pb: 0.5, fontFamily: HEAD, fontSize: 11, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: "text.disabled" }}>
                {group.heading}
              </Typography>
            )}
            <List disablePadding>
              {group.items.map((item) => {
                const selected = isActive(item);
                return (
                  <ListItem key={item.text} disablePadding>
                    <ListItemButton
                      selected={selected}
                      aria-current={selected ? "page" : undefined}
                      onClick={() => {
                        navigate(item.path);
                        setMobileOpen(false);
                      }}
                      sx={{
                        position: "relative",
                        mx: 1.5,
                        my: 0.25,
                        minHeight: 44,
                        borderRadius: "10px",
                        color: "text.secondary",
                        "& .MuiListItemIcon-root": { color: "text.secondary", minWidth: 38 },
                        "&:hover": { bgcolor: "action.hover", color: "text.primary" },
                        "&.Mui-selected": {
                          bgcolor: ACTIVE_BG,
                          color: "primary.main",
                          "&:hover": { bgcolor: "rgba(255, 69, 0, 0.14)" },
                          "& .MuiListItemIcon-root": { color: "primary.main" },
                          "&::before": { content: '""', position: "absolute", left: -12, top: 8, bottom: 8, width: 4, borderRadius: "0 4px 4px 0", bgcolor: "primary.main" },
                        },
                      }}
                    >
                      <ListItemIcon>{item.icon}</ListItemIcon>
                      <ListItemText primary={item.text} slotProps={{ primary: { sx: { fontWeight: selected ? 700 : 600, fontSize: 14.5 } } }} />
                    </ListItemButton>
                  </ListItem>
                );
              })}
            </List>
          </Box>
        ))}

        {isPendingOwner && (
          <Box sx={{ mx: 1.5, mt: 2, p: 1.75, borderRadius: "12px", bgcolor: "rgba(255, 167, 38, 0.10)", border: "1px solid rgba(255, 167, 38, 0.35)", display: "flex", gap: 1.25 }}>
            <HourglassTopRoundedIcon sx={{ fontSize: 20, color: "warning.main", mt: "1px" }} />
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 700 }}>
                {isRejectedOwner ? "Documents declined" : "Pending approval"}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: "block", lineHeight: 1.45 }}>
                {isRejectedOwner
                  ? "Upload new documents from your dashboard or Account. The rest of the menu unlocks once they're approved."
                  : "The rest of the menu unlocks as soon as an admin approves your account."}
              </Typography>
            </Box>
          </Box>
        )}
      </Box>

      {/* Signed-in owner + log out */}
      <Divider />
      <Box sx={{ p: 1.5, pb: "calc(12px + env(safe-area-inset-bottom, 0px))" }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.25, p: 1, borderRadius: "12px", bgcolor: (theme) => alpha(theme.palette.background.paper, 0.6) }}>
          <Avatar sx={{ width: 38, height: 38, bgcolor: "primary.main", color: "#fff", fontFamily: HEAD, fontWeight: 800, fontSize: 14 }}>
            {initialsOf(profile.name)}
          </Avatar>
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Typography variant="body2" noWrap sx={{ fontWeight: 700 }}>
              {profile.name || "Owner"}
            </Typography>
            <Typography variant="caption" color="text.secondary" noWrap sx={{ display: "block" }}>
              {profile.email || "Owner account"}
            </Typography>
          </Box>
          <Tooltip title="Log out">
            <IconButton
              aria-label="Log out"
              onClick={handleLogout}
              sx={{ color: "error.main", flexShrink: 0, "&:hover": { bgcolor: "rgba(211, 47, 47, 0.08)" } }}
            >
              <LogoutIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
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
          bgcolor: "rgba(255, 255, 255, 0.9)",
          backdropFilter: "blur(10px)",
          color: "text.primary",
          borderBottom: "1px solid",
          borderColor: "divider",
          pt: "env(safe-area-inset-top, 0px)",
        }}
      >
        <Toolbar sx={{ height: BAR_H, minHeight: BAR_H, gap: 1.5, px: { xs: 2, sm: 3 } }}>
          {/* Phones: brand mark replaces the (now unneeded) hamburger. The
              drawer opens from "Menu" in the bottom bar. */}
          <Box
            component="img"
            src="/KwartoKeeper-Icon.png"
            alt="KwartoKeeper"
            sx={{ display: { xs: "block", md: "none" }, height: 30, width: 30, flexShrink: 0 }}
          />
          {currentTitle && (
            <Typography
              component="div"
              noWrap
              sx={{ minWidth: 0, fontFamily: HEAD, fontWeight: 800, letterSpacing: "-0.01em", fontSize: { xs: "1.1rem", md: "1.3rem" } }}
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

      <Box sx={{ width: { md: drawerWidth }, flexShrink: { md: 0 } }}>
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{ display: { xs: "block", md: "none" }, "& .MuiDrawer-paper": { boxSizing: "border-box", width: `min(${drawerWidth}px, 86vw)`, borderRadius: "0 20px 20px 0" } }}
        >
          {drawer}
        </Drawer>
        <Drawer
          variant="permanent"
          sx={{ display: { xs: "none", md: "block" }, "& .MuiDrawer-paper": { boxSizing: "border-box", width: drawerWidth, borderRight: "1px solid", borderColor: "divider" } }}
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
          // Safety net: nothing on an owner page can make the whole screen scroll
          // sideways. "clip" (not "hidden") keeps sticky headers inside pages working.
          overflowX: "clip",
          width: { md: `calc(100% - ${drawerWidth}px)` },
          p: { xs: 2, sm: 3 },
          // leave room for the fixed bottom bar (and the iPhone home indicator)
          pb: { xs: "calc(88px + env(safe-area-inset-bottom, 0px))", md: 3 },
        }}
      >
        <Box sx={{ height: BAR_H, mt: "env(safe-area-inset-top, 0px)" }} />
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
          bgcolor: "rgba(255, 255, 255, 0.94)",
          backdropFilter: "blur(10px)",
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
          sx={{
            bgcolor: "transparent",
            height: 66,
            "& .MuiBottomNavigationAction-root": { minWidth: 0, px: 0.5, color: "text.secondary", gap: 0.25 },
            "& .MuiBottomNavigationAction-label": { fontWeight: 600, fontSize: "0.72rem", "&.Mui-selected": { fontSize: "0.72rem", fontWeight: 800 } },
            // pill behind the active icon
            "& .MuiSvgIcon-root": { boxSizing: "content-box", px: 1.75, py: 0.25, borderRadius: 99, transition: "background-color .2s" },
            "& .Mui-selected .MuiSvgIcon-root": { bgcolor: ACTIVE_BG },
            "& .Mui-selected": { color: "primary.main" },
          }}
        >
          {bottomItems.map((item) => (
            <BottomNavigationAction key={item.text} label={item.text} icon={item.icon} />
          ))}
          <BottomNavigationAction label="Menu" icon={<MenuIcon />} />
        </BottomNavigation>
      </Paper>
    </Box>
  );
}
