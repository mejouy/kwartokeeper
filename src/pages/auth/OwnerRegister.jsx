import { useState } from "react";
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
  InputAdornment,
  IconButton,
} from "@mui/material";
import {
  Visibility,
  VisibilityOff,
  PersonOutlineRounded,
  MailOutlineRounded,
  PhoneOutlined,
  LockOutlined,
  ArrowForwardRounded,
} from "@mui/icons-material";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../../config/firebase";
import AuthLayout, { FormHeading } from "../../components/AuthLayout";
import { fieldSx, primaryButtonSx } from "../../components/authStyles";

// Same building as the login page, with a different set of lit windows.
const LIT_PATTERN = [
  0, 0, 1, 0, 0,
  0, 0, 0, 0, 1,
  0, 1, 0, 0, 0,
  0, 0, 0, 1, 0,
  1, 0, 0, 0, 0,
  0, 0, 1, 0, 0,
];

const startIcon = (Icon) => ({
  startAdornment: (
    <InputAdornment position="start">
      <Icon />
    </InputAdornment>
  ),
});

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
  const [showPassword, setShowPassword] = useState(false);

  // Modals for Terms and Privacy Policy
  const [termsOpen, setTermsOpen] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);

  // Opens a dialog from a link inside the checkbox label. preventDefault stops the
  // click from ticking the box; blur releases focus before the dialog hides the page
  // from screen readers (otherwise the browser blocks aria-hidden on a focused element).
  const openDialog = (setOpen) => (e) => {
    e.preventDefault();
    e.currentTarget.blur();
    setOpen(true);
  };

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

      // Show a short welcome page first, then the setup wizard
      navigate("/welcome");
    } catch (err) {
      setError(mapFirebaseError(err.code));
    } finally {
      setLoading(false);
    }
  };

  const passwordToggle = (
    <InputAdornment position="end">
      <IconButton
        onClick={() => setShowPassword((v) => !v)}
        edge="end"
        aria-label={showPassword ? "Hide passwords" : "Show passwords"}
      >
        {showPassword ? <VisibilityOff /> : <Visibility />}
      </IconButton>
    </InputAdornment>
  );
  const confirmTouched = form.confirmPassword.length > 0;
  const passwordsMatch = form.password === form.confirmPassword;

  return (
    <AuthLayout
      title="Set up your property in minutes."
      subtitle="Create your owner account, then add rooms, tenants, and caretakers as your dormitory fills up."
      lit={LIT_PATTERN}
    >
      <FormHeading
        title="Create your owner account"
        subtitle="Set up your KwartoKeeper account to start managing your properties."
      />

      {error && (
        <Alert severity="error" sx={{ mb: 3, borderRadius: "10px" }}>
          {error}
        </Alert>
      )}

      <Box component="form" onSubmit={handleSubmit} noValidate sx={{ display: "grid", gap: 2.25 }}>
        <TextField
          label="Full name"
          fullWidth
          required
          autoComplete="name"
          value={form.fullName}
          onChange={handleChange("fullName")}
          sx={fieldSx}
          slotProps={{ input: startIcon(PersonOutlineRounded) }}
        />
        <TextField
          label="Email address"
          type="email"
          fullWidth
          required
          autoComplete="email"
          value={form.email}
          onChange={handleChange("email")}
          sx={fieldSx}
          slotProps={{
            input: startIcon(MailOutlineRounded),
            htmlInput: { inputMode: "email", autoCapitalize: "none" },
          }}
        />
        <TextField
          label="Phone number"
          type="tel"
          fullWidth
          required
          autoComplete="tel"
          value={form.phone}
          onChange={handleChange("phone")}
          helperText="Numbers only, e.g. 09171234567"
          sx={fieldSx}
          slotProps={{
            input: startIcon(PhoneOutlined),
            htmlInput: { maxLength: 15, inputMode: "numeric" },
          }}
        />

        <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", sm: "repeat(2, minmax(0, 1fr))" }, gap: 2.25 }}>
          <TextField
            label="Password"
            type={showPassword ? "text" : "password"}
            fullWidth
            required
            autoComplete="new-password"
            value={form.password}
            onChange={handleChange("password")}
            helperText="At least 6 characters"
            sx={fieldSx}
            slotProps={{ input: { ...startIcon(LockOutlined), endAdornment: passwordToggle } }}
          />
          <TextField
            label="Confirm password"
            type={showPassword ? "text" : "password"}
            fullWidth
            required
            autoComplete="new-password"
            value={form.confirmPassword}
            onChange={handleChange("confirmPassword")}
            error={confirmTouched && !passwordsMatch}
            helperText={confirmTouched ? (passwordsMatch ? "Passwords match" : "Passwords do not match") : " "}
            sx={{
              ...fieldSx,
              "& .MuiFormHelperText-root:not(.Mui-error)": { color: confirmTouched ? "success.main" : "text.secondary" },
            }}
            slotProps={{ input: startIcon(LockOutlined) }}
          />
        </Box>

        <FormControlLabel
          sx={{ alignItems: "flex-start", mx: 0, p: 1.5, borderRadius: "12px", bgcolor: "background.paper" }}
          control={
            <Checkbox
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              color="primary"
              size="small"
              sx={{ p: 0, mr: 1.25, mt: "2px" }}
            />
          }
          label={
            <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.5 }}>
              I agree to the{" "}
              <Link
                component="button"
                type="button"
                variant="body2"
                onClick={openDialog(setTermsOpen)}
                sx={{ fontWeight: 600, verticalAlign: "baseline" }}
              >
                Terms of Service
              </Link>{" "}
              and{" "}
              <Link
                component="button"
                type="button"
                variant="body2"
                onClick={openDialog(setPrivacyOpen)}
                sx={{ fontWeight: 600, verticalAlign: "baseline" }}
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
          endIcon={loading ? null : <ArrowForwardRounded />}
          sx={primaryButtonSx}
        >
          {loading ? <CircularProgress size={24} color="inherit" /> : "Create owner account"}
        </Button>

        <Typography variant="body2" color="text.secondary" sx={{ textAlign: "center" }}>
          Already have an account?{" "}
          <Link component={RouterLink} to="/login" underline="hover" sx={{ fontWeight: 700 }}>
            Log in
          </Link>
        </Typography>
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
    </AuthLayout>
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