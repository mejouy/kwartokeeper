import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Button, TextField, Typography, Link,
  InputAdornment, IconButton, Alert, CircularProgress,
  FormControlLabel, Checkbox, Divider,
  Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions
} from '@mui/material';
import { Visibility, VisibilityOff, MailOutlineRounded, LockOutlined, ArrowForwardRounded } from '@mui/icons-material';
import {
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence
} from 'firebase/auth';
import { doc, getDoc, collection, getDocs } from 'firebase/firestore';
import { auth, db } from '../../config/firebase';
import AuthLayout, { FormHeading } from '../../components/AuthLayout';
import { fieldSx, primaryButtonSx } from '../../components/authStyles';

// Lit windows on the brand panel's building (6 rows x 5 columns)
const LIT_PATTERN = [
  1, 0, 0, 1, 0,
  0, 0, 1, 0, 0,
  1, 0, 0, 0, 1,
  0, 1, 0, 0, 0,
  0, 0, 1, 0, 1,
  1, 0, 0, 1, 0,
];

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [rememberMe, setRememberMe] = useState(false);

  // Password Reset Modal States
  const [resetOpen, setResetOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState('');
  const [resetSuccess, setResetSuccess] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // 1. Configure session persistence based on "Remember Me"
      await setPersistence(
        auth,
        rememberMe ? browserLocalPersistence : browserSessionPersistence
      );

      // 2. Authenticate with Firebase Auth
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // 3. Fetch user profile from Firestore
      const userDocRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userDocRef);
      let userData = userDoc.exists() ? userDoc.data() : null;

      if (!userData) {
        const roleProfiles = [
          { collectionName: 'tenants', role: 'tenant' },
          { collectionName: 'caretakers', role: 'caretaker' },
        ];

        for (const profile of roleProfiles) {
          const profileDoc = await getDoc(
            doc(db, profile.collectionName, user.uid)
          );
          if (profileDoc.exists()) {
            const profileData = profileDoc.data();
            userData = { ...profileData, role: profileData.role || profile.role };
            break;
          }
        }
      }

      if (userData) {
        if (userData.role === 'owner') {
          const propertiesRef = collection(db, 'properties');
          const propertySnap = await getDocs(propertiesRef);

          const hasRegisteredProperty = propertySnap.docs.some((docSnap) => {
            const property = docSnap.data();
            const ownerValue =
              property.ownerUid ??
              property.ownerId ??
              property.createdBy ??
              property.userId ??
              property.uid ??
              property.owner?.uid ??
              property.owner?.id ??
              '';

            return String(ownerValue).trim().toLowerCase() === String(user.uid).trim().toLowerCase();
          });

          if (!hasRegisteredProperty && !userData.hasProperty) {
            navigate('/setup');
          } else {
            navigate('/owner');
          }
        } else if (userData.role === 'tenant') {
          navigate('/tenant/dashboard');
        } else if (userData.role === 'caretaker') {
          navigate('/caretaker/dashboard');
        } else if (userData.role === 'admin') {
          navigate('/admin/overview');
        } else {
          setError('Invalid user role assigned.');
        }
      } else {
        setError('We could not find a profile for this account. Please contact your property owner.');
      }
    } catch (err) {
      console.error(err);
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        setError('Invalid email or password. Please try again.');
      } else if (err.code === 'auth/too-many-requests') {
        setError('Access temporarily disabled due to many failed attempts. Try resetting your password.');
      } else {
        setError('Failed to log in. Please check your credentials.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleOpenResetDialog = (e) => {
    e?.currentTarget?.blur(); // release focus before the dialog hides the page from screen readers
    setResetEmail(email); // Pre-fill with main login email field value if typed
    setResetError('');
    setResetSuccess('');
    setResetOpen(true);
  };

  const handleCloseResetDialog = () => {
    if (!resetLoading) {
      setResetOpen(false);
    }
  };

  const handleSendPasswordReset = async (e) => {
    e.preventDefault();
    setResetError('');
    setResetSuccess('');

    if (!resetEmail || !resetEmail.trim()) {
      setResetError('Please enter your email address.');
      return;
    }

    setResetLoading(true);

    try {
      await sendPasswordResetEmail(auth, resetEmail.trim());
      setResetSuccess('Password reset link sent! Check your inbox (and spam folder) for instructions.');
    } catch (err) {
      console.error('Password reset error:', err);
      if (err.code === 'auth/user-not-found') {
        setResetError('No account found with this email address.');
      } else if (err.code === 'auth/invalid-email') {
        setResetError('Please enter a valid email address.');
      } else if (err.code === 'auth/too-many-requests') {
        setResetError('Too many requests. Please wait a moment before trying again.');
      } else {
        setResetError('Failed to send reset link. Please check your email and try again.');
      }
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Welcome to KwartoKeeper!"
      subtitle="KwartoKeeper tracks who's in and who's out, in real time, so property owners and caretakers always know their dormitory is safe."
      lit={LIT_PATTERN}
    >
      <FormHeading title="Log in to your account" subtitle="Enter your credentials to manage or view your space." />

      {error && <Alert severity="error" sx={{ mb: 3, borderRadius: '10px' }}>{error}</Alert>}

      <Box component="form" onSubmit={handleLogin} noValidate sx={{ display: 'grid', gap: 2.25 }}>
        <TextField
          required
          fullWidth
          id="email"
          label="Email address"
          name="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          autoFocus
          sx={fieldSx}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <MailOutlineRounded />
                </InputAdornment>
              ),
            },
            htmlInput: { inputMode: 'email', autoCapitalize: 'none' },
          }}
        />

        <TextField
          required
          fullWidth
          name="password"
          label="Password"
          type={showPassword ? 'text' : 'password'}
          id="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          sx={fieldSx}
          slotProps={{
            input: {
              startAdornment: (
                <InputAdornment position="start">
                  <LockOutlined />
                </InputAdornment>
              ),
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    onClick={() => setShowPassword(!showPassword)}
                    edge="end"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment>
              ),
            },
          }}
        />

        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1, mt: -0.5 }}>
          <FormControlLabel
            control={
              <Checkbox
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                color="primary"
                size="small"
              />
            }
            label={<Typography variant="body2" color="text.secondary">Remember me</Typography>}
          />
          <Link
            component="button"
            type="button"
            variant="body2"
            underline="hover"
            color="primary"
            onClick={handleOpenResetDialog}
            sx={{ fontWeight: 600 }}
          >
            Forgot password?
          </Link>
        </Box>

        <Button
          type="submit"
          fullWidth
          variant="contained"
          size="large"
          disabled={loading}
          endIcon={loading ? null : <ArrowForwardRounded />}
          sx={primaryButtonSx}
        >
          {loading ? <CircularProgress size={24} color="inherit" /> : 'Log in'}
        </Button>

        <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center' }}>
          Caretaker or tenant? Use the login details your owner sent you.
        </Typography>

        <Divider sx={{ typography: 'body2', color: 'text.secondary', my: 0.5 }}>or</Divider>

        <Box sx={{ p: 2.25, borderRadius: '14px', bgcolor: 'background.paper', textAlign: 'center' }}>
          <Typography variant="body2" color="text.primary" sx={{ fontWeight: 600, mb: 1.5 }}>
            Don't have an owner account?
          </Typography>
          <Button
            type="button"
            fullWidth
            variant="outlined"
            size="large"
            onClick={() => navigate('/signup')}
            sx={{ py: 1.25, fontWeight: 700, borderRadius: '10px', bgcolor: '#fff', borderWidth: 1.5, '&:hover': { borderWidth: 1.5 } }}
          >
            Register your property
          </Button>
        </Box>
      </Box>

      {/* Forgot Password Dialog */}
      <Dialog
        open={resetOpen}
        onClose={handleCloseResetDialog}
        fullWidth
        maxWidth="xs"
        slotProps={{ paper: { sx: { borderRadius: '20px', m: 2, width: 'calc(100% - 32px)' } } }}
      >
        <Box component="form" onSubmit={handleSendPasswordReset} noValidate>
          <DialogTitle sx={{ fontFamily: '"Inter", sans-serif', fontWeight: 800, pb: 1 }}>Reset Password</DialogTitle>
          <DialogContent>
            <DialogContentText sx={{ mb: 2 }}>
              Enter the email address associated with your KwartoKeeper account, and we'll send you a link to reset your password.
            </DialogContentText>

            {resetError && <Alert severity="error" sx={{ mb: 2, borderRadius: '10px' }}>{resetError}</Alert>}
            {resetSuccess && <Alert severity="success" sx={{ mb: 2, borderRadius: '10px' }}>{resetSuccess}</Alert>}

            {!resetSuccess && (
              <TextField
                autoFocus
                margin="dense"
                id="resetEmail"
                label="Email address"
                type="email"
                fullWidth
                variant="outlined"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                required
                disabled={resetLoading}
                sx={fieldSx}
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <MailOutlineRounded />
                      </InputAdornment>
                    ),
                  },
                }}
              />
            )}
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2.5, gap: 1 }}>
            <Button onClick={handleCloseResetDialog} color="inherit" disabled={resetLoading} sx={{ fontWeight: 600 }}>
              {resetSuccess ? 'Close' : 'Cancel'}
            </Button>
            {!resetSuccess && (
              <Button
                type="submit"
                variant="contained"
                disabled={resetLoading}
                sx={{ fontWeight: 700, borderRadius: '10px', boxShadow: 'none' }}
              >
                {resetLoading ? <CircularProgress size={20} color="inherit" /> : 'Send Reset Link'}
              </Button>
            )}
          </DialogActions>
        </Box>
      </Dialog>
    </AuthLayout>
  );
}
