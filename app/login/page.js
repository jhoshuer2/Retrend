"use client";
import { useEffect, useState } from "react";

const ERROR_MESSAGES = {
  access_denied: "You declined access, or Google blocked this account (it may not be on the test-user list yet).",
  state_mismatch: "That sign-in link expired — try again.",
};

export default function LoginPage() {
  const [error, setError] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const e = params.get("error");
    if (e) setError(ERROR_MESSAGES[e] || e);
  }, []);

  function signIn() {
    const params = new URLSearchParams(window.location.search);
    window.location.href = "/api/auth/google/start" + (params.get("next") ? "" : "");
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#f3f4f7",
        color: "#14151f",
        fontFamily: "Inter, system-ui, sans-serif",
        padding: 16,
      }}
    >
      <div
        style={{
          background: "#ffffff",
          border: "1px solid #e3e6ec",
          borderRadius: 14,
          padding: 32,
          width: 360,
          textAlign: "center",
          boxShadow: "0 1px 2px rgba(16,24,40,.04)",
        }}
      >
        <div style={{ fontSize: 30, marginBottom: 8 }}>🎬</div>
        <h1 style={{ fontSize: 20, margin: "0 0 6px" }}>Multi-Hat</h1>
        <p style={{ fontSize: 13.5, color: "#9aa0ae", margin: "0 0 24px", lineHeight: 1.5 }}>
          Sign in with the Google account that runs your YouTube channel. Your crew of characters
          will be waiting — we'll only read your channel's public info, stats and videos, never
          post or change anything.
        </p>
        {error && (
          <div
            style={{
              color: "#9a2f2f",
              background: "#fdecec",
              border: "1px solid #f3c6c6",
              borderRadius: 9,
              padding: "10px 12px",
              fontSize: 12.5,
              marginBottom: 16,
              textAlign: "left",
              lineHeight: 1.5,
            }}
          >
            {error}
          </div>
        )}
        <button
          onClick={signIn}
          style={{
            width: "100%",
            background: "#3b5bfd",
            color: "#fff",
            border: "none",
            borderRadius: 999,
            padding: "12px 0",
            fontWeight: 700,
            fontSize: 14,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
          }}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
            <path
              fill="#4285F4"
              d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z"
            />
            <path
              fill="#34A853"
              d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z"
            />
            <path
              fill="#FBBC05"
              d="M3.97 10.72A5.4 5.4 0 0 1 3.68 9c0-.6.1-1.18.29-1.72V4.95H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.05l3.01-2.33z"
            />
            <path
              fill="#EA4335"
              d="M9 3.58c1.32 0 2.51.46 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z"
            />
          </svg>
          Continue with Google
        </button>
      </div>
    </div>
  );
}
