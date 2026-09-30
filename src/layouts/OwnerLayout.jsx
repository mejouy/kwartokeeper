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

const drawerWidth = 260;

export default function OwnerLayout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const handleDrawerToggle = () => {
    setMobileOpen(!mobileOpen);
  };

  const menuItems = [
    { text: "Overview", path: "/owner", icon: <DashboardIcon /> },
    { text: "Properties", path: "/owner/properties", icon: <HomeWorkIcon /> },
    { text: "Tenants", path: "/owner/tenants", icon: <PeopleIcon /> },
    { text: "Caretakers", path: "/owner/caretakers", icon: <AssignmentIndIcon /> },
    { text: "Payments", path: "/owner/payments", icon: <PaymentsIcon /> },
    { text: "Maintenance", path: "/owner/maintenance", icon: <BuildIcon /> },
  ];

  const drawer = (
    <div>
      <Toolbar>
        <Typography variant="h6" fontWeight="bold" color="primary">
          DormAdmin
        </Typography>
      </Toolbar>
      <Divider />
      <List>
        {menuItems.map((item) => (
          <ListItem key={item.text} disablePadding>
            <ListItemButton
              selected={location.pathname === item.path || location.pathname.startsWith(item.path + "/")}
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
              <ListItemText primary={item.text} primaryTypographyProps={{ fontWeight: 600 }} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
    </div>
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
            {menuItems.find((item) => location.pathname === item.path || location.pathname.startsWith(item.path + "/"))?.text || "Dashboard"}
          </Typography>
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
        {/* This Outlet will render OwnerOverview, PropertyList, TenantList, etc. based on the URL */}
        <Outlet />
      </Box>
    </Box>
  );
}