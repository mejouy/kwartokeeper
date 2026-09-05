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
    MuiTextField: {
      styleOverrides: {
        root: { 
          backgroundColor: '#f2e9dd', 
          borderRadius: '4px'
        }
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