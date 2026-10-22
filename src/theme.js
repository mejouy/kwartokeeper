// src/theme.js
import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    primary: { main: '#ff4500' }, 
    secondary: { main: '#cadcf6' },
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