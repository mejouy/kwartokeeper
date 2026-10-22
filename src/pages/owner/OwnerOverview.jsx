import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Container,
  Paper,
  Typography,
  Button,
  Chip,
  Card,
  LinearProgress,
  CircularProgress,
  Alert,
  Tooltip,
  ButtonBase,
  GlobalStyles,
  IconButton,
  Skeleton,
  Avatar,
} from "@mui/material";
import HomeWorkIcon from "@mui/icons-material/HomeWork";
import HomeWorkOutlinedIcon from "@mui/icons-material/HomeWorkOutlined";
import PeopleOutlineIcon from "@mui/icons-material/PeopleOutlined";
import PaymentsOutlinedIcon from "@mui/icons-material/PaymentsOutlined";
import BuildOutlinedIcon from "@mui/icons-material/BuildOutlined";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import PersonAddAlt1OutlinedIcon from "@mui/icons-material/PersonAddAlt1Outlined";
import GroupAddOutlinedIcon from "@mui/icons-material/GroupAddOutlined";
import BadgeOutlinedIcon from "@mui/icons-material/BadgeOutlined";
import CampaignOutlinedIcon from "@mui/icons-material/CampaignOutlined";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import ChevronLeftIcon from "@mui/icons-material/ChevronLeft";
import ChevronRightIcon from "@mui/icons-material/ChevronRight";
import ArrowForwardRoundedIcon from "@mui/icons-material/ArrowForwardRounded";
import LockIcon from "@mui/icons-material/Lock";
import AddHomeWorkIcon from "@mui/icons-material/AddHomeWork";
import EventBusyOutlinedIcon from "@mui/icons-material/EventBusyOutlined";
import { collection, query, where, onSnapshot, doc, setDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../../config/firebase";
import { normalizePayment } from "../../utils/normalizePayment";
import { addMonthsClamped } from "../../utils/addMonthsClamped";
import { uploadFileToCloudinary } from "../../utils/cloudinary";
import { rankMaintenanceRequests } from "../../utils/maintenancePrioritization";
import { ownerAccessOf, resubmissionPatch } from "../../utils/ownerAccess";
import { occupancyOf, holdsBed, isMovingIn } from "../../utils/occupancy";
import { alpha } from "@mui/material/styles";

const INK = "#202020";
const HEAD = '"Inter", sans-serif';
// One set of corner radii for the page
const R = { sm: "10px", md: "14px", lg: "18px", xl: "22px" };
const LOCKED_TIP = "Available once your account is approved";

// Squares pop in once on load; switched off for "reduce motion" users.
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
   Small helpers
   ------------------------------------------------------------------------- */
const toDate = (v) => {
  if (!v) return null;
  const d = typeof v?.toDate === "function" ? v.toDate() : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};
const paymentDateOf = (p) => toDate(p.paymentDate) || toDate(p.createdAt);
const peso = (n) => `₱${Number(n || 0).toLocaleString()}`;
const currentPeriod = () => new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" });
const MAX_DOC_MB = 10;

// Lease end for a tenant record: an explicit end date, else start + duration.
const LEASE_MONTHS = { "3_months": 3, "6_months": 6, "12_months": 12 };
const LEASE_WARN_DAYS = 30;
function leaseDaysLeft(tenant) {
  const start = toDate(tenant.leaseStartDate || tenant.leaseStart || tenant.startDate || tenant.moveInDate);
  let end = toDate(tenant.leaseEndDate || tenant.leaseEnd || tenant.endDate || tenant.moveOutDate);
  const months = LEASE_MONTHS[tenant.leaseDuration];
  if (!end && start && months) end = addMonthsClamped(new Date(start), months);
  if (!end || (start && end <= start)) return null; // open-ended
  return Math.ceil((end.getTime() - Date.now()) / 86400000);
}
const tenantLabel = (t) => t.fullName || t.name || t.tenantName || "A tenant";

// A file picker row used by both verification forms
function FilePickRow({ label, hint, file, onChange }) {
  return (
    <Box sx={{ mb: 3 }}>
      <Typography variant="subtitle2" sx={{ fontWeight: "700", mb: 0.5 }}>{label}</Typography>
      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 1 }}>{hint}</Typography>
      <Box sx={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 1.5 }}>
        <Button component="label" variant="outlined" startIcon={<UploadFileIcon />} sx={{ minHeight: 44 }}>
          {file ? "Change file" : "Choose file"}
          <input type="file" hidden onChange={(e) => onChange(e.target.files?.[0] || null)} accept="image/*,.pdf" />
        </Button>
        <Typography variant="body2" color={file ? "text.primary" : "text.secondary"} sx={{ minWidth: 0, wordBreak: "break-word" }}>
          {file ? file.name : "No file selected"}
        </Typography>
      </Box>
    </Box>
  );
}

/* ---------------------------------------------------------------------------
   Occupancy as room squares (same motif as the login/landing pages):
   30 squares = 100%; the lit (orange) ones are scattered in a fixed order
   so it reads as a building, not a progress bar.
   ------------------------------------------------------------------------- */
const SQUARE_COUNT = 30;
const LIGHT_ORDER = [3, 17, 8, 24, 1, 12, 27, 5, 20, 14, 9, 29, 2, 22, 11, 6, 25, 16, 0, 19, 28, 7, 13, 23, 4, 21, 10, 26, 15, 18];
const SQUARE_RANK = LIGHT_ORDER.reduce((acc, cell, rank) => ({ ...acc, [cell]: rank }), {});

function OccupancyPanel({ rate, occupied, total }) {
  const rawLit = total > 0 ? Math.round((rate / 100) * SQUARE_COUNT) : 0;
  const litCount = rate > 0 ? Math.max(1, rawLit) : 0;

  return (
    <Box sx={{ borderRadius: R.lg, bgcolor: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", p: { xs: 2, sm: 2.5 } }}>
      <Box sx={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 1, mb: 1.75 }}>
        <Typography sx={{ fontFamily: HEAD, fontWeight: 700, fontSize: 12, letterSpacing: ".1em", textTransform: "uppercase", color: "rgba(255,255,255,0.6)" }}>
          Occupancy
        </Typography>
        <Typography sx={{ fontFamily: HEAD, fontWeight: 900, fontSize: { xs: "1.6rem", sm: "1.9rem" }, lineHeight: 1, color: "#fff" }}>
          {rate}%
        </Typography>
      </Box>
      <Box
        role="img"
        aria-label={`Occupancy ${rate}%`}
        sx={{ display: "grid", gridTemplateColumns: "repeat(10, minmax(0, 1fr))", gap: { xs: 0.75, md: 1 } }}
      >
        {Array.from({ length: SQUARE_COUNT }).map((_, i) => (
          <Box
            key={i}
            sx={{
              aspectRatio: "1",
              borderRadius: "4px",
              bgcolor: SQUARE_RANK[i] < litCount ? "primary.main" : "rgba(202, 220, 246, 0.14)",
              animation: `kkPop 0.4s ease-out ${i * 18}ms both`,
            }}
          />
        ))}
      </Box>
      <Typography variant="caption" sx={{ color: "#cadcf6", display: "block", mt: 1.5 }}>
        {total > 0 ? `${occupied} of ${total} beds occupied` : "Add rooms to start tracking occupancy"}
      </Typography>
    </Box>
  );
}

/** White surface used by every panel on the page. */
const panelSx = { bgcolor: "background.default", border: "1px solid", borderColor: "divider", borderRadius: R.lg };

function Panel({ title, action, children, sx }) {
  return (
    <Paper elevation={0} sx={{ ...panelSx, p: { xs: 2, sm: 2.5 }, height: "100%", display: "flex", flexDirection: "column", ...sx }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 1.5, mb: 2, minHeight: 32 }}>
        <Typography component="h2" sx={{ fontFamily: HEAD, fontWeight: 800, fontSize: { xs: "1.05rem", sm: "1.15rem" }, letterSpacing: "-0.01em" }}>
          {title}
        </Typography>
        {action}
      </Box>
      {children}
    </Paper>
  );
}

function MetricCard({ title, value, subtitle, icon, onClick, progress, subtitleColor = "text.secondary" }) {
  const clickable = Boolean(onClick);
  return (
    <Card elevation={0} sx={{ ...panelSx, height: "100%", overflow: "hidden", transition: "border-color .15s, box-shadow .15s", ...(clickable && { "@media (hover: hover)": { "&:hover": { borderColor: "primary.main", boxShadow: "0 10px 24px -18px rgba(32,32,32,.45)" } } }) }}>
      <Box
        component={clickable ? ButtonBase : "div"}
        onClick={onClick}
        sx={{
          display: "block",
          width: "100%",
          height: "100%",
          textAlign: "left",
          p: { xs: 1.75, sm: 2.25 },
          "&:focus-visible": { outline: "2px solid", outlineColor: "primary.main", outlineOffset: -2 },
        }}
      >
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", mb: { xs: 1.25, sm: 1.75 } }}>
          <Box sx={{ width: { xs: 34, sm: 40 }, height: { xs: 34, sm: 40 }, borderRadius: R.sm, bgcolor: "rgba(255, 69, 0, 0.1)", color: "primary.main", display: "grid", placeItems: "center" }}>
            {icon}
          </Box>
          {clickable && <ArrowForwardRoundedIcon sx={{ fontSize: 18, color: "text.disabled" }} />}
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600, lineHeight: 1.3 }}>
          {title}
        </Typography>
        <Typography sx={{ fontFamily: HEAD, fontWeight: 800, letterSpacing: "-0.02em", fontSize: { xs: "1.45rem", sm: "1.9rem" }, lineHeight: 1.2, mt: 0.25, overflowWrap: "anywhere" }}>
          {value}
        </Typography>
        {progress !== undefined && (
          <LinearProgress
            variant="determinate"
            value={Math.min(100, Math.max(0, progress))}
            sx={{ height: 6, borderRadius: 3, my: 0.75, bgcolor: (t) => alpha(t.palette.text.primary, 0.08) }}
          />
        )}
        <Typography variant="caption" sx={{ color: subtitleColor, display: "block", lineHeight: 1.4 }}>
          {subtitle}
        </Typography>
      </Box>
    </Card>
  );
}

function PropertyCard({ property, onClick }) {
  const clickable = Boolean(onClick);
  return (
    <Card
      elevation={0}
      onClick={onClick}
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={(e) => {
        if (clickable && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onClick();
        }
      }}
      sx={{
        ...panelSx,
        height: "100%",
        cursor: clickable ? "pointer" : "default",
        overflow: "hidden",
        transition: "border-color 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease",
        ...(clickable && {
          "@media (hover: hover)": {
            "&:hover": { borderColor: "primary.main", boxShadow: "0 12px 26px -18px rgba(32,32,32,.45)", transform: "translateY(-2px)" },
          },
        }),
        "&:focus-visible": { outline: "2px solid", outlineColor: "primary.main", outlineOffset: 2 },
      }}
    >
      <Box
        sx={{
          height: 128,
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
        {!property.coverPhotoUrl && <HomeWorkIcon sx={{ fontSize: 38, color: "text.disabled" }} />}
      </Box>
      <Box sx={{ p: 2 }}>
        <Typography sx={{ fontFamily: HEAD, fontWeight: 800, fontSize: "1rem" }} noWrap>
          {property.propertyName}
        </Typography>
        <Typography variant="caption" color="text.secondary" noWrap sx={{ display: "block", mb: 1.25 }}>
          {property.propertyType || "Property"}
        </Typography>
        <Box sx={{ display: "flex", gap: 1 }}>
          {[`${property.totalRooms} rooms`, `${property.totalBeds} beds`].map((label) => (
            <Box key={label} sx={{ px: 1, py: 0.25, borderRadius: "6px", bgcolor: (t) => alpha(t.palette.background.paper, 0.8), fontSize: 12, fontWeight: 700 }}>
              {label}
            </Box>
          ))}
        </Box>
      </Box>
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
            <PropertyCard property={property} onClick={onOpen ? () => onOpen(property) : undefined} />
          </Box>
        ))}
      </Box>

      {showControls && (
        <Box sx={{ display: "flex", justifyContent: "center", flexWrap: "wrap", gap: 0.75, mt: 1 }}>
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
  const [propsLoaded, setPropsLoaded] = useState(false);
  
  // Verification form
  const [idFile, setIdFile] = useState(null);
  const [clearanceFile, setClearanceFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [setupError, setSetupError] = useState("");
  const [resubmitting, setResubmitting] = useState(false);
  const [resubmitDone, setResubmitDone] = useState(false);

  const [stats, setStats] = useState({
    totalProperties: 0,
    totalBeds: 0,
    occupancyRate: 0,
    occupiedBeds: 0,
    expectedRent: 0,
    activeTenants: 0,
    pendingTenants: 0,
    totalCaretakers: 0,
    leaseEnded: [],
    leaseSoon: [],
  });

  const [tickets, setTickets] = useState([]);
  const [payments, setPayments] = useState([]);

  const propertiesDataRef = useRef({ count: 0, totalBeds: 0, propertyIds: [], list: [] });
  const tenantsDataRef = useRef([]);

  useEffect(() => {
    let unsubOwner, unsubProperties, unsubTenants, unsubUserTenants, unsubCaretakers, unsubPayments, unsubTickets;
    let tenantPropertyUnsubscribers = [];
    const tenantSources = new Map();

    // Stops every listener (used when the user changes and when the page unmounts)
    const cleanup = () => {
      [unsubOwner, unsubProperties, unsubTenants, unsubUserTenants, unsubCaretakers, unsubPayments, unsubTickets].forEach((u) => u && u());
      unsubOwner = unsubProperties = unsubTenants = unsubUserTenants = unsubCaretakers = unsubPayments = unsubTickets = undefined;
      tenantPropertyUnsubscribers.forEach((u) => u());
      tenantPropertyUnsubscribers = [];
      tenantSources.clear();
    };

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      cleanup();
      if (!user) {
        setLoading(false);
        setPropsLoaded(true);
        setOwner((o) => o || {});
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
        const ownerPropertyIds = new Set(propertiesDataRef.current.propertyIds);
        const ownerTenants = tenantsDataRef.current.filter((tenant) =>
          tenant.ownerUid === currentOwnerId || ownerPropertyIds.has(tenant.propertyId)
        );
        // Beds come from bed assignments, with the same rule as Properties and Reports
        const occ = occupancyOf(propertiesDataRef.current.list, ownerTenants);

        let active = 0;
        let pending = 0;
        let expected = 0;
        const leaseEnded = [];
        const leaseSoon = [];
        ownerTenants.forEach((tenant) => {
          if (!holdsBed(tenant)) return;
          if (isMovingIn(tenant)) pending++;
          else {
            active++;
            expected += Number(tenant.monthlyRent ?? tenant.rentAmount ?? tenant.roomMonthlyRate ?? tenant.monthlyRate ?? tenant.rent ?? 0) || 0;

            const left = leaseDaysLeft(tenant);
            if (left !== null && left < 0) leaseEnded.push({ id: tenant.uid || tenant.id, name: tenantLabel(tenant), left });
            else if (left !== null && left <= LEASE_WARN_DAYS) leaseSoon.push({ id: tenant.uid || tenant.id, name: tenantLabel(tenant), left });
          }
        });
        
        const propertiesCount = propertiesDataRef.current.count;

        setStats((prev) => ({
          ...prev,
          totalProperties: propertiesCount,
          totalBeds: occ.beds,
          activeTenants: active,
          pendingTenants: pending,
          occupiedBeds: occ.occupied,
          expectedRent: expected,
          occupancyRate: occ.rate,
          leaseEnded,
          leaseSoon: leaseSoon.sort((a, b) => a.left - b.left),
        }));
      };

      // 0. Listen to Owner Profile
      unsubOwner = onSnapshot(
        doc(db, "users", ownerId),
        // A missing profile still opens the dashboard (treated as approved) instead of spinning forever
        (docSnap) => setOwner(docSnap.exists() ? docSnap.data() : {}),
        (error) => {
          console.error("Error fetching owner profile:", error);
          setOwner((o) => o || {});
        }
      );

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
            list: propertyList.map((p) => ({ id: p.id, beds: p.totalBeds })),
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
          setPropsLoaded(true);
          recalculateOccupancy(ownerId);
        },
        (error) => {
          console.error("Error fetching properties:", error);
          setPropsLoaded(true);
        }
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

      // 4. Payments: only what the dashboard shows (this and last month's rent, and
      // anything waiting for review), not the owner's whole payment history
      const now = new Date();
      const monthLabel = (d) => d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
      const periods = [monthLabel(now), monthLabel(new Date(now.getFullYear(), now.getMonth() - 1, 1))];
      const paymentSources = new Map();
      const publishPayments = () => {
        const byId = new Map();
        paymentSources.forEach((list) => list.forEach((p) => byId.set(p.id, p)));
        setPayments([...byId.values()]);
      };
      const watchPayments = (key, condition) =>
        onSnapshot(
          query(collection(db, "payments"), where("ownerUid", "==", ownerId), condition),
          (snapshot) => {
            paymentSources.set(key, snapshot.docs.map((d) => normalizePayment({ id: d.id, ...d.data() })));
            publishPayments();
          },
          (error) => console.error(`Error fetching payments (${key}):`, error)
        );
      const paymentUnsubs = [
        watchPayments("months", where("periodMonth", "in", [...periods, ...periods.map((p) => p.toLowerCase())])),
        watchPayments("pending", where("status", "in", ["Pending", "pending"])),
        watchPayments("review", where("verificationStatus", "in", ["Pending", "pending"])),
      ];
      unsubPayments = () => paymentUnsubs.forEach((u) => u());

      // 5. Listen to Maintenance Tickets
      unsubTickets = onSnapshot(
        query(collection(db, "maintenance_tickets"), where("ownerUid", "==", ownerId)),
        (snapshot) => {
          setTickets(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
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
      cleanup();
    };
  }, []);

  // ---- Derived numbers (kept above the early returns below)
  const thisPeriod = currentPeriod();

  const collectedThisMonth = useMemo(() => {
    const now = new Date();
    // Money received, same as the Payments page: full and partial payments
    return payments
      .filter((p) => ["paid", "partial"].includes(String(p.status || "").toLowerCase()))
      .filter((p) => {
        // The month the rent was FOR decides it; fall back to the payment date
        if (p.periodMonth) return String(p.periodMonth).trim().toLowerCase() === thisPeriod.toLowerCase();
        const d = paymentDateOf(p);
        return Boolean(d) && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      })
      .reduce((sum, p) => sum + Number(p.amount || 0), 0);
  }, [payments, thisPeriod]);

  // Same rule as the Payments page's "To review"
  const paymentsToReview = useMemo(
    () =>
      payments.filter((p) => {
        const s = String(p.status || "").toLowerCase();
        const v = String(p.verificationStatus || "").toLowerCase();
        return s === "pending" || (v === "pending" && !["paid", "partial", "rejected", "cancelled"].includes(s));
      }).length,
    [payments]
  );

  const recentPayments = useMemo(
    () => [...payments].sort((a, b) => (paymentDateOf(b)?.getTime() || 0) - (paymentDateOf(a)?.getTime() || 0)).slice(0, 4),
    [payments]
  );

  // Repairs: same ranking as the Maintenance page, so "high priority" means the same thing in both places
  const repairStats = useMemo(() => {
    const open = rankMaintenanceRequests(tickets.filter((t) => !["Resolved", "Cancelled"].includes(t.status || "Pending")));
    return { open: open.length, high: open.filter((t) => t.priority?.tier === "High").length };
  }, [tickets]);

  // --- Verification documents (first setup, and resubmitting after a rejection) ---
  const checkDoc = (file, label) => {
    if (!file) return `Please choose your ${label}.`;
    if (!/^image\//i.test(file.type) && file.type !== "application/pdf") return `The ${label} must be a photo or a PDF.`;
    if (file.size > MAX_DOC_MB * 1024 * 1024) return `The ${label} is over ${MAX_DOC_MB} MB. Please use a smaller file.`;
    return "";
  };

  const uploadVerificationDocs = async () => {
    const [idUrl, clearanceUrl] = await Promise.all([uploadFileToCloudinary(idFile, MAX_DOC_MB), uploadFileToCloudinary(clearanceFile, MAX_DOC_MB)]);
    return { idUrl, clearanceUrl, submittedAt: new Date().toISOString() };
  };

  // First-time verification: mandatory for every new owner, whether or not a property exists yet.
  const handleVerify = async (e) => {
    e.preventDefault();
    if (uploading) return;
    setSetupError("");

    const problem = checkDoc(idFile, "government ID") || checkDoc(clearanceFile, "proof of ownership");
    if (problem) return setSetupError(problem);

    setUploading(true);
    try {
      const verificationDocs = await uploadVerificationDocs();
      await setDoc(doc(db, "users", auth.currentUser.uid), { ...resubmissionPatch(owner), verificationDocs }, { merge: true });
      setIdFile(null);
      setClearanceFile(null);
      // No property yet: continue straight into the setup wizard
      if (stats.totalProperties === 0) navigate("/setup", { replace: true });
    } catch (error) {
      console.error("Verification upload failed", error);
      setSetupError(error?.message && /size limit|Cloudinary|upload/i.test(error.message) ? error.message : "Couldn't submit your documents. Check your connection and try again.");
    } finally {
      setUploading(false);
    }
  };

  const handleResubmit = async () => {
    if (resubmitting) return;
    setSetupError("");
    const problem = checkDoc(idFile, "government ID") || checkDoc(clearanceFile, "proof of ownership");
    if (problem) return setSetupError(problem);

    setResubmitting(true);
    try {
      const verificationDocs = await uploadVerificationDocs();
      await setDoc(doc(db, "users", auth.currentUser.uid), { ...resubmissionPatch(owner), verificationDocs }, { merge: true });
      setIdFile(null);
      setClearanceFile(null);
      setResubmitDone(true);
    } catch (error) {
      console.error("Resubmit failed", error);
      setSetupError(error?.message && /size limit|Cloudinary|upload/i.test(error.message) ? error.message : "Couldn't resubmit. Check your connection and try again.");
    } finally {
      setResubmitting(false);
    }
  };

  if (loading || !owner || !propsLoaded) {
    return (
      <Container maxWidth="xl" disableGutters>
        <Skeleton variant="rounded" height={210} sx={{ borderRadius: R.xl, mb: 3 }} />
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "repeat(2, 1fr)", md: "repeat(4, 1fr)" }, gap: { xs: 1.5, md: 2 }, mb: 3 }}>
          {[0, 1, 2, 3].map((k) => (
            <Skeleton key={k} variant="rounded" height={128} sx={{ borderRadius: R.lg }} />
          ))}
        </Box>
        <Skeleton variant="rounded" height={220} sx={{ borderRadius: R.lg }} />
      </Container>
    );
  }

  // --- VERIFICATION GATE ---
  // A pending owner can't reach the dashboard until both documents are on file,
  // whether or not they have set up a property yet.
  const docsOnFile = Boolean(owner?.verificationDocs?.idUrl && owner?.verificationDocs?.clearanceUrl);
  if (owner?.approvalStatus === "pending" && !docsOnFile) {
    return (
      <Container maxWidth="sm" disableGutters sx={{ py: { xs: 1, md: 6 } }}>
        <Paper elevation={0} sx={{ ...panelSx, p: { xs: 2.5, md: 5 } }}>
          <Typography variant="h5" component="h1" sx={{ fontWeight: "800", mb: 1, fontFamily: HEAD }}>
            Verify your account
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
            Upload your ID and proof of ownership so our admin team can approve your account.
            {stats.totalProperties === 0 ? " You'll set up your first property right after." : ""}
          </Typography>

          {setupError && (
            <Alert severity="error" sx={{ mb: 3 }}>{setupError}</Alert>
          )}

          <Box component="form" onSubmit={handleVerify} noValidate>
            <FilePickRow
              label="Government ID"
              hint="A clear photo or PDF of a valid ID (PhilID, driver's license, etc.)."
              file={idFile}
              onChange={setIdFile}
            />
            <FilePickRow
              label="Proof of ownership"
              hint="Land title, tax declaration, or a lease or authorization letter if you manage the property for the owner. A business permit also works."
              file={clearanceFile}
              onChange={setClearanceFile}
            />

            <Button
              type="submit"
              variant="contained"
              fullWidth
              size="large"
              disabled={uploading}
              sx={{ py: 1.5, fontWeight: "bold", borderRadius: R.sm }}
            >
              {uploading ? <CircularProgress size={24} color="inherit" /> : "Submit for approval"}
            </Button>
          </Box>
        </Paper>
      </Container>
    );
  }

  // --- ACTUAL DASHBOARD ---
  // Same rule as the route guard and the menu
  const access = ownerAccessOf(owner);
  const isPending = access === "pending";
  const isRejected = access === "rejected";
  // The first property is part of setup, so it stays open; further ones wait for approval.
  const addLocked = isPending && stats.totalProperties > 0;

  // The route guard sends a pending owner back here from every other owner page,
  // so links to those pages are switched off until approval instead of bouncing.
  const linkTo = (path) => (isPending || isRejected ? undefined : () => navigate(path));

  const ownerName =
    owner?.fullName || owner?.name || owner?.ownerName || owner?.firstName || auth.currentUser?.displayName || "Owner";

  // Status pill tuned for the dark hero (the stock MUI chip colors are too
  // dim on #202020).
  const statusTone = isRejected
    ? { label: "Action Needed", bg: "rgba(244, 67, 54, 0.18)", fg: "#ef9a9a" }
    : isPending
    ? { label: "Pending Review", bg: "rgba(255, 167, 38, 0.18)", fg: "#ffcc80" }
    : { label: "Verified", bg: "rgba(76, 175, 80, 0.18)", fg: "#a5d6a7" };

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";

  const welcomeSubtitle = isRejected
    ? "There was an issue with your verification. Please review and resubmit your documents."
    : isPending
    ? "Your account is under review. You can look around the dashboard while you wait."
    : `Here's what's happening across your ${stats.totalProperties} ${stats.totalProperties === 1 ? "property" : "properties"} today.`;

  // "Maria's lease ends in 5 days" / "3 tenant leases end within 30 days" / "2 tenant leases have ended"
  const leaseText = (list, kind) => {
    const n = list.length;
    if (kind === "ended") {
      return n === 1 ? `${list[0].name}'s lease has ended` : `${n} tenant leases have ended`;
    }
    if (n === 1) {
      const d = list[0].left;
      return `${list[0].name}'s lease ${d === 0 ? "ends today" : `ends in ${d} ${d === 1 ? "day" : "days"}`}`;
    }
    return `${n} tenant leases end within ${LEASE_WARN_DAYS} days`;
  };

  // One tenant: straight to their profile. Several: the tenant list.
  const leaseLink = (list) => (list.length === 1 && list[0].id ? `/owner/tenants/${list[0].id}` : "/owner/tenants");

  // Rows for "Needs your attention", most urgent first
  const names = (list) => `${list.slice(0, 2).map((x) => x.name).join(", ")}${list.length > 2 ? ` +${list.length - 2} more` : ""}`;
  const attentionItems = [
    {
      show: stats.leaseEnded.length > 0,
      tone: "error",
      icon: <EventBusyOutlinedIcon fontSize="small" />,
      text: leaseText(stats.leaseEnded, "ended"),
      caption: stats.leaseEnded.length === 1
        ? `Ended ${Math.abs(stats.leaseEnded[0].left)} ${Math.abs(stats.leaseEnded[0].left) === 1 ? "day" : "days"} ago · Open profile`
        : names(stats.leaseEnded),
      to: leaseLink(stats.leaseEnded),
    },
    {
      show: repairStats.high > 0,
      tone: "error",
      icon: <BuildOutlinedIcon fontSize="small" />,
      text: `${repairStats.high} high-priority ${repairStats.high === 1 ? "repair is" : "repairs are"} still open`,
      caption: "Open Maintenance",
      to: "/owner/maintenance",
    },
    {
      show: paymentsToReview > 0,
      tone: "warning",
      icon: <ReceiptLongIcon fontSize="small" />,
      text: `${paymentsToReview} ${paymentsToReview === 1 ? "payment is" : "payments are"} waiting for your review`,
      caption: "Verify or reject in Payments",
      to: "/owner/payments",
    },
    {
      show: stats.leaseSoon.length > 0,
      tone: "warning",
      icon: <EventBusyOutlinedIcon fontSize="small" />,
      text: leaseText(stats.leaseSoon, "soon"),
      caption: stats.leaseSoon.length === 1 ? "Open profile" : names(stats.leaseSoon),
      to: leaseLink(stats.leaseSoon),
    },
    {
      show: stats.pendingTenants > 0,
      tone: "info",
      icon: <PersonAddIcon fontSize="small" />,
      text: `${stats.pendingTenants} ${stats.pendingTenants === 1 ? "tenant hasn't" : "tenants haven't"} finished registering`,
      caption: "See who in Tenants",
      to: "/owner/tenants",
    },
  ].filter((item) => item.show);

  const handleAddPropertyClick = () => {
    if (addLocked) return;
    navigate("/setup");
  };

  const addPropertyTooltip = addLocked ? "Account pending approval. Adding properties is disabled." : "";

  const quickActions = [
    { label: "Register tenant", icon: <PersonAddAlt1OutlinedIcon />, to: "/owner/tenants/register" },
    { label: "Invite caretaker", icon: <GroupAddOutlinedIcon />, to: "/owner/caretakers/invite" },
    { label: "Caretakers", icon: <BadgeOutlinedIcon />, to: "/owner/caretakers" },
    { label: "Announcement", icon: <CampaignOutlinedIcon />, to: "/owner/announcements" },
  ];

  const statusColor = (status) => {
    const s = String(status || "Paid").toLowerCase();
    if (s === "paid") return "success";
    if (["rejected", "overdue", "cancelled"].includes(s)) return "error";
    return "warning";
  };

  const initialsOf = (name) =>
    String(name || "T")
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0].toUpperCase())
      .join("");

  return (
    <Container maxWidth="xl" disableGutters>
      {AnimationStyles}

      {/* ================= Hero: greeting + occupancy ================= */}
      <Box
        component="section"
        sx={{
          position: "relative",
          overflow: "hidden",
          bgcolor: INK,
          color: "#ffffff",
          borderRadius: R.xl,
          p: { xs: 2.5, sm: 3.5, md: 4 },
          mb: { xs: 2, md: 3 },
          display: "grid",
          gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "minmax(0, 1.25fr) minmax(0, 0.75fr)" },
          gap: { xs: 2.5, md: 5 },
          alignItems: "center",
        }}
      >
        <Box aria-hidden sx={{ position: "absolute", top: -200, right: -140, width: 460, height: 460, borderRadius: "50%", background: "rgba(255,69,0,.24)", filter: "blur(100px)", pointerEvents: "none" }} />
        <Box aria-hidden sx={{ position: "absolute", bottom: -220, left: -160, width: 360, height: 360, borderRadius: "50%", background: "rgba(202,220,246,.12)", filter: "blur(90px)", pointerEvents: "none" }} />

        <Box sx={{ position: "relative", minWidth: 0 }}>
          <Box sx={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 1, mb: 1.5 }}>
            <Chip size="small" label={statusTone.label} sx={{ bgcolor: statusTone.bg, color: statusTone.fg, fontWeight: 700 }} />
          </Box>
          <Typography
            component="h1"
            sx={{
              fontFamily: HEAD,
              fontWeight: 900,
              letterSpacing: "-0.03em",
              color: "#ffffff",
              fontSize: { xs: "1.55rem", sm: "2.1rem", md: "2.35rem" },
              lineHeight: 1.12,
              overflowWrap: "anywhere",
            }}
          >
            {greeting},{" "}
            <Box component="span" sx={{ color: "primary.main" }}>
              {ownerName}
            </Box>
          </Typography>
          <Typography variant="body2" sx={{ color: "#cadcf6", mt: 1, maxWidth: 480, lineHeight: 1.6 }}>
            {welcomeSubtitle}
          </Typography>

          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1.25, mt: 2.5, "& > *": { flex: { xs: "1 1 auto", sm: "0 0 auto" } } }}>
            <Tooltip title={addPropertyTooltip}>
              <span style={{ display: "flex" }}>
                <Button
                  variant="contained"
                  startIcon={addLocked ? <LockIcon /> : <AddHomeWorkIcon />}
                  onClick={handleAddPropertyClick}
                  disabled={addLocked}
                  sx={{
                    flex: 1,
                    fontWeight: 700,
                    borderRadius: R.sm,
                    boxShadow: "0 12px 26px -14px rgba(255,69,0,.85)",
                    "&.Mui-disabled": { bgcolor: "rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.45)" },
                  }}
                >
                  Add Property
                </Button>
              </span>
            </Tooltip>
            {!isPending && paymentsToReview > 0 && (
              <Button
                onClick={() => navigate("/owner/payments")}
                startIcon={<ReceiptLongIcon />}
                sx={{ fontWeight: 700, borderRadius: R.sm, color: "#fff", border: "1px solid rgba(255,255,255,.22)", "&:hover": { bgcolor: "rgba(255,255,255,.08)" } }}
              >
                Review {paymentsToReview} {paymentsToReview === 1 ? "payment" : "payments"}
              </Button>
            )}
          </Box>
        </Box>

        <Box sx={{ position: "relative", minWidth: 0 }}>
          <OccupancyPanel rate={stats.occupancyRate} occupied={stats.occupiedBeds} total={stats.totalBeds} />
        </Box>
      </Box>

      {/* Pending Account Alert */}
      {isPending && (
        <Alert severity="warning" sx={{ mb: { xs: 2, md: 3 }, borderRadius: R.md }}>
          <strong>Account pending approval.</strong> Our admin team is reviewing your documents. Until then you can finish setting up your first property; the other owner pages, adding tenants, inviting caretakers and adding more properties open up once you're approved.
        </Alert>
      )}

      {/* Rejected: let them fix it right here */}
      {isRejected && (
        <Paper elevation={0} sx={{ ...panelSx, borderColor: "error.main", p: { xs: 2, sm: 3 }, mb: { xs: 2, md: 3 } }}>
          <Typography variant="h6" sx={{ fontWeight: "700", mb: 0.5, fontFamily: HEAD }}>
            Resubmit your documents
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
            {owner?.rejectionReason ? `Reason given: ${owner.rejectionReason}` : "Upload clearer or updated copies and our admin team will review them again."}
          </Typography>
          {setupError && <Alert severity="error" sx={{ mb: 2 }}>{setupError}</Alert>}
          {resubmitDone && <Alert severity="success" sx={{ mb: 2 }}>Submitted. You'll see your status update here once it's reviewed.</Alert>}
          <FilePickRow label="Government ID" hint="A clear photo or PDF of a valid ID." file={idFile} onChange={setIdFile} />
          <FilePickRow label="Proof of Ownership" hint="Land title, tax declaration, lease / authorization letter, or business permit." file={clearanceFile} onChange={setClearanceFile} />
          <Button variant="contained" onClick={handleResubmit} disabled={resubmitting} sx={{ fontWeight: 700, minHeight: 46, borderRadius: R.sm, width: { xs: "100%", sm: "auto" } }}>
            {resubmitting ? <CircularProgress size={22} color="inherit" /> : "Resubmit for approval"}
          </Button>
        </Paper>
      )}

      {/* ================= Metrics: 2x2 on phones, 4 across on desktop ================= */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "repeat(2, minmax(0, 1fr))", md: "repeat(4, minmax(0, 1fr))" },
          gap: { xs: 1.25, sm: 1.5, md: 2 },
          mb: { xs: 2, md: 3 },
        }}
      >
        <MetricCard
          title="Properties"
          value={stats.totalProperties}
          subtitle={`${stats.totalBeds} beds in total`}
          icon={<HomeWorkOutlinedIcon fontSize="small" />}
          onClick={linkTo("/owner/properties")}
        />
        <MetricCard
          title="Tenants"
          value={stats.activeTenants}
          subtitle={stats.pendingTenants > 0 ? `${stats.pendingTenants} still registering` : `${stats.occupiedBeds} of ${stats.totalBeds} beds filled`}
          subtitleColor={stats.pendingTenants > 0 ? "warning.main" : "text.secondary"}
          icon={<PeopleOutlineIcon fontSize="small" />}
          onClick={linkTo("/owner/tenants")}
        />
        <MetricCard
          title="Collected this month"
          value={peso(collectedThisMonth)}
          subtitle={stats.expectedRent > 0 ? `of ${peso(stats.expectedRent)} expected` : "Paid rent this month"}
          icon={<PaymentsOutlinedIcon fontSize="small" />}
          onClick={linkTo("/owner/payments")}
          progress={stats.expectedRent > 0 ? (collectedThisMonth / stats.expectedRent) * 100 : undefined}
        />
        <MetricCard
          title="Open repairs"
          value={repairStats.open}
          subtitle={repairStats.high > 0 ? `${repairStats.high} high priority` : "None urgent"}
          subtitleColor={repairStats.high > 0 ? "error.main" : "text.secondary"}
          icon={<BuildOutlinedIcon fontSize="small" />}
          onClick={linkTo("/owner/maintenance")}
        />
      </Box>

      {/* ================= Needs your attention: only when there is something to do ================= */}
      {attentionItems.length > 0 && (
        <Paper elevation={0} sx={{ ...panelSx, mb: { xs: 2, md: 3 }, overflow: "hidden" }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, px: { xs: 2, sm: 2.5 }, pt: 2, pb: 1.5 }}>
            <Typography component="h2" sx={{ fontFamily: HEAD, fontWeight: 800, fontSize: { xs: "1.05rem", sm: "1.15rem" } }}>
              Needs your attention
            </Typography>
            <Box sx={{ minWidth: 22, height: 22, px: 0.75, borderRadius: 99, display: "grid", placeItems: "center", bgcolor: "primary.main", color: "#fff", fontSize: 12, fontWeight: 800 }}>
              {attentionItems.length}
            </Box>
          </Box>
          {attentionItems.map((item) => {
            const clickable = !isPending;
            return (
              <Box
                key={item.text}
                component={clickable ? ButtonBase : "div"}
                onClick={clickable ? () => navigate(item.to) : undefined}
                sx={{
                  width: "100%",
                  display: "flex",
                  justifyContent: "flex-start",
                  alignItems: "center",
                  gap: 1.5,
                  px: { xs: 2, sm: 2.5 },
                  py: 1.25,
                  minHeight: 64,
                  textAlign: "left",
                  borderTop: "1px solid",
                  borderColor: "divider",
                  position: "relative",
                  "&::before": { content: '""', position: "absolute", left: 0, top: 10, bottom: 10, width: 3, borderRadius: "0 3px 3px 0", bgcolor: `${item.tone}.main` },
                  ...(clickable && { "&:hover": { bgcolor: "action.hover" } }),
                  "&:focus-visible": { outline: "2px solid", outlineColor: "primary.main", outlineOffset: -2 },
                }}
              >
                <Box
                  sx={{
                    width: 38,
                    height: 38,
                    borderRadius: R.sm,
                    flexShrink: 0,
                    display: "grid",
                    placeItems: "center",
                    color: `${item.tone}.main`,
                    bgcolor: (t) => alpha(t.palette[item.tone].main, 0.12),
                  }}
                >
                  {item.icon}
                </Box>
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography variant="body2" sx={{ fontWeight: 700, overflowWrap: "anywhere" }}>{item.text}</Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: "block", overflowWrap: "anywhere" }}>
                    {clickable ? item.caption : LOCKED_TIP}
                  </Typography>
                </Box>
                {clickable && <ChevronRightIcon fontSize="small" sx={{ color: "text.secondary", flexShrink: 0 }} />}
              </Box>
            );
          })}
        </Paper>
      )}

      {/* ================= Your properties: carousel ================= */}
      <Box component="section" sx={{ mb: { xs: 2.5, md: 3.5 } }}>
        <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", mb: 1.5 }}>
          <Typography component="h2" sx={{ fontFamily: HEAD, fontWeight: 800, fontSize: { xs: "1.05rem", sm: "1.15rem" } }}>
            Your properties
          </Typography>
          {properties.length > 0 && !isPending && (
            <Button size="small" endIcon={<ChevronRightIcon />} onClick={() => navigate("/owner/properties")} sx={{ fontWeight: 700 }}>
              View all
            </Button>
          )}
        </Box>
        {properties.length === 0 ? (
          <Paper elevation={0} sx={{ ...panelSx, borderStyle: "dashed", p: { xs: 3, sm: 4 }, textAlign: "center" }}>
            <Box sx={{ width: 52, height: 52, mx: "auto", mb: 1.5, borderRadius: R.md, bgcolor: "rgba(255,69,0,.1)", color: "primary.main", display: "grid", placeItems: "center" }}>
              <AddHomeWorkIcon />
            </Box>
            <Typography sx={{ fontFamily: HEAD, fontWeight: 800, mb: 0.5 }}>No properties yet</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Add your first property to start tracking rooms, beds and tenants.
            </Typography>
            <Tooltip title={addPropertyTooltip}>
              <span>
                <Button
                  variant="contained"
                  startIcon={addLocked ? <LockIcon /> : <AddHomeWorkIcon />}
                  onClick={handleAddPropertyClick}
                  disabled={addLocked}
                  sx={{ fontWeight: 700, borderRadius: R.sm }}
                >
                  Add your first property
                </Button>
              </span>
            </Tooltip>
          </Paper>
        ) : (
          <PropertyCarousel properties={properties} onOpen={isPending ? null : (property) => navigate(`/owner/properties/${property.id}`)} />
        )}
      </Box>

      {/* ================= Bottom panels ================= */}
      <Box
        sx={{
          display: "grid",
          gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "minmax(0, 1.15fr) minmax(0, 0.85fr)" },
          gap: { xs: 2, md: 3 },
          mb: 2,
          alignItems: "stretch", // both panels end at the same height
        }}
      >
        {/* Recent payments */}
        <Panel
          title="Recent rent collections"
          action={
            !isPending && (
              <Button size="small" endIcon={<ChevronRightIcon />} onClick={() => navigate("/owner/payments")} sx={{ fontWeight: 700, flexShrink: 0 }}>
                All payments
              </Button>
            )
          }
        >
          {recentPayments.length === 0 ? (
            <Box sx={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", py: 4, borderRadius: R.md, bgcolor: (t) => alpha(t.palette.background.paper, 0.35) }}>
              <ReceiptLongIcon sx={{ fontSize: 32, color: "text.disabled", mb: 0.5 }} />
              <Typography variant="body2" sx={{ fontWeight: 700 }}>No payments yet</Typography>
              <Typography variant="caption" color="text.secondary">Rent your tenants pay will show up here.</Typography>
            </Box>
          ) : (
            // minmax(0, 1fr): without it the grid column grows to fit the longest
            // single-line name and pushes the panel past the screen edge on phones
            <Box sx={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr)", gap: 1 }}>
              {recentPayments.map((p) => {
                const date = paymentDateOf(p);
                return (
                  <Box
                    key={p.id}
                    component={isPending ? "div" : ButtonBase}
                    onClick={linkTo("/owner/payments")}
                    sx={{
                      width: "100%",
                      minWidth: 0,
                      display: "flex",
                      alignItems: "center",
                      gap: { xs: 1.25, sm: 1.5 },
                      p: 1.25,
                      textAlign: "left",
                      borderRadius: R.md,
                      border: "1px solid",
                      borderColor: "divider",
                      transition: "border-color .15s, background-color .15s",
                      ...(!isPending && { "&:hover": { borderColor: "primary.main", bgcolor: (t) => alpha(t.palette.background.paper, 0.3) } }),
                      "&:focus-visible": { outline: "2px solid", outlineColor: "primary.main", outlineOffset: 2 },
                    }}
                  >
                    <Avatar sx={{ width: 38, height: 38, flexShrink: 0, bgcolor: "background.paper", color: "text.primary", fontFamily: HEAD, fontWeight: 800, fontSize: 14 }}>
                      {initialsOf(p.tenantName)}
                    </Avatar>
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Typography variant="body2" sx={{ fontWeight: 700 }} noWrap>
                        {p.tenantName || "Tenant"}
                      </Typography>
                      <Typography variant="caption" color="text.secondary" sx={{ display: "block" }} noWrap>
                        {p.propertyName || "Property"} · Room {p.roomNumber || "—"}
                        {date ? ` · ${date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : ""}
                      </Typography>
                    </Box>
                    <Box sx={{ textAlign: "right", flexShrink: 0 }}>
                      <Typography sx={{ fontFamily: HEAD, fontWeight: 800, fontSize: 14.5 }}>{peso(p.amount)}</Typography>
                      <Chip label={p.status || "Paid"} color={statusColor(p.status)} size="small" variant="outlined" sx={{ height: 20, fontSize: 11, fontWeight: 700, mt: 0.25 }} />
                    </Box>
                  </Box>
                );
              })}
            </Box>
          )}
        </Panel>

        {/* People + quick actions */}
        <Panel title="Tenants & caretakers">
          <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(88px, 1fr))", gap: 1, mb: 2 }}>
            {[
              { label: "Active tenants", value: stats.activeTenants, color: "success.main", tint: "rgba(46, 125, 50, 0.08)" },
              { label: "Registering", value: stats.pendingTenants, color: "warning.main", tint: "rgba(237, 108, 2, 0.08)" },
              { label: "Caretakers", value: stats.totalCaretakers, color: "text.primary", tint: "rgba(202, 220, 246, 0.35)" },
            ].map((s) => (
              <Box key={s.label} sx={{ p: { xs: 1.25, sm: 1.5 }, borderRadius: R.md, bgcolor: s.tint, minWidth: 0 }}>
                <Typography sx={{ fontFamily: HEAD, fontWeight: 800, fontSize: { xs: "1.35rem", sm: "1.5rem" }, lineHeight: 1.1, color: s.color }}>{s.value}</Typography>
                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, display: "block", lineHeight: 1.3, overflowWrap: "anywhere" }}>
                  {s.label}
                </Typography>
              </Box>
            ))}
          </Box>

          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", display: "block", mb: 1 }}>
            Quick actions
          </Typography>
          <Box sx={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 1 }}>
            {quickActions.map((a) => (
              <Tooltip key={a.label} title={isPending ? LOCKED_TIP : ""}>
                <span style={{ display: "flex", minWidth: 0 }}>
                  <ButtonBase
                    onClick={() => navigate(a.to)}
                    disabled={isPending}
                    sx={{
                      flex: 1,
                      justifyContent: "flex-start",
                      gap: 1.25,
                      p: 1.25,
                      minHeight: 52,
                      borderRadius: R.md,
                      border: "1px solid",
                      borderColor: "divider",
                      textAlign: "left",
                      fontFamily: HEAD,
                      fontWeight: 700,
                      fontSize: { xs: 13, sm: 13.5 },
                      color: "text.primary",
                      transition: "border-color .15s, background-color .15s",
                      "&:hover": { borderColor: "primary.main", bgcolor: "rgba(255,69,0,.04)" },
                      "&.Mui-disabled": { color: "text.disabled" },
                      "&:focus-visible": { outline: "2px solid", outlineColor: "primary.main", outlineOffset: 2 },
                    }}
                  >
                    <Box sx={{ width: 30, height: 30, flexShrink: 0, borderRadius: "8px", display: "grid", placeItems: "center", bgcolor: isPending ? "action.hover" : "rgba(255,69,0,.1)", color: isPending ? "text.disabled" : "primary.main", "& svg": { fontSize: 18 } }}>
                      {isPending ? <LockIcon /> : a.icon}
                    </Box>
                    <Box component="span" sx={{ minWidth: 0, lineHeight: 1.25 }}>
                      {a.label}
                    </Box>
                  </ButtonBase>
                </span>
              </Tooltip>
            ))}
          </Box>
        </Panel>
      </Box>
    </Container>
  );
}