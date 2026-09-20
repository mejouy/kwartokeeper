import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  MenuItem,
  Divider,
  Alert,
  CircularProgress,
  IconButton,
} from "@mui/material";
import ArrowBackIcon from "@mui/icons-material/ArrowBack";
import { initializeApp, deleteApp, getApps } from "firebase/app";
import {
  getAuth,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
} from "firebase/auth";
import { doc, setDoc, collection, query, where, getDocs } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { auth, db, storage, firebaseConfig } from "../../config/firebase";

const ID_TYPES = [
  { value: "student_id", label: "Student ID" },
  { value: "national_id", label: "National ID" },
  { value: "drivers_license", label: "Driver's License" },
  { value: "passport", label: "Passport" },
];

const LEASE_DURATIONS = [
  { value: "3_months", label: "3 Months" },
  { value: "6_months", label: "6 Months" },
  { value: "12_months", label: "12 Months" },
  { value: "custom", label: "Custom" },
];

function generateTempPassword() {
  const chars =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%";
  let result = "";
  for (let i = 0; i < 16; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Creating a user via the default Auth instance would sign the Owner out.
// Use a temporary secondary app so the Owner's session is untouched.
async function createSubUserWithoutSignOut(email, password) {
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
    return userCredential.user;
  } finally {
    const appToDelete = getApps().find((a) => a.name === secondaryAppName);
    if (appToDelete) await deleteApp(appToDelete);
  }
}

export default function RegisterTenant() {
  const navigate = useNavigate();

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
  });

  const [idPhotoFile, setIdPhotoFile] = useState(null);
  const [properties, setProperties] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [bedOptions, setBedOptions] = useState([]);

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingProperties, setLoadingProperties] = useState(true);

  // Load the current Owner's properties for the "Select Property" dropdown.
  // Rooms are embedded as an array field inside each property document —
  // no separate subcollection query needed.
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
        setProperties(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch (err) {
        setProperties([]);
      } finally {
        setLoadingProperties(false);
      }
    }
    loadProperties();
  }, []);

  // Rooms come from the selected property's embedded `rooms` array —
  // no extra Firestore call needed here.
  useEffect(() => {
    const selectedProperty = properties.find((p) => p.id === form.propertyId);
    setRooms(selectedProperty?.rooms || []);
  }, [form.propertyId, properties]);

  useEffect(() => {
    const selectedRoom = rooms.find((r) => r.roomName === form.roomId);
    if (selectedRoom?.capacity) {
      // Exclude beds already taken based on occupiedBeds count
      const availableStart = (selectedRoom.occupiedBeds || 0) + 1;
      setBedOptions(
        Array.from(
          { length: selectedRoom.capacity - (selectedRoom.occupiedBeds || 0) },
          (_, i) => `Bed ${availableStart + i}`
        )
      );
    } else {
      setBedOptions([]);
    }
  }, [form.roomId, rooms]);

  const handleChange = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const validate = () => {
    if (!form.fullName.trim()) return "Full name is required.";
    if (!form.email.trim()) return "Email is required.";
    return "";
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    try {
      const tempPassword = generateTempPassword();
      const newUser = await createSubUserWithoutSignOut(
        form.email.trim(),
        tempPassword
      );

      let idPhotoUrl = null;
      if (idPhotoFile) {
        const photoRef = ref(
          storage,
          `tenant-ids/${newUser.uid}-${idPhotoFile.name}`
        );
        await uploadBytes(photoRef, idPhotoFile);
        idPhotoUrl = await getDownloadURL(photoRef);
      }

      await setDoc(doc(db, "users", newUser.uid), {
        uid: newUser.uid,
        name: form.fullName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        role: "tenant",
        idType: form.idType,
        idNumber: form.idNumber.trim(),
        idPhotoUrl,
        propertyId: form.propertyId || null,
        roomId: form.roomId || null,
        bedId: form.bedId || null,
        leaseStartDate: form.leaseStartDate || null,
        leaseDuration: form.leaseDuration || null,
        createdAt: new Date().toISOString(),
      });

      navigate(-1);
    } catch (err) {
      setError(mapFirebaseError(err.code));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ maxWidth: 700, mx: "auto", p: 3 }}>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          mb: 3,
        }}
      >
        <IconButton onClick={() => navigate(-1)} aria-label="Back">
          <ArrowBackIcon />
        </IconButton>
        <Typography variant="h1" sx={{ fontSize: "1.75rem" }}>
          Register New Tenant
        </Typography>
        <Button onClick={() => navigate(-1)} disabled={loading}>
          Cancel
        </Button>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Paper elevation={0} sx={{ p: 3, bgcolor: "background.default" }}>
        <Box component="form" onSubmit={handleSubmit} noValidate>
          <Typography
            variant="subtitle1"
            sx={{
              mb: 2,
              fontWeight: 700,
              fontSize: "1rem",
              textTransform: "uppercase",
              letterSpacing: 0.5,
              color: "text.secondary",
            }}
          >
            Personal &amp; Contact Information
          </Typography>
          <TextField
            label="Full Name"
            fullWidth
            required
            margin="normal"
            value={form.fullName}
            onChange={handleChange("fullName")}
          />
          <TextField
            label="Email"
            type="email"
            fullWidth
            required
            margin="normal"
            value={form.email}
            onChange={handleChange("email")}
          />
          <TextField
            label="Mobile Phone"
            type="tel"
            fullWidth
            margin="normal"
            value={form.phone}
            onChange={handleChange("phone")}
          />

          <Typography
            variant="subtitle1"
            sx={{
              mt: 3,
              mb: 2,
              fontWeight: 700,
              fontSize: "1rem",
              textTransform: "uppercase",
              letterSpacing: 0.5,
              color: "text.secondary",
            }}
          >
            Student / Government ID Details
          </Typography>
          <Box sx={{ display: "flex", gap: 2 }}>
            <TextField
              select
              label="ID Type"
              fullWidth
              margin="normal"
              value={form.idType}
              onChange={handleChange("idType")}
            >
              {ID_TYPES.map((opt) => (
                <MenuItem key={opt.value} value={opt.value}>
                  {opt.label}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="ID Number"
              fullWidth
              margin="normal"
              value={form.idNumber}
              onChange={handleChange("idNumber")}
            />
          </Box>
          <Button variant="outlined" component="label" sx={{ mt: 1 }}>
            {idPhotoFile ? idPhotoFile.name : "Upload ID Photo"}
            <input
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => setIdPhotoFile(e.target.files?.[0] || null)}
            />
          </Button>

          <Divider sx={{ my: 3 }} />
          <Typography
            variant="subtitle1"
            sx={{
              mb: 2,
              fontWeight: 700,
              fontSize: "1rem",
              textTransform: "uppercase",
              letterSpacing: 0.5,
              color: "text.secondary",
            }}
          >
            Room &amp; Bed Assignment
          </Typography>
          <TextField
            select
            label="Select Property"
            fullWidth
            margin="normal"
            value={form.propertyId}
            onChange={handleChange("propertyId")}
            helperText={
              loadingProperties
                ? "Loading properties..."
                : properties.length === 0
                ? "No properties found yet."
                : ""
            }
          >
            {properties.map((p) => (
              <MenuItem key={p.id} value={p.id}>
                {p.propertyName || p.id}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="Select Room"
            fullWidth
            margin="normal"
            value={form.roomId}
            onChange={handleChange("roomId")}
            disabled={!form.propertyId}
          >
            {rooms.map((r) => (
              <MenuItem key={r.roomName} value={r.roomName}>
                {r.roomName} — Floor {r.floor} (
                {r.capacity - (r.occupiedBeds || 0)} bed
                {r.capacity - (r.occupiedBeds || 0) === 1 ? "" : "s"}{" "}
                available)
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            label="Bed / Space ID"
            fullWidth
            margin="normal"
            value={form.bedId}
            onChange={handleChange("bedId")}
            disabled={!form.roomId}
          >
            {bedOptions.map((bed) => (
              <MenuItem key={bed} value={bed}>
                {bed}
              </MenuItem>
            ))}
          </TextField>

          <Divider sx={{ my: 3 }} />
          <Typography
            variant="subtitle1"
            sx={{
              mb: 2,
              fontWeight: 700,
              fontSize: "1rem",
              textTransform: "uppercase",
              letterSpacing: 0.5,
              color: "text.secondary",
            }}
          >
            Lease Terms &amp; Rent
          </Typography>
          <Box sx={{ display: "flex", gap: 2 }}>
            <TextField
              label="Lease Start Date"
              type="date"
              fullWidth
              margin="normal"
              slotProps={{ inputLabel: { shrink: true } }}
              value={form.leaseStartDate}
              onChange={handleChange("leaseStartDate")}
            />
            <TextField
              select
              label="Lease Duration"
              fullWidth
              margin="normal"
              value={form.leaseDuration}
              onChange={handleChange("leaseDuration")}
            >
              {LEASE_DURATIONS.map((opt) => (
                <MenuItem key={opt.value} value={opt.value}>
                  {opt.label}
                </MenuItem>
              ))}
            </TextField>
          </Box>

          <Alert severity="info" sx={{ mt: 3 }}>
            The tenant will receive an email at this address with a link to
            set their own password before logging in.
          </Alert>

          <Button
            type="submit"
            variant="contained"
            fullWidth
            size="large"
            disabled={loading}
            sx={{ mt: 3 }}
          >
            {loading ? (
              <CircularProgress size={24} color="inherit" />
            ) : (
              "Register Tenant"
            )}
          </Button>
        </Box>
      </Paper>
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
      return "Something went wrong. Please try again.";
  }
}