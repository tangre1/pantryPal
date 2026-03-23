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
  className="pp-shell pp-authShell"
  style={{
    backgroundImage: `
      linear-gradient(rgba(248,244,236,0.45), rgba(248,244,236,0.55)),
      radial-gradient(circle at left center, rgba(248,244,236,0.85) 0%, rgba(248,244,236,0.45) 40%, rgba(248,244,236,0.15) 70%, rgba(248,244,236,0.05) 100%),
      url(${import.meta.env.BASE_URL}pantry.jpg)
    `,
    backgroundPosition: "center",
    backgroundSize: "cover",
    backgroundRepeat: "no-repeat",
  }}
>
    <div className="pp-authHero">
      <div className="pp-authVisual">
        <div className="pp-authBadge">🥕 PantryPal</div>
        <h1 className="pp-authHeading">Create your PantryPal account today!</h1>
        <p className="pp-authLead">
         Transform everyday ingredients into inspired meals, discover recipes, save time, and cook with confidence.
        </p>
        <div className="pp-authHighlights">
          <span> Scan ingredients</span>
          <span> Get recipe ideas</span>
          <span> Save on groceries</span>
        </div>
      </div>

      <div className="pp-authCard">
        <div className="pp-authTitle">Create account</div>
        <div className="pp-muted" style={{ textAlign: "center", marginBottom: 14 }}>
          Demo account saved locally in your browser
        </div>

        <form onSubmit={handleRegister} className="pp-authForm">
          <input
            ref={nameRef}
            className="pp-input pp-authInput"
            placeholder="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
          />

          <div style={{ height: 12 }} />

          <input
            className="pp-input pp-authInput"
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
          />

          <div style={{ height: 12 }} />

          <input
            className="pp-input pp-authInput"
            type="password"
            placeholder="Password (min 4 chars)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
          />

          <div style={{ height: 12 }} />

          <input
            className="pp-input pp-authInput"
            type="password"
            placeholder="Confirm password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            autoComplete="new-password"
          />

          {error && (
            <div style={{ marginTop: 12, textAlign: "center" }} className="pp-muted">
              ⚠️ {error}
            </div>
          )}

          <div style={{ height: 14 }} />

          <button type="submit" className="pp-btn pp-btnPrimary" style={{ width: "100%" }}>
            Create account
          </button>

          <div className="pp-authFooter">
            <span className="pp-muted" style={{ marginTop: 0 }}>Already have an account?</span>
            <button type="button" className="pp-linkBtn" onClick={onGoToSignIn}>
              Back to sign in
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
);
}