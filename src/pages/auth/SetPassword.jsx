// Shown the first time someone signs in with a temporary password (caretakers
// invited by an owner). The route guard sends them here until they've chosen
// their own password, so the temporary one an owner shared stops working.
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Button, TextField, Typography, InputAdornment, IconButton, Alert, CircularProgress, Link } from '@mui/material';
import { Visibility, VisibilityOff, LockOutlined, KeyOutlined, Check } from '@mui/icons-material';
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword, signOut } from 'firebase/auth';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../../config/firebase';
import AuthLayout, { FormHeading } from '../../components/AuthLayout';
import { fieldSx, primaryButtonSx } from '../../components/authStyles';

const LIT_PATTERN = [
  0, 1, 0, 0, 1,
  0, 0, 1, 0, 0,
  1, 0, 0, 1, 0,
  0, 0, 1, 0, 0,
  0, 1, 0, 0, 1,
  1, 0, 0, 1, 0,
];

const HOME = { owner: '/owner', tenant: '/tenant/dashboard', caretaker: '/caretaker/dashboard', admin: '/admin/overview' };

const friendlyError = (err) => {
  switch (err?.code) {
    case 'auth/wrong-password':
    case 'auth/invalid-credential':
    case 'auth/invalid-login-credentials':
      return "That temporary password isn't right. Use the one your property owner sent you.";
    case 'auth/too-many-requests':
      return 'Too many attempts. Please wait a few minutes and try again.';
    case 'auth/weak-password':
      return 'Choose a stronger password (at least 8 characters).';
    case 'auth/network-request-failed':
      return "You're offline. Connect to the internet and try again.";
    default:
      return 'Something went wrong. Check your connection and try again.';
  }
};

function PasswordInput({ label, value, onChange, autoComplete, autoFocus, icon }) {
  const [show, setShow] = useState(false);
  return (
    <TextField
      required
      fullWidth
      label={label}
      type={show ? 'text' : 'password'}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      autoComplete={autoComplete}
      autoFocus={autoFocus}
      sx={fieldSx}
      slotProps={{
        input: {
          startAdornment: <InputAdornment position="start">{icon}</InputAdornment>,
          endAdornment: (
            <InputAdornment position="end">
              <IconButton edge="end" onClick={() => setShow((v) => !v)} aria-label={show ? 'Hide password' : 'Show password'}>
                {show ? <VisibilityOff /> : <Visibility />}
              </IconButton>
            </InputAdornment>
          ),
        },
      }}
    />
  );
}

export default function SetPassword() {
  const navigate = useNavigate();
  const user = auth.currentUser;
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const checks = [
    { ok: next.length >= 8, label: 'At least 8 characters' },
    { ok: next.length > 0 && next !== current, label: 'Different from the temporary password' },
    { ok: confirm.length > 0 && confirm === next, label: 'Both passwords match' },
  ];
  const ready = Boolean(current) && checks.every((c) => c.ok);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!ready || saving || !user) return;
    setError('');
    setSaving(true);
    try {
      await reauthenticateWithCredential(user, EmailAuthProvider.credential(user.email, current));
      await updatePassword(user, next);

      // Clear the flag on whichever records exist (never create an empty profile)
      const stamp = { mustChangePassword: false, passwordChangedAt: new Date().toISOString() };
      const refs = [doc(db, 'users', user.uid), doc(db, 'caretakers', user.uid)];
      const results = await Promise.allSettled(refs.map((ref) => updateDoc(ref, stamp)));
      if (results.every((r) => r.status === 'rejected')) throw results[0].reason;

      const snaps = await Promise.all(refs.map((ref) => getDoc(ref).catch(() => null)));
      const role = snaps.map((s) => (s?.exists() ? s.data().role : null)).find(Boolean) || 'caretaker';
      navigate(HOME[role] || '/login', { replace: true });
    } catch (err) {
      console.error('Could not set the new password:', err);
      setError(friendlyError(err));
    } finally {
      setSaving(false);
    }
  };

  const logOut = async () => {
    await signOut(auth).catch(() => {});
    navigate('/login', { replace: true });
  };

  return (
    <AuthLayout
      title="Make it yours."
      subtitle="You signed in with a temporary password from your property owner. Choose your own so only you can get in."
      lit={LIT_PATTERN}
    >
      <FormHeading title="Set your password" subtitle={user?.email ? `For ${user.email}` : 'Choose a password only you know.'} />

      {error && <Alert severity="error" sx={{ mb: 3, borderRadius: '10px' }}>{error}</Alert>}

      <Box component="form" onSubmit={handleSubmit} noValidate sx={{ display: 'grid', gap: 2.25 }}>
        <input type="text" name="username" autoComplete="username" value={user?.email || ''} readOnly hidden />
        <PasswordInput label="Temporary password" value={current} onChange={setCurrent} autoComplete="current-password" autoFocus icon={<KeyOutlined />} />
        <PasswordInput label="New password" value={next} onChange={setNext} autoComplete="new-password" icon={<LockOutlined />} />
        <PasswordInput label="Confirm new password" value={confirm} onChange={setConfirm} autoComplete="new-password" icon={<LockOutlined />} />

        <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0, display: 'grid', gap: 0.5 }}>
          {checks.map((c) => (
            <Box component="li" key={c.label} sx={{ display: 'flex', alignItems: 'center', gap: 1, fontSize: 13.5, color: c.ok ? 'success.dark' : 'text.secondary', fontWeight: c.ok ? 700 : 500 }}>
              <Box sx={{ width: 18, height: 18, borderRadius: '6px', display: 'grid', placeItems: 'center', bgcolor: c.ok ? 'success.main' : 'action.selected', color: '#fff' }}>
                {c.ok && <Check sx={{ fontSize: 13 }} />}
              </Box>
              {c.label}
            </Box>
          ))}
        </Box>

        <Button type="submit" fullWidth variant="contained" disabled={!ready || saving} sx={primaryButtonSx}>
          {saving ? <CircularProgress size={24} color="inherit" /> : 'Save and continue'}
        </Button>
      </Box>

      <Typography variant="body2" color="text.secondary" sx={{ mt: 3, textAlign: 'center' }}>
        Not you?{' '}
        <Link component="button" type="button" onClick={logOut} underline="hover" sx={{ fontWeight: 600 }}>
          Log out
        </Link>
      </Typography>
    </AuthLayout>
  );
}
