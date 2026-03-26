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

// -----------------------------
// Demo Auth (localStorage)
// -----------------------------
const STORAGE_KEY = "pp_user";

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

// ✅ App only manages auth/session (stable hook order)
export default function App() {
  const [sessionUser, setSessionUser] = useState(() => readSavedUser());
  const [authMode, setAuthMode] = useState("signin"); // "signin" | "register"

  const handleAuthed = (user) => {
    // Persist immediately so refresh isn't required
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

  // ✅ Keep returns after hooks + handlers are defined
  return sessionUser ? (
    <PantryPalApp sessionUser={sessionUser} signOut={signOut} />
  ) : authMode === "register" ? (
    <Register onAuthed={handleAuthed} onGoToSignIn={() => setAuthMode("signin")} />
  ) : (
    <AuthGate onAuthed={handleAuthed} onCreateAccount={() => setAuthMode("register")} />
  );
}

// ✅ Everything else moved into a child component so hooks are consistent
function PantryPalApp({ sessionUser, signOut }) {
  // -----------------------------
  // PantryPal UI State
  // -----------------------------
  const [activePanel, setActivePanel] = useState(null);
  const [panelPinned, setPanelPinned] = useState(false);

  const leftRef = useRef(null);
  const hoverCloseTimer = useRef(null);

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

  // keep extracted result internally (not rendered)
  const [imageResult, setImageResult] = useState(null);
  const [uploading, setUploading] = useState(false);

  const [snapshots, setSnapshots] = useState([]);
  const [loadingSnapshots, setLoadingSnapshots] = useState(false);

  const [recipes, setRecipes] = useState([]);
  const [loadingRecipes, setLoadingRecipes] = useState(false);

  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [newRecipeTitle, setNewRecipeTitle] = useState("");
  const [newRecipeTags, setNewRecipeTags] = useState("");
  const [newRecipeIngredients, setNewRecipeIngredients] = useState("");
  const [newRecipeSteps, setNewRecipeSteps] = useState("");
  const [creatingRecipe, setCreatingRecipe] = useState(false);
  const [userProfile, setUserProfile] = useState(null);
  const [loadingUser, setLoadingUser] = useState(false);

  function readStoredAccounts() {
    try {
      return JSON.parse(localStorage.getItem("pp_accounts") || "[]");
    } catch {
      return [];
    }
  }

  const fetchUser = async () => {
    setLoadingUser(true);
    try {
      const accounts = readStoredAccounts();
      const match = Array.isArray(accounts)
        ? accounts.find((a) => String(a.id) === String(sessionUser?.id))
        : null;

      if (!match) {
        setUserProfile({
          id: sessionUser?.id ?? null,
          name: sessionUser?.name || "User",
          email: sessionUser?.email || "",
          budget_style: "balanced",
          household_size: 1,
          dietary_prefs: {
            diet: "none",
            allergies: [],
            dislikes: [],
          },
        });
        return;
      }

      setUserProfile({
        id: match.id,
        name: match.name || "User",
        email: match.email || "",
        budget_style: match.budget_style || "balanced",
        household_size: match.household_size || 1,
        dietary_prefs: match.dietary_prefs || {
          diet: "none",
          allergies: [],
          dislikes: [],
        },
        created_at: match.created_at,
      });
    } catch (err) {
      console.error("Failed to load local profile:", err);
      setUserProfile(null);
    } finally {
      setLoadingUser(false);
    }
  };

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Upload input ref (so dropzone + button share the same input)
  const fileInputRef = useRef(null);

  // Drag/drop UI state
  const [dragOver, setDragOver] = useState(false);

  // Pending attachment (attach now, upload on Send)
  const [pendingFile, setPendingFile] = useState(null);
  const [pendingPreviewUrl, setPendingPreviewUrl] = useState(null);

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

  // Cleanup preview URL on unmount
  useEffect(() => {
    return () => {
      if (pendingPreviewUrl) URL.revokeObjectURL(pendingPreviewUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  // ---------- Panel open/close behavior ----------
  const closePanel = () => {
    setActivePanel(null);
    setPanelPinned(false);
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
    const recipeList = Array.isArray(data) ? data : [];

    setRecipes(recipeList);

    // Keep selected recipe in sync after refresh
    setSelectedRecipe((prev) => {
      if (!recipeList.length) return null;
      if (!prev) return recipeList[0];

      const updatedMatch = recipeList.find((recipe) => recipe.id === prev.id);
      return updatedMatch || recipeList[0];
    });
  } catch (err) {
    console.error("Recipes fetch failed:", err);
    setRecipes([]);
    setSelectedRecipe(null);
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

  useEffect(() => {
    fetchSnapshots();
  }, []);

  useEffect(() => {
    if (activePanel === PANELS.HISTORY) fetchSnapshots();
    if (activePanel === PANELS.RECIPES) fetchRecipes();
    if (activePanel === PANELS.USER) fetchUser();
  }, [activePanel]);

  // -----------------------------
  // Chat (generic)
  // -----------------------------
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

  // Used in other places (welcome chips, snapshot actions)
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

  const handleUseRecipe = async (recipe) => {
    if (!recipe) return;

    setSelectedRecipe(recipe);

    const ingredientsText = Array.isArray(recipe.ingredients)
      ? recipe.ingredients
          .map((item) =>
            typeof item === "string" ? item : item?.name || JSON.stringify(item)
          )
          .join(", ")
      : "Not provided";

    const stepsText = Array.isArray(recipe.steps)
      ? recipe.steps.join(" | ")
      : "Not provided";

    const tagsText = Array.isArray(recipe.tags) && recipe.tags.length
      ? recipe.tags.join(", ")
      : "none";

    const prompt = `I want to make this recipe tonight:

  Recipe: ${recipe.title}
  Tags: ${tagsText}
  Ingredients: ${ingredientsText}
  Steps: ${stepsText}

  Please help me with:
  1. a short shopping list,
  2. any missing pantry staples I may need,
  3. simple cooking tips,
  4. optional side dish ideas.`;

    await sendTextToChat(prompt);
  };

  // -----------------------------
  // Image analysis (returns extracted data)
  // -----------------------------
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

  // File picker ATTACHES (does not analyze immediately)
  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    attachFile(file);
  };

  // Drag/drop handlers (ATTACH on drop)
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

  // ✅ Correct order: analyze image first, then chat using extracted items + user text
  const sendMessage = async (e) => {
    e.preventDefault();
    if (loading || uploading) return;

    const text = input.trim();
    const file = pendingFile;

    if (!text && !file) return;

    // Show a single user bubble representing the action
    const userBubble =
      (text ? text : "") +
      (file ? (text ? "\n\n" : "") + "📷 (image attached)" : "");

    setMessages((prev) => [
      ...prev,
      { id: nextId(), role: "user", content: userBubble },
    ]);
    setInput("");

    // If no file, just chat normally with the text
    if (!file) {
      await chatWithAssistant(text);
      return;
    }

    // 1) Analyze first
    const extracted = await analyzeImageFile(file);

    // Clear attachment after analysis finishes
    clearAttachment();

    // 2) Build prompt with extracted items
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

    // 3) Now chat
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

  const isEmpty = messages.length <= 1;

  // -----------------------------
  // AI landing suggestions
  // -----------------------------
  const [suggestions, setSuggestions] = useState([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);

  const fallbackSuggestions = [
    {
      emoji: "🍳",
      label: "Weekly Grocery List",
      prompt:
        "Build me a weekly grocery list with a few meal ideas, grouped by category.",
    },
    {
      emoji: "🍽️",
      label: "Quick Meal Plan",
      prompt:
        "Plan 3 quick dinners for this week and give me one combined grocery list.",
    },
    {
      emoji: "💸",
      label: "Save on Groceries",
      prompt:
        "Help me save money on groceries this week—suggest a budget meal plan and list.",
    },
    {
      emoji: "💪",
      label: "High-Protein Ideas",
      prompt: "Suggest 3 high-protein dinners and give me a grocery list.",
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

  const visibleSuggestions = (
    suggestions.length ? suggestions : fallbackSuggestions
  ).slice(0, 4);

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
            subtitle={
              panelPinned
                ? "Pinned • Click outside to hide"
                : "Hover away to hide"
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
              panelPinned
                ? "Pinned • Click outside to hide"
                : "Hover away to hide"
            }
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
                placeholder={
                  "Ingredients (one per line)\nExample:\nChicken\nRice\nBroccoli"
                }
                rows={4}
                className="pp-input"
                style={{ borderRadius: 12, resize: "vertical" }}
              />

              <div style={{ height: 10 }} />

              <textarea
                value={newRecipeSteps}
                onChange={(e) => setNewRecipeSteps(e.target.value)}
                placeholder={
                  "Steps (one per line)\nExample:\nCook chicken\nCook rice\nServe together"
                }
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

            {!loadingRecipes && recipes.length > 0 && (
              <>
                <div className="pp-recipeList">

                  {recipes.map((r) => {
                    const isActive = selectedRecipe?.id === r.id;

                    return (
                      <div
                        key={r.id}
                        className={`pp-card pp-recipeCardButton ${
                          isActive ? "pp-recipeCardButtonActive" : ""
                        }`}
                        onClick={() => setSelectedRecipe(r)}
                        style={{ cursor: "pointer" }}
                      >
                        <div className="pp-cardTitle">{r.title}</div>

                        <div className="pp-muted">
                          {Array.isArray(r.tags) ? r.tags.join(", ") : ""}
                        </div>

                        <div className="pp-muted">
                          Ingredients: {Array.isArray(r.ingredients) ? r.ingredients.length : 0} •{" "}
                          Steps: {Array.isArray(r.steps) ? r.steps.length : 0}
                        </div>

                        <div style={{ height: 10 }} />

                        <button
                          type="button"
                          className="pp-btn pp-btnPrimary"
                          onClick={(e) => {
                            e.stopPropagation(); // prevent card click
                            handleUseRecipe(r);
                          }}
                        >
                          Cook with PantryPal
                        </button>
                      </div>
                    );
                  })}
                </div>

              </>
            )}

          </PanelShell>
        )}

        {activePanel === PANELS.USER && (
          <PanelShell
            title="User Profile"
            subtitle={
              panelPinned
                ? "Pinned • Click outside to hide"
                : "Hover away to hide"
            }
            onClose={closePanel}
          >
            <div className="pp-muted" style={{ marginBottom: 12 }}>
              This panel shows the currently signed-in PantryPal account.
            </div>

            {loadingUser && <div className="pp-muted">Loading user…</div>}

            {!loadingUser && !userProfile && (
              <div className="pp-muted">
                No user profile found for this signed-in account.
              </div>
            )}

        {userProfile && (
          <div className="pp-profile-card">
            <div className="pp-profile-header">
              <div className="pp-profile-avatar">
                {(userProfile.name || "U").charAt(0).toUpperCase()}
              </div>

              <div>
                <div className="pp-profile-name">{userProfile.name}</div>
                {userProfile.email && (
                  <div className="pp-profile-email">{userProfile.email}</div>
                )}
              </div>
            </div>

            <div className="pp-profile-grid">
              <div className="pp-profile-stat">
                <span className="pp-profile-label">Budget</span>
                <span className="pp-profile-value">
                  {userProfile.budget_style || "balanced"}
                </span>
              </div>

              <div className="pp-profile-stat">
                <span className="pp-profile-label">Household size</span>
                <span className="pp-profile-value">
                  {userProfile.household_size || 1}
                </span>
              </div>
            </div>

            <div className="pp-profile-section">
              <div className="pp-profile-section-title">Diet</div>
              <div className="pp-profile-pill-row">
                <span className="pp-profile-pill">
                  {userProfile.dietary_prefs?.diet || "none"}
                </span>
              </div>
            </div>

            <div className="pp-profile-section">
              <div className="pp-profile-section-title">Allergies</div>
              <div className="pp-profile-pill-row">
                {(userProfile.dietary_prefs?.allergies || []).length ? (
                  userProfile.dietary_prefs.allergies.map((item) => (
                    <span key={item} className="pp-profile-pill">
                      {item}
                    </span>
                  ))
                ) : (
                  <span className="pp-profile-empty">No allergies added</span>
                )}
              </div>
            </div>

            <div className="pp-profile-section">
              <div className="pp-profile-section-title">Dislikes</div>
              <div className="pp-profile-pill-row">
                {(userProfile.dietary_prefs?.dislikes || []).length ? (
                  userProfile.dietary_prefs.dislikes.map((item) => (
                    <span key={item} className="pp-profile-pill">
                      {item}
                    </span>
                  ))
                ) : (
                  <span className="pp-profile-empty">No dislikes added</span>
                )}
              </div>
            </div>
          </div>
        )}

          </PanelShell>
        )}
      </div>

         {/* Main chat panel */}
    <div className="pp-main">
      <header className="pp-topbar">
        <div className="pp-topbarInner">
          <div className="topbarLeft">
            <h1 className="pp-title">PantryPal</h1>
            <p className="pp-subtitle">AI recipe generator & grocery list helper</p>
          </div>

          <div className="pp-actions">
            {/* Softer beta badge */}
            <span className="pp-pill">beta</span>

            {/* 
              User profile pill.
              This is only a visual upgrade and does not affect auth/session logic.
            */}
            <div className="pp-userPill">
              <div className="pp-userAvatar">
                {sessionUser?.name?.[0]?.toUpperCase() || "U"}
              </div>
              <span>{sessionUser?.name || "User"}</span>
            </div>

            {/* 
              Keep the same sign-out functionality.
              Only the visual style changes through CSS.
            */}
            <button
              type="button"
              className="pp-btn pp-btnGhost"
              onClick={signOut}
            >
              Sign out
            </button>

            {/* Hidden input used by button */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageChange}
              style={{ display: "none" }}
            />

            {/* 
              Keep the same upload functionality.
              Still disabled visually when uploading.
              Still opens the same hidden file input.
            */}
            <button
              type="button"
              className={`pp-uploadBtn pp-btnPrimary ${
                uploading ? "pp-uploadDisabled" : ""
              }`}
              onClick={() => {
                if (uploading) return;
                fileInputRef.current?.click();
              }}
              aria-label="Upload pantry photo"
            >
              <UploadCloud size={16} />
              {pendingFile ? "Image attached" : "Upload pantry photo"}
            </button>
          </div>
        </div>
      </header>

        {/* Drop-enabled chat wrap */}
        <div
          className={`pp-chatWrap ${dragOver ? "pp-chatWrapDrag" : ""}`}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
        >
          {/* Drop overlay */}
          {dragOver && !uploading && (
            <div className="pp-dropOverlay" aria-hidden="true">
              <div className="pp-dropCard">
                <div className="pp-dropIcon">
                  <UploadCloud size={18} />
                </div>
                <div className="pp-dropTitle">Drop to attach</div>
                <div className="pp-dropSub">
                  Then type a message and press Send
                </div>
              </div>
            </div>
          )}

          <div className="pp-chatColumn">
                
            {isEmpty && (
              <div className="pp-landing">
                {/* 
                  Pretty landing hero card.
                  This only changes the empty-state layout and styling hooks.
                  It does NOT change any chat, upload, or suggestion functionality.
                */}
                <div className="pp-empty pp-emptyHero">
                  {/* Soft decorative background orbs for a more polished look */}
                  <div className="pp-emptyGlow pp-emptyGlowOne" aria-hidden="true" />
                  <div className="pp-emptyGlow pp-emptyGlowTwo" aria-hidden="true" />

                  {/* Hero header area */}
                  <div className="pp-emptyHeroTop">
                    <div className="pp-emptyHeroBadge">
                      <div className="pp-emptyIcon">
                        <Carrot size={18} />
                      </div>

                      <div className="pp-emptyHeroBadgeText">
                        <span className="pp-emptyEyebrow">PantryPal assistant</span>
                          {/* Updated heading to reflect recipe generator purpose */}
                          <p className="pp-emptyTitle">What would you like to cook?</p>

                          <p className="pp-emptySub">
                            Get recipe ideas, generate meals from your pantry, or build a grocery list.
                          </p>
                      </div>
                    </div>

                    {/* 
                      Primary visual callout.
                      This is only a quick action button that reuses your existing upload input.
                      No new functionality is introduced.
                    */}
                    <button
                      type="button"
                      className="pp-emptyUploadBtn"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <UploadCloud size={16} />
                      Upload pantry photo
                    </button>
                  </div>

                  {/* Small helper feature cards for visual hierarchy */}
                  
                 

                  {/* Suggestion chips keep the same click behavior as before */}
                  <div className="pp-emptySection">
                    <div className="pp-emptySectionLabel">Try one of these</div>

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
                            className="pp-chip pp-chipHero"
                            onClick={() => sendTextToChat(s.prompt)}
                          >
                            <span className="pp-chipEmoji" aria-hidden="true">
                              {s.emoji || "✨"}
                            </span>
                            <span>{s.label}</span>
                          </button>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Bottom helper note */}
                  <div className="pp-chipHint pp-emptyHint">
                    Tip: drag & drop a pantry photo anywhere in the chat area to attach it,
                    then press Send.
                  </div>
                </div>

                {/* 
                  Keep the existing intro card.
                  This preserves your original empty-state assistant introduction.
                */}
                <div className="pp-intro">
                  <div className="pp-introTop">
                    <div className="pp-introAvatar">
                      <Carrot size={16} />
                    </div>
                    <div className="pp-introName">PantryPal</div>
                  </div>
                  <p className="pp-introText">
                    Tell me what you’re shopping for and I’ll help with lists
                    and meal ideas.
                  </p>
                </div>
              </div>
            )}
            {selectedRecipe && (
              <div className="pp-card" style={{ position: "relative" }}>
                <button
                  type="button"
                  className="pp-selectedRecipeClose"
                  onClick={() => setSelectedRecipe(null)}
                  aria-label="Close recipe"
                  title="Close recipe"
                >
                  ✕
                </button>

                <div className="pp-cardTitle" style={{ fontSize: 15, marginBottom: 8 }}>
                  {selectedRecipe.title}
                </div>

                {Array.isArray(selectedRecipe.tags) && selectedRecipe.tags.length > 0 && (
                  <div className="pp-muted" style={{ marginBottom: 12 }}>
                    {selectedRecipe.tags.join(", ")}
                  </div>
                )}

                <div style={{ fontWeight: 800, marginBottom: 8 }}>Ingredients</div>
                <ul className="pp-recipeDetailList">
                  {(selectedRecipe.ingredients || []).map((ingredient, index) => (
                    <li key={index}>
                      {typeof ingredient === "string"
                        ? ingredient
                        : ingredient?.name || JSON.stringify(ingredient)}
                    </li>
                  ))}
                </ul>

                <div style={{ fontWeight: 800, marginTop: 14, marginBottom: 8 }}>Steps</div>
                <ol className="pp-recipeDetailList">
                  {(selectedRecipe.steps || []).map((step, index) => (
                    <li key={index}>{step}</li>
                  ))}
                </ol>
              </div>
            )}

            {!isEmpty &&
              messages.map((m) => (
                <div
                  key={m.id}
                  className={`pp-row ${
                    m.role === "user" ? "pp-rowUser" : "pp-rowBot"
                  }`}
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

        <form onSubmit={sendMessage} className="pp-composer">
          {/* Attachment preview chip */}
          {pendingFile && (
            <div className="pp-attachRow">
              <div className="pp-attachChip">
                {pendingPreviewUrl ? (
                  <img
                    className="pp-attachThumb"
                    src={pendingPreviewUrl}
                    alt="Attachment preview"
                  />
                ) : null}

                <div className="pp-attachMeta">
                  <div className="pp-attachName">{pendingFile.name}</div>
                  <div className="pp-attachSub">
                    {(pendingFile.size / 1024 / 1024).toFixed(2)} MB
                  </div>
                </div>

                <button
                  type="button"
                  className="pp-attachRemove"
                  onClick={clearAttachment}
                  aria-label="Remove attachment"
                >
                  ✕
                </button>
              </div>
            </div>
          )}

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
              disabled={loading || uploading || (!input.trim() && !pendingFile)}
              className="pp-send"
            >
              {uploading ? "Analyzing…" : loading ? "Sending…" : "Send"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
