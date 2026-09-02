import { useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { friendlyAuthError } from "../services/authErrors.js";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Login({ onSwitchToSignUp }) {
  const { login, authLoading } = useAuth();
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
