import React, { useEffect, useRef, useState } from "react";

const API_BASE = "http://localhost:8000";

// Which left panel is open (null = closed)
const PANELS = {
  HISTORY: "history",
  RECIPES: "recipes",
  USER: "user",
};

function App() {
  const [activePanel, setActivePanel] = useState(null);

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

  // Future panels (placeholders until you add endpoints)
  const [recipes, setRecipes] = useState([]);
  const [loadingRecipes, setLoadingRecipes] = useState(false);

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
          id: Date.now(),
          role: "assistant",
          content: "⚠️ I couldn't delete that snapshot. Try again.",
        },
      ]);
    }
  };

  // -----------------------------
  // API: recipes (placeholder)
  // -----------------------------
  const fetchRecipes = async () => {
    // Only useful once you add backend endpoints like GET /api/recipes
    setLoadingRecipes(true);
    try {
      const res = await fetch(`${API_BASE}/api/recipes`);
      if (!res.ok) throw new Error("No recipes endpoint yet");
      const data = await res.json();
      setRecipes(Array.isArray(data) ? data : []);
    } catch (err) {
      // Normal for now if you haven’t implemented recipes endpoints
      console.warn("Recipes not available yet:", err?.message || err);
      setRecipes([]);
    } finally {
      setLoadingRecipes(false);
    }
  };

  // -----------------------------
  // API: user (placeholder)
  // -----------------------------
  const fetchUser = async () => {
    // Only useful once you have a real login or a default user id.
    // For demo, you can hardcode user 1 if you created it: /api/users/1
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

  // Load snapshots on mount (your most useful panel today)
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

    setMessages((prev) => [
      ...prev,
      { id: Date.now(), role: "user", content: trimmed },
    ]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed }),
      });
      if (!res.ok) throw new Error("Request failed");

      const data = await res.json();
      setMessages((prev) => [
        ...prev,
        { id: Date.now() + 1, role: "assistant", content: data.reply },
      ]);
    } catch (err) {
      console.error(err);
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now() + 2,
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
          id: Date.now(),
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
          id: Date.now() + 1,
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

  // -----------------------------
  // UI pieces
  // -----------------------------
  const RailButton = ({ title, active, onClick, children }) => (
    <button
      title={title}
      onClick={onClick}
      style={{
        width: "44px",
        height: "44px",
        borderRadius: "12px",
        border: "1px solid #e5e7eb",
        background: active ? "#eef2ff" : "#ffffff",
        cursor: "pointer",
        display: "grid",
        placeItems: "center",
        fontSize: "18px",
      }}
    >
      {children}
    </button>
  );

  const PanelShell = ({ title, children }) => (
    <div
      style={{
        width: "320px",
        borderRight: "1px solid #e5e7eb",
        background: "#ffffff",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          padding: "0.9rem 1rem",
          borderBottom: "1px solid #e5e7eb",
          background: "#f9fafb",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "0.75rem",
        }}
      >
        <div>
          <div style={{ fontSize: "0.95rem", fontWeight: 800 }}>{title}</div>
          <div style={{ fontSize: "0.8rem", color: "#6b7280" }}>
            Click the icon again to hide
          </div>
        </div>
        <button
          onClick={() => setActivePanel(null)}
          style={{
            border: "1px solid #e5e7eb",
            background: "#ffffff",
            borderRadius: "10px",
            padding: "0.35rem 0.6rem",
            cursor: "pointer",
          }}
        >
          ✕
        </button>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "1rem" }}>
        {children}
      </div>
    </div>
  );

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        display: "flex",
        background: "#f3f4f6",
        fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, Arial",
      }}
    >
      {/* Left rail (icons) */}
      <div
        style={{
          width: "72px",
          borderRight: "1px solid #e5e7eb",
          background: "#ffffff",
          padding: "0.75rem",
          display: "flex",
          flexDirection: "column",
          gap: "0.6rem",
          alignItems: "center",
        }}
      >
        <div style={{ fontWeight: 900, fontSize: "0.9rem", marginBottom: "0.25rem" }}>
          🥕
        </div>

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
        <PanelShell title="Scan History">
          <button
            onClick={fetchSnapshots}
            style={{
              width: "100%",
              borderRadius: "10px",
              border: "1px solid #d1d5db",
              padding: "0.55rem 0.7rem",
              background: "#ffffff",
              cursor: "pointer",
              fontSize: "0.85rem",
              marginBottom: "0.75rem",
            }}
          >
            Refresh
          </button>

          {loadingSnapshots && (
            <div style={{ fontSize: "0.85rem", color: "#6b7280" }}>
              Loading scans…
            </div>
          )}

          {!loadingSnapshots && snapshots.length === 0 && (
            <div style={{ fontSize: "0.85rem", color: "#9ca3af" }}>
              No scans yet. Upload an image to create one.
            </div>
          )}

          {snapshots.map((snap) => (
            <div
              key={snap.id}
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: "12px",
                padding: "0.75rem",
                marginBottom: "0.75rem",
                background: "#ffffff",
                boxShadow: "0 6px 16px rgba(0,0,0,0.04)",
              }}
            >
              <div
                style={{
                  fontWeight: 800,
                  fontSize: "0.85rem",
                  color: "#111827",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
                title={snap.label}
              >
                {snap.label || `Snapshot #${snap.id}`}
              </div>

              <div style={{ marginTop: "0.25rem", fontSize: "0.75rem", color: "#6b7280" }}>
                {formatDateTime(snap.created_at)}
              </div>

              <div style={{ marginTop: "0.35rem", fontSize: "0.75rem", color: "#6b7280" }}>
                Items: {snap?.data?.items?.length ?? 0}
              </div>

              <button
                onClick={() => handleUseSnapshot(snap)}
                style={{
                  marginTop: "0.6rem",
                  width: "100%",
                  borderRadius: "999px",
                  border: "none",
                  padding: "0.5rem 0.8rem",
                  background: "#2563eb",
                  color: "#ffffff",
                  cursor: "pointer",
                  fontSize: "0.85rem",
                }}
              >
                Use this scan
              </button>

              <button
                onClick={() => deleteSnapshot(snap.id)}
                style={{
                  marginTop: "0.45rem",
                  width: "100%",
                  borderRadius: "999px",
                  border: "1px solid #d1d5db",
                  padding: "0.5rem 0.8rem",
                  background: "#ffffff",
                  color: "#111827",
                  cursor: "pointer",
                  fontSize: "0.85rem",
                }}
              >
                Delete
              </button>
            </div>
          ))}
        </PanelShell>
      )}

      {activePanel === PANELS.RECIPES && (
        <PanelShell title="Recipes">
          <div style={{ fontSize: "0.85rem", color: "#6b7280", marginBottom: "0.75rem" }}>
            This panel is wired up, but you’ll need backend endpoints like:
            <div style={{ marginTop: "0.25rem", fontFamily: "monospace", fontSize: "0.8rem" }}>
              GET /api/recipes
            </div>
          </div>

          {loadingRecipes && (
            <div style={{ fontSize: "0.85rem", color: "#6b7280" }}>
              Loading recipes…
            </div>
          )}

          {!loadingRecipes && recipes.length === 0 && (
            <div style={{ fontSize: "0.85rem", color: "#9ca3af" }}>
              No recipes yet. Next step: add save + list recipe endpoints.
            </div>
          )}

          {recipes.map((r) => (
            <div
              key={r.id}
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: "12px",
                padding: "0.75rem",
                marginBottom: "0.75rem",
              }}
            >
              <div style={{ fontWeight: 800 }}>{r.title}</div>
              <div style={{ fontSize: "0.8rem", color: "#6b7280" }}>
                {r.tags || ""}
              </div>
            </div>
          ))}
        </PanelShell>
      )}

      {activePanel === PANELS.USER && (
        <PanelShell title="User Profile">
          <div style={{ fontSize: "0.85rem", color: "#6b7280", marginBottom: "0.75rem" }}>
            For demo purposes this tries to load user id <b>1</b>:
            <div style={{ marginTop: "0.25rem", fontFamily: "monospace", fontSize: "0.8rem" }}>
              GET /api/users/1
            </div>
          </div>

          {loadingUser && (
            <div style={{ fontSize: "0.85rem", color: "#6b7280" }}>
              Loading user…
            </div>
          )}

          {!loadingUser && !user && (
            <div style={{ fontSize: "0.85rem", color: "#9ca3af" }}>
              No user loaded yet. Create one via POST /api/users, or change the fetchUser()
              function to the correct user id.
            </div>
          )}

          {user && (
            <div
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: "12px",
                padding: "0.9rem",
                background: "#ffffff",
              }}
            >
              <div style={{ fontWeight: 900, fontSize: "1rem" }}>{user.name}</div>
              <div style={{ marginTop: "0.35rem", fontSize: "0.85rem", color: "#374151" }}>
                Budget: <b>{user.budget_style}</b>
              </div>
              <div style={{ marginTop: "0.25rem", fontSize: "0.85rem", color: "#374151" }}>
                Household size: <b>{user.household_size}</b>
              </div>

              <div style={{ marginTop: "0.75rem", fontSize: "0.8rem", color: "#6b7280" }}>
                Dietary prefs:
              </div>
              <pre
                style={{
                  marginTop: "0.35rem",
                  padding: "0.6rem",
                  background: "#111827",
                  color: "#e5e7eb",
                  borderRadius: "10px",
                  fontSize: "0.75rem",
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
      <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        {/* Top header */}
        <header
          style={{
            padding: "0.75rem 1rem",
            borderBottom: "1px solid #e5e7eb",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            background: "#f9fafb",
          }}
        >
          <div>
            <h1 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 800 }}>
              PantryPal
            </h1>
            <p style={{ margin: 0, fontSize: "0.8rem", color: "#6b7280" }}>
              Grocery & meal planning assistant
            </p>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span
              style={{
                fontSize: "0.75rem",
                padding: "0.25rem 0.6rem",
                borderRadius: "999px",
                background: "#e5f2ff",
                color: "#2563eb",
              }}
            >
              beta
            </span>

            <label
              style={{
                fontSize: "0.8rem",
                padding: "0.25rem 0.6rem",
                borderRadius: "999px",
                border: "1px solid #d1d5db",
                background: "#ffffff",
                cursor: uploading ? "default" : "pointer",
                opacity: uploading ? 0.6 : 1,
              }}
            >
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
        <div
          style={{
            flex: 1,
            padding: "1rem",
            overflowY: "auto",
            background: "#f9fafb",
          }}
        >
          {messages.map((m) => (
            <div
              key={m.id}
              style={{
                display: "flex",
                justifyContent: m.role === "user" ? "flex-end" : "flex-start",
                marginBottom: "0.5rem",
              }}
            >
              <div
                style={{
                  maxWidth: "80%",
                  padding: "0.6rem 0.8rem",
                  borderRadius: "12px",
                  fontSize: "0.9rem",
                  whiteSpace: "pre-wrap",
                  background: m.role === "user" ? "#2563eb" : "#e5e7eb",
                  color: m.role === "user" ? "#ffffff" : "#111827",
                }}
              >
                {m.content}
              </div>
            </div>
          ))}

          {loading && (
            <div style={{ fontSize: "0.8rem", color: "#6b7280", marginTop: "0.25rem" }}>
              PantryPal is thinking…
            </div>
          )}

          {imageResult && (
            <pre
              style={{
                marginTop: "0.75rem",
                padding: "0.5rem",
                background: "#111827",
                color: "#e5e7eb",
                borderRadius: "8px",
                fontSize: "0.75rem",
                overflowX: "auto",
              }}
            >
              {JSON.stringify(imageResult, null, 2)}
            </pre>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <form
          onSubmit={sendMessage}
          style={{
            borderTop: "1px solid #e5e7eb",
            padding: "0.75rem",
            background: "#f9fafb",
          }}
        >
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
            <input
              type="text"
              placeholder='Ask: "Make a grocery list for taco night"'
              value={input}
              onChange={(e) => setInput(e.target.value)}
              style={{
                flex: 1,
                padding: "0.6rem 0.8rem",
                borderRadius: "999px",
                border: "1px solid #d1d5db",
                fontSize: "0.9rem",
                outline: "none",
              }}
            />

            <button
              type="submit"
              disabled={loading || !input.trim()}
              style={{
                borderRadius: "999px",
                border: "none",
                padding: "0.6rem 1rem",
                fontSize: "0.9rem",
                cursor: loading ? "default" : "pointer",
                background: loading ? "#9ca3af" : "#2563eb",
                color: "#ffffff",
                opacity: loading ? 0.7 : 1,
              }}
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
