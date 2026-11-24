"use client";
import { useState } from "react";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        setError("Wrong password.");
        setLoading(false);
        return;
      }
      const params = new URLSearchParams(window.location.search);
      window.location.href = params.get("next") || "/";
    } catch (err) {
      setError("Something went wrong.");
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#0f0e13",
        color: "#f1eef7",
        fontFamily: "Inter, system-ui, sans-serif",
      }}
    >
      <form
        onSubmit={submit}
        style={{
          background: "#1b1922",
          border: "1px solid #2d2a36",
          borderRadius: 14,
          padding: 28,
          width: 320,
        }}
      >
        <div style={{ fontSize: 22, marginBottom: 4 }}>🎬</div>
        <h1 style={{ fontSize: 18, margin: "0 0 4px" }}>Multi-Hat</h1>
        <p style={{ fontSize: 13, color: "#847e96", margin: "0 0 18px" }}>
          Private tool — enter the password to continue.
        </p>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          autoFocus
          style={{
            width: "100%",
            background: "#15131b",
            border: "1px solid #2d2a36",
            color: "#f1eef7",
            borderRadius: 9,
            padding: "10px 12px",
            fontSize: 14,
            marginBottom: 12,
          }}
        />
        {error && (
          <div style={{ color: "#ff8a8a", fontSize: 12.5, marginBottom: 10 }}>{error}</div>
        )}
        <button
          type="submit"
          disabled={loading}
          style={{
            width: "100%",
            background: "linear-gradient(135deg,#ff5d5d,#ff7a52)",
            color: "#1b0d0d",
            border: "none",
            borderRadius: 999,
            padding: "11px 0",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          {loading ? "Checking..." : "Enter"}
        </button>
      </form>
    </div>
  );
}
