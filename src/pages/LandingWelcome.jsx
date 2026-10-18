// src/pages/LandingWelcome.jsx
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AppBar, Toolbar, Box, Typography, Button, Container, Drawer, IconButton, GlobalStyles, ToggleButton, ToggleButtonGroup } from '@mui/material';
import HomeWorkOutlinedIcon from '@mui/icons-material/HomeWorkOutlined';
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined';
import BuildOutlinedIcon from '@mui/icons-material/BuildOutlined';
import NightsStayOutlinedIcon from '@mui/icons-material/NightsStayOutlined';
import AssessmentOutlinedIcon from '@mui/icons-material/AssessmentOutlined';
import CampaignOutlinedIcon from '@mui/icons-material/CampaignOutlined';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import ApartmentRoundedIcon from '@mui/icons-material/ApartmentRounded';
import HandymanOutlinedIcon from '@mui/icons-material/HandymanOutlined';
import PersonOutlineRoundedIcon from '@mui/icons-material/PersonOutlineRounded';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import MenuRoundedIcon from '@mui/icons-material/MenuRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';

const ORANGE = '#ff4500';
const ORANGE_SOFT = '#ff8a5c';
const INK = '#202020';
const CREAM = '#f2e9dd';
const BLUE = '#cadcf6';
const HEAD = '"Inter", sans-serif';
// One set of corner radii for the whole page
const R = { sm: '10px', md: '14px', lg: '20px', xl: '24px' };

/* -------------------------------------------------------------------------
   Motion
   The hero text rises in and the building's windows light up one by one.
   Sections below fade up once as they scroll into view. The reduced-motion
   rule switches all of it off.
   ------------------------------------------------------------------------- */
const AnimationStyles = (
  <GlobalStyles
    styles={{
      '@keyframes kkFadeUp': {
        from: { opacity: 0, transform: 'translateY(16px)' },
        to: { opacity: 1, transform: 'none' },
      },
      '@keyframes kkPop': {
        from: { opacity: 0, transform: 'scale(0.6)' },
        to: { opacity: 1, transform: 'scale(1)' },
      },
      '@keyframes kkWindow': {
        '0%, 100%': { opacity: 0.6 },
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

const enter = (delayMs = 0) => ({
  animation: `kkFadeUp 0.7s cubic-bezier(0.2, 0.7, 0.2, 1) ${delayMs}ms both`,
});

/* -------------------------------------------------------------------------
   The building. Each window is a room you can tap: lit (orange) means beds
   are taken, dim means vacant. It is sample data, labelled as such, but it
   shows what the product does: every room and bed at a glance.
   Two shapes of the same building: tall for desktop, wide and short for phones.
   ------------------------------------------------------------------------- */
const LAYOUTS = {
  tall: { rows: 6, cols: 5, lit: [1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 1, 0, 1, 1, 0, 0, 1, 0] },
  wide: { rows: 3, cols: 8, lit: [1, 0, 0, 1, 0, 1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 1, 1, 0, 1, 0, 0, 0, 1, 0] },
};
const SIZE = 34;
const GAP = 14;
const LETTERS = 'ABCDEFGH';

const roomInfo = (layout, idx) => {
  const { rows, cols, lit: litList } = LAYOUTS[layout];
  const lit = litList[idx] === 1;
  const name = `Room ${rows - Math.floor(idx / cols)}${LETTERS[idx % cols]}`;
  if (!lit) return { name, lit, line1: 'Vacant', line2: '4 beds open' };
  const taken = [2, 3, 4, 1][idx % 4];
  return { name, lit, line1: `${taken} of 4 beds taken`, line2: idx % 3 === 0 ? 'Rent due in 3 days' : 'Rent paid' };
};

function Building({ layout, selected, onSelect }) {
  const { rows, cols, lit: litList } = LAYOUTS[layout];
  const gridW = cols * (SIZE + GAP) - GAP;
  const gridH = rows * (SIZE + GAP) - GAP;
  const vbW = gridW + 40;
  const lobbyTop = 22 + gridH + 8; // ground floor starts under the last row of windows
  const groundY = lobbyTop + 52;
  const vbH = groundY + 4;
  const doorW = 40;
  const doorH = 36;
  const doorX = vbW / 2 - doorW / 2;
  const doorY = groundY - 3 - doorH;
  const windows = useMemo(
    () => litList.map((lit, idx) => ({ idx, lit, x: 20 + (idx % cols) * (SIZE + GAP), y: 22 + Math.floor(idx / cols) * (SIZE + GAP) })),
    [litList, cols]
  );

  return (
    <Box
      sx={{
        width: '100%',
        maxWidth: layout === 'tall' ? 260 : 'none',
        mx: 'auto',
        '& rect[role="button"]': { cursor: 'pointer', outline: 'none' },
        '& rect[role="button"]:focus-visible': { stroke: '#fff', strokeWidth: 2.5 },
      }}
    >
      <svg viewBox={`0 0 ${vbW} ${vbH}`} width="100%" style={{ display: 'block' }} role="group" aria-label="A sample dormitory building. Select a room to see its details.">
        {/* roof and walls */}
        <rect x="0" y="0" width={vbW} height="8" rx="3" fill="rgba(255,255,255,0.2)" />
        <rect x="6" y="8" width={vbW - 12} height={groundY - 8} fill="rgba(255,255,255,0.05)" />
        {/* ground floor band */}
        <rect x="6" y={lobbyTop} width={vbW - 12} height={groundY - lobbyTop} fill="rgba(255,255,255,0.04)" />
        <rect x="6" y={lobbyTop} width={vbW - 12} height="2" fill="rgba(255,255,255,0.12)" />
        {/* lobby windows on both sides of the entrance */}
        <rect x="20" y={lobbyTop + 12} width={SIZE} height="22" rx="3" fill="rgba(202, 220, 246, 0.16)" />
        <rect x={vbW - 20 - SIZE} y={lobbyTop + 12} width={SIZE} height="22" rx="3" fill="rgba(202, 220, 246, 0.16)" />
        {/* entrance: awning, frame, glass double doors, handles, step */}
        <rect x={doorX - 6} y={doorY - 7} width={doorW + 12} height="5" rx="2" fill={ORANGE} />
        <rect x={doorX} y={doorY} width={doorW} height={doorH} rx="2" fill="rgba(255,255,255,0.22)" />
        <rect x={doorX + 3} y={doorY + 3} width={doorW / 2 - 4} height={doorH - 3} rx="1" fill="rgba(255,138,92,0.35)" />
        <rect x={doorX + doorW / 2 + 1} y={doorY + 3} width={doorW / 2 - 4} height={doorH - 3} rx="1" fill="rgba(255,138,92,0.35)" />
        <rect x={doorX + doorW / 2 - 4} y={doorY + doorH / 2} width="2" height="7" rx="1" fill="rgba(255,255,255,0.85)" />
        <rect x={doorX + doorW / 2 + 2} y={doorY + doorH / 2} width="2" height="7" rx="1" fill="rgba(255,255,255,0.85)" />
        <rect x={doorX - 4} y={groundY - 3} width={doorW + 8} height="3" fill="rgba(255,255,255,0.3)" />
        {/* ground line */}
        <rect x="0" y={groundY} width={vbW} height="4" rx="2" fill="rgba(255,255,255,0.2)" />
        {windows.map((w) => {
          const info = roomInfo(layout, w.idx);
          const popDelay = 350 + w.idx * 26;
          const isSel = selected === w.idx;
          return (
            <rect
              key={w.idx}
              role="button"
              tabIndex={0}
              aria-pressed={isSel}
              aria-label={`${info.name}: ${info.line1}`}
              x={w.x}
              y={w.y}
              width={SIZE}
              height={SIZE}
              rx={4}
              fill={w.lit ? ORANGE : 'rgba(202, 220, 246, 0.16)'}
              stroke={isSel ? '#fff' : 'none'}
              strokeWidth={isSel ? 2.5 : 0}
              onClick={() => onSelect(w.idx)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelect(w.idx);
                }
              }}
              style={{
                transformBox: 'fill-box',
                transformOrigin: 'center',
                animation: w.lit
                  ? `kkPop 0.45s ease-out ${popDelay}ms both, kkWindow ${3.2 + (w.idx % 4) * 0.8}s ease-in-out ${popDelay + 700}ms infinite`
                  : `kkPop 0.45s ease-out ${popDelay}ms both`,
              }}
            />
          );
        })}
      </svg>
    </Box>
  );
}

/** The building plus the room details panel. */
function BuildingCard({ layout }) {
  const [selected, setSelected] = useState(layout === 'tall' ? 7 : 3); // starts on a lit room so the panel never looks empty
  const info = roomInfo(layout, selected);
  const wide = layout === 'wide';
  return (
    <Box sx={{ bgcolor: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: R.lg, p: wide ? 2 : { xs: 3, sm: 3.5 } }}>
      <Building layout={layout} selected={selected} onSelect={setSelected} />
      <Box
        aria-live="polite"
        sx={{ mt: wide ? 2 : 3, borderRadius: R.md, bgcolor: 'rgba(255,255,255,0.07)', px: 2, py: 1.25, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1.5 }}
      >
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontFamily: HEAD, fontWeight: 800, fontSize: '1rem', lineHeight: 1.2 }}>{info.name}</Typography>
          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)' }}>
            {info.line1}
          </Typography>
        </Box>
        <Box
          sx={{
            flexShrink: 0,
            px: 1.25,
            py: 0.5,
            borderRadius: 99,
            fontSize: '0.78rem',
            fontWeight: 700,
            bgcolor: info.lit ? 'rgba(255,69,0,0.2)' : 'rgba(255,255,255,0.1)',
            color: info.lit ? ORANGE_SOFT : 'rgba(255,255,255,0.75)',
          }}
        >
          {info.line2}
        </Box>
      </Box>
      <Typography variant="caption" sx={{ display: 'block', mt: 1.25, textAlign: 'center', color: 'rgba(255,255,255,0.5)' }}>
        Sample building. Tap a room to look inside.
      </Typography>
    </Box>
  );
}

/* -------------------------------------------------------------------------
   Content
   ------------------------------------------------------------------------- */
const NAV = [
  ['features', 'Features'],
  ['roles', 'Who it is for'],
  ['start', 'Getting started'],
];

const FEATURES = [
  {
    icon: HomeWorkOutlinedIcon,
    title: 'Properties, rooms and beds',
    description: 'Set up every floor, room and bed with a guided wizard, then see which beds are taken.',
  },
  {
    icon: PaymentsOutlinedIcon,
    title: 'Rent and receipts',
    description: 'Tenants send proof of payment. You approve it, and they get a numbered receipt.',
  },
  {
    icon: BuildOutlinedIcon,
    title: 'Repair requests',
    description: 'Requests arrive ranked by urgency, so the leaking pipe comes before the loose shelf.',
  },
  {
    icon: NightsStayOutlinedIcon,
    title: 'Curfew and occupancy checks',
    description: 'Caretakers mark each tenant in, late or out from their phone. You see it the same night.',
  },
  {
    icon: AssessmentOutlinedIcon,
    title: 'Reports',
    description: 'Payments, cash receipts, occupancy, repairs and curfew. Save them as a PDF or a CSV.',
  },
  {
    icon: CampaignOutlinedIcon,
    title: 'Notices',
    description: 'Send an announcement to your tenants and caretakers, and they get it in the app.',
  },
];

// Bento layout: column span on desktop and the card's colour scheme
const FEATURE_LOOK = [
  { span: 7, bg: CREAM, fg: INK, icon: ORANGE },
  { span: 5, bg: ORANGE, fg: '#fff', icon: '#fff' },
  { span: 5, bg: BLUE, fg: INK, icon: INK },
  { span: 7, bg: CREAM, fg: INK, icon: ORANGE },
  { span: 6, bg: INK, fg: '#fff', icon: ORANGE_SOFT },
  { span: 6, bg: CREAM, fg: INK, icon: ORANGE },
];

const ROLES = {
  owner: {
    label: 'Owners',
    icon: ApartmentRoundedIcon,
    lead: 'See the whole business without walking the halls.',
    points: [
      'Add properties, rooms and beds',
      'Approve rent payments and send receipts',
      'Handle repair requests in order of urgency',
      'Print or save reports for your records',
    ],
  },
  caretaker: {
    label: 'Caretakers',
    icon: HandymanOutlinedIcon,
    lead: 'Do the night round from your phone.',
    points: [
      'Mark each tenant in, late or out at curfew',
      'See the tenants and rooms you look after',
      'Record cash payments when the owner allows it',
      'Keep a log the owner can read the next morning',
    ],
  },
  tenant: {
    label: 'Tenants',
    icon: PersonOutlineRoundedIcon,
    lead: 'Pay, report and stay informed without chasing anyone.',
    points: [
      'Pay rent and upload your proof of payment',
      'Get a numbered receipt once it is approved',
      'Send a repair request and follow its progress',
      'See notices and your lease dates in one place',
    ],
  },
};

const STEPS = [
  {
    title: 'Create your owner account',
    description: 'Sign up and upload your ID and business permit so we can verify you.',
  },
  {
    title: 'Get approved',
    description: 'Our team reviews your documents. You are notified as soon as you are approved.',
  },
  {
    title: 'Add your property and invite your team',
    description: 'Set up rooms and beds, then register tenants and invite your caretakers.',
  },
];

const NAV_H = { xs: 64, md: 76 };

function scrollToId(id) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* -------------------------------------------------------------------------
   Small pieces
   ------------------------------------------------------------------------- */
const Orange = ({ children }) => (
  <Box component="span" sx={{ color: 'primary.main' }}>
    {children}
  </Box>
);

const h2 = { fontFamily: HEAD, fontWeight: 800, letterSpacing: '-0.025em', lineHeight: 1.1, fontSize: { xs: '1.9rem', md: '2.6rem' }, textWrap: 'balance' };

function Eyebrow({ children, color = 'primary.main' }) {
  return (
    <Typography
      component="p"
      sx={{ fontFamily: HEAD, fontWeight: 700, fontSize: 12.5, letterSpacing: '.12em', textTransform: 'uppercase', color, display: 'flex', alignItems: 'center', gap: 1.25, mb: 1.5 }}
    >
      <Box component="span" sx={{ width: 24, height: 2, bgcolor: 'currentColor', borderRadius: '2px' }} />
      {children}
    </Typography>
  );
}

/** Soft blurred colour behind dark panels. */
const Glow = ({ sx }) => <Box aria-hidden sx={{ position: 'absolute', borderRadius: '50%', pointerEvents: 'none', ...sx }} />;

/** A little row of building windows, used as a brand mark on dark panels. */
function WindowRow({ pattern = [1, 0, 1, 1, 0, 1, 0, 1], cols = 4 }) {
  return (
    <Box aria-hidden sx={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 12px)`, gap: '5px', flexShrink: 0 }}>
      {pattern.map((lit, k) => (
        <Box key={k} sx={{ width: 12, height: 12, borderRadius: '3px', bgcolor: lit ? ORANGE : 'rgba(202,220,246,.18)' }} />
      ))}
    </Box>
  );
}

/** Fades and slides its content up the first time it scrolls into view. */
function Reveal({ children, delay = 0, sx, component = 'div' }) {
  const ref = useRef(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setShown(true);
      return undefined;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true);
          io.disconnect();
        }
      },
      { threshold: 0.15, rootMargin: '0px 0px -40px 0px' }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  const ease = 'cubic-bezier(0.2, 0.7, 0.2, 1)';
  return (
    <Box
      ref={ref}
      component={component}
      sx={{
        opacity: shown ? 1 : 0,
        transform: shown ? 'none' : 'translateY(24px)',
        transition: `opacity .7s ${ease} ${delay}ms, transform .7s ${ease} ${delay}ms`,
        '@media (prefers-reduced-motion: reduce)': { opacity: 1, transform: 'none', transition: 'none' },
        ...sx,
      }}
    >
      {children}
    </Box>
  );
}

/** Highlights the nav link for the section currently on screen. */
function useActiveSection(ids) {
  const [active, setActive] = useState(null);
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return undefined;
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && setActive(e.target.id)),
      { rootMargin: '-45% 0px -50% 0px' }
    );
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el) io.observe(el);
    });
    return () => io.disconnect();
  }, [ids]);
  return active;
}

const NAV_IDS = ['home', ...NAV.map(([id]) => id)];

/* -------------------------------------------------------------------------
   Page
   ------------------------------------------------------------------------- */
export default function LandingWelcome() {
  const navigate = useNavigate();
  const [role, setRole] = useState('owner');
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const active = useActiveSection(NAV_IDS);
  const activeRole = ROLES[role];
  const RoleIcon = activeRole.icon;

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const goTo = (id) => {
    setMenuOpen(false);
    scrollToId(id);
  };

  const sectionOffset = { scrollMarginTop: { xs: NAV_H.xs, md: NAV_H.md } };

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', display: 'flex', flexDirection: 'column', overflowX: 'clip' }}>
      {AnimationStyles}

      {/* ================= Top navigation ================= */}
      <AppBar
        position="sticky"
        elevation={0}
        sx={{
          bgcolor: 'rgba(255,255,255,.94)',
          backdropFilter: 'blur(10px)',
          color: 'text.primary',
          borderBottom: '1px solid',
          borderColor: 'divider',
          boxShadow: scrolled ? '0 6px 24px -14px rgba(32,32,32,.25)' : 'none',
          transition: 'box-shadow .3s',
        }}
      >
        <Container maxWidth="lg">
          <Toolbar disableGutters sx={{ minHeight: { xs: NAV_H.xs, md: NAV_H.md }, gap: 1 }}>
            <Box
              component="button"
              type="button"
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              aria-label="KwartoKeeper, back to top"
              sx={{ mr: 'auto', display: 'flex', p: 0, border: 0, bgcolor: 'transparent', cursor: 'pointer' }}
            >
              <Box component="img" src="/KwartoKeeper-Primary-Logo.png" alt="KwartoKeeper" sx={{ display: 'block', height: { xs: 30, sm: 38 }, width: 'auto' }} />
            </Box>

            <Box component="nav" sx={{ display: { xs: 'none', md: 'flex' }, gap: 0.5, mr: 2 }}>
              {NAV.map(([id, label]) => {
                const on = active === id;
                return (
                  <Button
                    key={id}
                    onClick={() => scrollToId(id)}
                    aria-current={on ? 'true' : undefined}
                    sx={{
                      position: 'relative',
                      fontWeight: 600,
                      textTransform: 'none',
                      color: on ? 'text.primary' : 'text.secondary',
                      '&:hover': { color: 'text.primary', bgcolor: 'transparent' },
                      '&::after': {
                        content: '""',
                        position: 'absolute',
                        left: 14,
                        right: 14,
                        bottom: 4,
                        height: 2,
                        borderRadius: R.sm,
                        bgcolor: 'primary.main',
                        transform: on ? 'scaleX(1)' : 'scaleX(0)',
                        transition: 'transform .25s',
                      },
                    }}
                  >
                    {label}
                  </Button>
                );
              })}
            </Box>

            <Button variant="text" size="small" onClick={() => navigate('/login')} sx={{ fontWeight: 600, color: 'text.primary', textTransform: 'none', minWidth: 0, px: 1.5 }}>
              Log in
            </Button>
            <Button
              variant="contained"
              size="small"
              onClick={() => navigate('/signup')}
              sx={{ display: { xs: 'none', sm: 'inline-flex' }, fontWeight: 700, textTransform: 'none', px: 2.25, borderRadius: R.sm, whiteSpace: 'nowrap', boxShadow: 'none' }}
            >
              Get started
            </Button>
            <IconButton aria-label="Open menu" onClick={() => setMenuOpen(true)} sx={{ display: { md: 'none' }, color: 'text.primary', mr: -1 }}>
              <MenuRoundedIcon />
            </IconButton>
          </Toolbar>
        </Container>
      </AppBar>

      <Drawer anchor="top" open={menuOpen} onClose={() => setMenuOpen(false)}>
        <Box sx={{ px: 2.5, pt: 2, pb: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
            <Box component="img" src="/KwartoKeeper-Primary-Logo.png" alt="KwartoKeeper" sx={{ height: 30, width: 'auto' }} />
            <IconButton aria-label="Close menu" onClick={() => setMenuOpen(false)}>
              <CloseRoundedIcon />
            </IconButton>
          </Box>
          {NAV.map(([id, label]) => (
            <Button
              key={id}
              fullWidth
              onClick={() => goTo(id)}
              sx={{ justifyContent: 'flex-start', py: 1.5, fontSize: '1.05rem', fontWeight: 700, textTransform: 'none', color: active === id ? 'primary.main' : 'text.primary' }}
            >
              {label}
            </Button>
          ))}
          <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5, mt: 2 }}>
            <Button variant="outlined" onClick={() => navigate('/login')} sx={{ fontWeight: 700, textTransform: 'none', borderRadius: R.sm, borderColor: 'divider', color: 'text.primary' }}>
              Log in
            </Button>
            <Button variant="contained" onClick={() => navigate('/signup')} sx={{ fontWeight: 700, textTransform: 'none', borderRadius: R.sm, boxShadow: 'none' }}>
              Get started
            </Button>
          </Box>
        </Box>
      </Drawer>

      <main>
        {/* ================= Hero ================= */}
        <Box id="home" component="section" sx={{ position: 'relative', overflow: 'hidden', bgcolor: INK, color: '#fff', pt: { xs: 6, md: 10 }, pb: { xs: 7, md: 11 } }}>
          <Glow sx={{ width: 640, height: 640, top: -300, right: -220, background: 'rgba(255,69,0,.26)', filter: 'blur(110px)' }} />
          <Glow sx={{ width: 460, height: 460, bottom: -260, left: -180, background: 'rgba(202,220,246,.16)', filter: 'blur(100px)' }} />

          <Container maxWidth="lg" sx={{ position: 'relative' }}>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(0, 1.2fr) minmax(0, 0.8fr)' }, gap: { xs: 5, md: 8 }, alignItems: 'center' }}>
              <Box>
                <Typography
                  variant="h1"
                  sx={{
                    fontFamily: HEAD,
                    fontWeight: 900,
                    letterSpacing: '-0.035em',
                    lineHeight: 1.04,
                    fontSize: { xs: 'clamp(2.3rem, 10vw, 3rem)', sm: '3.6rem', md: 'clamp(3rem, 5.2vw, 4.4rem)' },
                    textWrap: 'balance',
                    mb: 2.5,
                    ...enter(0),
                  }}
                >
                  Know every room, every bed and <Orange>every payment.</Orange>
                </Typography>

                <Typography sx={{ fontSize: { xs: '1.05rem', sm: '1.15rem' }, color: 'rgba(255,255,255,0.72)', maxWidth: 500, lineHeight: 1.6, mb: 4, ...enter(120) }}>
                  KwartoKeeper helps dormitory owners track occupancy, collect rent, handle repairs and run curfew checks, all from a phone.
                </Typography>

                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, '& > button': { flex: { xs: '1 1 auto', sm: '0 0 auto' } }, ...enter(200) }}>
                  <Button
                    variant="contained"
                    size="large"
                    onClick={() => navigate('/signup')}
                    endIcon={<ArrowForwardRoundedIcon />}
                    sx={{ py: 1.5, px: 3.5, fontWeight: 700, borderRadius: R.sm, fontSize: '1rem', boxShadow: '0 12px 28px -12px rgba(255,69,0,.8)', '&:active': { transform: 'scale(0.98)' } }}
                  >
                    Create an account
                  </Button>
                  <Button
                    size="large"
                    onClick={() => navigate('/login')}
                    sx={{ py: 1.5, px: 3.5, fontWeight: 700, borderRadius: R.sm, fontSize: '1rem', color: '#fff', border: '1px solid rgba(255,255,255,.22)', '&:hover': { bgcolor: 'rgba(255,255,255,.08)' }, '&:active': { transform: 'scale(0.98)' } }}
                  >
                    Sign in
                  </Button>
                </Box>

                <Typography variant="body2" sx={{ mt: 2.5, color: 'rgba(255,255,255,0.55)', ...enter(260) }}>
                  Caretaker or tenant? Your owner invites you. Sign in with the details they send.
                </Typography>

                <Box sx={{ mt: { xs: 4, md: 5 }, ...enter(320) }}>
                  <Typography sx={{ fontFamily: HEAD, fontSize: 12, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,.5)', mb: 1.25 }}>Built for</Typography>
                  <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'repeat(3, minmax(0, 1fr))', sm: 'repeat(3, max-content)' }, gap: 1 }}>
                    {Object.entries(ROLES).map(([key, r]) => (
                      <Box
                        key={key}
                        component="button"
                        type="button"
                        onClick={() => {
                          setRole(key);
                          scrollToId('roles');
                        }}
                        sx={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 0.75,
                          px: { xs: 0.5, sm: 1.5 },
                          py: 0.75,
                          borderRadius: R.sm,
                          bgcolor: 'rgba(255,255,255,.07)',
                          border: '1px solid rgba(255,255,255,.1)',
                          fontFamily: HEAD,
                          fontWeight: 600,
                          fontSize: { xs: 12.5, sm: 13.5 },
                          color: 'rgba(255,255,255,.88)',
                          whiteSpace: 'nowrap',
                          minWidth: 0,
                          cursor: 'pointer',
                          transition: 'background-color .2s, border-color .2s',
                          '&:hover': { bgcolor: 'rgba(255,255,255,.12)', borderColor: 'rgba(255,138,92,.5)' },
                        }}
                      >
                        <r.icon sx={{ fontSize: 16, color: ORANGE_SOFT }} />
                        {r.label}
                      </Box>
                    ))}
                  </Box>
                </Box>
              </Box>

              {/* desktop: tall building */}
              <Box sx={{ display: { xs: 'none', md: 'block' }, width: '100%', maxWidth: 360, mx: 'auto', ...enter(180) }}>
                <BuildingCard layout="tall" />
              </Box>
              {/* phones and tablets: wide, short building */}
              <Box sx={{ display: { xs: 'block', md: 'none' }, width: '100%', maxWidth: 520, mx: 'auto', ...enter(180) }}>
                <BuildingCard layout="wide" />
              </Box>
            </Box>
          </Container>
        </Box>

        {/* ================= Features ================= */}
        <Box id="features" component="section" sx={{ py: { xs: 9, md: 13 }, ...sectionOffset }}>
          <Container maxWidth="lg">
            <Reveal sx={{ maxWidth: 640, mb: { xs: 5, md: 7 } }}>
              <Eyebrow>Features</Eyebrow>
              <Typography variant="h2" sx={h2}>
                Everything a dormitory needs, <Orange>nothing it doesn&rsquo;t.</Orange>
              </Typography>
            </Reveal>

            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'repeat(2, minmax(0, 1fr))', md: 'repeat(12, minmax(0, 1fr))' }, gap: 2 }}>
              {FEATURES.map(({ icon: Icon, title, description }, i) => {
                const look = FEATURE_LOOK[i];
                const dark = look.fg === '#fff';
                return (
                  <Reveal key={title} delay={(i % 2) * 100} sx={{ gridColumn: { md: `span ${look.span}` } }}>
                    <Box
                      sx={{
                        height: '100%',
                        p: { xs: 3, md: 4 },
                        borderRadius: R.lg,
                        bgcolor: look.bg,
                        color: look.fg,
                        transition: 'transform .25s, box-shadow .25s',
                        '&:hover': { transform: 'translateY(-3px)', boxShadow: '0 18px 36px -24px rgba(32,32,32,.35)' },
                      }}
                    >
                      <Box
                        sx={{
                          width: 52,
                          height: 52,
                          borderRadius: R.md,
                          display: 'grid',
                          placeItems: 'center',
                          bgcolor: dark ? 'rgba(255,255,255,.14)' : 'rgba(255,255,255,.65)',
                          color: look.icon,
                        }}
                      >
                        <Icon sx={{ fontSize: 28 }} />
                      </Box>
                      <Typography variant="h3" sx={{ fontFamily: HEAD, fontSize: { xs: 20, md: 23 }, fontWeight: 800, letterSpacing: '-0.015em', mt: 2.5 }}>
                        {title}
                      </Typography>
                      <Typography sx={{ mt: 1, fontSize: { xs: 15.5, md: 16.5 }, lineHeight: 1.6, color: dark ? 'rgba(255,255,255,.82)' : 'text.secondary', maxWidth: 460 }}>
                        {description}
                      </Typography>
                    </Box>
                  </Reveal>
                );
              })}
            </Box>
          </Container>
        </Box>

        {/* ================= Roles ================= */}
        <Box id="roles" component="section" sx={{ bgcolor: 'background.paper', py: { xs: 9, md: 13 }, ...sectionOffset }}>
          <Container maxWidth="lg">
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(0, 0.85fr) minmax(0, 1.15fr)' }, gap: { xs: 5, md: 8 }, alignItems: 'center' }}>
              <Reveal>
                <Eyebrow>Who it is for</Eyebrow>
                <Typography variant="h2" sx={{ ...h2, mb: 2 }}>
                  One app, <Orange>three views.</Orange>
                </Typography>
                <Typography color="text.secondary" sx={{ fontSize: { xs: 16.5, md: 18 }, lineHeight: 1.65, maxWidth: 420, mb: 3.5 }}>
                  Owners, caretakers and tenants each get only what they need, so nobody has to dig through screens that aren&rsquo;t theirs.
                </Typography>
                <ToggleButtonGroup
                  exclusive
                  value={role}
                  onChange={(e, v) => v && setRole(v)}
                  aria-label="Choose a role"
                  sx={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: 1,
                    '& .MuiToggleButtonGroup-grouped': {
                      border: '1px solid !important',
                      borderColor: 'rgba(32,32,32,.14) !important',
                      borderRadius: `${R.sm} !important`,
                      bgcolor: '#fff',
                      color: 'text.primary',
                      px: 2,
                      py: 1,
                      gap: 1,
                      textTransform: 'none',
                      fontFamily: HEAD,
                      fontWeight: 700,
                      '&:hover': { bgcolor: '#fff', borderColor: `${ORANGE} !important` },
                      '&.Mui-selected, &.Mui-selected:hover': { bgcolor: INK, color: '#fff', borderColor: `${INK} !important` },
                      '&.Mui-selected svg': { color: ORANGE_SOFT },
                    },
                  }}
                >
                  {Object.entries(ROLES).map(([key, r]) => (
                    <ToggleButton key={key} value={key}>
                      <r.icon sx={{ fontSize: 18, color: 'primary.main' }} />
                      {r.label}
                    </ToggleButton>
                  ))}
                </ToggleButtonGroup>
              </Reveal>

              <Reveal delay={120}>
                <Box sx={{ position: 'relative', bgcolor: '#fff', border: '1px solid', borderColor: 'rgba(255,69,0,.2)', borderRadius: R.xl, p: { xs: 3, sm: 4, md: 5 }, boxShadow: '0 24px 50px -34px rgba(255,69,0,.6)', minHeight: { md: 340 } }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, mb: 3 }}>
                    <Box sx={{ width: 52, height: 52, borderRadius: R.md, bgcolor: ORANGE, color: '#fff', display: 'grid', placeItems: 'center', boxShadow: '0 8px 18px -8px rgba(255,69,0,.7)' }}>
                      <RoleIcon />
                    </Box>
                    <Typography sx={{ fontFamily: HEAD, fontWeight: 700, fontSize: 12.5, letterSpacing: '.12em', textTransform: 'uppercase', color: 'text.secondary' }}>
                      For {activeRole.label.toLowerCase()}
                    </Typography>
                  </Box>
                  <Typography key={role} sx={{ fontFamily: HEAD, fontWeight: 800, fontSize: { xs: '1.35rem', sm: '1.6rem' }, lineHeight: 1.25, letterSpacing: '-0.015em', mb: 3, ...enter(0) }}>
                    {activeRole.lead}
                  </Typography>
                  <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0, display: 'grid', gap: 1.5 }} aria-live="polite">
                    {activeRole.points.map((point, i) => (
                      <Box component="li" key={`${role}-${point}`} sx={{ display: 'flex', gap: 1.5, alignItems: 'center', fontSize: { xs: 15.5, md: 16.5 }, lineHeight: 1.45, ...enter(60 + i * 50) }}>
                        <Box sx={{ width: 26, height: 26, flexShrink: 0, borderRadius: '50%', display: 'grid', placeItems: 'center', bgcolor: ORANGE, color: '#fff' }}>
                          <CheckRoundedIcon sx={{ fontSize: 16 }} />
                        </Box>
                        {point}
                      </Box>
                    ))}
                  </Box>
                </Box>
              </Reveal>
            </Box>
          </Container>
        </Box>

        {/* ================= Getting started ================= */}
        <Box id="start" component="section" sx={{ py: { xs: 9, md: 13 }, ...sectionOffset }}>
          <Container maxWidth="lg">
            <Reveal sx={{ maxWidth: 640, mb: { xs: 5, md: 7 } }}>
              <Eyebrow>Getting started</Eyebrow>
              <Typography variant="h2" sx={h2}>
                Up and running in <Orange>three steps.</Orange>
              </Typography>
            </Reveal>

            <Box
              component="ol"
              sx={{
                position: 'relative',
                listStyle: 'none',
                m: 0,
                p: 0,
                display: 'grid',
                gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'repeat(3, minmax(0, 1fr))' },
                gap: { xs: 2, md: 3 },
              }}
            >
              {STEPS.map((step, i) => (
                <Reveal component="li" key={step.title} delay={i * 110} sx={{ position: 'relative' }}>
                  <Box sx={{ height: '100%', p: { xs: 3, md: 3.5 }, borderRadius: R.lg, border: '1px solid', borderColor: 'divider', bgcolor: '#fff', transition: 'border-color .2s', '&:hover': { borderColor: 'rgba(255,69,0,.45)' } }}>
                    {/* number tile styled like a lit window from the building */}
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2.5 }}>
                      <Box sx={{ width: 44, height: 44, borderRadius: R.sm, flexShrink: 0, bgcolor: ORANGE, color: '#fff', fontFamily: HEAD, fontWeight: 900, fontSize: 18, display: 'grid', placeItems: 'center', boxShadow: '0 8px 18px -8px rgba(255,69,0,.7)' }}>
                        {i + 1}
                      </Box>
                      {i < STEPS.length - 1 && <Box aria-hidden sx={{ display: { xs: 'none', md: 'block' }, flex: 1, height: 2, backgroundImage: `linear-gradient(90deg, rgba(255,69,0,.45) 50%, transparent 50%)`, backgroundSize: '10px 2px' }} />}
                    </Box>
                    <Typography sx={{ fontFamily: HEAD, fontWeight: 800, fontSize: { xs: '1.1rem', md: '1.2rem' }, letterSpacing: '-0.01em', mb: 0.75 }}>{step.title}</Typography>
                    <Typography color="text.secondary" sx={{ lineHeight: 1.6 }}>
                      {step.description}
                    </Typography>
                  </Box>
                </Reveal>
              ))}
            </Box>
          </Container>
        </Box>

        {/* ================= Closing call to action ================= */}
        <Container maxWidth="lg" sx={{ pb: { xs: 8, md: 12 } }}>
          <Reveal sx={{ position: 'relative', overflow: 'hidden', bgcolor: INK, color: '#fff', borderRadius: R.xl, px: { xs: 3, sm: 6 }, py: { xs: 5, sm: 7 } }}>
            <Glow sx={{ width: 380, height: 380, top: -200, right: -140, background: 'rgba(255,69,0,.32)', filter: 'blur(90px)' }} />
            <Glow sx={{ width: 300, height: 300, bottom: -180, left: -120, background: 'rgba(202,220,246,.14)', filter: 'blur(80px)' }} />
            <Box
              sx={{
                position: 'relative',
                display: 'flex',
                flexDirection: { xs: 'column', md: 'row' },
                alignItems: { xs: 'flex-start', md: 'center' },
                justifyContent: 'space-between',
                gap: 3.5,
              }}
            >
              <Box sx={{ maxWidth: 560 }}>
                <Box sx={{ mb: 2.5 }}>
                  <WindowRow />
                </Box>
                <Typography sx={{ fontFamily: HEAD, fontWeight: 800, letterSpacing: '-0.025em', lineHeight: 1.15, fontSize: { xs: '1.7rem', sm: '2.3rem' }, textWrap: 'balance' }}>
                  See your whole dormitory <Orange>in one place.</Orange>
                </Typography>
                <Typography sx={{ mt: 1.5, color: 'rgba(255,255,255,0.7)', lineHeight: 1.6, fontSize: { xs: 16, md: 17 } }}>
                  Create an owner account today. It takes a few minutes, and your first property is quick to set up.
                </Typography>
              </Box>
              <Button
                variant="contained"
                size="large"
                onClick={() => navigate('/signup')}
                endIcon={<ArrowForwardRoundedIcon />}
                sx={{ py: 1.5, px: 4, fontWeight: 700, borderRadius: R.sm, fontSize: '1rem', flexShrink: 0, width: { xs: '100%', sm: 'auto' }, boxShadow: '0 12px 28px -12px rgba(255,69,0,.8)' }}
              >
                Create an account
              </Button>
            </Box>
          </Reveal>
        </Container>
      </main>

      {/* ================= Footer ================= */}
      <Box
        component="footer"
        sx={{ mt: 'auto', position: 'relative', overflow: 'hidden', bgcolor: INK, color: 'rgba(255,255,255,.65)', pt: { xs: 6, md: 8 }, pb: 'calc(28px + env(safe-area-inset-bottom, 0px))' }}
      >
        <Glow sx={{ width: 520, height: 520, top: -320, left: -200, background: 'rgba(255,69,0,.14)', filter: 'blur(110px)' }} />
        <Container maxWidth="lg" sx={{ position: 'relative' }}>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr 1fr', md: '2fr 1fr 1fr' }, columnGap: { xs: 3, md: 6 }, rowGap: { xs: 5, md: 0 } }}>
            <Box sx={{ gridColumn: { xs: '1 / -1', md: 'auto' } }}>
              <Box component="img" src="/KwartoKeeper-DarkMode.png" alt="KwartoKeeper" sx={{ display: 'block', height: { xs: 56, md: 64 }, width: 'auto' }} />
              <Typography sx={{ mt: 2.5, maxWidth: 340, fontFamily: HEAD, fontWeight: 700, fontSize: { xs: 15.5, md: 16.5 }, lineHeight: 1.45, color: '#fff' }}>
                Know every room, every bed and every payment.
              </Typography>
            </Box>

            {[
              ['Product', NAV.map(([id, label]) => [label, () => scrollToId(id)])],
              [
                'Account',
                [
                  ['Log in', () => navigate('/login')],
                  ['Sign up', () => navigate('/signup')],
                ],
              ],
            ].map(([heading, links]) => (
              <Box key={heading} component="nav" aria-label={heading}>
                <Typography sx={{ fontFamily: HEAD, fontWeight: 800, fontSize: 15.5, color: '#fff', mb: 2 }}>{heading}</Typography>
                <Box sx={{ display: 'grid', gap: 1.25 }}>
                  {links.map(([label, onClick]) => (
                    <Box
                      key={label}
                      component="button"
                      type="button"
                      onClick={onClick}
                      sx={{ width: 'fit-content', p: 0, border: 0, bgcolor: 'transparent', cursor: 'pointer', textAlign: 'left', color: 'inherit', font: 'inherit', fontSize: 15, transition: 'color .2s', '&:hover': { color: ORANGE_SOFT } }}
                    >
                      {label}
                    </Box>
                  ))}
                </Box>
              </Box>
            ))}
          </Box>

          <Box sx={{ mt: { xs: 5, md: 7 }, pt: 3, borderTop: '1px solid rgba(255,255,255,.1)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, fontSize: 14, color: 'rgba(255,255,255,.5)' }}>
            <span>&copy; {new Date().getFullYear()} KwartoKeeper. All rights reserved.</span>
            <WindowRow pattern={[1, 0, 1, 1]} cols={4} />
          </Box>
        </Container>
      </Box>
    </Box>
  );
}
