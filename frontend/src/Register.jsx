// Register.jsx
import React, { useEffect, useRef, useState } from "react";
import "./App.css";

const SESSION_KEY = "pp_user";
const ACCOUNTS_KEY = "pp_accounts";

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

export default function Register({ onAuthed, onGoToSignIn }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");

  const nameRef = useRef(null);

  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  const handleRegister = (e) => {
    e.preventDefault();
    setError("");

    const trimmedName = (name || "").trim();
    const trimmedEmail = normalizeEmail(email);
    const trimmedPassword = (password || "").trim();
    const trimmedConfirm = (confirm || "").trim();

    if (!trimmedName) return setError("Please enter your name.");
    if (!trimmedEmail) return setError("Please enter an email.");
    if (!trimmedPassword) return setError("Please enter a password.");
    if (trimmedPassword.length < 4) return setError("Password must be at least 4 characters.");
    if (trimmedPassword !== trimmedConfirm) return setError("Passwords do not match.");

    const accounts = safeJsonParse(localStorage.getItem(ACCOUNTS_KEY), []);
    const list = Array.isArray(accounts) ? accounts : [];

    const exists = list.some((a) => normalizeEmail(a.email) === trimmedEmail);
    if (exists) {
      setError("An account with that email already exists. Try signing in.");
      return;
    }

    const newAccount = {
      id: Date.now(),
      name: trimmedName,
      email: trimmedEmail,
      password: trimmedPassword, // demo only (NOT secure)
      created_at: new Date().toISOString(),
    };

    try {
      localStorage.setItem(ACCOUNTS_KEY, JSON.stringify([...list, newAccount]));
    } catch (err) {
      console.error(err);
      setError("Could not save account (localStorage blocked).");
      return;
    }

    // Auto sign-in after registering
    const sessionUser = { id: newAccount.id, name: newAccount.name, email: newAccount.email };
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify(sessionUser));
    } catch {}

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
      <div className="pp-card" style={{ width: "min(420px, 92vw)", textAlign: "center" }}>
        <div className="pp-cardTitle" style={{ fontSize: 18, marginBottom: 8 }}>
          🥕 Create Account
        </div>

        <div className="pp-muted" style={{ marginBottom: 12 }}>
          Demo register (saved locally in your browser)
        </div>

        <form onSubmit={handleRegister} style={{ textAlign: "left" }}>
          <input
            ref={nameRef}
            className="pp-input"
            placeholder="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
            style={{ width: "100%" }}
          />

          <div style={{ height: 10 }} />

          <input
            className="pp-input"
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            style={{ width: "100%" }}
          />

          <div style={{ height: 10 }} />

          <input
            className="pp-input"
            type="password"
            placeholder="Password (min 4 chars)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            style={{ width: "100%" }}
          />

          <div style={{ height: 10 }} />

          <input
            className="pp-input"
            type="password"
            placeholder="Confirm password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
            style={{ width: "100%" }}
          />

          {error && (
            <div style={{ marginTop: 10, textAlign: "center" }} className="pp-muted">
              ⚠️ {error}
            </div>
          )}

          <div style={{ height: 12 }} />

          <button type="submit" className="pp-btn pp-btnPrimary" style={{ width: "100%" }}>
            Create account
          </button>

          <div style={{ marginTop: 12 }}>
            <button type="button" className="pp-btn" style={{ width: "100%" }} onClick={onGoToSignIn}>
              Back to sign in
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
