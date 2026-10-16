import { useState, useMemo } from "react";
import { useNavigate, Link as RouterLink } from "react-router-dom";
import {
  Box,
  Typography,
  TextField,
  Button,
  Checkbox,
  FormControlLabel,
  Alert,
  Link,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  DialogContentText,
} from "@mui/material";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { auth, db } from "../../config/firebase";

// Same facade motif as the login page, but with fewer windows lit — this is
// a property being set up, not yet fully monitored. Deterministic pattern,
// no reshuffling on render.
const FACADE_ROWS = 6;
const FACADE_COLS = 5;
const LIT_PATTERN = [
  0, 0, 1, 0, 0,
  0, 0, 0, 0, 1,
  0, 1, 0, 0, 0,
  0, 0, 0, 1, 0,
  1, 0, 0, 0, 0,
  0, 0, 1, 0, 0,
];

function DormFacade() {
  const windows = useMemo(() => {
    const w = [];
    const gap = 18;
    const size = 34;
    for (let row = 0; row < FACADE_ROWS; row++) {
      for (let col = 0; col < FACADE_COLS; col++) {
        const idx = row * FACADE_COLS + col;
        w.push({
          x: col * (size + gap),
          y: row * (size + gap),
          lit: LIT_PATTERN[idx] === 1,
          size,
        });
      }
    }
    return w;
  }, []);

  const width = FACADE_COLS * (34 + 18) - 18;
  const height = FACADE_ROWS * (34 + 18) - 18;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      style={{ maxWidth: 300, display: "block" }}
      role="img"
      aria-label="Illustration of a dormitory building at night, with a few rooms lit"
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

  // Modals for Terms and Privacy Policy
  const [termsOpen, setTermsOpen] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);

  const handleChange = (field) => (e) => {
    if (field === "phone") {
      // Data validation: Only allow numbers (strip any non-numeric characters)
      const numericValue = e.target.value.replace(/[^0-9]/g, "");
      setForm((prev) => ({ ...prev, [field]: numericValue }));
      return;
    }
    setForm((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const validate = () => {
    if (!form.fullName.trim()) return "Full name is required.";
    if (!form.email.trim()) return "Email is required.";
    if (!form.phone.trim()) return "Phone number is required.";
    if (form.phone.length < 10) return "Phone number must be at least 10 digits."; // Extra phone validation
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
    <Box sx={{ minHeight: "100vh", display: "flex", flexDirection: { xs: "column", md: "row" } }}>

      {/* Left panel — same identity as the login page, for continuity across the auth flow */}
      <Box
        sx={{
          flex: { xs: "0 0 auto", md: "0 0 42%" },
          bgcolor: "#202020",
          color: "#ffffff",
          display: "flex",
          flexDirection: "column",
          justifyContent: { xs: "flex-start", md: "center" },
          alignItems: "flex-start",
          px: { xs: 4, md: 8 },
          py: { xs: 4, md: 0 },
          gap: 4,
        }}
      >
        <Box
          component="img"
          src="/KwartoKeeper-DarkMode-Icon.png"
          alt="KwartoKeeper"
          sx={{ height: 40, display: { xs: "none", md: "block" } }}
        />

        <Box sx={{ display: { xs: "none", md: "block" } }}>
          <DormFacade />
        </Box>

        <Box>
          <Typography
            variant="h4"
            sx={{ fontFamily: '"Inter", sans-serif', fontWeight: 900, color: "#ffffff", lineHeight: 1.15, mb: 1.5 }}
          >
            Set up your property in minutes.
          </Typography>
          <Typography variant="body1" sx={{ color: "#cadcf6", maxWidth: 340 }}>
            Create your owner account, then add rooms, tenants, and caretakers as your dormitory fills up.
          </Typography>
        </Box>
      </Box>

      {/* Right panel — the form */}
      <Box
        sx={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          px: 3,
          py: { xs: 5, md: 6 },
        }}
      >
        <Box sx={{ width: "100%", maxWidth: 380 }}>

          <Typography variant="h5" color="text.primary" sx={{ fontWeight: 600, mb: 0.5 }}>
            Create your owner account
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
            Set up your KwartoKeeper account to start managing your properties.
          </Typography>

          {error && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {error}
            </Alert>
          )}

          <Box component="form" onSubmit={handleSubmit} noValidate>
            <TextField
              label="Full name"
              fullWidth
              required
              margin="normal"
              value={form.fullName}
              onChange={handleChange("fullName")}
              sx={{ mb: 2 }}
            />
            <TextField
              label="Email address"
              type="email"
              fullWidth
              required
              margin="normal"
              value={form.email}
              onChange={handleChange("email")}
              sx={{ mb: 2 }}
            />
            <TextField
              label="Phone number"
              type="tel"
              fullWidth
              required
              margin="normal"
              value={form.phone}
              onChange={handleChange("phone")}
              sx={{ mb: 2 }}
              inputProps={{ maxLength: 15 }} // Limit length
            />
            <TextField
              label="Password"
              type="password"
              fullWidth
              required
              margin="normal"
              value={form.password}
              onChange={handleChange("password")}
              helperText="At least 6 characters"
              sx={{ mb: 2 }}
            />
            <TextField
              label="Confirm password"
              type="password"
              fullWidth
              required
              margin="normal"
              value={form.confirmPassword}
              onChange={handleChange("confirmPassword")}
              sx={{ mb: 1 }}
            />

            <FormControlLabel
              sx={{ mt: 1, mb: 1 }}
              control={
                <Checkbox
                  checked={agreed}
                  onChange={(e) => setAgreed(e.target.checked)}
                  color="primary"
                  size="small"
                />
              }
              label={
                <Typography variant="body2" color="text.secondary">
                  I agree to the{" "}
                  <Link
                    component="button"
                    variant="body2"
                    onClick={(e) => {
                      e.preventDefault();
                      setTermsOpen(true);
                    }}
                  >
                    Terms of Service
                  </Link>{" "}
                  and{" "}
                  <Link
                    component="button"
                    variant="body2"
                    onClick={(e) => {
                      e.preventDefault();
                      setPrivacyOpen(true);
                    }}
                  >
                    Privacy Policy
                  </Link>
                </Typography>
              }
            />

            <Button
              type="submit"
              variant="contained"
              fullWidth
              size="large"
              disabled={loading}
              sx={{
                mt: 2,
                mb: 3,
                py: 1.5,
                fontWeight: 600,
                backgroundColor: "primary.main",
                "&:hover": { backgroundColor: "primary.dark" },
              }}
            >
              {loading ? (
                <CircularProgress size={24} color="inherit" />
              ) : (
                "Create owner account"
              )}
            </Button>

            <Box sx={{ textAlign: "center" }}>
              <Link component={RouterLink} to="/login" variant="body2" underline="hover" color="text.secondary">
                Back to log in
              </Link>
            </Box>
          </Box>
        </Box>
      </Box>

      {/* Terms of Service Dialog */}
      <Dialog open={termsOpen} onClose={() => setTermsOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 'bold' }}>Terms of Service</DialogTitle>
        <DialogContent dividers>
          <DialogContentText sx={{ mb: 2 }}>
            <strong>1. Acceptance of Terms</strong><br />
            By accessing and using KwartoKeeper, you accept and agree to be bound by the terms and provision of this agreement.
          </DialogContentText>
          <DialogContentText sx={{ mb: 2 }}>
            <strong>2. Property Management</strong><br />
            As a property owner, you are solely responsible for the accuracy of the data entered, including tenant information, billing, and maintenance records.
          </DialogContentText>
          <DialogContentText>
            <strong>3. Service Modifications</strong><br />
            KwartoKeeper reserves the right to modify or discontinue the service with or without notice to the user.
          </DialogContentText>
          {/* Add more terms as needed here */}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setTermsOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Privacy Policy Dialog */}
      <Dialog open={privacyOpen} onClose={() => setPrivacyOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 'bold' }}>Privacy Policy</DialogTitle>
        <DialogContent dividers>
          <DialogContentText sx={{ mb: 2 }}>
            <strong>1. Information Collection</strong><br />
            We collect personal information such as your name, email address, and phone number to set up your account and facilitate property management operations.
          </DialogContentText>
          <DialogContentText sx={{ mb: 2 }}>
            <strong>2. Data Usage</strong><br />
            Your data is used to provide, maintain, and improve the KwartoKeeper platform. We do not sell your personal data to third parties.
          </DialogContentText>
          <DialogContentText>
            <strong>3. Security</strong><br />
            We implement a variety of security measures to maintain the safety of your personal information. However, no method of transmission over the Internet is 100% secure.
          </DialogContentText>
          {/* Add more privacy rules as needed here */}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPrivacyOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

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