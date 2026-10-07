import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Button, TextField, Typography, Link,
  InputAdornment, IconButton, Alert, CircularProgress,
  FormControlLabel, Checkbox, Divider,
  Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions
} from '@mui/material';
import { Visibility, VisibilityOff } from '@mui/icons-material';
import {
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence
} from 'firebase/auth';
import { doc, getDoc, collection, getDocs } from 'firebase/firestore';
import { auth, db } from '../../config/firebase';

const FACADE_ROWS = 6;
const FACADE_COLS = 5;
const LIT_PATTERN = [
  1, 0, 0, 1, 0,
  0, 0, 1, 0, 0,
  1, 0, 0, 0, 1,
  0, 1, 0, 0, 0,
  0, 0, 1, 0, 1,
  1, 0, 0, 1, 0,
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
      style={{ maxWidth: 300, display: 'block' }}
      role="img"
      aria-label="Illustration of a dormitory building at night, with some rooms lit to show occupancy"
    >
      {windows.map((win, i) => (
        <rect
          key={i}
          x={win.x}
          y={win.y}
          width={win.size}
          height={win.size}
          rx={4}
          fill={win.lit ? '#ff4500' : 'rgba(202, 220, 246, 0.16)'}
          opacity={win.lit ? 0.92 : 1}
        />
      ))}
    </svg>
  );
}

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

  const handleOpenResetDialog = () => {
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
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: { xs: 'column', md: 'row' } }}>

      {/* Left panel */}
      <Box
        sx={{
          flex: { xs: '0 0 auto', md: '0 0 42%' },
          bgcolor: '#202020',
          color: '#ffffff',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: { xs: 'flex-start', md: 'center' },
          alignItems: 'flex-start',
          px: { xs: 4, md: 8 },
          py: { xs: 4, md: 0 },
          gap: 4,
        }}
      >
        <Box
          component="img"
          src="/KwartoKeeper-DarkMode-Icon.png"
          alt="KwartoKeeper"
          sx={{ height: 40, display: { xs: 'none', md: 'block' } }}
        />

        <Box sx={{ display: { xs: 'none', md: 'block' } }}>
          <DormFacade />
        </Box>

        <Box>
          <Typography
            variant="h4"
            sx={{ fontFamily: '"Inter", sans-serif', fontWeight: 900, color: '#ffffff', lineHeight: 1.15, mb: 1.5 }}
          >
            Welcome to KwartoKeeper!
          </Typography>
          <Typography variant="body1" sx={{ color: '#cadcf6', maxWidth: 340 }}>
            KwartoKeeper tracks who's in and who's out, in real time, so property owners and caretakers always know their dormitory is safe.
          </Typography>
        </Box>
      </Box>

      {/* Right panel — form */}
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          px: 3,
          py: { xs: 5, md: 6 },
        }}
      >
        <Box sx={{ width: '100%', maxWidth: 380 }}>

          <Typography variant="h5" color="text.primary" sx={{ fontWeight: 600, mb: 0.5 }}>
            Log in to your account
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 4 }}>
            Enter your credentials to manage or view your space.
          </Typography>

          {error && <Alert severity="error" sx={{ mb: 3 }}>{error}</Alert>}

          <Box component="form" onSubmit={handleLogin} noValidate>

            <TextField
              margin="normal"
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
              sx={{ mb: 2 }}
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
              sx={{ mb: 1 }}
              slotProps={{
                input: {
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

            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
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
                sx={{ fontWeight: 500 }}
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
              sx={{
                mb: 3,
                py: 1.5,
                fontWeight: 600,
                backgroundColor: 'primary.main',
                '&:hover': { backgroundColor: 'primary.dark' },
              }}
            >
              {loading ? <CircularProgress size={24} color="inherit" /> : 'Log in'}
            </Button>

            <Divider sx={{ mb: 3, typography: 'body2', color: 'text.secondary' }}>or</Divider>

            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="body2" color="text.primary" sx={{ mb: 1.5 }}>
                Don't have an owner account?
              </Typography>
              <Button
                type="button"
                fullWidth
                variant="outlined"
                size="large"
                onClick={() => navigate('/signup')}
                sx={{ py: 1.5, fontWeight: 600 }}
              >
                Register your property
              </Button>
            </Box>

          </Box>
        </Box>
      </Box>

      {/* Forgot Password Dialog */}
      <Dialog
        open={resetOpen}
        onClose={handleCloseResetDialog}
        fullWidth
        maxWidth="xs"
      >
        <Box component="form" onSubmit={handleSendPasswordReset} noValidate>
          <DialogTitle sx={{ fontWeight: 700 }}>Reset Password</DialogTitle>
          <DialogContent>
            <DialogContentText sx={{ mb: 2 }}>
              Enter the email address associated with your KwartoKeeper account, and we'll send you a link to reset your password.
            </DialogContentText>

            {resetError && <Alert severity="error" sx={{ mb: 2 }}>{resetError}</Alert>}
            {resetSuccess && <Alert severity="success" sx={{ mb: 2 }}>{resetSuccess}</Alert>}

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
              />
            )}
          </DialogContent>
          <DialogActions sx={{ px: 3, pb: 2.5 }}>
            <Button onClick={handleCloseResetDialog} color="inherit" disabled={resetLoading}>
              {resetSuccess ? 'Close' : 'Cancel'}
            </Button>
            {!resetSuccess && (
              <Button
                type="submit"
                variant="contained"
                disabled={resetLoading}
              >
                {resetLoading ? <CircularProgress size={20} color="inherit" /> : 'Send Reset Link'}
              </Button>
            )}
          </DialogActions>
        </Box>
      </Dialog>

    </Box>
  );
}