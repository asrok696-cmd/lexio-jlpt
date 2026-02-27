// app/sign-out/page.tsx
"use client";

import { SignOutButton } from "@clerk/nextjs";
import Link from "next/link";

export default function SignOutPage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#000",
        color: "rgba(255,255,255,0.92)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 520,
          borderRadius: 18,
          border: "1px solid rgba(255,255,255,0.10)",
          background: "rgba(255,255,255,0.05)",
          padding: 16,
          boxShadow: "0 0 0 1px rgba(0,0,0,0.25) inset",
          boxSizing: "border-box",
        }}
      >
        <div style={{ fontSize: 26, fontWeight: 950 }}>Sign out</div>
        <div style={{ marginTop: 8, fontSize: 13, opacity: 0.75, lineHeight: 1.6 }}>
          ログアウトしますか？
        </div>

        <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
          <SignOutButton redirectUrl="/start">
            <button
              style={{
                width: "100%",
                padding: "12px 14px",
                borderRadius: 14,
                border: "none",
                background: "rgba(120, 90, 255, 0.92)",
                color: "white",
                fontWeight: 950,
                cursor: "pointer",
                boxSizing: "border-box",
              }}
            >
              Sign out →
            </button>
          </SignOutButton>

          <Link
            href="/dashboard"
            style={{
              width: "100%",
              textAlign: "center",
              padding: "12px 14px",
              borderRadius: 14,
              border: "1px solid rgba(255,255,255,0.12)",
              background: "rgba(255,255,255,0.06)",
              color: "white",
              fontWeight: 950,
              textDecoration: "none",
              boxSizing: "border-box",
              opacity: 0.95,
            }}
          >
            Cancel → Back to Dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}
