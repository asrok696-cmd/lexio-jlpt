// app/diagnostic/phase2/page.tsx
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { DIAGNOSTIC_BANK, type Question } from "@/_lib/diagnosticBank";
import { ensureCarryoverForToday } from "@/_lib/carryover";

// ✅ Diagnostic → StudyPlan 生成
import { ensureStudyPlanFromDiagnostic } from "@/_lib/diagnosticToPlan";

// ✅ 診断完了フラグ（middleware が cookie を見る設計に合わせる）
const DIAG_DONE_COOKIE = "lexio.diag.done.v1";
const DIAG_DONE_LS = "lexio.diag.done.v1";

// Phase1結果（推定級）を読むキー
const DIAG_PHASE1_KEY = "lexio.diag.phase1.v1";

// Phase2 結果保存
export const DIAG_PHASE2_RESULT_KEY = "lexio.diag.phase2.result.v1";

type Skill = "vocab" | "grammar" | "reading";
type JLPTLevel = "N5" | "N4" | "N3" | "N2" | "N1";

// Phase1保存の互換型（最小）
type Phase1Stored = {
  estimatedLevel?: JLPTLevel;
  estimated?: JLPTLevel; // 旧キー対策
};

type Answer = {
  qid: string;
  choice: number; // 0..3
  correct: boolean;
  skill: Skill;
  level: JLPTLevel;
};

type Phase2Result = {
  version: 1;
  createdAt: string;
  baseLevel?: JLPTLevel | null;
  total: number;
  correct: number;
  bySkill: Record<Skill, { total: number; correct: number; rate: number }>;
  weakestSkills: Skill[];
  answers: Answer[];
};

const pageWrap: React.CSSProperties = {
  minHeight: "100vh",
  background: "#000",
  color: "rgba(255,255,255,0.92)",
};

const container: React.CSSProperties = {
  maxWidth: 980,
  margin: "0 auto",
  padding: 24,
};

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
        maxWidth: 520,
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
        maxWidth: 520,
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

function setCookieOneYear(name: string, value: string) {
  const maxAge = 60 * 60 * 24 * 365;
  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAge}; SameSite=Lax`;
}

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

function asSkill(x: any): Skill {
  return x === "vocab" || x === "grammar" || x === "reading" ? x : "vocab";
}

function asLevel(x: any): JLPTLevel {
  return x === "N5" || x === "N4" || x === "N3" || x === "N2" || x === "N1" ? x : "N5";
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

// Phase1保存結果から推定級を安全に読む
function readEstimatedLevelFromPhase1(): JLPTLevel | null {
  const p1 = readJSON<Phase1Stored>(DIAG_PHASE1_KEY);
  const lv = (p1?.estimatedLevel ?? p1?.estimated) as any;
  return lv ? asLevel(lv) : null;
}

function pickPhase2Questions(bank: Question[], baseLevel?: JLPTLevel | null) {
  const phase2 = bank.filter((q: any) => q?.phase === "phase2");
  const filtered = baseLevel ? phase2.filter((q: any) => asLevel(q.level) === baseLevel) : phase2;

  // 9問
  const out: Question[] = [];
  for (const q of filtered) {
    if (out.length >= 9) break;
    out.push(q);
  }
  if (out.length < 9) {
    for (const q of phase2) {
      if (out.length >= 9) break;
      if (out.some((x) => (x as any).id === (q as any).id)) continue;
      out.push(q);
    }
  }
  return out;
}

function calcWeakest(answers: Answer[]) {
  const init = {
    vocab: { total: 0, correct: 0, rate: 0 },
    grammar: { total: 0, correct: 0, rate: 0 },
    reading: { total: 0, correct: 0, rate: 0 },
  } satisfies Record<Skill, { total: number; correct: number; rate: number }>;

  for (const a of answers) {
    init[a.skill].total += 1;
    if (a.correct) init[a.skill].correct += 1;
  }

  (Object.keys(init) as Skill[]).forEach((k) => {
    const t = init[k].total;
    init[k].rate = t > 0 ? Math.round((init[k].correct / t) * 1000) / 10 : 0;
  });

  const rates = (Object.keys(init) as Skill[]).map((k) => ({ k, rate: init[k].rate }));
  const min = Math.min(...rates.map((x) => x.rate));
  const weakest = rates.filter((x) => x.rate === min).map((x) => x.k);

  return { bySkill: init, weakest };
}

export default function DiagnosticPhase2Page() {
  const router = useRouter();
  const sp = useSearchParams();

  // baseLevel 優先順位：URL > Phase1 > null
  const baseLevel = useMemo(() => {
    const q = sp.get("base");
    if (q) return asLevel(q);
    return readEstimatedLevelFromPhase1();
  }, [sp]);

  const qs = useMemo(() => pickPhase2Questions(DIAGNOSTIC_BANK as any, baseLevel), [baseLevel]);

  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState<Record<string, number>>({});
  const [done, setDone] = useState(false);

  const total = qs.length;
  const current = qs[idx] as any | undefined;

  useEffect(() => {
    try {
      ensureCarryoverForToday();
    } catch (e) {
      console.error("[phase2] ensureCarryoverForToday failed", e);
    }
  }, []);

  const answeredCount = useMemo(() => Object.keys(picked).length, [picked]);
  const pct = total > 0 ? Math.round((answeredCount / total) * 100) : 0;

  function choose(i: number) {
    if (!current) return;
    const id = String(current.id);
    setPicked((p) => ({ ...p, [id]: i }));
  }

  function nextQ() {
    if (idx < total - 1) setIdx((n) => n + 1);
  }

  function prevQ() {
    if (idx > 0) setIdx((n) => n - 1);
  }

  function submit() {
    // 採点
    const answers: Answer[] = qs
      .map((q: any) => {
        const id = String(q.id);
        const choice = picked[id];
        if (typeof choice !== "number") return null;
        const correctIndex = Number(q.correct);
        const ok = choice === correctIndex;
        return {
          qid: id,
          choice,
          correct: ok,
          skill: asSkill(q.skill),
          level: asLevel(q.level),
        } as Answer;
      })
      .filter(Boolean) as Answer[];

    const correct = answers.filter((a) => a.correct).length;
    const { bySkill, weakest } = calcWeakest(answers);

    const result: Phase2Result = {
      version: 1,
      createdAt: new Date().toISOString(),
      baseLevel,
      total: answers.length,
      correct,
      bySkill,
      weakestSkills: weakest.length ? weakest : ["vocab", "grammar", "reading"],
      answers,
    };

    // ✅ Phase2結果保存
    writeJSON(DIAG_PHASE2_RESULT_KEY, result);

    // ✅ 診断→プラン生成（ここが追加）
    // Phase0(settings) + Phase2(result) を元に STUDY_PLAN_KEY を生成して保存
    // force=true: 診断やり直し時に plan を作り直せる
    try {
      ensureStudyPlanFromDiagnostic(true);
    } catch (e) {
      console.error("[phase2] ensureStudyPlanFromDiagnostic failed", e);
      // ここで落として診断完了を止めるより、完了自体は進める（後で practice 側でも保険生成する想定）
    }

    // ✅ 完了フラグ（middleware が cookie/LS を見る設計に合わせる）
    localStorage.setItem(DIAG_DONE_LS, "1");
    setCookieOneYear(DIAG_DONE_COOKIE, "1");

    setDone(true);
  }

  function goDashboard() {
    // ✅ middleware の状態遷移に任せる（diagDone cookie が反映されていれば /dashboard へ）
    router.replace("/start");
  }

  if (total === 0) {
    return (
      <main style={pageWrap}>
        <div style={container}>
          <SoftCard>
            <div style={{ fontWeight: 950, fontSize: 18 }}>Phase 2</div>
            <div style={{ marginTop: 10, fontSize: 13, opacity: 0.8, lineHeight: 1.6 }}>
              No Phase2 questions found in DIAGNOSTIC_BANK.
              <br />
              Check that diagnosticBank.ts has <b>phase: "phase2"</b>.
            </div>
            <div style={{ marginTop: 12 }}>
              <GhostBtn onClick={() => router.replace("/diagnostic/phase1")}>Back to Phase 1</GhostBtn>
            </div>
          </SoftCard>
        </div>
      </main>
    );
  }

  if (done) {
    const r = readJSON<Phase2Result>(DIAG_PHASE2_RESULT_KEY);
    const v = r?.bySkill?.vocab?.rate ?? 0;
    const g = r?.bySkill?.grammar?.rate ?? 0;
    const rd = r?.bySkill?.reading?.rate ?? 0;

    return (
      <main style={pageWrap}>
        <div style={container}>
          <SoftCard>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 10,
                flexWrap: "wrap",
                alignItems: "center",
              }}
            >
              <div>
                <div style={{ fontSize: 28, fontWeight: 950 }}>Diagnostic</div>
                <div style={{ marginTop: 6, fontSize: 13, opacity: 0.75 }}>Phase 2 Complete</div>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <Pill>
                  score {r?.correct ?? 0}/{r?.total ?? 0}
                </Pill>
                {baseLevel ? <Pill>base {baseLevel}</Pill> : <Pill>base —</Pill>}
              </div>
            </div>

            <div style={{ marginTop: 14 }}>
              <div style={{ fontWeight: 950, fontSize: 14 }}>Skill rates</div>
              <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
                <div>
                  <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 6 }}>Vocab {v}%</div>
                  <ProgressBar pct={v} />
                </div>
                <div>
                  <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 6 }}>Grammar {g}%</div>
                  <ProgressBar pct={g} />
                </div>
                <div>
                  <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 6 }}>Reading {rd}%</div>
                  <ProgressBar pct={rd} />
                </div>
              </div>
            </div>

            <div style={{ marginTop: 14, fontSize: 13, opacity: 0.85, lineHeight: 1.6 }}>
              Weakest: <b>{(r?.weakestSkills ?? []).join(", ")}</b>
            </div>

            <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
              <PrimaryBtn onClick={goDashboard}>Go to Dashboard →</PrimaryBtn>
            </div>
          </SoftCard>
        </div>
      </main>
    );
  }

  const currentId = current ? String(current.id) : "";
  const currentPicked = typeof picked[currentId] === "number" ? picked[currentId] : null;
  const canSubmit = answeredCount === total;

  return (
    <main style={pageWrap}>
      <div style={container}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 28, fontWeight: 950 }}>Diagnostic · Phase 2</div>
            <div style={{ marginTop: 6, fontSize: 13, opacity: 0.75 }}>Identify your weakest skill — 9 questions</div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Pill>
              {answeredCount}/{total} answered
            </Pill>
            <Pill>
              Q {idx + 1}/{total}
            </Pill>
            {baseLevel ? <Pill>base {baseLevel}</Pill> : <Pill>base —</Pill>}
          </div>
        </div>

        <div style={{ marginTop: 12 }}>
          <ProgressBar pct={pct} />
          <div style={{ marginTop: 8, fontSize: 12, opacity: 0.75 }}>progress {pct}%</div>
        </div>

        <div style={{ marginTop: 14 }}>
          <SoftCard>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <div style={{ fontWeight: 950, fontSize: 14 }}>
                {(current?.skill ?? "vocab").toUpperCase()} · {(current?.level ?? "N5").toUpperCase()}
              </div>
              <div style={{ fontSize: 12, opacity: 0.8 }}>id: {currentId}</div>
            </div>

            <div style={{ marginTop: 12, fontSize: 14, lineHeight: 1.8, whiteSpace: "pre-wrap" }}>
              {current?.prompt ?? "—"}
            </div>

            <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
              {(current?.choices ?? []).map((c: string, i: number) => {
                const active = currentPicked === i;
                return (
                  <button
                    key={i}
                    onClick={() => choose(i)}
                    style={{
                      textAlign: "left",
                      padding: "12px 12px",
                      borderRadius: 14,
                      border: "1px solid rgba(255,255,255,0.12)",
                      background: active ? "rgba(120, 90, 255, 0.22)" : "rgba(0,0,0,0.20)",
                      color: "rgba(255,255,255,0.92)",
                      cursor: "pointer",
                      fontWeight: 900,
                      lineHeight: 1.4,
                    }}
                  >
                    <span style={{ opacity: 0.85, marginRight: 8 }}>{String.fromCharCode(65 + i)}.</span>
                    {c}
                  </button>
                );
              })}
            </div>

            <div style={{ marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button
                onClick={prevQ}
                disabled={idx === 0}
                style={{
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: "1px solid rgba(255,255,255,0.12)",
                  background: "rgba(255,255,255,0.06)",
                  color: "white",
                  fontWeight: 950,
                  cursor: idx === 0 ? "not-allowed" : "pointer",
                  opacity: idx === 0 ? 0.5 : 1,
                }}
              >
                ← Prev
              </button>

              <button
                onClick={nextQ}
                disabled={idx === total - 1}
                style={{
                  padding: "10px 12px",
                  borderRadius: 12,
                  border: "1px solid rgba(255,255,255,0.12)",
                  background: "rgba(255,255,255,0.06)",
                  color: "white",
                  fontWeight: 950,
                  cursor: idx === total - 1 ? "not-allowed" : "pointer",
                  opacity: idx === total - 1 ? 0.5 : 1,
                }}
              >
                Next →
              </button>
            </div>

            <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
              <PrimaryBtn onClick={submit} disabled={!canSubmit}>
                Submit Phase 2 →
              </PrimaryBtn>
            </div>

            {!canSubmit ? (
              <div style={{ marginTop: 10, fontSize: 12, opacity: 0.7 }}>Answer all {total} questions to submit.</div>
            ) : null}
          </SoftCard>
        </div>
      </div>
    </main>
  );
}