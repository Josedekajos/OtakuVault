import { useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { friendlyAuthError } from "../services/authErrors.js";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.9-2.26 5.36-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
    </svg>
  );
}

export default function Login({ onSwitchToSignUp }) {
  const { login, loginWithGoogle, authLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  function validate() {
    if (!email.trim()) return "Email is required.";
    if (!EMAIL_PATTERN.test(email.trim())) return "Enter a valid email address.";
    if (!password) return "Password is required.";
    return "";
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }
    setError("");
    try {
      await login(email.trim(), password);
    } catch (err) {
      setError(friendlyAuthError(err));
    }
  }

  async function handleGoogleClick() {
    setError("");
    try {
      await loginWithGoogle();
    } catch (err) {
      setError(friendlyAuthError(err));
    }
  }

  return (
    <div className="auth-container">
      <form className="card auth-card" onSubmit={handleSubmit}>
        <h1 className="brand-title">OtakuVault</h1>
        <p className="auth-subtext">Your personal anime character collection.</p>

        <h2>Log In</h2>
        {error && <div className="message error">{error}</div>}

        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
          />
        </label>

        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Your password"
            autoComplete="current-password"
          />
        </label>

        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={authLoading}>
            {authLoading ? "Logging in..." : "Log In"}
          </button>
        </div>

        <div className="auth-divider">
          <span>OR</span>
        </div>

        <button
          type="button"
          className="btn btn-google"
          onClick={handleGoogleClick}
          disabled={authLoading}
        >
          <GoogleIcon />
          Continue with Google
        </button>

        <p className="auth-switch">
          Don&apos;t have an account?{" "}
          <button type="button" className="link-button" onClick={onSwitchToSignUp}>
            Sign Up
          </button>
        </p>
      </form>
    </div>
  );
}
