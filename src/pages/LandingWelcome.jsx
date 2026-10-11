// src/pages/LandingWelcome.jsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Typography, Button, Container, Card, CardContent, GlobalStyles } from '@mui/material';
import HomeWorkOutlinedIcon from '@mui/icons-material/HomeWorkOutlined';
import SecurityOutlinedIcon from '@mui/icons-material/SecurityOutlined';
import PhoneAndroidOutlinedIcon from '@mui/icons-material/PhoneAndroidOutlined';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import PeopleAltOutlinedIcon from '@mui/icons-material/PeopleAltOutlined';

/* -------------------------------------------------------------------------
   Animations
   Defined once as global keyframes (works on every MUI version) and referenced
   by name from sx. The reduced-motion rule at the bottom switches everything
   off for people who've asked their phone to cut down on motion.
   ------------------------------------------------------------------------- */
const AnimationStyles = (
  <GlobalStyles
    styles={{
      '@keyframes kkFadeUp': {
        from: { opacity: 0, transform: 'translateY(18px)' },
        to: { opacity: 1, transform: 'none' },
      },
      '@keyframes kkFloat': {
        '0%, 100%': { transform: 'translateY(0)' },
        '50%': { transform: 'translateY(-8px)' },
      },
      '@keyframes kkGlow': {
        '0%, 100%': { opacity: 0.55, transform: 'scale(1)' },
        '50%': { opacity: 1, transform: 'scale(1.12)' },
      },
      '@keyframes kkBob': {
        '0%, 100%': { transform: 'translateY(0)' },
        '50%': { transform: 'translateY(-5px)' },
      },
      '@keyframes kkPop': {
        from: { opacity: 0, transform: 'scale(0.6)' },
        to: { opacity: 1, transform: 'scale(1)' },
      },
      '@keyframes kkWindow': {
        '0%, 100%': { opacity: 0.45 },
        '50%': { opacity: 1 },
      },
      '@media (prefers-reduced-motion: reduce)': {
        '*, *::before, *::after': {
          animationDuration: '0.001ms !important',
          animationIterationCount: '1 !important',
          transitionDuration: '0.001ms !important',
        },
      },
    }}
  />
);

// Staggered entrance used by the hero pieces.
const enter = (delayMs = 0) => ({
  animation: `kkFadeUp 0.75s cubic-bezier(0.2, 0.7, 0.2, 1) ${delayMs}ms both`,
});

// Fades/slides content in the first time it scrolls into view.
function Reveal({ children, delay = 0 }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return undefined;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <Box
      ref={ref}
      sx={{
        height: '100%',
        opacity: visible ? 1 : 0,
        transform: visible ? 'none' : 'translateY(24px)',
        transition: `opacity 0.6s ease ${delay}ms, transform 0.6s cubic-bezier(0.2, 0.7, 0.2, 1) ${delay}ms`,
      }}
    >
      {children}
    </Box>
  );
}

/* -------------------------------------------------------------------------
   Dorm facade — same illustration as the login page. Windows pop in one by
   one like a building lighting up, then the occupied (orange) ones keep a
   slow, uneven glow so it feels "live".
   ------------------------------------------------------------------------- */
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
      style={{ maxWidth: 210, display: 'block' }}
      role="img"
      aria-label="Illustration of a dormitory building at night, with some rooms lit to show occupancy"
    >
      {windows.map((win, i) => {
        const popDelay = 400 + i * 28;
        return (
          <rect
            key={i}
            x={win.x}
            y={win.y}
            width={win.size}
            height={win.size}
            rx={4}
            fill={win.lit ? '#ff4500' : 'rgba(202, 220, 246, 0.16)'}
            style={{
              transformBox: 'fill-box',
              transformOrigin: 'center',
              animation: win.lit
                ? `kkPop 0.5s ease-out ${popDelay}ms both, kkWindow ${3 + (i % 4) * 0.8}s ease-in-out ${popDelay + 700}ms infinite`
                : `kkPop 0.5s ease-out ${popDelay}ms both`,
            }}
          />
        );
      })}
    </svg>
  );
}

const FEATURES = [
  {
    icon: HomeWorkOutlinedIcon,
    title: 'Multi-Property Setup',
    description: 'Configure floors, rooms, and individual bed assignments easily using interactive wizards.',
  },
  {
    icon: PhoneAndroidOutlinedIcon,
    title: 'Mobile Optimized',
    description: 'Access everything seamlessly right from your phone while on the go or checking properties.',
  },
  {
    icon: SecurityOutlinedIcon,
    title: 'Secure & Reliable',
    description: 'Backed by Firebase infrastructure to keep your tenant and property records secure.',
  },
];

export default function LandingWelcome() {
  const navigate = useNavigate();

  return (
    <Box
      sx={{
        minHeight: '100vh',
        bgcolor: 'background.default',
        display: 'flex',
        flexDirection: 'column',
        // The glow below is wider than a phone screen — without this it
        // causes sideways scrolling on mobile.
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {AnimationStyles}

      {/* Ambient glow */}
      <Box
        sx={{
          position: 'absolute',
          top: -120,
          left: '50%',
          transform: 'translateX(-50%)',
          width: { xs: 420, sm: 760 },
          height: { xs: 420, sm: 760 },
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255, 69, 0, 0.1), transparent 70%)',
          pointerEvents: 'none',
        }}
      />

      {/* Top navigation */}
      <Container
        maxWidth="lg"
        sx={{
          pt: { xs: 2, sm: 3 },
          pb: 1,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 1,
          position: 'relative',
          zIndex: 1,
        }}
      >
        <Box
          component="img"
          src="/KwartoKeeper-Primary-Logo.png"
          alt="KwartoKeeper"
          sx={{ display: 'block', height: { xs: 32, sm: 38 }, width: 'auto', flexShrink: 0 }}
        />
        <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
          <Button
            variant="text"
            size="small"
            onClick={() => navigate('/login')}
            sx={{ fontWeight: 600, color: 'text.primary', textTransform: 'none', minWidth: 0, px: 1.5 }}
          >
            Log in
          </Button>
          <Button
            variant="contained"
            size="small"
            onClick={() => navigate('/signup')}
            sx={{ fontWeight: 600, textTransform: 'none', px: { xs: 1.75, sm: 2 }, borderRadius: 2, whiteSpace: 'nowrap' }}
          >
            Get Started
          </Button>
        </Box>
      </Container>

      <Container maxWidth="lg" sx={{ py: { xs: 4, md: 9 }, position: 'relative', zIndex: 1, flexGrow: 1 }}>

        {/* Hero — one centered column on phones; text-left / visual-right
            from md up. The brand icon lives on the dark panel (not stacked
            above the headline) so the call-to-action stays above the fold. */}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: '1.1fr 0.9fr' },
            gap: { xs: 7, md: 8 },
            alignItems: 'center',
          }}
        >
          {/* Text column */}
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: { xs: 'center', md: 'flex-start' },
              textAlign: { xs: 'center', md: 'left' },
            }}
          >
            <Box
              sx={{
                bgcolor: 'rgba(255, 69, 0, 0.08)',
                color: 'primary.main',
                px: 2,
                py: 0.6,
                borderRadius: 10,
                fontSize: '0.8rem',
                fontWeight: 700,
                mb: 2.5,
                ...enter(0),
              }}
            >
              For Dormitory &amp; Property Owners
            </Box>

            {/* Two-tier headline: the brand intro is the big line, the value
                proposition sits under it at a readable size. */}
            <Typography
              variant="h1"
              sx={{ fontFamily: '"Inter", sans-serif', fontWeight: 900, lineHeight: 1.1, mb: 2.5, ...enter(100) }}
            >
              <Box
                component="span"
                sx={{
                  display: 'block',
                  color: 'primary.main',
                  letterSpacing: '-0.02em',
                  fontSize: { xs: 'clamp(1.8rem, 7.6vw, 2.3rem)', sm: '2.9rem', md: 'clamp(2.4rem, 4.2vw, 3.4rem)' },
                }}
              >
                Meet KwartoKeeper.
              </Box>
              <Box
                component="span"
                sx={{
                  display: 'block',
                  mt: 1.25,
                  color: 'text.primary',
                  fontWeight: 700,
                  lineHeight: 1.25,
                  textWrap: 'balance',
                  fontSize: { xs: '1.3rem', sm: '1.6rem', md: '1.9rem' },
                }}
              >
                Effortless management for your properties and spaces.
              </Box>
            </Typography>

            <Typography
              variant="body1"
              color="text.secondary"
              sx={{
                fontSize: { xs: '1rem', sm: '1.08rem' },
                maxWidth: 440,
                mb: 4,
                lineHeight: 1.65,
                ...enter(220),
              }}
            >
              Track rooms, beds, and tenants in one place — designed phone-first, just as comfortable on desktop.
            </Typography>

            <Box
              sx={{
                display: 'flex',
                flexDirection: { xs: 'column', sm: 'row' },
                gap: 1.5,
                width: { xs: '100%', sm: 'auto' },
                maxWidth: { xs: 360, sm: 'none' },
                ...enter(340),
              }}
            >
              <Button
                variant="contained"
                size="large"
                endIcon={<ArrowForwardIcon />}
                onClick={() => navigate('/signup')}
                sx={{
                  py: 1.4,
                  px: 3.5,
                  fontWeight: 700,
                  borderRadius: 2.5,
                  fontSize: '1rem',
                  transition: 'transform 0.12s ease',
                  '&:active': { transform: 'scale(0.98)' },
                }}
              >
                Create an Account
              </Button>
              <Button
                variant="outlined"
                size="large"
                onClick={() => navigate('/login')}
                sx={{
                  py: 1.4,
                  px: 3.5,
                  fontWeight: 700,
                  borderRadius: 2.5,
                  fontSize: '1rem',
                  borderColor: 'divider',
                  color: 'text.primary',
                  transition: 'transform 0.12s ease',
                  '&:active': { transform: 'scale(0.98)' },
                }}
              >
                Sign In
              </Button>
            </Box>
          </Box>

          {/* Visual column — brand icon on top, building below, live chip
              straddling the bottom edge. Bottom padding is sized so the chip
              clears the last row of windows instead of covering one. */}
          <Box sx={{ width: '100%', maxWidth: { xs: 380, md: 'none' }, mx: 'auto', pb: 3, ...enter(200) }}>
            <Box
              sx={{
                position: 'relative',
                bgcolor: '#202020',
                borderRadius: 4,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 3,
                pt: 4,
                px: 4,
                pb: 8,
              }}
            >
              <Box sx={{ position: 'relative', display: 'inline-flex' }}>
                <Box
                  sx={{
                    position: 'absolute',
                    inset: -28,
                    borderRadius: '50%',
                    background: 'radial-gradient(circle, rgba(255, 69, 0, 0.35), transparent 68%)',
                    animation: 'kkGlow 3.6s ease-in-out infinite',
                  }}
                />
                <Box
                  component="img"
                  src="/KwartoKeeper-DarkMode-Icon.png"
                  alt=""
                  aria-hidden="true"
                  sx={{
                    position: 'relative',
                    display: 'block',
                    height: { xs: 40, md: 46 },
                    width: 'auto',
                    animation: 'kkFloat 4.2s ease-in-out infinite',
                  }}
                />
              </Box>

              <DormFacade />

              {/* Outer box positions, inner box bobs, so the transforms
                  don't fight each other. */}
              <Box
                sx={{
                  position: 'absolute',
                  bottom: -22,
                  left: { xs: '50%', md: 24 },
                  transform: { xs: 'translateX(-50%)', md: 'none' },
                }}
              >
                <Box
                  sx={{
                    bgcolor: 'background.paper',
                    borderRadius: 3,
                    px: 2.25,
                    py: 1.25,
                    boxShadow: '0 16px 32px rgba(0, 0, 0, 0.18)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5,
                    whiteSpace: 'nowrap',
                    animation: 'kkBob 3.8s ease-in-out infinite',
                  }}
                >
                  <Box
                    sx={{
                      width: 34,
                      height: 34,
                      borderRadius: '50%',
                      bgcolor: 'rgba(255, 69, 0, 0.12)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <PeopleAltOutlinedIcon sx={{ fontSize: 17, color: 'primary.main' }} />
                  </Box>
                  <Box sx={{ textAlign: 'left' }}>
                    <Typography sx={{ fontFamily: '"Inter", sans-serif', fontWeight: 800, fontSize: '1.05rem', lineHeight: 1.1, color: 'text.primary' }}>
                      Live occupancy
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Tracked bed-by-bed
                    </Typography>
                  </Box>
                </Box>
              </Box>
            </Box>
          </Box>
        </Box>

        {/* Feature highlights — one centered column on phones, three across
            from `sm` up. Each card fades in as it scrolls into view. */}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, 1fr)' },
            gap: 2.5,
            mt: { xs: 6, md: 9 },
          }}
        >
          {FEATURES.map(({ icon: Icon, title, description }, i) => (
            <Reveal key={title} delay={i * 110}>
              <Card
                elevation={0}
                sx={{
                  height: '100%',
                  bgcolor: 'background.paper',
                  borderRadius: 3,
                  transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                  '@media (hover: hover)': {
                    '&:hover': { transform: 'translateY(-3px)', boxShadow: '0 10px 24px rgba(0,0,0,0.07)' },
                  },
                }}
              >
                <CardContent sx={{ p: 3, textAlign: { xs: 'center', sm: 'left' } }}>
                  <Box
                    sx={{
                      width: 44,
                      height: 44,
                      borderRadius: 2,
                      bgcolor: 'rgba(255, 69, 0, 0.1)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'primary.main',
                      mb: 2,
                      mx: { xs: 'auto', sm: 0 },
                    }}
                  >
                    <Icon fontSize="small" />
                  </Box>
                  <Typography
                    variant="subtitle1"
                    sx={{ fontFamily: '"Inter", sans-serif', fontWeight: 700, mb: 1, color: 'text.primary' }}
                  >
                    {title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {description}
                  </Typography>
                </CardContent>
              </Card>
            </Reveal>
          ))}
        </Box>
      </Container>

      {/* Footer */}
      <Box
        sx={{
          pt: 4,
          pb: 'calc(32px + env(safe-area-inset-bottom, 0px))',
          textAlign: 'center',
          borderTop: '1px solid',
          borderColor: 'divider',
          position: 'relative',
          zIndex: 1,
        }}
      >
        <Box
          component="img"
          src="/KwartoKeeper-Icon.png"
          alt="KwartoKeeper"
          sx={{ display: 'block', height: 64, width: 'auto', mx: 'auto', mb: 1.5, opacity: 0.9 }}
        />
        <Typography variant="caption" color="text.secondary" display="block">
          &copy; {new Date().getFullYear()} KwartoKeeper. All rights reserved.
        </Typography>
      </Box>
    </Box>
  );
}