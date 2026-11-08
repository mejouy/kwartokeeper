import { useMediaQuery, useTheme } from '@mui/material';
import Box from '@mui/material/Box';
import darkIcon from '../assets/KwartoKeeper-DarkMode-Icon.png';
import darkWordmark from '../assets/KwartoKeeper-DarkMode.png';
import icon from '../assets/KwartoKeeper-Icon.png';
import wordmark from '../assets/KwartoKeeper-Secondary-Logo.png';

export default function BrandLogo({ variant = 'wordmark', onDark = false, appearance = 'auto', sx, ...props }) {
  const theme = useTheme();
  const prefersDarkMode = useMediaQuery('(prefers-color-scheme: dark)');
  const isDark = appearance === 'dark'
    || (appearance === 'auto' && (onDark || theme.palette.mode === 'dark' || prefersDarkMode));
  const src = variant === 'icon'
    ? (isDark ? darkIcon : icon)
    : (isDark ? darkWordmark : wordmark);

  return <Box component="img" src={src} alt="KwartoKeeper" sx={sx} {...props} />;
}
