// src/pages/LandingWelcome.jsx
import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Typography, Button, Container, Grid, Card, CardContent } from '@mui/material';
import HomeWorkOutlinedIcon from '@mui/icons-material/HomeWorkOutlined';
import SecurityOutlinedIcon from '@mui/icons-material/SecurityOutlined';
import PhoneAndroidOutlinedIcon from '@mui/icons-material/PhoneAndroidOutlined';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import PeopleAltOutlinedIcon from '@mui/icons-material/PeopleAltOutlined';

// Same facade illustration used on the login page — reused here (not
// redrawn from scratch) so the hero visually matches the rest of the app
// instead of introducing a one-off graphic.
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
    const gap = 16;
    const size = 30;
    for (let row = 0; row < FACADE_ROWS; row++) {
      for (let col = 0; col < FACADE_COLS; col++) {
        const idx = row * FACADE_COLS + col;
        w.push({ x: col * (size + gap), y: row * (size + gap), lit: LIT_PATTERN[idx] === 1, size });
      }
    }
    return w;
  }, []);

  const width = FACADE_COLS * (30 + 16) - 16;
  const height = FACADE_ROWS * (30 + 16) - 16;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width="100%"
      style={{ maxWidth: 240, display: "block" }}
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

const FEATURES = [
  {
    icon: HomeWorkOutlinedIcon,
    title: "Multi-Property Setup",
    description: "Configure floors, rooms, and individual bed assignments easily using interactive wizards.",
  },
  {
    icon: PhoneAndroidOutlinedIcon,
    title: "Mobile Optimized",
    description: "Access everything seamlessly right from your phone while on the go or checking properties.",
  },
  {
    icon: SecurityOutlinedIcon,
    title: "Secure & Reliable",
    description: "Backed by Firebase infrastructure to keep your tenant and property records secure.",
  },
];

export default function LandingWelcome() {
  const navigate = useNavigate();

  return (
    <Box sx={{ minHeight: "100vh", bgcolor: "background.default", display: "flex", flexDirection: "column" }}>

      {/* Ambient glow, same device used on the success screen — ties the
          two together without repeating a literal graphic. */}
      <Box
        sx={{
          position: "absolute",
          top: -120,
          left: "50%",
          transform: "translateX(-50%)",
          width: { xs: 420, sm: 760 },
          height: { xs: 420, sm: 760 },
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(255, 69, 0, 0.1), transparent 70%)",
          pointerEvents: "none",
        }}
      />

      {/* Top Navigation Bar */}
      <Container maxWidth="lg" sx={{ pt: 3, pb: 1, display: "flex", justifyContent: "space-between", alignItems: "center", position: "relative", zIndex: 1 }}>
        <Box component="img" src="/KwartoKeeper-Logo-Horizontal.png" alt="KwartoKeeper" sx={{ display: "block", height: 34 }} />
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

      {/* Hero — text on one side, a product-preview visual on the other,
          instead of a centered block stacked above a plain feature grid. */}
      <Container maxWidth="lg" sx={{ py: { xs: 5, md: 9 }, zIndex: 1, flexGrow: 1 }}>
        <Grid container spacing={{ xs: 6, md: 4 }} alignItems="center">
          <Grid item xs={12} md={6}>
            <Box
              sx={{
                display: "inline-block",
                bgcolor: "rgba(255, 69, 0, 0.08)",
                color: "primary.main",
                px: 2,
                py: 0.6,
                borderRadius: 10,
                fontSize: "0.8rem",
                fontWeight: 700,
                mb: 2.5,
              }}
            >
              For Dormitory &amp; Property Owners
            </Box>

            <Typography
              variant="h2"
              sx={{
                fontFamily: '"Inter", sans-serif',
                fontWeight: 900,
                color: "text.primary",
                fontSize: { xs: '2.1rem', sm: '2.75rem', md: '3.1rem' },
                lineHeight: 1.15,
                mb: 2.5,
              }}
            >
              Meet{" "}
              <Box component="span" sx={{ color: "primary.main" }}>
                KwartoKeeper
              </Box>
              , effortless management for your properties and spaces.
            </Typography>

            <Typography
              variant="body1"
              color="text.secondary"
              sx={{ fontSize: { xs: '1rem', sm: '1.1rem' }, maxWidth: 480, mb: 4, lineHeight: 1.65 }}
            >
              KwartoKeeper simplifies room layouts, bed occupancy tracking, and tenant monitoring — all optimized for desktop and mobile use.
            </Typography>

            <Box sx={{ display: "flex", flexDirection: { xs: "column", sm: "row" }, gap: 1.5 }}>
              <Button
                variant="contained"
                size="large"
                endIcon={<ArrowForwardIcon />}
                onClick={() => navigate('/signup')}
                sx={{ py: 1.4, px: 3.5, fontWeight: 700, borderRadius: 2.5, fontSize: "1rem" }}
              >
                Create an Account
              </Button>
              <Button
                variant="outlined"
                size="large"
                onClick={() => navigate('/login')}
                sx={{ py: 1.4, px: 3.5, fontWeight: 700, borderRadius: 2.5, fontSize: "1rem", borderColor: "divider", color: "text.primary" }}
              >
                Sign In
              </Button>
            </Box>
          </Grid>

          {/* Product-preview visual: the facade illustration on a dark
              panel, with a floating stat chip for a touch of real-feeling
              product proof rather than a static picture. */}
          <Grid item xs={12} md={6}>
            <Box
              sx={{
                position: "relative",
                bgcolor: "#202020",
                borderRadius: 4,
                minHeight: { xs: 240, md: 320 },
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                p: 4,
                mx: { xs: 2, md: 0 },
                mb: { xs: 3, md: 0 },
              }}
            >
              <DormFacade />

              <Box
                sx={{
                  position: "absolute",
                  bottom: -18,
                  left: { xs: 16, md: -18 },
                  bgcolor: "background.paper",
                  borderRadius: 3,
                  px: 2.25,
                  py: 1.25,
                  boxShadow: "0 16px 32px rgba(0, 0, 0, 0.18)",
                  display: "flex",
                  alignItems: "center",
                  gap: 1.5,
                }}
              >
                <Box
                  sx={{
                    width: 34,
                    height: 34,
                    borderRadius: "50%",
                    bgcolor: "rgba(255, 69, 0, 0.12)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <PeopleAltOutlinedIcon sx={{ fontSize: 17, color: "primary.main" }} />
                </Box>
                <Box>
                  <Typography sx={{ fontFamily: '"Inter", sans-serif', fontWeight: 800, fontSize: "1.05rem", lineHeight: 1.1, color: "text.primary" }}>
                    Live occupancy
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Tracked bed-by-bed
                  </Typography>
                </Box>
              </Box>
            </Box>
          </Grid>
        </Grid>

        {/* Feature Highlights */}
        <Grid container spacing={2.5} sx={{ mt: { xs: 5, md: 7 } }}>
          {FEATURES.map(({ icon: Icon, title, description }) => (
            <Grid item xs={12} sm={4} key={title}>
              <Card
                elevation={0}
                sx={{
                  height: "100%",
                  bgcolor: "background.paper",
                  borderRadius: 3,
                  transition: "transform 0.15s ease, box-shadow 0.15s ease",
                  "&:hover": { transform: "translateY(-2px)", boxShadow: "0 10px 24px rgba(0,0,0,0.06)" },
                }}
              >
                <CardContent sx={{ p: 3 }}>
                  <Box
                    sx={{
                      width: 40,
                      height: 40,
                      borderRadius: 2,
                      bgcolor: "rgba(255, 69, 0, 0.1)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "primary.main",
                      mb: 2,
                    }}
                  >
                    <Icon fontSize="small" />
                  </Box>
                  <Typography
                    variant="subtitle1"
                    sx={{ fontFamily: '"Inter", sans-serif', fontWeight: 700, mb: 1, color: "text.primary" }}
                  >
                    {title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {description}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Container>

      {/* Footer */}
      <Box sx={{ py: 4, textAlign: "center", borderTop: "1px solid", borderColor: "divider", position: "relative", zIndex: 1 }}>
        <Box
          component="img"
          src="/KwartoKeeper-Logo-Square.png"
          alt="KwartoKeeper"
          sx={{ display: "block", height: 40, mx: "auto", mb: 1.5, opacity: 0.9 }}
        />
        <Typography variant="caption" color="text.secondary" display="block">
          &copy; {new Date().getFullYear()} KwartoKeeper. All rights reserved.
        </Typography>
      </Box>
    </Box>
  );
}