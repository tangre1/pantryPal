// App.jsx (or App.js)

import React, { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import "./App.css";
import { History, BookOpen, User, Carrot } from "lucide-react";

const API_BASE = "http://localhost:8000";

const PANELS = {
  HISTORY: "history",
  RECIPES: "recipes",
  USER: "user",
};

const RailButton = ({ title, active, onClick, onMouseEnter, children }) => (
  <button
    type="button"
    title={title}
    onClick={onClick}
    onMouseEnter={onMouseEnter}
    className={`pp-railBtn ${active ? "pp-railBtnActive" : ""}`}
  >
    {/* Wrap icon so emojis/SVG align consistently */}
    <span className="pp-railIcon" aria-hidden="true">
      {children}
    </span>
  </button>
);

const PanelShell = ({ title, subtitle, onClose, children }) => (
  <div className="pp-panel">
    <div className="pp-panelHeader">
      <div>
        <div className="pp-panelTitle">{title}</div>
        <div className="pp-panelSubtitle">{subtitle}</div>
      </div>

      <button
        type="button"
        onClick={onClose}
        className="pp-panelClose"
        aria-label="Close"
      >
        ✕
      </button>
    </div>

    <div className="pp-panelBody">{children}</div>
  </div>
);

function App() {
  const [activePanel, setActivePanel] = useState(null);
  const [panelPinned, setPanelPinned] = useState(false);

  // Ref for detecting outside clicks (rail + panel area)
  const leftRef = useRef(null);

  // Hover close timer
  const hoverCloseTimer = useRef(null);

  // Welcome modal
  const [showWelcome, setShowWelcome] = useState(false);

  // Stable ids
  const idRef = useRef(2);
  const nextId = () => {
    const id = idRef.current;
    idRef.current += 1;
    return id;
  };

  const [messages, setMessages] = useState([
    {
      id: 1,
      role: "assistant",
      content:
        "Hi, I’m PantryPal 🥕\nTell me what you’re shopping for and I’ll help with lists and meal ideas.",
    },
  ]);

  // Keep latest messages in a ref so chat history isn't stale inside async handlers
  const messagesRef = useRef(messages);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  const [imageResult, setImageResult] = useState(null);
  const [uploading, setUploading] = useState(false);

  const [snapshots, setSnapshots] = useState([]);
  const [loadingSnapshots, setLoadingSnapshots] = useState(false);

  const [recipes, setRecipes] = useState([]);
  const [loadingRecipes, setLoadingRecipes] = useState(false);

  const [newRecipeTitle, setNewRecipeTitle] = useState("");
  const [newRecipeTags, setNewRecipeTags] = useState("");
  const [newRecipeIngredients, setNewRecipeIngredients] = useState("");
  const [newRecipeSteps, setNewRecipeSteps] = useState("");
  const [creatingRecipe, setCreatingRecipe] = useState(false);

  const [user, setUser] = useState(null);
  const [loadingUser, setLoadingUser] = useState(false);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // ---------- Welcome modal (show once) ----------
  useEffect(() => {
    const seen = localStorage.getItem("pp_welcome_seen");
    if (!seen) setShowWelcome(true);
  }, []);

  const handleCloseWelcome = () => {
    setShowWelcome(false);
    localStorage.setItem("pp_welcome_seen", "1");
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  useEffect(() => {
    const onKeyDown = (e) => {
      if (!showWelcome) return;
      if (e.key === "Escape") handleCloseWelcome();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [showWelcome]);

  // ---------- Panel open/close behavior (hover preview + click-to-pin + outside click closes) ----------
  const closePanel = () => {
    setActivePanel(null);
    setPanelPinned(false);
  };

  const togglePanelPinned = (name) => {
    setActivePanel((prev) => {
      // clicking same icon toggles closed
      if (prev === name) {
        setPanelPinned(false);
        return null;
      }
      // clicking a different icon opens and pins
      setPanelPinned(true);
      return name;
    });
  };

  const requestOpenPanel = (name) => {
    if (hoverCloseTimer.current) clearTimeout(hoverCloseTimer.current);
    setActivePanel(name);
  };

  const requestClosePanelSoon = () => {
    if (hoverCloseTimer.current) clearTimeout(hoverCloseTimer.current);
    if (panelPinned) return;
    hoverCloseTimer.current = setTimeout(() => {
      setActivePanel(null);
    }, 180);
  };

  // Click outside the left rail+panel closes it (even if pinned)
  useEffect(() => {
    const onMouseDown = (e) => {
      if (!activePanel) return;
      const leftEl = leftRef.current;
      if (!leftEl) return;

      if (!leftEl.contains(e.target)) {
        closePanel();
      }
    };

    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [activePanel]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // -----------------------------
  // API: snapshots
  // -----------------------------
  const fetchSnapshots = async () => {
    setLoadingSnapshots(true);
    try {
      const res = await fetch(`${API_BASE}/api/snapshots`);
      if (!res.ok) throw new Error("Failed to fetch snapshots");
      const data = await res.json();
      setSnapshots(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      setSnapshots([]);
    } finally {
      setLoadingSnapshots(false);
    }
  };

  const deleteSnapshot = async (snapshotId) => {
    const ok = window.confirm("Delete this snapshot? This cannot be undone.");
    if (!ok) return;

    try {
      const res = await fetch(`${API_BASE}/api/snapshots/${snapshotId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Delete failed");
      await fetchSnapshots();
    } catch (err) {
      console.error(err);
      setMessages((prev) => [
        ...prev,
        {
          id: nextId(),
          role: "assistant",
          content: "⚠️ I couldn't delete that snapshot. Try again.",
        },
      ]);
    }
  };

  // -----------------------------
  // API: recipes
  // -----------------------------
  const fetchRecipes = async () => {
    setLoadingRecipes(true);
    try {
      const res = await fetch(`${API_BASE}/api/recipes`);
      if (!res.ok) throw new Error("Failed to fetch recipes");
      const data = await res.json();
      setRecipes(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Recipes fetch failed:", err);
      setRecipes([]);
    } finally {
      setLoadingRecipes(false);
    }
  };

  const createRecipe = async () => {
    const title = newRecipeTitle.trim();
    if (!title) return alert("Recipe title is required.");

    const tags = newRecipeTags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    const ingredients = newRecipeIngredients
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((name) => ({ name }));

    const steps = newRecipeSteps
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

    setCreatingRecipe(true);
    try {
      const res = await fetch(`${API_BASE}/api/recipes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: null,
          title,
          tags,
          ingredients,
          steps,
          source: "manual",
        }),
      });

      if (!res.ok) throw new Error("Failed to create recipe");

      setNewRecipeTitle("");
      setNewRecipeTags("");
      setNewRecipeIngredients("");
      setNewRecipeSteps("");

      await fetchRecipes();
    } catch (err) {
      console.error(err);
      alert("Could not create recipe. Check backend logs.");
    } finally {
      setCreatingRecipe(false);
    }
  };

  // -----------------------------
  // API: user (demo)
  // -----------------------------
  const fetchUser = async () => {
    setLoadingUser(true);
    try {
      const res = await fetch(`${API_BASE}/api/users/1`);
      if (!res.ok) throw new Error("No user found yet");
      const data = await res.json();
      setUser(data);
    } catch (err) {
      console.warn("User not available yet:", err?.message || err);
      setUser(null);
    } finally {
      setLoadingUser(false);
    }
  };

  useEffect(() => {
    fetchSnapshots();
  }, []);

  useEffect(() => {
    if (activePanel === PANELS.HISTORY) fetchSnapshots();
    if (activePanel === PANELS.RECIPES) fetchRecipes();
    if (activePanel === PANELS.USER) fetchUser();
  }, [activePanel]);

  // -----------------------------
  // Chat
  // -----------------------------
  const sendTextToChat = async (text) => {
    const trimmed = (text || "").trim();
    if (!trimmed || loading) return;

    // Add user message immediately
    setMessages((prev) => [
      ...prev,
      { id: nextId(), role: "user", content: trimmed },
    ]);
    setInput("");
    setLoading(true);

    // Use ref so we don't send stale history
    const historyToSend = [
      ...messagesRef.current.map((m) => ({ role: m.role, content: m.content })),
      { role: "user", content: trimmed },
    ];

    try {
      const res = await fetch(`${API_BASE}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: historyToSend }),
      });
      if (!res.ok) throw new Error("Request failed");
      const data = await res.json();

      setMessages((prev) => [
        ...prev,
        { id: nextId(), role: "assistant", content: data.reply },
      ]);
    } catch (err) {
      console.error(err);
      setMessages((prev) => [
        ...prev,
        {
          id: nextId(),
          role: "assistant",
          content:
            "😬 I had trouble reaching the PantryPal server. Make sure the backend is running on http://localhost:8000.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    await sendTextToChat(input);
  };

  // -----------------------------
  // Image upload
  // -----------------------------
  const handleImageChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setImageResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch(`${API_BASE}/api/image-to-json`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error("Image upload failed");

      const data = await res.json();
      setImageResult(data.data);

      setMessages((prev) => [
        ...prev,
        {
          id: nextId(),
          role: "assistant",
          content:
            "I analyzed the image and extracted these items:\n" +
            JSON.stringify(data.data, null, 2),
        },
      ]);

      await fetchSnapshots();
    } catch (err) {
      console.error(err);
      setMessages((prev) => [
        ...prev,
        {
          id: nextId(),
          role: "assistant",
          content: "⚠️ I couldn't process that image. Please try again.",
        },
      ]);
    } finally {
      setUploading(false);
      e.target.value = null;
    }
  };

  const formatDateTime = (isoString) => {
    try {
      return new Date(isoString).toLocaleString();
    } catch {
      return isoString;
    }
  };

  const handleUseSnapshot = async (snap) => {
    const items = snap?.data?.items || [];
    const itemsPretty = JSON.stringify(items, null, 2);

    const prompt = `
I scanned my fridge/pantry and these items were detected:

${itemsPretty}

Please do the following:
1) Suggest 3 dinner ideas that mostly use what I already have.
2) For each dinner, list "Already have" vs "Need to buy".
3) Give me one combined grocery list of missing items, grouped by category.
Keep it concise and practical.
`.trim();

    await sendTextToChat(prompt);
  };

  const isEmpty = messages.length <= 1;

  // -----------------------------
  // AI landing suggestions
  // -----------------------------
  const [suggestions, setSuggestions] = useState([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  const fallbackSuggestions = [
    {
      emoji: "🍳",
      label: "Use What I Have",
      prompt:
        "Use what I have at home to suggest 3 dinners, and tell me what's missing.",
    },
    {
      emoji: "🥗",
      label: "Fresh Meal Plan",
      prompt:
        "Plan 3 easy dinners for this week and give me one combined grocery list.",
    },
    {
      emoji: "💪",
      label: "High-Protein Ideas",
      prompt: "Suggest 3 high-protein dinners and give me a grocery list.",
    },
    {
      emoji: "🛒",
      label: "Smart Grocery List",
      prompt:
        "Ask me 5 quick questions, then build a grocery list grouped by category.",
    },
  ];

  const fetchSuggestions = async () => {
    setLoadingSuggestions(true);
    try {
      const res = await fetch(`${API_BASE}/api/suggestions`);
      if (!res.ok) throw new Error("Failed to fetch suggestions");
      const data = await res.json();
      const list = Array.isArray(data?.suggestions) ? data.suggestions : [];
      setSuggestions(list.length ? list : fallbackSuggestions);
    } catch (e) {
      console.warn("suggestions failed:", e);
      setSuggestions(fallbackSuggestions);
    } finally {
      setLoadingSuggestions(false);
    }
  };

  useEffect(() => {
    if (isEmpty) fetchSuggestions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEmpty]);

  const visibleSuggestions = (suggestions.length ? suggestions : fallbackSuggestions).slice(
    0,
    4
  );

  return (
    <div className="pp-shell">
      {/* Welcome modal */}
      {showWelcome && (
        <div
          className="pp-modalOverlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="pp-welcome-title"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) handleCloseWelcome();
          }}
        >
          <div className="pp-modal">
            <div className="pp-modalHeader">
              <div className="pp-modalBadge">🥕 PantryPal</div>

              <button
                type="button"
                className="pp-modalClose"
                onClick={handleCloseWelcome}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <h2 id="pp-welcome-title" className="pp-modalTitle">
              Welcome 👋
            </h2>

            <p className="pp-modalText">
              Tell me what you’re shopping for, or upload a pantry/fridge photo and I’ll
              suggest meals + a grocery list.
            </p>

            <div className="pp-modalGrid">
              <button
                type="button"
                className="pp-modalCard"
                onClick={() => {
                  handleCloseWelcome();
                  sendTextToChat(
                    "Use what I have at home to suggest 3 dinners, and tell me what's missing."
                  );
                }}
              >
                <div className="pp-modalCardIcon">🍳</div>
                <div>
                  <div className="pp-modalCardTitle">Use What I Have</div>
                  <div className="pp-modalCardSub">Get dinners from pantry items</div>
                </div>
              </button>

              <button
                type="button"
                className="pp-modalCard"
                onClick={() => {
                  handleCloseWelcome();
                  sendTextToChat(
                    "Plan 3 easy dinners for this week and give me one combined grocery list."
                  );
                }}
              >
                <div className="pp-modalCardIcon">🥗</div>
                <div>
                  <div className="pp-modalCardTitle">3-Dinner Plan</div>
                  <div className="pp-modalCardSub">Simple plan + one list</div>
                </div>
              </button>

              <button
                type="button"
                className="pp-modalCard"
                onClick={() => {
                  handleCloseWelcome();
                  sendTextToChat(
                    "Ask me 5 quick questions, then build a grocery list grouped by category."
                  );
                }}
              >
                <div className="pp-modalCardIcon">🛒</div>
                <div>
                  <div className="pp-modalCardTitle">Smart Grocery List</div>
                  <div className="pp-modalCardSub">Fast Q&A → organized list</div>
                </div>
              </button>

              <button
                type="button"
                className="pp-modalCard"
                onClick={() => {
                  handleCloseWelcome();
                  setTimeout(() => inputRef.current?.focus(), 0);
                }}
              >
                <div className="pp-modalCardIcon">💬</div>
                <div>
                  <div className="pp-modalCardTitle">Just Ask</div>
                  <div className="pp-modalCardSub">Type what you want to eat</div>
                </div>
              </button>
            </div>

            <div className="pp-modalActions">
              <button type="button" className="pp-btn" onClick={handleCloseWelcome}>
                Not now
              </button>

              <button
                type="button"
                className="pp-btn pp-btnPrimary"
                onClick={handleCloseWelcome}
              >
                Let’s go
              </button>
            </div>

            <div className="pp-modalHint">
              Tip: upload a pantry photo from the top right to auto-detect ingredients.
            </div>
          </div>
        </div>
      )}

      {/* LEFT SIDE: rail + panel as one full-height column */}
      <div
        className="pp-left"
        ref={leftRef}
        onMouseEnter={() => {
          if (hoverCloseTimer.current) clearTimeout(hoverCloseTimer.current);
        }}
        onMouseLeave={requestClosePanelSoon}
      >
        {/* Left rail */}
        <div className="pp-rail">
          <div className="pp-railBrand" aria-label="PantryPal">
            🥕
          </div>

          <RailButton
            title="Scan history"
            active={activePanel === PANELS.HISTORY}
            onClick={() => togglePanelPinned(PANELS.HISTORY)}
            onMouseEnter={() => requestOpenPanel(PANELS.HISTORY)}
          >
            <History size={20} />
          </RailButton>

          <RailButton
            title="Recipes"
            active={activePanel === PANELS.RECIPES}
            onClick={() => togglePanelPinned(PANELS.RECIPES)}
            onMouseEnter={() => requestOpenPanel(PANELS.RECIPES)}
          >
            <BookOpen size={20} />
          </RailButton>

          <RailButton
            title="User profile"
            active={activePanel === PANELS.USER}
            onClick={() => togglePanelPinned(PANELS.USER)}
            onMouseEnter={() => requestOpenPanel(PANELS.USER)}
          >
            <User size={20} />
          </RailButton>

          <div style={{ flex: 1 }} />
        </div>

        {/* Expandable panel */}
        {activePanel === PANELS.HISTORY && (
          <PanelShell
            title="Scan History"
            subtitle={panelPinned ? "Pinned • Click outside to hide" : "Hover away to hide"}
            onClose={closePanel}
          >
            <button type="button" onClick={fetchSnapshots} className="pp-btn">
              Refresh
            </button>

            {loadingSnapshots && <div className="pp-muted">Loading scans…</div>}

            {!loadingSnapshots && snapshots.length === 0 && (
              <div className="pp-muted">No scans yet. Upload an image to create one.</div>
            )}

            {snapshots.map((snap) => (
              <div key={snap.id} className="pp-card">
                <div className="pp-cardTitle" title={snap.label}>
                  {snap.label || `Snapshot #${snap.id}`}
                </div>
                <div className="pp-muted">{formatDateTime(snap.created_at)}</div>
                <div className="pp-muted">Items: {snap?.data?.items?.length ?? 0}</div>

                <div style={{ marginTop: 10 }}>
                  <button
                    type="button"
                    onClick={() => handleUseSnapshot(snap)}
                    className="pp-btn pp-btnPrimary"
                  >
                    Use this scan
                  </button>

                  <div style={{ height: 8 }} />

                  <button
                    type="button"
                    onClick={() => deleteSnapshot(snap.id)}
                    className="pp-btn"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </PanelShell>
        )}

        {activePanel === PANELS.RECIPES && (
          <PanelShell
            title="Recipes"
            subtitle={panelPinned ? "Pinned • Click outside to hide" : "Hover away to hide"}
            onClose={closePanel}
          >
            <button type="button" onClick={fetchRecipes} className="pp-btn">
              Refresh
            </button>

            <div className="pp-card" style={{ marginTop: 12 }}>
              <div className="pp-cardTitle" style={{ marginBottom: 10 }}>
                Create a recipe
              </div>

              <input
                value={newRecipeTitle}
                onChange={(e) => setNewRecipeTitle(e.target.value)}
                placeholder="Title (required)"
                className="pp-input"
                style={{ borderRadius: 12 }}
              />

              <div style={{ height: 10 }} />

              <input
                value={newRecipeTags}
                onChange={(e) => setNewRecipeTags(e.target.value)}
                placeholder="Tags (comma separated) e.g. dinner, easy"
                className="pp-input"
                style={{ borderRadius: 12 }}
              />

              <div style={{ height: 10 }} />

              <textarea
                value={newRecipeIngredients}
                onChange={(e) => setNewRecipeIngredients(e.target.value)}
                placeholder={"Ingredients (one per line)\nExample:\nChicken\nRice\nBroccoli"}
                rows={4}
                className="pp-input"
                style={{ borderRadius: 12, resize: "vertical" }}
              />

              <div style={{ height: 10 }} />

              <textarea
                value={newRecipeSteps}
                onChange={(e) => setNewRecipeSteps(e.target.value)}
                placeholder={"Steps (one per line)\nExample:\nCook chicken\nCook rice\nServe together"}
                rows={4}
                className="pp-input"
                style={{ borderRadius: 12, resize: "vertical" }}
              />

              <div style={{ height: 12 }} />

              <button
                type="button"
                onClick={createRecipe}
                disabled={creatingRecipe}
                className="pp-btn pp-btnPrimary"
                style={{ opacity: creatingRecipe ? 0.7 : 1 }}
              >
                {creatingRecipe ? "Saving…" : "Save recipe"}
              </button>
            </div>

            {loadingRecipes && <div className="pp-muted">Loading recipes…</div>}

            {!loadingRecipes && recipes.length === 0 && (
              <div className="pp-muted">No recipes yet. Create one above.</div>
            )}

            {recipes.map((r) => (
              <div key={r.id} className="pp-card">
                <div className="pp-cardTitle">{r.title}</div>
                <div className="pp-muted">
                  {Array.isArray(r.tags) ? r.tags.join(", ") : ""}
                </div>
                <div className="pp-muted">
                  Ingredients: {Array.isArray(r.ingredients) ? r.ingredients.length : 0} • Steps:{" "}
                  {Array.isArray(r.steps) ? r.steps.length : 0}
                </div>
              </div>
            ))}
          </PanelShell>
        )}

        {activePanel === PANELS.USER && (
          <PanelShell
            title="User Profile"
            subtitle={panelPinned ? "Pinned • Click outside to hide" : "Hover away to hide"}
            onClose={closePanel}
          >
            <div className="pp-muted" style={{ marginBottom: 12 }}>
              For demo purposes this tries to load user id <b>1</b>:
              <div style={{ marginTop: 6, fontFamily: "monospace", fontSize: 12 }}>
                GET /api/users/1
              </div>
            </div>

            {loadingUser && <div className="pp-muted">Loading user…</div>}

            {!loadingUser && !user && (
              <div className="pp-muted">
                No user loaded yet. Create one via POST /api/users, or change the fetchUser()
                function.
              </div>
            )}

            {user && (
              <div className="pp-card">
                <div style={{ fontWeight: 900, fontSize: 16 }}>{user.name}</div>

                <div className="pp-muted" style={{ marginTop: 8, color: "var(--text)" }}>
                  Budget: <b>{user.budget_style}</b>
                </div>
                <div className="pp-muted" style={{ color: "var(--text)" }}>
                  Household size: <b>{user.household_size}</b>
                </div>

                <div className="pp-muted" style={{ marginTop: 12 }}>
                  Dietary prefs:
                </div>

                <pre
                  style={{
                    marginTop: 8,
                    padding: 12,
                    background: "#0b1220",
                    color: "#e5e7eb",
                    borderRadius: 12,
                    fontSize: 12,
                    overflowX: "auto",
                  }}
                >
                  {JSON.stringify(user.dietary_prefs, null, 2)}
                </pre>
              </div>
            )}
          </PanelShell>
        )}
      </div>

      {/* Main chat panel */}
      <div className="pp-main">
        <header className="pp-topbar">
          <div className="pp-topbarInner">
            <div>
              <h1 className="pp-title">PantryPal</h1>
              <p className="pp-subtitle">Grocery & meal planning assistant</p>
            </div>

            <div className="pp-actions">
              <span className="pp-pill">beta</span>

              <label className={`pp-upload ${uploading ? "pp-uploadDisabled" : ""}`}>
                {uploading ? "Analyzing..." : "Upload image"}
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  style={{ display: "none" }}
                />
              </label>
            </div>
          </div>
        </header>

        <div className="pp-chatWrap">
          <div className="pp-chatColumn">
            {isEmpty && (
              <div className="pp-landing">
                <div className="pp-empty">
                  <div className="pp-emptyTop">
                    <div className="pp-emptyIcon">
                      <Carrot size={18} />
                    </div>
                    <div>
                      <p className="pp-emptyTitle">What are we shopping for?</p>
                      <p className="pp-emptySub">
                        Start with a goal — dinner ideas, a grocery list, or “use what I have.”
                      </p>
                    </div>
                  </div>

                  <div className="pp-chipRow">
                    {loadingSuggestions && visibleSuggestions.length === 0 ? (
                      <div className="pp-muted" style={{ marginTop: 8 }}>
                        Generating suggestions…
                      </div>
                    ) : (
                      visibleSuggestions.map((s, idx) => (
                        <button
                          key={`${s.label}-${idx}`}
                          type="button"
                          className="pp-chip"
                          onClick={() => sendTextToChat(s.prompt)}
                        >
                          {s.emoji ? `${s.emoji} ` : ""}
                          {s.label}
                        </button>
                      ))
                    )}
                  </div>

                  <div className="pp-chipHint">
                    Tip: you can also upload a pantry photo to generate meals automatically.
                  </div>
                </div>

                <div className="pp-intro">
                  <div className="pp-introTop">
                    <div className="pp-introAvatar">
                      <Carrot size={16} />
                    </div>
                    <div className="pp-introName">PantryPal</div>
                  </div>
                  <p className="pp-introText">
                    Tell me what you’re shopping for and I’ll help with lists and meal ideas.
                  </p>
                </div>
              </div>
            )}

            {!isEmpty &&
              messages.map((m) => (
                <div
                  key={m.id}
                  className={`pp-row ${m.role === "user" ? "pp-rowUser" : "pp-rowBot"}`}
                >
                  <div
                    className={`pp-bubble ${
                      m.role === "user" ? "pp-bubbleUser" : "pp-bubbleBot"
                    }`}
                  >
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {m.content}
                    </ReactMarkdown>
                  </div>
                </div>
              ))}

            {loading && <div className="pp-thinking">PantryPal is thinking…</div>}

            {imageResult && (
              <pre
                style={{
                  marginTop: 14,
                  padding: 12,
                  background: "#0b1220",
                  color: "#e5e7eb",
                  borderRadius: 12,
                  fontSize: 12,
                  overflowX: "auto",
                }}
              >
                {JSON.stringify(imageResult, null, 2)}
              </pre>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        <form onSubmit={sendMessage} className="pp-composer">
          <div className="pp-composerInner">
            <input
              ref={inputRef}
              type="text"
              placeholder='Ask: "Make a grocery list for taco night"'
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="pp-input"
            />

            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="pp-send"
            >
              {loading ? "Sending…" : "Send"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default App;
