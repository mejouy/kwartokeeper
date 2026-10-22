// src/pages/owner/tenants/RegisterTenant.jsx

import { useMemo, useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Typography,
  TextField,
  Button,
  MenuItem,
  Alert,
  CircularProgress,
  IconButton,
  InputAdornment,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import CheckIcon from "@mui/icons-material/Check";
import CloudUploadOutlinedIcon from "@mui/icons-material/CloudUploadOutlined";
import PersonOutlinedIcon from "@mui/icons-material/PersonOutlined";
import BedOutlinedIcon from "@mui/icons-material/BedOutlined";
import EventNoteOutlinedIcon from "@mui/icons-material/EventNoteOutlined";
import BadgeOutlinedIcon from "@mui/icons-material/BadgeOutlined";
import PhoneOutlinedIcon from "@mui/icons-material/PhoneOutlined";
import InfoOutlinedIcon from "@mui/icons-material/InfoOutlined";
import { initializeApp, deleteApp, getApps } from "firebase/app";
import {
  getAuth,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
} from "firebase/auth";
import { doc, setDoc, collection, query, where, getDocs } from "firebase/firestore";
import { auth, db, firebaseConfig } from "../../../config/firebase";
import { uploadToCloudinary } from "../../../utils/cloudinary"; 
import { addMonthsClamped } from "../../../utils/addMonthsClamped";
import {
  getPropertyRoomOccupancy,
  reconcilePropertyOccupancy,
} from "../../../utils/reconcilePropertyOccupancy";
import { isRoomUnderMaintenance, MAINTENANCE_ROOM_MESSAGE } from "../../../utils/roomStatus";

// ---------------------------------------------------------------------------
// Same layout as the property setup (PropertyWizard): dark sidebar with the
// step list and dorm facade on the left, white content column on the right.
// ---------------------------------------------------------------------------
const STEPS = [
  { title: "Tenant details", heading: "Who is moving in?", sub: "Contact details and a valid ID, so you can verify the tenant.", Icon: PersonOutlinedIcon },
  { title: "Room & bed", heading: "Where will they stay?", sub: "Pick the property, room and bed to assign.", Icon: BedOutlinedIcon },
  { title: "Lease terms", heading: "How long, and from when?", sub: "Set the lease, then review everything before registering.", Icon: EventNoteOutlinedIcon },
];

const MAX_ID_PHOTO_MB = 8;

const FACADE_ROWS = 5;
const FACADE_COLS = 5;
const LIT_PATTERN = [
  1, 0, 0, 1, 0,
  0, 0, 1, 0, 0,
  1, 0, 0, 0, 1,
  0, 1, 0, 0, 0,
  0, 0, 1, 0, 1,
];

function DormFacade() {
  const windows = useMemo(() => {
    const w = [];
    const gap = 16;
    const size = 30;
    for (let row = 0; row < FACADE_ROWS; row++) {
      for (let col = 0; col < FACADE_COLS; col++) {
        const idx = row * FACADE_COLS + col;
        w.push({ x: col * (size + gap), y: row * (size + gap), lit: LIT_PATTERN[idx] === 1, size });
      }
    }
    return w;
  }, []);

  const width = FACADE_COLS * (30 + 16) - 16;
  const height = FACADE_ROWS * (30 + 16) - 16;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      style={{ maxWidth: 220, display: "block" }}
      role="img"
      aria-label="Illustration of a dormitory building at night, with illuminated windows"
    >
      {windows.map((win, i) => (
        <rect
          key={i}
          x={win.x}
          y={win.y}
          width={win.size}
          height={win.size}
          rx={4}
          fill={win.lit ? "#ff4500" : "rgba(202, 220, 246, 0.16)"}
          opacity={win.lit ? 0.92 : 1}
        />
      ))}
    </svg>
  );
}

function StepList({ activeStep }) {
  return (
    <Box sx={{ display: "flex", flexDirection: "column" }}>
      {STEPS.map(({ title, Icon }, i) => {
        const isActive = i === activeStep;
        const isDone = i < activeStep;
        const isFilled = isActive || isDone;
        return (
          <Box key={title} sx={{ display: "flex", alignItems: "flex-start", gap: 1.5 }}>
            <Box sx={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <Box
                sx={{
                  width: 34,
                  height: 34,
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  bgcolor: isFilled ? "primary.main" : "rgba(202, 220, 246, 0.16)",
                  color: isFilled ? "#ffffff" : "#cadcf6",
                  transition: "background-color 0.2s ease, color 0.2s ease",
                }}
              >
                {isDone ? <CheckIcon sx={{ fontSize: 18 }} /> : <Icon sx={{ fontSize: 18 }} />}
              </Box>
              {i < STEPS.length - 1 && (
                <Box
                  sx={{
                    width: "2px",
                    flex: 1,
                    minHeight: 28,
                    bgcolor: isDone ? "primary.main" : "rgba(202, 220, 246, 0.16)",
                    my: 0.5,
                    transition: "background-color 0.2s ease",
                  }}
                />
              )}
            </Box>
            <Typography
              variant="body2"
              sx={{
                pt: 0.9,
                pb: i < STEPS.length - 1 ? 3.5 : 0,
                fontWeight: isActive ? 700 : 400,
                color: isActive ? "#ffffff" : "#cadcf6",
              }}
            >
              {title}
            </Typography>
          </Box>
        );
      })}
    </Box>
  );
}

// Label-left rows, exactly like the property setup form
const rowSx = {
  display: "flex",
  flexDirection: { xs: "column", sm: "row" },
  alignItems: { xs: "stretch", sm: "center" },
  gap: { xs: 0.8, sm: 3 },
};
const labelColSx = { width: { xs: "100%", sm: "34%" }, flexShrink: 0, textAlign: { sm: "right" } };
const fieldColSx = { width: { xs: "100%", sm: "66%" }, minWidth: 0 };
const labelStyle = {
  fontSize: "0.875rem",
  color: "text.secondary",
  fontWeight: 600,
  textAlign: { xs: "left", sm: "right" },
};

const RequiredMark = () => (
  <Box component="span" sx={{ color: "primary.main", ml: 0.4 }}>*</Box>
);

function FormRow({ label, required, top, children }) {
  return (
    <Box sx={{ ...rowSx, ...(top ? { alignItems: { xs: "stretch", sm: "flex-start" } } : {}) }}>
      <Box sx={{ ...labelColSx, ...(top ? { pt: { sm: 1.75 } } : {}) }}>
        <Typography sx={labelStyle}>
          {label}
          {required && <RequiredMark />}
        </Typography>
      </Box>
      <Box sx={fieldColSx}>{children}</Box>
    </Box>
  );
}

// The blue-tinted, orange-edged group used for the address on the setup page
function Group({ icon, title, children }) {
  return (
    <Box
      sx={{
        borderLeft: "3px solid",
        borderColor: "primary.main",
        bgcolor: "rgba(202, 220, 246, 0.18)",
        borderRadius: "0 4px 4px 0",
        p: { xs: 1.5, sm: 2 },
      }}
    >
      <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, mb: 1.5 }}>
        {icon}
        <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>
          {title}
        </Typography>
      </Box>
      <Box sx={{ display: "flex", flexDirection: "column", gap: 1.75 }}>{children}</Box>
    </Box>
  );
}

const ID_TYPES = [
  { value: "student_id", label: "Student ID" },
  { value: "national_id", label: "National ID" },
  { value: "drivers_license", label: "Driver's License" },
  { value: "passport", label: "Passport" },
  { value: "other", label: "Other Valid ID" },
];

const LEASE_DURATIONS = [
  { value: "1_month", label: "1 Month" },
  { value: "3_months", label: "3 Months" },
  { value: "6_months", label: "6 Months" },
  { value: "12_months", label: "12 Months" },
  { value: "custom", label: "Custom..." },
];

function generateTempPassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%";
  let result = "";
  for (let i = 0; i < 16; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Return only the UID string so we don't rely on a deleted app instance.
async function createSubUserWithoutSignOut(email, password) {
  if (!firebaseConfig) {
    throw new Error("firebaseConfig is undefined. Check your config/firebase.js exports.");
  }

  const secondaryAppName = `secondary-${Date.now()}`;
  const secondaryApp = initializeApp(firebaseConfig, secondaryAppName);
  const secondaryAuth = getAuth(secondaryApp);
  
  try {
    const userCredential = await createUserWithEmailAndPassword(
      secondaryAuth,
      email,
      password
    );
    await sendPasswordResetEmail(secondaryAuth, email);
    
    return userCredential.user.uid; 
  } finally {
    const appToDelete = getApps().find((a) => a.name === secondaryAppName);
    if (appToDelete) await deleteApp(appToDelete);
  }
}

export default function RegisterTenant() {
  const navigate = useNavigate();
  const scrollRef = useRef(null); // whole screen (phones)
  const mainRef = useRef(null); // content column (laptops)
  const scrollToTop = () => {
    scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    mainRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  };

  const [step, setStep] = useState(0);
  // { field, message } for the first problem found, so the field can be flagged too
  const [problem, setProblem] = useState(null);

  const [form, setForm] = useState({
    fullName: "",
    email: "",
    phone: "",
    idType: "",
    idNumber: "",
    propertyId: "",
    roomId: "",
    bedId: "",
    leaseStartDate: "",
    leaseDuration: "",
    customLeaseDuration: "", // Added for custom duration tracking
  });

  const [idPhotoFile, setIdPhotoFile] = useState(null);
  const idPreviewRef = useRef(null);
  const [properties, setProperties] = useState([]);
  const [rooms, setRooms] = useState([]);

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingProperties, setLoadingProperties] = useState(true);

  // Preview of the chosen ID photo: the object URL goes straight onto the <img>, and is freed on change
  useEffect(() => {
    if (!idPhotoFile || !idPreviewRef.current) return undefined;
    const url = URL.createObjectURL(idPhotoFile);
    idPreviewRef.current.src = url;
    return () => URL.revokeObjectURL(url);
  }, [idPhotoFile]);

  useEffect(() => {
    async function loadProperties() {
      if (!auth.currentUser) {
        setLoadingProperties(false);
        return;
      }
      try {
        const q = query(
          collection(db, "properties"),
          where("ownerUid", "==", auth.currentUser.uid)
        );
        const snapshot = await getDocs(q);
        const loaded = snapshot.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((property) => !["inactive", "archived", "deactivated"].includes(String(property.status || "Active").trim().toLowerCase()));
        setProperties(loaded);
        // Only one property? No need to make the owner pick it.
        if (loaded.length === 1) {
          setForm((prev) => (prev.propertyId ? prev : { ...prev, propertyId: loaded[0].id }));
        }
      } catch (err) {
        console.error("Failed to load properties:", err);
        setProperties([]);
      } finally {
        setLoadingProperties(false);
      }
    }
    loadProperties();
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadRooms = async () => {
      if (!form.propertyId) {
        setRooms([]);
        return;
      }

      const propertyRooms = await getPropertyRoomOccupancy(form.propertyId);
      if (!cancelled) setRooms(propertyRooms);
    };

    loadRooms();
    return () => {
      cancelled = true;
    };
  }, [form.propertyId]);

  // Open beds in the chosen room, worked out from the room's occupancy
  const bedOptions = useMemo(() => {
    const selectedRoom = rooms.find((r) => r.roomName === form.roomId);
    if (!selectedRoom?.capacity) return [];
    const occupiedBeds = Number(selectedRoom.occupiedBeds || 0);
    const availableCount = Math.max(0, Number(selectedRoom.capacity) - occupiedBeds);
    return Array.from({ length: availableCount }, (_, i) => `Bed ${occupiedBeds + 1 + i}`);
  }, [form.roomId, rooms]);

  const handleChange = (field) => (e) => {
    if (problem?.field === field) setProblem(null);
    setForm((prev) => {
      let newValue = e.target.value;

      // Clean ID input: Auto-uppercase, allow only letters, numbers, and hyphens
      if (field === "idNumber") {
        newValue = newValue.toUpperCase().replace(/[^A-Z0-9-]/g, "");
      }
      // Phone: digits only (same rule as the property setup's contact phone)
      if (field === "phone") {
        newValue = newValue.replace(/[^0-9]/g, "");
      }

      if (field === "propertyId") {
        return { ...prev, propertyId: newValue, roomId: "", bedId: "" };
      }
      if (field === "roomId") {
        return { ...prev, roomId: newValue, bedId: "" };
      }
      if (field === "leaseDuration" && newValue !== "custom") {
        return { ...prev, leaseDuration: newValue, customLeaseDuration: "" };
      }
      return { ...prev, [field]: newValue };
    });
  };

  const handleIdPhoto = (e) => {
    const file = e.target.files?.[0] || null;
    e.target.value = ""; // allows re-picking the same file
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setProblem({ field: "idPhoto", message: "Please choose an image file (JPG or PNG)." });
      return;
    }
    if (file.size > MAX_ID_PHOTO_MB * 1024 * 1024) {
      setProblem({ field: "idPhoto", message: `That photo is over ${MAX_ID_PHOTO_MB} MB. Choose a smaller one.` });
      return;
    }
    setProblem(null);
    setIdPhotoFile(file);
  };

  // Same rules as before, now checked one step at a time.
  const validateStep = (s) => {
    if (s === 0) {
      if (!form.fullName.trim()) return { field: "fullName", message: "Full name is required." };
      if (!form.email.trim()) return { field: "email", message: "Email is required." };
      if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) return { field: "email", message: "Please enter a valid email address." };
      if (!form.phone.trim()) return { field: "phone", message: "Mobile phone is required." };
      if (!form.idType) return { field: "idType", message: "Please select an ID Type." };
      if (!form.idNumber.trim()) return { field: "idNumber", message: "ID Number is required." };
      if (!idPhotoFile) return { field: "idPhoto", message: "Please upload a photo of the ID." };
    }
    if (s === 1) {
      if (!form.propertyId) return { field: "propertyId", message: "Please select a property." };
      if (!form.roomId) return { field: "roomId", message: "Please select a room." };
      if (isRoomUnderMaintenance(rooms.find((r) => r.roomName === form.roomId))) {
        return { field: "roomId", message: MAINTENANCE_ROOM_MESSAGE };
      }
      if (bedOptions.length > 0 && !form.bedId) return { field: "bedId", message: "Please assign a bed." };
    }
    if (s === 2) {
      if (!form.leaseStartDate) return { field: "leaseStartDate", message: "Lease start date is required." };
      if (!form.leaseDuration) return { field: "leaseDuration", message: "Lease duration is required." };
      if (form.leaseDuration === "custom" && !form.customLeaseDuration.trim()) {
        return { field: "customLeaseDuration", message: "Please specify the custom lease duration." };
      }
    }
    return null;
  };

  const goToStep = (next) => {
    setStep(next);
    scrollToTop();
  };

  const handleNext = () => {
    const found = validateStep(step);
    if (found) {
      setProblem(found);
      scrollToTop();
      return;
    }
    setProblem(null);
    goToStep(step + 1);
  };

  const handleBack = () => {
    if (loading) return;
    setProblem(null);
    setError("");
    if (step === 0) navigate(-1);
    else goToStep(step - 1);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    // Enter on an earlier step just moves forward
    if (step < STEPS.length - 1) {
      handleNext();
      return;
    }

    // Final check of every step; jump back to the first one with a problem
    for (let s = 0; s < STEPS.length; s += 1) {
      const found = validateStep(s);
      if (found) {
        setProblem(found);
        goToStep(s);
        return;
      }
    }
    setProblem(null);

    setLoading(true);
    try {
      // 2. Re-check the room with the latest data before anything is uploaded
      //    or created: it may have filled up or been put under maintenance
      //    since this form was opened.
      const freshRooms = await getPropertyRoomOccupancy(form.propertyId);
      const selectedRoom = freshRooms.find((room) => room.roomName === form.roomId);
      const roomOccupiedBeds = Number(selectedRoom?.occupiedBeds || 0);
      const roomCapacity = Number(selectedRoom?.capacity || 0);

      if (isRoomUnderMaintenance(selectedRoom)) {
        throw new Error("This room was just put under maintenance. Choose another room.");
      }
      if (!selectedRoom || roomOccupiedBeds >= roomCapacity) {
        throw new Error("The selected room is already full. Choose another room or bed.");
      }

      // 3. Upload ID Photo to Cloudinary
      let idPhotoUrl = null;
      if (idPhotoFile) {
        try {
          idPhotoUrl = await uploadToCloudinary(idPhotoFile);
        } catch {
          throw new Error("Failed to upload ID photo. Please check your connection and try again.");
        }
      }

      // Resolve Lease Duration (Standard vs Custom)
      const finalLeaseDuration =
        form.leaseDuration === "custom"
          ? form.customLeaseDuration.trim()
          : form.leaseDuration;

      const leaseStart = new Date(`${form.leaseStartDate}T00:00:00`);
      const leaseMonths =
        form.leaseDuration === "1_month"
          ? 1
          : form.leaseDuration === "3_months"
            ? 3
            : form.leaseDuration === "6_months"
              ? 6
              : form.leaseDuration === "12_months"
                ? 12
                : null;

      // 1. Create the Auth account LAST among the things that can fail, so a
      //    full room or a failed photo upload never leaves behind an orphan
      //    account (which would make a retry fail with "email already in use").
      const tempPassword = generateTempPassword();
      const newUid = await createSubUserWithoutSignOut(
        form.email.trim(),
        tempPassword
      );

      // 4. Construct Tenant Document Payload
      const ownerUid = auth.currentUser?.uid || null;
      const monthlyRent = Number(selectedRoom?.monthlyRatePerBed || 0);
      const leaseEndDate = leaseMonths !== null ? addMonthsClamped(leaseStart, leaseMonths).toISOString() : null;
      const tenantProfile = {
        uid: newUid,
        ownerUid,
        name: form.fullName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        role: "tenant",
        status: "Active",
        idType: form.idType,
        idNumber: form.idNumber.trim(),
        idPhotoUrl,
        propertyId: form.propertyId,
        roomId: form.roomId,
        bedId: form.bedId || null,
        monthlyRent,
        rentAmount: monthlyRent,
        roomMonthlyRate: monthlyRent,
        leaseStartDate: form.leaseStartDate,
        leaseEndDate,
        leaseEnd: leaseEndDate,
        leaseDuration: finalLeaseDuration,
        createdAt: new Date().toISOString(),
      };

      // 5. Save to Firestore
      await setDoc(doc(db, "users", newUid), tenantProfile);
      await setDoc(doc(db, "tenants", newUid), {
        ...tenantProfile,
        fullName: tenantProfile.name,
      });
      await reconcilePropertyOccupancy(form.propertyId);

      navigate(-1);
    } catch (err) {
      console.error("Submit Error:", err); 
      // Friendly text for known sign-up errors, the raw message for our own errors
      const friendly = String(err?.code || "").startsWith("auth/") ? mapFirebaseError(err.code) : "";
      setError(friendly || err.message || mapFirebaseError(err.code)); 
      scrollToTop();
    } finally {
      setLoading(false);
    }
  };

  // ------------------------------------------------------------------ UI
  const selectedProperty = properties.find((p) => p.id === form.propertyId);
  const selectedRoom = rooms.find((r) => r.roomName === form.roomId);
  const monthlyRate = Number(selectedRoom?.monthlyRatePerBed || 0);
  const leaseLabel =
    form.leaseDuration === "custom"
      ? form.customLeaseDuration.trim()
      : LEASE_DURATIONS.find((d) => d.value === form.leaseDuration)?.label || "";
  const idTypeLabel = ID_TYPES.find((t) => t.value === form.idType)?.label || "";

  const flag = (field) => ({ error: problem?.field === field });
  const alertMessage = error || problem?.message || "";
  const isLast = step === STEPS.length - 1;

  const reviewRows = [
    ["Tenant", form.fullName.trim()],
    ["Email", form.email.trim()],
    ["ID", [idTypeLabel, form.idNumber].filter(Boolean).join(" · ")],
    ["Room", [selectedProperty?.propertyName, form.roomId, form.bedId].filter(Boolean).join(" · ")],
    ["Monthly rent", monthlyRate ? `₱${monthlyRate.toLocaleString()}` : ""],
    ["Lease", [leaseLabel, form.leaseStartDate && `from ${form.leaseStartDate}`].filter(Boolean).join(" · ")],
  ].filter(([, v]) => v);

  return (
    <Box
      ref={scrollRef}
      sx={{
        // A focused flow like the property setup: covers the dashboard chrome.
        position: "fixed",
        inset: 0,
        zIndex: (t) => t.zIndex.modal - 1,
        bgcolor: "background.default",
        overflowY: { xs: "auto", md: "hidden" },
        overscrollBehavior: "contain",
        display: "flex",
        flexDirection: { xs: "column", md: "row" },
      }}
    >
      {/* Sidebar */}
      <Box
        sx={{
          flex: { xs: "0 0 auto", md: "0 0 300px" },
          bgcolor: "#202020",
          color: "#ffffff",
          display: "flex",
          flexDirection: "column",
          gap: 4,
          px: { xs: 3, md: 4 },
          py: { xs: 3, md: 5 },
          overflowY: { md: "auto" },
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <Box component="img" src="/KwartoKeeper-DarkMode-Icon.png" alt="KwartoKeeper" sx={{ height: 28 }} />
          <Typography sx={{ fontFamily: '"Inter", sans-serif', fontWeight: 700, fontSize: "1rem", flex: 1 }}>
            Register tenant
          </Typography>
          <IconButton
            aria-label="Cancel registration"
            onClick={() => navigate(-1)}
            disabled={loading}
            size="small"
            sx={{ color: "#cadcf6", display: { md: "none" } }}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>

        {/* Mobile step indicator */}
        <Box sx={{ display: { xs: "block", md: "none" } }}>
          <Typography variant="body2" sx={{ color: "#cadcf6", mb: 1 }}>
            Step {step + 1} of {STEPS.length} — {STEPS[step].title}
          </Typography>
          <Box sx={{ display: "flex", gap: 0.75 }}>
            {STEPS.map(({ title }, i) => (
              <Box
                key={title}
                sx={{
                  flex: 1,
                  height: 4,
                  borderRadius: 2,
                  bgcolor: i <= step ? "primary.main" : "rgba(202, 220, 246, 0.2)",
                  transition: "background-color 0.2s ease",
                }}
              />
            ))}
          </Box>
        </Box>

        {/* Desktop step indicator */}
        <Box sx={{ display: { xs: "none", md: "block" } }}>
          <StepList activeStep={step} />
        </Box>

        <Box sx={{ display: { xs: "none", md: "block" }, mt: "auto" }}>
          <DormFacade />
        </Box>
      </Box>

      {/* Main content */}
      <Box
        ref={mainRef}
        component="form"
        onSubmit={handleSubmit}
        noValidate
        sx={{
          flex: 1,
          minWidth: 0,
          display: "flex",
          flexDirection: "column",
          overflowY: { md: "auto" },
          bgcolor: "background.default",
        }}
      >
        <Box sx={{ flex: 1, display: "flex", justifyContent: "center", px: { xs: 3, md: 6 }, pt: { xs: 4, md: 6 } }}>
          <Box sx={{ width: "100%", maxWidth: 760 }}>
            {alertMessage && (
              <Alert severity="error" sx={{ mb: 3 }}>
                {alertMessage}
              </Alert>
            )}

            <Box sx={{ width: "100%", maxWidth: 700, mx: "auto", px: { xs: 0, sm: 2 }, pb: 4 }}>
              <Box sx={{ mb: 4 }}>
                <Typography variant="h5" sx={{ fontFamily: '"Inter", sans-serif', fontWeight: 600 }} color="text.primary">
                  {STEPS[step].heading}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  {STEPS[step].sub}
                </Typography>
              </Box>

              <Box sx={{ display: "flex", flexDirection: "column", gap: 3 }}>
                {/* ---------------- STEP 1: TENANT ---------------- */}
                {step === 0 && (
                  <>
                    <FormRow label="Full name" required>
                      <TextField fullWidth placeholder="e.g. Juan Dela Cruz" value={form.fullName} onChange={handleChange("fullName")} autoComplete="off" {...flag("fullName")} />
                    </FormRow>

                    <FormRow label="Email" required>
                      <TextField fullWidth type="email" placeholder="name@example.com" value={form.email} onChange={handleChange("email")} autoComplete="off" {...flag("email")} />
                    </FormRow>

                    <FormRow label="Mobile phone" required>
                      <TextField
                        fullWidth
                        type="tel"
                        placeholder="e.g. 09171234567"
                        value={form.phone}
                        onChange={handleChange("phone")}
                        slotProps={{ htmlInput: { maxLength: 15, inputMode: "numeric" },
                          input: {
                            startAdornment: (
                              <InputAdornment position="start">
                                <PhoneOutlinedIcon sx={{ fontSize: 18, color: "text.secondary" }} />
                              </InputAdornment>
                            ),
                          },
                        }}
                        {...flag("phone")}
                      />
                    </FormRow>

                    <FormRow label="ID details" required top>
                      <Group icon={<BadgeOutlinedIcon sx={{ fontSize: 18, color: "primary.main" }} />} title="A valid student or government ID">
                        <TextField select fullWidth label="ID type" value={form.idType} onChange={handleChange("idType")} {...flag("idType")}>
                          {ID_TYPES.map((opt) => (
                            <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                          ))}
                        </TextField>
                        <TextField
                          fullWidth
                          label="ID number"
                          value={form.idNumber}
                          onChange={handleChange("idNumber")}
                          helperText="Letters, numbers and hyphens only"
                          {...flag("idNumber")}
                        />

                        {idPhotoFile ? (
                          <Box
                            sx={{
                              display: "flex",
                              alignItems: "center",
                              gap: 1.5,
                              bgcolor: "background.paper",
                              borderRadius: "4px",
                              border: "1px solid",
                              borderColor: "divider",
                              p: 1,
                            }}
                          >
                            <Box
                              component="img"
                              ref={idPreviewRef}
                              alt="ID preview"
                              sx={{ width: 56, height: 56, borderRadius: "4px", objectFit: "cover", flexShrink: 0 }}
                            />
                            <Box sx={{ flex: 1, minWidth: 0 }}>
                              <Typography variant="body2" noWrap sx={{ fontWeight: 600 }}>
                                {idPhotoFile.name}
                              </Typography>
                              <Typography variant="caption" color="success.main" sx={{ display: "flex", alignItems: "center", gap: 0.5, fontWeight: 700 }}>
                                <CheckIcon sx={{ fontSize: 14 }} /> ID photo added
                              </Typography>
                            </Box>
                            <IconButton
                              size="small"
                              aria-label="Remove ID photo"
                              onClick={() => setIdPhotoFile(null)}
                              sx={{ flexShrink: 0, "&:hover": { bgcolor: "rgba(255, 69, 0, 0.08)", color: "primary.main" } }}
                            >
                              <CloseIcon fontSize="small" />
                            </IconButton>
                          </Box>
                        ) : (
                          <Box>
                            <Button
                              component="label"
                              variant="outlined"
                              startIcon={<CloudUploadOutlinedIcon />}
                              sx={{
                                color: "text.primary",
                                borderColor: problem?.field === "idPhoto" ? "error.main" : "divider",
                                borderStyle: "dashed",
                                borderWidth: "1.5px",
                                bgcolor: "background.paper",
                                py: 1.5,
                                width: "100%",
                                justifyContent: "flex-start",
                                "&:hover": { borderColor: "primary.main", bgcolor: "background.paper" },
                              }}
                            >
                              Upload ID photo
                              <Box component="span" sx={{ color: "primary.main", ml: 0.5 }}>*</Box>
                              <input type="file" accept="image/*" hidden onChange={handleIdPhoto} />
                            </Button>
                            <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.75 }}>
                              Required. A clear photo of the front, JPG or PNG up to {MAX_ID_PHOTO_MB} MB.
                            </Typography>
                          </Box>
                        )}
                      </Group>
                    </FormRow>
                  </>
                )}

                {/* ---------------- STEP 2: ROOM & BED ---------------- */}
                {step === 1 && (
                  <>
                    <FormRow label="Property" required>
                      <TextField
                        select
                        fullWidth
                        value={form.propertyId}
                        onChange={handleChange("propertyId")}
                        helperText={loadingProperties ? "Loading properties..." : properties.length === 0 ? "No properties found yet." : ""}
                        {...flag("propertyId")}
                      >
                        {properties.map((p) => (
                          <MenuItem key={p.id} value={p.id}>{p.propertyName || p.id}</MenuItem>
                        ))}
                      </TextField>
                    </FormRow>

                    <FormRow label="Room" required>
                      <TextField
                        select
                        fullWidth
                        value={form.roomId}
                        onChange={handleChange("roomId")}
                        disabled={!form.propertyId}
                        helperText={form.propertyId && rooms.length === 0 ? "No rooms found for this property." : ""}
                        {...flag("roomId")}
                      >
                        {rooms.map((r) => {
                          const availableBeds = Math.max(0, Number(r.capacity) - Number(r.occupiedBeds || 0));
                          const isFull = availableBeds === 0;
                          const inMaintenance = isRoomUnderMaintenance(r);
                          return (
                            <MenuItem key={r.roomName} value={r.roomName} disabled={isFull || inMaintenance}>
                              <Box sx={{ minWidth: 0 }}>
                                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                                  {r.roomName}
                                  <Typography component="span" variant="body2" color="text.secondary">
                                    {" "}· Floor {r.floor}
                                  </Typography>
                                </Typography>
                                <Typography variant="caption" color={inMaintenance ? "warning.main" : isFull ? "error" : "text.secondary"}>
                                  {inMaintenance
                                    ? `Under maintenance${r.maintenanceNote ? ` · ${r.maintenanceNote}` : ""}`
                                    : isFull
                                    ? "Fully occupied"
                                    : `${availableBeds} of ${r.capacity} beds available`}
                                  {!inMaintenance && r.monthlyRatePerBed !== undefined && ` · ₱${r.monthlyRatePerBed}/bed`}
                                </Typography>
                              </Box>
                            </MenuItem>
                          );
                        })}
                      </TextField>
                    </FormRow>

                    {bedOptions.length > 0 && (
                      <FormRow label="Bed / space" required>
                        <TextField select fullWidth value={form.bedId} onChange={handleChange("bedId")} disabled={!form.roomId} {...flag("bedId")}>
                          {bedOptions.map((bed) => (
                            <MenuItem key={bed} value={bed}>{bed}</MenuItem>
                          ))}
                        </TextField>
                      </FormRow>
                    )}

                    {selectedRoom && monthlyRate > 0 && (
                      <FormRow label="Monthly rent">
                        <Box sx={{ bgcolor: "background.paper", borderRadius: "4px", border: "1px solid", borderColor: "divider", px: 2, py: 1.25 }}>
                          <Typography sx={{ fontFamily: '"Inter", sans-serif', fontWeight: 800 }}>
                            ₱{monthlyRate.toLocaleString()}
                            <Typography component="span" variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
                              {" "}per bed
                            </Typography>
                          </Typography>
                        </Box>
                      </FormRow>
                    )}
                  </>
                )}

                {/* ---------------- STEP 3: LEASE ---------------- */}
                {step === 2 && (
                  <>
                    <FormRow label="Lease start date" required>
                      <TextField fullWidth type="date" value={form.leaseStartDate} onChange={handleChange("leaseStartDate")} {...flag("leaseStartDate")} />
                    </FormRow>

                    <FormRow label="Lease duration" required>
                      <TextField select fullWidth value={form.leaseDuration} onChange={handleChange("leaseDuration")} {...flag("leaseDuration")}>
                        {LEASE_DURATIONS.map((opt) => (
                          <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                        ))}
                      </TextField>
                    </FormRow>

                    {/* Custom Lease Input (Only visible if "Custom..." is selected) */}
                    {form.leaseDuration === "custom" && (
                      <FormRow label="Custom term" required>
                        <TextField
                          fullWidth
                          placeholder="e.g., 2 Years, Month-to-month, 5 Months"
                          value={form.customLeaseDuration}
                          onChange={handleChange("customLeaseDuration")}
                          autoFocus
                          {...flag("customLeaseDuration")}
                        />
                      </FormRow>
                    )}

                    <FormRow label="Review" top>
                      <Box sx={{ bgcolor: "background.paper", borderRadius: "4px", border: "1px solid", borderColor: "divider", p: 2 }}>
                        <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
                          {reviewRows.map(([label, value]) => (
                            <Box key={label} sx={{ display: "flex", gap: 2, justifyContent: "space-between" }}>
                              <Typography variant="body2" color="text.secondary" sx={{ flexShrink: 0 }}>{label}</Typography>
                              <Typography variant="body2" sx={{ fontWeight: 700, textAlign: "right", minWidth: 0, wordBreak: "break-word" }}>{value}</Typography>
                            </Box>
                          ))}
                        </Box>
                      </Box>
                      <Box sx={{ display: "flex", gap: 1.25, alignItems: "flex-start", color: "text.secondary", mt: 1.5 }}>
                        <InfoOutlinedIcon sx={{ fontSize: 18, mt: "2px", color: "primary.main" }} />
                        <Typography variant="caption" sx={{ fontSize: "0.8rem" }}>
                          The tenant gets an email with a secure link to set their own password before logging in.
                        </Typography>
                      </Box>
                    </FormRow>
                  </>
                )}
              </Box>
            </Box>
          </Box>
        </Box>

        {/* Back / Next — pinned to the bottom of the column so it stays reachable on phones */}
        <Box
          sx={{
            position: "sticky",
            bottom: 0,
            bgcolor: "background.default",
            display: "flex",
            justifyContent: "center",
            px: { xs: 3, md: 6 },
            pb: "calc(16px + env(safe-area-inset-bottom, 0px))",
            pt: 2,
          }}
        >
          <Box sx={{ width: "100%", maxWidth: 760, display: "flex", justifyContent: "space-between", gap: 2, pt: 2, borderTop: "1px solid", borderColor: "divider" }}>
            <Button variant="outlined" onClick={handleBack} disabled={loading} sx={{ py: 1.5, px: 3, fontWeight: 600 }}>
              {step === 0 ? "Cancel" : "Back"}
            </Button>
            <Button
              type={isLast ? "submit" : "button"}
              onClick={isLast ? undefined : handleNext}
              variant="contained"
              disabled={loading}
              sx={{ py: 1.5, px: 3, fontWeight: 600, minWidth: { xs: 140, sm: 160 }, bgcolor: "primary.main", "&:hover": { bgcolor: "primary.dark" } }}
            >
              {loading ? <CircularProgress size={24} color="inherit" /> : isLast ? "Register tenant" : "Next step"}
            </Button>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}

function mapFirebaseError(code) {
  switch (code) {
    case "auth/email-already-in-use":
      return "An account with this email already exists.";
    case "auth/invalid-email":
      return "Please enter a valid email address.";
    case "auth/weak-password":
      return "Password is too weak. Use at least 6 characters.";
    default:
      return "Something went wrong. Please check your connection and try again.";
  }
}