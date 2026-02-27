// app/practice/vgr/session/page.tsx
"use client";

import Link from "next/link";
import React, { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ROADMAP_KEY,
  ROADMAP_ACTIVE_KEY,
  readJSON,
  writeJSON,
  type JLPTLevel,
} from "@/app/_lib/roadmap";
import { buildSessionQuestionsFromPracticeBank } from "@/app/_lib/practiceBank";

// -----------------------------
// types (local-safe)
// -----------------------------
type Skill = "vocab" | "grammar" | "reading";

type AnyRoadmap = any;
type AnyDay = any;
type AnySet = any;

type SessionQuestion = {
  qid: string;
  prompt: string;
  choices: string[];
  answerIndex: number;
  explanation?: string;
};

type SessionResult = {
  qid: string;
  selectedIndex: number | null;
  correct: boolean;
};

// -----------------------------
// constants
// -----------------------------
const SESSION_LOG_KEY = "lexio.practice.sessionlog.v1";

// -----------------------------
// UI atoms
// -----------------------------
const pageWrap: React.CSSProperties = {
  minHeight: "100vh",
  color: "rgba(255,255,255,0.92)",
};

const container: React.CSSProperties = {
  maxWidth: 1080,
  margin: "0 auto",
  padding: 24,
};

function SoftCard({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        borderRadius: 18,
        border: "1px solid rgba(255,255,255,0.10)",
        background: "rgba(255,255,255,0.04)",
        padding: 16,
        boxShadow: "0 0 0 1px rgba(0,0,0,0.20) inset",
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
        whiteSpace: "nowrap",
        boxSizing: "border-box",
      }}
    >
      {children}
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
        opacity: disabled ? 0.7 : 1,
        boxSizing: "border-box",
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
        opacity: disabled ? 0.65 : 0.95,
        boxSizing: "border-box",
      }}
    >
      {children}
    </button>
  );
}

function ProgressBar({ pct }: { pct: number }) {
  const w = Math.max(0, Math.min(100, Number.isFinite(pct) ? pct : 0));
  return (
    <div
      style={{
        height: 10,
        borderRadius: 999,
        border: "1px solid rgba(255,255,255,0.10)",
        background: "rgba(255,255,255,0.07)",
        overflow: "hidden",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          height: "100%",
          width: `${w}%`,
          background: "rgba(120, 90, 255, 0.92)",
        }}
      />
    </div>
  );
}

// -----------------------------
// helpers
// -----------------------------
function isSkill(v: unknown): v is Skill {
  return v === "vocab" || v === "grammar" || v === "reading";
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

function inferSkillFromSetId(setId: string): Skill | null {
  if (setId.startsWith("vocab_")) return "vocab";
  if (setId.startsWith("grammar_")) return "grammar";
  if (setId.startsWith("reading_")) return "reading";
  return null;
}

function getSetSeqFromId(setId: string): number {
  const m = String(setId).match(/_(\d+)$/);
  return m ? Number(m[1]) : 0;
}

function isJLPTLevel(v: unknown): v is JLPTLevel {
  return v === "N5" || v === "N4" || v === "N3" || v === "N2" || v === "N1";
}

function readActiveRoadmap(): AnyRoadmap | null {
  const a = readJSON<any>(ROADMAP_ACTIVE_KEY);
  if (a && Array.isArray(a?.days)) return a;
  const b = readJSON<any>(ROADMAP_KEY);
  if (b && Array.isArray(b?.days)) return b;
  return null;
}

function getPracticeSetsFromDay(day: AnyDay): AnySet[] {
  const sets = Array.isArray(day?.sets) ? day.sets : [];
  return sets.filter((s: any) => {
    const id = String(s?.setId ?? "");
    return id.startsWith("vocab_") || id.startsWith("grammar_") || id.startsWith("reading_");
  });
}

function getSkillSetsFromDay(day: AnyDay, skill: Skill): AnySet[] {
  return getPracticeSetsFromDay(day)
    .filter((s) => {
      const sid = String(s?.setId ?? "");
      const sk = (s?.skill as Skill | undefined) ?? inferSkillFromSetId(sid);
      return sk === skill;
    })
    .sort((a, b) => getSetSeqFromId(String(a?.setId ?? "")) - getSetSeqFromId(String(b?.setId ?? "")));
}

function progressStatsFromSet(s: AnySet | null) {
  const p = s?.progress ?? {};
  const total =
    Number(p?.total ?? (Array.isArray(s?.questionIds) ? s.questionIds.length : 0) ?? s?.plannedCount ?? 0) || 0;
  const mastered = Array.isArray(p?.mastered) ? p.mastered.length : 0;
  const attempts = Number(p?.attempts ?? 0) || 0;
  const finished = !!p?.finishedAt || (total > 0 && mastered >= total);
  return { total, mastered, attempts, finished };
}

function getDailyProgress(day: AnyDay) {
  const sets = getPracticeSetsFromDay(day);
  const done = sets.filter((s) => progressStatsFromSet(s).finished).length;
  return { done, total: sets.length };
}

function getSkillProgress(day: AnyDay, skill: Skill) {
  const sets = getSkillSetsFromDay(day, skill);
  const done = sets.filter((s) => progressStatsFromSet(s).finished).length;
  return { done, total: sets.length };
}

function getNextSetInSkill(day: AnyDay, skill: Skill, currentSetId: string): AnySet | null {
  const skillSets = getSkillSetsFromDay(day, skill);
  const idx = skillSets.findIndex((s) => String(s?.setId ?? "") === currentSetId);
  if (idx < 0) return null;

  for (let i = idx + 1; i < skillSets.length; i++) {
    if (!progressStatsFromSet(skillSets[i]).finished) return skillSets[i];
  }
  return skillSets[idx + 1] ?? null;
}

function plannedCountForSet(s: AnySet, skill: Skill): number {
  const n = Number(s?.plannedCount ?? 0);
  if (Number.isFinite(n) && n > 0) return Math.floor(n);
  return skill === "reading" ? 5 : 10;
}

function resolveSetLevel(roadmap: AnyRoadmap | null, setObj: AnySet | null): JLPTLevel {
  const explicit = setObj?.levelTag ?? setObj?.level;
  if (isJLPTLevel(explicit)) return explicit;
  const g = roadmap?.goalLevel ?? roadmap?.level ?? "N5";
  return isJLPTLevel(g) ? g : "N5";
}

function localNowISO() {
  return new Date().toISOString();
}

function formatDurationMMSS(totalSec: number): string {
  const s = Math.max(0, Math.floor(Number(totalSec) || 0));
  const mm = Math.floor(s / 60);
  const ss = s % 60;
  return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
}

function formatDurationLong(totalSec: number): string {
  const s = Math.max(0, Math.floor(Number(totalSec) || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;

  if (h > 0) return `${h}h ${m}m ${sec}s`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}

function writeSessionLog(entry: any) {
  try {
    const raw = localStorage.getItem(SESSION_LOG_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    const next = Array.isArray(arr) ? arr : [];
    next.push(entry);
    localStorage.setItem(SESSION_LOG_KEY, JSON.stringify(next));
  } catch {
    // no-op
  }
}

function isValidSessionQuestion(q: SessionQuestion): boolean {
  if (!q.qid) return false;
  if (!q.prompt) return false;
  if (!Array.isArray(q.choices) || q.choices.length < 2) return false;
  if (!Number.isFinite(q.answerIndex)) return false;
  if (q.answerIndex < 0 || q.answerIndex >= q.choices.length) return false;
  return true;
}

/**
 * roadmap 内の set progress を更新して ROADMAP_KEY / ROADMAP_ACTIVE_KEY に保存
 */
function persistSetProgressToRoadmap(params: {
  dayIndex: number;
  setId: string;
  total: number;
  masteredQids: string[];
  wrongEverQids: string[];
  attempts: number;
  finished: boolean;
}) {
  const { dayIndex, setId, total, masteredQids, wrongEverQids, attempts, finished } = params;

  const updateOne = (rm: AnyRoadmap | null): AnyRoadmap | null => {
    if (!rm || !Array.isArray(rm?.days)) return rm;
    const days = rm.days.map((d: any) => {
      if (Number(d?.dayIndex ?? 0) !== dayIndex) return d;

      const sets = Array.isArray(d?.sets) ? d.sets : [];
      const nextSets = sets.map((s: any) => {
        if (String(s?.setId ?? "") !== setId) return s;

        const prevP = s?.progress ?? {};
        const startedAtISO = prevP?.startedAtISO ?? localNowISO();

        return {
          ...s,
          progress: {
            ...prevP,
            total,
            mastered: Array.from(new Set(masteredQids)),
            remaining: [],
            wrongEver: Array.from(new Set(wrongEverQids)),
            attempts,
            startedAtISO,
            finishedAt: finished ? localNowISO() : null,
          },
        };
      });

      return { ...d, sets: nextSets };
    });

    return {
      ...rm,
      days,
      updatedAt: localNowISO(),
    };
  };

  const active = readJSON<any>(ROADMAP_ACTIVE_KEY);
  if (active && Array.isArray(active?.days)) {
    writeJSON(ROADMAP_ACTIVE_KEY, updateOne(active));
  }

  const main = readJSON<any>(ROADMAP_KEY);
  if (main && Array.isArray(main?.days)) {
    writeJSON(ROADMAP_KEY, updateOne(main));
  }
}

// -----------------------------
// page
// -----------------------------
export default function VgrSessionPage() {
  const router = useRouter();
  const sp = useSearchParams();

  const dayParam = Math.max(1, Math.min(7, Number(sp.get("day") ?? "1") || 1));
  const setIdParam = String(sp.get("set") ?? "");
  const skillParamRaw = sp.get("skill");
  const skillParam: Skill | null = isSkill(skillParamRaw) ? skillParamRaw : inferSkillFromSetId(setIdParam);

  const [mounted, setMounted] = useState(false);
  const [roadmap, setRoadmap] = useState<AnyRoadmap | null>(null);

  // question session states
  const [questions, setQuestions] = useState<SessionQuestion[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [checked, setChecked] = useState(false);
  const [results, setResults] = useState<SessionResult[]>([]);
  const [wrongEver, setWrongEver] = useState<string[]>([]);
  const [startedAt, setStartedAt] = useState<string>("");

  // timer states
  const [elapsedSec, setElapsedSec] = useState(0);
  const [endedAt, setEndedAt] = useState<string>("");

  // session init status (✅ empty questions を「完了扱い」にしないため)
  const [sessionInitDone, setSessionInitDone] = useState(false);
  const [sessionInitError, setSessionInitError] = useState<string | null>(null);

  // save guard
  const [saveJustDone, setSaveJustDone] = useState(false);

  useEffect(() => {
    setMounted(true);
    const rm = readActiveRoadmap();
    setRoadmap(rm ?? null);
  }, []);

  const currentDay = useMemo(() => {
    const days = (roadmap as any)?.days ?? [];
    if (!Array.isArray(days)) return null;
    return days.find((d: any) => Number(d?.dayIndex ?? 0) === dayParam) ?? null;
  }, [roadmap, dayParam]);

  const currentSetObj = useMemo(() => {
    if (!currentDay) return null;
    return getPracticeSetsFromDay(currentDay).find((s) => String(s?.setId ?? "") === setIdParam) ?? null;
  }, [currentDay, setIdParam]);

  const resolvedSkill = useMemo<Skill | null>(() => {
    if (skillParam) return skillParam;
    if (currentSetObj) {
      const fromSet =
        (currentSetObj?.skill as Skill | undefined) ?? inferSkillFromSetId(String(currentSetObj?.setId ?? ""));
      return fromSet ?? null;
    }
    return null;
  }, [skillParam, currentSetObj]);

  const resolvedLevel = useMemo<JLPTLevel>(() => {
    return resolveSetLevel(roadmap, currentSetObj);
  }, [roadmap, currentSetObj]);

  const setSeq = useMemo(() => getSetSeqFromId(setIdParam), [setIdParam]);

  const skillProgress = useMemo(() => {
    if (!currentDay || !resolvedSkill) return { done: 0, total: 0 };
    return getSkillProgress(currentDay, resolvedSkill);
  }, [currentDay, resolvedSkill]);

  const dailyProgress = useMemo(() => {
    if (!currentDay) return { done: 0, total: 0 };
    return getDailyProgress(currentDay);
  }, [currentDay]);

  const nextSet = useMemo(() => {
    if (!currentDay || !resolvedSkill || !setIdParam) return null;
    return getNextSetInSkill(currentDay, resolvedSkill, setIdParam);
  }, [currentDay, resolvedSkill, setIdParam]);

  const currentSetProgress = useMemo(() => progressStatsFromSet(currentSetObj), [currentSetObj]);

  const isFinished = useMemo(() => {
    if (questions.length === 0) return false;
    return currentIdx >= questions.length;
  }, [currentIdx, questions.length]);

  // initialize session questions (✅ practiceBank から読み込む)
  useEffect(() => {
    if (!currentSetObj || !resolvedSkill) return;

    setSessionInitDone(false);
    setSessionInitError(null);

    try {
      const countOverride =
        Number(currentSetObj?.plannedCount ?? 0) > 0 ? Number(currentSetObj?.plannedCount ?? 0) : undefined;

      const qsRaw = buildSessionQuestionsFromPracticeBank({
        skill: resolvedSkill,
        level: resolvedLevel,
        set: String(currentSetObj?.setId ?? setIdParam),
        day: Number(currentDay?.dayIndex ?? dayParam),
        weekId: String((roadmap as any)?.weekId ?? ""),
        count: countOverride,
      });

      const qsMapped: SessionQuestion[] = (Array.isArray(qsRaw) ? qsRaw : []).map((q) => ({
        qid: String(q?.qid ?? q?.sourceId ?? ""),
        prompt: String(q?.prompt ?? ""),
        choices: Array.isArray(q?.choices) ? q.choices.map((c: any) => String(c ?? "")) : [],
        answerIndex: Number(q?.answerIndex ?? 0),
        explanation: q?.explanation ? String(q.explanation) : undefined,
      }));

      const qs = qsMapped.filter(isValidSessionQuestion);

      if (qs.length === 0) {
        setQuestions([]);
        setSessionInitError(
          "問題を読み込めませんでした。practiceBank のデータが空か、skill / level / set の組み合わせに対応する問題がありません。"
        );
      } else {
        setQuestions(qs);
      }

      const now = localNowISO();
      setCurrentIdx(0);
      setSelectedIndex(null);
      setChecked(false);
      setResults([]);
      setWrongEver([]);
      setStartedAt(now);
      setEndedAt("");
      setElapsedSec(0);
      setSaveJustDone(false);
      setSessionInitDone(true);
    } catch (e: any) {
      const now = localNowISO();
      setQuestions([]);
      setCurrentIdx(0);
      setSelectedIndex(null);
      setChecked(false);
      setResults([]);
      setWrongEver([]);
      setStartedAt(now);
      setEndedAt("");
      setElapsedSec(0);
      setSaveJustDone(false);
      setSessionInitDone(true);
      setSessionInitError(
        `問題読み込み中にエラーが発生しました${e?.message ? `: ${String(e.message)}` : ""}`
      );
    }
  }, [currentSetObj, resolvedSkill, resolvedLevel, currentDay, dayParam, setIdParam, roadmap]);

  // 完了時に終了時刻を固定（表示が伸び続けないようにする）
  useEffect(() => {
    if (isFinished && !endedAt) {
      setEndedAt(localNowISO());
    }
  }, [isFinished, endedAt]);

  // live timer: startedAt からの経過秒を更新（完了時は停止）
  useEffect(() => {
    if (!startedAt) return;

    const startedMs = new Date(startedAt).getTime();
    if (!Number.isFinite(startedMs)) return;

    const update = () => {
      const endMs = endedAt ? new Date(endedAt).getTime() : Date.now();
      const diffSec = Math.max(0, Math.floor((endMs - startedMs) / 1000));
      setElapsedSec(diffSec);
    };

    update();

    if (isFinished) return;

    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [startedAt, endedAt, isFinished]);

  const currentQ = !isFinished ? questions[currentIdx] ?? null : null;
  const answeredCount = results.length;
  const correctCount = results.filter((r) => r.correct).length;
  const totalCount = questions.length;
  const sessionPct = totalCount > 0 ? Math.round((answeredCount / totalCount) * 100) : 0;

  function handleCheck() {
    if (!currentQ || selectedIndex == null || checked) return;
    setChecked(true);
  }

  function handleNext() {
    if (!currentQ) return;

    if (!checked || selectedIndex == null) return;

    const correct = selectedIndex === currentQ.answerIndex;

    setResults((prev) => [
      ...prev,
      {
        qid: currentQ.qid,
        selectedIndex,
        correct,
      },
    ]);

    if (!correct) {
      setWrongEver((prev) => Array.from(new Set([...prev, currentQ.qid])));
    }

    setSelectedIndex(null);
    setChecked(false);
    setCurrentIdx((n) => n + 1);
  }

  const canPersistFinish = isFinished && questions.length > 0 && results.length === questions.length;
  const existingFinished = currentSetProgress.finished;

  function saveIfNeeded(): boolean {
    if (!canPersistFinish) return false;
    if (existingFinished || saveJustDone) return true;
    if (!currentSetObj || !currentDay || !resolvedSkill) return false;

    const total = questions.length;
    const masteredQids = results.filter((r) => r.correct).map((r) => r.qid);
    const wrongEverQids = wrongEver;
    const attempts = results.length;
    const endISO = endedAt || localNowISO();

    persistSetProgressToRoadmap({
      dayIndex: Number(currentDay?.dayIndex ?? dayParam),
      setId: String(currentSetObj?.setId ?? setIdParam),
      total,
      masteredQids,
      wrongEverQids,
      attempts,
      finished: true,
    });

    writeSessionLog({
      type: "vgr_set_finished",
      at: localNowISO(),
      startedAt,
      endedAt: endISO,
      elapsedSec,
      elapsedLabel: formatDurationMMSS(elapsedSec),
      dayIndex: Number(currentDay?.dayIndex ?? dayParam),
      dateISO: currentDay?.dateISO ?? null,
      setId: String(currentSetObj?.setId ?? setIdParam),
      skill: resolvedSkill,
      level: resolvedLevel,
      total,
      correct: masteredQids.length,
      wrong: total - masteredQids.length,
      accuracy: total > 0 ? Math.round((masteredQids.length / total) * 100) : 0,
    });

    const rm = readActiveRoadmap();
    setRoadmap(rm ?? null);
    setSaveJustDone(true);

    return true;
  }

  function handleDoneBackToSkillSets() {
    if (isFinished) saveIfNeeded();

    router.replace(
      `/practice/session?day=${encodeURIComponent(String(dayParam))}&skill=${encodeURIComponent(
        resolvedSkill ?? "vocab"
      )}`
    );
  }

  function handleDonePrimaryNext() {
    if (isFinished) saveIfNeeded();

    if (nextSet && resolvedSkill) {
      const nextSetId = String(nextSet?.setId ?? "");
      router.replace(
        `/practice/vgr/session?day=${encodeURIComponent(String(dayParam))}&skill=${encodeURIComponent(
          resolvedSkill
        )}&set=${encodeURIComponent(nextSetId)}`
      );
      return;
    }

    router.replace(`/practice/session?day=${encodeURIComponent(String(dayParam))}`);
  }

  if (!mounted) {
    return (
      <main style={pageWrap}>
        <div style={container}>
          <SoftCard>
            <div style={{ fontWeight: 950 }}>Loading session…</div>
          </SoftCard>
        </div>
      </main>
    );
  }

  if (!roadmap) {
    return (
      <main style={pageWrap}>
        <div style={container}>
          <SoftCard>
            <div style={{ fontSize: 18, fontWeight: 950 }}>Roadmap not found</div>
            <div style={{ marginTop: 6, fontSize: 13, opacity: 0.8 }}>
              practice roadmap を読み込めません。/practice に戻って再生成してください。
            </div>
            <div style={{ marginTop: 12 }}>
              <PrimaryBtn onClick={() => router.replace("/practice")}>Back to Practice →</PrimaryBtn>
            </div>
          </SoftCard>
        </div>
      </main>
    );
  }

  if (!currentDay) {
    return (
      <main style={pageWrap}>
        <div style={container}>
          <SoftCard>
            <div style={{ fontSize: 18, fontWeight: 950 }}>Day not found</div>
            <div style={{ marginTop: 6, fontSize: 13, opacity: 0.8 }}>
              day={dayParam} が roadmap 内に見つかりません。
            </div>
            <div style={{ marginTop: 12 }}>
              <PrimaryBtn onClick={() => router.replace("/practice")}>Back to Practice →</PrimaryBtn>
            </div>
          </SoftCard>
        </div>
      </main>
    );
  }

  if (!currentSetObj || !resolvedSkill) {
    return (
      <main style={pageWrap}>
        <div style={container}>
          <SoftCard>
            <div style={{ fontSize: 18, fontWeight: 950 }}>Set not found</div>
            <div style={{ marginTop: 6, fontSize: 13, opacity: 0.8 }}>
              set={setIdParam || "(empty)"} が見つかりません。skill / set クエリを確認してください。
            </div>
            <div
              style={{
                marginTop: 12,
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: 12,
              }}
            >
              <PrimaryBtn onClick={() => router.replace(`/practice/session?day=${dayParam}`)}>
                Back to Day Hub →
              </PrimaryBtn>
              <GhostBtn onClick={() => router.replace("/practice")}>Back to Practice →</GhostBtn>
            </div>
          </SoftCard>
        </div>
      </main>
    );
  }

  const plannedCount = plannedCountForSet(currentSetObj, resolvedSkill);
  const accuracyPct = totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0;
  const saveStatusLabel = existingFinished || saveJustDone ? "Saved" : "Not saved";

  const showQuestionUI = sessionInitDone && !sessionInitError && !isFinished && !!currentQ;
  const showCompleteUI = sessionInitDone && !sessionInitError && isFinished;
  const showInitLoading = !sessionInitDone;
  const showInitError = sessionInitDone && !!sessionInitError;

  return (
    <main style={pageWrap}>
      <div style={container}>
        {/* Header / unified nav */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <div>
            <div style={{ fontSize: 28, fontWeight: 950 }}>Practice Session</div>
            <div style={{ marginTop: 6, fontSize: 13, opacity: 0.78 }}>
              {skillEmoji(resolvedSkill)} {skillLabel(resolvedSkill)} · Set {setSeq || "?"} · Day {dayParam}
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <Link
              href={`/practice/session?day=${encodeURIComponent(String(dayParam))}&skill=${encodeURIComponent(
                resolvedSkill
              )}`}
              style={{ color: "white", textDecoration: "none", fontSize: 13, opacity: 0.85 }}
            >
              ← Back to {skillLabel(resolvedSkill)} Sets
            </Link>
            <Pill>week {(roadmap as any)?.weekId ?? "—"}</Pill>
            <Pill>level {resolvedLevel}</Pill>
            <Pill>⏱ {formatDurationMMSS(elapsedSec)}</Pill>
            <Pill>{existingFinished || saveJustDone ? "✅ finished (saved)" : "🕒 active"}</Pill>
          </div>
        </div>

        {/* Context / progress summary */}
        <div style={{ marginTop: 12 }}>
          <SoftCard>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: 12,
              }}
            >
              <div>
                <div style={{ fontSize: 12, opacity: 0.7 }}>Current set</div>
                <div style={{ marginTop: 4, fontSize: 22, fontWeight: 950 }}>
                  {String(currentSetObj?.setId ?? setIdParam)}
                </div>
                <div style={{ marginTop: 8, display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <Pill>planned {plannedCount}</Pill>
                  <Pill>answered {answeredCount}/{Math.max(totalCount, plannedCount)}</Pill>
                  <Pill>correct {correctCount}</Pill>
                  <Pill>time {formatDurationMMSS(elapsedSec)}</Pill>
                </div>
              </div>

              <div>
                <div style={{ fontSize: 12, opacity: 0.7 }}>{skillLabel(resolvedSkill)} progress</div>
                <div style={{ marginTop: 6 }}>
                  <ProgressBar
                    pct={skillProgress.total > 0 ? Math.round((skillProgress.done / skillProgress.total) * 100) : 0}
                  />
                </div>
                <div style={{ marginTop: 8, fontSize: 13, opacity: 0.82 }}>
                  {skillProgress.done}/{skillProgress.total} sets done
                </div>
              </div>

              <div>
                <div style={{ fontSize: 12, opacity: 0.7 }}>Day progress</div>
                <div style={{ marginTop: 6 }}>
                  <ProgressBar
                    pct={dailyProgress.total > 0 ? Math.round((dailyProgress.done / dailyProgress.total) * 100) : 0}
                  />
                </div>
                <div style={{ marginTop: 8, fontSize: 13, opacity: 0.82 }}>
                  {dailyProgress.done}/{dailyProgress.total} sets done
                </div>
              </div>

              <div>
                <div style={{ fontSize: 12, opacity: 0.7 }}>Session progress</div>
                <div style={{ marginTop: 6 }}>
                  <ProgressBar pct={sessionPct} />
                </div>
                <div style={{ marginTop: 8, fontSize: 13, opacity: 0.82 }}>
                  {answeredCount}/{Math.max(totalCount, plannedCount)} questions
                </div>
              </div>
            </div>
          </SoftCard>
        </div>

        {/* Main body */}
        <div style={{ marginTop: 12 }}>
          {showInitLoading ? (
            <SoftCard>
              <div style={{ fontWeight: 950, fontSize: 18 }}>Loading questions…</div>
              <div style={{ marginTop: 8, fontSize: 13, opacity: 0.75 }}>
                practiceBank から問題を読み込んでいます。
              </div>
            </SoftCard>
          ) : showInitError ? (
            <SoftCard>
              <div style={{ fontWeight: 950, fontSize: 18 }}>Question load failed</div>
              <div style={{ marginTop: 8, fontSize: 13, opacity: 0.85, lineHeight: 1.7 }}>
                {sessionInitError}
              </div>

              <div style={{ marginTop: 12, fontSize: 12, opacity: 0.7, lineHeight: 1.7 }}>
                確認ポイント:
                <br />
                ・`PRACTICE_BANK` の vocab / grammar / reading 配列が空ではないか
                <br />
                ・各問題に `id / prompt / choices / correct / levelTag / skill` が入っているか
                <br />
                ・`buildSessionQuestionsFromPracticeBank` が正しく export されているか
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
                    router.replace(
                      `/practice/vgr/session?day=${encodeURIComponent(String(dayParam))}&skill=${encodeURIComponent(
                        resolvedSkill
                      )}&set=${encodeURIComponent(String(currentSetObj?.setId ?? setIdParam))}`
                    );
                  }}
                >
                  Retry loading →
                </PrimaryBtn>

                <GhostBtn
                  onClick={() =>
                    router.replace(
                      `/practice/session?day=${encodeURIComponent(String(dayParam))}&skill=${encodeURIComponent(
                        resolvedSkill
                      )}`
                    )
                  }
                >
                  Back to {skillLabel(resolvedSkill)} Sets →
                </GhostBtn>
              </div>
            </SoftCard>
          ) : showQuestionUI ? (
            <SoftCard>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div style={{ fontWeight: 950, fontSize: 16 }}>
                  Question {currentIdx + 1} / {questions.length}
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <Pill>
                    {skillEmoji(resolvedSkill)} {skillLabel(resolvedSkill)}
                  </Pill>
                  <Pill>set {setSeq || "?"}</Pill>
                  <Pill>⏱ {formatDurationMMSS(elapsedSec)}</Pill>
                </div>
              </div>

              <div
                style={{
                  marginTop: 12,
                  borderRadius: 14,
                  border: "1px solid rgba(255,255,255,0.08)",
                  background: "rgba(0,0,0,0.18)",
                  padding: 14,
                  fontSize: 16,
                  lineHeight: 1.7,
                  boxSizing: "border-box",
                }}
              >
                {currentQ.prompt}
              </div>

              <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
                {currentQ.choices.map((c, idx) => {
                  const isSelected = selectedIndex === idx;
                  const showCorrect = checked && idx === currentQ.answerIndex;
                  const showWrongSelected = checked && isSelected && idx !== currentQ.answerIndex;

                  return (
                    <button
                      key={`${currentQ.qid}_${idx}`}
                      onClick={() => {
                        if (checked) return;
                        setSelectedIndex(idx);
                      }}
                      style={{
                        textAlign: "left",
                        width: "100%",
                        padding: "12px 14px",
                        borderRadius: 12,
                        border: showCorrect
                          ? "1px solid rgba(60, 220, 120, 0.45)"
                          : showWrongSelected
                          ? "1px solid rgba(255, 110, 110, 0.45)"
                          : isSelected
                          ? "1px solid rgba(120, 90, 255, 0.55)"
                          : "1px solid rgba(255,255,255,0.10)",
                        background: showCorrect
                          ? "rgba(60,220,120,0.10)"
                          : showWrongSelected
                          ? "rgba(255,110,110,0.10)"
                          : isSelected
                          ? "rgba(120, 90, 255, 0.12)"
                          : "rgba(255,255,255,0.03)",
                        color: "white",
                        cursor: checked ? "default" : "pointer",
                        fontSize: 14,
                        fontWeight: 700,
                        boxSizing: "border-box",
                      }}
                    >
                      <span style={{ opacity: 0.8, marginRight: 8 }}>{String.fromCharCode(65 + idx)}.</span>
                      {c}
                    </button>
                  );
                })}
              </div>

              {checked ? (
                <div
                  style={{
                    marginTop: 12,
                    borderRadius: 12,
                    border: "1px solid rgba(255,255,255,0.08)",
                    background: "rgba(255,255,255,0.03)",
                    padding: 12,
                    boxSizing: "border-box",
                  }}
                >
                  <div style={{ fontWeight: 900, fontSize: 14 }}>
                    {selectedIndex === currentQ.answerIndex ? "✅ Correct" : "❌ Incorrect"}
                  </div>
                  <div style={{ marginTop: 6, fontSize: 13, opacity: 0.85, lineHeight: 1.6 }}>
                    正解: <b>{String.fromCharCode(65 + currentQ.answerIndex)}</b>
                    {" · "}
                    {currentQ.explanation ?? "解説なし"}
                  </div>
                </div>
              ) : null}

              <div
                style={{
                  marginTop: 14,
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                  gap: 12,
                }}
              >
                {!checked ? (
                  <PrimaryBtn onClick={handleCheck} disabled={selectedIndex == null}>
                    Check Answer →
                  </PrimaryBtn>
                ) : (
                  <PrimaryBtn onClick={handleNext}>
                    {currentIdx + 1 >= questions.length ? "Finish Set →" : "Next Question →"}
                  </PrimaryBtn>
                )}

                <GhostBtn
                  onClick={() =>
                    router.replace(
                      `/practice/session?day=${encodeURIComponent(String(dayParam))}&skill=${encodeURIComponent(
                        resolvedSkill
                      )}`
                    )
                  }
                >
                  Back to {skillLabel(resolvedSkill)} Sets →
                </GhostBtn>
              </div>
            </SoftCard>
          ) : showCompleteUI ? (
            <SoftCard>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <div>
                  <div style={{ fontSize: 24, fontWeight: 950 }}>Set Complete 🎉</div>
                  <div style={{ marginTop: 6, fontSize: 13, opacity: 0.8 }}>
                    {skillLabel(resolvedSkill)} · {String(currentSetObj?.setId ?? setIdParam)}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <Pill>score {correctCount}/{questions.length}</Pill>
                  <Pill>accuracy {accuracyPct}%</Pill>
                  <Pill>wrongEver {wrongEver.length}</Pill>
                  <Pill>time {formatDurationLong(elapsedSec)}</Pill>
                </div>
              </div>

              <div style={{ marginTop: 12 }}>
                <ProgressBar pct={100} />
              </div>

              <div
                style={{
                  marginTop: 12,
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                  gap: 12,
                }}
              >
                <div
                  style={{
                    borderRadius: 14,
                    border: "1px solid rgba(255,255,255,0.10)",
                    background: "rgba(0,0,0,0.18)",
                    padding: 12,
                    boxSizing: "border-box",
                  }}
                >
                  <div style={{ fontSize: 12, opacity: 0.7 }}>Skill progress</div>
                  <div style={{ marginTop: 6, fontWeight: 950, fontSize: 20 }}>
                    {skillProgress.done}/{skillProgress.total}
                  </div>
                  <div style={{ marginTop: 4, fontSize: 13, opacity: 0.8 }}>sets completed</div>
                </div>

                <div
                  style={{
                    borderRadius: 14,
                    border: "1px solid rgba(255,255,255,0.10)",
                    background: "rgba(0,0,0,0.18)",
                    padding: 12,
                    boxSizing: "border-box",
                  }}
                >
                  <div style={{ fontSize: 12, opacity: 0.7 }}>Day progress</div>
                  <div style={{ marginTop: 6, fontWeight: 950, fontSize: 20 }}>
                    {dailyProgress.done}/{dailyProgress.total}
                  </div>
                  <div style={{ marginTop: 4, fontSize: 13, opacity: 0.8 }}>sets completed</div>
                </div>

                <div
                  style={{
                    borderRadius: 14,
                    border: "1px solid rgba(255,255,255,0.10)",
                    background: "rgba(0,0,0,0.18)",
                    padding: 12,
                    boxSizing: "border-box",
                  }}
                >
                  <div style={{ fontSize: 12, opacity: 0.7 }}>Save status</div>
                  <div style={{ marginTop: 6, fontWeight: 950, fontSize: 20 }}>{saveStatusLabel}</div>
                  <div style={{ marginTop: 4, fontSize: 13, opacity: 0.8 }}>roadmap progress update</div>
                </div>

                <div
                  style={{
                    borderRadius: 14,
                    border: "1px solid rgba(255,255,255,0.10)",
                    background: "rgba(0,0,0,0.18)",
                    padding: 12,
                    boxSizing: "border-box",
                  }}
                >
                  <div style={{ fontSize: 12, opacity: 0.7 }}>Elapsed time</div>
                  <div style={{ marginTop: 6, fontWeight: 950, fontSize: 20 }}>{formatDurationMMSS(elapsedSec)}</div>
                  <div style={{ marginTop: 4, fontSize: 13, opacity: 0.8 }}>{formatDurationLong(elapsedSec)}</div>
                </div>
              </div>

              <div
                style={{
                  marginTop: 14,
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                  gap: 12,
                }}
              >
                <GhostBtn onClick={handleDoneBackToSkillSets}>
                  Back to {skillLabel(resolvedSkill)} Sets →
                </GhostBtn>

                <PrimaryBtn onClick={handleDonePrimaryNext}>
                  {nextSet
                    ? `Save & Next Set (${String(nextSet?.setId ?? "")}) →`
                    : "Save & Back to Day Hub →"}
                </PrimaryBtn>
              </div>

              <div style={{ marginTop: 12, fontSize: 12, opacity: 0.7, lineHeight: 1.7 }}>
                ・どちらのボタンでも set 完了結果を保存してから遷移
                <br />
                ・問題は practiceBank から skill / level / set / week/day ベースで読み込み
                <br />
                ・今は set 完了時に roadmap の progress.finishedAt / mastered / wrongEver を保存
                <br />
                ・解答時間（elapsedSec）を session log に保存
              </div>
            </SoftCard>
          ) : (
            <SoftCard>
              <div style={{ fontWeight: 950, fontSize: 18 }}>Session state is not ready</div>
              <div style={{ marginTop: 8, fontSize: 13, opacity: 0.8 }}>
                想定外の状態です。セット一覧に戻って再度 Start set を押してください。
              </div>
              <div style={{ marginTop: 12 }}>
                <GhostBtn
                  onClick={() =>
                    router.replace(
                      `/practice/session?day=${encodeURIComponent(String(dayParam))}&skill=${encodeURIComponent(
                        resolvedSkill
                      )}`
                    )
                  }
                >
                  Back to {skillLabel(resolvedSkill)} Sets →
                </GhostBtn>
              </div>
            </SoftCard>
          )}
        </div>
      </div>
    </main>
  );
}