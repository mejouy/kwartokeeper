// src/pages/LandingWelcome.jsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Typography, Button, Container, Grid, Card, CardContent } from '@mui/material';
import HomeWorkOutlinedIcon from '@mui/icons-material/HomeWorkOutlined';
import SecurityOutlinedIcon from '@mui/icons-material/SecurityOutlined';
import PhoneAndroidOutlinedIcon from '@mui/icons-material/PhoneAndroidOutlined';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';

export default function LandingWelcome() {
  const navigate = useNavigate();

  return (
    <Box
      sx={{
        minHeight: "100vh",
        bgcolor: "#f8f9fa",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Background soft ambient glow */}
      <Box
        sx={{
          position: "absolute",
          top: -100,
          left: "50%",
          transform: "translateX(-50%)",
          width: { xs: 400, sm: 700 },
          height: { xs: 400, sm: 700 },
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(255, 69, 0, 0.08), transparent 70%)",
          pointerEvents: "none",
        }}
      />

      {/* Top Navigation Bar / Header */}
      <Container maxWidth="md" sx={{ pt: 3, pb: 1, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
          <Box 
            component="img" 
            src="/KwartoKeeper-DarkMode-Icon.png" 
            alt="KwartoKeeper Logo" 
            sx={{ height: 32, filter: 'invert(1)' }} 
          />
          <Typography variant="subtitle1" sx={{ fontWeight: 800, color: "text.primary", letterSpacing: "-0.5px" }}>
            KwartoKeeper
          </Typography>
        </Box>
        <Box sx={{ display: "flex", gap: 1 }}>
          <Button 
            variant="text" 
            size="small" 
            onClick={() => navigate('/login')}
            sx={{ fontWeight: 600, color: "text.primary", textTransform: "none" }}
          >
            Log in
          </Button>
          <Button 
            variant="contained" 
            size="small" 
            onClick={() => navigate('/signup')}
            sx={{ fontWeight: 600, textTransform: "none", px: 2, borderRadius: 2 }}
          >
            Get Started
          </Button>
        </Box>
      </Container>

      {/* Hero Section */}
      <Container maxWidth="md" sx={{ textAlign: "center", py: { xs: 4, md: 8 }, zIndex: 1 }}>
        <Box 
          sx={{ 
            display: "inline-block", 
            bgcolor: "rgba(255, 69, 0, 0.08)", 
            color: "primary.main", 
            px: 2, 
            py: 0.5, 
            borderRadius: 10, 
            fontSize: "0.8rem", 
            fontWeight: 700, 
            mb: 2 
          }}
        >
          Smart Dorm & Property Management
        </Box>

        <Typography 
          variant="h2" 
          sx={{ 
            fontFamily: '"Inter", sans-serif', 
            fontWeight: 900, 
            color: "text.primary", 
            fontSize: { xs: '2rem', sm: '3rem', md: '3.5rem' },
            lineHeight: 1.2,
            mb: 2 
          }}
        >
          Effortless management for your <span style={{ color: '#ff4500' }}>properties and spaces</span>.
        </Typography>

        <Typography 
          variant="body1" 
          color="text.secondary" 
          sx={{ 
            fontSize: { xs: '1rem', sm: '1.15rem' }, 
            maxWidth: 600, 
            mx: "auto", 
            mb: 4, 
            lineHeight: 1.6 
          }}
        >
          KwartoKeeper simplifies room layouts, bed occupancy tracking, and tenant monitoring—all optimized for desktop and mobile use.
        </Typography>

        {/* Mobile-Friendly Call to Actions */}
        <Box 
          sx={{ 
            display: "flex", 
            flexDirection: { xs: "column", sm: "row" }, 
            gap: 2, 
            justifyContent: "center", 
            maxWidth: 400, 
            mx: "auto",
            mb: 6 
          }}
        >
          <Button
            variant="contained"
            size="large"
            fullWidth
            endIcon={<ArrowForwardIcon />}
            onClick={() => navigate('/signup')}
            sx={{ py: 1.5, fontWeight: 700, borderRadius: 2.5, fontSize: "1rem" }}
          >
            Create an Account
          </Button>
          <Button
            variant="outlined"
            size="large"
            fullWidth
            onClick={() => navigate('/login')}
            sx={{ py: 1.5, fontWeight: 700, borderRadius: 2.5, fontSize: "1rem", borderColor: "divider", color: "text.primary" }}
          >
            Sign In
          </Button>
        </Box>

        {/* Feature Highlights Grid */}
        <Grid container spacing={2} sx={{ textAlign: "left", mt: 2 }}>
          <Grid item xs={12} sm={4}>
            <Card sx={{ height: "100%", bgcolor: "#ffffff", border: "1px solid", borderColor: "divider", boxShadow: "none", borderRadius: 3 }}>
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ width: 40, height: 40, borderRadius: 2, bgcolor: "rgba(255, 69, 0, 0.1)", display: "flex", alignItems: "center", justifyContent: "center", color: "primary.main", mb: 2 }}>
                  <HomeWorkOutlinedIcon fontSize="small" />
                </Box>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1, color: "text.primary" }}>
                  Multi-Property Setup
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Configure floors, rooms, and individual bed assignments easily using interactive wizards.
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={4}>
            <Card sx={{ height: "100%", bgcolor: "#ffffff", border: "1px solid", borderColor: "divider", boxShadow: "none", borderRadius: 3 }}>
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ width: 40, height: 40, borderRadius: 2, bgcolor: "rgba(202, 220, 246, 0.4)", display: "flex", alignItems: "center", justifyContent: "center", color: "primary.dark", mb: 2 }}>
                  <PhoneAndroidOutlinedIcon fontSize="small" />
                </Box>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1, color: "text.primary" }}>
                  Mobile Optimized
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Access everything seamlessly right from your phone while on the go or checking properties.
                </Typography>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} sm={4}>
            <Card sx={{ height: "100%", bgcolor: "#ffffff", border: "1px solid", borderColor: "divider", boxShadow: "none", borderRadius: 3 }}>
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ width: 40, height: 40, borderRadius: 2, bgcolor: "rgba(46, 125, 50, 0.1)", display: "flex", alignItems: "center", justifyContent: "center", color: "success.main", mb: 2 }}>
                  <SecurityOutlinedIcon fontSize="small" />
                </Box>
                <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1, color: "text.primary" }}>
                  Secure & Reliable
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Backed by Firebase infrastructure to keep your tenant and property records secure.
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Container>

      {/* Footer */}
      <Box sx={{ py: 3, textAlign: "center", borderTop: "1px solid", borderColor: "divider", mt: 4 }}>
        <Typography variant="caption" color="text.secondary">
          &copy; {new Date().getFullYear()} KwartoKeeper. All rights reserved.
        </Typography>
      </Box>
    </Box>
  );
}