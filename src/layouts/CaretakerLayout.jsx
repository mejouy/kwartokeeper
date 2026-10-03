import React from "react";
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
import HomeWorkIcon from "@mui/icons-material/HomeWork";
import PeopleAltIcon from "@mui/icons-material/PeopleAlt";
import PaymentIcon from "@mui/icons-material/Payment";
import BuildOutlinedIcon from "@mui/icons-material/BuildOutlined";
import LogoutIcon from "@mui/icons-material/Logout";

import { signOut } from "firebase/auth";
import { auth } from "../config/firebase";

const NAV_ITEMS = [
  { id: "overview", label: "Overview", icon: <DashboardIcon />, path: "/caretaker/overview" },
  { id: "properties", label: "Assigned Property", icon: <HomeWorkIcon />, path: "/caretaker/properties" },
  { id: "tenants", label: "Tenants", icon: <PeopleAltIcon />, path: "/caretaker/tenants" },
  { id: "payments", label: "Payments", icon: <PaymentIcon />, path: "/caretaker/payments" },
  { id: "maintenance", label: "Maintenance", icon: <BuildOutlinedIcon />, path: "/caretaker/maintenance" },
];

export default function CaretakerLayout({ assignedProperty, activeTab, setActiveTab, children }) {
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate("/login");
    } catch (err) {
      console.error("Logout failed:", err);
    }
  };

  // Determine current label based on path or explicit activeTab prop
  const activeNavItem = NAV_ITEMS.find(
    (item) => item.id === activeTab || location.pathname === item.path
  );

  return (
    <Box sx={{ display: "flex", minHeight: "100vh", bgcolor: "#FAFAFA" }}>
      {/* Left Sidebar */}
      <Box
        sx={{
          width: 240,
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
              const isActive =
                activeTab === item.id || location.pathname === item.path;

              return (
                <ListItem key={item.id} disablePadding sx={{ mb: 0.5 }}>
                  <ListItemButton
                    onClick={() => {
                      if (setActiveTab) setActiveTab(item.id);
                      if (item.path) navigate(item.path);
                    }}
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
      <Box sx={{ minWidth: 0, flexGrow: 1, display: "flex", flexDirection: "column" }}>
        {/* Top Header */}
        <Box
          sx={{
            py: 2.5,
            px: 4,
            bgcolor: "#F5EFE6",
            borderBottom: "1px solid #E5DFD5",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <Typography variant="h6" fontWeight="600" sx={{ color: "#2D2D2D" }}>
            {activeNavItem?.label || "Dashboard"}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Caretaker Portal
          </Typography>
        </Box>

        {/* Dynamic Body Content */}
        <Box
          sx={{
            minWidth: 0,
            boxSizing: "border-box",
            px: { xs: 2, sm: 2.5, lg: 3 },
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