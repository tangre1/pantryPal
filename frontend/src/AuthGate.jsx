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
          <div className="pp-authBrandRow">
            <img
            src={`${import.meta.env.BASE_URL}apple-touch-icon.png`}
            alt="PantryPal logo"
            className="pp-authLogo"
            />
            <div className="pp-authBrandText">
              <div className="pp-cardTitle" style={{ fontSize: 28, marginBottom: 0 }}>
                PantryPal
              </div>
              <div className="pp-muted">Smart pantry & meal planning</div>
            </div>
          </div>

          <div className="pp-authBadge">From our 🥕 PantryPal to your plate</div>

          <h1 className="pp-authHeading">
            Smarter Grocery Planning Starts Here!
          </h1>

          <p className="pp-authLead">
            Plan meals, Reduce waste, and Turn pantry ingredients into Dinner Ideas.
          </p>

          <div className="pp-authHighlights">
            <span> Meal ideas</span>
            <span> Smart grocery lists</span>
            <span> Pantry photo scanning</span>
          </div>
        </div>


        <div className="pp-authCard">
          <div className="pp-authTitle">Welcome back</div>

          <div
            className="pp-muted"
            style={{ textAlign: "center", marginBottom: 14 }}
          >
            Sign in to continue to PantryPal
          </div>

          <form onSubmit={handleSubmit} className="pp-authForm">
            <input
              ref={emailRef}
              className="pp-input pp-authInput"
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />

            <div style={{ height: 12 }} />

            <input
              className="pp-input pp-authInput"
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />

            {error && (
              <div
                className="pp-muted"
                style={{ marginTop: 12, textAlign: "center" }}
              >
                ⚠️ {error}
              </div>
            )}

            <div style={{ height: 14 }} />

            <button
              type="submit"
              className="pp-btn pp-btnPrimary"
              style={{ width: "100%" }}
            >
              Sign in
            </button>

            <div className="pp-authFooter">
              <span className="pp-muted" style={{ marginTop: 0 }}>
                New here?
              </span>
              <button
                type="button"
                className="pp-linkBtn"
                onClick={onCreateAccount}
              >
                Create account
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}