import React, { useState, useEffect, useRef } from "react";

function App() {
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
  const messagesEndRef = useRef(null);

  // Auto-scroll to the bottom when messages change
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  const sendMessage = async (e) => {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading) return;

    const userMessage = {
      id: Date.now(),
      role: "user",
      content: text,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("http://localhost:8000/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text }),
      });

      if (!res.ok) {
        throw new Error("Request failed");
      }

      const data = await res.json();
      const botMessage = {
        id: Date.now() + 1,
        role: "assistant",
        content: data.reply,
      };

      setMessages((prev) => [...prev, botMessage]);
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

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        background: "#f3f4f6",
        padding: "1rem",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "800px",
          height: "80vh",
          background: "#ffffff",
          borderRadius: "16px",
          boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Header */}
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
            <h1 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 600 }}>
              PantryPal
            </h1>
            <p
              style={{
                margin: 0,
                fontSize: "0.8rem",
                color: "#6b7280",
              }}
            >
              Grocery & meal planning assistant
            </p>
          </div>
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
        </header>

        {/* Messages area */}
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
                justifyContent:
                  m.role === "user" ? "flex-end" : "flex-start",
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
                  background:
                    m.role === "user" ? "#2563eb" : "#e5e7eb",
                  color: m.role === "user" ? "#ffffff" : "#111827",
                }}
              >
                {m.content}
              </div>
            </div>
          ))}
          {loading && (
            <div
              style={{
                fontSize: "0.8rem",
                color: "#6b7280",
                marginTop: "0.25rem",
              }}
            >
              PantryPal is thinking…
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input area */}
        <form
          onSubmit={sendMessage}
          style={{
            borderTop: "1px solid #e5e7eb",
            padding: "0.75rem",
            background: "#f9fafb",
          }}
        >
          <div
            style={{
              display: "flex",
              gap: "0.5rem",
              alignItems: "center",
            }}
          >
            <input
              type="text"
              placeholder='Ask: "Make a grocery list for taco night"'
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  // prevent newline on Enter
                  // (we’re using a single-line input here)
                }
              }}
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
