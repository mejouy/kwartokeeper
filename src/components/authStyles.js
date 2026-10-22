// src/components/authStyles.js
// Shared styles for the Login and OwnerRegister pages (see AuthLayout.jsx).

export const enter = (delayMs = 0) => ({
  animation: `kkAuthFadeUp 0.6s cubic-bezier(0.2, 0.7, 0.2, 1) ${delayMs}ms both`,
});

/** Shared look for the form inputs on both pages. */
export const fieldSx = {
  '& .MuiOutlinedInput-root': {
    borderRadius: '10px',
    bgcolor: '#faf6f0',
    transition: 'box-shadow .2s',
    '&.Mui-focused': { bgcolor: '#fff', boxShadow: '0 0 0 4px rgba(255,69,0,.12)' },
  },
  '& .MuiInputAdornment-positionStart svg': { color: 'text.secondary', fontSize: 20 },
};

/** Shared look for the main submit button. */
export const primaryButtonSx = {
  py: 1.5,
  fontWeight: 700,
  fontSize: '1rem',
  borderRadius: '10px',
  boxShadow: '0 12px 28px -14px rgba(255,69,0,.8)',
  '&:hover': { boxShadow: '0 14px 30px -14px rgba(255,69,0,.9)' },
  '&:active': { transform: 'scale(0.99)' },
};

