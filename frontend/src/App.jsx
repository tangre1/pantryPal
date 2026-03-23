// App.jsx

import React, { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import "./App.css";
import AuthGate from "./AuthGate.jsx";
import Register from "./Register.jsx";
import { History, BookOpen, User, Carrot, UploadCloud } from "lucide-react";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000";

const PANELS = {
  HISTORY: "history",
  RECIPES: "recipes",
  USER: "user",
};

const STORAGE_KEY = "pp_user";

const HOME_MESSAGE = {
  id: 1,
  role: "assistant",
  content:
    "Hi, I’m PantryPal 🥕\nTell me what you’re shopping for and I’ll help with lists and meal ideas.",
};

function readSavedUser() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

const RailButton = ({ title, active, onClick, onMouseEnter, children }) => (
  <button
    type="button"
    title={title}
    onClick={onClick}
    onMouseEnter={onMouseEnter}
    className={`pp-railBtn ${active ? "pp-railBtnActive" : ""}`}
  >
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

export default function App() {
  const [sessionUser, setSessionUser] = useState(() => readSavedUser());
  const [authMode, setAuthMode] = useState("signin");

  const handleAuthed = (user) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
    } catch {}
    setSessionUser(user);
  };

  const signOut = () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
    setSessionUser(null);
    setAuthMode("signin");
  };

  return sessionUser ? (
    <PantryPalApp sessionUser={sessionUser} signOut={signOut} />
  ) : authMode === "register" ? (
    <Register
      onAuthed={handleAuthed}
      onGoToSignIn={() => setAuthMode("signin")}
    />
  ) : (
    <AuthGate
      onAuthed={handleAuthed}
      onCreateAccount={() => setAuthMode("register")}
    />
  );
}

function PantryPalApp({ sessionUser, signOut }) {
  const [activePanel, setActivePanel] = useState(null);
  const [panelPinned, setPanelPinned] = useState(false);

  const leftRef = useRef(null);
  const hoverCloseTimer = useRef(null);

  const [showWelcome, setShowWelcome] = useState(false);

  const idRef = useRef(2);
  const nextId = () => {
    const id = idRef.current;
    idRef.current += 1;
    return id;
  };

  const [messages, setMessages] = useState([HOME_MESSAGE]);
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
  const fileInputRef = useRef(null);

  const [dragOver, setDragOver] = useState(false);
  const [pendingFile, setPendingFile] = useState(null);
  const [pendingPreviewUrl, setPendingPreviewUrl] = useState(null);

  const [suggestions, setSuggestions] = useState([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  const fallbackSuggestions = [
    {
      label: "Weekly Grocery List",
      prompt:
        "Build me a weekly grocery list with a few meal ideas, grouped by category.",
    },
    {
      label: "Quick Meal Plan",
      prompt:
        "Plan 3 quick dinners for this week and give me one combined grocery list.",
    },
    {
      label: "Save on Groceries",
      prompt:
        "Help me save money on groceries this week—suggest a budget meal plan and list.",
    },
    {
      label: "High-Protein Ideas",
      prompt: "Suggest 3 high-protein dinners and give me a grocery list.",
    },
  ];

  const isEmpty = messages.length <= 1;
  const visibleSuggestions = (
    suggestions.length ? suggestions : fallbackSuggestions
  ).slice(0, 4);

  const attachFile = (file) => {
    if (!file) return;

    if (!file.type?.startsWith("image/")) {
      setMessages((prev) => [
        ...prev,
        {
          id: nextId(),
          role: "assistant",
          content: "⚠️ Please attach an image file.",
        },
      ]);
      return;
    }

    if (pendingPreviewUrl) URL.revokeObjectURL(pendingPreviewUrl);

    setPendingFile(file);
    setPendingPreviewUrl(URL.createObjectURL(file));
  };

  const clearAttachment = () => {
    if (pendingPreviewUrl) URL.revokeObjectURL(pendingPreviewUrl);
    setPendingFile(null);
    setPendingPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  useEffect(() => {
    return () => {
      if (pendingPreviewUrl) URL.revokeObjectURL(pendingPreviewUrl);
    };
  }, [pendingPreviewUrl]);

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

  const closePanel = () => {
    setActivePanel(null);
    setPanelPinned(false);
  };

  const goHome = () => {
    closePanel();
    clearAttachment();
    setInput("");
    setLoading(false);
    setUploading(false);
    setImageResult(null);
    setMessages([HOME_MESSAGE]);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const togglePanelPinned = (name) => {
    setActivePanel((prev) => {
      if (prev === name) {
        setPanelPinned(false);
        return null;
      }
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

  useEffect(() => {
    const onMouseDown = (e) => {
      if (!activePanel) return;
      const leftEl = leftRef.current;
      if (!leftEl) return;
      if (!leftEl.contains(e.target)) closePanel();
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
    if (!title) {
      alert("Recipe title is required.");
      return;
    }

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

  const chatWithAssistant = async (userText) => {
    const trimmed = (userText || "").trim();
    if (!trimmed) return;

    setLoading(true);

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

  const sendTextToChat = async (text) => {
    const trimmed = (text || "").trim();
    if (!trimmed || loading) return;

    setMessages((prev) => [
      ...prev,
      { id: nextId(), role: "user", content: trimmed },
    ]);
    setInput("");
    await chatWithAssistant(trimmed);
  };

  const analyzeImageFile = async (file) => {
    if (!file) return null;

    if (!file.type?.startsWith("image/")) {
      setMessages((prev) => [
        ...prev,
        {
          id: nextId(),
          role: "assistant",
          content: "⚠️ Please attach an image file (JPG/PNG/HEIC/WebP).",
        },
      ]);
      return null;
    }

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
      const extracted = data?.data ?? null;

      setImageResult(extracted);
      await fetchSnapshots();

      return extracted;
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
      return null;
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    attachFile(file);
  };

  const onDragOver = (e) => {
    e.preventDefault();
    if (uploading) return;
    setDragOver(true);
  };

  const onDragLeave = (e) => {
    if (e.currentTarget.contains(e.relatedTarget)) return;
    setDragOver(false);
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    if (uploading) return;

    const file = e.dataTransfer?.files?.[0];
    if (!file) return;
    attachFile(file);
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (loading || uploading) return;

    const text = input.trim();
    const file = pendingFile;

    if (!text && !file) return;

    const userBubble =
      (text ? text : "") +
      (file ? (text ? "\n\n" : "") + "📷 (image attached)" : "");

    setMessages((prev) => [
      ...prev,
      { id: nextId(), role: "user", content: userBubble },
    ]);
    setInput("");

    if (!file) {
      await chatWithAssistant(text);
      return;
    }

    const extracted = await analyzeImageFile(file);
    clearAttachment();

    const items = extracted?.items ?? extracted ?? null;

    const prompt = [
      "I uploaded a pantry/fridge image and you extracted these items (JSON):",
      "```json",
      JSON.stringify(items, null, 2),
      "```",
      "",
      text
        ? `User request: ${text}`
        : "User request: Suggest 3 dinner ideas that mostly use what I have, and list what to buy.",
      "",
      "Please respond with:",
      "1) 3 meal ideas",
      "2) For each: Already have vs Need to buy",
      "3) One combined grocery list grouped by category",
      "Keep it concise and practical.",
    ].join("\n");

    await chatWithAssistant(prompt);
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
  }, [isEmpty]);

  return (
    <div className="pp-shell">
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
              Tell me what you’re shopping for, or attach a pantry/fridge photo
              and I’ll suggest meals + a grocery list.
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
                  <div className="pp-modalCardSub">
                    Get dinners from pantry items
                  </div>
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
                  <div className="pp-modalCardSub">
                    Fast Q&amp;A → organized list
                  </div>
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
              <button
                type="button"
                className="pp-btn"
                onClick={handleCloseWelcome}
              >
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
              Tip: attach a pantry photo from the top right, then press Send.
            </div>
          </div>
        </div>
      )}

      <div
        className="pp-left"
        ref={leftRef}
        onMouseEnter={() => {
          if (hoverCloseTimer.current) clearTimeout(hoverCloseTimer.current);
        }}
        onMouseLeave={requestClosePanelSoon}
      >
        <div className="pp-rail">
          <button
            className="pp-railBrand"
            aria-label="PantryPal"
            title="Go home"
            type="button"
            onClick={goHome}
          >
            🥕
          </button>

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

        {activePanel === PANELS.HISTORY && (
          <PanelShell
            title="Scan History"
            subtitle={
              panelPinned ? "Pinned • Click outside to hide" : "Hover away to hide"
            }
            onClose={closePanel}
          >
            <button type="button" onClick={fetchSnapshots} className="pp-btn">
              Refresh
            </button>

            {loadingSnapshots && <div className="pp-muted">Loading scans…</div>}

            {!loadingSnapshots && snapshots.length === 0 && (
              <div className="pp-muted">
                No scans yet. Upload an image to create one.
              </div>
            )}

            {snapshots.map((snap) => (
              <div key={snap.id} className="pp-card">
                <div className="pp-cardTitle" title={snap.label}>
                  {snap.label || `Snapshot #${snap.id}`}
                </div>
                <div className="pp-muted">{formatDateTime(snap.created_at)}</div>
                <div className="pp-muted">
                  Items: {snap?.data?.items?.length ?? 0}
                </div>

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
            subtitle={
              panelPinned ? "Pinned • Click outside to hide" : "Hover away to hide"
            }
            onClose={closePanel}
          >
            <button type="button" onClick={fetchRecipes} className="pp-btn">
              Refresh
            </button>

            <div style={{ height: 12 }} />

            <div className="pp-card">
              <div className="pp-cardTitle">Add a recipe</div>

              <input
                className="pp-input"
                placeholder="Recipe title"
                value={newRecipeTitle}
                onChange={(e) => setNewRecipeTitle(e.target.value)}
              />

              <div style={{ height: 8 }} />

              <input
                className="pp-input"
                placeholder="Tags (comma separated)"
                value={newRecipeTags}
                onChange={(e) => setNewRecipeTags(e.target.value)}
              />

              <div style={{ height: 8 }} />

              <textarea
                className="pp-input"
                rows={4}
                placeholder="Ingredients (one per line)"
                value={newRecipeIngredients}
                onChange={(e) => setNewRecipeIngredients(e.target.value)}
              />

              <div style={{ height: 8 }} />

              <textarea
                className="pp-input"
                rows={4}
                placeholder="Steps (one per line)"
                value={newRecipeSteps}
                onChange={(e) => setNewRecipeSteps(e.target.value)}
              />

              <div style={{ height: 10 }} />

              <button
                type="button"
                className="pp-btn pp-btnPrimary"
                onClick={createRecipe}
                disabled={creatingRecipe}
              >
                {creatingRecipe ? "Creating..." : "Create recipe"}
              </button>
            </div>

            <div style={{ height: 12 }} />

            {loadingRecipes && <div className="pp-muted">Loading recipes…</div>}

            {!loadingRecipes && recipes.length === 0 && (
              <div className="pp-muted">No recipes yet.</div>
            )}

            {recipes.map((recipe) => (
              <div key={recipe.id} className="pp-card">
                <div className="pp-cardTitle">{recipe.title}</div>

                {!!recipe.tags?.length && (
                  <div className="pp-muted">Tags: {recipe.tags.join(", ")}</div>
                )}

                {!!recipe.ingredients?.length && (
                  <div className="pp-muted" style={{ marginTop: 6 }}>
                    Ingredients:{" "}
                    {recipe.ingredients
                      .map((ing) => ing.name || ing)
                      .join(", ")}
                  </div>
                )}
              </div>
            ))}
          </PanelShell>
        )}

        {activePanel === PANELS.USER && (
          <PanelShell
            title="User Profile"
            subtitle={
              panelPinned ? "Pinned • Click outside to hide" : "Hover away to hide"
            }
            onClose={closePanel}
          >
            <button type="button" onClick={fetchUser} className="pp-btn">
              Refresh
            </button>

            <div style={{ height: 12 }} />

            {loadingUser && <div className="pp-muted">Loading user…</div>}

            {!loadingUser && !user && (
              <div className="pp-card">
                <div className="pp-cardTitle">{sessionUser?.name || "Guest"}</div>
                <div className="pp-muted">{sessionUser?.email || "No email"}</div>
              </div>
            )}

            {!loadingUser && user && (
              <div className="pp-card">
                <div className="pp-cardTitle">{user.name || sessionUser?.name}</div>
                <div className="pp-muted">{user.email || sessionUser?.email}</div>
              </div>
            )}
          </PanelShell>
        )}
      </div>

      <div className="pp-main">
        <header className="pp-topbar">
          <div className="pp-topbarInner">
            <div>
              <h1 className="pp-title">PantryPal</h1>
              <p className="pp-subtitle">Grocery & meal planning assistant</p>
            </div>

            <div className="pp-actions">
              <span className="pp-pill">beta</span>

              <span className="pp-muted" style={{ marginRight: 6 }}>
                Hi, <b style={{ color: "var(--text)" }}>{sessionUser?.name}</b>
              </span>

              <button
                type="button"
                className="pp-btn"
                style={{ width: "auto" }}
                onClick={signOut}
              >
                Sign out
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                style={{ display: "none" }}
              />

              <button
                type="button"
                className={`pp-uploadBtn ${uploading ? "pp-uploadDisabled" : ""}`}
                onClick={() => {
                  if (uploading) return;
                  fileInputRef.current?.click();
                }}
                aria-label="Upload image"
              >
                <UploadCloud size={16} />
                {pendingFile ? "Image attached" : "Upload image"}
              </button>
            </div>
          </div>
        </header>

        <div
          className={`pp-chatWrap ${dragOver ? "pp-chatWrapDrag" : ""}`}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
        >
          {dragOver && !uploading && (
            <div className="pp-dropOverlay" aria-hidden="true">
              <div className="pp-dropCard">
                <div className="pp-dropIcon">
                  <UploadCloud size={18} />
                </div>
                <div className="pp-dropTitle">Drop to attach</div>
                <div className="pp-dropSub">Then type a message and press Send</div>
              </div>
            </div>
          )}

          <div className="pp-chatColumn">
            {isEmpty && (
              <>
                <div className="pp-empty">
                  <div className="pp-emptyContent">
                    <div className="pp-emptyLeft">
                      <div className="pp-emptyTop">
                        <div className="pp-emptyIcon">
                          <Carrot size={18} />
                        </div>
                        <div>
                          <p className="pp-emptyTitle">
                            Let&apos;s get started! What are we looking for today?
                          </p>
                          <p className="pp-emptySub">
                            Choose your meal and we’ll handle the rest!
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
                        Tip: drag &amp; drop a pantry photo to attach it, then press
                        Send.
                      </div>
                    </div>

                    <div className="pp-emptyArt">
                    </div>
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
                    Tell me what you’re shopping for and I’ll help with lists and
                    meal ideas.
                  </p>
                </div>
              </>
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

            {(uploading || loading) && (
              <div className="pp-thinking">
                {uploading ? "Analyzing image…" : "PantryPal is thinking…"}
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>
        </div>

        <form className="pp-composer" onSubmit={sendMessage}>
          {pendingPreviewUrl && (
            <div className="pp-attachPreview">
              <img
                src={pendingPreviewUrl}
                alt="Attached preview"
                className="pp-attachThumb"
              />
              <button
                type="button"
                className="pp-btn"
                onClick={clearAttachment}
                style={{ width: "auto" }}
              >
                Remove
              </button>
            </div>
          )}

          <div className="pp-composeRow">
            <input
              ref={inputRef}
              className="pp-input"
              placeholder='Ask: "Make a grocery list for taco night"'
              value={input}
              onChange={(e) => setInput(e.target.value)}
            />

            <button
              type="submit"
              className="pp-send"
              disabled={loading || uploading}
            >
              {loading || uploading ? "Working..." : "Send"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}