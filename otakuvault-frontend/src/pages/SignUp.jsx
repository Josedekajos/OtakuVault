import { useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { friendlyAuthError } from "../services/authErrors.js";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Matches the CDK stack's Cognito password policy: 8+ chars,
// at least one lowercase, one uppercase, one number.
const PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;

export default function SignUp({ onSwitchToLogin, onSignedUp }) {
  const { signUp, authLoading } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");

  function validate() {
    if (!name.trim()) return "Name is required.";
    if (!email.trim()) return "Email is required.";
    if (!EMAIL_PATTERN.test(email.trim())) return "Enter a valid email address.";
    if (!PASSWORD_PATTERN.test(password)) {
      return "Password must be at least 8 characters and include an uppercase letter, a lowercase letter, and a number.";
    }
    if (password !== confirmPassword) return "Passwords do not match.";
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
      await signUp(name.trim(), email.trim(), password);
      onSignedUp(email.trim());
    } catch (err) {
      setError(friendlyAuthError(err));
    }
  }

  return (
    <div className="auth-container">
      <form className="card auth-card" onSubmit={handleSubmit}>
        <h1 className="brand-title">OtakuVault</h1>
        <h2>Create Account</h2>

        {error && <div className="message error">{error}</div>}

        <label>
          Name
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Your full name"
            autoComplete="name"
          />
        </label>

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
            placeholder="8+ chars, upper, lower, number"
            autoComplete="new-password"
          />
        </label>

        <label>
          Confirm Password
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Re-enter your password"
            autoComplete="new-password"
          />
        </label>

        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={authLoading}>
            {authLoading ? "Creating account..." : "Create Account"}
          </button>
        </div>

        <p className="auth-switch">
          Already have an account?{" "}
          <button type="button" className="link-button" onClick={onSwitchToLogin}>
            Log In
          </button>
        </p>
      </form>
    </div>
  );
}
