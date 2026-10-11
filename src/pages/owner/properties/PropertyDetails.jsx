import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Box, Paper, Typography, Button, Tabs, Tab, TextField,
  CircularProgress, IconButton, Snackbar, Alert,
  FormControlLabel, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Chip, Switch, Divider,
  Dialog, DialogTitle, DialogContent, DialogActions, InputAdornment,
  Accordion, AccordionSummary, AccordionDetails, useMediaQuery, useTheme,
  Menu, MenuItem, LinearProgress,
} from "@mui/material";
import { alpha } from "@mui/material/styles";

// Icons
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import SaveIcon from "@mui/icons-material/Save";
import HomeWorkOutlinedIcon from "@mui/icons-material/HomeWorkOutlined";
import WifiOutlinedIcon from "@mui/icons-material/WifiOutlined";
import PolicyOutlinedIcon from "@mui/icons-material/PolicyOutlined";
import MeetingRoomOutlinedIcon from "@mui/icons-material/MeetingRoomOutlined";
import LocationOnOutlinedIcon from "@mui/icons-material/LocationOnOutlined";
import ScheduleIcon from "@mui/icons-material/Schedule";
import LayersOutlinedIcon from "@mui/icons-material/LayersOutlined";
import AddIcon from "@mui/icons-material/Add";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutlined";
import CloudUploadOutlinedIcon from "@mui/icons-material/CloudUploadOutlined";
import InsertDriveFileOutlinedIcon from "@mui/icons-material/InsertDriveFileOutlined";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import CheckIcon from "@mui/icons-material/Check";
import PlaceOutlinedIcon from "@mui/icons-material/PlaceOutlined";
import PictureAsPdfOutlinedIcon from "@mui/icons-material/PictureAsPdfOutlined";
import DescriptionOutlinedIcon from "@mui/icons-material/DescriptionOutlined";
import CloseIcon from "@mui/icons-material/Close";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutlined";
import AddPhotoAlternateOutlinedIcon from "@mui/icons-material/AddPhotoAlternateOutlined";
import RefreshOutlinedIcon from "@mui/icons-material/RefreshOutlined";

// Firebase
import { auth, db } from "../../../config/firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { uploadToCloudinary, uploadFileToCloudinary } from "../../../utils/cloudinary";
import { getPropertyCoverPhotoUrl } from "../../../utils/getPropertyCoverPhotoUrl";

// Must match the owner layout: top bar height, and bottom nav height on phones
const BAR_H = { xs: 56, md: 80 };
const BOTTOM_NAV_H = 64;

const row = { display: "flex", alignItems: "center" };

const cardSx = {
  bgcolor: "background.default",
  border: "1px solid",
  borderColor: "divider",
  borderRadius: 3,
  p: { xs: 2, sm: 3 },
  minWidth: 0,
};

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
  let [_, hours, minutes, period] = match;
  let h = parseInt(hours, 10);
  if (period.toUpperCase() === "PM" && h < 12) h += 12;
  if (period.toUpperCase() === "AM" && h === 12) h = 0;
  return `${String(h).padStart(2, "0")}:${minutes}`;
};

// Rate field with quick presets tucked behind a small dropdown instead of
// a permanently-visible row of chips — same shortcut, far less visual
// weight when it's repeated across every room in every floor.
function RateInput({ value, onChange }) {
  const [anchorEl, setAnchorEl] = useState(null);

  return (
    <>
      <TextField
        fullWidth
        size="small"
        type="number"
        inputProps={{ inputMode: "numeric", min: 0 }}
        label="Monthly Rate / Bed"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        InputProps={{
          startAdornment: <InputAdornment position="start">₱</InputAdornment>,
          endAdornment: (
            <InputAdornment position="end">
              <IconButton
                size="small"
                edge="end"
                onClick={(e) => setAnchorEl(e.currentTarget)}
                aria-label="Quick rate presets"
              >
                <ExpandMoreIcon fontSize="small" />
              </IconButton>
            </InputAdornment>
          ),
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


function CardTitle({ icon, title, subtitle }) {
  return (
    <Box sx={{ mb: 2.5 }}>
      <Box sx={{ ...row, gap: 1.25 }}>
        {icon}
        <Typography variant="h6" sx={{ fontFamily: '"Inter", sans-serif', fontWeight: 700, fontSize: "1.05rem" }}>
          {title}
        </Typography>
      </Box>
      {subtitle && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          {subtitle}
        </Typography>
      )}
    </Box>
  );
}

export default function PropertyDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("sm"));

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [saving, setSaving] = useState(false);
  const [coverUpload, setCoverUpload] = useState({ busy: false });
  const [coverFailed, setCoverFailed] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);

  // JSON snapshot of the last loaded/saved form, used to know if anything changed
  const initialSnapshot = useRef("");
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
  const savedUrls = useRef([]);

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
    address: {
      street: "",
      barangay: "",
      cityMunicipality: "",
      province: "",
      region: ""
    },
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
            address: {
              street: (typeof data.address === "string" ? data.address : data.address?.street) || data.street || data.streetAddress || "",
              barangay: data.address?.barangay || "",
              cityMunicipality: data.address?.cityMunicipality || data.cityMunicipality || data.city || "",
              province: data.address?.province || data.province || "",
              region: data.address?.region || data.region || ""
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
          initialSnapshot.current = JSON.stringify(loaded);
          savedUrls.current = loaded.ruleFiles.map((f) => f.url).filter(Boolean);
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

  // Handle generic inputs
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  // Handle address input
  const handleAddressChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      address: { ...prev.address, [name]: value }
    }));
  };

  // Handle Curfew Change (Converts 24h HTML time to 12h string)
  const handleCurfewTimeChange = (e) => {
    const time24 = e.target.value;
    const time12 = formatTo12Hour(time24);
    setFormData(prev => ({
      ...prev,
      curfew: { ...prev.curfew, startTime: time12 }
    }));
  };

  const handleCurfewToggle = (e) => {
    const checked = e.target.checked;
    setFormData(prev => ({
      ...prev,
      curfew: { ...prev.curfew, enabled: checked }
    }));
  };

  // Amenities logic
  const handleAmenityToggle = (amenity) => {
    setFormData(prev => {
      const exists = prev.amenities.includes(amenity);
      const updated = exists 
        ? prev.amenities.filter(a => a !== amenity)
        : [...prev.amenities, amenity];
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
    setFormData(prev => ({
      ...prev,
      amenities: [...prev.amenities, trimmed]
    }));
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
      
      const newTotalBeds = updatedRooms.reduce((sum, r) => sum + (Number(r.capacity) || 0), 0);

      return {
        ...prev,
        rooms: updatedRooms,
        totalBeds: newTotalBeds,
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
      const maxFloor = Math.max(prev.totalFloors, newRoom.floor);
      return {
        ...prev,
        rooms: updatedRooms,
        totalRooms: updatedRooms.length,
        totalFloors: maxFloor,
        totalBeds: updatedRooms.reduce((sum, r) => sum + (Number(r.capacity) || 0), 0)
      };
    });

    setOpenAddRoomModal(false);
    setNewRoomData({ roomName: "", floor: 1, capacity: 2, monthlyRatePerBed: 2500 });
  };

  // Cover photo: pick from the device (camera roll or camera on a phone)
  const handleCoverPick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || coverUpload.busy) return;
    if (!file.type.startsWith("image/") || /heic|heif/i.test(file.type)) {
      setToast({ open: true, message: "Please choose a JPG or PNG photo.", severity: "error" });
      return;
    }
    if (file.size > MAX_COVER_MB * 1024 * 1024) {
      setToast({ open: true, message: `That photo is over ${MAX_COVER_MB} MB.`, severity: "error" });
      return;
    }
    const user = auth.currentUser;
    if (!user) {
      setToast({ open: true, message: "You're signed out. Sign in again and retry.", severity: "error" });
      return;
    }

    setCoverUpload({ busy: true });
    try {
      const { blob, ext } = await shrinkImage(file);
      const upload = blob instanceof File ? blob : new File([blob], `cover_${Date.now()}.${ext}`, { type: blob.type || file.type });
      const url = await uploadToCloudinary(upload);
      if (!url) throw new Error("No link came back");
      setCoverFailed(false);
      setFormData((prev) => ({ ...prev, coverPhotoUrl: url }));
      setToast({ open: true, message: "Cover photo ready. Save to keep it.", severity: "success" });
    } catch (error) {
      console.error("Cover upload error:", error);
      setToast({ open: true, message: /size limit/i.test(error?.message || "") ? "That photo is still over 5 MB after resizing. Choose a smaller one." : "The photo couldn't be uploaded. Check your connection and try again.", severity: "error" });
    } finally {
      setCoverUpload({ busy: false });
    }
  };

  const handleRemoveCover = () => {
    setFormData((prev) => ({ ...prev, coverPhotoUrl: "" }));
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
        const fileObj = {
          name: file.name,
          url: downloadUrl,
          size: file.size,
          uploadedAt: new Date().toISOString(),
        };

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

  // Save to Firebase
  const handleSave = async () => {
    if (uploads.some((u) => !u.error) || coverUpload.busy) return; // wait for uploads in flight

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

    setSaving(true);
    try {
      const docRef = doc(db, "properties", id);

      // Occupancy changes whenever a tenant is registered or moves out, so take the latest counts instead of the ones loaded with the page
      const fresh = await getDoc(docRef);
      const live = fresh.exists() ? fresh.data() : {};
      const liveRooms = new Map((Array.isArray(live.rooms) ? live.rooms : []).map((r) => [r.id, r]));
      
      const updatePayload = {
        propertyName: formData.propertyName,
        propertyType: formData.propertyType,
        status: formData.status,
        coverPhotoUrl: formData.coverPhotoUrl || null,
        emergencyPhone: formData.emergencyPhone,
        configMode: formData.configMode,
        namingPattern: formData.namingPattern,
        totalFloors: Math.max(1, Number(formData.totalFloors) || 1, ...formData.rooms.map((r) => Number(r.floor) || 1)),
        totalRooms: Number(formData.rooms.length),
        totalBeds: formData.rooms.reduce((sum, r) => sum + (Number(r.capacity) || 0), 0),
        occupiedBeds: Number(live.occupiedBeds ?? formData.occupiedBeds) || 0,
        address: {
          street: formData.address.street,
          barangay: formData.address.barangay,
          cityMunicipality: formData.address.cityMunicipality,
          province: formData.address.province,
          region: formData.address.region
        },
        curfew: {
          enabled: formData.curfew.enabled,
          startTime: formData.curfew.startTime
        },
        amenities: formData.amenities,
        rules: formData.rulesText.split("\n").map(r => r.trim()).filter(Boolean),
        ruleFiles: formData.ruleFiles,
        rooms: formData.rooms.map(room => ({
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
      initialSnapshot.current = JSON.stringify(formData);
      savedUrls.current = formData.ruleFiles.map((f) => f.url).filter(Boolean);
      setToast({ open: true, message: "Changes saved.", severity: "success" });
    } catch (error) {
      console.error("Error updating property:", error);
      setToast({ open: true, message: "Failed to save property.", severity: "error" });
    } finally {
      setSaving(false);
    }
  };

  const isUploading = uploads.some((u) => !u.error) || coverUpload.busy;
  const isDirty = !loading && JSON.stringify(formData) !== initialSnapshot.current;

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
      <Box sx={{ display: "flex", justifyContent: "center", mt: 10 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (loadError) {
    return (
      <Box sx={{ maxWidth: 520, mx: "auto", mt: { xs: 4, md: 8 }, textAlign: "center", px: 2 }}>
        <ErrorOutlineIcon color="error" sx={{ fontSize: 40, mb: 1 }} />
        <Typography sx={{ fontWeight: 800, fontSize: "1.2rem", mb: 0.5 }}>Can't open this property</Typography>
        <Typography color="text.secondary" sx={{ mb: 3 }}>
          {loadError}
        </Typography>
        <Box sx={{ display: "flex", gap: 1.5, justifyContent: "center", flexWrap: "wrap" }}>
          <Button variant="outlined" startIcon={<ArrowBackIcon />} onClick={() => navigate("/owner/properties")} sx={{ fontWeight: 700, borderRadius: 2.5, minHeight: 46 }}>
            Back to properties
          </Button>
          <Button variant="contained" startIcon={<RefreshOutlinedIcon />} onClick={() => setReloadKey((k) => k + 1)} sx={{ fontWeight: 700, borderRadius: 2.5, minHeight: 46 }}>
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

  const fullAddressStr = [
    formData.address.street,
    formData.address.barangay,
    formData.address.cityMunicipality,
    formData.address.province,
    formData.address.region
  ].filter(Boolean).join(", ");

  const summary = [
    { label: "Rooms", value: formData.totalRooms },
    { label: "Beds", value: formData.totalBeds },
    { label: "Floors", value: formData.totalFloors },
    { label: "Occupied", value: formData.occupiedBeds, suffix: `/ ${formData.totalBeds}`, color: "success.main" },
  ];

  const saveLabel = saving ? "Saving..." : "Save changes";
  const roomName = (room) => room?.roomName || "this room";

  return (
    <Box sx={{ pb: { xs: 2, md: 6 }, maxWidth: 1200, mx: "auto", minWidth: 0 }}>
      {/* HEADER */}
      <Box sx={{ ...row, alignItems: "flex-start", gap: { xs: 1, sm: 2 }, mb: { xs: 2, md: 3 } }}>
        <IconButton aria-label="Back to properties" onClick={() => (isDirty || isUploading ? setLeaveOpen(true) : navigate("/owner/properties"))} sx={{ ml: -1, mt: { xs: 0, sm: 0.5 } }}>
          <ArrowBackIcon />
        </IconButton>

        {formData.coverPhotoUrl && !coverFailed ? (
          <Box
            component="img"
            src={formData.coverPhotoUrl}
            alt=""
            onError={() => setCoverFailed(true)}
            sx={{ width: { xs: 52, sm: 72 }, height: { xs: 52, sm: 72 }, borderRadius: 2.5, objectFit: "cover", flexShrink: 0 }}
          />
        ) : (
          <Box sx={{ width: { xs: 52, sm: 72 }, height: { xs: 52, sm: 72 }, borderRadius: 2.5, flexShrink: 0, ...row, justifyContent: "center", bgcolor: "rgba(255, 69, 0, 0.08)" }}>
            <HomeWorkOutlinedIcon sx={{ color: "primary.main" }} />
          </Box>
        )}

        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography sx={{ fontFamily: '"Inter", sans-serif', fontWeight: 800, fontSize: { xs: "1.25rem", sm: "1.7rem" }, lineHeight: 1.2 }} noWrap>
            {formData.propertyName || "Unnamed Property"}
          </Typography>
          <Box sx={{ ...row, gap: 1, mt: 0.5, flexWrap: "wrap" }}>
            <Chip
              label={formData.propertyType}
              size="small"
              sx={{ bgcolor: "rgba(255, 69, 0, 0.08)", color: "primary.main", fontWeight: 700, border: "none" }}
            />
            <Box sx={{ ...row, gap: 0.5, color: "text.secondary", minWidth: 0 }}>
              <PlaceOutlinedIcon sx={{ fontSize: 16, flexShrink: 0 }} />
              <Typography variant="body2" sx={{ overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                {fullAddressStr || "No address specified"}
              </Typography>
            </Box>
          </Box>
        </Box>

        {/* Desktop save: always visible, enabled once something changed */}
        <Box sx={{ display: { xs: "none", sm: "flex" }, alignItems: "center", gap: 1.5, flexShrink: 0 }}>
          {isDirty && (
            <Typography variant="body2" sx={{ color: "warning.main", fontWeight: 700 }}>
              Unsaved changes
            </Typography>
          )}
          <Button
            variant="contained"
            size="large"
            startIcon={saving ? <CircularProgress size={20} color="inherit" /> : <SaveIcon />}
            onClick={handleSave}
            disabled={saving || !isDirty || isUploading}
            sx={{ fontWeight: 700, px: 3, borderRadius: 2.5 }}
          >
            {saveLabel}
          </Button>
        </Box>
      </Box>

      {/* AT A GLANCE */}
      <Paper
        elevation={0}
        sx={{
          ...cardSx,
          p: 0,
          overflow: "hidden",
          display: "grid",
          gridTemplateColumns: { xs: "repeat(2, 1fr)", md: "repeat(4, 1fr)" },
          mb: { xs: 2, md: 3 },
        }}
      >
        {summary.map((item, i) => (
          <Box
            key={item.label}
            sx={{
              px: { xs: 1.75, md: 2.5 },
              py: { xs: 1.25, md: 1.75 },
              minWidth: 0,
              borderTop: { xs: i > 1 ? "1px solid" : "none", md: "none" },
              borderLeft: { xs: i % 2 === 1 ? "1px solid" : "none", md: i === 0 ? "none" : "1px solid" },
              borderColor: "divider",
            }}
          >
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }} noWrap component="div">
              {item.label}
            </Typography>
            <Typography noWrap sx={{ fontFamily: '"Inter", sans-serif', fontWeight: 800, fontSize: { xs: "1.2rem", md: "1.45rem" }, lineHeight: 1.25, color: item.color }}>
              {item.value}
              {item.suffix && (
                <Typography component="span" color="text.secondary" sx={{ fontWeight: 600, fontSize: "0.8em" }}>
                  {" "}{item.suffix}
                </Typography>
              )}
            </Typography>
          </Box>
        ))}
      </Paper>

      {/* TABS — sticky just under the top bar so they stay reachable in long tabs */}
      <Box
        sx={{
          position: "sticky",
          top: BAR_H,
          zIndex: 5,
          bgcolor: "background.default",
          border: "1px solid",
          borderColor: "divider",
          borderRadius: 3,
          mb: { xs: 2, md: 3 },
          overflow: "hidden",
        }}
      >
        <Tabs
          value={tabValue}
          onChange={(e, val) => setTabValue(val)}
          variant="scrollable"
          scrollButtons="auto"
          allowScrollButtonsMobile
          sx={{ minHeight: 48, "& .MuiTab-root": { minHeight: 48, textTransform: "none", fontWeight: 700 } }}
        >
          <Tab icon={<HomeWorkOutlinedIcon sx={{ fontSize: 18 }} />} iconPosition="start" label="General" />
          <Tab icon={<MeetingRoomOutlinedIcon sx={{ fontSize: 18 }} />} iconPosition="start" label={`Rooms & Rates (${formData.rooms.length})`} />
          <Tab icon={<PolicyOutlinedIcon sx={{ fontSize: 18 }} />} iconPosition="start" label="Rules & Curfew" />
          <Tab icon={<WifiOutlinedIcon sx={{ fontSize: 18 }} />} iconPosition="start" label="Amenities" />
        </Tabs>
      </Box>

      {/* TAB 0: GENERAL */}
      {tabValue === 0 && (
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "repeat(2, minmax(0, 1fr))" }, gap: 3, alignItems: "start" }}>
          <Paper elevation={0} sx={cardSx}>
            <CardTitle icon={<HomeWorkOutlinedIcon color="primary" />} title="Property information" />
            <Box sx={fieldStack}>
              <TextField fullWidth label="Property name" name="propertyName" value={formData.propertyName} onChange={handleChange} />
              <Box sx={fieldPair}>
                <TextField fullWidth label="Property type" name="propertyType" value={formData.propertyType} onChange={handleChange} />
                <TextField fullWidth label="Emergency phone" name="emergencyPhone" type="tel" value={formData.emergencyPhone} onChange={handleChange} />
              </Box>
              <TextField select fullWidth label="Property status" name="status" value={formData.status} onChange={handleChange}>
                <MenuItem value="Active">Active</MenuItem>
                <MenuItem value="Inactive">Inactive</MenuItem>
              </TextField>
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 700, mb: 1 }}>
                  Cover photo
                </Typography>
                <Box
                  sx={{
                    position: "relative",
                    width: "100%",
                    aspectRatio: "16 / 9",
                    borderRadius: 3,
                    overflow: "hidden",
                    border: "1px solid",
                    borderColor: "divider",
                    bgcolor: "rgba(255, 69, 0, 0.06)",
                    ...row,
                    justifyContent: "center",
                  }}
                >
                  {formData.coverPhotoUrl && !coverFailed ? (
                    <Box component="img" src={formData.coverPhotoUrl} alt="Property cover" onError={() => setCoverFailed(true)} sx={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : (
                    <Box sx={{ textAlign: "center", px: 2 }}>
                      <HomeWorkOutlinedIcon sx={{ color: "primary.main", fontSize: 36 }} />
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                        {formData.coverPhotoUrl ? "This photo couldn't be shown. Upload another." : "No cover photo yet"}
                      </Typography>
                    </Box>
                  )}
                  {coverUpload.busy && (
                    <Box sx={{ position: "absolute", inset: 0, bgcolor: "rgba(0,0,0,0.5)", color: "#fff", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 1.5, px: 4 }}>
                      <Typography sx={{ fontWeight: 800 }}>Uploading...</Typography>
                      <LinearProgress sx={{ width: "100%", maxWidth: 240, height: 6, borderRadius: 3 }} />
                    </Box>
                  )}
                </Box>
                <Box sx={{ display: "flex", gap: 1, mt: 1.25, flexWrap: "wrap" }}>
                  <Button component="label" variant="outlined" startIcon={<AddPhotoAlternateOutlinedIcon />} disabled={coverUpload.busy} sx={{ minHeight: 46, fontWeight: 700, borderRadius: 2.5, textTransform: "none", flex: { xs: "1 1 100%", sm: "0 0 auto" } }}>
                    {formData.coverPhotoUrl ? "Change photo" : "Upload a photo"}
                    <input hidden type="file" accept="image/jpeg,image/png,image/webp" onChange={handleCoverPick} />
                  </Button>
                  {formData.coverPhotoUrl && (
                    <Button color="error" startIcon={<DeleteOutlineIcon />} onClick={handleRemoveCover} disabled={coverUpload.busy} sx={{ minHeight: 46, fontWeight: 700, textTransform: "none" }}>
                      Remove
                    </Button>
                  )}
                </Box>
                <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 0.75 }}>
                  Choose a photo from your device. Tenants see it on their dashboard. JPG, PNG or WebP.
                </Typography>
              </Box>
              <TextField
                fullWidth
                type="number"
                inputProps={{ inputMode: "numeric", min: 1 }}
                label="Number of floors"
                name="totalFloors"
                value={formData.totalFloors}
                onChange={(e) => setFormData(prev => ({ ...prev, totalFloors: Math.max(1, Number(e.target.value)) }))}
              />
            </Box>
          </Paper>

          <Paper elevation={0} sx={cardSx}>
            <CardTitle icon={<LocationOnOutlinedIcon color="primary" />} title="Location" />
            <Box sx={fieldStack}>
              <TextField fullWidth label="Street / building no." name="street" value={formData.address.street} onChange={handleAddressChange} />
              <Box sx={fieldPair}>
                <TextField fullWidth label="Barangay" name="barangay" value={formData.address.barangay} onChange={handleAddressChange} />
                <TextField fullWidth label="City / municipality" name="cityMunicipality" value={formData.address.cityMunicipality} onChange={handleAddressChange} />
              </Box>
              <Box sx={fieldPair}>
                <TextField fullWidth label="Province" name="province" value={formData.address.province} onChange={handleAddressChange} />
                <TextField fullWidth label="Region" name="region" value={formData.address.region} onChange={handleAddressChange} />
              </Box>
            </Box>
          </Paper>
        </Box>
      )}

      {/* TAB 1: ROOMS GROUPED BY FLOOR */}
      {tabValue === 1 && (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <Box sx={{ ...row, justifyContent: "space-between", gap: 2 }}>
            <Typography variant="body2" color="text.secondary" sx={{ minWidth: 0 }}>
              Set bed rates, capacity and floors for each room.
            </Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setOpenAddRoomModal(true)}
              sx={{ borderRadius: 2.5, fontWeight: 700, flexShrink: 0 }}
            >
              Add room
            </Button>
          </Box>

          {floorNumbers.length === 0 ? (
            <Paper elevation={0} sx={{ ...cardSx, py: 6, textAlign: "center", borderStyle: "dashed" }}>
              <Typography color="text.secondary">No rooms added yet.</Typography>
              <Button startIcon={<AddIcon />} sx={{ mt: 1 }} onClick={() => setOpenAddRoomModal(true)}>
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
                  sx={{
                    bgcolor: "background.default",
                    border: "1px solid",
                    borderColor: "divider",
                    borderRadius: "12px !important",
                    overflow: "hidden",
                    "&:before": { display: "none" },
                  }}
                >
                  <AccordionSummary
                    expandIcon={<ExpandMoreIcon />}
                    sx={{ "& .MuiAccordionSummary-content": { alignItems: "center", my: 1.25, minWidth: 0 } }}
                  >
                    <Box sx={{ ...row, gap: 1.25, flexWrap: "wrap", minWidth: 0 }}>
                      <LayersOutlinedIcon color="primary" fontSize="small" />
                      <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                        Floor {floorNum}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {floorRooms.length} {floorRooms.length === 1 ? "room" : "rooms"} · {floorOccupied}/{floorBeds} beds occupied
                      </Typography>
                    </Box>
                  </AccordionSummary>

                  <AccordionDetails sx={{ p: 0, borderTop: "1px solid", borderColor: "divider" }}>
                    {isMobile ? (
                      <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5, p: 2 }}>
                        {floorRooms.map((room) => {
                          const idx = room.originalIndex;
                          const occupied = Number(room.occupiedBeds || 0);
                          const capacity = Number(room.capacity || 0);
                          const isFull = capacity > 0 && occupied >= capacity;

                          return (
                            <Box key={room.id || idx} sx={{ p: 1.75, border: "1px solid", borderColor: "divider", borderRadius: 2.5 }}>
                              <Box sx={{ ...row, alignItems: "flex-start", gap: 1 }}>
                                <TextField
                                  size="small"
                                  fullWidth
                                  label="Room name"
                                  value={room.roomName}
                                  onChange={(e) => handleRoomChange(idx, "roomName", e.target.value)}
                                  disabled={occupied > 0}
                                  helperText={occupied > 0 ? "Can't rename while tenants live here." : undefined}
                                />
                                <IconButton aria-label={`Delete ${roomName(room)}`} color="error" onClick={() => setRoomToDelete(idx)}>
                                  <DeleteOutlineIcon fontSize="small" />
                                </IconButton>
                              </Box>

                              <Chip
                                label={`${occupied} / ${capacity} beds occupied`}
                                size="small"
                                color={isFull ? "error" : occupied > 0 ? "warning" : "success"}
                                variant="outlined"
                                sx={{ mt: 1.5 }}
                              />

                              <Box sx={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 1.5, mt: 1.5 }}>
                                <TextField
                                  type="number"
                                  size="small"
                                  label="Floor"
                                  inputProps={{ inputMode: "numeric", min: 0 }}
                                  value={room.floor}
                                  onChange={(e) => handleRoomChange(idx, "floor", e.target.value)}
                                />
                                <TextField
                                  type="number"
                                  size="small"
                                  label="Beds"
                                  inputProps={{ inputMode: "numeric", min: 0 }}
                                  value={room.capacity}
                                  onChange={(e) => handleRoomChange(idx, "capacity", e.target.value)}
                                />
                              </Box>

                              <Box sx={{ mt: 1.5 }}>
                                <RateInput
                                  value={room.monthlyRatePerBed}
                                  onChange={(val) => handleRoomChange(idx, "monthlyRatePerBed", val)}
                                />
                              </Box>
                            </Box>
                          );
                        })}
                      </Box>
                    ) : (
                      <TableContainer>
                        <Table size="small">
                          <TableHead>
                            <TableRow sx={{ "& th": { fontWeight: 700, color: "text.secondary", whiteSpace: "nowrap" } }}>
                              <TableCell>Room</TableCell>
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
                              const isFull = capacity > 0 && occupied >= capacity;

                              return (
                                <TableRow key={room.id || idx} hover>
                                  <TableCell sx={{ minWidth: 150 }}>
                                    <TextField
                                      size="small"
                                      fullWidth
                                      value={room.roomName}
                                      onChange={(e) => handleRoomChange(idx, "roomName", e.target.value)}
                                      disabled={occupied > 0}
                                      title={occupied > 0 ? "Can't rename while tenants live here." : undefined}
                                    />
                                  </TableCell>
                                  <TableCell sx={{ width: 96 }}>
                                    <TextField
                                      type="number"
                                      size="small"
                                      value={room.floor}
                                      onChange={(e) => handleRoomChange(idx, "floor", e.target.value)}
                                    />
                                  </TableCell>
                                  <TableCell sx={{ width: 96 }}>
                                    <TextField
                                      type="number"
                                      size="small"
                                      value={room.capacity}
                                      onChange={(e) => handleRoomChange(idx, "capacity", e.target.value)}
                                    />
                                  </TableCell>
                                  <TableCell sx={{ width: 150 }}>
                                    <Chip
                                      label={`${occupied} / ${capacity} occupied`}
                                      size="small"
                                      color={isFull ? "error" : occupied > 0 ? "warning" : "success"}
                                      variant="outlined"
                                    />
                                  </TableCell>
                                  <TableCell sx={{ minWidth: 190 }}>
                                    <RateInput
                                      value={room.monthlyRatePerBed}
                                      onChange={(val) => handleRoomChange(idx, "monthlyRatePerBed", val)}
                                    />
                                  </TableCell>
                                  <TableCell align="right">
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

      {/* TAB 2: CURFEW, RULES & DOCUMENTS — three focused cards instead of one crowded one */}
      {tabValue === 2 && (
        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "minmax(0, 5fr) minmax(0, 7fr)" }, gap: { xs: 2, md: 3 }, alignItems: "start" }}>
          {/* Curfew */}
          <Paper elevation={0} sx={cardSx}>
            <CardTitle icon={<ScheduleIcon color="primary" />} title="Curfew" subtitle="The time tenants are expected to be in." />

            <FormControlLabel
              control={<Switch checked={formData.curfew.enabled} onChange={handleCurfewToggle} color="primary" />}
              label={<Typography sx={{ fontWeight: 700 }}>{formData.curfew.enabled ? "Curfew on" : "Curfew off"}</Typography>}
              sx={{ mb: formData.curfew.enabled ? 2 : 0 }}
            />

            {formData.curfew.enabled && (
              <Box>
                <TextField
                  fullWidth
                  type="time"
                  label="Curfew starts at"
                  value={formatTo24Hour(formData.curfew.startTime)}
                  onChange={handleCurfewTimeChange}
                  InputLabelProps={{ shrink: true }}
                  inputProps={{ step: 1800 }}
                />
                <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mt: 2 }}>
                  {["8:00 PM", "9:00 PM", "10:00 PM", "11:00 PM", "12:00 AM"].map((timeStr) => (
                    <Chip
                      key={timeStr}
                      label={timeStr}
                      clickable
                      color={formData.curfew.startTime === timeStr ? "primary" : "default"}
                      variant={formData.curfew.startTime === timeStr ? "filled" : "outlined"}
                      onClick={() => setFormData(prev => ({ ...prev, curfew: { ...prev.curfew, startTime: timeStr } }))}
                    />
                  ))}
                </Box>
              </Box>
            )}
          </Paper>

          <Box sx={{ display: "flex", flexDirection: "column", gap: { xs: 2, md: 3 }, minWidth: 0 }}>
            {/* House rules (typed) */}
            <Paper elevation={0} sx={cardSx}>
              <CardTitle
                icon={<PolicyOutlinedIcon color="primary" />}
                title="House rules"
                subtitle="Write one rule per line."
              />
              <TextField
                fullWidth
                multiline
                minRows={4}
                maxRows={12}
                label="Rules"
                name="rulesText"
                value={formData.rulesText}
                onChange={handleChange}
                placeholder={"Visitors allowed until 8 PM\nQuiet hours start at 10 PM"}
              />
            </Paper>

            {/* Documents (uploaded) */}
            <Paper elevation={0} sx={cardSx}>
              <CardTitle
                icon={<InsertDriveFileOutlinedIcon color="primary" />}
                title="Documents"
                subtitle={`Signed rules or contracts. PDF or Word, up to ${MAX_DOC_MB} MB each.`}
              />

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
                  flexDirection: "column",
                  justifyContent: "center",
                  gap: 0.5,
                  textAlign: "center",
                  cursor: "pointer",
                  px: 2,
                  py: { xs: 2.5, sm: 3 },
                  border: "2px dashed",
                  borderColor: dragOver ? "primary.main" : "divider",
                  bgcolor: dragOver ? "rgba(255, 69, 0, 0.06)" : "transparent",
                  borderRadius: 3,
                  transition: "border-color .15s, background-color .15s",
                  "&:hover": { borderColor: "primary.main", bgcolor: "rgba(255, 69, 0, 0.04)" },
                  "&:focus-within": { borderColor: "primary.main" },
                }}
              >
                <CloudUploadOutlinedIcon sx={{ color: "primary.main", fontSize: 30 }} />
                <Typography sx={{ fontWeight: 700 }}>
                  <Box component="span" sx={{ display: { xs: "inline", md: "none" } }}>Tap to upload</Box>
                  <Box component="span" sx={{ display: { xs: "none", md: "inline" } }}>Click or drop files to upload</Box>
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  PDF, DOC or DOCX · max {MAX_DOC_MB} MB
                </Typography>
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
                <Box sx={{ display: "flex", flexDirection: "column", gap: 1, mt: 2 }}>
                  {uploads.map((u) => (
                    <Box
                      key={u.id}
                      sx={{
                        p: 1.5,
                        border: "1px solid",
                        borderColor: u.error ? "error.main" : "divider",
                        borderRadius: 2.5,
                        bgcolor: u.error ? "rgba(211, 47, 47, 0.04)" : "transparent",
                      }}
                    >
                      <Box sx={{ ...row, gap: 1, minWidth: 0 }}>
                        {u.error && <ErrorOutlineIcon color="error" fontSize="small" />}
                        <Typography variant="body2" noWrap sx={{ flex: 1, minWidth: 0, fontWeight: 600 }}>
                          {u.name}
                        </Typography>
                        {u.error ? (
                          <IconButton size="small" aria-label={`Dismiss ${u.name}`} onClick={() => dismissUpload(u.id)}>
                            <CloseIcon fontSize="small" />
                          </IconButton>
                        ) : (
                          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>
                            Uploading...
                          </Typography>
                        )}
                      </Box>
                      {u.error ? (
                        <Typography variant="caption" color="error">{u.error}. Check your connection and try again.</Typography>
                      ) : (
                        <LinearProgress sx={{ mt: 1, height: 6, borderRadius: 3 }} />
                      )}
                    </Box>
                  ))}
                </Box>
              )}

              {/* Saved + newly added files */}
              {formData.ruleFiles.length > 0 && (
                <Box sx={{ display: "flex", flexDirection: "column", gap: 1, mt: 2 }}>
                  {formData.ruleFiles.map((file, idx) => {
                    const isPdf = /\.pdf$/i.test(file.name || "");
                    const FileIcon = isPdf ? PictureAsPdfOutlinedIcon : DescriptionOutlinedIcon;
                    const added = formatDate(file.uploadedAt);
                    const meta = [isPdf ? "PDF" : "Word", formatFileSize(file.size), added].filter(Boolean).join(" · ");
                    const isNew = file.url && !savedUrls.current.includes(file.url);
                    return (
                      <Box
                        key={file.url || idx}
                        sx={{ ...row, gap: 1, p: 1, pl: 1.25, border: "1px solid", borderColor: "divider", borderRadius: 2.5 }}
                      >
                        <Box
                          component="a"
                          href={file.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          sx={{ ...row, gap: 1.5, minWidth: 0, flex: 1, color: "text.primary", textDecoration: "none", "&:hover .kk-file-name": { color: "primary.main" } }}
                        >
                          <Box sx={{ width: 40, height: 40, borderRadius: 2, flexShrink: 0, ...row, justifyContent: "center", bgcolor: isPdf ? "rgba(211, 47, 47, 0.08)" : "rgba(25, 118, 210, 0.08)", color: isPdf ? "error.main" : "info.main" }}>
                            <FileIcon fontSize="small" />
                          </Box>
                          <Box sx={{ minWidth: 0 }}>
                            <Typography className="kk-file-name" variant="body2" noWrap sx={{ fontWeight: 700, transition: "color .15s" }}>
                              {file.name}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" noWrap component="div">
                              {meta}
                              {isNew && (
                                <Box component="span" sx={{ color: "warning.main", fontWeight: 700 }}>{meta ? " · " : ""}Not saved yet</Box>
                              )}
                            </Typography>
                          </Box>
                        </Box>
                        <IconButton aria-label={`Remove ${file.name}`} color="error" onClick={() => handleDeleteFile(idx)}>
                          <DeleteOutlineIcon fontSize="small" />
                        </IconButton>
                      </Box>
                    );
                  })}
                </Box>
              )}

              {formData.ruleFiles.length === 0 && uploads.length === 0 && (
                <Typography variant="body2" color="text.secondary" sx={{ mt: 2, textAlign: "center" }}>
                  No documents yet.
                </Typography>
              )}
            </Paper>
          </Box>
        </Box>
      )}

      {/* TAB 3: AMENITIES — one list of tap-to-toggle chips (no separate "active" list) */}
      {tabValue === 3 && (
        <Paper elevation={0} sx={cardSx}>
          <CardTitle
            icon={<WifiOutlinedIcon color="primary" />}
            title="Amenities & facilities"
            subtitle={`Tap to turn on or off. ${formData.amenities.length} selected.`}
          />

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
                  sx={{ fontWeight: 600, height: 36, borderRadius: 18 }}
                />
              );
            })}
          </Box>

          <Divider sx={{ my: 3 }} />

          <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1.25 }}>
            Add your own
          </Typography>
          <Box sx={{ display: "flex", gap: 1, maxWidth: 520 }}>
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
            />
            <Button variant="contained" onClick={handleAddCustomAmenity} sx={{ whiteSpace: "nowrap", fontWeight: 700, borderRadius: 2 }}>
              Add
            </Button>
          </Box>
        </Paper>
      )}

      {/* Dialog: Add New Room */}
      <Dialog open={openAddRoomModal} onClose={() => setOpenAddRoomModal(false)} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 800 }}>Add new room</DialogTitle>
        <DialogContent dividers>
          <Box sx={{ ...fieldStack, pt: 1 }}>
            <TextField
              fullWidth
              autoFocus
              label="Room name / number"
              placeholder="e.g. Room 101"
              value={newRoomData.roomName}
              onChange={(e) => setNewRoomData(prev => ({ ...prev, roomName: e.target.value }))}
            />
            <Box sx={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 2 }}>
              <TextField
                fullWidth
                type="number"
                inputProps={{ inputMode: "numeric", min: 1 }}
                label="Floor"
                value={newRoomData.floor}
                onChange={(e) => setNewRoomData(prev => ({ ...prev, floor: Math.max(1, Number(e.target.value)) }))}
              />
              <TextField
                fullWidth
                type="number"
                inputProps={{ inputMode: "numeric", min: 1 }}
                label="Beds"
                value={newRoomData.capacity}
                onChange={(e) => setNewRoomData(prev => ({ ...prev, capacity: Math.max(1, Number(e.target.value)) }))}
              />
            </Box>
            <TextField
              fullWidth
              type="number"
              inputProps={{ inputMode: "numeric", min: 0 }}
              label="Monthly rate per bed"
              value={newRoomData.monthlyRatePerBed}
              onChange={(e) => setNewRoomData(prev => ({ ...prev, monthlyRatePerBed: Math.max(0, Number(e.target.value)) }))}
              InputProps={{ startAdornment: <InputAdornment position="start">₱</InputAdornment> }}
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setOpenAddRoomModal(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleCreateRoom} sx={{ fontWeight: 700, borderRadius: 2 }}>Add room</Button>
        </DialogActions>
      </Dialog>

      {/* Dialog: confirm room delete */}
      <Dialog open={roomToDelete !== null} onClose={() => setRoomToDelete(null)} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 3 } }}>
        <DialogTitle sx={{ fontWeight: 800 }}>Delete {roomToDelete !== null ? `"${roomName(formData.rooms[roomToDelete])}"` : "room"}?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            {roomToDelete !== null && Number(formData.rooms[roomToDelete]?.occupiedBeds) > 0
              ? "This room has tenants assigned, so it can't be deleted. Move or remove the tenants first."
              : "The room is removed from this form. You can still undo it by reloading the page before you save."}
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setRoomToDelete(null)}>Keep room</Button>
          <Button
            color="error"
            variant="contained"
            disabled={roomToDelete !== null && Number(formData.rooms[roomToDelete]?.occupiedBeds) > 0}
            onClick={() => {
              handleDeleteRoom(roomToDelete);
              setRoomToDelete(null);
            }}
            sx={{ fontWeight: 700, borderRadius: 2 }}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Dialog: leave with unsaved changes */}
      <Dialog open={leaveOpen} onClose={() => setLeaveOpen(false)} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 3, m: 2, width: "calc(100% - 32px)" } }}>
        <DialogTitle sx={{ fontWeight: 800 }}>Leave without saving?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            {isUploading ? "A file is still uploading. " : ""}Your changes on this page haven't been saved and will be lost.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2, gap: 1, "& .MuiButton-root": { minHeight: 44 } }}>
          <Button onClick={() => setLeaveOpen(false)} sx={{ fontWeight: 700 }}>Stay</Button>
          <Button color="error" variant="contained" onClick={() => navigate("/owner/properties")} sx={{ fontWeight: 700, borderRadius: 2 }}>
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
            bgcolor: "background.default",
            border: "1px solid",
            borderColor: "divider",
            borderRadius: 3,
            boxShadow: (t) => `0 8px 24px ${alpha(t.palette.common.black, 0.14)}`,
            zIndex: 10,
          }}
        >
          <Typography variant="body2" sx={{ flex: 1, fontWeight: 700, color: "warning.main" }}>
            Unsaved changes
          </Typography>
          <Button
            variant="contained"
            startIcon={saving ? <CircularProgress size={18} color="inherit" /> : <SaveIcon />}
            onClick={handleSave}
            disabled={saving || isUploading}
            sx={{ fontWeight: 700, borderRadius: 2.5, flexShrink: 0 }}
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
        <Alert severity={toast.severity} sx={{ width: "100%" }}>
          {toast.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}