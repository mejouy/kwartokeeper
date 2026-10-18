// src/components/AuthLayout.jsx
// Shared shell for the Login and OwnerRegister pages: a dark brand panel with
// a grid of room squares and a form column.
// On phones the panel becomes a compact header so the logo always stays visible.
import { useNavigate } from 'react-router-dom';
import { Box, Typography, ButtonBase, GlobalStyles } from '@mui/material';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import { enter } from './authStyles';

const ORANGE = '#ff4500';
const INK = '#202020';
const HEAD = '"Inter", sans-serif';

const AnimationStyles = (
  <GlobalStyles
    styles={{
      '@keyframes kkAuthFadeUp': { from: { opacity: 0, transform: 'translateY(14px)' }, to: { opacity: 1, transform: 'none' } },
      '@keyframes kkAuthPop': { from: { opacity: 0, transform: 'scale(0.6)' }, to: { opacity: 1, transform: 'scale(1)' } },
      '@media (prefers-reduced-motion: reduce)': {
        '*, *::before, *::after': { animationDuration: '0.001ms !important', animationIterationCount: '1 !important', transitionDuration: '0.001ms !important' },
      },
    }}
  />
);

/* -------------------------------------------------------------------------
   Room squares: a plain grid, one square per room, coloured like the
   owner's room map (vacant, partially occupied, full, under maintenance).
   ------------------------------------------------------------------------- */
const ROOM_FILLS = [
  'rgba(202, 220, 246, 0.16)', // 0 vacant
  'rgba(255, 69, 0, 0.45)', // 1 partially occupied
  ORANGE, // 2 fully occupied
  'rgba(255, 255, 255, 0.07)', // 3 under maintenance
];
// 6 floors x 5 rooms
const ROOMS = [
  2, 0, 1, 2, 0,
  0, 1, 2, 0, 3,
  2, 0, 0, 1, 2,
  1, 2, 0, 0, 1,
  0, 3, 2, 1, 2,
  2, 1, 0, 2, 0,
];

function RoomSquares() {
  return (
    <Box
      role="img"
      aria-label="Rooms in a dormitory, coloured by how full they are"
      sx={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: { md: 1.5, lg: 2 }, width: '100%', maxWidth: 300, mx: 'auto' }}
    >
      {ROOMS.map((status, i) => (
        <Box
          key={i}
          sx={{
            aspectRatio: '1 / 1',
            borderRadius: '8px',
            bgcolor: ROOM_FILLS[status],
            animation: `kkAuthPop .45s ease-out ${250 + i * 22}ms both`,
          }}
        />
      ))}
    </Box>
  );
}

/** A little row of building windows, used on the phone header. */
function WindowRow({ pattern }) {
  return (
    <Box aria-hidden sx={{ display: 'grid', gridTemplateColumns: `repeat(${pattern.length / 2}, 10px)`, gap: '4px', flexShrink: 0 }}>
      {pattern.map((on, k) => (
        <Box key={k} sx={{ width: 10, height: 10, borderRadius: '2px', bgcolor: on ? ORANGE : 'rgba(202,220,246,.2)' }} />
      ))}
    </Box>
  );
}

const Glow = ({ sx }) => <Box aria-hidden sx={{ position: 'absolute', borderRadius: '50%', pointerEvents: 'none', ...sx }} />;

function BackHome() {
  const navigate = useNavigate();
  return (
    <ButtonBase
      onClick={() => navigate('/')}
      sx={{
        gap: 0.75,
        px: 1.25,
        py: 0.75,
        borderRadius: '99px',
        color: 'rgba(255,255,255,.8)',
        border: '1px solid rgba(255,255,255,.16)',
        fontFamily: HEAD,
        fontWeight: 600,
        fontSize: 13,
        transition: 'background-color .2s, color .2s',
        '&:hover': { bgcolor: 'rgba(255,255,255,.08)', color: '#fff' },
        '&.Mui-focusVisible': { outline: '2px solid #ff8a5c', outlineOffset: 2 },
      }}
    >
      <ArrowBackRoundedIcon sx={{ fontSize: 16 }} />
      Home
    </ButtonBase>
  );
}

/**
 * @param title     headline on the brand panel
 * @param subtitle  supporting line on the brand panel
 * @param lit       1 = lit window, 0 = dim; the first 12 make the window row on phones
 * @param children  the form column
 */
export default function AuthLayout({ title, subtitle, lit, children }) {
  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: { xs: 'column', md: 'row' }, bgcolor: INK }}>
      {AnimationStyles}

      {/* ===== Brand panel: full height on desktop, compact header on phones ===== */}
      <Box
        component="aside"
        sx={{
          position: { xs: 'relative', md: 'sticky' },
          top: 0,
          alignSelf: 'flex-start',
          width: { xs: '100%', md: '42%' },
          height: { md: '100vh' },
          flexShrink: 0,
          overflow: 'hidden',
          bgcolor: INK,
          color: '#fff',
          display: 'flex',
          flexDirection: 'column',
          px: { xs: 2.5, sm: 4, md: 6, lg: 8 },
          pt: { xs: 'calc(16px + env(safe-area-inset-top, 0px))', md: 5 },
          pb: { xs: 5.5, md: 5 },
        }}
      >
        <Glow sx={{ width: 520, height: 520, top: -260, right: -220, background: 'rgba(255,69,0,.26)', filter: 'blur(110px)' }} />
        <Glow sx={{ width: 380, height: 380, bottom: -220, left: -160, background: 'rgba(202,220,246,.14)', filter: 'blur(100px)' }} />

        {/* Logo row: always visible, on every screen size */}
        <Box sx={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
          {/* The stacked dark logo is square and its wordmark gets unreadably small,
              so use the icon plus a text wordmark that stays crisp at any size. */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1, md: 1.25 }, minWidth: 0 }}>
            <Box component="img" src="/KwartoKeeper-DarkMode-Icon.png" alt="" aria-hidden="true" sx={{ display: 'block', height: { xs: 32, md: 40 }, width: { xs: 32, md: 40 }, flexShrink: 0 }} />
            <Typography component="span" sx={{ fontFamily: HEAD, fontWeight: 800, letterSpacing: '-0.02em', fontSize: { xs: 18, md: 21 }, color: '#fff', whiteSpace: 'nowrap' }}>
              Kwarto<Box component="span" sx={{ color: ORANGE }}>Keeper</Box>
            </Typography>
          </Box>
          <BackHome />
        </Box>

        {/* Room squares (desktop only, it would push the form too far down on phones) */}
        <Box sx={{ position: 'relative', flex: 1, display: { xs: 'none', md: 'flex' }, alignItems: 'center', justifyContent: 'center', py: 4, minHeight: 0 }}>
          <Box sx={{ width: '100%', ...enter(100) }}>
            <RoomSquares />
          </Box>
        </Box>

        <Box sx={{ position: 'relative', mt: { xs: 3, md: 0 }, ...enter(60) }}>
          <Box sx={{ display: { xs: 'block', md: 'none' }, mb: 1.75 }}>
            <WindowRow pattern={lit.slice(0, 12)} />
          </Box>
          <Typography
            component="h1"
            sx={{ fontFamily: HEAD, fontWeight: 900, letterSpacing: '-0.03em', lineHeight: 1.1, fontSize: { xs: '1.6rem', sm: '1.9rem', md: '2.25rem' }, textWrap: 'balance', mb: { xs: 0.75, md: 1.5 } }}
          >
            {title}
          </Typography>
          <Typography sx={{ color: '#cadcf6', maxWidth: 380, lineHeight: 1.6, fontSize: { xs: 14.5, md: 16 } }}>{subtitle}</Typography>
        </Box>
      </Box>

      {/* ===== Form column: a sheet that overlaps the header on phones ===== */}
      <Box
        component="main"
        sx={{
          position: 'relative',
          flex: 1,
          minWidth: 0,
          bgcolor: 'background.default',
          mt: { xs: -3, md: 0 },
          borderTopLeftRadius: { xs: 24, md: 0 },
          borderTopRightRadius: { xs: 24, md: 0 },
          display: 'flex',
          alignItems: { xs: 'flex-start', md: 'center' },
          justifyContent: 'center',
          px: { xs: 2.5, sm: 4 },
          pt: { xs: 4, md: 6 },
          pb: { xs: 'calc(40px + env(safe-area-inset-bottom, 0px))', md: 6 },
        }}
      >
        <Box sx={{ width: '100%', maxWidth: 420, ...enter(120) }}>{children}</Box>
      </Box>
    </Box>
  );
}

/** Title block at the top of the form column. */
export function FormHeading({ title, subtitle }) {
  return (
    <Box sx={{ mb: 3.5 }}>
      <Typography component="h2" sx={{ fontFamily: HEAD, fontWeight: 800, letterSpacing: '-0.02em', fontSize: { xs: '1.5rem', sm: '1.75rem' }, lineHeight: 1.2, mb: 0.75 }}>
        {title}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ fontSize: 15, lineHeight: 1.55 }}>
        {subtitle}
      </Typography>
    </Box>
  );
}
