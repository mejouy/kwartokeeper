import React, { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import HistoryIcon from "@mui/icons-material/History";
import CloseIcon from "@mui/icons-material/Close";
import {
  Box, Drawer, AppBar,
  Toolbar,
  List,
  Typography,
  Divider,
  IconButton,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Avatar,
  Badge,
  Container,
  Grid,
  Card,
  CardContent,
  Button,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  LinearProgress,
  Stack,
  TextField,
  InputAdornment,
  Tooltip,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
} from "@mui/material";

// MUI Icons
import MenuIcon from "@mui/icons-material/Menu";
import DashboardIcon from "@mui/icons-material/DashboardOutlined";
import HomeWorkIcon from "@mui/icons-material/HomeWorkOutlined";
import PeopleIcon from "@mui/icons-material/PeopleAltOutlined";
import CaretakerIcon from "@mui/icons-material/SupervisorAccountOutlined";
import PaymentIcon from "@mui/icons-material/PaymentsOutlined";
import BuildOutlinedIcon from "@mui/icons-material/BuildOutlined";
import NotificationsIcon from "@mui/icons-material/NotificationsNone";
import AddIcon from "@mui/icons-material/Add";
import SearchIcon from "@mui/icons-material/Search";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import GroupAddIcon from "@mui/icons-material/GroupAdd";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";
import EditOutlinedIcon from "@mui/icons-material/EditOutlined";
import LogoutIcon from "@mui/icons-material/Logout";
import AttachMoneyIcon from "@mui/icons-material/AttachMoney";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import MailOutlinedIcon from "@mui/icons-material/MailOutlined";
import FormatListNumberedIcon from "@mui/icons-material/FormatListNumbered";

import {
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  updateDoc,
  doc,
  serverTimestamp,
  getDocs,
} from "firebase/firestore";
import { db } from "../../config/firebase";
import { useAuth } from "../../context/AuthContext";

const DRAWER_WIDTH = 260;

const NAV_ITEMS = [
  { label: "Overview", icon: <DashboardIcon />, id: "overview" },
  { label: "Properties & Rooms", icon: <HomeWorkIcon />, id: "properties" },
  { label: "Tenants Directory", icon: <PeopleIcon />, id: "tenants" },
  { label: "Payments & Rent", icon: <PaymentIcon />, id: "payments" },
  { label: "Caretakers", icon: <CaretakerIcon />, id: "caretakers" },
  { label: "Maintenance & Repairs", icon: <BuildOutlinedIcon />, id: "maintenance" },
];

export default function OwnerDashboard() {
  const { currentUser, logout } = useAuth() || {};
  const navigate = useNavigate();

  // Navigation & UI States
  const [activeTab, setActiveTab] = useState("overview");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Firestore Realtime Collections State
  const [properties, setProperties] = useState([]);
  const [tenants, setTenants] = useState([]);
  const [caretakers, setCaretakers] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);

  // Dialog States
  const [openNewTicketModal, setOpenNewTicketModal] = useState(false);
const [selectedTicket, setSelectedTicket] = useState(null);
const [openUpdateTicketModal, setOpenUpdateTicketModal] = useState(false);
const [openRecordPaymentModal, setOpenRecordPaymentModal] = useState(false);

const [selectedTenant, setSelectedTenant] = useState(null);
const [openTenantPaymentHistory, setOpenTenantPaymentHistory] = useState(false);

  // Maintenance Ticket Forms
  const [newTicket, setNewTicket] = useState({
    title: "",
    category: "Plumbing",
    propertyId: "",
    roomNumber: "",
    reportedBy: "",
    priority: "Medium",
    description: "",
    assignedCaretakerId: "",
  });

  const [updateTicketForm, setUpdateTicketForm] = useState({
    status: "Pending",
    assignedCaretakerId: "",
    resolutionNotes: "",
  });

  // Record Payment Form
  const [newPayment, setNewPayment] = useState({
  tenantId: "",
  propertyId: "",
  roomNumber: "",
  amount: "",
  paymentMethod: "GCash",
  periodMonth: new Date().toLocaleString("en-US", {
    month: "long",
    year: "numeric",
  }),
  status: "Paid",
  remarks: "",
});

  const handleDrawerToggle = () => setMobileOpen(!mobileOpen);

  const handleLogout = async () => {
    if (logout) await logout();
    navigate("/login");
  };

  // Real-Time Firebase Subscriptions
  useEffect(() => {
    if (!currentUser?.uid) {
      setLoading(false);
      return;
    }

    const uid = currentUser.uid;

    const qProps = query(collection(db, "properties"), where("ownerUid", "==", uid));
    const unsubProps = onSnapshot(qProps, (snap) => setProperties(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));

    const mergeOwnerUsers = (rows) => {
      const byId = new Map();
      rows.forEach((row) => {
        const key = row.uid || row.id;
        if (!key) return;

        const normalized = {
          ...row,
          id: row.id || row.uid || key,
          fullName: row.fullName || row.name || "",
          name: row.name || row.fullName || "",
          status: row.status || "Active",
          propertyName: row.propertyName || "Dormitory",
          roomNumber: row.roomNumber || row.roomId || "",
        };

        if (!byId.has(key)) {
          byId.set(key, normalized);
        }
      });

      return [...byId.values()];
    };

    const loadOwnerLists = async () => {
      try {
        const [allUsersSnap, tenantLegacySnap, caretakerLegacySnap, ownerPropertiesSnap] = await Promise.all([
          getDocs(collection(db, "users")),
          getDocs(collection(db, "tenants")),
          getDocs(collection(db, "caretakers")),
          getDocs(query(collection(db, "properties"), where("ownerUid", "==", uid))),
        ]);

        const allUsers = allUsersSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
        const ownerPropertyIds = new Set(ownerPropertiesSnap.docs.map((d) => d.id));

        const isOwnerLinkedUser = (row) => {
          const propertyId = row.propertyId || row.assignedPropertyId || row.property_id;
          return (
            row.ownerUid === uid ||
            row.invitedBy === uid ||
            row.ownerId === uid ||
            ownerPropertyIds.has(propertyId) ||
            ownerPropertyIds.has(row.propertyId) ||
            ownerPropertyIds.has(row.assignedPropertyId)
          );
        };

        const tenantRows = mergeOwnerUsers([
          ...allUsers.filter((user) => user.role === "tenant" && isOwnerLinkedUser(user)),
          ...tenantLegacySnap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((row) => isOwnerLinkedUser(row)),
        ]);

        const caretakerRows = mergeOwnerUsers([
          ...allUsers.filter((user) => user.role === "caretaker" && isOwnerLinkedUser(user)),
          ...caretakerLegacySnap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((row) => isOwnerLinkedUser(row)),
        ]);

        setTenants(tenantRows);
        setCaretakers(caretakerRows);
      } catch (err) {
        console.error("Failed to load owner lists:", err);
      }
    };

    loadOwnerLists();

    const qTickets = query(collection(db, "maintenance_tickets"), where("ownerUid", "==", uid));
    const unsubTickets = onSnapshot(qTickets, (snap) => setTickets(snap.docs.map((d) => ({ id: d.id, ...d.data() }))));

    const qPayments = query(collection(db, "payments"), where("ownerUid", "==", uid));
    const unsubPayments = onSnapshot(qPayments, (snap) => {
      setPayments(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });

    return () => {
      unsubProps();
      unsubTickets();
      unsubPayments();
    };
  }, [currentUser?.uid]);

  // Overall Calculated Aggregations
  const stats = useMemo(() => {
    const totalBeds = properties.reduce((acc, p) => acc + (Number(p.totalBeds) || 0), 0);
    const occupiedBeds = properties.reduce((acc, p) => acc + (Number(p.occupiedBeds) || 0), 0);
    const occupancyRate = totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0;
    const totalRevenue = properties.reduce((acc, p) => acc + (Number(p.monthlyRevenue) || Number(p.estimatedRevenue) || 0), 0);

    const pendingTenants = tenants.filter((t) => t.status === "Pending Onboarding" || !t.roomNumber).length;
    const activeTenants = tenants.filter((t) => t.status === "Active").length;

    const pendingMaintenance = tickets.filter((t) => t.status === "Pending").length;
    const urgentMaintenance = tickets.filter((t) => t.priority === "Urgent" && t.status !== "Resolved").length;

    const collectedThisMonth = payments
      .filter((p) => p.status === "Paid")
      .reduce((acc, p) => acc + (Number(p.amount) || 0), 0);

    const pendingPaymentsCount = payments.filter((p) => p.status === "Pending" || p.status === "Overdue").length;

    return {
      totalProperties: properties.length,
      totalBeds,
      occupiedBeds,
      occupancyRate,
      totalRevenue,
      totalTenants: tenants.length,
      activeTenants,
      pendingTenants,
      totalCaretakers: caretakers.length,
      pendingMaintenance,
      urgentMaintenance,
      collectedThisMonth,
      pendingPaymentsCount,
    };
  }, [properties, tenants, caretakers, tickets, payments]);

  // Handler: Log Maintenance Request
  const handleCreateTicket = async () => {
    if (!newTicket.title || !newTicket.propertyId || !newTicket.roomNumber) {
      alert("Please enter Title, Property, and Room Number.");
      return;
    }

    try {
      const selectedProp = properties.find((p) => p.id === newTicket.propertyId);
      const selectedCare = caretakers.find((c) => c.id === newTicket.assignedCaretakerId);

      await addDoc(collection(db, "maintenance_tickets"), {
        ...newTicket,
        ownerUid: currentUser.uid,
        propertyName: selectedProp?.propertyName || selectedProp?.name || "Dormitory",
        assignedCaretakerName: selectedCare?.name || "Unassigned",
        status: "Pending",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setOpenNewTicketModal(false);
      setNewTicket({
        title: "",
        category: "Plumbing",
        propertyId: "",
        roomNumber: "",
        reportedBy: "",
        priority: "Medium",
        description: "",
        assignedCaretakerId: "",
      });
    } catch (err) {
      console.error("Error creating maintenance ticket:", err);
      alert("Failed to record maintenance ticket.");
    }
  };

  // Handler: Record Tenant Payment
 const handleRecordPayment = async () => {
  if (!newPayment.tenantId || !newPayment.amount) {
    alert("Please select a Tenant and enter the Amount.");
    return;
  }

  const amount = Number(newPayment.amount);

  if (amount <= 0) {
    alert("Payment amount must be greater than ₱0.");
    return;
  }

  try {
    const selectedTenant = tenants.find(
      (t) => t.id === newPayment.tenantId
    );

    if (!selectedTenant) {
      alert("Selected tenant could not be found.");
      return;
    }

    // Automatically get the tenant's property
    const selectedProp = properties.find(
      (p) => p.id === selectedTenant.propertyId
    );

    // Automatically get room information from tenant
    const roomNumber =
      selectedTenant.roomNumber ||
      selectedTenant.roomId ||
      newPayment.roomNumber ||
      "N/A";

    // Check whether this tenant already has a payment
    // for the selected billing period
    const existingPayment = payments.find(
      (p) =>
        p.tenantId === selectedTenant.id &&
        p.periodMonth === newPayment.periodMonth
    );

    if (existingPayment) {
      const confirmDuplicate = window.confirm(
        `${selectedTenant.fullName || selectedTenant.name} already has a payment recorded for ${newPayment.periodMonth}.\n\nDo you want to record another payment?`
      );

      if (!confirmDuplicate) {
        return;
      }
    }

    await addDoc(collection(db, "payments"), {
      tenantId: selectedTenant.id,

      // Automatically saved from tenant information
      tenantName:
        selectedTenant.fullName ||
        selectedTenant.name ||
        "Tenant",

      propertyId:
        selectedTenant.propertyId ||
        newPayment.propertyId ||
        "",

      propertyName:
        selectedProp?.propertyName ||
        selectedProp?.name ||
        selectedTenant.propertyName ||
        "Dormitory",

      roomNumber,

      // Payment information entered by owner
      amount,
      paymentMethod: newPayment.paymentMethod,
      periodMonth: newPayment.periodMonth,
      status: newPayment.status,
      remarks: newPayment.remarks,

      // Owner/account information
      ownerUid: currentUser.uid,

      // Timestamps
      paymentDate: serverTimestamp(),
      createdAt: serverTimestamp(),
    });

    alert("Payment recorded successfully.");

    // Close modal
    setOpenRecordPaymentModal(false);

    // Reset form
    setNewPayment({
      tenantId: "",
      propertyId: "",
      roomNumber: "",
      amount: "",
      paymentMethod: "GCash",
      periodMonth: new Date().toLocaleString("en-US", {
        month: "long",
        year: "numeric",
      }),
      status: "Paid",
      remarks: "",
    });

  } catch (err) {
    console.error("Error logging payment:", err);
    alert("Failed to record payment.");
  }
};

  // Handler: Update Ticket Status
  const handleSaveTicketUpdate = async () => {
    if (!selectedTicket) return;

    try {
      const selectedCare = caretakers.find((c) => c.id === updateTicketForm.assignedCaretakerId);

      await updateDoc(doc(db, "maintenance_tickets", selectedTicket.id), {
        status: updateTicketForm.status,
        assignedCaretakerId: updateTicketForm.assignedCaretakerId,
        assignedCaretakerName: selectedCare?.name || (updateTicketForm.assignedCaretakerId ? "Assigned" : "Unassigned"),
        resolutionNotes: updateTicketForm.resolutionNotes,
        updatedAt: serverTimestamp(),
      });

      setOpenUpdateTicketModal(false);
      setSelectedTicket(null);
    } catch (err) {
      console.error("Error updating ticket:", err);
      alert("Failed to update ticket.");
    }
  };

  // Sidebar Component
  const sidebarContent = (
    <Box sx={{ display: "flex", flexDirection: "column", height: "100%", bgcolor: "#111827", color: "#f9fafb" }}>
      <Box sx={{ p: 2.5, display: "flex", alignItems: "center", gap: 1.5 }}>
        <Avatar sx={{ bgcolor: "primary.main", fontWeight: 800, width: 38, height: 38 }}>
          K
        </Avatar>
        <Box>
          <Typography variant="subtitle1" fontWeight="800" sx={{ lineHeight: 1.1 }}>
            KwartoKeeper
          </Typography>
          <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.5)", fontWeight: 500 }}>
            Property Owner Portal
          </Typography>
        </Box>
      </Box>

      <Divider sx={{ borderColor: "rgba(255,255,255,0.08)" }} />

      <Box sx={{ flex: 1, px: 1.5, py: 2 }}>
        <Typography variant="caption" sx={{ px: 1.5, color: "rgba(255,255,255,0.4)", fontWeight: 600, fontSize: "0.7rem", letterSpacing: 0.8, textTransform: "uppercase" }}>
          Navigation
        </Typography>
        <List sx={{ mt: 1 }}>
          {NAV_ITEMS.map((item) => {
            const isSelected = activeTab === item.id;
            const badgeCount =
              item.id === "tenants"
                ? stats.pendingTenants
                : item.id === "maintenance"
                ? stats.pendingMaintenance
                : item.id === "payments"
                ? stats.pendingPaymentsCount
                : 0;

            return (
              <ListItem key={item.id} disablePadding sx={{ mb: 0.5 }}>
                <ListItemButton
                  selected={isSelected}
                  onClick={() => {
                    setActiveTab(item.id);
                    setMobileOpen(false);
                  }}
                  sx={{
                    borderRadius: "8px",
                    py: 1,
                    px: 1.5,
                    color: isSelected ? "#ffffff" : "rgba(255,255,255,0.65)",
                    bgcolor: isSelected ? "primary.main" : "transparent",
                    "&:hover": { bgcolor: isSelected ? "primary.main" : "rgba(255,255,255,0.06)", color: "#ffffff" },
                    "&.Mui-selected": { bgcolor: "primary.main", "&:hover": { bgcolor: "primary.dark" } },
                  }}
                >
                  <ListItemIcon sx={{ color: "inherit", minWidth: 36 }}>{item.icon}</ListItemIcon>
                  <ListItemText
                    primary={
                      <Typography variant="body2" sx={{ fontSize: "0.875rem", fontWeight: isSelected ? 700 : 500 }}>
                        {item.label}
                      </Typography>
                    }
                  />
                  {badgeCount > 0 && (
                    <Chip
                      label={badgeCount}
                      size="small"
                      color={item.id === "maintenance" ? "error" : "warning"}
                      sx={{ height: 18, fontSize: "0.65rem", fontWeight: 800 }}
                    />
                  )}
                </ListItemButton>
              </ListItem>
            );
          })}
        </List>
      </Box>

      <Divider sx={{ borderColor: "rgba(255,255,255,0.08)" }} />
      <Box sx={{ p: 2, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <Avatar sx={{ width: 34, height: 34, bgcolor: "rgba(255,255,255,0.15)", fontSize: "0.875rem" }}>
            {currentUser?.displayName?.[0] || currentUser?.email?.[0] || "O"}
          </Avatar>
          <Box sx={{ maxWidth: 130 }}>
            <Typography variant="body2" fontWeight="700" noWrap>
              {currentUser?.displayName || "Property Owner"}
            </Typography>
            <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.5)", display: "block" }} noWrap>
              {currentUser?.email}
            </Typography>
          </Box>
        </Box>
        <IconButton size="small" onClick={handleLogout} sx={{ color: "rgba(255,255,255,0.5)", "&:hover": { color: "#ff4500" } }}>
          <LogoutIcon fontSize="small" />
        </IconButton>
      </Box>
    </Box>
  );

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh" }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ display: "flex", minHeight: "100vh", bgcolor: "#f9fafb" }}>
      {/* Header Bar - Pure Notification & User Avatar */}
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          width: { sm: `calc(100% - ${DRAWER_WIDTH}px)` },
          ml: { sm: `${DRAWER_WIDTH}px` },
          bgcolor: "background.paper",
          color: "text.primary",
          borderBottom: "1px solid",
          borderColor: "divider",
        }}
      >
        <Toolbar sx={{ justifyContent: "space-between" }}>
          <IconButton color="inherit" edge="start" onClick={handleDrawerToggle} sx={{ mr: 2, display: { sm: "none" } }}>
            <MenuIcon />
          </IconButton>

          <Typography variant="h6" fontWeight="700">
            {NAV_ITEMS.find((i) => i.id === activeTab)?.label || "Owner Dashboard"}
          </Typography>

          <Stack direction="row" spacing={1.5} alignItems="center">
            <Tooltip title="Notifications">
              <IconButton size="medium">
                <Badge badgeContent={stats.urgentMaintenance + stats.pendingTenants} color="error">
                  <NotificationsIcon />
                </Badge>
              </IconButton>
            </Tooltip>
            <Avatar sx={{ width: 32, height: 32, bgcolor: "primary.main", fontSize: "0.85rem" }}>
              {currentUser?.displayName?.[0] || "O"}
            </Avatar>
          </Stack>
        </Toolbar>
      </AppBar>

      {/* Drawer */}
      <Box component="nav" sx={{ width: { sm: DRAWER_WIDTH }, flexShrink: { sm: 0 } }}>
        <Drawer variant="temporary" open={mobileOpen} onClose={handleDrawerToggle} sx={{ display: { xs: "block", sm: "none" }, "& .MuiDrawer-paper": { width: DRAWER_WIDTH } }}>
          {sidebarContent}
        </Drawer>
        <Drawer variant="permanent" sx={{ display: { xs: "none", sm: "block" }, "& .MuiDrawer-paper": { width: DRAWER_WIDTH, borderRight: "1px solid rgba(0,0,0,0.08)" } }} open>
          {sidebarContent}
        </Drawer>
      </Box>

      {/* Main Workspace */}
      <Box component="main" sx={{ flexGrow: 1, p: { xs: 2, sm: 4 }, width: { sm: `calc(100% - ${DRAWER_WIDTH}px)` }, mt: 8 }}>
        {activeTab === "overview" && (
          <OverviewTab
            stats={stats}
            properties={properties}
            tenants={tenants}
            tickets={tickets}
            payments={payments}
            navigate={navigate}
            setSelectedTicket={setSelectedTicket}
            setOpenUpdateTicketModal={setOpenUpdateTicketModal}
            setUpdateTicketForm={setUpdateTicketForm}
            setOpenRecordPaymentModal={setOpenRecordPaymentModal}
          />
        )}

        {activeTab === "properties" && (
          <PropertiesTab properties={properties} navigate={navigate} />
        )}

       {activeTab === "tenants" && (
  <TenantsTab
    tenants={tenants}
    payments={payments}
    navigate={navigate}
    searchQuery={searchQuery}
    setSearchQuery={setSearchQuery}
    setSelectedTenant={setSelectedTenant}
    setOpenTenantPaymentHistory={setOpenTenantPaymentHistory}
  />
)}

        {activeTab === "payments" && (
          <PaymentsTab
            payments={payments}
            stats={stats}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            setOpenRecordPaymentModal={setOpenRecordPaymentModal}
          />
        )}

        {activeTab === "caretakers" && (
          <CaretakersTab caretakers={caretakers} navigate={navigate} />
        )}

        {activeTab === "maintenance" && (
          <MaintenanceTab
            tickets={tickets}
            setSelectedTicket={setSelectedTicket}
            setOpenUpdateTicketModal={setOpenUpdateTicketModal}
            setUpdateTicketForm={setUpdateTicketForm}
            setOpenNewTicketModal={setOpenNewTicketModal}
          />
        )}
      </Box>

      {/* DIALOG: Record Tenant Payment */}
      <Dialog open={openRecordPaymentModal} onClose={() => setOpenRecordPaymentModal(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>Record Tenant Payment</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2.5} sx={{ pt: 1 }}>
            <FormControl fullWidth>
  <InputLabel>Tenant</InputLabel>

  <Select
    value={newPayment.tenantId}
    label="Tenant"
    onChange={(e) => {
      const selectedTenant = tenants.find(
        (t) => t.id === e.target.value
      );

      setNewPayment({
        ...newPayment,
        tenantId: e.target.value,

        // Automatically get these from the tenant
        propertyId: selectedTenant?.propertyId || "",
        roomNumber:
          selectedTenant?.roomNumber ||
          selectedTenant?.roomId ||
          "",
      });
    }}
  >
    {tenants.map((tenant) => (
      <MenuItem key={tenant.id} value={tenant.id}>
        {tenant.fullName || tenant.name || "Unnamed Tenant"}
      </MenuItem>
    ))}
  </Select>
</FormControl>

{newPayment.tenantId && (() => {
  const selectedTenant = tenants.find(
    (t) => t.id === newPayment.tenantId
  );

  const selectedProperty = properties.find(
    (p) => p.id === selectedTenant?.propertyId
  );

  const tenantPayments = payments.filter(
    (p) => p.tenantId === newPayment.tenantId
  );

  const lastPayment = [...tenantPayments]
    .sort((a, b) => {
      const dateA = a.paymentDate?.seconds || 0;
      const dateB = b.paymentDate?.seconds || 0;
      return dateB - dateA;
    })[0];

  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2,
        borderRadius: 2,
        bgcolor: "background.default",
      }}
    >
      <Typography
        variant="subtitle2"
        fontWeight="700"
        sx={{ mb: 1.5 }}
      >
        Tenant Information
      </Typography>

      <Stack spacing={0.75}>
        <Typography variant="body2">
          <strong>Property:</strong>{" "}
          {selectedProperty?.propertyName ||
            selectedProperty?.name ||
            selectedTenant?.propertyName ||
            "Dormitory"}
        </Typography>

        <Typography variant="body2">
          <strong>Room:</strong>{" "}
          {selectedTenant?.roomNumber ||
            selectedTenant?.roomId ||
            "Unassigned"}
        </Typography>

        <Typography variant="body2">
          <strong>Previous Payments:</strong>{" "}
          {tenantPayments.length}
        </Typography>

        <Typography variant="body2">
          <strong>Last Payment:</strong>{" "}
          {lastPayment
            ? `₱${Number(
                lastPayment.amount || 0
              ).toLocaleString()}`
            : "No payment recorded"}
        </Typography>
      </Stack>
    </Paper>
  );
})()}

            <Grid container spacing={2}>
              <Grid size={{ xs: 6 }}>
                <TextField
                  label="Amount Paid"
                  type="number"
                  fullWidth
                  value={newPayment.amount}
                  InputProps={{ startAdornment: <InputAdornment position="start">₱</InputAdornment> }}
                  onChange={(e) => setNewPayment({ ...newPayment, amount: e.target.value })}
                />
              </Grid>

              <Grid size={{ xs: 6 }}>
                <FormControl fullWidth>
                  <InputLabel>Payment Method</InputLabel>
                  <Select
                    value={newPayment.paymentMethod}
                    label="Payment Method"
                    onChange={(e) => setNewPayment({ ...newPayment, paymentMethod: e.target.value })}
                  >
                    <MenuItem value="GCash">GCash</MenuItem>
                    <MenuItem value="Cash">Cash</MenuItem>
                    <MenuItem value="Bank Transfer">Bank Transfer</MenuItem>
                    <MenuItem value="Maya">Maya</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            </Grid>

            <Grid container spacing={2}>
              <Grid size={{ xs: 6 }}>
                <TextField
                  label="Billing Period"
                  placeholder="e.g., September 2026"
                  fullWidth
                  value={newPayment.periodMonth}
                  onChange={(e) => setNewPayment({ ...newPayment, periodMonth: e.target.value })}
                />
              </Grid>

              <Grid size={{ xs: 6 }}>
                <FormControl fullWidth>
                  <InputLabel>Payment Status</InputLabel>
                  <Select
                    value={newPayment.status}
                    label="Payment Status"
                    onChange={(e) => setNewPayment({ ...newPayment, status: e.target.value })}
                  >
                    <MenuItem value="Paid">Paid (Completed)</MenuItem>
                    <MenuItem value="Pending">Pending Validation</MenuItem>
                    <MenuItem value="Overdue">Overdue</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            </Grid>

            <TextField
              label="Reference # / Remarks"
              placeholder="e.g. GCash Ref # 100239401"
              fullWidth
              value={newPayment.remarks}
              onChange={(e) => setNewPayment({ ...newPayment, remarks: e.target.value })}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2.5 }}>
          <Button onClick={() => setOpenRecordPaymentModal(false)}>Cancel</Button>
          <Button variant="contained" color="success" onClick={handleRecordPayment}>
            Record Payment
          </Button>
        </DialogActions>
      </Dialog>

      {/* DIALOG: Tenant Payment History */}
{selectedTenant && (
  <Dialog
    open={openTenantPaymentHistory}
    onClose={() => {
      setOpenTenantPaymentHistory(false);
      setSelectedTenant(null);
    }}
    maxWidth="md"
    fullWidth
  >
    <DialogTitle
      sx={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        fontWeight: 800,
      }}
    >
      <Box>
        <Typography variant="h6" fontWeight="800">
          {selectedTenant.fullName || selectedTenant.name}
        </Typography>

        <Typography variant="body2" color="text.secondary">
          {selectedTenant.propertyName || "Dormitory"}
          {selectedTenant.roomNumber
            ? ` — Room ${selectedTenant.roomNumber}`
            : ""}
        </Typography>
      </Box>

      <IconButton
        onClick={() => {
          setOpenTenantPaymentHistory(false);
          setSelectedTenant(null);
        }}
      >
        <CloseIcon />
      </IconButton>
    </DialogTitle>

    <DialogContent dividers>
      {(() => {
        const tenantPayments = payments
          .filter(
            (p) =>
              p.tenantId === selectedTenant.id ||
              (
                p.tenantName &&
                (
                  p.tenantName === selectedTenant.fullName ||
                  p.tenantName === selectedTenant.name
                )
              )
          )
          .sort((a, b) => {
            const dateA = a.paymentDate?.seconds
              ? a.paymentDate.seconds
              : a.createdAt?.seconds || 0;

            const dateB = b.paymentDate?.seconds
              ? b.paymentDate.seconds
              : b.createdAt?.seconds || 0;

            return dateB - dateA;
          });

        const lastPayment = tenantPayments[0];

        const totalPaid = tenantPayments
          .filter((p) => p.status === "Paid")
          .reduce(
            (total, p) => total + (Number(p.amount) || 0),
            0
          );

        const formatDate = (payment) => {
          const timestamp =
            payment?.paymentDate || payment?.createdAt;

          if (!timestamp) return "No date";

          try {
            const date = timestamp.toDate
              ? timestamp.toDate()
              : new Date(timestamp.seconds * 1000);

            return date.toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            });
          } catch {
            return "No date";
          }
        };

        return (
          <Box>
            {/* SUMMARY */}
            <Grid container spacing={2} sx={{ mb: 3 }}>
              <Grid size={{ xs: 12, sm: 4 }}>
                <Card
                  elevation={0}
                  sx={{
                    border: "1px solid",
                    borderColor: "divider",
                    borderRadius: 2,
                  }}
                >
                  <CardContent>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      fontWeight="600"
                    >
                      Last Payment
                    </Typography>

                    <Typography
                      variant="h5"
                      fontWeight="800"
                      color="success.main"
                    >
                      {lastPayment
                        ? `₱${Number(
                            lastPayment.amount || 0
                          ).toLocaleString()}`
                        : "₱0"}
                    </Typography>

                    <Typography
                      variant="caption"
                      color="text.secondary"
                    >
                      {lastPayment?.periodMonth || "No payment"}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>

              <Grid size={{ xs: 12, sm: 4 }}>
                <Card
                  elevation={0}
                  sx={{
                    border: "1px solid",
                    borderColor: "divider",
                    borderRadius: 2,
                  }}
                >
                  <CardContent>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      fontWeight="600"
                    >
                      Total Payments
                    </Typography>

                    <Typography variant="h5" fontWeight="800">
                      {tenantPayments.length}
                    </Typography>

                    <Typography
                      variant="caption"
                      color="text.secondary"
                    >
                      Payment records
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>

              <Grid size={{ xs: 12, sm: 4 }}>
                <Card
                  elevation={0}
                  sx={{
                    border: "1px solid",
                    borderColor: "divider",
                    borderRadius: 2,
                  }}
                >
                  <CardContent>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      fontWeight="600"
                    >
                      Total Paid
                    </Typography>

                    <Typography
                      variant="h5"
                      fontWeight="800"
                      color="primary.main"
                    >
                      ₱{totalPaid.toLocaleString()}
                    </Typography>

                    <Typography
                      variant="caption"
                      color="text.secondary"
                    >
                      Completed payments
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>

            {/* HISTORY TABLE */}
            <Typography
              variant="subtitle1"
              fontWeight="800"
              sx={{ mb: 1.5 }}
            >
              Payment History
            </Typography>

            <TableContainer>
              <Table>
                <TableHead sx={{ bgcolor: "background.default" }}>
                  <TableRow>
                    <TableCell>
                      <strong>Date</strong>
                    </TableCell>

                    <TableCell>
                      <strong>Billing Period</strong>
                    </TableCell>

                    <TableCell>
                      <strong>Amount</strong>
                    </TableCell>

                    <TableCell>
                      <strong>Method</strong>
                    </TableCell>

                    <TableCell>
                      <strong>Status</strong>
                    </TableCell>

                    <TableCell>
                      <strong>Remarks</strong>
                    </TableCell>
                  </TableRow>
                </TableHead>

                <TableBody>
                  {tenantPayments.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={6}
                        align="center"
                        sx={{ py: 5 }}
                      >
                        <ReceiptLongIcon
                          sx={{
                            fontSize: 45,
                            color: "text.disabled",
                            mb: 1,
                          }}
                        />

                        <Typography
                          variant="body2"
                          color="text.secondary"
                        >
                          This tenant has no payment records yet.
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    tenantPayments.map((payment) => (
                      <TableRow key={payment.id} hover>
                        <TableCell>
                          {formatDate(payment)}
                        </TableCell>

                        <TableCell>
                          {payment.periodMonth || "N/A"}
                        </TableCell>

                        <TableCell>
                          <Typography
                            fontWeight="800"
                            color="success.main"
                          >
                            ₱
                            {Number(
                              payment.amount || 0
                            ).toLocaleString()}
                          </Typography>
                        </TableCell>

                        <TableCell>
                          <Chip
                            label={
                              payment.paymentMethod || "Cash"
                            }
                            size="small"
                            variant="outlined"
                          />
                        </TableCell>

                        <TableCell>
                          <Chip
                            label={payment.status || "Paid"}
                            size="small"
                            color={
                              payment.status === "Paid"
                                ? "success"
                                : payment.status === "Overdue"
                                ? "error"
                                : "warning"
                            }
                          />
                        </TableCell>

                        <TableCell>
                          {payment.remarks || "—"}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        );
      })()}
    </DialogContent>

    <DialogActions sx={{ p: 2 }}>
      <Button
        onClick={() => {
          setOpenTenantPaymentHistory(false);
          setSelectedTenant(null);
        }}
      >
        Close
      </Button>

      <Button
        variant="contained"
        startIcon={<ReceiptLongIcon />}
        onClick={() => {
          setOpenTenantPaymentHistory(false);
          setOpenRecordPaymentModal(true);
        }}
      >
        Record Payment
      </Button>
    </DialogActions>
  </Dialog>
)}

      {/* DIALOG: Log New Ticket */}
      <Dialog open={openNewTicketModal} onClose={() => setOpenNewTicketModal(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>Log Maintenance / Repair Request</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2.5} sx={{ pt: 1 }}>
            <TextField
              label="Issue Title"
              placeholder="e.g., Leaking bathroom pipe"
              fullWidth
              value={newTicket.title}
              onChange={(e) => setNewTicket({ ...newTicket, title: e.target.value })}
            />

            <Grid container spacing={2}>
              <Grid size={{ xs: 6 }}>
                <FormControl fullWidth>
                  <InputLabel>Category</InputLabel>
                  <Select
                    value={newTicket.category}
                    label="Category"
                    onChange={(e) => setNewTicket({ ...newTicket, category: e.target.value })}
                  >
                    <MenuItem value="Plumbing">Plumbing</MenuItem>
                    <MenuItem value="Electrical">Electrical</MenuItem>
                    <MenuItem value="Aircon / Appliance">Aircon / Appliance</MenuItem>
                    <MenuItem value="Structural / Door Lock">Structural / Door Lock</MenuItem>
                    <MenuItem value="Fire Safety / Hazard">Fire Safety / Hazard</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid size={{ xs: 6 }}>
                <FormControl fullWidth>
                  <InputLabel>Priority</InputLabel>
                  <Select
                    value={newTicket.priority}
                    label="Priority"
                    onChange={(e) => setNewTicket({ ...newTicket, priority: e.target.value })}
                  >
                    <MenuItem value="Low">Low</MenuItem>
                    <MenuItem value="Medium">Medium</MenuItem>
                    <MenuItem value="High">High</MenuItem>
                    <MenuItem value="Urgent">Urgent (Safety Threat)</MenuItem>
                  </Select>
                </FormControl>
              </Grid>
            </Grid>

            <Grid container spacing={2}>
              <Grid size={{ xs: 8 }}>
                <FormControl fullWidth>
                  <InputLabel>Property</InputLabel>
                  <Select
                    value={newTicket.propertyId}
                    label="Property"
                    onChange={(e) => setNewTicket({ ...newTicket, propertyId: e.target.value })}
                  >
                    {properties.map((p) => (
                      <MenuItem key={p.id} value={p.id}>
                        {p.propertyName || p.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              <Grid size={{ xs: 4 }}>
                <TextField
                  label="Room #"
                  placeholder="e.g., 201"
                  fullWidth
                  value={newTicket.roomNumber}
                  onChange={(e) => setNewTicket({ ...newTicket, roomNumber: e.target.value })}
                />
              </Grid>
            </Grid>

            <TextField
              label="Reported By (Tenant / Caretaker Name)"
              placeholder="e.g., Juan Dela Cruz"
              fullWidth
              value={newTicket.reportedBy}
              onChange={(e) => setNewTicket({ ...newTicket, reportedBy: e.target.value })}
            />

            <FormControl fullWidth>
              <InputLabel>Assign Caretaker (Optional)</InputLabel>
              <Select
                value={newTicket.assignedCaretakerId}
                label="Assign Caretaker (Optional)"
                onChange={(e) => setNewTicket({ ...newTicket, assignedCaretakerId: e.target.value })}
              >
                <MenuItem value="">Unassigned</MenuItem>
                {caretakers.map((c) => (
                  <MenuItem key={c.id} value={c.id}>
                    {c.name || c.email}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              label="Detailed Description"
              multiline
              rows={3}
              placeholder="Provide repair details..."
              fullWidth
              value={newTicket.description}
              onChange={(e) => setNewTicket({ ...newTicket, description: e.target.value })}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2.5 }}>
          <Button onClick={() => setOpenNewTicketModal(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleCreateTicket}>
            Submit Log
          </Button>
        </DialogActions>
      </Dialog>

      {/* DIALOG: Ticket Updates */}
      {selectedTicket && (
        <Dialog open={openUpdateTicketModal} onClose={() => setOpenUpdateTicketModal(false)} maxWidth="sm" fullWidth>
          <DialogTitle sx={{ fontWeight: 800 }}>Manage Maintenance Ticket</DialogTitle>
          <DialogContent dividers>
            <Stack spacing={2} sx={{ pt: 1 }}>
              <Box sx={{ p: 2, bgcolor: "background.default", borderRadius: 2 }}>
                <Typography variant="subtitle1" fontWeight="700">{selectedTicket.title}</Typography>
                <Typography variant="body2" color="text.secondary">{selectedTicket.propertyName} — Room {selectedTicket.roomNumber}</Typography>
              </Box>
              <FormControl fullWidth>
                <InputLabel>Update Status</InputLabel>
                <Select value={updateTicketForm.status} label="Update Status" onChange={(e) => setUpdateTicketForm({ ...updateTicketForm, status: e.target.value })}>
                  <MenuItem value="Pending">Pending</MenuItem>
                  <MenuItem value="In Progress">In Progress</MenuItem>
                  <MenuItem value="Resolved">Resolved</MenuItem>
                </Select>
              </FormControl>
              <FormControl fullWidth>
                <InputLabel>Assigned Caretaker</InputLabel>
                <Select value={updateTicketForm.assignedCaretakerId} label="Assigned Caretaker" onChange={(e) => setUpdateTicketForm({ ...updateTicketForm, assignedCaretakerId: e.target.value })}>
                  <MenuItem value="">Unassigned</MenuItem>
                  {caretakers.map((c) => (<MenuItem key={c.id} value={c.id}>{c.name || c.email}</MenuItem>))}
                </Select>
              </FormControl>
              <TextField label="Resolution Notes" multiline rows={3} fullWidth value={updateTicketForm.resolutionNotes} onChange={(e) => setUpdateTicketForm({ ...updateTicketForm, resolutionNotes: e.target.value })} />
            </Stack>
          </DialogContent>
          <DialogActions sx={{ p: 2.5 }}>
            <Button onClick={() => setOpenUpdateTicketModal(false)}>Cancel</Button>
            <Button variant="contained" onClick={handleSaveTicketUpdate}>Save Updates</Button>
          </DialogActions>
        </Dialog>
      )}
    </Box>
  );
}

/* --- OVERVIEW TAB --- */
function OverviewTab({ stats, tickets, payments, navigate, setSelectedTicket, setOpenUpdateTicketModal, setUpdateTicketForm, setOpenRecordPaymentModal }) {
  const pendingTickets = tickets.filter((t) => t.status !== "Resolved").slice(0, 3);
  const recentPayments = payments.slice(0, 4);

  return (
    <Container maxWidth="xl" disableGutters>
      <Grid container spacing={2.5} sx={{ mb: 4 }}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <MetricBox title="Total Properties" value={stats.totalProperties} subtitle={`${stats.totalBeds} Total Capacity`} icon={<HomeWorkIcon sx={{ color: "primary.main" }} />} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <MetricBox title="Occupancy Rate" value={`${stats.occupancyRate}%`} subtitle={`${stats.occupiedBeds} / ${stats.totalBeds} Occupied`} icon={<PeopleIcon sx={{ color: "#0288d1" }} />} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <MetricBox title="Rent Collected This Month" value={`₱${stats.collectedThisMonth.toLocaleString()}`} subtitle={`Target: ₱${stats.totalRevenue.toLocaleString()}`} icon={<AttachMoneyIcon sx={{ color: "#2e7d32" }} />} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <MetricBox title="Pending Repairs" value={stats.pendingMaintenance} subtitle={`${stats.urgentMaintenance} Urgent Issues`} icon={<BuildOutlinedIcon sx={{ color: "#ed6c02" }} />} />
        </Grid>
      </Grid>

      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Paper elevation={0} sx={{ p: 3, border: "1px solid", borderColor: "divider", borderRadius: 3, height: "100%" }}>
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
              <Typography variant="h6" fontWeight="700">Recent Rent Collections</Typography>
              <Button size="small" variant="outlined" startIcon={<ReceiptLongIcon />} onClick={() => setOpenRecordPaymentModal(true)}>
                Record Payment
              </Button>
            </Box>
            <Stack spacing={1.5}>
              {recentPayments.length === 0 ? (
                <Typography variant="body2" color="text.secondary">No payments logged recently.</Typography>
              ) : (
                recentPayments.map((p) => (
                  <Box key={p.id} sx={{ p: 1.5, borderRadius: 2, bgcolor: "background.default", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <Box>
                      <Typography variant="subtitle2" fontWeight="700">{p.tenantName} — ₱{Number(p.amount).toLocaleString()}</Typography>
                      <Typography variant="caption" color="text.secondary">{p.propertyName} (Room {p.roomNumber})</Typography>
                    </Box>
                    <Chip label={p.status || "Paid"} color="success" size="small" />
                  </Box>
                ))
              )}
            </Stack>
          </Paper>
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <Paper elevation={0} sx={{ p: 3, border: "1px solid", borderColor: "divider", borderRadius: 3, height: "100%" }}>
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
              <Typography variant="h6" fontWeight="700">Tenant Onboarding & Caretakers</Typography>
              <Button size="small" variant="contained" startIcon={<PersonAddIcon />} onClick={() => navigate("/owner/tenants/register")}>
                Register Tenant
              </Button>
            </Box>
            <Grid container spacing={2}>
              <Grid size={{ xs: 6 }}>
                <Box sx={{ p: 2, borderRadius: 2, bgcolor: "rgba(46, 125, 50, 0.08)" }}>
                  <Typography variant="caption" color="text.secondary" fontWeight="600">Active Tenants</Typography>
                  <Typography variant="h5" fontWeight="800" color="success.main">{stats.activeTenants}</Typography>
                </Box>
              </Grid>
              <Grid size={{ xs: 6 }}>
                <Box sx={{ p: 2, borderRadius: 2, bgcolor: "rgba(237, 108, 2, 0.08)" }}>
                  <Typography variant="caption" color="text.secondary" fontWeight="600">Pending Registration</Typography>
                  <Typography variant="h5" fontWeight="800" color="warning.main">{stats.pendingTenants}</Typography>
                </Box>
              </Grid>
            </Grid>

            <Box sx={{ mt: 2.5, pt: 2, borderTop: "1px solid", borderColor: "divider", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <Typography variant="body2" fontWeight="600">Active Caretakers: {stats.totalCaretakers}</Typography>
              <Stack direction="row" spacing={1}>
                <Button size="small" startIcon={<FormatListNumberedIcon />} onClick={() => navigate("/owner/caretakers")}>
                  List
                </Button>
                <Button size="small" variant="outlined" startIcon={<GroupAddIcon />} onClick={() => navigate("/owner/caretakers/invite")}>
                  Invite
                </Button>
              </Stack>
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Container>
  );
}

/* --- PROPERTIES TAB --- */
function PropertiesTab({ properties, navigate }) {
  return (
    <Paper elevation={0} sx={{ p: 3, border: "1px solid", borderColor: "divider", borderRadius: 3 }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3 }}>
        <Box>
          <Typography variant="h6" fontWeight="700">Property Directory</Typography>
          <Typography variant="body2" color="text.secondary">Manage buildings, rooms, and bed capacity</Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => navigate("/setup")}
          sx={{ fontWeight: 600 }}
        >
          Add Property
        </Button>
      </Box>

      <TableContainer>
        <Table>
          <TableHead sx={{ bgcolor: "background.default" }}>
            <TableRow>
              <TableCell><strong>Property Name</strong></TableCell>
              <TableCell><strong>Type</strong></TableCell>
              <TableCell><strong>Occupied / Total Beds</strong></TableCell>
              <TableCell align="right"><strong>Action</strong></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {properties.map((p) => {
              const occ = p.totalBeds > 0 ? Math.round(((p.occupiedBeds || 0) / p.totalBeds) * 100) : 0;
              return (
                <TableRow key={p.id} hover onClick={() => navigate(`/owner/properties/${p.id}`)} sx={{ cursor: "pointer" }}>
                  <TableCell>
                    <Typography variant="subtitle2" fontWeight="700" color="primary">{p.propertyName || p.name}</Typography>
                  </TableCell>
                  <TableCell>{p.propertyType || "Dormitory"}</TableCell>
                  <TableCell>
                    <Box sx={{ maxWidth: 200 }}>
                      <Typography variant="caption" fontWeight="600">{p.occupiedBeds || 0} / {p.totalBeds || 0} Beds ({occ}%)</Typography>
                      <LinearProgress variant="determinate" value={occ} color={occ >= 80 ? "success" : "warning"} sx={{ height: 6, borderRadius: 3 }} />
                    </Box>
                  </TableCell>
                  <TableCell align="right">
                    <Button size="small" endIcon={<ArrowForwardIcon />}>View</Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
}

/* --- TENANTS TAB --- */
function TenantsTab({
  tenants,
  payments,
  navigate,
  searchQuery,
  setSearchQuery,
  setSelectedTenant,
  setOpenTenantPaymentHistory,
}) {
  const getTenantPayments = (tenant) => {
    return payments
      .filter((p) => {
        return (
          p.tenantId === tenant.id ||
          (
            p.tenantName &&
            (p.tenantName === tenant.fullName || p.tenantName === tenant.name)
          )
        );
      })
      .sort((a, b) => {
        const dateA = a.paymentDate?.seconds
          ? a.paymentDate.seconds
          : a.createdAt?.seconds
          ? a.createdAt.seconds
          : 0;

        const dateB = b.paymentDate?.seconds
          ? b.paymentDate.seconds
          : b.createdAt?.seconds
          ? b.createdAt.seconds
          : 0;

        return dateB - dateA;
      });
  };

  const filteredTenants = tenants.filter((tenant) =>
    (tenant.fullName || tenant.name || "")
      .toLowerCase()
      .includes(searchQuery.toLowerCase())
  );

  const formatPaymentDate = (payment) => {
    const timestamp = payment?.paymentDate || payment?.createdAt;

    if (!timestamp) return "No date";

    try {
      const date = timestamp.toDate
        ? timestamp.toDate()
        : new Date(timestamp.seconds * 1000);

      return date.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return "No date";
    }
  };

  return (
    <Paper
      elevation={0}
      sx={{
        p: 3,
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 3,
      }}
    >
      <Box
        sx={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          mb: 3,
        }}
      >
        <Box>
          <Typography variant="h6" fontWeight="700">
            Enrolled Tenants Directory
          </Typography>

          <Typography variant="body2" color="text.secondary">
            View tenants, latest payments, and complete payment history
          </Typography>
        </Box>

        <Stack direction="row" spacing={2}>
          <TextField
            size="small"
            placeholder="Search tenant name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />

          <Button
            variant="contained"
            startIcon={<PersonAddIcon />}
            onClick={() => navigate("/owner/tenants/register")}
          >
            Register Tenant
          </Button>
        </Stack>
      </Box>

      <TableContainer>
        <Table>
          <TableHead sx={{ bgcolor: "background.default" }}>
            <TableRow>
              <TableCell>
                <strong>Tenant Name</strong>
              </TableCell>

              <TableCell>
                <strong>Property</strong>
              </TableCell>

              <TableCell>
                <strong>Room</strong>
              </TableCell>

              <TableCell>
                <strong>Status</strong>
              </TableCell>

              <TableCell>
                <strong>Last Payment</strong>
              </TableCell>

              <TableCell>
                <strong>Payment Status</strong>
              </TableCell>

              <TableCell align="right">
                <strong>Action</strong>
              </TableCell>
            </TableRow>
          </TableHead>

          <TableBody>
            {filteredTenants.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 6 }}>
                  <PeopleIcon
                    sx={{
                      fontSize: 48,
                      color: "text.disabled",
                      mb: 1,
                    }}
                  />

                  <Typography
                    variant="body2"
                    color="text.secondary"
                  >
                    No tenants found.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              filteredTenants.map((tenant) => {
                const tenantPayments = getTenantPayments(tenant);
                const lastPayment = tenantPayments[0];

                return (
                  <TableRow key={tenant.id} hover>
                    {/* TENANT */}
                    <TableCell>
                      <Typography
                        variant="subtitle2"
                        fontWeight="700"
                      >
                        {tenant.fullName || tenant.name}
                      </Typography>
                    </TableCell>

                    {/* PROPERTY */}
                    <TableCell>
                      {tenant.propertyName || "Dormitory"}
                    </TableCell>

                    {/* ROOM */}
                    <TableCell>
                      {tenant.roomNumber ? (
                        `Room ${tenant.roomNumber}`
                      ) : (
                        <Chip
                          label="Unassigned"
                          size="small"
                          color="warning"
                        />
                      )}
                    </TableCell>

                    {/* TENANT STATUS */}
                    <TableCell>
                      <Chip
                        label={tenant.status || "Active"}
                        color={
                          tenant.status === "Pending Onboarding"
                            ? "warning"
                            : "success"
                        }
                        size="small"
                      />
                    </TableCell>

                    {/* LAST PAYMENT */}
                    <TableCell>
                      {lastPayment ? (
                        <Box>
                          <Typography
                            variant="subtitle2"
                            fontWeight="800"
                            color="success.main"
                          >
                            ₱
                            {Number(
                              lastPayment.amount || 0
                            ).toLocaleString()}
                          </Typography>

                          <Typography
                            variant="caption"
                            color="text.secondary"
                          >
                            {lastPayment.periodMonth || "N/A"}
                          </Typography>

                          <Typography
                            variant="caption"
                            color="text.secondary"
                            display="block"
                          >
                            {formatPaymentDate(lastPayment)}
                          </Typography>
                        </Box>
                      ) : (
                        <Typography
                          variant="body2"
                          color="text.secondary"
                        >
                          No payment yet
                        </Typography>
                      )}
                    </TableCell>

                    {/* PAYMENT STATUS */}
                    <TableCell>
                      {lastPayment ? (
                        <Chip
                          label={lastPayment.status || "Paid"}
                          size="small"
                          color={
                            lastPayment.status === "Paid"
                              ? "success"
                              : lastPayment.status === "Overdue"
                              ? "error"
                              : "warning"
                          }
                        />
                      ) : (
                        <Chip
                          label="No Record"
                          size="small"
                          variant="outlined"
                        />
                      )}
                    </TableCell>

                    {/* ACTION */}
                    <TableCell align="right">
                      <Stack
                        direction="row"
                        spacing={1}
                        justifyContent="flex-end"
                      >
                        <Button
                          size="small"
                          startIcon={<HistoryIcon />}
                          variant="outlined"
                          onClick={() => {
                            setSelectedTenant(tenant);
                            setOpenTenantPaymentHistory(true);
                          }}
                        >
                          Payment History
                        </Button>

                        <Button
                          size="small"
                          onClick={() =>
                            navigate(`/owner/tenants/${tenant.id}`)
                          }
                        >
                          Manage
                        </Button>
                      </Stack>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
}

/* --- PAYMENTS TAB --- */
function PaymentsTab({ payments, stats, searchQuery, setSearchQuery, setOpenRecordPaymentModal }) {
  const filteredPayments = payments.filter(
    (p) =>
      p.tenantName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.propertyName?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Box sx={{ width: "100%" }}>
      <Grid container spacing={2.5} sx={{ mb: 4 }}>
        <Grid size={{ xs: 12, sm: 4 }}>
          <MetricBox title="Rent Collected This Month" value={`₱${stats.collectedThisMonth.toLocaleString()}`} subtitle="Verified Receipts" icon={<AttachMoneyIcon sx={{ color: "success.main" }} />} />
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <MetricBox title="Monthly Revenue Potential" value={`₱${stats.totalRevenue.toLocaleString()}`} subtitle="100% Occupancy Goal" icon={<PaymentIcon sx={{ color: "primary.main" }} />} />
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <MetricBox title="Pending / Overdue Bills" value={stats.pendingPaymentsCount} subtitle="Requires follow-up" icon={<WarningAmberIcon sx={{ color: "warning.main" }} />} />
        </Grid>
      </Grid>

      <Paper elevation={0} sx={{ p: 3, border: "1px solid", borderColor: "divider", borderRadius: 3 }}>
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3 }}>
          <Box>
            <Typography variant="h6" fontWeight="700">Rent Payments &amp; Billing History</Typography>
            <Typography variant="body2" color="text.secondary">Logs of tenant rent collections and receipts</Typography>
          </Box>
          <Stack direction="row" spacing={2}>
            <TextField
              size="small"
              placeholder="Search tenant or property..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
            />
            <Button variant="contained" color="success" startIcon={<ReceiptLongIcon />} onClick={() => setOpenRecordPaymentModal(true)}>
              Record Payment
            </Button>
          </Stack>
        </Box>

        <TableContainer>
          <Table sx={{ minWidth: 650 }}>
            <TableHead sx={{ bgcolor: "background.default" }}>
              <TableRow>
                <TableCell><strong>Tenant Name</strong></TableCell>
                <TableCell><strong>Property &amp; Room</strong></TableCell>
                <TableCell><strong>Billing Period</strong></TableCell>
                <TableCell><strong>Amount Paid</strong></TableCell>
                <TableCell><strong>Method</strong></TableCell>
                <TableCell><strong>Status</strong></TableCell>
                <TableCell><strong>Remarks</strong></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredPayments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 6 }}>
                    <ReceiptLongIcon sx={{ fontSize: 48, color: "text.disabled", mb: 1 }} />
                    <Typography variant="body2" color="text.secondary">No payment records found.</Typography>
                  </TableCell>
                </TableRow>
              ) : (
                filteredPayments.map((p) => (
                  <TableRow key={p.id} hover>
                    <TableCell><Typography variant="subtitle2" fontWeight="700">{p.tenantName}</Typography></TableCell>
                    <TableCell>{p.propertyName} (Room {p.roomNumber})</TableCell>
                    <TableCell>{p.periodMonth || "N/A"}</TableCell>
                    <TableCell><Typography variant="subtitle2" fontWeight="800" color="success.main">₱{Number(p.amount).toLocaleString()}</Typography></TableCell>
                    <TableCell><Chip label={p.paymentMethod || "GCash"} size="small" variant="outlined" /></TableCell>
                    <TableCell><Chip label={p.status || "Paid"} color={p.status === "Paid" ? "success" : "warning"} size="small" /></TableCell>
                    <TableCell>{p.remarks || "—"}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Box>
  );
}

/* --- MAINTENANCE TAB --- */
function MaintenanceTab({ tickets, setSelectedTicket, setOpenUpdateTicketModal, setUpdateTicketForm, setOpenNewTicketModal }) {
  return (
    <Paper elevation={0} sx={{ p: 3, border: "1px solid", borderColor: "divider", borderRadius: 3 }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3 }}>
        <Typography variant="h6" fontWeight="700">Maintenance Tickets</Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setOpenNewTicketModal(true)}>
          Log Request
        </Button>
      </Box>

      <TableContainer>
        <Table>
          <TableHead sx={{ bgcolor: "background.default" }}>
            <TableRow>
              <TableCell><strong>Title</strong></TableCell>
              <TableCell><strong>Location</strong></TableCell>
              <TableCell><strong>Priority</strong></TableCell>
              <TableCell><strong>Status</strong></TableCell>
              <TableCell align="right"><strong>Action</strong></TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {tickets.map((t) => (
              <TableRow key={t.id}>
                <TableCell>{t.title}</TableCell>
                <TableCell>{t.propertyName} (Room {t.roomNumber})</TableCell>
                <TableCell><Chip label={t.priority} color={t.priority === "Urgent" ? "error" : "warning"} size="small" /></TableCell>
                <TableCell><Chip label={t.status} color="info" size="small" /></TableCell>
                <TableCell align="right">
                  <IconButton size="small" onClick={() => { setSelectedTicket(t); setUpdateTicketForm({ status: t.status, assignedCaretakerId: t.assignedCaretakerId || "", resolutionNotes: t.resolutionNotes || "" }); setOpenUpdateTicketModal(true); }}>
                    <EditOutlinedIcon fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
}

function MetricBox({ title, value, subtitle, icon }) {
  return (
    <Card elevation={0} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 3, height: "100%" }}>
      <CardContent sx={{ p: 2.5 }}>
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1 }}>
          <Typography variant="body2" color="text.secondary" fontWeight="600">{title}</Typography>
          <Box sx={{ p: 1, borderRadius: 2, bgcolor: "action.hover" }}>{icon}</Box>
        </Box>
        <Typography variant="h4" fontWeight="800">{value}</Typography>
        <Typography variant="caption" color="text.secondary">{subtitle}</Typography>
      </CardContent>
    </Card>
  );
}