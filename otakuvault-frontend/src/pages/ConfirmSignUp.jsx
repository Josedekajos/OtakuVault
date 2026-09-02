import { useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import { friendlyAuthError } from "../services/authErrors.js";

export default function ConfirmSignUp({ email, onVerified, onBackToLogin }) {
  const { confirmSignUpCode, resendCode, authLoading } = useAuth();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [infoMessage, setInfoMessage] = useState("");

  async function handleVerify(e) {
    e.preventDefault();
    setInfoMessage("");

    if (!code.trim()) {
      setError("Enter the verification code.");
      return;
    }
    setError("");

    try {
      await confirmSignUpCode(email, code.trim());
      onVerified();
    } catch (err) {
      setError(friendlyAuthError(err));
    }
  }

  async function handleResend() {
    setError("");
    setInfoMessage("");
    try {
      await resendCode(email);
      setInfoMessage("A new code has been sent.");
    } catch (err) {
      setError(friendlyAuthError(err));
    }
  }

  return (
    <div className="auth-container">
      <form className="card auth-card" onSubmit={handleVerify}>
        <h1 className="brand-title">OtakuVault</h1>
        <h2>Verify Your Email</h2>
        <p className="auth-subtext">
          Enter the code sent to <strong>{email}</strong>
        </p>

        {error && <div className="message error">{error}</div>}
        {infoMessage && <div className="message success">{infoMessage}</div>}

        <label>
          Verification Code
          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="123456"
            inputMode="numeric"
            autoComplete="one-time-code"
          />
        </label>

        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={authLoading}>
            {authLoading ? "Verifying..." : "Verify"}
          </button>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={handleResend}
            disabled={authLoading}
          >
            Resend Code
          </button>
        </div>

        <p className="auth-switch">
          <button type="button" className="link-button" onClick={onBackToLogin}>
            Back to Login
          </button>
        </p>
      </form>
    </div>
  );
}
