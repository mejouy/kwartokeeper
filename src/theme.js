// src/theme.js
import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    // Readable on white and on the cream page (at least 4.5:1, the WCAG AA level for
    // normal text): white button text on it, and orange text and links on white.
    // The brighter brand orange (#ff4500) is kept for decoration: glows, stripes, tints.
    primary: { main: '#bf3400', light: '#ff4500', dark: '#962900', contrastText: '#ffffff' },
    secondary: { main: '#cadcf6' },
    warning: { main: '#b45309', light: '#f59e0b', dark: '#92400e', contrastText: '#ffffff' },
    error: { main: '#c62828', light: '#ef5350', dark: '#b71c1c', contrastText: '#ffffff' },
    info: { main: '#0277bd', light: '#4fc3f7', dark: '#01579b', contrastText: '#ffffff' },
    text: { primary: '#202020', secondary: '#545454' },
    background: { default: '#ffffff', paper: '#f2e9dd' },
  },
  typography: {
    fontFamily: '"Open Sans", sans-serif',
    h1: { fontFamily: '"Inter", sans-serif', fontWeight: 900 },
    h2: { fontFamily: '"Inter", sans-serif', fontWeight: 700 },
    h3: { fontFamily: '"Inter", sans-serif', fontWeight: 600 },
    h4: { fontFamily: '"Inter", sans-serif', fontWeight: 900, color: '#202020' }, 
    button: { fontFamily: '"Inter", sans-serif', fontWeight: 600 },
  },
  components: {
    // Screen readers: one level-one heading per page, then level-two section
    // headings, so the outline never skips levels (headings that look smaller
    // are still second-level, and subtitles are plain text)
    MuiTypography: {
      defaultProps: {
        variantMapping: { h1: 'h1', h2: 'h2', h3: 'h2', h4: 'h2', h5: 'h2', h6: 'h2', subtitle1: 'p', subtitle2: 'p', body1: 'p', body2: 'p', inherit: 'p' },
      },
    },
    // Accordion titles are section headings too
    MuiAccordion: {
      defaultProps: { slotProps: { heading: { component: 'h2' } } },
    },
    // Every progress bar gets a spoken name (pages pass a more specific one where it helps)
    MuiLinearProgress: {
      defaultProps: { 'aria-label': 'Progress' },
    },
    // Dialogs are white sheets (like the cards on every page), so the cream
    // input fields stand out instead of blending into a cream dialog
    MuiDialog: {
      styleOverrides: {
        // Scoped under the dialog root so it always beats the Paper's own cream background
        root: { '& .MuiDialog-paper': { backgroundColor: '#ffffff', backgroundImage: 'none' } },
      },
    },
    // The cream fill goes on the input box itself, not the whole TextField:
    // the TextField also wraps the floating label and helper text, so filling
    // it made the colour spill past the (rounded) border and behind the label.
    MuiOutlinedInput: {
      styleOverrides: {
        root: { backgroundColor: '#f2e9dd' }
      }
    },
    MuiButton: {
      styleOverrides: {
        root: { textTransform: 'none', padding: '12px 24px', borderRadius: '6px' }
      }
    }
  }
});

export default theme;