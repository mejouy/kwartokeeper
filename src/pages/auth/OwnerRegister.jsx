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
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../../config/firebase";

// Same facade motif as the login page for design continuity.
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
    if (form.phone.length < 10) return "Phone number must be at least 10 digits.";
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

      // Write user profile document to Firestore
      await setDoc(doc(db, "users", user.uid), {
        uid: user.uid,
        fullName: form.fullName.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        role: "owner",
        status: "pending", // <--- FIXED: Changed from "active" to "pending"
        approvalStatus: "pending",
        verificationDocs: {
          idUrl: null,
          clearanceUrl: null,
        },
        createdAt: serverTimestamp(),
      });

      // Direct navigation to onboarding setup wizard (or /owner)
      navigate("/setup");
    } catch (err) {
      setError(mapFirebaseError(err.code));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ minHeight: "100vh", display: "flex", flexDirection: { xs: "column", md: "row" } }}>

      {/* Left Branding Panel */}
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

      {/* Right Registration Form */}
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
              inputProps={{ maxLength: 15 }}
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
                    component="span"
                    variant="body2"
                    role="button"
                    tabIndex={0}
                    onClick={() => setTermsOpen(true)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setTermsOpen(true);
                      }
                    }}
                    sx={{ cursor: "pointer" }}
                  >
                    Terms of Service
                  </Link>{" "}
                  and{" "}
                  <Link
                    component="span"
                    variant="body2"
                    role="button"
                    tabIndex={0}
                    onClick={() => setPrivacyOpen(true)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setPrivacyOpen(true);
                      }
                    }}
                    sx={{ cursor: "pointer" }}
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
            By creating an account or otherwise accessing KwartoKeeper, you agree to be bound by these Terms of Service. If you do not agree, please do not use the platform.
          </DialogContentText>
          <DialogContentText sx={{ mb: 2 }}>
            <strong>2. Description of Service</strong><br />
            KwartoKeeper is an occupancy monitoring and reporting platform for dormitories, boarding houses, and similar rental properties. It helps owners record rooms and beds, enroll tenants, track occupancy, manage caretaker access, and generate reports. KwartoKeeper is a record-keeping tool; it does not itself act as a landlord, broker, or party to any lease or rental agreement.
          </DialogContentText>
          <DialogContentText sx={{ mb: 2 }}>
            <strong>3. Account Eligibility &amp; Registration</strong><br />
            You must be at least 18 years old and legally able to manage a rental property to register as an owner. You agree to provide accurate registration information and to keep your login credentials confidential. You are responsible for all activity under your account.
          </DialogContentText>
          <DialogContentText sx={{ mb: 2 }}>
            <strong>4. Owner Responsibilities</strong><br />
            As a property owner, you are solely responsible for the accuracy of data you enter, including tenant information, room assignments, billing, and maintenance records. You are responsible for obtaining any consent required from tenants before entering their personal information, and for complying with applicable Philippine housing, barangay, and local government regulations that govern your property.
          </DialogContentText>
          <DialogContentText sx={{ mb: 2 }}>
            <strong>5. Caretaker Access</strong><br />
            You may invite caretakers and grant them limited, permission-based access to specific features (such as logging occupancy or handling reports). You remain responsible for actions taken under your account by any caretaker you authorize, and for revoking access when it is no longer needed.
          </DialogContentText>
          <DialogContentText sx={{ mb: 2 }}>
            <strong>6. Acceptable Use</strong><br />
            You agree not to use KwartoKeeper to enter fraudulent information, to access records you are not authorized to view, or to discriminate against or harass tenants or applicants in violation of applicable law.
          </DialogContentText>
          <DialogContentText sx={{ mb: 2 }}>
            <strong>7. Service Availability &amp; Modifications</strong><br />
            KwartoKeeper is provided on an "as is" and "as available" basis. We may update, modify, or temporarily suspend features of the service, including for maintenance, and will aim to give reasonable notice of changes that materially affect your use of the platform.
          </DialogContentText>
          <DialogContentText sx={{ mb: 2 }}>
            <strong>8. Limitation of Liability</strong><br />
            KwartoKeeper is a management tool and is not responsible for disputes between owners and tenants, the accuracy of information entered by users, or losses arising from circumstances beyond our reasonable control.
          </DialogContentText>
          <DialogContentText sx={{ mb: 2 }}>
            <strong>9. Termination</strong><br />
            We may suspend or terminate accounts that violate these Terms or are used unlawfully. You may stop using the service and request account closure at any time.
          </DialogContentText>
          <DialogContentText sx={{ mb: 2 }}>
            <strong>10. Governing Law</strong><br />
            These Terms are governed by the laws of the Republic of the Philippines.
          </DialogContentText>
          <DialogContentText>
            <strong>11. Changes to These Terms</strong><br />
            We may update these Terms from time to time. Continued use of KwartoKeeper after changes take effect constitutes acceptance of the revised Terms.
          </DialogContentText>
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
            <strong>1. Information We Collect</strong><br />
            We collect the information you provide when you register as an owner (name, email, phone number), along with property, room, tenant, and caretaker records that you or your caretakers enter — which may include tenant names, contact details, identification documents, room assignments, and payment records. We also collect basic usage data such as login activity.
          </DialogContentText>
          <DialogContentText sx={{ mb: 2 }}>
            <strong>2. How We Use Your Information</strong><br />
            Information is used to operate and maintain your account, generate occupancy and reporting features, enable caretaker access you authorize, and communicate important account or service updates to you.
          </DialogContentText>
          <DialogContentText sx={{ mb: 2 }}>
            <strong>3. Compliance with Philippine Law</strong><br />
            We process personal data in accordance with the Data Privacy Act of 2012 (Republic Act No. 10173). As the property owner, you act as the personal information controller for the tenant data you input, and KwartoKeeper acts as a processor on your behalf.
          </DialogContentText>
          <DialogContentText sx={{ mb: 2 }}>
            <strong>4. Data Sharing</strong><br />
            Caretakers can only view information within the permissions you grant them. We do not sell personal data to third parties, and only disclose information when required by law or to protect the rights and safety of our users.
          </DialogContentText>
          <DialogContentText sx={{ mb: 2 }}>
            <strong>5. Data Retention</strong><br />
            We retain account and tenant records for as long as your account is active, plus a reasonable period afterward for legal and audit purposes, unless you request earlier deletion where applicable.
          </DialogContentText>
          <DialogContentText sx={{ mb: 2 }}>
            <strong>6. Security</strong><br />
            We implement reasonable technical and organizational measures, including access controls, to protect personal information. However, no method of transmission or storage over the internet is completely secure.
          </DialogContentText>
          <DialogContentText sx={{ mb: 2 }}>
            <strong>7. Your Rights</strong><br />
            Subject to the Data Privacy Act of 2012, you may request access to, correction of, or deletion of your personal data. Tenants wishing to exercise these rights over records entered by a property owner should first contact that owner, who controls the data.
          </DialogContentText>
          <DialogContentText sx={{ mb: 2 }}>
            <strong>8. Changes to This Policy</strong><br />
            We may update this Privacy Policy from time to time. Material changes will be reflected here with an updated effective date.
          </DialogContentText>
          <DialogContentText>
            <strong>9. Contact Us</strong><br />
            If you have questions about this Privacy Policy or how your data is handled, please contact us through the support channels listed in the KwartoKeeper app.
          </DialogContentText>
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