// src/pages/LandingWelcome.jsx
import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Typography, Button, Container, GlobalStyles, ToggleButton, ToggleButtonGroup } from '@mui/material';
import HomeWorkOutlinedIcon from '@mui/icons-material/HomeWorkOutlined';
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined';
import BuildOutlinedIcon from '@mui/icons-material/BuildOutlined';
import NightsStayOutlinedIcon from '@mui/icons-material/NightsStayOutlined';
import AssessmentOutlinedIcon from '@mui/icons-material/AssessmentOutlined';
import CampaignOutlinedIcon from '@mui/icons-material/CampaignOutlined';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';

/* -------------------------------------------------------------------------
   Motion
   One orchestrated moment: the hero text rises in, and the building's
   windows light up one by one. Everything else on the page stays still.
   The reduced-motion rule switches all of it off.
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

const ORANGE = '#ff4500';
const INK = '#202020';

/* -------------------------------------------------------------------------
   The building. Each window is a room you can tap: lit (orange) means beds
   are taken, dim means vacant. It is sample data, labelled as such, but it
   shows what the product does: every room and bed at a glance.
   ------------------------------------------------------------------------- */
const ROWS = 6;
const COLS = 5;
const SIZE = 34;
const GAP = 14;
const LIT = [
  1, 0, 0, 1, 0,
  0, 0, 1, 0, 0,
  1, 0, 0, 0, 1,
  0, 1, 0, 0, 0,
  0, 0, 1, 0, 1,
  1, 0, 0, 1, 0,
];
const LETTERS = ['A', 'B', 'C', 'D', 'E'];
const GRID_W = COLS * (SIZE + GAP) - GAP;
const GRID_H = ROWS * (SIZE + GAP) - GAP;
const VB_W = GRID_W + 40;
const VB_H = GRID_H + 70;

const roomInfo = (idx) => {
  const row = Math.floor(idx / COLS);
  const col = idx % COLS;
  const lit = LIT[idx] === 1;
  const name = `Room ${ROWS - row}${LETTERS[col]}`;
  if (!lit) return { idx, name, lit, line1: 'Vacant', line2: '4 beds open' };
  const taken = [2, 3, 4, 1][idx % 4];
  return {
    idx,
    name,
    lit,
    line1: `${taken} of 4 beds taken`,
    line2: idx % 3 === 0 ? 'Rent due in 3 days' : 'Rent paid',
  };
};

function Building({ selected, onSelect }) {
  const windows = useMemo(
    () =>
      LIT.map((lit, idx) => {
        const row = Math.floor(idx / COLS);
        const col = idx % COLS;
        return { idx, lit, x: 20 + col * (SIZE + GAP), y: 22 + row * (SIZE + GAP) };
      }),
    []
  );

  return (
    <Box
      sx={{
        width: '100%',
        maxWidth: 270,
        mx: 'auto',
        '& rect[role="button"]': { cursor: 'pointer', outline: 'none' },
        '& rect[role="button"]:focus-visible': { stroke: '#fff', strokeWidth: 2.5 },
      }}
    >
      <svg viewBox={`0 0 ${VB_W} ${VB_H}`} width="100%" style={{ display: 'block' }} role="group" aria-label="A dormitory building. Select a room to see its details.">
        <rect x="0" y="0" width={VB_W} height="8" rx="3" fill="rgba(255,255,255,0.2)" />
        <rect x="6" y="8" width={VB_W - 12} height={GRID_H + 62} fill="rgba(255,255,255,0.05)" />
        <rect x={VB_W / 2 - 15} y={22 + GRID_H + 16} width="30" height="30" rx="3" fill="rgba(255,255,255,0.12)" />
        {windows.map((w) => {
          const info = roomInfo(w.idx);
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

/* -------------------------------------------------------------------------
   Content
   ------------------------------------------------------------------------- */
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

const ROLES = {
  owner: {
    label: 'Owners',
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

function scrollToId(id) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

export default function LandingWelcome() {
  const navigate = useNavigate();
  const [selected, setSelected] = useState(7); // starts on a lit room so the panel never looks empty
  const [role, setRole] = useState('owner');
  const info = roomInfo(selected);
  const activeRole = ROLES[role];

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {AnimationStyles}

      {/* Top navigation */}
      <Container
        maxWidth="lg"
        sx={{ pt: { xs: 2, sm: 3 }, pb: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 2 }}
      >
        <Box component="img" src="/KwartoKeeper-Primary-Logo.png" alt="KwartoKeeper" sx={{ display: 'block', height: { xs: 32, sm: 38 }, width: 'auto', flexShrink: 0 }} />

        <Box sx={{ display: { xs: 'none', md: 'flex' }, gap: 0.5, ml: 'auto', mr: 2 }}>
          {[
            ['features', 'Features'],
            ['roles', 'Who it is for'],
            ['start', 'Getting started'],
          ].map(([id, label]) => (
            <Button key={id} onClick={() => scrollToId(id)} sx={{ color: 'text.secondary', fontWeight: 600, textTransform: 'none' }}>
              {label}
            </Button>
          ))}
        </Box>

        <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
          <Button variant="text" size="small" onClick={() => navigate('/login')} sx={{ fontWeight: 600, color: 'text.primary', textTransform: 'none', minWidth: 0, px: 1.5 }}>
            Log in
          </Button>
          <Button variant="contained" size="small" onClick={() => navigate('/signup')} sx={{ fontWeight: 600, textTransform: 'none', px: { xs: 1.75, sm: 2 }, borderRadius: 2, whiteSpace: 'nowrap' }}>
            Get started
          </Button>
        </Box>
      </Container>

      {/* Hero */}
      <Container maxWidth="lg" sx={{ pt: { xs: 5, md: 9 }, pb: { xs: 8, md: 12 } }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(0, 1.1fr) minmax(0, 0.9fr)' }, gap: { xs: 6, md: 8 }, alignItems: 'center' }}>
          <Box sx={{ textAlign: { xs: 'center', md: 'left' }, display: 'flex', flexDirection: 'column', alignItems: { xs: 'center', md: 'flex-start' } }}>
            <Typography
              variant="h1"
              sx={{
                fontFamily: '"Inter", sans-serif',
                fontWeight: 900,
                letterSpacing: '-0.035em',
                lineHeight: 1.04,
                fontSize: { xs: 'clamp(2.3rem, 10vw, 3rem)', sm: '3.6rem', md: 'clamp(3rem, 5.2vw, 4.4rem)' },
                textWrap: 'balance',
                mb: 2.5,
                ...enter(0),
              }}
            >
              Know every room, every bed and every payment.
            </Typography>

            <Typography
              sx={{ fontSize: { xs: '1.05rem', sm: '1.15rem' }, color: 'text.secondary', maxWidth: 480, lineHeight: 1.6, mb: 4, ...enter(120) }}
            >
              KwartoKeeper helps dormitory owners track occupancy, collect rent, handle repairs and run curfew checks, all from a phone.
            </Typography>

            <Box
              sx={{
                display: 'flex',
                flexDirection: { xs: 'column', sm: 'row' },
                gap: 1.5,
                width: { xs: '100%', sm: 'auto' },
                maxWidth: { xs: 360, sm: 'none' },
                ...enter(240),
              }}
            >
              <Button
                variant="contained"
                size="large"
                onClick={() => navigate('/signup')}
                sx={{ py: 1.5, px: 4, fontWeight: 700, borderRadius: 2.5, fontSize: '1rem', '&:active': { transform: 'scale(0.98)' } }}
              >
                Create an account
              </Button>
              <Button
                variant="outlined"
                size="large"
                onClick={() => navigate('/login')}
                sx={{ py: 1.5, px: 4, fontWeight: 700, borderRadius: 2.5, fontSize: '1rem', borderColor: 'divider', color: 'text.primary', '&:active': { transform: 'scale(0.98)' } }}
              >
                Sign in
              </Button>
            </Box>

            <Typography variant="body2" color="text.secondary" sx={{ mt: 2.5, ...enter(340) }}>
              Caretaker or tenant? Your owner invites you. Sign in with the details they send.
            </Typography>
          </Box>

          {/* The building */}
          <Box sx={{ width: '100%', maxWidth: { xs: 400, md: 'none' }, mx: 'auto', ...enter(180) }}>
            <Box sx={{ bgcolor: INK, borderRadius: 4, p: { xs: 3, sm: 4 }, color: '#fff' }}>
              <Building selected={selected} onSelect={setSelected} />

              <Box
                aria-live="polite"
                sx={{
                  mt: 3,
                  borderRadius: 3,
                  bgcolor: 'rgba(255,255,255,0.07)',
                  px: 2.25,
                  py: 1.5,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 2,
                }}
              >
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ fontWeight: 800, fontSize: '1.05rem', lineHeight: 1.2 }}>{info.name}</Typography>
                  <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)' }}>
                    {info.line1}
                  </Typography>
                </Box>
                <Box
                  sx={{
                    flexShrink: 0,
                    px: 1.5,
                    py: 0.5,
                    borderRadius: 10,
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    bgcolor: info.lit ? 'rgba(255,69,0,0.2)' : 'rgba(255,255,255,0.1)',
                    color: info.lit ? '#ff8a5c' : 'rgba(255,255,255,0.75)',
                  }}
                >
                  {info.line2}
                </Box>
              </Box>

              <Typography variant="caption" sx={{ display: 'block', mt: 1.5, textAlign: 'center', color: 'rgba(255,255,255,0.55)' }}>
                Sample building. Tap a room to look inside.
              </Typography>
            </Box>
          </Box>
        </Box>
      </Container>

      {/* Features: a plain list on a tinted band, not a wall of cards */}
      <Box id="features" sx={{ bgcolor: 'background.paper', py: { xs: 7, md: 10 }, scrollMarginTop: 16 }}>
        <Container maxWidth="lg">
          <Typography variant="h2" sx={{ fontFamily: '"Inter", sans-serif', fontWeight: 800, letterSpacing: '-0.025em', fontSize: { xs: '1.7rem', md: '2.3rem' }, maxWidth: 560, textWrap: 'balance', mb: { xs: 4, md: 6 } }}>
            Everything a dormitory needs, nothing it doesn&rsquo;t.
          </Typography>

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'repeat(2, minmax(0, 1fr))' },
              columnGap: { md: 8 },
            }}
          >
            {FEATURES.map(({ icon: Icon, title, description }) => (
              <Box key={title} sx={{ display: 'flex', gap: 2, py: 3, borderTop: '1px solid', borderColor: 'divider' }}>
                <Box sx={{ width: 40, height: 40, borderRadius: 2, flexShrink: 0, bgcolor: 'rgba(255, 69, 0, 0.1)', color: 'primary.main', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon fontSize="small" />
                </Box>
                <Box sx={{ minWidth: 0 }}>
                  <Typography sx={{ fontFamily: '"Inter", sans-serif', fontWeight: 700, fontSize: '1.05rem', mb: 0.5 }}>{title}</Typography>
                  <Typography color="text.secondary" sx={{ lineHeight: 1.6 }}>
                    {description}
                  </Typography>
                </Box>
              </Box>
            ))}
          </Box>
        </Container>
      </Box>

      {/* Roles */}
      <Container id="roles" maxWidth="lg" sx={{ py: { xs: 7, md: 11 }, scrollMarginTop: 16 }}>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(0, 0.8fr) minmax(0, 1.2fr)' }, gap: { xs: 4, md: 8 }, alignItems: 'start' }}>
          <Box>
            <Typography variant="h2" sx={{ fontFamily: '"Inter", sans-serif', fontWeight: 800, letterSpacing: '-0.025em', fontSize: { xs: '1.7rem', md: '2.3rem' }, textWrap: 'balance', mb: 2 }}>
              One app, three views.
            </Typography>
            <Typography color="text.secondary" sx={{ lineHeight: 1.65, maxWidth: 380, mb: 3 }}>
              Owners, caretakers and tenants each get only what they need, so nobody has to dig through screens that aren&rsquo;t theirs.
            </Typography>
            <ToggleButtonGroup
              exclusive
              value={role}
              onChange={(e, v) => v && setRole(v)}
              aria-label="Choose a role"
              sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, '& .MuiToggleButtonGroup-grouped': { border: '1px solid !important', borderColor: 'divider !important', borderRadius: '999px !important', px: 2.25, py: 0.75, textTransform: 'none', fontWeight: 700 } }}
            >
              {Object.entries(ROLES).map(([key, r]) => (
                <ToggleButton key={key} value={key} color="primary">
                  {r.label}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          </Box>

          <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 4, p: { xs: 3, sm: 4 }, bgcolor: 'background.paper', minHeight: 260 }}>
            <Typography sx={{ fontFamily: '"Inter", sans-serif', fontWeight: 800, fontSize: { xs: '1.25rem', sm: '1.5rem' }, lineHeight: 1.25, letterSpacing: '-0.015em', mb: 2.5 }}>
              {activeRole.lead}
            </Typography>
            <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0, display: 'grid', gap: 1.75 }} aria-live="polite">
              {activeRole.points.map((point) => (
                <Box component="li" key={point} sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
                  <CheckRoundedIcon sx={{ color: 'primary.main', fontSize: 22, mt: '1px', flexShrink: 0 }} />
                  <Typography sx={{ lineHeight: 1.5 }}>{point}</Typography>
                </Box>
              ))}
            </Box>
          </Box>
        </Box>
      </Container>

      {/* Getting started: a real sequence, so the numbers mean something */}
      <Box id="start" sx={{ bgcolor: 'background.paper', py: { xs: 7, md: 10 }, scrollMarginTop: 16 }}>
        <Container maxWidth="lg">
          <Typography variant="h2" sx={{ fontFamily: '"Inter", sans-serif', fontWeight: 800, letterSpacing: '-0.025em', fontSize: { xs: '1.7rem', md: '2.3rem' }, textWrap: 'balance', mb: { xs: 4, md: 6 } }}>
            Up and running in three steps.
          </Typography>
          <Box component="ol" sx={{ listStyle: 'none', m: 0, p: 0, display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'repeat(3, minmax(0, 1fr))' }, gap: { xs: 3, md: 5 } }}>
            {STEPS.map((step, i) => (
              <Box component="li" key={step.title} sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
                <Box sx={{ width: 36, height: 36, borderRadius: '50%', flexShrink: 0, bgcolor: ORANGE, color: '#fff', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {i + 1}
                </Box>
                <Box>
                  <Typography sx={{ fontFamily: '"Inter", sans-serif', fontWeight: 700, fontSize: '1.05rem', mb: 0.5 }}>{step.title}</Typography>
                  <Typography color="text.secondary" sx={{ lineHeight: 1.6 }}>
                    {step.description}
                  </Typography>
                </Box>
              </Box>
            ))}
          </Box>
        </Container>
      </Box>

      {/* Closing call to action */}
      <Container maxWidth="lg" sx={{ py: { xs: 6, md: 9 } }}>
        <Box
          sx={{
            bgcolor: INK,
            color: '#fff',
            borderRadius: 4,
            px: { xs: 3, sm: 6 },
            py: { xs: 5, sm: 7 },
            display: 'flex',
            flexDirection: { xs: 'column', md: 'row' },
            alignItems: { xs: 'flex-start', md: 'center' },
            justifyContent: 'space-between',
            gap: 3,
          }}
        >
          <Box sx={{ maxWidth: 560 }}>
            <Typography sx={{ fontFamily: '"Inter", sans-serif', fontWeight: 800, letterSpacing: '-0.025em', lineHeight: 1.15, fontSize: { xs: '1.6rem', sm: '2.1rem' }, textWrap: 'balance' }}>
              See your whole dormitory in one place.
            </Typography>
            <Typography sx={{ mt: 1.5, color: 'rgba(255,255,255,0.7)', lineHeight: 1.6 }}>
              Create an owner account today. It takes a few minutes, and your first property is quick to set up.
            </Typography>
          </Box>
          <Button
            variant="contained"
            size="large"
            onClick={() => navigate('/signup')}
            sx={{ py: 1.5, px: 4, fontWeight: 700, borderRadius: 2.5, fontSize: '1rem', flexShrink: 0, width: { xs: '100%', sm: 'auto' } }}
          >
            Create an account
          </Button>
        </Box>
      </Container>

      {/* Footer */}
      <Box sx={{ mt: 'auto', pt: 4, pb: 'calc(32px + env(safe-area-inset-bottom, 0px))', borderTop: '1px solid', borderColor: 'divider' }}>
        <Container maxWidth="lg" sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, alignItems: 'center', justifyContent: 'space-between', gap: 2, textAlign: { xs: 'center', sm: 'left' } }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box component="img" src="/KwartoKeeper-Icon.png" alt="" aria-hidden="true" sx={{ display: 'block', height: 40, width: 'auto' }} />
            <Typography variant="caption" color="text.secondary">
              &copy; {new Date().getFullYear()} KwartoKeeper. All rights reserved.
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            <Button size="small" onClick={() => navigate('/login')} sx={{ color: 'text.secondary', fontWeight: 600, textTransform: 'none' }}>
              Log in
            </Button>
            <Button size="small" onClick={() => navigate('/signup')} sx={{ color: 'text.secondary', fontWeight: 600, textTransform: 'none' }}>
              Sign up
            </Button>
          </Box>
        </Container>
      </Box>
    </Box>
  );
}