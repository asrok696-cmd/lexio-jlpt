// app/(app)/practice/weekly-check/session/page.tsx
"use client";

import Link from "next/link";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { toWeekV1FromRoadmap } from "@/app/_lib/roadmapCompat";
import { ensureNextRoadmapFromWeeklyCheck } from "@/app/_lib/weeklyCheckToPlan";
import { WEEKLY_BANK } from "@/app/_lib/weeklyCheckBank";

import {
  ROADMAP_ACTIVE_KEY,
  ROADMAP_KEY,
  type RoadmapWeekV1,
  type Skill,
  readJSON,
  writeJSON,
  todayISO,
} from "@/app/_lib/roadmap";

import { CARRYOVER_KEY, type Carryover } from "@/app/_lib/carryover";

import type { JLPTLevel } from "@/app/_lib/roadmap";
import {
  WEEKLY_CHECK_KEY,
  readWeeklyCheckStore,
  ensureWeeklyLevelsFromRoadmap,
  buildWeeklyCheckSession,
  finalizeWeeklyCheck,
  type WeeklyCheckSession,
  saveWeeklyCheckResultV2,
  summarizeWeeklyCheckBySkillFromAnswers,
} from "@/app/_lib/weeklyCheck";

const SESSION_SNAPSHOT_KEY = "lexio.weeklyCheck.session.v1";

// ==============================
// ✅ DEV FLAGS（確認用）
// 確認後は false に戻す
// ==============================
const DEV_BYPASS_WEEKLY_LOCK_IN_SESSION = true; // Day7/carryover ロックを session 側でも無視
const DEV_SHOW_SESSION_DEBUG = true;

type BankChoiceQ = {
  id: string;
  skill: Skill;
  prompt: string;
  choices: string[];
  correct: number;
  [k: string]: any;
};

const pageWrap: React.CSSProperties = { minHeight: "100vh", color: "rgba(255,255,255,0.92)" };
const container: React.CSSProperties = { maxWidth: 980, margin: "0 auto", padding: 24 };

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}
function formatTime(secs: number) {
  const s = Math.max(0, Math.floor(secs));
  const mm = String(Math.floor(s / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}
function skillLabel(s: Skill) {
  if (s === "vocab") return "Vocab";
  if (s === "grammar") return "Grammar";
  return "Reading";
}
function skillEmoji(s: Skill) {
  if (s === "vocab") return "🧠";
  if (s === "grammar") return "🧩";
  return "📖";
}

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

/** ✅ span→div にして「spanの中にblock要素」事故を予防 */
function Pill({ children }: { children: React.ReactNode }) {
  return (
    <div
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
        boxSizing: "border-box",
        minWidth: 0,
      }}
    >
      {children}
    </div>
  );
}

function ProgressBar({ pct }: { pct: number }) {
  const w = clamp(pct, 0, 100);
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
      type="button"
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
      type="button"
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
        opacity: disabled ? 0.65 : 0.95,
      }}
    >
      {children}
    </button>
  );
}

// compat read (v1/v2)
function readActiveWeek(): RoadmapWeekV1 | null {
  const a = readJSON<any>(ROADMAP_ACTIVE_KEY);
  const aCompat = toWeekV1FromRoadmap(a);
  if (aCompat?.days?.length) return aCompat;

  const b = readJSON<any>(ROADMAP_KEY);
  const bCompat = toWeekV1FromRoadmap(b);
  if (bCompat?.days?.length) return bCompat;

  return null;
}

function readCarryover(): Carryover | null {
  const c = readJSON<any>(CARRYOVER_KEY);
  if (!c || typeof c !== "object") return null;
  return c as Carryover;
}

// 入口と同じ判定（直打ち対策）
function getLockReason(week: RoadmapWeekV1 | null, carryover: Carryover | null) {
  if (!week) return "Roadmap not found (run Diagnostic first).";

  const today = todayISO();
  const todayDay = week.days.find((d) => d.dateISO === today) ?? null;
  const isDay7Today = Number(todayDay?.dayIndex ?? 0) === 7;

  const mustDoCarryoverFirst = !!(
    carryover &&
    !carryover.cleared &&
    (carryover.items?.length ?? 0) > 0
  );

  if (!isDay7Today) return "Weekly Check is available only on Day 7 (today is not Day 7).";
  if (mustDoCarryoverFirst) return "Carryover must be cleared first.";
  return null;
}

// ★ weekly session id と bank id がズレる場合の吸収（wc_r_008 → reading_008 等）
function findWeeklyQuestionById(qid: string): BankChoiceQ | null {
  const raw = String(qid ?? "").trim();
  if (!raw) return null;

  const candidates: string[] = [raw];

  // wc_v_001 / wc_g_014 / wc_r_008
  const m = raw.match(/^wc_([vgr])_(\d{1,4})$/i);
  if (m) {
    const short = m[1].toLowerCase();
    const numRaw = m[2];
    const numPadded3 = numRaw.padStart(3, "0");
    const numPlain = String(Number(numRaw));

    const skillPrefix = short === "v" ? "vocab" : short === "g" ? "grammar" : "reading";

    candidates.push(`${skillPrefix}_${numRaw}`);
    candidates.push(`${skillPrefix}_${numPadded3}`);
    candidates.push(`${skillPrefix}_${numPlain}`);

    candidates.push(`${short}_${numRaw}`);
    candidates.push(`${short}_${numPadded3}`);
    candidates.push(`${short}_${numPlain}`);
  }

  const uniq = Array.from(new Set(candidates.filter(Boolean)));

  const skills: Skill[] = ["vocab", "grammar", "reading"];
  for (const id of uniq) {
    for (const s of skills) {
      const list = (WEEKLY_BANK as any)?.[s] ?? [];
      const hit = (Array.isArray(list) ? list : []).find((q: any) => q && String(q.id) === id);
      if (hit) return hit as BankChoiceQ;
    }
  }
  return null;
}

// ✅ Step10: v2保存用の answer 正規化型
type WeeklyCheckAnswerLite = {
  skill: Skill;
  correct: boolean;
};

export default function WeeklyCheckSessionPage() {
  const router = useRouter();

  const [week, setWeek] = useState<RoadmapWeekV1 | null>(null);
  const [carryover, setCarryover] = useState<Carryover | null>(null);

  const [session, setSession] = useState<WeeklyCheckSession | null>(null);
  const [index, setIndex] = useState(0); // 0..29
  const [picked, setPicked] = useState<number | null>(null);
  const [checked, setChecked] = useState(false);
  const [lastCorrect, setLastCorrect] = useState<boolean | null>(null);
  const [answers, setAnswers] = useState<Record<string, { correct: boolean }>>({});
  const [completed, setCompleted] = useState(false);
  const [result, setResult] = useState<any>(null);

  const [startedAtISO, setStartedAtISO] = useState<string>(new Date().toISOString());
  const [elapsedSec, setElapsedSec] = useState(0);
  const tickRef = useRef<number | null>(null);

  const [initError, setInitError] = useState<string | null>(null);

  // ✅ Step10: v2保存結果（UI確認用・デバッグ用）
  const [weeklyV2SaveMeta, setWeeklyV2SaveMeta] = useState<{
    promoted?: boolean;
    currentPracticeLevel?: JLPTLevel;
  } | null>(null);

  // init
  useEffect(() => {
    const w = readActiveWeek();
    const c = readCarryover();

    setWeek(w ?? null);
    setCarryover(c ?? null);

    const rawLock = getLockReason(w ?? null, c ?? null);
    const lock = DEV_BYPASS_WEEKLY_LOCK_IN_SESSION ? null : rawLock;

    if (DEV_SHOW_SESSION_DEBUG) {
      console.log("[weekly-check/session:init]", {
        weekFound: !!w,
        rawLock,
        bypass: DEV_BYPASS_WEEKLY_LOCK_IN_SESSION,
        effectiveLock: lock,
        today: todayISO(),
      });
    }

    if (lock) {
      router.replace("/practice/weekly-check");
      return;
    }

    // weekly store init
    try {
      const rm = readJSON<any>(ROADMAP_KEY);
      const lv = (rm?.goalLevel ?? rm?.level ?? "N5") as JLPTLevel;
      if (lv) ensureWeeklyLevelsFromRoadmap({ roadmapLevel: lv });
    } catch {}

    if (!w) {
      setInitError("Roadmap not found. Please run Diagnostic (or rebuild roadmap) first.");
      return;
    }

    const weekId: string = (w as any)?.weekId ?? `wk-${Date.now()}`;
    const goalLevel: JLPTLevel = (w as any)?.goalLevel ?? "N5";

    // restore or build
    let s = readJSON<any>(SESSION_SNAPSHOT_KEY);
    const looksValid =
      s && s.weekId === weekId && Array.isArray(s.questions) && s.questions.length === 30;

    if (!looksValid) {
      const store = readWeeklyCheckStore();
      s = buildWeeklyCheckSession({
        weekId,
        goalLevel,
        practiceLevelBySkill: store.practiceLevelBySkill,
      });
      writeJSON(SESSION_SNAPSHOT_KEY, s);
    }

    const savedAnswers =
      s?.answers && typeof s.answers === "object"
        ? (s.answers as Record<string, { correct: boolean }>)
        : {};
    setAnswers(savedAnswers);

    // first unanswered
    const qs = s.questions ?? [];
    let idx = 0;
    for (let i = 0; i < qs.length; i++) {
      const qid = qs[i]?.id;
      if (qid && !savedAnswers[qid]) {
        idx = i;
        break;
      }
      if (i === qs.length - 1) idx = qs.length - 1;
    }

    setIndex(idx);
    setSession(s as WeeklyCheckSession);
    setPicked(null);
    setChecked(false);
    setLastCorrect(null);
    setCompleted(false);
    setResult(null);
    setWeeklyV2SaveMeta(null);
    setInitError(null);

    const startISO = (s as any).startedAtISO ?? new Date().toISOString();
    (s as any).startedAtISO = startISO;
    writeJSON(SESSION_SNAPSHOT_KEY, s);

    setStartedAtISO(startISO);
    setElapsedSec(0);
  }, [router]);

  // timer
  useEffect(() => {
    if (tickRef.current) {
      window.clearInterval(tickRef.current);
      tickRef.current = null;
    }
    if (completed) return;

    const startMs = new Date(startedAtISO).getTime();
    tickRef.current = window.setInterval(() => {
      setElapsedSec(Math.max(0, Math.floor((Date.now() - startMs) / 1000)));
    }, 250);

    return () => {
      if (tickRef.current) {
        window.clearInterval(tickRef.current);
        tickRef.current = null;
      }
    };
  }, [startedAtISO, completed]);

  const current = useMemo(() => {
    const q = (session as any)?.questions?.[index] ?? null;
    if (!q?.id) return null;
    const bankQ = findWeeklyQuestionById(q.id);
    if (!bankQ) return null;
    return { meta: q, bankQ };
  }, [session, index]);

  const weekId = (week as any)?.weekId ?? (session as any)?.weekId ?? "—";
  const answered = Object.keys(answers ?? {}).length;

  function persistAnswers(next: Record<string, { correct: boolean }>) {
    if (!session) return;
    const nextSession: any = { ...session, answers: next };
    setSession(nextSession);
    writeJSON(SESSION_SNAPSHOT_KEY, nextSession);
  }

  function onCheck() {
    if (!current || picked === null || checked) return;

    const ok = picked === current.bankQ.correct;
    setChecked(true);
    setLastCorrect(ok);

    const next = { ...answers, [current.meta.id]: { correct: ok } };
    setAnswers(next);
    persistAnswers(next);
  }

  function onNext() {
    if (!checked || !session) return;
    setPicked(null);
    setChecked(false);
    setLastCorrect(null);
    setIndex((prev) => Math.min(29, prev + 1));
  }

  // ✅ Step10: session+bank から v2保存用 answers を組み立てる
  function buildWeeklyCheckAnswerLiteList(args: {
    sessionObj: WeeklyCheckSession | null;
    answersMap: Record<string, { correct: boolean }>;
  }): WeeklyCheckAnswerLite[] {
    const qs = (((args.sessionObj as any)?.questions ?? []) as any[]).filter(Boolean);

    const out: WeeklyCheckAnswerLite[] = [];
    for (const q of qs) {
      const qid = String(q?.id ?? "");
      if (!qid) continue;

      const ans = args.answersMap[qid];
      if (!ans || typeof ans.correct !== "boolean") continue;

      const bankQ = findWeeklyQuestionById(qid);
      const skill = (bankQ?.skill ?? "vocab") as Skill;

      out.push({
        skill: skill === "vocab" || skill === "grammar" || skill === "reading" ? skill : "vocab",
        correct: !!ans.correct,
      });
    }

    return out;
  }

  // ✅ Step10: v2 保存
  function persistWeeklyCheckResultV2(params: {
    weekObj: RoadmapWeekV1 | null;
    sessionObj: WeeklyCheckSession | null;
    answersMap: Record<string, { correct: boolean }>;
  }) {
    const w = params.weekObj ?? readActiveWeek();
    const wId = String((w as any)?.weekId ?? (params.sessionObj as any)?.weekId ?? `wk-${Date.now()}`);
    const level = (((w as any)?.goalLevel ?? "N5") as JLPTLevel) || "N5";

    const liteAnswers = buildWeeklyCheckAnswerLiteList({
      sessionObj: params.sessionObj,
      answersMap: params.answersMap,
    });

    const bySkill = summarizeWeeklyCheckBySkillFromAnswers(liteAnswers as any);

    const total =
      Number(bySkill?.vocab?.total ?? 0) +
      Number(bySkill?.grammar?.total ?? 0) +
      Number(bySkill?.reading?.total ?? 0);

    const correct =
      Number(bySkill?.vocab?.correct ?? 0) +
      Number(bySkill?.grammar?.correct ?? 0) +
      Number(bySkill?.reading?.correct ?? 0);

    const saved = saveWeeklyCheckResultV2({
      weekId: wId,
      level,
      bySkill,
      total,
      correct,
    } as any);

    return saved;
  }

  // ✅ Next-week preview (dryRun)
  const nextWeekPreview = useMemo(() => {
    if (!completed || !week) return null;
    try {
      const goalLevel: JLPTLevel = (week as any)?.goalLevel ?? "N5";
      return ensureNextRoadmapFromWeeklyCheck({ goalLevel, force: true, dryRun: true });
    } catch (e) {
      console.error("[weekly-check/session] preview build failed", e);
      return null;
    }
  }, [completed, week]);

  function calcSetShare(roadmap: any) {
    const days = Array.isArray(roadmap?.days) ? roadmap.days : [];
    const targetDays = days.filter((d: any) => {
      const di = Number(d?.dayIndex ?? 0);
      return di >= 1 && di <= 6;
    });

    const sums = { vocab: 0, grammar: 0, reading: 0 };

    for (const d of targetDays) {
      const a = d?.allocation ?? d?.setCounts ?? null;

      if (a && typeof a === "object") {
        sums.vocab += Number(a.vocab ?? 0) || 0;
        sums.grammar += Number(a.grammar ?? 0) || 0;
        sums.reading += Number(a.reading ?? 0) || 0;
        continue;
      }

      // fallback: count sets by id prefix
      const sets = Array.isArray(d?.sets) ? d.sets : [];
      for (const s of sets) {
        const id = String(s?.setId ?? "");
        if (id.startsWith("vocab_")) sums.vocab += 1;
        else if (id.startsWith("grammar_")) sums.grammar += 1;
        else if (id.startsWith("reading_")) sums.reading += 1;
      }
    }

    const total = sums.vocab + sums.grammar + sums.reading;
    return {
      sums,
      pct: {
        vocab: total ? Math.round((sums.vocab / total) * 100) : 0,
        grammar: total ? Math.round((sums.grammar / total) * 100) : 0,
        reading: total ? Math.round((sums.reading / total) * 100) : 0,
        totalSets: total,
      },
    };
  }

  function onFinish() {
    if (!week || !session) return;
    if (Object.keys(answers ?? {}).length < 30) return;

    const goalLevel: JLPTLevel = (week as any)?.goalLevel ?? "N5";
    const wId: string = (week as any)?.weekId ?? (session as any)?.weekId;

    const { store: nextStore, result: res } = finalizeWeeklyCheck({
      session: { ...(session as any), answers },
      goalLevel,
      weekId: wId,
    } as any);

    writeJSON(WEEKLY_CHECK_KEY, nextStore);

    try {
      const v2saved = persistWeeklyCheckResultV2({
        weekObj: week,
        sessionObj: session,
        answersMap: answers,
      });

      setWeeklyV2SaveMeta({
        promoted: !!(v2saved as any)?.promoted,
        currentPracticeLevel: ((v2saved as any)?.currentPracticeLevel ?? undefined) as
          | JLPTLevel
          | undefined,
      });

      console.log("[weekly-check/session] v2 saved", v2saved);
    } catch (e) {
      console.error("[weekly-check/session] v2 save failed", e);
    }

    // ✅ IMPORTANT:
    // ここでは次週ロードマップ生成はしない（プレビュー+ボタンに移す）
    setCompleted(true);
    setResult(res);

    try {
      localStorage.removeItem(SESSION_SNAPSHOT_KEY);
    } catch {}
  }

  if (initError) {
    return (
      <main style={pageWrap}>
        <div style={container}>
          <SoftCard>
            <div style={{ fontWeight: 950 }}>Weekly Check Session Error</div>
            <div style={{ marginTop: 8, fontSize: 13, opacity: 0.8 }}>{initError}</div>
            <div
              style={{
                marginTop: 14,
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: 12,
              }}
            >
              <PrimaryBtn onClick={() => router.replace("/practice/weekly-check")}>
                Back to Weekly Entry →
              </PrimaryBtn>
              <GhostBtn onClick={() => router.replace("/diagnostic")}>Go to Diagnostic →</GhostBtn>
            </div>
          </SoftCard>
        </div>
      </main>
    );
  }

  if (!week && !session) {
    return (
      <main style={pageWrap}>
        <div style={container}>
          <SoftCard>
            <div style={{ fontWeight: 950 }}>Loading Weekly Check Session…</div>
            <div style={{ marginTop: 8, fontSize: 12, opacity: 0.75 }}>
              {DEV_BYPASS_WEEKLY_LOCK_IN_SESSION ? "DEV lock bypass active" : "Checking locks"}
            </div>
          </SoftCard>
        </div>
      </main>
    );
  }

  if (completed) {
    return (
      <main style={pageWrap}>
        <div style={container}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: 28, fontWeight: 950 }}>Weekly Check Complete</div>
              <div style={{ marginTop: 6, fontSize: 13, opacity: 0.75 }}>weekId {weekId}</div>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <Pill>answered {answered}/30</Pill>
              <Pill>time {formatTime(elapsedSec)}</Pill>
            </div>
          </div>

          <div style={{ marginTop: 12 }}>
            <SoftCard>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <Pill>V {result?.bySkill?.vocab?.correct ?? 0}/10</Pill>
                <Pill>G {result?.bySkill?.grammar?.correct ?? 0}/10</Pill>
                <Pill>R {result?.bySkill?.reading?.correct ?? 0}/10</Pill>
              </div>

              {weeklyV2SaveMeta ? (
                <div style={{ marginTop: 12, fontSize: 12, opacity: 0.78, lineHeight: 1.6 }}>
                  v2 saved · currentPracticeLevel: <b>{weeklyV2SaveMeta.currentPracticeLevel ?? "—"}</b>
                  {weeklyV2SaveMeta.promoted ? " · ✅ promoted" : ""}
                </div>
              ) : null}

              {/* ✅ Next week preview + Generate practice button */}
              {nextWeekPreview?.roadmap ? (() => {
                const share = calcSetShare((nextWeekPreview as any).roadmap);
                const practiceLv =
                  (nextWeekPreview as any)?.practiceLevel ??
                  (nextWeekPreview as any)?.roadmap?.weeklyPlanMeta?.practiceLevel ??
                  "—";
                const source = (nextWeekPreview as any)?.source ?? "—";
                const shapeKind = (nextWeekPreview as any)?.shape?.kind ?? "—";
                const nextWeekIdPreview = String(((nextWeekPreview as any)?.roadmap?.weekId ?? "—"));

                return (
                  <div style={{ marginTop: 14 }}>
                    <SoftCard>
                      <div style={{ fontWeight: 950, fontSize: 14 }}>Next week preview</div>

                      <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <Pill>nextWeekId {nextWeekIdPreview}</Pill>
                        <Pill>practiceLevel {String(practiceLv)}</Pill>
                        <Pill>source {String(source)}</Pill>
                        <Pill>shape {String(shapeKind)}</Pill>
                      </div>

                      <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <Pill>V {share.pct.vocab}%</Pill>
                        <Pill>G {share.pct.grammar}%</Pill>
                        <Pill>R {share.pct.reading}%</Pill>
                        <Pill>sets {share.pct.totalSets}</Pill>
                      </div>

                      <div
                        style={{
                          marginTop: 14,
                          display: "grid",
                          gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                          gap: 12,
                        }}
                      >
                        <PrimaryBtn
                          onClick={() => {
                            try {
                              const goalLevel: JLPTLevel = (week as any)?.goalLevel ?? "N5";
                              ensureNextRoadmapFromWeeklyCheck({ goalLevel, force: true, dryRun: false });
                              router.replace("/practice");
                            } catch (e) {
                              console.error("[weekly-check/session] generate failed", e);
                              alert("Generate failed. Check console.");
                            }
                          }}
                        >
                          Generate practice (next week) →
                        </PrimaryBtn>

                        <GhostBtn onClick={() => router.replace("/practice")}>
                          Back to Practice →
                        </GhostBtn>
                      </div>

                      <div style={{ marginTop: 10, fontSize: 12, opacity: 0.7 }}>
                        ※ “Generate practice” を押すまでロードマップは切り替わりません（preview only）
                      </div>
                    </SoftCard>
                  </div>
                );
              })() : null}

              <div
                style={{
                  marginTop: 14,
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                  gap: 12,
                }}
              >
                <GhostBtn onClick={() => router.replace("/practice/weekly-check")}>Back to Weekly Entry →</GhostBtn>
              </div>

              <div style={{ marginTop: 12, fontSize: 12, opacity: 0.65 }}>
                key: <b>{WEEKLY_CHECK_KEY}</b>
              </div>
            </SoftCard>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main style={pageWrap}>
      <div style={container}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 28, fontWeight: 950 }}>Weekly Check</div>
            <div style={{ marginTop: 6, fontSize: 13, opacity: 0.75 }}>
              30 questions · V/G/R each 10 · (6 this-week + 4 hard) · 90% streak x3 → promotion
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <Link href="/practice" style={{ fontSize: 13, opacity: 0.86, color: "white", textDecoration: "none" }}>
              ← Practice
            </Link>
            <Pill>week {weekId}</Pill>
            <Pill>Q {index + 1}/30</Pill>
            <Pill>answered {answered}/30</Pill>
            <Pill>time {formatTime(elapsedSec)}</Pill>
            {DEV_SHOW_SESSION_DEBUG && DEV_BYPASS_WEEKLY_LOCK_IN_SESSION ? <Pill>DEV: lock bypass</Pill> : null}
          </div>
        </div>

        <div style={{ marginTop: 12 }}>
          <SoftCard>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <Pill>
                  {skillEmoji((current?.bankQ.skill ?? "vocab") as Skill)}{" "}
                  {skillLabel((current?.bankQ.skill ?? "vocab") as Skill)}
                </Pill>
                <Pill>tag {(current as any)?.meta?.levelTag ?? "—"}</Pill>
                <Pill>id {(current as any)?.meta?.id ?? "—"}</Pill>
              </div>
              <div style={{ width: "min(360px, 100%)" }}>
                <ProgressBar pct={Math.round((answered / 30) * 100)} />
              </div>
            </div>

            {!current ? (
              <>
                <div style={{ marginTop: 12, fontSize: 14, opacity: 0.85 }}>No question found for this weekly session.</div>
                <div style={{ marginTop: 10, fontSize: 12, opacity: 0.75 }}>
                  sessionのIDとWEEKLY_BANKのIDが一致してない可能性が高い。<br />
                  例: session=wc_r_008 なのに bank側が reading_008 / r_008 など。
                </div>
                <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
                  <GhostBtn onClick={() => router.replace("/practice/weekly-check")}>Back to Entry →</GhostBtn>
                  <GhostBtn
                    onClick={() => {
                      try {
                        localStorage.removeItem(SESSION_SNAPSHOT_KEY);
                      } catch {}
                      location.reload();
                    }}
                  >
                    Reset Session Snapshot →
                  </GhostBtn>
                </div>
              </>
            ) : (
              <>
                <div style={{ marginTop: 14, fontSize: 18, fontWeight: 950, whiteSpace: "pre-wrap" }}>
                  {current.bankQ.prompt}
                </div>

                <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
                  {current.bankQ.choices.map((c, i) => {
                    const isPicked = picked === i;
                    const show = checked;

                    let bg = "rgba(255,255,255,0.06)";
                    let border = "1px solid rgba(255,255,255,0.12)";

                    if (show && i === current.bankQ.correct) {
                      bg = "rgba(60, 200, 120, 0.18)";
                      border = "1px solid rgba(60, 200, 120, 0.35)";
                    } else if (show && isPicked && i !== current.bankQ.correct) {
                      bg = "rgba(240, 80, 80, 0.16)";
                      border = "1px solid rgba(240, 80, 80, 0.30)";
                    } else if (!show && isPicked) {
                      bg = "rgba(120, 90, 255, 0.18)";
                      border = "1px solid rgba(120, 90, 255, 0.35)";
                    }

                    return (
                      <button
                        key={`${(current as any)?.meta?.id ?? "q"}-${i}`}
                        type="button"
                        onClick={() => {
                          if (checked) return;
                          setPicked(i);
                        }}
                        style={{
                          textAlign: "left",
                          padding: "12px 12px",
                          borderRadius: 14,
                          border,
                          background: bg,
                          color: "white",
                          fontWeight: 900,
                          cursor: checked ? "default" : "pointer",
                        }}
                      >
                        {c}
                      </button>
                    );
                  })}
                </div>

                <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
                  <PrimaryBtn onClick={onCheck} disabled={picked === null || checked}>
                    Check →
                  </PrimaryBtn>

                  <PrimaryBtn onClick={onNext} disabled={!checked || index >= 29}>
                    Next →
                  </PrimaryBtn>

                  <PrimaryBtn onClick={onFinish} disabled={Object.keys(answers ?? {}).length < 30}>
                    Finish →
                  </PrimaryBtn>
                </div>

                <div style={{ marginTop: 10, fontSize: 12, opacity: 0.7 }}>
                  {checked ? (lastCorrect ? "✅ correct" : "❌ wrong") : "Pick an answer"}
                </div>
              </>
            )}
          </SoftCard>
        </div>
      </div>
    </main>
  );
}