import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Container,
  Grid,
  Paper,
  Typography,
  Button,
  Stack,
  Chip,
  Card,
  CardContent,
  CircularProgress,
  TextField,
  Alert,
  Tooltip,
} from "@mui/material";
import HomeWorkIcon from "@mui/icons-material/HomeWork";
import PeopleIcon from "@mui/icons-material/People";
import AttachMoneyIcon from "@mui/icons-material/AttachMoney";
import BuildOutlinedIcon from "@mui/icons-material/BuildOutlined";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import FormatListNumberedIcon from "@mui/icons-material/FormatListNumbered";
import GroupAddIcon from "@mui/icons-material/GroupAdd";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import LockIcon from "@mui/icons-material/Lock";
import AddHomeWorkIcon from "@mui/icons-material/AddHomeWork";
import { collection, query, where, onSnapshot, doc, setDoc, updateDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { auth, db, storage } from "../../config/firebase";

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

export default function OwnerOverview() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [owner, setOwner] = useState(null);
  
  // Setup Form States
  const [propertyName, setPropertyName] = useState("");
  const [idFile, setIdFile] = useState(null);
  const [clearanceFile, setClearanceFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  const [stats, setStats] = useState({
    totalProperties: 0,
    totalBeds: 0,
    occupancyRate: 0,
    occupiedBeds: 0,
    collectedThisMonth: 0,
    totalRevenue: 0,
    pendingMaintenance: 0,
    urgentMaintenance: 0,
    activeTenants: 0,
    pendingTenants: 0,
    totalCaretakers: 0,
  });

  const [tickets, setTickets] = useState([]);
  const [payments, setPayments] = useState([]);

  // Use refs to store snapshot values for combined occupancy calculations
  const propertiesDataRef = useRef({ count: 0, totalBeds: 0 });
  const tenantsDataRef = useRef({ active: 0, pending: 0 });

  useEffect(() => {
    if (!auth.currentUser) return;
    const ownerId = auth.currentUser.uid;

    const recalculateOccupancy = () => {
      const beds = propertiesDataRef.current.totalBeds;
      const active = tenantsDataRef.current.active;
      const pending = tenantsDataRef.current.pending;
      const propertiesCount = propertiesDataRef.current.count;

      const occRate = beds > 0 ? Math.min(Math.round((active / beds) * 100), 100) : 0;

      setStats((prev) => ({
        ...prev,
        totalProperties: propertiesCount,
        totalBeds: beds,
        activeTenants: active,
        pendingTenants: pending,
        occupiedBeds: active,
        occupancyRate: occRate,
      }));
    };

    // 0. Listen to Owner Profile (approvalStatus & verificationDocs)
    const unsubOwner = onSnapshot(doc(db, "users", ownerId), (docSnap) => {
      if (docSnap.exists()) {
        setOwner(docSnap.data());
      }
    });

    // 1. Listen to Properties Data
    const unsubProperties = onSnapshot(
      query(collection(db, "properties"), where("ownerUid", "==", ownerId)),
      (snapshot) => {
        let totalCapacity = 0;

        snapshot.docs.forEach((doc) => {
          const data = doc.data();
          let roomCapacity = 0;
          if (Array.isArray(data.rooms) && data.rooms.length > 0) {
            data.rooms.forEach((room) => {
              roomCapacity += Number(room.capacity || room.beds || room.totalBeds || 0);
            });
          }

          const topLevelCapacity = Number(data.totalBeds) || Number(data.capacity) || Number(data.beds) || Number(data.totalCapacity) || 0;
          totalCapacity += roomCapacity > 0 ? roomCapacity : topLevelCapacity;
        });

        propertiesDataRef.current = {
          count: snapshot.docs.length,
          totalBeds: totalCapacity,
        };

        recalculateOccupancy();
      },
      (error) => console.error("Error fetching properties:", error)
    );

    // 2. Listen to Tenants Data
    const unsubTenants = onSnapshot(
      query(collection(db, "tenants"), where("ownerUid", "==", ownerId)),
      (snapshot) => {
        let active = 0;
        let pending = 0;

        snapshot.docs.forEach((doc) => {
          const data = doc.data();
          const rawStatus = (data.status || "active").toString().trim().toLowerCase();

          if (rawStatus.includes("pending")) {
            pending++;
          } else if (rawStatus === "inactive" || rawStatus === "archived") {
            // Exclude inactive tenants
          } else {
            active++;
          }
        });

        tenantsDataRef.current = { active, pending };
        recalculateOccupancy();
      },
      (error) => console.error("Error fetching tenants:", error)
    );

    // 3. Listen to Caretakers Data
    const unsubCaretakers = onSnapshot(
      query(collection(db, "users"), where("ownerUid", "==", ownerId), where("role", "==", "caretaker")),
      (snapshot) => {
        setStats((prev) => ({ ...prev, totalCaretakers: snapshot.docs.length }));
      },
      (error) => console.error("Error fetching caretakers:", error)
    );

    // 4. Listen to Payments Data
    const unsubPayments = onSnapshot(
      query(collection(db, "payments"), where("ownerUid", "==", ownerId)),
      (snapshot) => {
        const fetchedPayments = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        setPayments(fetchedPayments);

        const currentMonth = new Date().getMonth();
        const currentYear = new Date().getFullYear();

        let monthTotal = 0;
        fetchedPayments.forEach((p) => {
          const pDate = p.createdAt ? new Date(p.createdAt) : null;
          if (pDate && pDate.getMonth() === currentMonth && pDate.getFullYear() === currentYear && p.status === "Paid") {
            monthTotal += Number(p.amount || 0);
          }
        });

        setStats((prev) => ({ ...prev, collectedThisMonth: monthTotal }));
      },
      (error) => console.error("Error fetching payments:", error)
    );

    // 5. Listen to Maintenance Tickets
    const unsubTickets = onSnapshot(
      query(collection(db, "tickets"), where("ownerUid", "==", ownerId)),
      (snapshot) => {
        const fetchedTickets = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        setTickets(fetchedTickets);

        const pending = fetchedTickets.filter((t) => t.status !== "Resolved");
        const urgent = pending.filter((t) => (t.priority || "").toLowerCase() === "urgent");

        setStats((prev) => ({
          ...prev,
          pendingMaintenance: pending.length,
          urgentMaintenance: urgent.length,
        }));
        setLoading(false);
      },
      (error) => {
        console.error("Error fetching tickets:", error);
        setLoading(false);
      }
    );

    return () => {
      unsubOwner();
      unsubProperties();
      unsubTenants();
      unsubCaretakers();
      unsubPayments();
      unsubTickets();
    };
  }, []);

  // --- Forced Setup Handler ---
  const handleForcedSetup = async (e) => {
    e.preventDefault();
    if (!idFile || !clearanceFile || !propertyName) return alert("Please fill out all fields and upload required documents.");
    
    setUploading(true);
    try {
      const ownerId = auth.currentUser.uid;

      // 1. Upload ID
      const idRef = ref(storage, `verifications/${ownerId}/id_document`);
      await uploadBytes(idRef, idFile);
      const idUrl = await getDownloadURL(idRef);

      // 2. Upload Clearance/Permit
      const clearanceRef = ref(storage, `verifications/${ownerId}/clearance_document`);
      await uploadBytes(clearanceRef, clearanceFile);
      const clearanceUrl = await getDownloadURL(clearanceRef);

      // 3. Update User Verification Docs & maintain pending approval status
      await updateDoc(doc(db, "users", ownerId), {
        approvalStatus: "pending",
        "verificationDocs.idUrl": idUrl,
        "verificationDocs.clearanceUrl": clearanceUrl,
        "verificationDocs.submittedAt": new Date().toISOString(),
      });

      // 4. Create the initial Property
      const newPropRef = doc(collection(db, "properties"));
      await setDoc(newPropRef, {
        ownerUid: ownerId,
        propertyName: propertyName,
        totalRooms: 0,
        totalBeds: 0,
        createdAt: new Date().toISOString()
      });

      setUploading(false);
    } catch (error) {
      console.error("Setup failed", error);
      setUploading(false);
    }
  };

  const recentPayments = payments.slice(0, 4);

  if (loading || !owner) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", alignItems: "center", height: "60vh" }}>
        <CircularProgress />
      </Box>
    );
  }

  // --- FORCE SETUP SCREEN ---
  if (owner?.approvalStatus === "pending" && stats.totalProperties === 0) {
    return (
      <Container maxWidth="sm" sx={{ py: { xs: 4, md: 8 } }}>
        <Paper elevation={0} sx={{ p: { xs: 3, md: 5 }, border: "1px solid", borderColor: "divider", borderRadius: 3 }}>
          <Typography variant="h5" fontWeight="800" sx={{ mb: 1 }}>Complete Your Property Setup</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
            Before accessing the dashboard, you must establish your first property and upload your verification documents. 
            Once completed, your profile will be sent to our admin team for approval.
          </Typography>

          <Box component="form" onSubmit={handleForcedSetup}>
            <TextField 
              fullWidth 
              label="Property Name" 
              placeholder="e.g., St. Jude Dormitory"
              required 
              sx={{ mb: 4 }}
              value={propertyName} 
              onChange={(e) => setPropertyName(e.target.value)}
            />
            
            <Typography variant="subtitle2" fontWeight="700" sx={{ mb: 1 }}>Government ID</Typography>
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
              Upload a clear photo of your valid ID (PhilID, Driver's License, etc.)
            </Typography>
            <Box sx={{ mb: 4, display: 'flex', alignItems: 'center', gap: 2 }}>
              <Button component="label" variant="outlined" startIcon={<UploadFileIcon />}>
                Choose File
                <input type="file" hidden required onChange={(e) => setIdFile(e.target.files[0])} />
              </Button>
              <Typography variant="body2">{idFile ? idFile.name : "No file selected"}</Typography>
            </Box>

            <Typography variant="subtitle2" fontWeight="700" sx={{ mb: 1 }}>Proof of Ownership / Barangay Clearance</Typography>
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
              Upload your business permit, barangay clearance, or utility bill.
            </Typography>
            <Box sx={{ mb: 4, display: 'flex', alignItems: 'center', gap: 2 }}>
              <Button component="label" variant="outlined" startIcon={<UploadFileIcon />}>
                Choose File
                <input type="file" hidden required onChange={(e) => setClearanceFile(e.target.files[0])} />
              </Button>
              <Typography variant="body2">{clearanceFile ? clearanceFile.name : "No file selected"}</Typography>
            </Box>

            <Button 
              type="submit" 
              variant="contained" 
              fullWidth 
              size="large"
              disabled={uploading}
              sx={{ py: 1.5, fontWeight: "bold" }}
            >
              {uploading ? <CircularProgress size={24} color="inherit" /> : "Submit for Approval"}
            </Button>
          </Box>
        </Paper>
      </Container>
    );
  }

  // --- ACTUAL DASHBOARD ---
  const isPending = owner?.approvalStatus === "pending";

  return (
    <Container maxWidth="xl" disableGutters>
      
      {/* Header Banner */}
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 3 }}>
        <Typography variant="h5" fontWeight="800">Owner Dashboard</Typography>
        <Tooltip title={isPending ? "Account pending approval. Adding properties is disabled." : ""}>
          <span>
            <Button
              variant="contained"
              startIcon={isPending ? <LockIcon /> : <AddHomeWorkIcon />}
              onClick={() => navigate("/owner/properties/new")}
              disabled={isPending}
            >
              Add Property
            </Button>
          </span>
        </Tooltip>
      </Box>

      {/* Pending Account Alert */}
      {isPending && (
        <Alert severity="warning" sx={{ mb: 4, borderRadius: 2 }}>
          <strong>Account Pending Approval:</strong> Your verification documents and property are currently under review by our admin team. You can explore the dashboard, but property management actions (adding tenants, inviting caretakers, adding properties) are locked until approval.
        </Alert>
      )}

      {/* Top Metrics Row */}
      <Grid container spacing={2.5} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <MetricBox title="Total Properties" value={stats.totalProperties} subtitle={`${stats.totalBeds} Total Capacity`} icon={<HomeWorkIcon sx={{ color: "primary.main" }} />} />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricBox title="Occupancy Rate" value={`${stats.occupancyRate}%`} subtitle={`${stats.occupiedBeds} / ${stats.totalBeds} Occupied`} icon={<PeopleIcon sx={{ color: "#0288d1" }} />} />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricBox title="Rent Collected This Month" value={`₱${stats.collectedThisMonth.toLocaleString()}`} subtitle={`Target: ₱${stats.totalRevenue.toLocaleString()}`} icon={<AttachMoneyIcon sx={{ color: "#2e7d32" }} />} />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <MetricBox title="Pending Repairs" value={stats.pendingMaintenance} subtitle={`${stats.urgentMaintenance} Urgent Issues`} icon={<BuildOutlinedIcon sx={{ color: "#ed6c02" }} />} />
        </Grid>
      </Grid>

      {/* Bottom Dashboard Panels */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {/* Left Panel */}
        <Grid item xs={12} md={6}>
          <Paper elevation={0} sx={{ p: 3, border: "1px solid", borderColor: "divider", borderRadius: 3, height: "100%" }}>
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
              <Typography variant="h6" fontWeight="700">Recent Rent Collections</Typography>
              <Button size="small" variant="outlined" startIcon={<ReceiptLongIcon />} onClick={() => navigate("/owner/payments")}>
                View Payments
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
                    <Chip label={p.status || "Paid"} color={p.status === "Paid" ? "success" : "warning"} size="small" />
                  </Box>
                ))
              )}
            </Stack>
          </Paper>
        </Grid>

        {/* Right Panel */}
        <Grid item xs={12} md={6}>
          <Paper elevation={0} sx={{ p: 3, border: "1px solid", borderColor: "divider", borderRadius: 3, height: "100%" }}>
            <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
              <Typography variant="h6" fontWeight="700">Tenant Onboarding & Caretakers</Typography>
              <Tooltip title={isPending ? "Account pending approval. Tenant registration is locked." : ""}>
                <span>
                  <Button 
                    size="small" 
                    variant="contained" 
                    startIcon={isPending ? <LockIcon /> : <PersonAddIcon />} 
                    onClick={() => navigate("/owner/tenants/register")}
                    disabled={isPending}
                  >
                    Register Tenant
                  </Button>
                </span>
              </Tooltip>
            </Box>
            
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <Box sx={{ p: 2, borderRadius: 2, bgcolor: "rgba(46, 125, 50, 0.08)" }}>
                  <Typography variant="caption" color="text.secondary" fontWeight="600">Active Tenants</Typography>
                  <Typography variant="h5" fontWeight="800" color="success.main">{stats.activeTenants}</Typography>
                </Box>
              </Grid>
              <Grid item xs={6}>
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
                <Tooltip title={isPending ? "Account pending approval. Caretaker invitations are locked." : ""}>
                  <span>
                    <Button 
                      size="small" 
                      variant="outlined" 
                      startIcon={isPending ? <LockIcon /> : <GroupAddIcon />} 
                      onClick={() => navigate("/owner/caretakers/invite")}
                      disabled={isPending}
                    >
                      Invite
                    </Button>
                  </span>
                </Tooltip>
              </Stack>
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Container>
  );
}