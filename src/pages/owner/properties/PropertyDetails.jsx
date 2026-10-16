import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Box, Paper, Typography, Button, Tabs, Tab, Grid, TextField,
  CircularProgress, IconButton, Stack, Snackbar, Alert, FormGroup,
  FormControlLabel, Checkbox, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Chip, Switch, Divider, Card, CardContent,
  Dialog, DialogTitle, DialogContent, DialogActions, InputAdornment
} from "@mui/material";

// Icons
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import SaveIcon from "@mui/icons-material/Save";
import HomeWorkIcon from "@mui/icons-material/HomeWork";
import WifiIcon from "@mui/icons-material/Wifi";
import PolicyIcon from "@mui/icons-material/Policy";
import MeetingRoomIcon from "@mui/icons-material/MeetingRoom";
import LocationOnIcon from "@mui/icons-material/LocationOn";
import ScheduleIcon from "@mui/icons-material/Schedule";
import KingBedIcon from "@mui/icons-material/KingBed";
import LayersIcon from "@mui/icons-material/Layers";
import AddIcon from "@mui/icons-material/Add";
import DeleteIcon from "@mui/icons-material/Delete";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import InsertDriveFileIcon from "@mui/icons-material/InsertDriveFile";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";

// Firebase
import { db, storage } from "../../../config/firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";

const DEFAULT_AMENITIES = [
  "Wi-Fi", "Air Conditioning", "CCTV", "Shared Kitchen", 
  "Study Area", "Laundry Room", "Parking Space", "Water Heater", "24/7 Security Guard"
];

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

export default function PropertyDetails() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tabValue, setTabValue] = useState(0);
  const [toast, setToast] = useState({ open: false, message: "", severity: "success" });

  // Custom Amenity Input State
  const [customAmenityInput, setCustomAmenityInput] = useState("");

  // Document Upload State
  const [uploadingFile, setUploadingFile] = useState(false);

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
      try {
        const docRef = doc(db, "properties", id);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const data = docSnap.data();
          const rooms = Array.isArray(data.rooms) ? data.rooms : [];
          
          setFormData({
            propertyName: data.propertyName || "",
            propertyType: data.propertyType || "Dormitory",
            coverPhotoUrl: data.coverPhotoUrl || "",
            emergencyPhone: data.emergencyPhone || "",
            configMode: data.configMode || "uniform",
            namingPattern: data.namingPattern || "alpha",
            totalFloors: data.totalFloors || 1,
            totalRooms: rooms.length || data.totalRooms || 0,
            totalBeds: rooms.reduce((sum, r) => sum + (Number(r.capacity) || 0), 0),
            occupiedBeds: data.occupiedBeds || 0,
            address: {
              street: data.address?.street || "",
              barangay: data.address?.barangay || "",
              cityMunicipality: data.address?.cityMunicipality || "",
              province: data.address?.province || "",
              region: data.address?.region || ""
            },
            curfew: {
              enabled: Boolean(data.curfew?.enabled),
              startTime: data.curfew?.startTime || "10:00 PM"
            },
            amenities: Array.isArray(data.amenities) ? data.amenities : [],
            rulesText: Array.isArray(data.rules) ? data.rules.join("\n") : "",
            ruleFiles: Array.isArray(data.ruleFiles) ? data.ruleFiles : [],
            rooms: rooms
          });
        }
      } catch (error) {
        console.error("Error fetching property:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchProperty();
  }, [id]);

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

  // File Upload Logic (Rules & Documents)
  const handleFileUpload = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadingFile(true);
    try {
      const file = files[0];
      const filePath = `properties/${id}/rules/${Date.now()}_${file.name}`;
      const storageRef = ref(storage, filePath);

      await uploadBytes(storageRef, file);
      const downloadUrl = await getDownloadURL(storageRef);

      const fileObj = {
        name: file.name,
        url: downloadUrl,
        path: filePath,
        uploadedAt: new Date().toISOString()
      };

      setFormData(prev => ({
        ...prev,
        ruleFiles: [...prev.ruleFiles, fileObj]
      }));

      setToast({ open: true, message: "Document uploaded successfully!", severity: "success" });
    } catch (error) {
      console.error("File upload error:", error);
      setToast({ open: true, message: "Failed to upload file.", severity: "error" });
    } finally {
      setUploadingFile(false);
    }
  };

  const handleDeleteFile = async (index, fileObj) => {
    try {
      if (fileObj.path) {
        const storageRef = ref(storage, fileObj.path);
        await deleteObject(storageRef).catch(() => {});
      }
      setFormData(prev => ({
        ...prev,
        ruleFiles: prev.ruleFiles.filter((_, i) => i !== index)
      }));
      setToast({ open: true, message: "File removed.", severity: "info" });
    } catch (err) {
      console.error("Failed to delete file", err);
    }
  };

  // Save to Firebase
  const handleSave = async () => {
    setSaving(true);
    try {
      const docRef = doc(db, "properties", id);
      
      const updatePayload = {
        propertyName: formData.propertyName,
        propertyType: formData.propertyType,
        coverPhotoUrl: formData.coverPhotoUrl || null,
        emergencyPhone: formData.emergencyPhone,
        configMode: formData.configMode,
        namingPattern: formData.namingPattern,
        totalFloors: Number(formData.totalFloors),
        totalRooms: Number(formData.rooms.length),
        totalBeds: Number(formData.totalBeds),
        occupiedBeds: Number(formData.occupiedBeds),
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
          occupiedBeds: Number(room.occupiedBeds || 0),
          monthlyRatePerBed: Number(room.monthlyRatePerBed || 0)
        })),
        updatedAt: new Date()
      };

      await updateDoc(docRef, updatePayload);
      setToast({ open: true, message: "Property saved to Firebase!", severity: "success" });
    } catch (error) {
      console.error("Error updating property:", error);
      setToast({ open: true, message: "Failed to save property.", severity: "error" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: "flex", justifyContent: "center", mt: 10 }}>
        <CircularProgress />
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

  return (
    <Box sx={{ pb: 6, maxWidth: 1200, mx: "auto" }}>
      {/* Header */}
      <Box sx={{ display: "flex", alignItems: "center", mb: 3, flexWrap: "wrap", gap: 2 }}>
        <IconButton onClick={() => navigate("/owner/properties")}>
          <ArrowBackIcon />
        </IconButton>
        <Box sx={{ flexGrow: 1 }}>
          <Stack direction="row" spacing={1} sx={{ alignItems: "center" }} flexWrap="wrap">
            <Typography variant="h5" fontWeight="700">
              {formData.propertyName || "Unnamed Property"}
            </Typography>
            <Chip label={formData.propertyType} size="small" color="primary" variant="outlined" />
          </Stack>
          <Typography variant="body2" color="text.secondary">
            {fullAddressStr || "No address specified"}
          </Typography>
        </Box>
        <Button
          variant="contained"
          size="large"
          startIcon={saving ? <CircularProgress size={20} color="inherit" /> : <SaveIcon />}
          onClick={handleSave}
          disabled={saving}
          sx={{ fontWeight: 700, px: 3, borderRadius: 2 }}
        >
          {saving ? "Saving..." : "Save Property"}
        </Button>
      </Box>

      {/* Metrics Bar */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={6} sm={3}>
          <Paper elevation={0} sx={{ p: 2, border: "1px solid", borderColor: "divider", borderRadius: 2 }}>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <MeetingRoomIcon color="primary" />
              <Box>
                <Typography variant="caption" color="text.secondary">Total Rooms</Typography>
                <Typography variant="h6" fontWeight="700">{formData.totalRooms}</Typography>
              </Box>
            </Stack>
          </Paper>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Paper elevation={0} sx={{ p: 2, border: "1px solid", borderColor: "divider", borderRadius: 2 }}>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <KingBedIcon color="primary" />
              <Box>
                <Typography variant="caption" color="text.secondary">Total Capacity</Typography>
                <Typography variant="h6" fontWeight="700">{formData.totalBeds} Beds</Typography>
              </Box>
            </Stack>
          </Paper>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Paper elevation={0} sx={{ p: 2, border: "1px solid", borderColor: "divider", borderRadius: 2 }}>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <LayersIcon color="primary" />
              <Box>
                <Typography variant="caption" color="text.secondary">Total Floors</Typography>
                <Typography variant="h6" fontWeight="700">{formData.totalFloors}</Typography>
              </Box>
            </Stack>
          </Paper>
        </Grid>
        <Grid item xs={6} sm={3}>
          <Paper elevation={0} sx={{ p: 2, border: "1px solid", borderColor: "divider", borderRadius: 2 }}>
            <Box>
              <Typography variant="caption" color="text.secondary">Occupancy Status</Typography>
              <Typography variant="h6" fontWeight="700" color="success.main">
                {formData.occupiedBeds} / {formData.totalBeds} Occupied
              </Typography>
            </Box>
          </Paper>
        </Grid>
      </Grid>

      {/* Tabs */}
      <Paper elevation={0} sx={{ borderBottom: 1, borderColor: "divider", mb: 3 }}>
        <Tabs value={tabValue} onChange={(e, val) => setTabValue(val)} variant="scrollable">
          <Tab icon={<HomeWorkIcon sx={{ fontSize: 18 }} />} iconPosition="start" label="General Profile" />
          <Tab icon={<MeetingRoomIcon sx={{ fontSize: 18 }} />} iconPosition="start" label={`Rooms (${formData.rooms.length}) & Rates`} />
          <Tab icon={<PolicyIcon sx={{ fontSize: 18 }} />} iconPosition="start" label="Curfew, Rules & Documents" />
          <Tab icon={<WifiIcon sx={{ fontSize: 18 }} />} iconPosition="start" label="Property Amenities" />
        </Tabs>
      </Paper>

      {/* TAB 0: GENERAL PROFILE */}
      {tabValue === 0 && (
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Paper elevation={0} sx={{ p: 3, border: "1px solid", borderColor: "divider", borderRadius: 3 }}>
              <Typography variant="h6" fontWeight="700" mb={2}>Property Information</Typography>
              <Stack spacing={2.5}>
                <TextField
                  fullWidth
                  label="Property Name"
                  name="propertyName"
                  value={formData.propertyName}
                  onChange={handleChange}
                />
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Property Type"
                      name="propertyType"
                      value={formData.propertyType}
                      onChange={handleChange}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Emergency Phone"
                      name="emergencyPhone"
                      value={formData.emergencyPhone}
                      onChange={handleChange}
                    />
                  </Grid>
                </Grid>
                <TextField
                  fullWidth
                  label="Cover Photo URL"
                  name="coverPhotoUrl"
                  value={formData.coverPhotoUrl}
                  onChange={handleChange}
                  placeholder="https://example.com/photo.jpg"
                />
                <TextField
                  fullWidth
                  type="number"
                  label="Number of Floors"
                  name="totalFloors"
                  value={formData.totalFloors}
                  onChange={(e) => setFormData(prev => ({ ...prev, totalFloors: Math.max(1, Number(e.target.value)) }))}
                  helperText="Adjusting this updates total floor capacity counters."
                />
              </Stack>
            </Paper>
          </Grid>

          <Grid item xs={12} md={6}>
            <Paper elevation={0} sx={{ p: 3, border: "1px solid", borderColor: "divider", borderRadius: 3 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
                <LocationOnIcon color="primary" />
                <Typography variant="h6" fontWeight="700">Location Address</Typography>
              </Box>
              <Stack spacing={2}>
                <TextField
                  fullWidth
                  label="Street / Building No."
                  name="street"
                  value={formData.address.street}
                  onChange={handleAddressChange}
                />
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Barangay"
                      name="barangay"
                      value={formData.address.barangay}
                      onChange={handleAddressChange}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="City / Municipality"
                      name="cityMunicipality"
                      value={formData.address.cityMunicipality}
                      onChange={handleAddressChange}
                    />
                  </Grid>
                </Grid>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Province"
                      name="province"
                      value={formData.address.province}
                      onChange={handleAddressChange}
                    />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField
                      fullWidth
                      label="Region"
                      name="region"
                      value={formData.address.region}
                      onChange={handleAddressChange}
                    />
                  </Grid>
                </Grid>
              </Stack>
            </Paper>
          </Grid>
        </Grid>
      )}

      {/* TAB 1: ROOMS GROUPED BY FLOOR */}
      {tabValue === 1 && (
        <Stack spacing={3}>
          <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 2 }}>
            <Box>
              <Typography variant="h6" fontWeight="700">Rooms & Rates Manager</Typography>
              <Typography variant="body2" color="text.secondary">
                Easily set monthly bed rates, manage room capacity, and assign floors.
              </Typography>
            </Box>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setOpenAddRoomModal(true)}
              sx={{ borderRadius: 2 }}
            >
              Add New Room
            </Button>
          </Box>

          {floorNumbers.length === 0 ? (
            <Paper elevation={0} sx={{ p: 5, textAlign: "center", border: "1px border-dashed", borderColor: "divider" }}>
              <Typography variant="body1" color="text.secondary">No rooms added yet.</Typography>
              <Button startIcon={<AddIcon />} sx={{ mt: 1 }} onClick={() => setOpenAddRoomModal(true)}>
                Add your first room
              </Button>
            </Paper>
          ) : (
            floorNumbers.map((floorNum) => {
              const floorRooms = roomsByFloor[floorNum];
              const floorBeds = floorRooms.reduce((sum, r) => sum + (Number(r.capacity) || 0), 0);

              return (
                <Paper key={floorNum} elevation={0} sx={{ border: "1px solid", borderColor: "divider", borderRadius: 3, overflow: "hidden" }}>
                  <Box sx={{ p: 2, px: 3, backgroundColor: "action.hover", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <Stack direction="row" spacing={1.5} alignItems="center">
                      <LayersIcon color="primary" size="small" />
                      <Typography variant="subtitle1" fontWeight="700">
                        Floor {floorNum}
                      </Typography>
                      <Chip label={`${floorRooms.length} Rooms`} size="small" variant="outlined" />
                      <Chip label={`${floorBeds} Total Beds`} size="small" color="primary" variant="outlined" />
                    </Stack>
                  </Box>

                  <TableContainer>
                    <Table>
                      <TableHead>
                        <TableRow>
                          <TableCell fontWeight="700">Room Name</TableCell>
                          <TableCell fontWeight="700">Floor Level</TableCell>
                          <TableCell fontWeight="700">Bed Capacity</TableCell>
                          <TableCell fontWeight="700">Monthly Rate / Bed (₱)</TableCell>
                          <TableCell align="right" fontWeight="700">Actions</TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {floorRooms.map((room) => {
                          const idx = room.originalIndex;
                          return (
                            <TableRow key={room.id || idx} hover>
                              <TableCell sx={{ minWidth: 150 }}>
                                <TextField
                                  size="small"
                                  fullWidth
                                  value={room.roomName}
                                  onChange={(e) => handleRoomChange(idx, "roomName", e.target.value)}
                                />
                              </TableCell>
                              <TableCell sx={{ width: 120 }}>
                                <TextField
                                  type="number"
                                  size="small"
                                  value={room.floor}
                                  onChange={(e) => handleRoomChange(idx, "floor", e.target.value)}
                                />
                              </TableCell>
                              <TableCell sx={{ width: 130 }}>
                                <TextField
                                  type="number"
                                  size="small"
                                  value={room.capacity}
                                  onChange={(e) => handleRoomChange(idx, "capacity", e.target.value)}
                                />
                              </TableCell>
                              <TableCell sx={{ minWidth: 320 }}>
                                <Stack spacing={1}>
                                  <TextField
                                    size="small"
                                    type="number"
                                    value={room.monthlyRatePerBed}
                                    onChange={(e) => handleRoomChange(idx, "monthlyRatePerBed", e.target.value)}
                                    InputProps={{
                                      startAdornment: <InputAdornment position="start">₱</InputAdornment>
                                    }}
                                  />
                                  {/* Non-Techy Easy Rate Presets */}
                                  <Stack direction="row" spacing={0.5} flexWrap="wrap" gap={0.5}>
                                    {RATE_PRESETS.map(preset => (
                                      <Chip
                                        key={preset}
                                        label={`₱${preset.toLocaleString()}`}
                                        size="small"
                                        clickable
                                        color={room.monthlyRatePerBed === preset ? "primary" : "default"}
                                        onClick={() => handleRoomChange(idx, "monthlyRatePerBed", preset)}
                                      />
                                    ))}
                                  </Stack>
                                </Stack>
                              </TableCell>
                              <TableCell align="right">
                                <IconButton color="error" onClick={() => handleDeleteRoom(idx)}>
                                  <DeleteIcon />
                                </IconButton>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </Paper>
              );
            })
          )}
        </Stack>
      )}

      {/* TAB 2: CURFEW, RULES & FILE UPLOADS */}
      {tabValue === 2 && (
        <Grid container spacing={3}>
          {/* Easy Curfew Time Selector */}
          <Grid item xs={12} md={5}>
            <Paper elevation={0} sx={{ p: 3, border: "1px solid", borderColor: "divider", borderRadius: 3, mb: 3 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
                <ScheduleIcon color="primary" />
                <Typography variant="h6" fontWeight="700">Curfew Policy</Typography>
              </Box>
              <Typography variant="body2" color="text.secondary" mb={2}>
                Set automated curfew hours for your property tenants.
              </Typography>

              <Stack spacing={2.5}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={formData.curfew.enabled}
                      onChange={handleCurfewToggle}
                      color="primary"
                    />
                  }
                  label={<Typography fontWeight="600">{formData.curfew.enabled ? "Curfew Active" : "Curfew Disabled"}</Typography>}
                />

                <Box sx={{ opacity: formData.curfew.enabled ? 1 : 0.5, pointerEvents: formData.curfew.enabled ? "auto" : "none" }}>
                  <Typography variant="caption" color="text.secondary" mb={1} display="block">
                    Select Curfew Start Time:
                  </Typography>
                  <TextField
                    fullWidth
                    type="time"
                    size="medium"
                    value={formatTo24Hour(formData.curfew.startTime)}
                    onChange={handleCurfewTimeChange}
                    InputLabelProps={{ shrink: true }}
                    inputProps={{ step: 1800 }} // 30 min steps
                  />

                  {/* Non-Techy Quick Choice Time Buttons */}
                  <Typography variant="caption" color="text.secondary" mt={1.5} mb={0.5} display="block">
                    Quick Pick Times:
                  </Typography>
                  <Stack direction="row" spacing={1} flexWrap="wrap">
                    {["8:00 PM", "9:00 PM", "10:00 PM", "11:00 PM", "12:00 AM"].map((timeStr) => (
                      <Chip
                        key={timeStr}
                        label={timeStr}
                        clickable
                        color={formData.curfew.startTime === timeStr ? "primary" : "default"}
                        onClick={() => setFormData(prev => ({ ...prev, curfew: { ...prev.curfew, startTime: timeStr } }))}
                      />
                    ))}
                  </Stack>
                </Box>
              </Stack>
            </Paper>
          </Grid>

          {/* House Rules & Document Uploads */}
          <Grid item xs={12} md={7}>
            <Paper elevation={0} sx={{ p: 3, border: "1px solid", borderColor: "divider", borderRadius: 3 }}>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
                <PolicyIcon color="primary" />
                <Typography variant="h6" fontWeight="700">House Rules & Contract Files</Typography>
              </Box>
              <Typography variant="body2" color="text.secondary" mb={3}>
                Type custom text rules or upload signed documents (.pdf, .docx).
              </Typography>

              <Stack spacing={3}>
                <TextField
                  fullWidth
                  multiline
                  rows={5}
                  label="Typed House Rules"
                  name="rulesText"
                  value={formData.rulesText}
                  onChange={handleChange}
                  placeholder="1. Visitors strictly allowed until 8 PM.&#10;2. Quiet hours start at 10 PM."
                />

                <Divider />

                {/* File Upload Section */}
                <Box>
                  <Typography variant="subtitle2" fontWeight="700" mb={1}>
                    Uploaded Documents / Rule Files (.pdf, .docx)
                  </Typography>

                  {/* File List */}
                  {formData.ruleFiles.length > 0 && (
                    <Stack spacing={1} mb={2}>
                      {formData.ruleFiles.map((file, idx) => (
                        <Paper
                          key={idx}
                          elevation={0}
                          sx={{ p: 1.5, border: "1px solid", borderColor: "divider", borderRadius: 2, display: "flex", alignItems: "center", justifyContent: "space-between" }}
                        >
                          <Stack direction="row" spacing={1.5} alignItems="center" sx={{ overflow: "hidden" }}>
                            <InsertDriveFileIcon color="action" />
                            <Box sx={{ overflow: "hidden" }}>
                              <Typography variant="body2" fontWeight="600" noWrap>
                                {file.name}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                <a href={file.url} target="_blank" rel="noopener noreferrer" style={{ color: "inherit" }}>
                                  View / Download
                                </a>
                              </Typography>
                            </Box>
                          </Stack>
                          <IconButton size="small" color="error" onClick={() => handleDeleteFile(idx, file)}>
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Paper>
                      ))}
                    </Stack>
                  )}

                  {/* Upload Button */}
                  <Button
                    component="label"
                    variant="outlined"
                    startIcon={uploadingFile ? <CircularProgress size={18} /> : <CloudUploadIcon />}
                    disabled={uploadingFile}
                    sx={{ borderRadius: 2 }}
                  >
                    {uploadingFile ? "Uploading File..." : "Upload PDF or DOCX File"}
                    <input
                      type="file"
                      hidden
                      accept=".pdf,.doc,.docx"
                      onChange={handleFileUpload}
                    />
                  </Button>
                </Box>
              </Stack>
            </Paper>
          </Grid>
        </Grid>
      )}

      {/* TAB 3: AMENITIES & CUSTOM AMENITIES */}
      {tabValue === 3 && (
        <Paper elevation={0} sx={{ p: 3, border: "1px solid", borderColor: "divider", borderRadius: 3 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 1 }}>
            <WifiIcon color="primary" />
            <Typography variant="h6" fontWeight="700">Property Amenities & Facilities</Typography>
          </Box>
          <Typography variant="body2" color="text.secondary" mb={3}>
            Select standard amenities or type your own custom features below.
          </Typography>

          {/* Standard Amenities Checkbox List */}
          <FormGroup sx={{ mb: 4 }}>
            <Grid container spacing={2}>
              {DEFAULT_AMENITIES.map((amenity) => (
                <Grid item xs={12} sm={6} md={4} key={amenity}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={formData.amenities.includes(amenity)}
                        onChange={() => handleAmenityToggle(amenity)}
                      />
                    }
                    label={amenity}
                  />
                </Grid>
              ))}
            </Grid>
          </FormGroup>

          <Divider sx={{ my: 3 }} />

          {/* Add Custom Amenity Input */}
          <Typography variant="subtitle1" fontWeight="700" mb={1}>Add Custom Amenities</Typography>
          <Stack direction="row" spacing={1} sx={{ maxWidth: 500, mb: 3 }}>
            <TextField
              fullWidth
              size="small"
              placeholder="e.g., Solar Power, Swimming Pool"
              value={customAmenityInput}
              onChange={(e) => setCustomAmenityInput(e.target.value)}
              onKeyPress={(e) => e.key === "Enter" && handleAddCustomAmenity()}
            />
            <Button variant="contained" onClick={handleAddCustomAmenity} sx={{ whiteSpace: "nowrap" }}>
              Add
            </Button>
          </Stack>

          {/* Currently Selected Amenities Display */}
          <Typography variant="subtitle2" fontWeight="700" mb={1}>Active Amenities List:</Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap" gap={1}>
            {formData.amenities.map((amenity) => (
              <Chip
                key={amenity}
                label={amenity}
                color="primary"
                onDelete={() => handleAmenityToggle(amenity)}
              />
            ))}
          </Stack>
        </Paper>
      )}

      {/* Modal: Add New Room */}
      <Dialog open={openAddRoomModal} onClose={() => setOpenAddRoomModal(false)} maxWidth="xs" fullWidth>
        <DialogTitle fontWeight="700">Add New Room</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2.5} sx={{ pt: 1 }}>
            <TextField
              fullWidth
              label="Room Name / Number"
              placeholder="e.g. Room 101"
              value={newRoomData.roomName}
              onChange={(e) => setNewRoomData(prev => ({ ...prev, roomName: e.target.value }))}
            />
            <TextField
              fullWidth
              type="number"
              label="Floor Number"
              value={newRoomData.floor}
              onChange={(e) => setNewRoomData(prev => ({ ...prev, floor: Math.max(1, Number(e.target.value)) }))}
            />
            <TextField
              fullWidth
              type="number"
              label="Bed Capacity"
              value={newRoomData.capacity}
              onChange={(e) => setNewRoomData(prev => ({ ...prev, capacity: Math.max(1, Number(e.target.value)) }))}
            />
            <TextField
              fullWidth
              type="number"
              label="Monthly Rate per Bed (₱)"
              value={newRoomData.monthlyRatePerBed}
              onChange={(e) => setNewRoomData(prev => ({ ...prev, monthlyRatePerBed: Math.max(0, Number(e.target.value)) }))}
              InputProps={{ startAdornment: <InputAdornment position="start">₱</InputAdornment> }}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setOpenAddRoomModal(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleCreateRoom}>Add Room</Button>
        </DialogActions>
      </Dialog>

      {/* Toast Feedback */}
      <Snackbar
        open={toast.open}
        autoHideDuration={4000}
        onClose={() => setToast(prev => ({ ...prev, open: false }))}
      >
        <Alert severity={toast.severity} sx={{ width: "100%" }}>
          {toast.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}