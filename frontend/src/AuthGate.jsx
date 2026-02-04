// AuthGate.jsx
import React, { useEffect, useRef, useState } from "react";
import "./App.css";

const SESSION_KEY = "pp_user";       // current signed-in user
const ACCOUNTS_KEY = "pp_accounts";  // registered accounts list

function safeJsonParse(raw, fallback) {
  try {
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function normalizeEmail(email) {
  return (email || "").trim().toLowerCase();
}

export default function AuthGate({ onAuthed, onCreateAccount }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const emailRef = useRef(null);

  useEffect(() => {
    emailRef.current?.focus();
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    setError("");

    const trimmedEmail = normalizeEmail(email);
    const trimmedPassword = (password || "").trim();

    if (!trimmedEmail) return setError("Please enter an email.");
    if (!trimmedPassword) return setError("Please enter a password.");

    // Load registered accounts
    const accounts = safeJsonParse(localStorage.getItem(ACCOUNTS_KEY), []);
    const match = Array.isArray(accounts)
      ? accounts.find((a) => normalizeEmail(a.email) === trimmedEmail)
      : null;

    if (!match) {
      setError("Invalid email or password.");
      return;
    }

    if ((match.password || "") !== trimmedPassword) {
      setError("Invalid email or password.");
      return;
    }

    // Create session user (do NOT delete the stored account)
    const sessionUser = {
      id: match.id,
      email: match.email,
      name: match.name || (trimmedEmail.includes("@") ? trimmedEmail.split("@")[0] : trimmedEmail),
    };

    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify(sessionUser));
    } catch (err) {
      console.error(err);
      setError("Could not save sign-in info (localStorage blocked).");
      return;
    }

    onAuthed(sessionUser);
  };

  return (
    <div
      className="pp-shell"
      style={{
        alignItems: "center",
        justifyContent: "center",
        flexDirection: "column",
      }}
    >
      <div
        className="pp-card"
        style={{
          width: "min(420px, 92vw)",
          textAlign: "center",
        }}
      >
        <div className="pp-cardTitle" style={{ fontSize: 18, marginBottom: 8 }}>
          🥕 PantryPal Sign In
        </div>

        <div className="pp-muted" style={{ marginBottom: 12 }}>
          Use your registered email + password
        </div>

        <form onSubmit={handleSubmit} style={{ textAlign: "left" }}>
          <input
            ref={emailRef}
            className="pp-input"
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            style={{ width: "93%" }}
          />

          <div style={{ height: 10 }} />

          <input
            className="pp-input"
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            style={{ width: "93%" }}
          />

          {error && (
            <div style={{ marginTop: 10, textAlign: "center" }} className="pp-muted">
              ⚠️ {error}
            </div>
          )}

          <div style={{ height: 12 }} />

          <button type="submit" className="pp-btn pp-btnPrimary" style={{ width: "100%" }}>
            Sign in
          </button>

          {/* Create account link */}
          <div style={{ marginTop: 12, textAlign: "center" }}>
            <button
              type="button"
              className="pp-btn"
              style={{ width: "100%" }}
              onClick={onCreateAccount}
            >
              Create account
            </button>

            <div className="pp-muted" style={{ marginTop: 8 }}>
              (Demo accounts are stored locally in your browser)
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
