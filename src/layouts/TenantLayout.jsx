import React, { useEffect } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  Box,
  Button,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
} from "@mui/material";
import DashboardIcon from "@mui/icons-material/Dashboard";
import AccountCircleOutlinedIcon from "@mui/icons-material/AccountCircleOutlined";
import PaymentIcon from "@mui/icons-material/Payment";
import BuildOutlinedIcon from "@mui/icons-material/BuildOutlined";
import LogoutIcon from "@mui/icons-material/Logout";
import { signOut } from "firebase/auth";
import { auth } from "../config/firebase";

const NAV_ITEMS = [
  { label: "Overview", path: "/tenant/dashboard", icon: <DashboardIcon /> },
  { label: "Tenant Profile", path: "/tenant/profile", icon: <AccountCircleOutlinedIcon /> },
  { label: "Payments", path: "/tenant/payments", icon: <PaymentIcon /> },
  { label: "Maintenance Report", path: "/tenant/maintenance", icon: <BuildOutlinedIcon /> },
];

export default function TenantLayout({ children }) {
  const navigate = useNavigate();
  const location = useLocation();

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
  }, []);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate("/login", { replace: true });
    } catch (error) {
      console.error("Failed to log out:", error);
    }
  };

  const activeNavItem = NAV_ITEMS.find((item) => location.pathname === item.path);

  return (
    <Box
      sx={{
        display: "flex",
        minHeight: "100vh",
        width: "100%",
        bgcolor: "#FAFAFA",
      }}
    >
      {/* Sidebar Navigation */}
      <Box
        component="aside"
        sx={{
          width: { xs: 200, sm: 260 },
          flexShrink: 0,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          bgcolor: "#F5EFE6",
          borderRight: "1px solid #E5DFD5",
        }}
      >
        <Box>
          <Box sx={{ p: 3, pb: 2 }}>
            <Typography variant="h5" fontWeight="700" sx={{ color: "#FF6B35" }}>
              Tenant
            </Typography>
          </Box>
          <List sx={{ px: 0 }}>
            {NAV_ITEMS.map((item) => {
              const selected = location.pathname === item.path;
              return (
                <ListItem key={item.path} disablePadding sx={{ mb: 0.5 }}>
                  <ListItemButton
                    selected={selected}
                    onClick={() => navigate(item.path)}
                    sx={{
                      py: 1.5,
                      px: 3,
                      "&.Mui-selected": { bgcolor: "#FF6B35", color: "#FFFFFF" },
                      "&.Mui-selected .MuiListItemIcon-root": { color: "#FFFFFF" },
                      "&:hover": {
                        bgcolor: selected ? "#FF6B35" : "rgba(255, 107, 53, 0.08)",
                      },
                    }}
                  >
                    <ListItemIcon sx={{ minWidth: 40, color: selected ? "#FFFFFF" : "#5F5F5F" }}>
                      {item.icon}
                    </ListItemIcon>
                    <ListItemText
                      primary={item.label}
                      slotProps={{
                        primary: {
                          sx: {
                            fontWeight: selected ? 600 : 500,
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
        <Box sx={{ p: 2 }}>
          <Button
            onClick={handleLogout}
            startIcon={<LogoutIcon />}
            sx={{
              color: "#FF6B35",
              fontWeight: 600,
              textTransform: "none",
              justifyContent: "flex-start",
              width: "100%",
              px: 2,
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
          flexGrow: 1,
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
          width: "100%",
        }}
      >
        {/* Header */}
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
          }}
        >
          <Typography variant="h6" fontWeight="600" sx={{ color: "#2D2D2D" }}>
            {activeNavItem?.label || "Tenant Portal"}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            KwartoKeeper
          </Typography>
        </Box>

        {/* Content */}
        <Box
          component="main"
          sx={{
            p: { xs: 2, sm: 4 },
            flexGrow: 1,
            bgcolor: "#FFFFFF",
            width: "100%",
            boxSizing: "border-box",
          }}
        >
          {children || <Outlet />}
        </Box>
      </Box>
    </Box>
  );
}