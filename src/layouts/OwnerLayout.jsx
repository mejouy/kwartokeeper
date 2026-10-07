import React, { useState } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import {
  Box,
  Drawer,
  AppBar,
  Toolbar,
  List,
  Typography,
  Divider,
  IconButton,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
} from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import DashboardIcon from "@mui/icons-material/Dashboard";
import HomeWorkIcon from "@mui/icons-material/HomeWork";
import PeopleIcon from "@mui/icons-material/People";
import AssignmentIndIcon from "@mui/icons-material/AssignmentInd";
import PaymentsIcon from "@mui/icons-material/Payments";
import BuildIcon from "@mui/icons-material/Build";
import CampaignIcon from "@mui/icons-material/Campaign";
import LogoutIcon from "@mui/icons-material/Logout";
import NotificationFeed from "../components/NotificationFeed";

// Firebase Auth imports
import { signOut } from "firebase/auth";
import { auth } from "../config/firebase";

const drawerWidth = 260;

export default function OwnerLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

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
    { text: "Overview", path: "/owner", icon: <DashboardIcon /> },
    { text: "Properties", path: "/owner/properties", icon: <HomeWorkIcon /> },
    { text: "Tenants", path: "/owner/tenants", icon: <PeopleIcon /> },
    { text: "Caretakers", path: "/owner/caretakers", icon: <AssignmentIndIcon /> },
    { text: "Payments", path: "/owner/payments", icon: <PaymentsIcon /> },
    { text: "Maintenance", path: "/owner/maintenance", icon: <BuildIcon /> },
    { text: "Announcements", path: "/owner/announcements", icon: <CampaignIcon /> },
  ];

  const drawer = (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%" }}>
      {/* Top Header */}
      <Toolbar>
        <Typography variant="h6" fontWeight="bold" color="primary">
          Dorm Owner
        </Typography>
      </Toolbar>
      <Divider />

      {/* Main Navigation Links */}
      <Box sx={{ flexGrow: 1, overflowY: "auto" }}>
        <List>
          {menuItems.map((item) => (
            <ListItem key={item.text} disablePadding>
              <ListItemButton
                selected={
                  location.pathname === item.path ||
                  (item.path !== "/owner" && location.pathname.startsWith(item.path + "/"))
                }
                onClick={() => {
                  navigate(item.path);
                  setMobileOpen(false);
                }}
                sx={{
                  "&.Mui-selected": { bgcolor: "primary.light", color: "primary.main" },
                  "&.Mui-selected .MuiListItemIcon-root": { color: "primary.main" },
                }}
              >
                <ListItemIcon>{item.icon}</ListItemIcon>
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
      <Box sx={{ p: 2 }}>
        <ListItemButton
          onClick={handleLogout}
          sx={{
            borderRadius: 1,
            color: "error.main",
            "&:hover": {
              bgcolor: "error.lighter",
              color: "error.dark",
            },
          }}
        >
          <ListItemIcon sx={{ color: "error.main" }}>
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
    <Box sx={{ display: "flex", minHeight: "100vh", bgcolor: "background.default" }}>
      <AppBar
        position="fixed"
        sx={{
          width: { sm: `calc(100% - ${drawerWidth}px)` },
          ml: { sm: `${drawerWidth}px` },
          bgcolor: "background.paper",
          color: "text.primary",
          boxShadow: 1,
        }}
      >
        <Toolbar>
          <IconButton color="inherit" edge="start" onClick={handleDrawerToggle} sx={{ mr: 2, display: { sm: "none" } }}>
            <MenuIcon />
          </IconButton>
          
          <Typography variant="h6" noWrap component="div" fontWeight="600">
            {menuItems.find((item) =>
              location.pathname === item.path ||
              (item.path !== "/owner" && location.pathname.startsWith(item.path + "/"))
            )?.text || "Dashboard"}
          </Typography>
          <Box sx={{ ml: "auto" }}>
            <NotificationFeed />
          </Box>
        </Toolbar>
      </AppBar>

      <Box component="nav" sx={{ width: { sm: drawerWidth }, flexShrink: { sm: 0 } }}>
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{ keepMounted: true }}
          sx={{ display: { xs: "block", sm: "none" }, "& .MuiDrawer-paper": { boxSizing: "border-box", width: drawerWidth } }}
        >
          {drawer}
        </Drawer>
        <Drawer
          variant="permanent"
          sx={{ display: { xs: "none", sm: "block" }, "& .MuiDrawer-paper": { boxSizing: "border-box", width: drawerWidth } }}
          open
        >
          {drawer}
        </Drawer>
      </Box>

      <Box component="main" sx={{ flexGrow: 1, p: 3, width: { sm: `calc(100% - ${drawerWidth}px)` }, mt: 8 }}>
        <Outlet />
      </Box>
    </Box>
  );
}