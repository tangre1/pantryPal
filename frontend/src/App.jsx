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

  // For image → JSON flow
  const [imageResult, setImageResult] = useState(null);
  const [uploading, setUploading] = useState(false);

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

      if (!res.ok) throw new Error("Request failed");

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

  const handleImageChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setImageResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("http://localhost:8000/api/image-to-json", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        throw new Error("Image upload failed");
      }

      const data = await res.json(); // { data: { items: [...] } }
      setImageResult(data.data);

      // Also add a message summarizing what we found
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
      // Optional: clear file input so same file can be chosen again if desired
      e.target.value = null;
    }
  };

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        display: "flex",
        background: "#f3f4f6",
      }}
    >
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          background: "#ffffff",
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

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
            }}
          >
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

            {/* Image upload */}
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

        {/* Messages Area */}
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

          {/* Optional JSON preview for last image result */}
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
