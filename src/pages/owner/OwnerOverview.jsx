import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Container,
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
  GlobalStyles,
  IconButton,
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
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import LockIcon from "@mui/icons-material/Lock";
import AddHomeWorkIcon from "@mui/icons-material/AddHomeWork";
import { collection, query, where, onSnapshot, doc, setDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db, storage } from "../../config/firebase";
import { alpha } from "@mui/material/styles";

// Windows light up once on load; switched off for "reduce motion" users.
const AnimationStyles = (
  <GlobalStyles
    styles={{
      "@keyframes kkPop": {
        from: { opacity: 0, transform: "scale(0.6)" },
        to: { opacity: 1, transform: "scale(1)" },
      },
      "@media (prefers-reduced-motion: reduce)": {
        "*, *::before, *::after": {
          animationDuration: "0.001ms !important",
          transitionDuration: "0.001ms !important",
        },
      },
    }}
  />
);

/* ---------------------------------------------------------------------------
   Brand visual: the dorm-facade windows from the login/landing pages, used as
   a tiny data chart. 30 windows = 100% occupancy; the lit (orange) ones are
   scattered in a fixed order so it reads as a building, not a progress bar.
   ------------------------------------------------------------------------- */
const WINDOW_COUNT = 30;
const LIGHT_ORDER = [3, 17, 8, 24, 1, 12, 27, 5, 20, 14, 9, 29, 2, 22, 11, 6, 25, 16, 0, 19, 28, 7, 13, 23, 4, 21, 10, 26, 15, 18];
const WINDOW_RANK = LIGHT_ORDER.reduce((acc, cell, rank) => ({ ...acc, [cell]: rank }), {});

function OccupancyWindows({ rate, occupied, total }) {
  const rawLit = total > 0 ? Math.round((rate / 100) * WINDOW_COUNT) : 0;
  const litCount = rate > 0 ? Math.max(1, rawLit) : 0;

  return (
    <Box>
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: "repeat(10, 1fr)",
          gap: { xs: 0.75, md: 1 },
          width: "100%",
          maxWidth: 320,
        }}
      >
        {Array.from({ length: WINDOW_COUNT }).map((_, i) => (
          <Box
            key={i}
            sx={{
              aspectRatio: "1",
              borderRadius: "4px",
              bgcolor: WINDOW_RANK[i] < litCount ? "primary.main" : "rgba(202, 220, 246, 0.14)",
              animation: `kkPop 0.4s ease-out ${i * 18}ms both`,
            }}
          />
        ))}
      </Box>
      <Typography variant="caption" sx={{ color: "#cadcf6", display: "block", mt: 1.25 }}>
        {total > 0 ? `${occupied} of ${total} beds occupied` : "Add rooms to start tracking occupancy"}
      </Typography>
    </Box>
  );
}

function MetricBox({ title, value, subtitle, icon, subtitleColor = "text.secondary" }) {
  return (
    <Card elevation={0} sx={{ bgcolor: "background.default", border: "1px solid", borderColor: "divider", borderRadius: 3, height: "100%" }}>
      <CardContent sx={{ p: { xs: 1.75, sm: 2.5 }, "&:last-child": { pb: { xs: 1.75, sm: 2.5 } } }}>
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 1, mb: 1 }}>
          <Typography variant="body2" color="text.secondary" fontWeight="600" sx={{ lineHeight: 1.3 }}>
            {title}
          </Typography>
          <Box
            sx={{
              p: { xs: 0.75, sm: 1 },
              borderRadius: 2,
              bgcolor: "rgba(255, 69, 0, 0.1)",
              color: "primary.main",
              display: "flex",
              flexShrink: 0,
            }}
          >
            {icon}
          </Box>
        </Box>
        <Typography
          variant="h4"
          fontWeight="800"
          sx={{ fontFamily: '"Inter", sans-serif', fontSize: { xs: "1.5rem", sm: "2.125rem" }, wordBreak: "break-word" }}
        >
          {value}
        </Typography>
        <Typography variant="caption" sx={{ color: subtitleColor }}>
          {subtitle}
        </Typography>
      </CardContent>
    </Card>
  );
}

function PropertyCard({ property, onClick }) {
  return (
    <Card
      elevation={0}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onClick();
        }
      }}
      sx={{
        bgcolor: "background.default",
        border: "1px solid",
        borderColor: "divider",
        borderRadius: 3,
        height: "100%",
        cursor: "pointer",
        overflow: "hidden",
        transition: "border-color 0.15s ease, box-shadow 0.15s ease",
        "@media (hover: hover)": {
          "&:hover": { borderColor: "primary.main", boxShadow: "0 6px 18px rgba(0,0,0,0.06)" },
        },
        "&:focus-visible": { outline: "2px solid", outlineColor: "primary.main", outlineOffset: 2 },
      }}
    >
      <Box
        sx={{
          height: 120,
          bgcolor: (theme) => alpha(theme.palette.background.paper, 0.7),
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

// Swipeable carousel of property cards: scroll-snap on touch, arrow buttons on
// larger screens, and dots showing where you are.
function PropertyCarousel({ properties, onOpen }) {
  const trackRef = useRef(null);
  const [active, setActive] = useState(0);
  const [edges, setEdges] = useState({ start: true, end: true });

  const updateState = () => {
    const el = trackRef.current;
    if (!el) return;
    const items = Array.from(el.children);
    const left = el.scrollLeft;
    let nearest = 0;
    let best = Infinity;
    items.forEach((child, i) => {
      const d = Math.abs(child.offsetLeft - el.offsetLeft - left);
      if (d < best) { best = d; nearest = i; }
    });
    setActive(nearest);
    setEdges({ start: left <= 2, end: left + el.clientWidth >= el.scrollWidth - 2 });
  };

  useEffect(() => {
    updateState();
    window.addEventListener("resize", updateState);
    return () => window.removeEventListener("resize", updateState);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [properties.length]);

  const scrollByPage = (dir) => {
    const el = trackRef.current;
    if (!el) return;
    const first = el.children[0];
    const step = first ? first.getBoundingClientRect().width + 16 : el.clientWidth;
    el.scrollBy({ left: dir * step, behavior: "smooth" });
  };

  const goTo = (i) => {
    const el = trackRef.current;
    const child = el?.children[i];
    if (child) el.scrollTo({ left: child.offsetLeft - el.offsetLeft, behavior: "smooth" });
  };

  const showControls = properties.length > 1;
  const arrowSx = (side) => ({
    display: { xs: "none", sm: "inline-flex" },
    position: "absolute",
    top: "40%",
    [side]: -14,
    zIndex: 2,
    bgcolor: "background.default",
    border: "1px solid",
    borderColor: "divider",
    boxShadow: 2,
    "&:hover": { bgcolor: "background.default" },
  });

  return (
    <Box sx={{ position: "relative" }}>
      {showControls && !edges.start && (
        <IconButton size="small" aria-label="Previous properties" onClick={() => scrollByPage(-1)} sx={arrowSx("left")}>
          <ChevronLeftIcon />
        </IconButton>
      )}
      {showControls && !edges.end && (
        <IconButton size="small" aria-label="Next properties" onClick={() => scrollByPage(1)} sx={arrowSx("right")}>
          <ChevronRightIcon />
        </IconButton>
      )}

      <Box
        ref={trackRef}
        onScroll={updateState}
        sx={{
          display: "flex",
          gap: 2,
          overflowX: "auto",
          scrollSnapType: "x mandatory",
          scrollBehavior: "smooth",
          WebkitOverflowScrolling: "touch",
          // bleed to the screen edge on phones (matches the layout's 16px padding)
          mx: { xs: -2, sm: 0 },
          px: { xs: 2, sm: 0 },
          scrollPaddingLeft: { xs: "16px", sm: 0 },
          pb: 1,
          scrollbarWidth: "none",
          "&::-webkit-scrollbar": { display: "none" },
        }}
      >
        {properties.map((property) => (
          <Box
            key={property.id}
            sx={{
              flex: {
                xs: properties.length > 1 ? "0 0 82%" : "1 1 100%",
                sm: properties.length > 1 ? "0 0 calc((100% - 16px) / 2)" : "1 1 100%",
                md: properties.length > 1 ? "0 0 calc((100% - 32px) / 3)" : "0 0 calc((100% - 32px) / 3)",
              },
              scrollSnapAlign: "start",
              minWidth: 0,
            }}
          >
            <PropertyCard property={property} onClick={() => onOpen(property)} />
          </Box>
        ))}
      </Box>

      {showControls && (
        <Box sx={{ display: "flex", justifyContent: "center", gap: 0.75, mt: 1 }}>
          {properties.map((property, i) => (
            <Box
              key={property.id}
              component="button"
              type="button"
              aria-label={`Go to property ${i + 1}`}
              onClick={() => goTo(i)}
              sx={{
                p: 0,
                border: 0,
                cursor: "pointer",
                height: 8,
                width: i === active ? 22 : 8,
                borderRadius: 4,
                bgcolor: i === active ? "primary.main" : "divider",
                transition: "width .25s ease, background-color .25s ease",
              }}
            />
          ))}
        </Box>
      )}
    </Box>
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
  const [setupError, setSetupError] = useState("");

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

          tenantPropertyUnsubscribers.forEach((unsubscribe) => unsubscribe());
          tenantPropertyUnsubscribers = [];
          
          [...tenantSources.keys()]
            .filter((sourceId) => sourceId.startsWith("property:"))
            .forEach((sourceId) => tenantSources.delete(sourceId));

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
      unsubscribeAuth();
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

      const idRef = ref(storage, `verifications/${ownerId}/id_document`);
      await uploadBytes(idRef, idFile);
      const idUrl = await getDownloadURL(idRef);

      const clearanceRef = ref(storage, `verifications/${ownerId}/clearance_document`);
      await uploadBytes(clearanceRef, clearanceFile);
      const clearanceUrl = await getDownloadURL(clearanceRef);

      await setDoc(doc(db, "users", ownerId), {
        approvalStatus: "pending",
        verificationDocs: {
          idUrl: idUrl,
          clearanceUrl: clearanceUrl,
          submittedAt: new Date().toISOString(),
        }
      }, { merge: true });

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
      <Container maxWidth="sm" disableGutters sx={{ py: { xs: 1, md: 6 } }}>
        <Paper elevation={0} sx={{ bgcolor: "background.default", p: { xs: 2.5, md: 5 }, border: "1px solid", borderColor: "divider", borderRadius: 3 }}>
          <Typography variant="h5" fontWeight="800" sx={{ mb: 1, fontFamily: '"Inter", sans-serif' }}>
            Complete Your Property Setup
          </Typography>
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
            <Box sx={{ mb: 4, display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1.5 }}>
              <Button component="label" variant="outlined" startIcon={<UploadFileIcon />}>
                Choose File
                <input type="file" hidden required onChange={(e) => setIdFile(e.target.files[0])} accept="image/*,.pdf" />
              </Button>
              <Typography variant="body2" sx={{ minWidth: 0, wordBreak: "break-word" }}>
                {idFile ? idFile.name : "No file selected"}
              </Typography>
            </Box>

            <Typography variant="subtitle2" fontWeight="700" sx={{ mb: 1 }}>Proof of Ownership / Barangay Clearance</Typography>
            <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 1 }}>
              Upload your business permit, barangay clearance, or utility bill.
            </Typography>
            <Box sx={{ mb: 4, display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1.5 }}>
              <Button component="label" variant="outlined" startIcon={<UploadFileIcon />}>
                Choose File
                <input type="file" hidden required onChange={(e) => setClearanceFile(e.target.files[0])} accept="image/*,.pdf" />
              </Button>
              <Typography variant="body2" sx={{ minWidth: 0, wordBreak: "break-word" }}>
                {clearanceFile ? clearanceFile.name : "No file selected"}
              </Typography>
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

  // Status pill tuned for the dark hero (the stock MUI chip colors are too
  // dim on #202020).
  const statusTone = isRejected
    ? { label: "Action Needed", bg: "rgba(244, 67, 54, 0.18)", fg: "#ef9a9a" }
    : isPending
    ? { label: "Pending Review", bg: "rgba(255, 167, 38, 0.18)", fg: "#ffcc80" }
    : { label: "Verified", bg: "rgba(76, 175, 80, 0.18)", fg: "#a5d6a7" };

  const welcomeSubtitle = isRejected
    ? "There was an issue with your verification. Please review and resubmit your documents."
    : isPending
    ? "Your account is under review. You can explore the dashboard while you wait."
    : `Here's what's happening across your ${stats.totalProperties} ${stats.totalProperties === 1 ? "property" : "properties"} today.`;

  const handleAddPropertyClick = () => {
    if (isPending) return;
    navigate("/setup");
  };

  const addPropertyTooltip = isPending ? "Account pending approval. Adding properties is disabled." : "Add a new property";

  return (
    <Container maxWidth="xl" disableGutters>
      {AnimationStyles}

      {/* Welcome hero — the dark brand surface from the login/landing pages,
          with occupancy drawn as lit windows. */}
      <Box
        sx={{
          position: "relative",
          overflow: "hidden",
          bgcolor: "#202020",
          color: "#ffffff",
          borderRadius: 4,
          p: { xs: 2.5, sm: 4 },
          mb: 3,
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "1.2fr 0.8fr" },
          gap: { xs: 3, md: 4 },
          alignItems: "center",
        }}
      >
        <Box
          sx={{
            position: "absolute",
            top: -140,
            right: -100,
            width: 380,
            height: 380,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(255, 69, 0, 0.22), transparent 70%)",
            pointerEvents: "none",
          }}
        />

        <Box sx={{ position: "relative" }}>
          <Chip
            size="small"
            label={statusTone.label}
            sx={{ bgcolor: statusTone.bg, color: statusTone.fg, fontWeight: 700, mb: 1.5 }}
          />
          <Typography
            variant="h4"
            component="h1"
            sx={{
              fontFamily: '"Inter", sans-serif',
              fontWeight: 900,
              color: "#ffffff",
              fontSize: { xs: "1.6rem", sm: "2.1rem" },
              lineHeight: 1.15,
              wordBreak: "break-word",
            }}
          >
            Welcome, {ownerName}
          </Typography>
          <Typography variant="body2" sx={{ color: "#cadcf6", mt: 1, maxWidth: 460 }}>
            {welcomeSubtitle}
          </Typography>
          <Tooltip title={addPropertyTooltip}>
            <span style={{ display: "block" }}>
              <Button
                variant="contained"
                startIcon={isPending ? <LockIcon /> : <AddHomeWorkIcon />}
                onClick={handleAddPropertyClick}
                disabled={isPending}
                sx={{
                  mt: 2.5,
                  width: { xs: "100%", sm: "auto" },
                  fontWeight: 700,
                  "&.Mui-disabled": { bgcolor: "rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.45)" },
                }}
              >
                Add Property
              </Button>
            </span>
          </Tooltip>
        </Box>

        <Box sx={{ position: "relative" }}>
          <OccupancyWindows rate={stats.occupancyRate} occupied={stats.occupiedBeds} total={stats.totalBeds} />
        </Box>
      </Box>

      {/* Pending Account Alert */}
      {isPending && (
        <Alert severity="warning" sx={{ mb: 3, borderRadius: 2 }}>
          <strong>Account Pending Approval:</strong> Your verification documents and property are currently under review by our admin team. You can explore the dashboard, but property management actions (adding tenants, inviting caretakers, adding properties) are locked until approval.
        </Alert>
      )}

      {/* Top Metrics — 2x2 on phones, 4 across on desktop */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "repeat(2, 1fr)", md: "repeat(4, 1fr)" },
          gap: { xs: 1.5, md: 2.5 },
          mb: 4,
        }}
      >
        <MetricBox
          title="Properties"
          value={stats.totalProperties}
          subtitle={`${stats.totalBeds} total beds`}
          icon={<HomeWorkIcon fontSize="small" />}
        />
        <MetricBox
          title="Occupancy"
          value={`${stats.occupancyRate}%`}
          subtitle={`${stats.occupiedBeds} / ${stats.totalBeds} occupied`}
          icon={<PeopleIcon fontSize="small" />}
        />
        <MetricBox
          title="Collected This Month"
          value={`₱${stats.collectedThisMonth.toLocaleString()}`}
          subtitle={stats.totalRevenue > 0 ? `Target: ₱${stats.totalRevenue.toLocaleString()}` : "Paid rent this month"}
          icon={<AttachMoneyIcon fontSize="small" />}
        />
        <MetricBox
          title="Pending Repairs"
          value={stats.pendingMaintenance}
          subtitle={`${stats.urgentMaintenance} urgent`}
          subtitleColor={stats.urgentMaintenance > 0 ? "warning.main" : "text.secondary"}
          icon={<BuildOutlinedIcon fontSize="small" />}
        />
      </Box>

      {/* Your Properties — carousel */}
      <Box sx={{ mb: 4 }}>
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 2 }}>
          <Typography variant="h6" fontWeight="700" sx={{ fontFamily: '"Inter", sans-serif' }}>
            Your Properties
          </Typography>
          {properties.length > 0 && (
            <Button size="small" onClick={() => navigate("/owner/properties")} sx={{ fontWeight: 600 }}>
              View all
            </Button>
          )}
        </Box>
        {properties.length === 0 ? (
          <Paper elevation={0} sx={{ bgcolor: "background.default", p: 4, textAlign: "center", border: "1px dashed", borderColor: "divider", borderRadius: 3 }}>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              You haven't added a property yet.
            </Typography>
            <Tooltip title={addPropertyTooltip}>
              <span>
                <Button
                  variant="contained"
                  startIcon={isPending ? <LockIcon /> : <AddHomeWorkIcon />}
                  onClick={handleAddPropertyClick}
                  disabled={isPending}
                >
                  Add Your First Property
                </Button>
              </span>
            </Tooltip>
          </Paper>
        ) : (
          <PropertyCarousel properties={properties} onOpen={(property) => navigate(`/owner/properties/${property.id}`)} />
        )}
      </Box>

      {/* Bottom Dashboard Panels */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
          gap: { xs: 2, md: 3 },
          mb: 2,
        }}
      >
        {/* Left Panel */}
        <Paper elevation={0} sx={{ bgcolor: "background.default", p: { xs: 2, sm: 3 }, border: "1px solid", borderColor: "divider", borderRadius: 3 }}>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 1.5, mb: 2 }}>
            <Typography variant="h6" fontWeight="700" sx={{ fontFamily: '"Inter", sans-serif' }}>
              Recent Rent Collections
            </Typography>
            <Button size="small" variant="outlined" startIcon={<ReceiptLongIcon />} onClick={() => navigate("/owner/payments")}>
              View Payments
            </Button>
          </Box>
          <Stack spacing={1.5}>
            {recentPayments.length === 0 ? (
              <Typography variant="body2" color="text.secondary">No payments logged recently.</Typography>
            ) : (
              recentPayments.map((p) => (
                <Box
                  key={p.id}
                  sx={{
                    p: 1.5,
                    borderRadius: 2,
                    bgcolor: (theme) => alpha(theme.palette.background.paper, 0.35),
                    border: "1px solid",
                    borderColor: "divider",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 1.5,
                  }}
                >
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="subtitle2" fontWeight="700" sx={{ wordBreak: "break-word" }}>
                      {p.tenantName} — ₱{Number(p.amount).toLocaleString()}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ wordBreak: "break-word" }}>
                      {p.propertyName} (Room {p.roomNumber})
                    </Typography>
                  </Box>
                  <Chip
                    label={p.status || "Paid"}
                    color={p.status === "Paid" ? "success" : "warning"}
                    size="small"
                    sx={{ flexShrink: 0 }}
                  />
                </Box>
              ))
            )}
          </Stack>
        </Paper>

        {/* Right Panel */}
        <Paper elevation={0} sx={{ bgcolor: "background.default", p: { xs: 2, sm: 3 }, border: "1px solid", borderColor: "divider", borderRadius: 3 }}>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 1.5, mb: 2 }}>
            <Typography variant="h6" fontWeight="700" sx={{ fontFamily: '"Inter", sans-serif' }}>
              Tenants & Caretakers
            </Typography>
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

          <Box sx={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 1.5 }}>
            <Box sx={{ p: 2, borderRadius: 2, bgcolor: "rgba(46, 125, 50, 0.08)" }}>
              <Typography variant="caption" color="text.secondary" fontWeight="600">Active Tenants</Typography>
              <Typography variant="h5" fontWeight="800" color="success.main">{stats.activeTenants}</Typography>
            </Box>
            <Box sx={{ p: 2, borderRadius: 2, bgcolor: "rgba(237, 108, 2, 0.08)" }}>
              <Typography variant="caption" color="text.secondary" fontWeight="600">Pending Registration</Typography>
              <Typography variant="h5" fontWeight="800" color="warning.main">{stats.pendingTenants}</Typography>
            </Box>
          </Box>

          <Box
            sx={{
              mt: 2.5,
              pt: 2,
              borderTop: "1px solid",
              borderColor: "divider",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 1.5,
            }}
          >
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
      </Box>
    </Container>
  );
}