import React, { useEffect, useRef, useState } from "react";
import "./App.css";

const API_BASE = "http://localhost:8000";

// Which left panel is open (null = closed)
const PANELS = {
  HISTORY: "history",
  RECIPES: "recipes",
  USER: "user",
};

// UI helpers (kept outside App so they don't get re-created each render)
const RailButton = ({ title, active, onClick, children }) => (
  <button
    type="button"
    title={title}
    onClick={onClick}
    className={`pp-railBtn ${active ? "pp-railBtnActive" : ""}`}
  >
    {children}
  </button>
);

const PanelShell = ({ title, onClose, children }) => (
  <div className="pp-panel">
    <div className="pp-panelHeader">
      <div>
        <div className="pp-panelTitle">{title}</div>
        <div className="pp-panelSubtitle">Click the icon again to hide</div>
      </div>

      <button type="button" onClick={onClose} className="pp-panelClose">
        ✕
      </button>
    </div>

    <div className="pp-panelBody">{children}</div>
  </div>
);

function App() {
  const [activePanel, setActivePanel] = useState(null);

  // ✅ Stable id generator (fixes focus/typing issues caused by unstable keys)
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
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  // Image → JSON
  const [imageResult, setImageResult] = useState(null);
  const [uploading, setUploading] = useState(false);

  // Snapshot history
  const [snapshots, setSnapshots] = useState([]);
  const [loadingSnapshots, setLoadingSnapshots] = useState(false);

  // Recipes
  const [recipes, setRecipes] = useState([]);
  const [loadingRecipes, setLoadingRecipes] = useState(false);

  // Create recipe form
  const [newRecipeTitle, setNewRecipeTitle] = useState("");
  const [newRecipeTags, setNewRecipeTags] = useState("");
  const [newRecipeIngredients, setNewRecipeIngredients] = useState("");
  const [newRecipeSteps, setNewRecipeSteps] = useState("");
  const [creatingRecipe, setCreatingRecipe] = useState(false);

  // User
  const [user, setUser] = useState(null);
  const [loadingUser, setLoadingUser] = useState(false);

  const messagesEndRef = useRef(null);

  // Scroll chat to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Toggle sidebar panels
  const togglePanel = (panelName) => {
    setActivePanel((prev) => (prev === panelName ? null : panelName));
  };

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
    if (!title) {
      alert("Recipe title is required.");
      return;
    }

    // tags: "dinner, easy" -> ["dinner","easy"]
    const tags = newRecipeTags
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    // ingredients: one per line -> [{name: "..."}]
    const ingredients = newRecipeIngredients
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((name) => ({ name }));

    // steps: one per line -> ["step 1", "step 2"]
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

  // Load snapshots on mount
  useEffect(() => {
    fetchSnapshots();
  }, []);

  // When a panel opens, lazily load its data
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

    const userMsg = { id: nextId(), role: "user", content: trimmed };

    // Optimistically update UI
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    // IMPORTANT: Use the "prev" messages concept by rebuilding from current state + userMsg
    const historyToSend = [
      ...messages.map((m) => ({ role: m.role, content: m.content })),
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

      const data = await res.json(); // { data: {...}, snapshot_id: number }
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
          content:
            "⚠️ I couldn't process that image. Please try again with a clearer photo.",
        },
      ]);
    } finally {
      setUploading(false);
      e.target.value = null;
    }
  };

  const formatDateTime = (isoString) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleString();
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

  return (
    <div className="pp-shell">
      {/* Left rail (icons) */}
      <div className="pp-rail">
        <div className="pp-railBrand">🥕</div>

        <RailButton
          title="Scan history"
          active={activePanel === PANELS.HISTORY}
          onClick={() => togglePanel(PANELS.HISTORY)}
        >
          🕒
        </RailButton>

        <RailButton
          title="Recipes"
          active={activePanel === PANELS.RECIPES}
          onClick={() => togglePanel(PANELS.RECIPES)}
        >
          📖
        </RailButton>

        <RailButton
          title="User profile"
          active={activePanel === PANELS.USER}
          onClick={() => togglePanel(PANELS.USER)}
        >
          👤
        </RailButton>

        <div style={{ flex: 1 }} />

        <RailButton title="Close panel" active={false} onClick={() => setActivePanel(null)}>
          ⬅️
        </RailButton>
      </div>

      {/* Expandable panel */}
      {activePanel === PANELS.HISTORY && (
        <PanelShell title="Scan History" onClose={() => setActivePanel(null)}>
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

                <button type="button" onClick={() => deleteSnapshot(snap.id)} className="pp-btn">
                  Delete
                </button>
              </div>
            </div>
          ))}
        </PanelShell>
      )}

      {activePanel === PANELS.RECIPES && (
        <PanelShell title="Recipes" onClose={() => setActivePanel(null)}>
          <button type="button" onClick={fetchRecipes} className="pp-btn">
            Refresh
          </button>

          {/* Create Recipe */}
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

          {/* Recipes list */}
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
        <PanelShell title="User Profile" onClose={() => setActivePanel(null)}>
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
              function to the correct user id.
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

      {/* Main chat panel */}
      <div className="pp-main">
        {/* Top header */}
        <header className="pp-topbar">
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
        </header>

        {/* Messages */}
        <div className="pp-chatWrap">
          <div className="pp-chatColumn">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`pp-row ${m.role === "user" ? "pp-rowUser" : "pp-rowBot"}`}
              >
                <div
                  className={`pp-bubble ${
                    m.role === "user" ? "pp-bubbleUser" : "pp-bubbleBot"
                  }`}
                >
                  {m.content}
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

        {/* Input */}
        <form onSubmit={sendMessage} className="pp-composer">
          <div className="pp-composerInner">
            <input
              type="text"
              placeholder='Ask: "Make a grocery list for taco night"'
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="pp-input"
            />

            <button type="submit" disabled={loading || !input.trim()} className="pp-send">
              {loading ? "Sending…" : "Send"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default App;
