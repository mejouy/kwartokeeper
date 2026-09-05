import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Box, Button, TextField, Typography, Container, Link, 
  InputAdornment, IconButton, Alert, CircularProgress,
  FormControlLabel, Checkbox, Divider
} from '@mui/material';
import { Visibility, VisibilityOff } from '@mui/icons-material';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../../config/firebase';

export default function Login() {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [rememberMe, setRememberMe] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const data = new FormData(e.currentTarget);
    const email = data.get('email');
    const password = data.get('password');

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      const userDocRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userDocRef);

      if (userDoc.exists()) {
        const userData = userDoc.data();
        if (userData.role === 'owner') navigate('/owner/dashboard');
        else if (userData.role === 'tenant') navigate('/tenant/dashboard');
        else if (userData.role === 'caretaker') navigate('/caretaker/dashboard');
        else setError('Invalid user role assigned.');
      } else {
        navigate('/owner/dashboard'); 
      }
    } catch (err) {
      setError('Failed to log in. Please check your credentials.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container 
      component="main" 
      maxWidth="xs" 
      sx={{ 
        minHeight: '100vh', // Allows scrolling on small screens
        display: 'flex', 
        flexDirection: 'column', 
        justifyContent: 'center',
        py: 6 // Adds padding at the top/bottom when scrolling
      }}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mb: 3 }}>
        <Box 
          component="img" 
          src="/KwartoKeeper-Icon.png" 
          alt="KwartoKeeper Icon" 
          sx={{ height: 70, mb: 2 }} 
        />
        <Typography variant="h5" align="center" color="text.primary" sx={{ fontWeight: 500, mb: 1 }}>
          Welcome to KwartoKEEPER
        </Typography>
        <Typography variant="body2" color="text.secondary" align="center">
          Enter your credentials to manage or view your space.
        </Typography>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Box component="form" onSubmit={handleLogin} sx={{ width: '100%' }}>
        
        <TextField
          margin="normal"
          required
          fullWidth
          id="email"
          label="Email address"
          name="email"
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
          autoComplete="current-password"
          sx={{ mb: 1 }}
          slotProps={{
            input: {
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton onClick={() => setShowPassword(!showPassword)} edge="end">
                    {showPassword ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment>
              ),
            },
          }}
        />

        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
          <FormControlLabel
            control={
              <Checkbox 
                checked={rememberMe} 
                onChange={(e) => setRememberMe(e.target.checked)} 
                color="primary" 
                size="small" 
              />
            }
            label={<Typography variant="body2" color="text.secondary">Remember Me</Typography>}
          />
          <Link href="#" variant="body2" underline="hover" color="text.secondary">
            Forgot Password
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
            fontWeight: 'bold',
            backgroundColor: '#ff4500', // Forces KwartoKeeper Orange
            '&:hover': {
              backgroundColor: '#e03d00', // Slightly darker orange on hover
            }
          }}
        >
          {loading ? <CircularProgress size={24} color="inherit" /> : 'LOGIN'}
        </Button>

        <Divider sx={{ mb: 3, typography: 'body2', color: 'text.secondary' }}>
          or
        </Divider>

        <Box sx={{ textAlign: 'center' }}>
          <Typography variant="body2" color="text.primary" sx={{ mb: 1.5 }}>
            Don't have an owner account? Register Property
          </Typography>
          <Button
            type="button"
            fullWidth
            variant="outlined"
            size="large"
            onClick={() => navigate('/register')}
            sx={{ py: 1.5, fontWeight: 'bold' }}
          >
            REGISTER
          </Button>
        </Box>
      </Box>
    </Container>
  );
}