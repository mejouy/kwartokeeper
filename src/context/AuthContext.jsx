import { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from '../config/firebase'; // Adjust path to your firebase config if needed
import { SIGNED_OUT_REASON_KEY } from '../utils/accountState';

const AuthContext = createContext(null);

// Firebase keeps a signed-in session working for up to an hour after the account
// is deleted or disabled in the console. Checking with the server ends it right away.
const ACCOUNT_GONE = ['auth/user-disabled', 'auth/user-not-found', 'auth/user-token-expired', 'auth/invalid-user-token'];
const RECHECK_MS = 5 * 60 * 1000;

async function confirmAccountStillExists(user) {
  try {
    await user.reload(); // asks Firebase for the latest account state
    await user.getIdToken(true); // fails for disabled accounts
  } catch (err) {
    if (ACCOUNT_GONE.includes(err?.code)) {
      try {
        sessionStorage.setItem(SIGNED_OUT_REASON_KEY, err.code === 'auth/user-disabled' ? 'disabled' : 'deleted');
      } catch {
        /* storage blocked: the login page just won't explain why */
      }
      await signOut(auth).catch(() => {});
    }
    // Offline or other hiccups: keep the session, check again later
  }
}

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Listen for authentication state changes (login, logout, session restore)
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      setLoading(false);
      if (user) confirmAccountStillExists(user);
    });

    // Re-check when the app comes back to the screen, and every few minutes
    const recheck = () => {
      if (auth.currentUser && document.visibilityState === 'visible' && navigator.onLine !== false) confirmAccountStillExists(auth.currentUser);
    };
    const timer = setInterval(recheck, RECHECK_MS);
    document.addEventListener('visibilitychange', recheck);

    return () => {
      unsubscribe();
      clearInterval(timer);
      document.removeEventListener('visibilitychange', recheck);
    };
  }, []);

  const value = {
    currentUser,
    loading
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

// Safe hook that defaults to a fallback object if context is missing
// eslint-disable-next-line react-refresh/only-export-components -- the hook lives with its provider; imported from here app-wide
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    return { currentUser: null, loading: false };
  }
  return context;
};

export default AuthContext;
