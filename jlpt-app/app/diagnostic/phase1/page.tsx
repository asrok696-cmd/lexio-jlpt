// app/diagnostic/phase1/page.tsx
"use client";

import React, { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import {
  PHASE1_QUESTIONS,
  computePhase1Result,
  DIAG_PHASE1_KEY,
  type Phase1Question,
  type Phase1Result,
} from "@/_lib/diagnosticPhase1";

// NOTE: Phase1では「診断完了」フラグは立てない（Phase2完了で立てる）
// const DIAG_DONE_COOKIE = "lexio.diag.done.v1";
// const DIAG_DONE_LS = "lexio.diag.done.v1";

type PickedMap = Record<string, 0 | 1 | 2 | 3>;

const pageWrap: React.CSSProperties = {
  minHeight: "100vh",
  background: "#000",
  color: "rgba(255,255,255,0.92)",
};

const container: React.CSSProperties = { maxWidth: 980, margin: "0 auto", padding: 24 };

// ---------- UI atoms ----------
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

function clampPct(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, n));
}

function ProgressBar({ pct }: { pct: number }) {
  const w = clampPct(pct);
  return (
    <div
      style={{
        height: 10,
        borderRadius: 999,
        border: "1px solid rgba(255,255,255,0.10)",
        background: "rgba(255,255,255,0.07)",
        overflow: "hidden",
      }}
    >
      <div style={{ height: "100%", width: `${w}%`, background: "rgba(120, 90, 255, 0.92)" }} />
    </div>
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

function GhostBtn({
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
        border: "1px solid rgba(255,255,255,0.12)",
        background: "rgba(255,255,255,0.06)",
        color: "white",
        fontWeight: 950,
        cursor: disabled ? "not-allowed" : "pointer",
        boxSizing: "border-box",
        lineHeight: 1.2,
        opacity: disabled ? 0.6 : 0.95,
      }}
    >
      {children}
    </button>
  );
}

// ---------- storage helpers ----------
function readJSON<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}
function writeJSON<T>(key: string, value: T) {
  localStorage.setItem(key, JSON.stringify(value));
}

function labelSkill(s: Phase1Question["skill"]) {
  if (s === "vocab") return "Vocab";
  if (s === "grammar") return "Grammar";
  return "Reading";
}

export default function DiagnosticPhase1Page() {
  const router = useRouter();
  const total = PHASE1_QUESTIONS.length;

  const [answers, setAnswers] = useState<PickedMap>(() => {
    const prev = readJSON<Phase1Result>(DIAG_PHASE1_KEY);
    if (!prev?.answers) return {};
    const out: PickedMap = {};
    for (const q of PHASE1_QUESTIONS) {
      const a = (prev.answers as any)[q.id];
      if (a && typeof a.pickedIndex === "number") out[q.id] = a.pickedIndex;
    }
    return out;
  });

  const [i, setI] = useState(0);
  const q = PHASE1_QUESTIONS[i] ?? null;

  const answeredCount = useMemo(() => Object.keys(answers).length, [answers]);
  const pct = useMemo(() => Math.round((answeredCount / Math.max(1, total)) * 100), [answeredCount, total]);

  const picked = q ? answers[q.id] : undefined;
  const canNext = q ? typeof picked === "number" : false;

  function onPick(idx: 0 | 1 | 2 | 3) {
    if (!q) return;
    setAnswers((prev) => ({ ...prev, [q.id]: idx }));
  }

  function onBack() {
    setI((x) => Math.max(0, x - 1));
  }

  function onNext() {
    if (!q || !canNext) return;

    const isLast = i >= total - 1;
    if (!isLast) {
      setI((x) => x + 1);
      return;
    }

    // finish phase1 -> save result
    const result = computePhase1Result(answers);
    writeJSON(DIAG_PHASE1_KEY, result);

    // move to phase2 (baseLevelはphase2側でLSから読むので不要)
    router.replace("/diagnostic/phase2");
  }

  function onExitToDashboard() {
    // fail-safe: save partial progress so user can resume without losing data
    writeJSON(DIAG_PHASE1_KEY, computePhase1Result(answers));
    router.replace("/dashboard");
  }

  if (!q) {
    return (
      <main style={pageWrap}>
        <div style={container}>
          <SoftCard>
            <div style={{ fontWeight: 950, fontSize: 18 }}>No questions found.</div>
          </SoftCard>
        </div>
      </main>
    );
  }

  return (
    <main style={pageWrap}>
      <div style={container}>
        {/* Unified Header */}
        <SoftCard>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: 28, fontWeight: 950 }}>Diagnostic Assessment</div>
              <div style={{ marginTop: 6, fontSize: 13, opacity: 0.78, lineHeight: 1.6 }}>
                Phase 1 · Level Estimation
                <br />
                {total} questions · Threshold: 2/3 per level
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <Pill>
                Q {i + 1}/{total}
              </Pill>
              <Pill>{q.level}</Pill>
              <Pill>{labelSkill(q.skill)}</Pill>
              <Pill>{pct}%</Pill>
              <button
                onClick={onExitToDashboard}
                style={{
                  padding: "8px 10px",
                  borderRadius: 12,
                  border: "1px solid rgba(255,255,255,0.12)",
                  background: "rgba(255,255,255,0.05)",
                  color: "rgba(255,255,255,0.92)",
                  fontWeight: 950,
                  cursor: "pointer",
                }}
                title="Exit and return to Dashboard"
              >
                Exit
              </button>
            </div>
          </div>

          <div style={{ marginTop: 12 }}>
            <ProgressBar pct={pct} />
            <div style={{ marginTop: 8, fontSize: 12, opacity: 0.75 }}>
              Answered {answeredCount}/{total}
            </div>
          </div>
        </SoftCard>

        {/* Question Card */}
        <div style={{ marginTop: 12 }}>
          <SoftCard>
            <div style={{ fontSize: 12, opacity: 0.7 }}>ID: {q.id}</div>
            <div style={{ marginTop: 10, fontSize: 18, fontWeight: 950, whiteSpace: "pre-wrap" }}>{q.prompt}</div>

            <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
              {q.choices.map((c, idx) => {
                const isPicked = picked === idx;
                const bg = isPicked ? "rgba(120, 90, 255, 0.18)" : "rgba(255,255,255,0.06)";
                const border = isPicked ? "1px solid rgba(120, 90, 255, 0.35)" : "1px solid rgba(255,255,255,0.12)";
                return (
                  <button
                    key={idx}
                    onClick={() => onPick(idx as 0 | 1 | 2 | 3)}
                    style={{
                      textAlign: "left",
                      padding: "12px 12px",
                      borderRadius: 14,
                      border,
                      background: bg,
                      color: "white",
                      fontWeight: 900,
                      cursor: "pointer",
                      boxSizing: "border-box",
                    }}
                  >
                    <span style={{ opacity: 0.85, marginRight: 8 }}>{String.fromCharCode(65 + idx)}.</span>
                    {c}
                  </button>
                );
              })}
            </div>

            {/* Unified Footer Buttons */}
            <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
              <GhostBtn onClick={onBack} disabled={i === 0}>
                Back
              </GhostBtn>
              <PrimaryBtn onClick={onNext} disabled={!canNext}>
                {i >= total - 1 ? "Continue to Phase 2 →" : "Next →"}
              </PrimaryBtn>
            </div>
          </SoftCard>
        </div>
      </div>
    </main>
  );
}