// app/diagnostic/phase0/page.tsx
"use client";

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type JLPTLevel = "N5" | "N4" | "N3" | "N2" | "N1";

const DIAG_SETTINGS_KEY = "lexio.diag.settings.v1";

type DiagnosticSettings = {
  version: 1;
  examDateISO?: string | null; // optional
  goalLevel: JLPTLevel; // required
  updatedAt: string;
};

const LEVELS: JLPTLevel[] = ["N5", "N4", "N3", "N2", "N1"];

// ===== UI atoms (match phase1/phase2 tone) =====
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
        minWidth: 0,
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

function PrimaryBtn({
  onClick,
  disabled,
  children,
}: {
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        width: "100%",
        padding: "12px 14px",
        borderRadius: 14,
        border: "none",
        background: disabled ? "rgba(255,255,255,0.10)" : "rgba(120, 90, 255, 0.92)",
        color: "white",
        fontWeight: 950,
        cursor: disabled ? "not-allowed" : "pointer",
        boxSizing: "border-box",
        lineHeight: 1.2,
        opacity: disabled ? 0.7 : 1,
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

// ===== storage helpers =====
function readJSON<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}
function writeJSON<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(value));
}

function normalizeISODate(s: string) {
  const v = (s ?? "").trim();
  return v.length ? v : null;
}

export default function DiagnosticPhase0Page() {
  const router = useRouter();

  const prev = useMemo(() => readJSON<DiagnosticSettings>(DIAG_SETTINGS_KEY), []);

  const [goalLevel, setGoalLevel] = useState<JLPTLevel | "">((prev?.goalLevel as any) ?? "");
  const [examDateISO, setExamDateISO] = useState<string>(prev?.examDateISO ?? "");

  const canContinue = goalLevel !== "";

  function onContinue() {
    if (!canContinue) return;

    const settings: DiagnosticSettings = {
      version: 1,
      goalLevel: goalLevel as JLPTLevel,
      examDateISO: normalizeISODate(examDateISO),
      updatedAt: new Date().toISOString(),
    };

    writeJSON(DIAG_SETTINGS_KEY, settings);

    // Next: Phase 1
    router.push("/diagnostic/phase1");
  }

  function onReset() {
    // settings only (do not delete diagnostic results)
    const next: DiagnosticSettings = {
      version: 1,
      goalLevel: "N5",
      examDateISO: null,
      updatedAt: new Date().toISOString(),
    };
    writeJSON(DIAG_SETTINGS_KEY, next);
    setGoalLevel("N5");
    setExamDateISO("");
  }

  return (
    <main style={pageWrap}>
      <div style={container}>
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 28, fontWeight: 950 }}>Diagnostic · Setup</div>
            <div style={{ marginTop: 6, fontSize: 13, opacity: 0.75 }}>
              Choose your goal level. Add an optional exam date.
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Pill>Phase 0</Pill>
            <Pill>Goal</Pill>
            <Pill>Exam date (optional)</Pill>
          </div>
        </div>

        {/* Content */}
        <div style={{ marginTop: 14 }}>
          <SoftCard>
            {/* Goal */}
            <div style={{ fontWeight: 950, fontSize: 14 }}>Goal level</div>
            <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 }}>
              {LEVELS.map((lv) => {
                const active = goalLevel === lv;
                return (
                  <button
                    key={lv}
                    onClick={() => setGoalLevel(lv)}
                    style={{
                      padding: "12px 12px",
                      borderRadius: 14,
                      border: active ? "1px solid rgba(120, 90, 255, 0.40)" : "1px solid rgba(255,255,255,0.12)",
                      background: active ? "rgba(120, 90, 255, 0.18)" : "rgba(255,255,255,0.06)",
                      color: "white",
                      fontWeight: 950,
                      cursor: "pointer",
                      textAlign: "center",
                      boxSizing: "border-box",
                    }}
                  >
                    {lv}
                  </button>
                );
              })}
            </div>

            {/* Exam date */}
            <div style={{ marginTop: 18, fontWeight: 950, fontSize: 14 }}>Exam date (optional)</div>
            <div style={{ marginTop: 10 }}>
              <input
                type="date"
                value={examDateISO}
                onChange={(e) => setExamDateISO(e.target.value)}
                style={{
                  width: "100%",
                  padding: "12px 12px",
                  borderRadius: 14,
                  border: "1px solid rgba(255,255,255,0.12)",
                  background: "rgba(0,0,0,0.25)",
                  color: "rgba(255,255,255,0.92)",
                  fontWeight: 900,
                  boxSizing: "border-box",
                  outline: "none",
                }}
              />
              <div style={{ marginTop: 8, fontSize: 12, opacity: 0.7 }}>
                Leave it blank if you don’t have one yet.
              </div>
            </div>

            {/* Actions */}
            <div style={{ marginTop: 18, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 12 }}>
              <PrimaryBtn onClick={onContinue} disabled={!canContinue}>
                Continue → Phase 1
              </PrimaryBtn>
              <GhostBtn onClick={onReset}>Reset (settings only)</GhostBtn>
            </div>

            {!canContinue ? (
              <div style={{ marginTop: 10, fontSize: 12, opacity: 0.7 }}>
                Select a <b>Goal level</b> to continue.
              </div>
            ) : null}
          </SoftCard>
        </div>
      </div>
    </main>
  );
}