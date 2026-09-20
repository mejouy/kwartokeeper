import { useState } from "react";
import { useNavigate, Link as RouterLink } from "react-router-dom";
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  Checkbox,
  FormControlLabel,
  Alert,
  Link,
  CircularProgress,
} from "@mui/material";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { auth, db } from "../../config/firebase";

export default function OwnerRegister() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    fullName: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
  });
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (field) => (e) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const validate = () => {
    if (!form.fullName.trim()) return "Full name is required.";
    if (!form.email.trim()) return "Email is required.";
    if (!form.phone.trim()) return "Phone number is required.";
    if (form.password.length < 6)
      return "Password must be at least 6 characters.";
    if (form.password !== form.confirmPassword)
      return "Passwords do not match.";
    if (!agreed)
      return "You must agree to the Terms of Service and Privacy Policy.";
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
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        form.email.trim(),
        form.password
      );
      const user = userCredential.user;

      // Immediately write the user's profile document to Firestore
      await setDoc(doc(db, "users", user.uid), {
        uid: user.uid,
        name: form.fullName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        role: "owner",
        createdAt: new Date().toISOString(),
      });

      navigate("/owner/dashboard");
    } catch (err) {
      setError(mapFirebaseError(err.code));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        p: 2,
      }}
    >
      <Paper elevation={3} sx={{ p: 4, width: "100%", maxWidth: 440 }}>
        <Typography variant="h1" sx={{ fontSize: "1.75rem", mb: 1 }}>
          Create Owner Account
        </Typography>
        <Typography variant="body2" sx={{ mb: 3, color: "text.secondary" }}>
          Set up your KwartoKeeper owner account to start managing your
          properties.
        </Typography>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <Box component="form" onSubmit={handleSubmit} noValidate>
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
            label="Phone Number"
            type="tel"
            fullWidth
            required
            margin="normal"
            value={form.phone}
            onChange={handleChange("phone")}
          />
          <TextField
            label="Password"
            type="password"
            fullWidth
            required
            margin="normal"
            value={form.password}
            onChange={handleChange("password")}
          />
          <TextField
            label="Confirm Password"
            type="password"
            fullWidth
            required
            margin="normal"
            value={form.confirmPassword}
            onChange={handleChange("confirmPassword")}
          />

          <FormControlLabel
            sx={{ mt: 1 }}
            control={
              <Checkbox
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
              />
            }
            label={
              <Typography variant="body2">
                I agree to the Terms of Service and Privacy Policy
              </Typography>
            }
          />

          <Button
            type="submit"
            variant="contained"
            fullWidth
            size="large"
            disabled={loading}
            sx={{ mt: 2 }}
          >
            {loading ? (
              <CircularProgress size={24} color="inherit" />
            ) : (
              "Create Owner Account"
            )}
          </Button>

          <Box sx={{ textAlign: "center", mt: 2 }}>
            <Link component={RouterLink} to="/login" variant="body2">
              Back to Login
            </Link>
          </Box>
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
