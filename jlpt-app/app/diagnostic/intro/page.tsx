// app/diagnostic/intro/page.tsx
"use client";

import React, { useMemo } from "react";
import { useRouter } from "next/navigation";
import { DIAG_SETTINGS_KEY, type DiagnosticSettings, readJSON } from "@/_lib/diagnosticSettings";

const pageWrap: React.CSSProperties = {
  minHeight: "100vh",
  background: "#000",
  color: "rgba(255,255,255,0.92)",
};

const container: React.CSSProperties = { maxWidth: 980, margin: "0 auto", padding: 24 };

function SoftCard({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        borderRadius: 18,
        border: "1px solid rgba(255,255,255,0.10)",
        background: "rgba(255,255,255,0.05)",
        padding: 16,
        boxShadow: "0 0 0 1px rgba(0,0,0,0.25) inset",
        boxSizing: "border-box",
      }}
    >
      {children}
    </div>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "6px 10px",
        borderRadius: 999,
        border: "1px solid rgba(255,255,255,0.12)",
        background: "rgba(255,255,255,0.06)",
        fontSize: 12,
        fontWeight: 900,
        color: "rgba(255,255,255,0.85)",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

function PrimaryBtn({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
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
        lineHeight: 1.2,
      }}
    >
      {children}
    </button>
  );
}

function GhostBtn({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: "100%",
        padding: "12px 14px",
        borderRadius: 14,
        border: "1px solid rgba(255,255,255,0.12)",
        background: "rgba(255,255,255,0.06)",
        color: "white",
        fontWeight: 950,
        cursor: "pointer",
        boxSizing: "border-box",
        lineHeight: 1.2,
        opacity: 0.95,
      }}
    >
      {children}
    </button>
  );
}

export default function DiagnosticIntroPage() {
  const router = useRouter();

  const settings = useMemo(() => readJSON<DiagnosticSettings>(DIAG_SETTINGS_KEY), []);

  return (
    <main style={pageWrap}>
      <div style={container}>
        <SoftCard>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: 28, fontWeight: 950 }}>Level Diagnostic</div>
              <div style={{ marginTop: 6, fontSize: 13, opacity: 0.78, lineHeight: 1.6 }}>
                This short diagnostic will estimate your current JLPT level and identify your weakest skill.
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Pill>Phase 1: Level estimation (15Q)</Pill>
              <Pill>Phase 2: Skill analysis (9Q)</Pill>
            </div>
          </div>

          <div style={{ marginTop: 14, fontSize: 13, opacity: 0.88, lineHeight: 1.8 }}>
            <div>• Takes about 5 minutes</div>
            <div>• You can retake it anytime</div>
            <div>• Your results will be used to personalize practice</div>
          </div>

          <div
            style={{
              marginTop: 14,
              borderRadius: 16,
              border: "1px solid rgba(255,255,255,0.10)",
              background: "rgba(0,0,0,0.20)",
              padding: 14,
            }}
          >
            <div style={{ fontWeight: 950, fontSize: 14 }}>Your target</div>
            <div style={{ marginTop: 8, fontSize: 13, opacity: 0.82, lineHeight: 1.7 }}>
              Goal level: <b>{settings?.goalLevel ?? "—"}</b>
              <br />
              Exam date: <b>{settings?.examDateISO ?? "—"}</b>
            </div>
            {!settings?.goalLevel ? (
              <div style={{ marginTop: 10, fontSize: 12, opacity: 0.75 }}>
                You haven’t set your target yet. We recommend completing Phase 0 first.
              </div>
            ) : null}
          </div>

          <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
            <PrimaryBtn onClick={() => router.replace("/diagnostic/phase1")}>Start Diagnostic →</PrimaryBtn>
            <GhostBtn onClick={() => router.replace("/diagnostic/phase0")}>Edit target →</GhostBtn>
          </div>
        </SoftCard>
      </div>
    </main>
  );
}