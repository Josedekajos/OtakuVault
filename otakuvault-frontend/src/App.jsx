import { useState } from "react";
import { useAuth } from "./context/AuthContext.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import Login from "./pages/Login.jsx";
import SignUp from "./pages/SignUp.jsx";
import ConfirmSignUp from "./pages/ConfirmSignUp.jsx";
import Dashboard from "./pages/Dashboard.jsx";

export default function App() {
  const { isAuthenticated, checkingSession } = useAuth();

  // Simple in-app router for the three unauthenticated screens - only
  // three views, so this avoids pulling in a router library just for
  // this, matching the "no unnecessary libraries" requirement.
  const [authView, setAuthView] = useState("login"); // "login" | "signup" | "confirm"
  const [pendingEmail, setPendingEmail] = useState("");

  // Amplify needs a moment on first load to check for an existing
  // session (e.g. a page refresh while already logged in). Without
  // this, the Login page would flash briefly even for signed-in users.
  if (checkingSession) {
    return (
      <div className="auth-container">
        <p className="loading-text">Loading OtakuVault...</p>
      </div>
    );
  }

  let authFallback;
  if (authView === "signup") {
    authFallback = (
      <SignUp
        onSwitchToLogin={() => setAuthView("login")}
        onSignedUp={(email) => {
          setPendingEmail(email);
          setAuthView("confirm");
        }}
      />
    );
  } else if (authView === "confirm") {
    authFallback = (
      <ConfirmSignUp
        email={pendingEmail}
        onVerified={() => setAuthView("login")}
        onBackToLogin={() => setAuthView("login")}
      />
    );
  } else {
    authFallback = <Login onSwitchToSignUp={() => setAuthView("signup")} />;
  }

  return (
    <ProtectedRoute isAuthenticated={isAuthenticated} fallback={authFallback}>
      <Dashboard />
    </ProtectedRoute>
  );
}
