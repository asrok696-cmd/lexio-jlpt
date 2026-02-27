// app/practice/page.tsx
"use client";

import Link from "next/link";
import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";

// ✅ Reports-like UI atoms (shared with mock-tests)
import { pageWrap, container, SoftCard, Pill, NavBtn, frame } from "@/app/_components/AppShell";

// ✅ StudyPlan（weekly-check or diagnostic fallback）
import { STUDY_PLAN_KEY, type StudyPlan } from "@/app/_lib/studyPlan";

// ✅ Roadmap + utils
import { ROADMAP_KEY, type RoadmapDay, todayISO, readJSON, writeJSON } from "@/app/_lib/roadmap";

// ✅ Carryover
import { CARRYOVER_KEY, type Carryover, ensureCarryoverForToday, PRACTICE_LOG_KEY } from "@/app/_lib/carryover";

// ✅ Diagnostic -> plan
import { ensureStudyPlanFromDiagnostic } from "@/app/_lib/diagnosticToPlan";

const MISTAKES_KEY = "lexio.mistakes.v1";
const RECOMMENDATIONS_KEY = "lexio.recommendations.v1";
const ANALYTICS_KEY = "lexio.analytics.v1";

// ------------------
// ✅ DEV FLAGS (LAUNCH: all OFF)
// ------------------
const DEV_FORCE_DAY_INDEX: number | null = null; // ✅ launch: null
const DEV_UNLOCK_ALL_DAYS = false; // ✅ launch: false
const DEV_BYPASS_CARRYOVER_LOCK = false; // ✅ launch: false

// ------------------
// helpers (UI / local compat)
// ------------------
type Skill = "vocab" | "grammar" | "reading";
type Roadmap = any;

type PracticeEvent = {
  dateISO?: string;
  minutes?: number;
  durationMin?: number;
  durationMinutes?: number;
  spentMinutes?: number;
  totalMinutes?: number;
  [k: string]: any;
};

function clampPct(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, n));
}

/** ✅ ローカル日付(YYYY-MM-DD)を安全に作る */
function toLocalISODate(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/** ✅ "YYYY-MM-DD" をローカル日付として読む（UTC解釈ズレ防止） */
function parseLocalISODate(iso: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(iso ?? ""))) return new Date(iso);
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

function formatDatePretty(iso: string) {
  try {
    const d = parseLocalISODate(iso);
    if (Number.isNaN(d.getTime())) return iso;
    const w = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d.getDay()];
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${w} · ${yyyy}/${mm}/${dd}`;
  } catch {
    return iso;
  }
}

function skillEmoji(s: Skill) {
  if (s === "vocab") return "🧠";
  if (s === "grammar") return "🧩";
  return "📖";
}
function skillLabel(s: Skill) {
  if (s === "vocab") return "Vocab";
  if (s === "grammar") return "Grammar";
  return "Reading";
}

function sumTargets(t: Partial<Record<Skill, number>> | null | undefined) {
  const v = Number(t?.vocab ?? 0) || 0;
  const g = Number(t?.grammar ?? 0) || 0;
  const r = Number(t?.reading ?? 0) || 0;
  return v + g + r;
}

function sumMinutesForDate(log: PracticeEvent[] | null | undefined, iso: string) {
  if (!Array.isArray(log)) return 0;
  let total = 0;
  for (const e of log) {
    if (String(e?.dateISO ?? "") !== iso) continue;
    const m =
      Number(e?.minutes ?? e?.durationMin ?? e?.durationMinutes ?? e?.spentMinutes ?? e?.totalMinutes ?? 0) || 0;
    total += m;
  }
  return total;
}

// ------------------
// ✅ fallback 9-set generators（恒久運用向け）
// ------------------
type PracticeSkill = "vocab" | "grammar" | "reading";

function makeEmptySetProgress(questionCount: number) {
  return {
    total: questionCount,
    mastered: [] as string[],
    remaining: [] as string[],
    wrongEver: [] as string[],
    attempts: 0,
    startedAtISO: null as string | null,
    finishedAt: null as string | null,
  };
}
function qPerSet(skill: PracticeSkill) {
  return skill === "reading" ? 5 : 10;
}
function clampNonNegInt(n: unknown, fallback = 0) {
  const v = Number(n);
  if (!Number.isFinite(v)) return fallback;
  return Math.max(0, Math.floor(v));
}

/**
 * ✅ Dayごとの setCounts を解決（恒久）
 * 優先順位:
 * 1. day.setCounts / day.practiceSetCounts
 * 2. targets / targetsMinutes から簡易推定
 * 3. 3/3/3
 */
function resolvePracticeSetCountsForDay(rawPlan: any, dayIndex: number): Record<PracticeSkill, number> {
  const dayPlan = rawPlan?.week?.days?.[dayIndex - 1] ?? null;

  const explicit = dayPlan?.setCounts ?? dayPlan?.practiceSetCounts;
  if (explicit && typeof explicit === "object") {
    return {
      vocab: clampNonNegInt((explicit as any).vocab, 0),
      grammar: clampNonNegInt((explicit as any).grammar, 0),
      reading: clampNonNegInt((explicit as any).reading, 0),
    };
  }

  const t =
    dayPlan?.targets ?? dayPlan?.targetsMinutes ?? rawPlan?.today?.targets ?? rawPlan?.today?.targetsMinutes ?? null;

  if (t && typeof t === "object") {
    const vMin = clampNonNegInt((t as any).vocab, 0);
    const gMin = clampNonNegInt((t as any).grammar, 0);
    const rMin = clampNonNegInt((t as any).reading, 0);

    const v = vMin > 0 ? Math.max(1, Math.round(vMin / 10)) : 0;
    const g = gMin > 0 ? Math.max(1, Math.round(gMin / 10)) : 0;
    const r = rMin > 0 ? Math.max(1, Math.round(rMin / 10)) : 0;

    if (v + g + r > 0) return { vocab: v, grammar: g, reading: r };
  }

  return { vocab: 3, grammar: 3, reading: 3 };
}

function makePracticeSet(skill: PracticeSkill, seq: number, dayIndex: number, levelTag: string) {
  const plannedCount = qPerSet(skill);
  return {
    setId: `${skill}_${seq}`,
    kind: "practice",
    skill,
    levelTag,
    plannedCount,
    questionIds: [] as string[],
    progress: makeEmptySetProgress(plannedCount),
    title: `${skill} set ${seq}`,
    dayIndex,
    setIndex: seq,
  };
}

function makePracticeSetsForDay(dayIndex: number, levelTag: string, setCounts: Record<PracticeSkill, number>) {
  const sets: any[] = [];
  for (let i = 1; i <= clampNonNegInt(setCounts.vocab, 0); i++) sets.push(makePracticeSet("vocab", i, dayIndex, levelTag));
  for (let i = 1; i <= clampNonNegInt(setCounts.grammar, 0); i++)
    sets.push(makePracticeSet("grammar", i, dayIndex, levelTag));
  for (let i = 1; i <= clampNonNegInt(setCounts.reading, 0); i++)
    sets.push(makePracticeSet("reading", i, dayIndex, levelTag));
  if (sets.length === 0) sets.push(makePracticeSet("vocab", 1, dayIndex, levelTag));
  return sets;
}

/**
 * diagnostic roadmap builder が使えない時の最終 fallback
 * - 7日分のロードマップを生成
 * - Day1-6 は「仮でも必ず practice sets を作る」
 * - Day7は weekly-check 入口扱い（sets なし）
 */
function buildRoadmapFromPlan(rawPlan: any): Roadmap {
  const today = todayISO();
  const start = parseLocalISODate(today);
  const fallbackLevel = String(rawPlan?.goalLevel ?? rawPlan?.level ?? "N5");

  const days = Array.from({ length: 7 }).map((_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);

    const iso = toLocalISODate(d);
    const dayIndex = i + 1;

    const targets =
      rawPlan?.week?.days?.[i]?.targets ??
      rawPlan?.week?.days?.[i]?.targetsMinutes ??
      rawPlan?.today?.targets ??
      { vocab: 20, grammar: 20, reading: 20 };

    if (dayIndex === 7) {
      return {
        dayIndex,
        dateISO: iso,
        weeklyCheckOnly: true,
        isWeeklyCheckDay: true,
        status: "todo",
        sets: [],
        targetsMinutes: { vocab: 0, grammar: 0, reading: 0 },
        targets: { vocab: 0, grammar: 0, reading: 0 },
      };
    }

    const setCounts = resolvePracticeSetCountsForDay(rawPlan, dayIndex);
    const practiceSets = makePracticeSetsForDay(dayIndex, fallbackLevel, setCounts);

    const sortedSkills = ["vocab", "grammar", "reading"]
      .slice()
      .sort((a, b) => (setCounts[b as PracticeSkill] ?? 0) - (setCounts[a as PracticeSkill] ?? 0)) as PracticeSkill[];
    const focusSkill = sortedSkills[0] ?? "vocab";

    return {
      dayIndex,
      dateISO: iso,
      status: "todo",
      weeklyCheckOnly: false,
      isWeeklyCheckDay: false,
      focusSkill,
      setCounts,
      targetsMinutes: {
        vocab: Number(targets?.vocab ?? 20) || 0,
        grammar: Number(targets?.grammar ?? 20) || 0,
        reading: Number(targets?.reading ?? 20) || 0,
      },
      targets: {
        vocab: Number(targets?.vocab ?? 20) || 0,
        grammar: Number(targets?.grammar ?? 20) || 0,
        reading: Number(targets?.reading ?? 20) || 0,
      },
      sets: practiceSets,
    };
  });

  return {
    version: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    weekId: rawPlan?.week?.startISO ?? today,
    goalLevel: rawPlan?.goalLevel ?? rawPlan?.level ?? "N5",
    level: rawPlan?.level ?? rawPlan?.goalLevel ?? "N5",
    days,
  };
}

// ------------------
// UI helpers (match mock-tests look)
// ------------------
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

function PrimaryLink({ href, disabled, children }: { href: string; disabled?: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-disabled={disabled ? "true" : "false"}
      style={{
        pointerEvents: disabled ? "none" : "auto",
        opacity: disabled ? 0.6 : 1,
        textDecoration: "none",
        borderRadius: 14,
        padding: "12px 14px",
        background: "rgba(120, 90, 255, 0.92)",
        color: "white",
        fontWeight: 950,
        textAlign: "center",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {children}
    </Link>
  );
}

function GhostLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      style={{
        textDecoration: "none",
        borderRadius: 14,
        padding: "12px 14px",
        border: "1px solid rgba(255,255,255,0.12)",
        background: "rgba(255,255,255,0.06)",
        color: "white",
        fontWeight: 950,
        textAlign: "center",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {children}
    </Link>
  );
}

function SmallStartLink({
  href,
  disabled,
  label,
  title,
}: {
  href: string;
  disabled?: boolean;
  label?: string;
  title?: string;
}) {
  return (
    <Link
      href={href}
      aria-disabled={disabled ? "true" : "false"}
      title={title ?? (disabled ? "Locked" : "Open")}
      style={{
        pointerEvents: disabled ? "none" : "auto",
        opacity: disabled ? 0.6 : 1,
        textDecoration: "none",
        borderRadius: 999,
        padding: "6px 10px",
        border: "1px solid rgba(255,255,255,0.12)",
        background: disabled ? "rgba(255,255,255,0.05)" : "rgba(120,90,255,0.18)",
        color: "rgba(255,255,255,0.92)",
        fontWeight: 950,
        fontSize: 12,
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
      }}
    >
      {label ?? "Open"} →
    </Link>
  );
}

// ------------------
// plan/roadmap helpers
// ------------------
function isStudyPlanV2(x: any): x is StudyPlan {
  return !!x && x.version === 2 && x.week && Array.isArray(x.week.days) && x.today && x.today.targets;
}

type MistakesStore = { updatedAt: string; qids: string[] };
type Recommendation = { id: string; title: string; reason?: string; action?: { label: string; href: string } };
type AnalyticsAny = Record<string, any>;

function getTargetsForDay(d: RoadmapDay | null | undefined) {
  const t: any = (d as any)?.targetsMinutes ?? (d as any)?.targets ?? null;
  return (t ?? { vocab: 0, grammar: 0, reading: 0 }) as Record<Skill, number>;
}

function stablePlanId(plan: StudyPlan | null) {
  if (!plan) return "none";
  const a = (plan as any).createdAtISO ?? "";
  const b = (plan as any).week?.startISO ?? "";
  const t = (plan as any).today?.dateISO ?? "";
  return `${(plan as any).version}|${a}|${b}|${t}`;
}

function isNineSetRoadmapDay(d: any): boolean {
  const sets = Array.isArray(d?.sets) ? d.sets : [];
  return sets.some(
    (s: any) =>
      typeof s?.setId === "string" &&
      (s.setId.startsWith("vocab_") || s.setId.startsWith("grammar_") || s.setId.startsWith("reading_"))
  );
}

function hasBrokenPracticeDays(roadmap: any): boolean {
  const days = Array.isArray(roadmap?.days) ? roadmap.days : [];
  if (days.length !== 7) return true;

  for (const d of days) {
    const dayIndex = Number(d?.dayIndex ?? 0);
    const isWeekly = !!d?.weeklyCheckOnly || !!d?.isWeeklyCheckDay || dayIndex === 7;
    if (isWeekly) continue;

    const sets = Array.isArray(d?.sets) ? d.sets : [];
    const practiceSets = sets.filter(
      (s: any) =>
        typeof s?.setId === "string" &&
        (s.setId.startsWith("vocab_") || s.setId.startsWith("grammar_") || s.setId.startsWith("reading_"))
    );

    if (practiceSets.length === 0) return true;
  }
  return false;
}

function isSetFinished(s: any): boolean {
  if (!!s?.progress?.finishedAt) return true;
  const total = Number(s?.progress?.total ?? s?.questionIds?.length ?? 0);
  const masteredLen = Array.isArray(s?.progress?.mastered) ? s.progress.mastered.length : 0;
  return total > 0 && masteredLen >= total;
}

function getPracticeSetsForDay(d: any): any[] {
  const sets = Array.isArray(d?.sets) ? d.sets : [];
  const nine = sets.filter(
    (s: any) =>
      typeof s?.setId === "string" &&
      (s.setId.startsWith("vocab_") || s.setId.startsWith("grammar_") || s.setId.startsWith("reading_"))
  );
  if (nine.length) return nine;
  const main = sets.find((s: any) => s?.setId === "main");
  return main ? [main] : [];
}

function countDoneSetsForDay(d: any): { done: number; planned: number; bySkill: Record<Skill, number> } {
  const sets = getPracticeSetsForDay(d);
  const planned = sets.length;

  const bySkill: Record<Skill, number> = { vocab: 0, grammar: 0, reading: 0 };
  for (const s of sets) {
    const sid = String(s?.setId ?? "");
    if (sid.startsWith("vocab_")) bySkill.vocab += 1;
    else if (sid.startsWith("grammar_")) bySkill.grammar += 1;
    else if (sid.startsWith("reading_")) bySkill.reading += 1;
  }

  const done = sets.filter(isSetFinished).length;
  return { done, planned, bySkill };
}

// ===== Page =====
export default function PracticePage() {
  useSearchParams(); // keep (future query compat)

  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [_studyPlan, setStudyPlan] = useState<StudyPlan | null>(null);
  const [roadmap, setRoadmap] = useState<Roadmap | null>(null);
  const [carryover, setCarryover] = useState<Carryover | null>(null);

  const [_mistakes, setMistakes] = useState<MistakesStore>({ updatedAt: "", qids: [] });
  const [_recs, setRecs] = useState<Recommendation[]>([]);
  const [_analytics, setAnalytics] = useState<AnalyticsAny | null>(null);

  const [planId, setPlanId] = useState<string>("none");

  useEffect(() => {
    let rawPlan = readJSON<any>(STUDY_PLAN_KEY);
    let plan = isStudyPlanV2(rawPlan) ? rawPlan : null;

    if (!plan) {
      try {
        const ensured = ensureStudyPlanFromDiagnostic(false);
        rawPlan = ensured ?? rawPlan;
        plan = isStudyPlanV2(rawPlan) ? rawPlan : null;
      } catch (e) {
        console.error("[practice] ensureStudyPlanFromDiagnostic failed", e);
      }
    }
    setStudyPlan(plan);

    const nextPlanId = stablePlanId(plan);
    setPlanId(nextPlanId);

    const savedRoadmap = readJSON<any>(ROADMAP_KEY);
    const savedOk = !!(savedRoadmap && Array.isArray(savedRoadmap?.days) && savedRoadmap?.days.length === 7);
    const savedLooksUsable = savedOk && !hasBrokenPracticeDays(savedRoadmap);

    const savedPlanId = savedRoadmap?.planId ?? "unknown";
    const mustRebuild = !savedLooksUsable || savedPlanId !== nextPlanId;

    if (mustRebuild) {
      const built = buildRoadmapFromPlan(rawPlan);
      const withPlanId: Roadmap = { ...(built as any), planId: nextPlanId };
      writeJSON(ROADMAP_KEY, withPlanId);
      setRoadmap(withPlanId);
    } else {
      setRoadmap(savedRoadmap);
    }

    const c = ensureCarryoverForToday();
    setCarryover(c);

    const m = readJSON<MistakesStore>(MISTAKES_KEY);
    setMistakes(m && Array.isArray(m.qids) ? m : { updatedAt: "", qids: [] });

    const r = readJSON<Recommendation[]>(RECOMMENDATIONS_KEY);
    setRecs(Array.isArray(r) ? r : []);

    const a = readJSON<AnalyticsAny>(ANALYTICS_KEY);
    setAnalytics(a ?? null);
  }, []);

  const practiceLog = useMemo(() => readJSON<PracticeEvent[]>(PRACTICE_LOG_KEY) ?? [], []);

  const carryoverPendingCount = carryover?.cleared ? 0 : (carryover?.items?.length ?? 0);
  const mustDoCarryoverFirst = carryoverPendingCount > 0;

  const derivedRoadmap = useMemo(() => {
    if (!roadmap) return null;

    const today = todayISO();

    const days: RoadmapDay[] = (roadmap as any).days.map((d: any) => {
      const mustCarryover = d.dateISO === today && (carryover?.items?.length ?? 0) > 0;
      const carryoverOk = mustCarryover ? !!carryover?.cleared : true;

      const nineMode = isNineSetRoadmapDay(d);
      let isFinish = false;

      if (nineMode) {
        const { done, planned } = countDoneSetsForDay(d);
        isFinish = planned > 0 ? done >= planned && carryoverOk : carryoverOk;
      } else {
        const doneMin = sumMinutesForDate(practiceLog, d.dateISO);
        const targets = getTargetsForDay(d);
        const targetMin = sumTargets(targets);
        isFinish = targetMin > 0 ? doneMin >= targetMin && carryoverOk : carryoverOk;
      }

      const targets = getTargetsForDay(d);

      const nextDay: RoadmapDay = {
        ...(d as any),
        targetsMinutes: (d as any).targetsMinutes ?? targets,
        targets: (d as any).targets ?? targets,
        status: isFinish ? "finish" : "todo",
      } as any;

      return nextDay;
    });

    return {
      ...(roadmap as any),
      days,
      updatedAt: new Date().toISOString(),
    } as Roadmap;
  }, [roadmap, practiceLog, carryover]);

  useEffect(() => {
    if (!roadmap || !derivedRoadmap) return;
    const changed = JSON.stringify((roadmap as any).days) !== JSON.stringify((derivedRoadmap as any).days);
    if (changed) {
      writeJSON(ROADMAP_KEY, derivedRoadmap);
      setRoadmap(derivedRoadmap);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [derivedRoadmap]);

  const actualTodayDay = useMemo(() => {
    const iso = todayISO();
    const days = (derivedRoadmap as any)?.days ?? null;
    if (!days) return null;
    return days.find((d: any) => d.dateISO === iso) ?? days[0] ?? null;
  }, [derivedRoadmap]);

  const actualTodayDayIndex = useMemo(() => {
    const iso = todayISO();
    const days = (derivedRoadmap as any)?.days ?? [];
    const hit = Array.isArray(days) ? days.find((d: any) => d?.dateISO === iso) : null;
    return Number(hit?.dayIndex ?? 1) || 1;
  }, [derivedRoadmap]);

  const effectiveTodayDayIndex = useMemo(() => {
    if (DEV_UNLOCK_ALL_DAYS) return -1;
    if (typeof DEV_FORCE_DAY_INDEX === "number" && DEV_FORCE_DAY_INDEX >= 1 && DEV_FORCE_DAY_INDEX <= 7) return DEV_FORCE_DAY_INDEX;
    return actualTodayDayIndex;
  }, [actualTodayDayIndex]);

  const todayDay = useMemo(() => {
    const days = (derivedRoadmap as any)?.days ?? [];
    if (!Array.isArray(days) || days.length === 0) return null;

    if (DEV_UNLOCK_ALL_DAYS) return actualTodayDay ?? days[0] ?? null;

    const forced = days.find((d: any) => Number(d?.dayIndex ?? 0) === effectiveTodayDayIndex);
    return forced ?? actualTodayDay ?? days[0] ?? null;
  }, [derivedRoadmap, actualTodayDay, effectiveTodayDayIndex]);

  const todaySetProgress = useMemo(() => {
    if (!todayDay) {
      return { done: 0, planned: 0, bySkill: { vocab: 0, grammar: 0, reading: 0 } as Record<Skill, number>, nineMode: false };
    }
    const nineMode = isNineSetRoadmapDay(todayDay);
    if (nineMode) {
      const r = countDoneSetsForDay(todayDay);
      return { ...r, nineMode };
    }
    return { done: 0, planned: 0, bySkill: { vocab: 0, grammar: 0, reading: 0 }, nineMode };
  }, [todayDay]);

  const todayBySkillPlanned = useMemo(() => {
    if (!todayDay || !todaySetProgress.nineMode) return { vocab: 0, grammar: 0, reading: 0 } as Record<Skill, number>;
    return countDoneSetsForDay(todayDay).bySkill;
  }, [todayDay, todaySetProgress.nineMode]);

  const todayTargets = useMemo(() => getTargetsForDay(todayDay), [todayDay]);
  const todayTargetMinutes = useMemo(() => sumTargets(todayTargets), [todayTargets]);
  const todayDisplayISO = String((todayDay as any)?.dateISO ?? todayISO());
  const todayDoneMinutes = useMemo(() => sumMinutesForDate(practiceLog, todayDisplayISO), [practiceLog, todayDisplayISO]);

  const todayIsWeeklyEntry = useMemo(() => {
    if (!todayDay) return true;
    return (
      !!(todayDay as any)?.weeklyCheckOnly ||
      !!(todayDay as any)?.isWeeklyCheckDay ||
      Number((todayDay as any)?.dayIndex ?? 0) === 7 ||
      !isNineSetRoadmapDay(todayDay)
    );
  }, [todayDay]);

  const todayStartHref = useMemo(() => {
    if (todayIsWeeklyEntry) return "/practice/weekly-check";
    return `/practice/session?day=${encodeURIComponent(String((todayDay as any)?.dayIndex ?? 1))}`;
  }, [todayIsWeeklyEntry, todayDay]);

  if (!mounted) {
    return (
      <main style={pageWrap}>
        <div style={container}>
          <SoftCard>Loading…</SoftCard>
        </div>
      </main>
    );
  }

  return (
    <main style={pageWrap}>
      <div style={container}>
        {/* Header (match mock-tests) */}
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 44, fontWeight: 950, letterSpacing: -0.5 }}>Practice</div>
            <div style={{ marginTop: 6, fontSize: 13, opacity: 0.75 }}>Roadmap · Carryover · Today</div>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <NavBtn href="/dashboard">Dashboard</NavBtn>
            <NavBtn href="/practice/weekly-check">Weekly Check</NavBtn>
            <NavBtn href="/mock-tests">Mock Tests</NavBtn>
            <NavBtn href="/reports">Reports</NavBtn>
          </div>
        </div>

        {/* Roadmap */}
        <div style={{ marginTop: 12 }}>
          <SoftCard>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 12, opacity: 0.72, fontWeight: 950 }}>Roadmap</div>
                <div style={{ marginTop: 6, fontSize: 24, fontWeight: 950 }}>7-day plan</div>
              </div>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <Pill>weekId {(derivedRoadmap as any)?.weekId ?? "—"}</Pill>
                <Pill>today {todayISO()}</Pill>
                {(derivedRoadmap as any)?.days?.[0] && isNineSetRoadmapDay((derivedRoadmap as any).days[0]) ? (
                  <Pill>progress: set-based ✅</Pill>
                ) : (
                  <Pill>progress: minutes (fallback)</Pill>
                )}
              </div>
            </div>

            <div style={{ marginTop: 12, ...frame }}>
              {!derivedRoadmap ? (
                <div style={{ fontSize: 13, opacity: 0.75 }}>No roadmap yet.</div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10 }}>
                  {(derivedRoadmap as any).days.map((d: any) => {
                    const realToday = d.dateISO === todayISO();

                    const isAllowedDay = DEV_UNLOCK_ALL_DAYS ? true : Number(d?.dayIndex ?? 0) === effectiveTodayDayIndex;

                    const startDisabledByCarryover = !DEV_BYPASS_CARRYOVER_LOCK && realToday && mustDoCarryoverFirst;

                    const nineMode = isNineSetRoadmapDay(d);

                    let plannedSets = 0;
                    let doneSets = 0;
                    let bySkill: Record<Skill, number> = { vocab: 0, grammar: 0, reading: 0 };

                    if (nineMode) {
                      const r = countDoneSetsForDay(d);
                      plannedSets = r.planned;
                      doneSets = r.done;
                      bySkill = r.bySkill;
                    } else {
                      const done = sumMinutesForDate(practiceLog, d.dateISO);
                      const targets = getTargetsForDay(d);
                      const target = sumTargets(targets);
                      plannedSets = target > 0 ? 9 : 0;
                      doneSets = target > 0 ? Math.min(9, Math.floor((done / target) * 9)) : 0;
                    }

                    const pct =
                      d.status === "finish"
                        ? 100
                        : plannedSets > 0
                        ? Math.min(100, Math.round((doneSets / plannedSets) * 100))
                        : 0;

                    const isWeeklyEntry =
                      plannedSets === 0 || !!d?.weeklyCheckOnly || !!d?.isWeeklyCheckDay || Number(d?.dayIndex ?? 0) === 7;

                    const startHref = isWeeklyEntry ? "/practice/weekly-check" : `/practice/session?day=${encodeURIComponent(String(d.dayIndex))}`;

                    const startDisabled = !isAllowedDay || (!isWeeklyEntry ? startDisabledByCarryover : false);

                    const lockReason = !isAllowedDay
                      ? `Day ${effectiveTodayDayIndex} only. Other days are locked.`
                      : !isWeeklyEntry && startDisabledByCarryover
                      ? "Carryover must be cleared first."
                      : "Open";

                    return (
                      <div
                        key={d.dateISO}
                        style={{
                          borderRadius: 16,
                          border: "1px solid rgba(255,255,255,0.10)",
                          background: realToday ? "rgba(120, 90, 255, 0.10)" : "rgba(0,0,0,0.18)",
                          padding: 12,
                          boxSizing: "border-box",
                          opacity: !isAllowedDay ? 0.72 : 1,
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
                          <div style={{ fontWeight: 950 }}>Day {d.dayIndex}</div>
                          <SmallStartLink href={startHref} disabled={startDisabled} label={isWeeklyEntry ? "Weekly" : "Open"} title={lockReason} />
                        </div>

                        <div style={{ marginTop: 6, fontSize: 12, opacity: 0.8 }}>{formatDatePretty(d.dateISO)}</div>

                        <div style={{ marginTop: 10 }}>
                          <ProgressBar pct={pct} />
                          <div style={{ marginTop: 8, fontSize: 12, opacity: 0.75 }}>
                            {isWeeklyEntry ? "no practice → weekly check" : `sets ${doneSets}/${plannedSets}`}
                          </div>
                        </div>

                        {nineMode ? (
                          <div style={{ marginTop: 10, display: "flex", gap: 6, flexWrap: "wrap" }}>
                            <Pill>V {bySkill.vocab}</Pill>
                            <Pill>G {bySkill.grammar}</Pill>
                            <Pill>R {bySkill.reading}</Pill>
                          </div>
                        ) : (
                          <div style={{ marginTop: 10, display: "flex", gap: 6, flexWrap: "wrap" }}>
                            {(() => {
                              const targets = getTargetsForDay(d);
                              return (
                                <>
                                  <Pill>V {targets.vocab}m</Pill>
                                  <Pill>G {targets.grammar}m</Pill>
                                  <Pill>R {targets.reading}m</Pill>
                                </>
                              );
                            })()}
                          </div>
                        )}

                        {!isAllowedDay ? (
                          <div style={{ marginTop: 8, fontSize: 12, opacity: 0.7 }}>🔒 Day {effectiveTodayDayIndex} only</div>
                        ) : !isWeeklyEntry && mustDoCarryoverFirst && !DEV_BYPASS_CARRYOVER_LOCK ? (
                          <div style={{ marginTop: 8, fontSize: 12, opacity: 0.7 }}>Carryover を先に完了してね</div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              )}

              <div style={{ marginTop: 12, fontSize: 12, opacity: 0.7 }}>
                ※進捗は「完了セット数」で連動。時間は Reports 側で集計。
              </div>
            </div>
          </SoftCard>
        </div>

        {/* Carryover + Today (2 columns like mock-tests layout) */}
        <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "minmax(280px, 420px) 1fr", gap: 12 }}>
          {/* Carryover */}
          <SoftCard>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 12, opacity: 0.72, fontWeight: 950 }}>Carryover (mandatory)</div>
                <div style={{ marginTop: 6, fontSize: 24, fontWeight: 950 }}>Yesterday’s mistakes</div>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <Pill>{carryover?.cleared ? "✅ cleared" : "⛔ not cleared"}</Pill>
              </div>
            </div>

            <div style={{ marginTop: 12, ...frame }}>
              <div style={{ display: "grid", gap: 8 }}>
                <Pill>from {carryover?.dateISO ?? "—"}</Pill>
                <Pill>items {carryover?.items?.length ?? 0}</Pill>
              </div>

              <div style={{ marginTop: 10, fontSize: 13, opacity: 0.8, lineHeight: 1.6 }}>
                {mustDoCarryoverFirst
                  ? "前日の間違いは必ず最初にやる。全問正解するまで繰り返し。終わったら Today に進める。"
                  : "前日のミスは無し（または完了済み）。"}
              </div>

              <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
                <PrimaryLink href="/practice/session?mode=carryover" disabled={!mustDoCarryoverFirst}>
                  Start Carryover →
                </PrimaryLink>
                <GhostLink href="/practice/weekly-check">Weekly Check →</GhostLink>
              </div>

              <div style={{ marginTop: 10, fontSize: 12, opacity: 0.7 }}>
                key: <b>{CARRYOVER_KEY}</b>
              </div>
            </div>
          </SoftCard>

          {/* Today */}
          <SoftCard>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 12, opacity: 0.72, fontWeight: 950 }}>Today</div>
                <div style={{ marginTop: 6, fontSize: 24, fontWeight: 950 }}>{formatDatePretty(todayDisplayISO)}</div>
              </div>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                {todaySetProgress.nineMode ? (
                  <Pill>
                    sets {todaySetProgress.done}/{todaySetProgress.planned}
                  </Pill>
                ) : (
                  <>
                    <Pill>done {todayDoneMinutes}m</Pill>
                    <Pill>target {todayTargetMinutes}m</Pill>
                  </>
                )}
                <Pill>{mustDoCarryoverFirst ? "🔒 locked" : "🔓 ready"}</Pill>
              </div>
            </div>

            <div style={{ marginTop: 12, ...frame }}>
              <div>
                {(() => {
                  const carryOk = !mustDoCarryoverFirst;

                  if (todaySetProgress.nineMode) {
                    const planned = todaySetProgress.planned;
                    const done = todaySetProgress.done;
                    const doneOk = planned > 0 ? done >= planned : true;
                    const pct = doneOk && carryOk ? 100 : planned > 0 ? Math.min(100, Math.round((done / planned) * 100)) : 0;
                    return <ProgressBar pct={pct} />;
                  }

                  const doneOk = todayTargetMinutes > 0 ? todayDoneMinutes >= todayTargetMinutes : true;
                  const pct = doneOk && carryOk ? 100 : todayTargetMinutes > 0 ? Math.min(100, Math.round((todayDoneMinutes / todayTargetMinutes) * 100)) : 0;
                  return <ProgressBar pct={pct} />;
                })()}
                <div style={{ marginTop: 8, fontSize: 12, opacity: 0.75 }}>
                  {todaySetProgress.nineMode ? "Set-based completion" : "Minutes-based completion (fallback)"}
                </div>
              </div>

              <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <PrimaryLink href={todayStartHref} disabled={(!todayIsWeeklyEntry && mustDoCarryoverFirst) || !todayDay}>
                  {todayIsWeeklyEntry ? "Start Weekly Check →" : "Start Today →"}
                </PrimaryLink>
                <GhostLink href="/reports">Open Reports →</GhostLink>
              </div>

              {!todayIsWeeklyEntry && todaySetProgress.nineMode ? (
                <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10 }}>
                  {(["vocab", "grammar", "reading"] as const).map((s) => (
                    <div
                      key={s}
                      style={{
                        borderRadius: 16,
                        border: "1px solid rgba(255,255,255,0.10)",
                        background: "rgba(0,0,0,0.18)",
                        padding: 12,
                      }}
                    >
                      <div style={{ fontWeight: 950 }}>
                        {skillEmoji(s)} {skillLabel(s)}
                      </div>
                      <div style={{ marginTop: 6, fontSize: 12, opacity: 0.8 }}>
                        planned sets: <b>{todayBySkillPlanned[s] ?? 0}</b>
                      </div>
                      <div style={{ marginTop: 6, fontSize: 12, opacity: 0.65 }}>time → reports</div>
                    </div>
                  ))}
                </div>
              ) : null}

              {mustDoCarryoverFirst && !todayIsWeeklyEntry ? (
                <div style={{ marginTop: 10, fontSize: 12, opacity: 0.7 }}>Carryover を先に完了してね</div>
              ) : null}
            </div>
          </SoftCard>
        </div>

        {/* footer debug */}
        <div style={{ marginTop: 12, opacity: 0.65, fontSize: 12 }}>
          keys: <b>{ROADMAP_KEY}</b> / <b>{PRACTICE_LOG_KEY}</b> / <b>{CARRYOVER_KEY}</b> / planId: <b>{planId}</b>
        </div>
      </div>
    </main>
  );
}