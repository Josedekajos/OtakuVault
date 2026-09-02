import { createContext, useContext, useState, useEffect, useCallback } from "react";
import {
  signUp as amplifySignUp,
  confirmSignUp as amplifyConfirmSignUp,
  resendSignUpCode as amplifyResendSignUpCode,
  signIn as amplifySignIn,
  signOut as amplifySignOut,
  getCurrentUser,
  fetchUserAttributes,
} from "aws-amplify/auth";

// ============================================================
// AUTH CONTEXT
// ============================================================
// Holds the signed-in user's info and exposes the auth actions
// the rest of the app needs. Every action below calls the real
// Amplify v6 API - Amplify itself manages token storage/refresh,
// this context just tracks "who is currently signed in" for React.
// ============================================================

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null); // { userId, email, name } | null
  const [authLoading, setAuthLoading] = useState(false);
  // True only during the very first check, on page load, for whether
  // Amplify already has a valid session (e.g. the user refreshed the
  // page while logged in). Prevents a flash of the Login page.
  const [checkingSession, setCheckingSession] = useState(true);

  const isAuthenticated = !!user;

  const loadCurrentUser = useCallback(async () => {
    try {
      const currentUser = await getCurrentUser();
      const attrs = await fetchUserAttributes();
      setUser({
        userId: currentUser.userId,
        email: attrs.email,
        name: attrs.name || attrs.email,
      });
    } catch {
      // No valid session - not an error, just means "logged out".
      setUser(null);
    }
  }, []);

  useEffect(() => {
    (async () => {
      await loadCurrentUser();
      setCheckingSession(false);
    })();
  }, [loadCurrentUser]);

  const login = useCallback(
    async (email, password) => {
      setAuthLoading(true);
      try {
        await amplifySignIn({ username: email, password });
        await loadCurrentUser();
      } finally {
        setAuthLoading(false);
      }
    },
    [loadCurrentUser]
  );

  const signUp = useCallback(async (name, email, password) => {
    setAuthLoading(true);
    try {
      await amplifySignUp({
        username: email,
        password,
        options: {
          userAttributes: { email, name },
        },
      });
    } finally {
      setAuthLoading(false);
    }
  }, []);

  const confirmSignUpCode = useCallback(async (email, code) => {
    setAuthLoading(true);
    try {
      await amplifyConfirmSignUp({ username: email, confirmationCode: code });
    } finally {
      setAuthLoading(false);
    }
  }, []);

  const resendCode = useCallback(async (email) => {
    setAuthLoading(true);
    try {
      await amplifyResendSignUpCode({ username: email });
    } finally {
      setAuthLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    await amplifySignOut();
    setUser(null);
  }, []);

  const value = {
    user,
    isAuthenticated,
    authLoading,
    checkingSession,
    login,
    signUp,
    confirmSignUpCode,
    resendCode,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used inside an <AuthProvider>.");
  }
  return ctx;
}
