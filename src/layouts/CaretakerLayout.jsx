import React, { useEffect } from "react";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import {
  Box,
  Typography,
  Button,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
} from "@mui/material";

import DashboardIcon from "@mui/icons-material/Dashboard";
import PeopleAltIcon from "@mui/icons-material/PeopleAlt";
import BuildOutlinedIcon from "@mui/icons-material/BuildOutlined";
import LogoutIcon from "@mui/icons-material/Logout";
import NotificationFeed from "../components/NotificationFeed";

import { signOut } from "firebase/auth";
import { auth } from "../config/firebase";

const NAV_ITEMS = [
  { id: "overview", label: "Overview", icon: <DashboardIcon />, sectionId: "caretaker-overview" },
  { id: "tenants", label: "Tenants", icon: <PeopleAltIcon />, sectionId: "caretaker-tenants" },
  { id: "maintenance", label: "Maintenance", icon: <BuildOutlinedIcon />, sectionId: "caretaker-maintenance" },
];

export default function CaretakerLayout({ children }) {
  const navigate = useNavigate();
  const location = useLocation();

  // Override outer #root max-width styling dynamically when layout mounts
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
  }, []);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate("/login");
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };

  const activeNavItem = NAV_ITEMS.find((item) => location.hash === `#${item.sectionId}`) || NAV_ITEMS[0];

  const navigateToSection = (sectionId) => {
    navigate(`/caretaker/dashboard#${sectionId}`);
    document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <Box 
      sx={{ 
        display: "flex", 
        minHeight: "100vh", 
        width: "100%", 
        bgcolor: "#FAFAFA"
      }}
    >
      {/* Left Sidebar */}
      <Box
        component="aside"
        sx={{
          width: { xs: 200, sm: 260 },
          bgcolor: "#F5EFE6",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          borderRight: "1px solid #E5DFD5",
          flexShrink: 0,
        }}
      >
        <Box>
          {/* Logo Header */}
          <Box sx={{ p: 3, pb: 2 }}>
            <Typography
              variant="h5"
              fontWeight="700"
              sx={{ color: "#FF6B35", letterSpacing: -0.5 }}
            >
              Caretaker
            </Typography>
          </Box>

          {/* Navigation Links */}
          <List sx={{ px: 0 }}>
            {NAV_ITEMS.map((item) => {
              const isActive = activeNavItem.sectionId === item.sectionId;

              return (
                <ListItem key={item.id} disablePadding sx={{ mb: 0.5 }}>
                  <ListItemButton
                    onClick={() => navigateToSection(item.sectionId)}
                    sx={{
                      py: 1.5,
                      px: 3,
                      bgcolor: isActive ? "#FF6B35" : "transparent",
                      color: isActive ? "#FFFFFF" : "#4A4A4A",
                      "&:hover": {
                        bgcolor: isActive ? "#FF6B35" : "rgba(255, 107, 53, 0.08)",
                      },
                    }}
                  >
                    <ListItemIcon
                      sx={{
                        color: isActive ? "#FFFFFF" : "#5F5F5F",
                        minWidth: 40,
                      }}
                    >
                      {item.icon}
                    </ListItemIcon>
                    <ListItemText
                      primary={item.label}
                      slotProps={{
                        primary: {
                          sx: {
                            fontWeight: isActive ? 600 : 500,
                            fontSize: "0.95rem",
                          },
                        },
                      }}
                    />
                  </ListItemButton>
                </ListItem>
              );
            })}
          </List>
        </Box>

        {/* Sidebar Footer - Logout */}
        <Box sx={{ p: 2 }}>
          <Button
            onClick={handleLogout}
            startIcon={<LogoutIcon />}
            sx={{
              color: "#FF6B35",
              fontWeight: 600,
              textTransform: "none",
              fontSize: "0.95rem",
              justifyContent: "flex-start",
              px: 2,
              width: "100%",
              "&:hover": {
                bgcolor: "rgba(255, 107, 53, 0.08)",
              },
            }}
          >
            Logout
          </Button>
        </Box>
      </Box>

      {/* Main Content Area */}
      <Box 
        sx={{ 
          minWidth: 0, 
          flexGrow: 1, 
          width: "100%",
          display: "flex", 
          flexDirection: "column" 
        }}
      >
        {/* Top Header */}
        <Box
          component="header"
          sx={{
            py: 2.5,
            px: { xs: 2, sm: 4 },
            bgcolor: "#F5EFE6",
            borderBottom: "1px solid #E5DFD5",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            width: "100%",
            boxSizing: "border-box"
          }}
        >
          <Typography variant="h6" fontWeight="600" sx={{ color: "#2D2D2D" }}>
            {activeNavItem?.label || "Dashboard"}
          </Typography>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Caretaker Portal
            </Typography>
            <NotificationFeed />
          </Box>
        </Box>

        {/* Dynamic Body Content */}
        <Box
          component="main"
          sx={{
            width: "100%",
            boxSizing: "border-box",
            px: { xs: 2, sm: 4 },
            py: { xs: 2, sm: 3 },
            flexGrow: 1,
            bgcolor: "#FFFFFF",
          }}
        >
          {children || <Outlet />}
        </Box>
      </Box>
    </Box>
  );
}