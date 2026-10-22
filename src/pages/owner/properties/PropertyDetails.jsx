import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Box, Paper, Typography, Button, Tabs, Tab, TextField,
  CircularProgress, IconButton, Snackbar, Alert,
  Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Chip, Switch,
  Dialog, DialogTitle, DialogContent, DialogActions, InputAdornment,
  Accordion, AccordionSummary, AccordionDetails, useMediaQuery, useTheme,
  Menu, MenuItem, LinearProgress, Skeleton,
} from "@mui/material";
import { alpha } from "@mui/material/styles";

// Icons
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import SaveIcon from "@mui/icons-material/Save";
import HomeWorkOutlinedIcon from "@mui/icons-material/HomeWorkOutlined";
import MeetingRoomOutlinedIcon from "@mui/icons-material/MeetingRoomOutlined";
import LayersOutlinedIcon from "@mui/icons-material/LayersOutlined";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutlined";
import CloudUploadOutlinedIcon from "@mui/icons-material/CloudUploadOutlined";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import CheckIcon from "@mui/icons-material/Check";
import PictureAsPdfOutlinedIcon from "@mui/icons-material/PictureAsPdfOutlined";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import CloseIcon from "@mui/icons-material/Close";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutlined";
import AddPhotoAlternateOutlinedIcon from "@mui/icons-material/AddPhotoAlternateOutlined";
import RefreshOutlinedIcon from "@mui/icons-material/RefreshOutlined";
import UndoRoundedIcon from "@mui/icons-material/UndoRounded";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutlined";

// Firebase
import { auth, db } from "../../../config/firebase";
import { doc, getDoc, updateDoc, deleteField } from "firebase/firestore";
import { uploadToCloudinary, uploadFileToCloudinary } from "../../../utils/cloudinary";
import { getPropertyCoverPhotoUrl } from "../../../utils/getPropertyCoverPhotoUrl";
import AddressFields from "../../../components/AddressFields";

// Must match the owner layout: top bar height, and bottom nav height on phones
const BAR_H = { xs: 56, md: 72 };
const BOTTOM_NAV_H = 64;

const INK = "#202020";
const HEAD = '"Inter", sans-serif';
const R = { sm: "10px", md: "14px", lg: "18px" };

const row = { display: "flex", alignItems: "center" };

const cardSx = {
  bgcolor: "background.default",
  border: "1px solid",
  borderColor: "divider",
  borderRadius: R.lg,
  minWidth: 0,
};

// Rounder inputs everywhere on this page
const fieldSx = { "& .MuiOutlinedInput-root": { borderRadius: R.sm } };

// Two fields side by side from sm up, stacked on phones
const fieldPair = { display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "repeat(2, minmax(0, 1fr))" }, gap: 2 };
const fieldStack = { display: "flex", flexDirection: "column", gap: 2 };

const DEFAULT_AMENITIES = [
  "Wi-Fi", "Air Conditioning", "CCTV", "Shared Kitchen",
  "Study Area", "Laundry Room", "Parking Space", "Water Heater", "24/7 Security Guard"
];

// Rule documents: what we accept, and the size cap per file
const ALLOWED_DOC_EXTENSIONS = [".pdf", ".doc", ".docx"];
const MAX_DOC_MB = 10;

const MAX_COVER_MB = 15; // before shrinking; the saved photo is far smaller

// Older properties stored the cover under other field names. Saving clears
// them so a removed photo can't come back through one of them.
const LEGACY_COVER_FIELDS = ["coverPhoto", "imageUrl", "photoUrl"];

// Shrink a phone photo before sending it: faster on mobile data
async function shrinkImage(file, maxDim = 1600, quality = 0.85) {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close?.();
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
    return blob && blob.size < file.size ? { blob, ext: "jpg" } : { blob: file, ext: (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg" };
  } catch {
    return { blob: file, ext: (file.name.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg" };
  }
}

const formatFileSize = (bytes) => {
  const n = Number(bytes);
  if (!n) return "";
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
};

const formatDate = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
};

// Quick presets for easy money entry
const RATE_PRESETS = [2000, 2500, 3000, 3500, 4000, 5000];

// Convert 24h time ("22:00") to 12h display ("10:00 PM")
const formatTo12Hour = (time24) => {
  if (!time24) return "";
  const [h, m] = time24.split(":");
  let hours = parseInt(h, 10);
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12 || 12;
  return `${hours}:${m} ${ampm}`;
};

// Convert 12h display ("10:00 PM") back to 24h for time input ("22:00")
const formatTo24Hour = (time12) => {
  if (!time12) return "22:00";
  const match = time12.match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (!match) return "22:00";
  const [, hours, minutes, period] = match;
  let h = parseInt(hours, 10);
  if (period.toUpperCase() === "PM" && h < 12) h += 12;
  if (period.toUpperCase() === "AM" && h === 12) h = 0;
  return `${String(h).padStart(2, "0")}:${minutes}`;
};

// Rate field with quick presets tucked behind a small dropdown
function RateInput({ value, onChange }) {
  const [anchorEl, setAnchorEl] = useState(null);

  return (
    <>
      <TextField
        fullWidth
        size="small"
        type="number"
        label="Monthly Rate / Bed"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        sx={fieldSx}
        slotProps={{
          htmlInput: { inputMode: "numeric", min: 0 },
          input: {
            startAdornment: <InputAdornment position="start">₱</InputAdornment>,
            endAdornment: (
              <InputAdornment position="end">
                <IconButton size="small" edge="end" onClick={(e) => setAnchorEl(e.currentTarget)} aria-label="Quick rate presets">
                  <ExpandMoreIcon fontSize="small" />
                </IconButton>
              </InputAdornment>
            ),
          },
        }}
      />
      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}>
        {RATE_PRESETS.map((preset) => (
          <MenuItem
            key={preset}
            selected={Number(value) === preset}
            onClick={() => {
              onChange(preset);
              setAnchorEl(null);
            }}
          >
            ₱{preset.toLocaleString()} / bed
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}

/**
 * One block of a settings card: title and a short explanation on the left,
 * the fields on the right (stacked on phones). Sections are separated by a
 * thin line instead of each living in its own boxed card.
 */
function Section({ title, description, action, children, first }) {
  return (
    <Box
      sx={{
        display: "grid",
        gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "260px minmax(0, 1fr)" },
        gap: { xs: 1.75, md: 4 },
        py: { xs: 2.5, md: 3.5 },
        borderTop: first ? "none" : "1px solid",
        borderColor: "divider",
      }}
    >
      <Box sx={{ ...row, alignItems: "flex-start", justifyContent: "space-between", gap: 1 }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography component="h2" sx={{ fontFamily: HEAD, fontWeight: 800, fontSize: "1rem", letterSpacing: "-0.01em" }}>
            {title}
          </Typography>
          {description && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, lineHeight: 1.55 }}>
              {description}
            </Typography>
          )}
        </Box>
        {action}
      </Box>
      <Box sx={{ minWidth: 0 }}>{children}</Box>
    </Box>
  );
}

const occupancyChipSx = (occupied, capacity) => {
  const isFull = capacity > 0 && occupied >= capacity;
  const tone = isFull ? "error" : occupied > 0 ? "warning" : "success";
  return { color: `${tone}.main`, bgcolor: (t) => alpha(t.palette[tone].main, 0.1), border: "none", fontWeight: 700 };
};

const EMPTY_ADDRESS = { street: "", barangay: "", cityMunicipality: "", province: "", region: "", regionCode: "", provinceCode: "", cityCode: "" };

export default function PropertyDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [saving, setSaving] = useState(false);
  const [savingStep, setSavingStep] = useState("");
  const [coverFailed, setCoverFailed] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);

  // Cover photo: a newly picked photo stays on the device (shown from a local
  // preview) and is only uploaded when the owner saves. Nothing is left
  // behind on the server if they change their mind.
  const [coverFile, setCoverFile] = useState(null);
  const [coverPreview, setCoverPreview] = useState("");
  const [coverPreparing, setCoverPreparing] = useState(false);

  // JSON snapshot of the last loaded/saved form, used to know if anything changed
  const [savedSnapshot, setSavedSnapshot] = useState("");
  const [roomToDelete, setRoomToDelete] = useState(null);
  const [tabValue, setTabValue] = useState(0);
  const [toast, setToast] = useState({ open: false, message: "", severity: "success" });

  // Custom Amenity Input State
  const [customAmenityInput, setCustomAmenityInput] = useState("");

  // Document upload state
  // uploads: files currently sending (or failed), shown with progress above the list
  const [uploads, setUploads] = useState([]);
  const [dragOver, setDragOver] = useState(false);
  // Links of the documents that are already saved on the property.
  const [savedDocUrls, setSavedDocUrls] = useState([]);

  // New Room Modal State
  const [openAddRoomModal, setOpenAddRoomModal] = useState(false);
  const [newRoomData, setNewRoomData] = useState({
    roomName: "",
    floor: 1,
    capacity: 2,
    monthlyRatePerBed: 2500
  });

  // Complete Form State
  const [formData, setFormData] = useState({
    propertyName: "",
    propertyType: "Dormitory",
    status: "Active",
    coverPhotoUrl: "",
    emergencyPhone: "",
    configMode: "uniform",
    namingPattern: "alpha",
    totalFloors: 1,
    totalRooms: 0,
    totalBeds: 0,
    occupiedBeds: 0,
    address: EMPTY_ADDRESS,
    curfew: {
      enabled: false,
      startTime: "10:00 PM"
    },
    amenities: [],
    rulesText: "",
    ruleFiles: [], // Array of uploaded document objects { name, url, path }
    rooms: []
  });

  useEffect(() => {
    const fetchProperty = async () => {
      setLoading(true);
      setLoadError("");
      try {
        const docRef = doc(db, "properties", id);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) {
          setLoadError("We couldn't find this property. It may have been removed.");
        } else {
          const data = docSnap.data();
          const rooms = Array.isArray(data.rooms) ? data.rooms : [];
          const a = data.address && typeof data.address === "object" ? data.address : {};

          const loaded = {
            propertyName: data.propertyName || "",
            propertyType: data.propertyType || "Dormitory",
            status: data.status || "Active",
            coverPhotoUrl: getPropertyCoverPhotoUrl(data),
            emergencyPhone: data.emergencyPhone || "",
            configMode: data.configMode || "uniform",
            namingPattern: data.namingPattern || "alpha",
            totalFloors: data.totalFloors || 1,
            totalRooms: rooms.length || data.totalRooms || 0,
            totalBeds: rooms.reduce((sum, r) => sum + (Number(r.capacity) || 0), 0),
            occupiedBeds: data.occupiedBeds || 0,
            // The registration wizard saves the address as top-level fields
            // (with PSGC codes); this page saves it as an `address` object.
            address: {
              street: (typeof data.address === "string" ? data.address : a.street) || data.street || data.streetAddress || "",
              barangay: a.barangay || data.barangay || "",
              cityMunicipality: a.cityMunicipality || data.cityMunicipality || data.city || "",
              province: a.province || data.province || "",
              region: a.region || data.region || "",
              regionCode: String(a.regionCode || data.regionCode || ""),
              provinceCode: String(a.provinceCode || data.provinceCode || ""),
              cityCode: String(a.cityCode || data.cityCode || ""),
            },
            curfew: {
              enabled: Boolean(data.curfew?.enabled ?? data.curfewEnabled),
              startTime: data.curfew?.startTime || data.curfewTime || "10:00 PM"
            },
            amenities: Array.isArray(data.amenities) ? data.amenities : [],
            rulesText: Array.isArray(data.rules) ? data.rules.join("\n") : typeof data.rules === "string" ? data.rules : data.rulesText || "",
            ruleFiles: Array.isArray(data.ruleFiles) ? data.ruleFiles : [],
            rooms: rooms
          };
          setFormData(loaded);
          setSavedSnapshot(JSON.stringify(loaded));
          setSavedDocUrls(loaded.ruleFiles.map((f) => f.url).filter(Boolean));
          setCoverFile(null);
          setCoverPreview("");
          setCoverFailed(false);
        }
      } catch (error) {
        console.error("Error fetching property:", error);
        setLoadError("We couldn't load this property. Check your connection and try again.");
      } finally {
        setLoading(false);
      }
    };

    fetchProperty();
  }, [id, reloadKey]);

  // Free the local preview when it's replaced or the page closes
  useEffect(() => () => {
    if (coverPreview) URL.revokeObjectURL(coverPreview);
  }, [coverPreview]);

  // Handle generic inputs
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // Address fields send only the parts that changed
  const handleAddressPatch = (patch) => {
    setFormData((prev) => ({ ...prev, address: { ...prev.address, ...patch } }));
  };

  // Handle Curfew Change (Converts 24h HTML time to 12h string)
  const handleCurfewTimeChange = (e) => {
    const time12 = formatTo12Hour(e.target.value);
    setFormData(prev => ({ ...prev, curfew: { ...prev.curfew, startTime: time12 } }));
  };

  const handleCurfewToggle = (e) => {
    const checked = e.target.checked;
    setFormData(prev => ({ ...prev, curfew: { ...prev.curfew, enabled: checked } }));
  };

  // Amenities logic
  const handleAmenityToggle = (amenity) => {
    setFormData(prev => {
      const exists = prev.amenities.includes(amenity);
      const updated = exists ? prev.amenities.filter(a => a !== amenity) : [...prev.amenities, amenity];
      return { ...prev, amenities: updated };
    });
  };

  const handleAddCustomAmenity = () => {
    const trimmed = customAmenityInput.trim();
    if (!trimmed) return;
    if (formData.amenities.includes(trimmed)) {
      setToast({ open: true, message: "Amenity already exists", severity: "warning" });
      return;
    }
    setFormData(prev => ({ ...prev, amenities: [...prev.amenities, trimmed] }));
    setCustomAmenityInput("");
  };

  // Rooms logic
  const handleRoomChange = (index, field, value) => {
    setFormData(prev => {
      const updatedRooms = [...prev.rooms];
      updatedRooms[index] = {
        ...updatedRooms[index],
        [field]: field === "monthlyRatePerBed" || field === "capacity" || field === "floor"
          ? Math.max(0, Number(value) || 0)
          : value
      };
      return {
        ...prev,
        rooms: updatedRooms,
        totalBeds: updatedRooms.reduce((sum, r) => sum + (Number(r.capacity) || 0), 0),
        totalRooms: updatedRooms.length
      };
    });
  };

  const handleDeleteRoom = (index) => {
    setFormData(prev => {
      const updated = prev.rooms.filter((_, i) => i !== index);
      return {
        ...prev,
        rooms: updated,
        totalRooms: updated.length,
        totalBeds: updated.reduce((sum, r) => sum + (Number(r.capacity) || 0), 0)
      };
    });
  };

  const handleCreateRoom = () => {
    if (!newRoomData.roomName.trim()) {
      setToast({ open: true, message: "Please provide a room name", severity: "error" });
      return;
    }
    if (formData.rooms.some((r) => String(r.roomName).trim().toLowerCase() === newRoomData.roomName.trim().toLowerCase())) {
      setToast({ open: true, message: "A room with that name already exists", severity: "error" });
      return;
    }

    const newRoom = {
      id: `room_${Date.now()}`,
      roomName: newRoomData.roomName.trim(),
      floor: Number(newRoomData.floor) || 1,
      capacity: Number(newRoomData.capacity) || 1,
      occupiedBeds: 0,
      monthlyRatePerBed: Number(newRoomData.monthlyRatePerBed) || 0
    };

    setFormData(prev => {
      const updatedRooms = [...prev.rooms, newRoom];
      return {
        ...prev,
        rooms: updatedRooms,
        totalRooms: updatedRooms.length,
        totalFloors: Math.max(prev.totalFloors, newRoom.floor),
        totalBeds: updatedRooms.reduce((sum, r) => sum + (Number(r.capacity) || 0), 0)
      };
    });

    setOpenAddRoomModal(false);
    setNewRoomData({ roomName: "", floor: 1, capacity: 2, monthlyRatePerBed: 2500 });
  };

  // ---- Cover photo -------------------------------------------------------
  const savedCoverUrl = savedSnapshot ? JSON.parse(savedSnapshot).coverPhotoUrl || "" : "";
  const coverRemovalPending = Boolean(savedCoverUrl) && !formData.coverPhotoUrl && !coverFile;
  const shownCover = coverPreview || formData.coverPhotoUrl;

  // Pick from the device (camera roll or camera on a phone). Shrunk and
  // previewed locally; uploaded on save.
  const handleCoverPick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || coverPreparing) return;
    if (!file.type.startsWith("image/") || /heic|heif/i.test(file.type)) {
      setToast({ open: true, message: "Please choose a JPG or PNG photo.", severity: "error" });
      return;
    }
    if (file.size > MAX_COVER_MB * 1024 * 1024) {
      setToast({ open: true, message: `That photo is over ${MAX_COVER_MB} MB.`, severity: "error" });
      return;
    }

    setCoverPreparing(true);
    try {
      const { blob, ext } = await shrinkImage(file);
      const ready = blob instanceof File ? blob : new File([blob], `cover_${Date.now()}.${ext}`, { type: blob.type || file.type });
      if (ready.size > 5 * 1024 * 1024) {
        setToast({ open: true, message: "That photo is still over 5 MB after resizing. Choose a smaller one.", severity: "error" });
        return;
      }
      setCoverFile(ready);
      setCoverPreview(URL.createObjectURL(ready));
      setCoverFailed(false);
    } finally {
      setCoverPreparing(false);
    }
  };

  // Remove: drops a not-yet-saved pick, otherwise marks the saved photo for
  // removal (it is deleted when the owner saves).
  const handleRemoveCover = () => {
    if (coverFile) {
      setCoverFile(null);
      setCoverPreview("");
      return;
    }
    setFormData((prev) => ({ ...prev, coverPhotoUrl: "" }));
    setCoverFailed(false);
  };

  const handleUndoRemoveCover = () => {
    setFormData((prev) => ({ ...prev, coverPhotoUrl: savedCoverUrl }));
  };

  // File upload logic (rules & documents)
  const processFiles = async (fileList) => {
    const files = Array.from(fileList || []);
    if (files.length === 0) return;

    let uploaded = 0;
    for (const file of files) {
      const ext = `.${(file.name.split(".").pop() || "").toLowerCase()}`;
      if (!ALLOWED_DOC_EXTENSIONS.includes(ext)) {
        setToast({ open: true, message: `"${file.name}" isn't a PDF or Word file.`, severity: "error" });
        continue;
      }
      if (file.size > MAX_DOC_MB * 1024 * 1024) {
        setToast({ open: true, message: `"${file.name}" is over ${MAX_DOC_MB} MB.`, severity: "error" });
        continue;
      }
      if (!auth.currentUser) {
        setToast({ open: true, message: "You're signed out. Sign in again and retry.", severity: "error" });
        break;
      }
      const uploadId = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      setUploads((prev) => [...prev, { id: uploadId, name: file.name, error: "" }]);

      try {
        const downloadUrl = await uploadFileToCloudinary(file, MAX_DOC_MB);
        if (!downloadUrl) throw new Error("No link came back");
        const fileObj = { name: file.name, url: downloadUrl, size: file.size, uploadedAt: new Date().toISOString() };
        setFormData((prev) => ({ ...prev, ruleFiles: [...prev.ruleFiles, fileObj] }));
        setUploads((prev) => prev.filter((u) => u.id !== uploadId));
        uploaded += 1;
      } catch (error) {
        console.error("File upload error:", error);
        const reason = /size limit/i.test(error?.message || "") ? error.message : "Upload failed";
        setUploads((prev) => prev.map((u) => (u.id === uploadId ? { ...u, error: reason } : u)));
      }
    }

    if (uploaded > 0) {
      setToast({
        open: true,
        message: uploaded === 1 ? "Document added. Save to keep it." : `${uploaded} documents added. Save to keep them.`,
        severity: "success",
      });
    }
  };

  const handleFileInput = (e) => {
    processFiles(e.target.files);
    e.target.value = ""; // lets the same file be picked again
  };

  const handleDropFiles = (e) => {
    e.preventDefault();
    setDragOver(false);
    processFiles(e.dataTransfer?.files);
  };

  const dismissUpload = (uploadId) => setUploads((prev) => prev.filter((u) => u.id !== uploadId));

  const handleDeleteFile = (index) => {
    setFormData((prev) => ({ ...prev, ruleFiles: prev.ruleFiles.filter((_, i) => i !== index) }));
  };

  const isUploading = uploads.some((u) => !u.error) || coverPreparing;
  const isDirty = !loading && (JSON.stringify(formData) !== savedSnapshot || Boolean(coverFile));

  // Save to Firebase
  const handleSave = async () => {
    if (isUploading) return; // wait for uploads in flight

    // Check the form before writing anything
    const fail = (message, tab) => {
      setToast({ open: true, message, severity: "error" });
      if (tab !== undefined) setTabValue(tab);
    };
    if (!formData.propertyName.trim()) return fail("Give the property a name.", 0);
    const seen = new Set();
    for (const r of formData.rooms) {
      const name = String(r.roomName || "").trim();
      if (!name) return fail("Every room needs a name.", 1);
      if (seen.has(name.toLowerCase())) return fail(`There are two rooms named "${name}". Rename one.`, 1);
      seen.add(name.toLowerCase());
      if (!(Number(r.floor) >= 1)) return fail(`"${name}" needs a floor of 1 or higher.`, 1);
      if (!(Number(r.capacity) >= 1)) return fail(`"${name}" needs at least 1 bed.`, 1);
      if (Number(r.capacity) < Number(r.occupiedBeds || 0)) return fail(`"${name}" has ${r.occupiedBeds} tenants but only ${r.capacity} beds.`, 1);
    }
    if (coverFile && !auth.currentUser) return fail("You're signed out. Sign in again and retry.");

    setSaving(true);
    try {
      // 1. A newly picked cover is uploaded now, only because the owner is saving it
      let coverUrl = formData.coverPhotoUrl || "";
      if (coverFile) {
        setSavingStep("Uploading photo...");
        try {
          coverUrl = await uploadToCloudinary(coverFile);
          if (!coverUrl) throw new Error("No link came back");
        } catch (error) {
          console.error("Cover upload error:", error);
          setToast({ open: true, message: "The cover photo couldn't be uploaded. Check your connection and try again.", severity: "error" });
          return;
        }
      }

      setSavingStep("Saving...");
      const docRef = doc(db, "properties", id);

      // Occupancy changes whenever a tenant is registered or moves out, so take the latest counts instead of the ones loaded with the page
      const fresh = await getDoc(docRef);
      const live = fresh.exists() ? fresh.data() : {};
      const liveRooms = new Map((Array.isArray(live.rooms) ? live.rooms : []).map((r) => [r.id, r]));
      const a = formData.address;

      const updatePayload = {
        propertyName: formData.propertyName,
        propertyType: formData.propertyType,
        status: formData.status,
        // One field for the cover from now on; the old names are cleared so a
        // removed photo can't reappear through them. The server deletes the
        // file itself once nothing points at it (functions/src/mediaCleanup.js).
        coverPhotoUrl: coverUrl || null,
        ...Object.fromEntries(LEGACY_COVER_FIELDS.map((field) => [field, deleteField()])),
        emergencyPhone: formData.emergencyPhone,
        configMode: formData.configMode,
        namingPattern: formData.namingPattern,
        totalFloors: Math.max(1, Number(formData.totalFloors) || 1, ...formData.rooms.map((r) => Number(r.floor) || 1)),
        totalRooms: Number(formData.rooms.length),
        totalBeds: formData.rooms.reduce((sum, r) => sum + (Number(r.capacity) || 0), 0),
        occupiedBeds: Number(live.occupiedBeds ?? formData.occupiedBeds) || 0,
        address: {
          street: a.street,
          barangay: a.barangay,
          cityMunicipality: a.cityMunicipality,
          province: a.province,
          region: a.region,
          regionCode: a.regionCode || "",
          provinceCode: a.provinceCode || "",
          cityCode: a.cityCode || "",
        },
        curfew: {
          enabled: formData.curfew.enabled,
          startTime: formData.curfew.startTime
        },
        amenities: formData.amenities,
        rules: formData.rulesText.split("\n").map(r => r.trim()).filter(Boolean),
        ruleFiles: formData.ruleFiles,
        rooms: formData.rooms.map(room => ({
          ...room,
          id: room.id || `room_${Math.random()}`,
          roomName: room.roomName,
          floor: Number(room.floor),
          capacity: Number(room.capacity),
          occupiedBeds: Number((liveRooms.get(room.id)?.occupiedBeds ?? room.occupiedBeds) || 0),
          monthlyRatePerBed: Number(room.monthlyRatePerBed || 0)
        })),
        updatedAt: new Date()
      };

      await updateDoc(docRef, updatePayload);

      const savedForm = { ...formData, coverPhotoUrl: coverUrl };
      setFormData(savedForm);
      setSavedSnapshot(JSON.stringify(savedForm));
      setSavedDocUrls(formData.ruleFiles.map((f) => f.url).filter(Boolean));
      setCoverFile(null);
      setCoverPreview("");
      setToast({ open: true, message: "Changes saved.", severity: "success" });
    } catch (error) {
      console.error("Error updating property:", error);
      setToast({ open: true, message: "Failed to save property.", severity: "error" });
    } finally {
      setSaving(false);
      setSavingStep("");
    }
  };

  // Warn before closing/reloading the tab with unsaved edits
  useEffect(() => {
    if (!isDirty && !isUploading) return undefined;
    const warn = (e) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [isDirty, isUploading]);

  if (loading) {
    return (
      <Box sx={{ maxWidth: 1080, mx: "auto" }}>
        <Skeleton variant="rounded" height={64} sx={{ borderRadius: R.lg, mb: 2.5 }} />
        <Skeleton variant="rounded" height={46} sx={{ borderRadius: R.md, mb: 2.5 }} />
        <Skeleton variant="rounded" height={420} sx={{ borderRadius: R.lg }} />
      </Box>
    );
  }

  if (loadError) {
    return (
      <Box sx={{ maxWidth: 520, mx: "auto", mt: { xs: 4, md: 8 }, textAlign: "center", px: 2 }}>
        <ErrorOutlineIcon color="error" sx={{ fontSize: 40, mb: 1 }} />
        <Typography sx={{ fontFamily: HEAD, fontWeight: 800, fontSize: "1.2rem", mb: 0.5 }}>Can't open this property</Typography>
        <Typography color="text.secondary" sx={{ mb: 3 }}>{loadError}</Typography>
        <Box sx={{ display: "flex", gap: 1.5, justifyContent: "center", flexWrap: "wrap" }}>
          <Button variant="outlined" startIcon={<ArrowBackIcon />} onClick={() => navigate("/owner/properties")} sx={{ fontWeight: 700, borderRadius: R.sm, minHeight: 46 }}>
            Back to properties
          </Button>
          <Button variant="contained" startIcon={<RefreshOutlinedIcon />} onClick={() => setReloadKey((k) => k + 1)} sx={{ fontWeight: 700, borderRadius: R.sm, minHeight: 46 }}>
            Try again
          </Button>
        </Box>
      </Box>
    );
  }

  // Group rooms by floor
  const roomsByFloor = formData.rooms.reduce((acc, room, index) => {
    const floorNum = room.floor || 1;
    if (!acc[floorNum]) acc[floorNum] = [];
    acc[floorNum].push({ ...room, originalIndex: index });
    return acc;
  }, {});
  const floorNumbers = Object.keys(roomsByFloor).sort((a, b) => Number(a) - Number(b));

  const saveLabel = saving ? savingStep || "Saving..." : "Save changes";
  const roomName = (room) => room?.roomName || "this room";
  const goBack = () => (isDirty || isUploading ? setLeaveOpen(true) : navigate(`/owner/properties/${id}`));

  return (
    <Box sx={{ pb: { xs: 2, md: 6 }, maxWidth: 1080, mx: "auto", minWidth: 0 }}>
      {/* HEADER: back, what you're editing, and saving */}
      <Box sx={{ ...row, gap: { xs: 1.25, sm: 1.75 }, mb: { xs: 2, md: 2.5 } }}>
        <IconButton aria-label="Back to the property" onClick={goBack} sx={{ flexShrink: 0, border: "1px solid", borderColor: "divider", bgcolor: "background.default" }}>
          <ArrowBackIcon />
        </IconButton>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, display: "block", lineHeight: 1.2 }}>
            Edit property
          </Typography>
          <Typography sx={{ fontFamily: HEAD, fontWeight: 800, letterSpacing: "-0.02em", fontSize: { xs: "1.15rem", sm: "1.45rem" }, lineHeight: 1.25 }} noWrap>
            {formData.propertyName || "Unnamed Property"}
          </Typography>
        </Box>

        {/* Desktop save: always visible, enabled once something changed */}
        <Box sx={{ display: { xs: "none", sm: "flex" }, alignItems: "center", gap: 1.5, flexShrink: 0 }}>
          <Typography variant="body2" sx={{ ...row, gap: 0.75, fontWeight: 700, color: isDirty ? "warning.dark" : "text.secondary" }}>
            {isDirty ? <Box sx={{ width: 7, height: 7, borderRadius: "50%", bgcolor: "warning.main" }} /> : <CheckCircleOutlineIcon sx={{ fontSize: 17, color: "success.main" }} />}
            {isDirty ? "Unsaved changes" : "All changes saved"}
          </Typography>
          <Button
            variant="contained"
            startIcon={saving ? <CircularProgress size={18} color="inherit" /> : <SaveIcon />}
            onClick={handleSave}
            disabled={saving || !isDirty || isUploading}
            sx={{ fontWeight: 700, px: 2.5, borderRadius: R.sm, boxShadow: "none" }}
          >
            {saveLabel}
          </Button>
        </Box>
      </Box>

      {/* TABS — sticky just under the top bar so they stay reachable in long tabs */}
      <Box
        sx={{
          position: "sticky",
          top: BAR_H,
          zIndex: 5,
          mb: { xs: 2, md: 2.5 },
          // Same colour as the page behind it (the owner layout's tinted
          // background), so the bar doesn't read as a separate white strip,
          // but solid so content scrolls cleanly underneath.
          bgcolor: "#faf7f3",
          borderBottom: "1px solid",
          borderColor: "divider",
          // phones: run edge to edge, labels lined up with the page padding
          mx: { xs: -2, sm: 0 },
          px: { xs: 2, sm: 0 },
        }}
      >
        <Tabs
          value={tabValue}
          onChange={(e, val) => setTabValue(val)}
          variant="scrollable"
          scrollButtons={false}
          sx={{
            minHeight: 46,
            // space between labels (a margin on each tab, so it doesn't depend on
            // the inner list's class name, which changed in MUI v9)
            "& .MuiTab-root:not(:last-of-type)": { mr: { xs: 2.5, sm: 3.5 } },
            "& .MuiTabs-indicator": { height: 3, borderRadius: "3px 3px 0 0" },
            // no minimum width or side padding: the underline sits exactly under each label
            "& .MuiTab-root": { minWidth: 0, minHeight: 46, px: 0, py: 0, textTransform: "none", fontWeight: 700, fontSize: 14.5, color: "text.secondary", "&:hover": { color: "text.primary" } },
            "& .MuiTab-root.Mui-selected": { color: "text.primary" },
          }}
        >
          <Tab label="General" />
          <Tab label={`Rooms & rates (${formData.rooms.length})`} />
          <Tab label="Rules & curfew" />
          <Tab label="Amenities" />
        </Tabs>
      </Box>

      {/* TAB 0: GENERAL */}
      {tabValue === 0 && (
        <Paper elevation={0} sx={{ ...cardSx, px: { xs: 2, sm: 3.5 } }}>
          <Section first title="Cover photo" description="Shown on the property page and on tenants' dashboards.">
            <Box sx={{ display: "flex", flexDirection: { xs: "column", sm: "row" }, gap: 2, alignItems: { sm: "center" } }}>
              <Box
                sx={{
                  position: "relative",
                  width: { xs: "100%", sm: 240 },
                  flexShrink: 0,
                  aspectRatio: "16 / 10",
                  borderRadius: R.md,
                  overflow: "hidden",
                  border: "1px solid",
                  borderColor: coverRemovalPending ? "error.main" : "divider",
                  borderStyle: coverRemovalPending ? "dashed" : "solid",
                  bgcolor: (t) => alpha(t.palette.background.paper, 0.5),
                  ...row,
                  justifyContent: "center",
                }}
              >
                {shownCover && !coverFailed ? (
                  <Box component="img" src={shownCover} alt="Property cover" onError={() => setCoverFailed(true)} sx={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
                ) : coverRemovalPending ? (
                  <DeleteOutlineIcon sx={{ color: "error.main", fontSize: 32 }} />
                ) : (
                  <HomeWorkOutlinedIcon sx={{ color: "text.disabled", fontSize: 34 }} />
                )}
                {coverFile && (
                  <Box sx={{ position: "absolute", top: 8, left: 8, px: 0.75, py: 0.2, borderRadius: "6px", bgcolor: "warning.main", color: "#fff", fontSize: 11, fontWeight: 700 }}>
                    Not saved yet
                  </Box>
                )}
                {coverPreparing && (
                  <Box sx={{ position: "absolute", inset: 0, bgcolor: "rgba(0,0,0,0.5)", display: "grid", placeItems: "center", px: 3 }}>
                    <LinearProgress sx={{ width: "100%", height: 5, borderRadius: 3 }} />
                  </Box>
                )}
              </Box>

              <Box sx={{ minWidth: 0 }}>
                <Typography variant="body2" sx={{ fontWeight: 600, color: coverRemovalPending ? "error.main" : "text.secondary", mb: 1.25 }}>
                  {coverRemovalPending
                    ? "This photo will be deleted when you save."
                    : coverFile
                    ? "New photo. It's uploaded when you save."
                    : shownCover && coverFailed
                    ? "This photo couldn't be shown. Upload another."
                    : shownCover
                    ? "JPG, PNG or WebP. Large photos are resized for you."
                    : "No cover photo yet. JPG, PNG or WebP."}
                </Typography>
                <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap" }}>
                  <Button component="label" variant="outlined" size="small" startIcon={<AddPhotoAlternateOutlinedIcon />} disabled={coverPreparing || saving} sx={{ fontWeight: 700, borderRadius: R.sm, minHeight: 38 }}>
                    {shownCover ? "Change" : "Upload photo"}
                    <input hidden type="file" accept="image/jpeg,image/png,image/webp" onChange={handleCoverPick} />
                  </Button>
                  {coverRemovalPending ? (
                    <Button size="small" startIcon={<UndoRoundedIcon />} onClick={handleUndoRemoveCover} disabled={saving} sx={{ fontWeight: 700, borderRadius: R.sm, minHeight: 38 }}>
                      Keep it
                    </Button>
                  ) : shownCover ? (
                    <Button size="small" color="error" startIcon={coverFile ? <UndoRoundedIcon /> : <DeleteOutlineIcon />} onClick={handleRemoveCover} disabled={coverPreparing || saving} sx={{ fontWeight: 700, borderRadius: R.sm, minHeight: 38 }}>
                      {coverFile ? "Cancel" : "Remove"}
                    </Button>
                  ) : null}
                </Box>
              </Box>
            </Box>
          </Section>

          <Section title="Basic information" description="The name and type tenants see, and who to call in an emergency.">
            <Box sx={fieldStack}>
              <TextField fullWidth label="Property name" name="propertyName" value={formData.propertyName} onChange={handleChange} sx={fieldSx} />
              <Box sx={fieldPair}>
                <TextField fullWidth label="Property type" name="propertyType" value={formData.propertyType} onChange={handleChange} sx={fieldSx} />
                <TextField fullWidth label="Emergency phone" name="emergencyPhone" type="tel" value={formData.emergencyPhone} onChange={handleChange} sx={fieldSx} />
              </Box>
              <Box sx={fieldPair}>
                <TextField select fullWidth label="Status" name="status" value={formData.status} onChange={handleChange} sx={fieldSx}>
                  <MenuItem value="Active">Active</MenuItem>
                  <MenuItem value="Inactive">Inactive</MenuItem>
                </TextField>
                <TextField
                  fullWidth
                  type="number"
                  label="Number of floors"
                  name="totalFloors"
                  value={formData.totalFloors}
                  onChange={(e) => setFormData(prev => ({ ...prev, totalFloors: Math.max(1, Number(e.target.value)) }))}
                  sx={fieldSx}
                  slotProps={{ htmlInput: { inputMode: "numeric", min: 1 } }}
                />
              </Box>
            </Box>
          </Section>

          <Section title="Location" description="Pick the region first; each list narrows down the next.">
            <AddressFields key={reloadKey} value={formData.address} onChange={handleAddressPatch} fieldSx={fieldSx} />
          </Section>
        </Paper>
      )}

      {/* TAB 1: ROOMS GROUPED BY FLOOR */}
      {tabValue === 1 && (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
          <Box sx={{ ...row, justifyContent: "space-between", gap: 2, mb: 0.5 }}>
            <Typography variant="body2" color="text.secondary" sx={{ minWidth: 0 }}>
              Set bed rates, capacity and floors for each room.
            </Typography>
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setOpenAddRoomModal(true)} sx={{ borderRadius: R.sm, fontWeight: 700, flexShrink: 0, boxShadow: "none" }}>
              Add room
            </Button>
          </Box>

          {floorNumbers.length === 0 ? (
            <Paper elevation={0} sx={{ ...cardSx, py: 6, px: 2, textAlign: "center", borderStyle: "dashed" }}>
              <MeetingRoomOutlinedIcon sx={{ color: "text.disabled", fontSize: 34 }} />
              <Typography sx={{ fontFamily: HEAD, fontWeight: 800, mt: 1 }}>No rooms added yet</Typography>
              <Button startIcon={<AddIcon />} sx={{ mt: 1, fontWeight: 700 }} onClick={() => setOpenAddRoomModal(true)}>
                Add your first room
              </Button>
            </Paper>
          ) : (
            floorNumbers.map((floorNum, index) => {
              const floorRooms = roomsByFloor[floorNum];
              const floorBeds = floorRooms.reduce((sum, r) => sum + (Number(r.capacity) || 0), 0);
              const floorOccupied = floorRooms.reduce((sum, r) => sum + (Number(r.occupiedBeds) || 0), 0);

              return (
                <Accordion
                  key={floorNum}
                  defaultExpanded={index === 0}
                  disableGutters
                  elevation={0}
                  sx={{ ...cardSx, borderRadius: `${R.lg} !important`, overflow: "hidden", "&:before": { display: "none" } }}
                >
                  <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ px: { xs: 2, sm: 2.5 }, "& .MuiAccordionSummary-content": { alignItems: "center", my: 1.5, minWidth: 0 } }}>
                    <Box sx={{ ...row, gap: 1.25, flexWrap: "wrap", minWidth: 0 }}>
                      <LayersOutlinedIcon fontSize="small" sx={{ color: "text.secondary" }} />
                      <Typography sx={{ fontFamily: HEAD, fontWeight: 800 }}>Floor {floorNum}</Typography>
                      <Typography variant="body2" color="text.secondary">
                        {floorRooms.length} {floorRooms.length === 1 ? "room" : "rooms"} · {floorOccupied}/{floorBeds} beds occupied
                      </Typography>
                    </Box>
                  </AccordionSummary>

                  <AccordionDetails sx={{ p: 0, borderTop: "1px solid", borderColor: "divider" }}>
                    {isMobile ? (
                      <Box sx={{ display: "flex", flexDirection: "column" }}>
                        {floorRooms.map((room, rIdx) => {
                          const idx = room.originalIndex;
                          const occupied = Number(room.occupiedBeds || 0);
                          const capacity = Number(room.capacity || 0);

                          return (
                            <Box key={room.id || idx} sx={{ p: 2, borderTop: rIdx ? "1px solid" : "none", borderColor: "divider" }}>
                              <Box sx={{ ...row, alignItems: "flex-start", gap: 1 }}>
                                <TextField
                                  size="small"
                                  fullWidth
                                  label="Room name"
                                  value={room.roomName}
                                  onChange={(e) => handleRoomChange(idx, "roomName", e.target.value)}
                                  disabled={occupied > 0}
                                  helperText={occupied > 0 ? "Can't rename while tenants live here." : undefined}
                                  sx={fieldSx}
                                />
                                <IconButton aria-label={`Delete ${roomName(room)}`} color="error" onClick={() => setRoomToDelete(idx)}>
                                  <DeleteOutlineIcon fontSize="small" />
                                </IconButton>
                              </Box>
                              <Chip label={`${occupied} / ${capacity} beds occupied`} size="small" sx={{ mt: 1.25, ...occupancyChipSx(occupied, capacity) }} />
                              <Box sx={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 1.5, mt: 1.5 }}>
                                <TextField type="number" size="small" label="Floor" value={room.floor} onChange={(e) => handleRoomChange(idx, "floor", e.target.value)} sx={fieldSx} slotProps={{ htmlInput: { inputMode: "numeric", min: 0 } }} />
                                <TextField type="number" size="small" label="Beds" value={room.capacity} onChange={(e) => handleRoomChange(idx, "capacity", e.target.value)} sx={fieldSx} slotProps={{ htmlInput: { inputMode: "numeric", min: 0 } }} />
                              </Box>
                              <Box sx={{ mt: 1.5 }}>
                                <RateInput value={room.monthlyRatePerBed} onChange={(val) => handleRoomChange(idx, "monthlyRatePerBed", val)} />
                              </Box>
                            </Box>
                          );
                        })}
                      </Box>
                    ) : (
                      <TableContainer>
                        <Table size="small">
                          <TableHead>
                            <TableRow sx={{ "& th": { fontWeight: 700, color: "text.secondary", whiteSpace: "nowrap", py: 1.25, borderColor: "divider" } }}>
                              <TableCell sx={{ pl: 2.5 }}>Room</TableCell>
                              <TableCell>Floor</TableCell>
                              <TableCell>Beds</TableCell>
                              <TableCell>Occupancy</TableCell>
                              <TableCell>Rate / bed</TableCell>
                              <TableCell align="right" />
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {floorRooms.map((room) => {
                              const idx = room.originalIndex;
                              const occupied = Number(room.occupiedBeds || 0);
                              const capacity = Number(room.capacity || 0);

                              return (
                                <TableRow key={room.id || idx} hover sx={{ "& td": { py: 1.25, borderColor: "divider" }, "&:last-child td": { border: 0 } }}>
                                  <TableCell sx={{ minWidth: 150, pl: 2.5 }}>
                                    <TextField
                                      size="small"
                                      fullWidth
                                      value={room.roomName}
                                      onChange={(e) => handleRoomChange(idx, "roomName", e.target.value)}
                                      disabled={occupied > 0}
                                      title={occupied > 0 ? "Can't rename while tenants live here." : undefined}
                                      sx={fieldSx}
                                      slotProps={{ htmlInput: { "aria-label": "Room name" } }}
                                    />
                                  </TableCell>
                                  <TableCell sx={{ width: 96 }}>
                                    <TextField type="number" size="small" value={room.floor} onChange={(e) => handleRoomChange(idx, "floor", e.target.value)} sx={fieldSx} slotProps={{ htmlInput: { "aria-label": "Floor" } }} />
                                  </TableCell>
                                  <TableCell sx={{ width: 96 }}>
                                    <TextField type="number" size="small" value={room.capacity} onChange={(e) => handleRoomChange(idx, "capacity", e.target.value)} sx={fieldSx} slotProps={{ htmlInput: { "aria-label": "Beds" } }} />
                                  </TableCell>
                                  <TableCell sx={{ width: 150 }}>
                                    <Chip label={`${occupied} / ${capacity} occupied`} size="small" sx={occupancyChipSx(occupied, capacity)} />
                                  </TableCell>
                                  <TableCell sx={{ minWidth: 190 }}>
                                    <RateInput value={room.monthlyRatePerBed} onChange={(val) => handleRoomChange(idx, "monthlyRatePerBed", val)} />
                                  </TableCell>
                                  <TableCell align="right" sx={{ pr: 2 }}>
                                    <IconButton aria-label={`Delete ${roomName(room)}`} color="error" size="small" onClick={() => setRoomToDelete(idx)}>
                                      <DeleteOutlineIcon fontSize="small" />
                                    </IconButton>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    )}
                  </AccordionDetails>
                </Accordion>
              );
            })
          )}
        </Box>
      )}

      {/* TAB 2: CURFEW, RULES & DOCUMENTS */}
      {tabValue === 2 && (
        <Paper elevation={0} sx={{ ...cardSx, px: { xs: 2, sm: 3.5 } }}>
          <Section
            first
            title="Curfew"
            description="The time tenants are expected to be in. Caretakers run curfew checks at this time."
            action={<Switch checked={formData.curfew.enabled} onChange={handleCurfewToggle} color="primary" slotProps={{ input: { "aria-label": "Curfew on or off" } }} sx={{ display: { md: "none" } }} />}
          >
            <Box sx={{ ...row, justifyContent: "space-between", gap: 2, display: { xs: "none", md: "flex" }, mb: formData.curfew.enabled ? 2 : 0 }}>
              <Typography sx={{ fontWeight: 700 }}>{formData.curfew.enabled ? "Curfew is on" : "Curfew is off"}</Typography>
              <Switch checked={formData.curfew.enabled} onChange={handleCurfewToggle} color="primary" slotProps={{ input: { "aria-label": "Curfew on or off" } }} />
            </Box>
            {formData.curfew.enabled ? (
              <Box sx={{ display: "flex", flexDirection: { xs: "column", sm: "row" }, gap: 1.5, alignItems: { sm: "center" } }}>
                <TextField
                  type="time"
                  label="Starts at"
                  value={formatTo24Hour(formData.curfew.startTime)}
                  onChange={handleCurfewTimeChange}
                  sx={{ ...fieldSx, width: { xs: "100%", sm: 180 } }}
                  slotProps={{ inputLabel: { shrink: true }, htmlInput: { step: 1800 } }}
                />
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75 }}>
                  {["9:00 PM", "10:00 PM", "11:00 PM", "12:00 AM"].map((timeStr) => {
                    const on = formData.curfew.startTime === timeStr;
                    return (
                      <Chip
                        key={timeStr}
                        label={timeStr}
                        clickable
                        variant={on ? "filled" : "outlined"}
                        color={on ? "primary" : "default"}
                        onClick={() => setFormData(prev => ({ ...prev, curfew: { ...prev.curfew, startTime: timeStr } }))}
                        sx={{ fontWeight: 700, borderRadius: "8px" }}
                      />
                    );
                  })}
                </Box>
              </Box>
            ) : (
              <Typography variant="body2" color="text.secondary" sx={{ display: { md: "none" } }}>
                Curfew is off.
              </Typography>
            )}
          </Section>

          {/* House rules: typed, uploaded as a document, or both — one section */}
          <Section
            title="House rules"
            description={`Type them here, upload a signed rules document, or both. Tenants see them on their dashboard.`}
          >
            <Typography variant="body2" sx={{ fontWeight: 700, mb: 1 }}>
              Written rules
            </Typography>
            <TextField
              fullWidth
              multiline
              minRows={4}
              maxRows={12}
              name="rulesText"
              value={formData.rulesText}
              onChange={handleChange}
              placeholder={"One rule per line, e.g.\nVisitors allowed until 8 PM\nQuiet hours start at 10 PM"}
              sx={fieldSx}
              slotProps={{ htmlInput: { "aria-label": "Written house rules" } }}
            />

            <Box sx={{ ...row, justifyContent: "space-between", gap: 1, mt: 3, mb: 1 }}>
              <Typography variant="body2" sx={{ fontWeight: 700 }}>
                Rule documents
              </Typography>
              <Typography variant="caption" color="text.secondary">
                PDF or Word, up to {MAX_DOC_MB} MB each
              </Typography>
            </Box>
            {/* Drop zone / button */}
            <Box
              component="label"
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDropFiles}
              sx={{
                ...row,
                gap: 1.5,
                cursor: "pointer",
                px: 2,
                py: 1.75,
                border: "1.5px dashed",
                borderColor: dragOver ? "primary.main" : "divider",
                bgcolor: dragOver ? "rgba(255, 69, 0, 0.05)" : "transparent",
                borderRadius: R.md,
                transition: "border-color .15s, background-color .15s",
                "&:hover": { borderColor: "primary.main" },
                "&:focus-within": { borderColor: "primary.main" },
              }}
            >
              <CloudUploadOutlinedIcon sx={{ color: "primary.main" }} />
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                  <Box component="span" sx={{ display: { xs: "inline", md: "none" } }}>Tap to upload</Box>
                  <Box component="span" sx={{ display: { xs: "none", md: "inline" } }}>Click or drop files here</Box>
                </Typography>
                <Typography variant="caption" color="text.secondary">PDF, DOC or DOCX</Typography>
              </Box>
              <input
                type="file"
                hidden
                multiple
                accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                onChange={handleFileInput}
              />
            </Box>

            {/* Uploads in progress / failed */}
            {uploads.length > 0 && (
              <Box sx={{ display: "flex", flexDirection: "column", gap: 1, mt: 1.5 }}>
                {uploads.map((u) => (
                  <Box key={u.id} sx={{ p: 1.25, border: "1px solid", borderColor: u.error ? "error.main" : "divider", borderRadius: R.md }}>
                    <Box sx={{ ...row, gap: 1, minWidth: 0 }}>
                      {u.error && <ErrorOutlineIcon color="error" fontSize="small" />}
                      <Typography variant="body2" noWrap sx={{ flex: 1, minWidth: 0, fontWeight: 600 }}>{u.name}</Typography>
                      {u.error ? (
                        <IconButton size="small" aria-label={`Dismiss ${u.name}`} onClick={() => dismissUpload(u.id)}>
                          <CloseIcon fontSize="small" />
                        </IconButton>
                      ) : (
                        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>Uploading...</Typography>
                      )}
                    </Box>
                    {u.error ? (
                      <Typography variant="caption" color="error">{u.error}. Check your connection and try again.</Typography>
                    ) : (
                      <LinearProgress sx={{ mt: 1, height: 5, borderRadius: 3 }} />
                    )}
                  </Box>
                ))}
              </Box>
            )}

            {/* Saved + newly added files */}
            {formData.ruleFiles.length > 0 && (
              <Box sx={{ mt: 1.5, border: "1px solid", borderColor: "divider", borderRadius: R.md, overflow: "hidden" }}>
                {formData.ruleFiles.map((file, idx) => {
                  const isPdf = /\.pdf$/i.test(file.name || "");
                  const FileIcon = isPdf ? PictureAsPdfOutlinedIcon : DescriptionOutlinedIcon;
                  const meta = [isPdf ? "PDF" : "Word", formatFileSize(file.size), formatDate(file.uploadedAt)].filter(Boolean).join(" · ");
                  const isNew = file.url && !savedDocUrls.includes(file.url);
                  return (
                    <Box key={file.url || idx} sx={{ ...row, gap: 1, py: 1, px: 1.25, borderTop: idx ? "1px solid" : "none", borderColor: "divider" }}>
                      <Box
                        component="a"
                        href={file.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        sx={{ ...row, gap: 1.25, minWidth: 0, flex: 1, color: "text.primary", textDecoration: "none", "&:hover .kk-file-name": { color: "primary.main" } }}
                      >
                        <FileIcon fontSize="small" sx={{ color: isPdf ? "error.main" : "info.main", flexShrink: 0 }} />
                        <Box sx={{ minWidth: 0 }}>
                          <Typography className="kk-file-name" variant="body2" noWrap sx={{ fontWeight: 700, transition: "color .15s" }}>{file.name}</Typography>
                          <Typography variant="caption" color="text.secondary" noWrap component="div">
                            {meta}
                            {isNew && <Box component="span" sx={{ color: "warning.main", fontWeight: 700 }}>{meta ? " · " : ""}Not saved yet</Box>}
                          </Typography>
                        </Box>
                      </Box>
                      <IconButton size="small" aria-label={`Remove ${file.name}`} color="error" onClick={() => handleDeleteFile(idx)}>
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  );
                })}
              </Box>
            )}
          </Section>
        </Paper>
      )}

      {/* TAB 3: AMENITIES — one list of tap-to-toggle chips */}
      {tabValue === 3 && (
        <Paper elevation={0} sx={{ ...cardSx, px: { xs: 2, sm: 3.5 } }}>
          <Section first title="Amenities & facilities" description={`Tap to turn on or off. ${formData.amenities.length} selected.`}>
            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
              {[...DEFAULT_AMENITIES, ...formData.amenities.filter((a) => !DEFAULT_AMENITIES.includes(a))].map((amenity) => {
                const selected = formData.amenities.includes(amenity);
                return (
                  <Chip
                    key={amenity}
                    label={amenity}
                    clickable
                    icon={selected ? <CheckIcon /> : undefined}
                    color={selected ? "primary" : "default"}
                    variant={selected ? "filled" : "outlined"}
                    onClick={() => handleAmenityToggle(amenity)}
                    sx={{ fontWeight: 700, height: 36, borderRadius: R.sm }}
                  />
                );
              })}
            </Box>
          </Section>

          <Section title="Add your own" description="Anything not in the list above.">
            <Box sx={{ display: "flex", gap: 1 }}>
              <TextField
                fullWidth
                size="small"
                placeholder="e.g., Solar power, Swimming pool"
                value={customAmenityInput}
                onChange={(e) => setCustomAmenityInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleAddCustomAmenity();
                  }
                }}
                sx={fieldSx}
                slotProps={{ htmlInput: { "aria-label": "New amenity" } }}
              />
              <Button variant="outlined" startIcon={<AddIcon />} onClick={handleAddCustomAmenity} sx={{ whiteSpace: "nowrap", fontWeight: 700, borderRadius: R.sm }}>
                Add
              </Button>
            </Box>
          </Section>
        </Paper>
      )}

      {/* Dialog: Add New Room */}
      <Dialog open={openAddRoomModal} onClose={() => setOpenAddRoomModal(false)} maxWidth="xs" fullWidth slotProps={{ paper: { sx: { borderRadius: R.lg } } }}>
        <DialogTitle sx={{ fontFamily: HEAD, fontWeight: 800 }}>Add new room</DialogTitle>
        <DialogContent dividers>
          <Box sx={{ ...fieldStack, pt: 1 }}>
            <TextField
              fullWidth
              autoFocus
              label="Room name / number"
              placeholder="e.g. Room 101"
              value={newRoomData.roomName}
              onChange={(e) => setNewRoomData(prev => ({ ...prev, roomName: e.target.value }))}
              sx={fieldSx}
            />
            <Box sx={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 2 }}>
              <TextField
                fullWidth
                type="number"
                label="Floor"
                value={newRoomData.floor}
                onChange={(e) => setNewRoomData(prev => ({ ...prev, floor: Math.max(1, Number(e.target.value)) }))}
                sx={fieldSx}
                slotProps={{ htmlInput: { inputMode: "numeric", min: 1 } }}
              />
              <TextField
                fullWidth
                type="number"
                label="Beds"
                value={newRoomData.capacity}
                onChange={(e) => setNewRoomData(prev => ({ ...prev, capacity: Math.max(1, Number(e.target.value)) }))}
                sx={fieldSx}
                slotProps={{ htmlInput: { inputMode: "numeric", min: 1 } }}
              />
            </Box>
            <TextField
              fullWidth
              type="number"
              label="Monthly rate per bed"
              value={newRoomData.monthlyRatePerBed}
              onChange={(e) => setNewRoomData(prev => ({ ...prev, monthlyRatePerBed: Math.max(0, Number(e.target.value)) }))}
              sx={fieldSx}
              slotProps={{
                htmlInput: { inputMode: "numeric", min: 0 },
                input: { startAdornment: <InputAdornment position="start">₱</InputAdornment> },
              }}
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setOpenAddRoomModal(false)} sx={{ fontWeight: 700 }}>Cancel</Button>
          <Button variant="contained" onClick={handleCreateRoom} sx={{ fontWeight: 700, borderRadius: R.sm, boxShadow: "none" }}>Add room</Button>
        </DialogActions>
      </Dialog>

      {/* Dialog: confirm room delete */}
      <Dialog open={roomToDelete !== null} onClose={() => setRoomToDelete(null)} maxWidth="xs" fullWidth slotProps={{ paper: { sx: { borderRadius: R.lg } } }}>
        <DialogTitle sx={{ fontFamily: HEAD, fontWeight: 800 }}>Delete {roomToDelete !== null ? `"${roomName(formData.rooms[roomToDelete])}"` : "room"}?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            {roomToDelete !== null && Number(formData.rooms[roomToDelete]?.occupiedBeds) > 0
              ? "This room has tenants assigned, so it can't be deleted. Move or remove the tenants first."
              : "The room is removed from this form. You can still undo it by reloading the page before you save."}
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setRoomToDelete(null)} sx={{ fontWeight: 700 }}>Keep room</Button>
          <Button
            color="error"
            variant="contained"
            disabled={roomToDelete !== null && Number(formData.rooms[roomToDelete]?.occupiedBeds) > 0}
            onClick={() => {
              handleDeleteRoom(roomToDelete);
              setRoomToDelete(null);
            }}
            sx={{ fontWeight: 700, borderRadius: R.sm, boxShadow: "none" }}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog: leave with unsaved changes */}
      <Dialog open={leaveOpen} onClose={() => setLeaveOpen(false)} maxWidth="xs" fullWidth slotProps={{ paper: { sx: { borderRadius: R.lg, m: 2, width: "calc(100% - 32px)" } } }}>
        <DialogTitle sx={{ fontFamily: HEAD, fontWeight: 800 }}>Leave without saving?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            {isUploading ? "A file is still uploading. " : ""}Your changes on this page haven't been saved and will be lost.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1, "& .MuiButton-root": { minHeight: 44 } }}>
          <Button onClick={() => setLeaveOpen(false)} sx={{ fontWeight: 700 }}>Stay</Button>
          <Button color="error" variant="contained" onClick={() => navigate(`/owner/properties/${id}`)} sx={{ fontWeight: 700, borderRadius: R.sm, boxShadow: "none" }}>
            Leave
          </Button>
        </DialogActions>
      </Dialog>

      {/* Phone save bar: appears only when there is something to save, and sits
          above the bottom navigation instead of behind it. */}
      {isDirty && (
        <Box
          sx={{
            display: { xs: "flex", sm: "none" },
            alignItems: "center",
            gap: 1.5,
            position: "sticky",
            bottom: `calc(${BOTTOM_NAV_H}px + env(safe-area-inset-bottom, 0px) + 8px)`,
            mt: 3,
            p: 1.25,
            pl: 2,
            bgcolor: INK,
            color: "#fff",
            borderRadius: R.md,
            boxShadow: (t) => `0 12px 28px ${alpha(t.palette.common.black, 0.25)}`,
            zIndex: 10,
          }}
        >
          <Box sx={{ flex: 1, ...row, gap: 1 }}>
            <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: "warning.main", flexShrink: 0 }} />
            <Typography variant="body2" sx={{ fontWeight: 700 }}>Unsaved changes</Typography>
          </Box>
          <Button
            variant="contained"
            startIcon={saving ? <CircularProgress size={18} color="inherit" /> : <SaveIcon />}
            onClick={handleSave}
            disabled={saving || isUploading}
            sx={{ fontWeight: 700, borderRadius: R.sm, flexShrink: 0, boxShadow: "none", "&.Mui-disabled": { bgcolor: "rgba(255,255,255,.15)", color: "rgba(255,255,255,.6)" } }}
          >
            {isUploading ? "Uploading..." : saveLabel}
          </Button>
        </Box>
      )}

      {/* Toast — lifted above the phone bottom bar */}
      <Snackbar
        open={toast.open}
        autoHideDuration={4000}
        onClose={() => setToast(prev => ({ ...prev, open: false }))}
        sx={{ bottom: { xs: `calc(${BOTTOM_NAV_H + 80}px + env(safe-area-inset-bottom, 0px)) !important`, sm: "24px !important" } }}
      >
        <Alert severity={toast.severity} sx={{ width: "100%", borderRadius: R.sm }}>
          {toast.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}
