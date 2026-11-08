// Shown the first time someone signs in with a temporary password (caretakers
// invited by an owner). The route guard sends them here until they've chosen
// their own password, so the temporary one an owner shared stops working.
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Button, TextField, Typography, InputAdornment, IconButton, Alert, CircularProgress, Link } from '@mui/material';
import { Visibility, VisibilityOff, LockOutlined, KeyOutlined, Check, CheckCircleOutlined } from '@mui/icons-material';
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword, signOut } from 'firebase/auth';
import { addDoc, collection, doc, getDoc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../../config/firebase';
import { logActivity } from '../../services/activityLog';
import AuthLayout, { FormHeading } from '../../components/AuthLayout';
import { fieldSx, primaryButtonSx } from '../../components/authStyles';
import { t } from "../../i18n";

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
  const [done, setDone] = useState(null); // { role, email } once the new password is saved

  const checks = [
    { ok: next.length >= 8, label: t("At least 8 characters") },
    { ok: next.length > 0 && next !== current, label: t("Different from the temporary password") },
    { ok: confirm.length > 0 && confirm === next, label: t("Both passwords match") },
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
      const profile = Object.assign({}, ...snaps.map((s) => (s?.exists() ? s.data() : {})));
      const role = profile.role || 'caretaker';
      const name = profile.name || profile.fullName || user.email;
      const ownerUid = profile.ownerUid || '';

      // A note in their own notifications, one for their owner, and an entry in the
      // owner's activity log. Best effort: the password is already changed.
      const nowIso = new Date().toISOString();
      const notes = [
        { userId: user.uid, title: 'Password changed', message: 'You replaced your temporary password. From now on, sign in with your email and the new password you chose. The temporary one no longer works.', type: 'success' },
        ownerUid && { userId: ownerUid, title: `${name} set their own password`, message: `${name} signed in and replaced the temporary password you shared. It no longer works.`, type: 'info' },
      ].filter(Boolean);
      Promise.all(notes.map((n) => addDoc(collection(db, 'notifications'), { ...n, kind: 'account', category: 'account', createdBy: user.uid, createdByRole: role, isRead: false, createdAt: nowIso }))).catch((err) => console.warn('Password notice not sent:', err?.code || err));
      if (ownerUid) logActivity({ ownerUid, actorName: name, actorRole: role, category: 'account', action: 'account.password', summary: 'Replaced the temporary password with their own' });

      setDone({ role, email: user.email });
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

  // Try the new password straight away: sign out and back in with it
  const signInAgain = async () => {
    await signOut(auth).catch(() => {});
    navigate('/login', { replace: true, state: { email: done?.email || '', notice: 'Your password was changed. Log in with your email and your new password.' } });
  };

  if (done) {
    return (
      <AuthLayout title={t("All set.")} subtitle={t("Only you know your password now.")} lit={LIT_PATTERN}>
        <Box sx={{ width: 56, height: 56, borderRadius: '16px', display: 'grid', placeItems: 'center', bgcolor: 'success.main', color: '#fff', mb: 2.5 }}>
          <CheckCircleOutlined sx={{ fontSize: 32 }} />
        </Box>
        <FormHeading title={t("Password changed")} subtitle={done.email ? `For ${done.email}` : undefined} />
        <Alert severity="success" sx={{ mb: 3, borderRadius: '10px' }}>
          {t("Your temporary password no longer works. Next time, log in with your email and the new password you just chose.")}
        </Alert>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          {t("You're still signed in, so you can go straight to your dashboard. Forget your password later? Use \"Forgot password\" on the login page.")}
        </Typography>
        <Box sx={{ display: 'grid', gap: 1.25 }}>
          <Button fullWidth variant="contained" onClick={() => navigate(HOME[done.role] || '/login', { replace: true })} sx={primaryButtonSx}>
            {t("Continue to my dashboard")}
          </Button>
          <Button fullWidth variant="outlined" onClick={signInAgain} sx={{ minHeight: 48, borderRadius: '10px', fontWeight: 700 }}>
            {t("Log out and log in with the new password")}
          </Button>
        </Box>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title={t("Make it yours.")}
      subtitle={t("You signed in with a temporary password from your property owner. Choose your own so only you can get in.")}
      lit={LIT_PATTERN}
    >
      <FormHeading title={t("Set your password")} subtitle={user?.email ? `For ${user.email}` : 'Choose a password only you know.'} />

      {error && <Alert severity="error" sx={{ mb: 3, borderRadius: '10px' }}>{error}</Alert>}

      <Box component="form" onSubmit={handleSubmit} noValidate sx={{ display: 'grid', gap: 2.25 }}>
        <input type="text" name="username" autoComplete="username" value={user?.email || ''} readOnly hidden />
        <PasswordInput label={t("Temporary password")} value={current} onChange={setCurrent} autoComplete="current-password" autoFocus icon={<KeyOutlined />} />
        <PasswordInput label={t("New password")} value={next} onChange={setNext} autoComplete="new-password" icon={<LockOutlined />} />
        <PasswordInput label={t("Confirm new password")} value={confirm} onChange={setConfirm} autoComplete="new-password" icon={<LockOutlined />} />

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
          {saving ? <CircularProgress size={24} color="inherit" /> : t("Save and continue")}
        </Button>
      </Box>

      <Typography variant="body2" color="text.secondary" sx={{ mt: 3, textAlign: 'center' }}>
        {t("Not you?")}{' '}
        <Link component="button" type="button" onClick={logOut} underline="hover" sx={{ fontWeight: 600 }}>
          {t("Log out")}
        </Link>
      </Typography>
    </AuthLayout>
  );
}
