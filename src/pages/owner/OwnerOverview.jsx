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
import { collection, query, where, onSnapshot, doc, setDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { onAuthStateChanged } from "firebase/auth"; // Added Auth listener
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

function PropertyCard({ property, onClick }) {
  return (
    <Card
      elevation={0}
      onClick={onClick}
      sx={{
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 3,
        height: "100%",
        cursor: "pointer",
        overflow: "hidden",
        transition: "border-color 0.15s ease, box-shadow 0.15s ease",
        "&:hover": { borderColor: "primary.main", boxShadow: "0 6px 18px rgba(0,0,0,0.06)" },
      }}
    >
      <Box
        sx={{
          height: 120,
          bgcolor: "action.hover",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          ...(property.coverPhotoUrl && {
            backgroundImage: `url(${property.coverPhotoUrl})`,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }),
        }}
      >
        {!property.coverPhotoUrl && <HomeWorkIcon sx={{ fontSize: 36, color: "text.disabled" }} />}
      </Box>
      <CardContent sx={{ p: 2 }}>
        <Typography variant="subtitle1" fontWeight="700" noWrap>
          {property.propertyName}
        </Typography>
        <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1.25 }}>
          {property.propertyType || "Property"}
        </Typography>
        <Stack direction="row" spacing={1}>
          <Chip size="small" variant="outlined" label={`${property.totalRooms} rooms`} />
          <Chip size="small" variant="outlined" label={`${property.totalBeds} beds`} />
        </Stack>
      </CardContent>
    </Card>
  );
}

export default function OwnerOverview() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [owner, setOwner] = useState(null);
  const [properties, setProperties] = useState([]);
  
  // Setup Form States
  const [propertyName, setPropertyName] = useState("");
  const [idFile, setIdFile] = useState(null);
  const [clearanceFile, setClearanceFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [setupError, setSetupError] = useState(""); // Replaces raw alert()

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
  const propertiesDataRef = useRef({ count: 0, totalBeds: 0, propertyIds: [] });
  const tenantsDataRef = useRef([]);

  useEffect(() => {
    let unsubOwner, unsubProperties, unsubTenants, unsubUserTenants, unsubCaretakers, unsubPayments, unsubTickets;
    let tenantPropertyUnsubscribers = [];
    const tenantSources = new Map();

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (!user) {
        setLoading(false);
        return;
      }
      
      const ownerId = user.uid;

      const updateTenantSource = (sourceId, snapshot, tenantUsersOnly = false) => {
        const records = snapshot.docs
          .map((tenantDoc) => ({ id: tenantDoc.id, ...tenantDoc.data() }))
          .filter((tenant) => !tenantUsersOnly || tenant.role === "tenant");
        
        tenantSources.set(sourceId, records);

        const tenantsById = new Map();
        tenantSources.forEach((sourceRecords) => {
          sourceRecords.forEach((tenant) => {
            const tenantId = tenant.uid || tenant.id;
            tenantsById.set(tenantId, {
              ...(tenantsById.get(tenantId) || {}),
              ...tenant,
            });
          });
        });
        
        tenantsDataRef.current = [...tenantsById.values()];
        recalculateOccupancy(ownerId);
      };

      const recalculateOccupancy = (currentOwnerId) => {
        const beds = propertiesDataRef.current.totalBeds;
        const ownerPropertyIds = new Set(propertiesDataRef.current.propertyIds);
        const ownerTenants = tenantsDataRef.current.filter((tenant) =>
          tenant.ownerUid === currentOwnerId || ownerPropertyIds.has(tenant.propertyId)
        );
        
        let active = 0;
        let pending = 0;
        ownerTenants.forEach((tenant) => {
          const rawStatus = (tenant.status || "active").toString().trim().toLowerCase();
          if (rawStatus.includes("pending")) pending++;
          else if (rawStatus !== "inactive" && rawStatus !== "archived") active++;
        });
        
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

      // 0. Listen to Owner Profile
      unsubOwner = onSnapshot(doc(db, "users", ownerId), (docSnap) => {
        if (docSnap.exists()) {
          setOwner(docSnap.data());
        }
      });

      // 1. Listen to Properties Data
      unsubProperties = onSnapshot(
        query(collection(db, "properties"), where("ownerUid", "==", ownerId)),
        (snapshot) => {
          let totalCapacity = 0;
          const propertyList = [];

          snapshot.docs.forEach((docSnap) => {
            const data = docSnap.data();
            let roomCapacity = 0;
            if (Array.isArray(data.rooms) && data.rooms.length > 0) {
              data.rooms.forEach((room) => {
                roomCapacity += Number(room.capacity || room.beds || room.totalBeds || 0);
              });
            }

            const topLevelCapacity = Number(data.totalBeds) || Number(data.capacity) || Number(data.beds) || Number(data.totalCapacity) || 0;
            const capacity = roomCapacity > 0 ? roomCapacity : topLevelCapacity;
            totalCapacity += capacity;

            propertyList.push({
              id: docSnap.id,
              propertyName: data.propertyName || "Unnamed Property",
              propertyType: data.propertyType || "",
              coverPhotoUrl: data.coverPhotoUrl || "",
              totalRooms: Array.isArray(data.rooms) ? data.rooms.length : (Number(data.totalRooms) || 0),
              totalBeds: capacity,
            });
          });

          propertiesDataRef.current = {
            count: snapshot.docs.length,
            totalBeds: totalCapacity,
            propertyIds: snapshot.docs.map((propertyDoc) => propertyDoc.id),
          };

          // Clean up old tenant property listeners
          tenantPropertyUnsubscribers.forEach((unsubscribe) => unsubscribe());
          tenantPropertyUnsubscribers = [];
          
          [...tenantSources.keys()]
            .filter((sourceId) => sourceId.startsWith("property:"))
            .forEach((sourceId) => tenantSources.delete(sourceId));

          // Set up new tenant property listeners
          propertiesDataRef.current.propertyIds.forEach((propertyId) => {
            ["tenants", "users"].forEach((collectionName) => {
              const sourceId = `property:${propertyId}:${collectionName}`;
              const unsubscribe = onSnapshot(
                query(collection(db, collectionName), where("propertyId", "==", propertyId)),
                (tenantSnapshot) => updateTenantSource(sourceId, tenantSnapshot, collectionName === "users"),
                (error) => console.error(`Error fetching tenants for property ${propertyId}:`, error)
              );
              tenantPropertyUnsubscribers.push(unsubscribe);
            });
          });

          setProperties(propertyList);
          recalculateOccupancy(ownerId);
        },
        (error) => console.error("Error fetching properties:", error)
      );

      // 2. Listen to Tenants Data
      unsubTenants = onSnapshot(
        query(collection(db, "tenants"), where("ownerUid", "==", ownerId)),
        (snapshot) => updateTenantSource("owner:tenants", snapshot),
        (error) => console.error("Error fetching tenants:", error)
      );
      unsubUserTenants = onSnapshot(
        query(collection(db, "users"), where("ownerUid", "==", ownerId)),
        (snapshot) => updateTenantSource("owner:users", snapshot, true),
        (error) => console.error("Error fetching tenant user profiles:", error)
      );

      // 3. Listen to Caretakers Data
      unsubCaretakers = onSnapshot(
        query(collection(db, "users"), where("ownerUid", "==", ownerId), where("role", "==", "caretaker")),
        (snapshot) => {
          setStats((prev) => ({ ...prev, totalCaretakers: snapshot.docs.length }));
        },
        (error) => console.error("Error fetching caretakers:", error)
      );

      // 4. Listen to Payments Data
      unsubPayments = onSnapshot(
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
      unsubTickets = onSnapshot(
        query(collection(db, "maintenance_tickets"), where("ownerUid", "==", ownerId)),
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
    });

    return () => {
      unsubscribeAuth(); // Detach auth listener
      if (unsubOwner) unsubOwner();
      if (unsubProperties) unsubProperties();
      if (unsubTenants) unsubTenants();
      if (unsubUserTenants) unsubUserTenants();
      if (unsubCaretakers) unsubCaretakers();
      if (unsubPayments) unsubPayments();
      if (unsubTickets) unsubTickets();
      tenantPropertyUnsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, []);

  // --- Forced Setup Handler ---
  const handleForcedSetup = async (e) => {
    e.preventDefault();
    setSetupError("");
    
    if (!idFile || !clearanceFile || !propertyName) {
      return setSetupError("Please fill out all fields and upload required documents.");
    }
    
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

      // 3. Update User Verification Docs (Using setDoc with merge to ensure doc creation if missing)
      await setDoc(doc(db, "users", ownerId), {
        approvalStatus: "pending",
        verificationDocs: {
          idUrl: idUrl,
          clearanceUrl: clearanceUrl,
          submittedAt: new Date().toISOString(),
        }
      }, { merge: true });

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
      setSetupError("Failed to upload documents. Please try again.");
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

          {setupError && (
            <Alert severity="error" sx={{ mb: 3 }}>{setupError}</Alert>
          )}

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
                <input type="file" hidden required onChange={(e) => setIdFile(e.target.files[0])} accept="image/*,.pdf" />
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
                <input type="file" hidden required onChange={(e) => setClearanceFile(e.target.files[0])} accept="image/*,.pdf" />
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
  const isRejected = owner?.approvalStatus === "rejected";

  const ownerName =
    owner?.fullName || owner?.name || owner?.ownerName || owner?.firstName || auth.currentUser?.displayName || "Owner";

  const statusChip = isRejected
    ? { label: "Action Needed", color: "error" }
    : isPending
    ? { label: "Pending Review", color: "warning" }
    : { label: "Verified", color: "success" };

  const welcomeSubtitle = isRejected
    ? "There was an issue with your verification. Please review and resubmit your documents."
    : isPending
    ? "Your account is under review. You can explore the dashboard while you wait."
    : `Here's what's happening across your ${stats.totalProperties} ${stats.totalProperties === 1 ? "property" : "properties"} today.`;

  return (
    <Container maxWidth="xl" disableGutters>
      
      {/* Header Banner */}
      <Box
        sx={{
          display: "flex",
          flexDirection: { xs: "column", sm: "row" },
          justifyContent: "space-between",
          alignItems: { xs: "flex-start", sm: "center" },
          gap: 2,
          mb: 3,
        }}
      >
        <Box>
          <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap" useFlexGap>
            <Typography variant="h5" fontWeight="800">Welcome, {ownerName}</Typography>
            <Chip size="small" label={statusChip.label} color={statusChip.color} variant={statusChip.color === "success" ? "outlined" : "filled"} />
          </Stack>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {welcomeSubtitle}
          </Typography>
        </Box>
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

      {/* Your Properties */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h6" fontWeight="700" sx={{ mb: 2 }}>
          Your Properties
        </Typography>
        {properties.length === 0 ? (
          <Paper elevation={0} sx={{ p: 4, textAlign: "center", border: "1px dashed", borderColor: "divider", borderRadius: 3 }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              You haven't added a property yet.
            </Typography>
            <Tooltip title={isPending ? "Account pending approval. Adding properties is disabled." : ""}>
              <span>
                <Button
                  variant="contained"
                  startIcon={isPending ? <LockIcon /> : <AddHomeWorkIcon />}
                  onClick={() => navigate("/owner/properties/new")}
                  disabled={isPending}
                >
                  Add Your First Property
                </Button>
              </span>
            </Tooltip>
          </Paper>
        ) : (
          <Grid container spacing={2.5}>
            {properties.map((property) => (
              <Grid size={{ xs: 12, sm: 6, md: 4 }} key={property.id}>
                <PropertyCard property={property} onClick={() => navigate(`/owner/properties/${property.id}`)} />
              </Grid>
            ))}
          </Grid>
        )}
      </Box>

      {/* Top Metrics Row */}
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

      {/* Bottom Dashboard Panels */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {/* Left Panel */}
        <Grid size={{ xs: 12, md: 6 }}>
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
        <Grid size={{ xs: 12, md: 6 }}>
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