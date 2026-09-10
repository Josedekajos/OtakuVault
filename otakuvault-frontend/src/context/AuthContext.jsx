import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { Hub } from "aws-amplify/utils";
import {
  signUp as amplifySignUp,
  confirmSignUp as amplifyConfirmSignUp,
  resendSignUpCode as amplifyResendSignUpCode,
  signIn as amplifySignIn,
  signInWithRedirect,
  signOut as amplifySignOut,
  getCurrentUser,
  fetchUserAttributes,
} from "aws-amplify/auth";

// ============================================================
// AUTH CONTEXT
// ============================================================
// Holds the signed-in user's info and exposes the auth actions
// the rest of the app needs. Google sign-in (loginWithGoogle)
// redirects the whole page to Cognito's Hosted UI, then to
// Google, then back - Cognito issues the SAME kind of JWT
// either way, so nothing downstream (api.js, Lambda) needs to
// know or care whether the user signed in with a password or
// with Google.
// ============================================================

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null); // { userId, email, name } | null
  const [authLoading, setAuthLoading] = useState(false);
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
      setUser(null);
    }
  }, []);

  useEffect(() => {
    (async () => {
      await loadCurrentUser();
      setCheckingSession(false);
    })();
  }, [loadCurrentUser]);

  // --------------------------------------------------------
  // Google sign-in leaves the page (redirect to Cognito's
  // Hosted UI, then Google, then back). When the browser lands
  // back on this app, Amplify finishes processing the OAuth
  // response and emits a Hub event - this listener catches that
  // moment and refreshes React's view of "who is signed in",
  // without needing to change how the rest of the app reads
  // auth state (isAuthenticated / user still come from here).
  // --------------------------------------------------------
  useEffect(() => {
    const unsubscribe = Hub.listen("auth", ({ payload }) => {
      if (payload.event === "signInWithRedirect") {
        loadCurrentUser();
      }
      if (payload.event === "signInWithRedirect_failure") {
        console.error("Google sign-in failed.");
      }
    });
    return unsubscribe;
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

  // Works for both sign-up AND sign-in: if this Google identity has
  // never been seen before, Cognito creates a federated user for it
  // automatically; if it has, this just signs them back in.
  const loginWithGoogle = useCallback(async () => {
    await signInWithRedirect({ provider: "Google" });
  }, []);

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
    loginWithGoogle,
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
