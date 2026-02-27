// app/(app)/dashboard/page.tsx
"use client";

import Link from "next/link";
import React, { useEffect, useMemo, useState } from "react";
import { SignOutButton } from "@clerk/nextjs";

import {
  ROADMAP_KEY,
  type RoadmapWeekV1,
  readJSON,
  writeJSON,
  todayISO,
} from "@/app/_lib/roadmap";

import { CARRYOVER_KEY, type Carryover } from "@/app/_lib/carryover";
import { WEEKLY_CHECK_KEY, readWeeklyCheckStore } from "@/app/_lib/weeklyCheck";

import {
  pageWrap,
  container,
  SoftCard,
  Pill,
  NavBtn,
  frame,
} from "@/app/_components/AppShell";

const EXAM_DATE_KEY = "lexio.examDateISO.v1";

// Keys cleared when re-running Diagnostic (adjust if your project uses different keys)
const ROADMAP_ACTIVE_KEY = "lexio.roadmapActive.v1";
const STUDY_PLAN_KEY = "lexio.studyPlan.v1";

type JLPTLevel = "N5" | "N4" | "N3" | "N2" | "N1";

function safeParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function formatPretty(iso: string) {
  try {
    const d = new Date(iso);
    const w = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d.getDay()];
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${w} · ${yyyy}/${mm}/${dd}`;
  } catch {
    return iso;
  }
}

function clampPct(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, n));
}

function isJLPTLevel(v: unknown): v is JLPTLevel {
  return v === "N5" || v === "N4" || v === "N3" || v === "N2" || v === "N1";
}

// ----- 9-set progress compatibility -----
function isNineSetRoadmapDay(d: any): boolean {
  const sets = Array.isArray(d?.sets) ? d.sets : [];
  return sets.some(
    (s: any) =>
      typeof s?.setId === "string" &&
      (s.setId.startsWith("vocab_") ||
        s.setId.startsWith("grammar_") ||
        s.setId.startsWith("reading_"))
  );
}

function isSetFinished(s: any): boolean {
  if (!!s?.progress?.finishedAt) return true;
  const total = Number(s?.progress?.total ?? s?.questionIds?.length ?? 0);
  const masteredLen = Array.isArray(s?.progress?.mastered)
    ? s.progress.mastered.length
    : 0;
  return total > 0 && masteredLen >= total;
}

function getPracticeSetsForDay(d: any): any[] {
  const sets = Array.isArray(d?.sets) ? d.sets : [];
  const nine = sets.filter(
    (s: any) =>
      typeof s?.setId === "string" &&
      (s.setId.startsWith("vocab_") ||
        s.setId.startsWith("grammar_") ||
        s.setId.startsWith("reading_"))
  );
  if (nine.length) return nine;
  const main = sets.find((s: any) => s?.setId === "main");
  return main ? [main] : [];
}

function countDoneSetsForDay(d: any): { done: number; planned: number } {
  const sets = getPracticeSetsForDay(d);
  const planned = sets.length;
  const done = sets.filter(isSetFinished).length;
  return { done, planned };
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

function PrimaryLink({
  href,
  disabled,
  children,
}: {
  href: string;
  disabled?: boolean;
  children: React.ReactNode;
}) {
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

function GhostButton({
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
        borderRadius: 14,
        padding: "12px 14px",
        border: "1px solid rgba(255,255,255,0.12)",
        background: "rgba(255,255,255,0.06)",
        color: "white",
        fontWeight: 950,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.65 : 1,
      }}
    >
      {children}
    </button>
  );
}

function RoadCardStyle(
  isToday: boolean,
  disabled: boolean,
  isWeekly: boolean
): React.CSSProperties {
  return {
    borderRadius: 16,
    border: "1px solid rgba(255,255,255,0.10)",
    background: isToday
      ? "rgba(120, 90, 255, 0.10)"
      : isWeekly
      ? "rgba(0,0,0,0.16)"
      : "rgba(255,255,255,0.05)",
    padding: 12,
    opacity: disabled ? 0.65 : 1,
    boxSizing: "border-box",
    minWidth: 0,
  };
}

function isRoadmapUsable(rm: any): boolean {
  const days = rm?.days;
  if (!Array.isArray(days) || days.length !== 7) return false;
  return true;
}

export default function DashboardPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const [roadmap, setRoadmap] = useState<RoadmapWeekV1 | null>(null);
  const [carryover, setCarryover] = useState<Carryover | null>(null);
  const [weekly, setWeekly] = useState<any | null>(null);

  const [examISO, setExamISO] = useState<string>("2026-07-28");
  const [examDraft, setExamDraft] = useState<string>("2026-07-28");

  const [planBusy, setPlanBusy] = useState(false);

  useEffect(() => {
    if (!mounted) return;

    const rm = readJSON<RoadmapWeekV1>(ROADMAP_KEY);
    setRoadmap(rm ?? null);

    const co = safeParse<Carryover>(localStorage.getItem(CARRYOVER_KEY));
    setCarryover(co ?? null);

    try {
      const wc = readWeeklyCheckStore() as any;
      setWeekly(wc ?? null);
    } catch {
      setWeekly(null);
    }

    const ex = localStorage.getItem(EXAM_DATE_KEY);
    const exISO =
      typeof ex === "string" && ex.length >= 10 ? ex.slice(0, 10) : "2026-07-28";
    setExamISO(exISO);
    setExamDraft(exISO);
  }, [mounted]);

  const today = todayISO();
  const roadmapUsable = useMemo(() => isRoadmapUsable(roadmap), [roadmap]);

  const todayDay = useMemo(() => {
    const days = (roadmap as any)?.days ?? [];
    if (!Array.isArray(days) || !days.length) return null;
    return days.find((d: any) => d?.dateISO === today) ?? days[0] ?? null;
  }, [roadmap, today]);

  const todayDayIndex = useMemo(() => {
    const days = (roadmap as any)?.days ?? [];
    if (!Array.isArray(days) || !days.length) return 1;
    const hit = days.find((d: any) => d?.dateISO === today) ?? days[0];
    return Number(hit?.dayIndex ?? 1) || 1;
  }, [roadmap, today]);

  const weekId = (roadmap as any)?.weekId ?? "—";
  const goalLevel: JLPTLevel = isJLPTLevel((roadmap as any)?.goalLevel)
    ? (roadmap as any).goalLevel
    : isJLPTLevel((roadmap as any)?.level)
    ? (roadmap as any).level
    : "N5";

  const carryoverPending = useMemo(() => {
    return (
      !!carryover && !carryover.cleared && (carryover.items?.length ?? 0) > 0
    );
  }, [carryover]);

  const todayIsDay7 = useMemo(() => {
    return Number((todayDay as any)?.dayIndex ?? todayDayIndex) === 7;
  }, [todayDay, todayDayIndex]);

  const todaySets = useMemo(() => {
    if (!todayDay) return { done: 0, planned: 0, pct: 0 };
    const nine = isNineSetRoadmapDay(todayDay);
    if (nine) {
      const { done, planned } = countDoneSetsForDay(todayDay);
      const pct = planned > 0 ? Math.round((done / planned) * 100) : 0;
      return { done, planned, pct };
    }

    const isWeeklyOnly =
      !!(todayDay as any)?.weeklyCheckOnly ||
      !!(todayDay as any)?.isWeeklyCheckDay ||
      Number((todayDay as any)?.dayIndex) === 7;

    if (isWeeklyOnly) return { done: 0, planned: 0, pct: 0 };
    return { done: 0, planned: 9, pct: 0 };
  }, [todayDay]);

  const weeklySummary = useMemo(() => {
    const s =
      (weekly ??
        (() => {
          try {
            return readWeeklyCheckStore() as any;
          } catch {
            return null;
          }
        })()) as any;

    const history = Array.isArray(s?.history)
      ? s.history
      : Array.isArray(s?.weeklyHistory)
      ? s.weeklyHistory
      : Array.isArray(s?.results)
      ? s.results
      : [];

    const unifiedLevel =
      (isJLPTLevel(s?.practiceLevel) && s.practiceLevel) ||
      (isJLPTLevel(s?.currentPracticeLevel) && s.currentPracticeLevel) ||
      (isJLPTLevel(s?.promotion?.currentPracticeLevel) &&
        s.promotion.currentPracticeLevel) ||
      null;

    const lvV = isJLPTLevel(s?.practiceLevelBySkill?.vocab)
      ? s.practiceLevelBySkill.vocab
      : unifiedLevel ?? "N5";
    const lvG = isJLPTLevel(s?.practiceLevelBySkill?.grammar)
      ? s.practiceLevelBySkill.grammar
      : unifiedLevel ?? "N5";
    const lvR = isJLPTLevel(s?.practiceLevelBySkill?.reading)
      ? s.practiceLevelBySkill.reading
      : unifiedLevel ?? "N5";

    const legacyStreakV = Number(s?.streak90?.vocab ?? 0);
    const legacyStreakG = Number(s?.streak90?.grammar ?? 0);
    const legacyStreakR = Number(s?.streak90?.reading ?? 0);
    const unifiedStreak = Number(
      s?.promotion?.consecutiveAll90Weeks ?? s?.consecutiveAll90Weeks ?? 0
    );

    const hasLegacyBySkillStreak = legacyStreakV || legacyStreakG || legacyStreakR;

    return {
      historyCount: history.length,
      unifiedLevel: unifiedLevel ?? "N5",
      unifiedStreak: Number.isFinite(unifiedStreak) ? unifiedStreak : 0,
      streakV: hasLegacyBySkillStreak
        ? legacyStreakV
        : Number.isFinite(unifiedStreak)
        ? unifiedStreak
        : 0,
      streakG: hasLegacyBySkillStreak
        ? legacyStreakG
        : Number.isFinite(unifiedStreak)
        ? unifiedStreak
        : 0,
      streakR: hasLegacyBySkillStreak
        ? legacyStreakR
        : Number.isFinite(unifiedStreak)
        ? unifiedStreak
        : 0,
      lvV,
      lvG,
      lvR,
    };
  }, [weekly]);

  // Primary action selection (single CTA)
  const primaryAction = useMemo(() => {
    if (carryoverPending) {
      return {
        label: "Start Carryover →",
        href: "/practice/session?mode=carryover",
        disabled: false,
        reason: "Carryover is mandatory before practice.",
      };
    }

    if (!roadmapUsable) {
      return {
        label: "Run Diagnostic →",
        href: "/diagnostic",
        disabled: false,
        reason: "No roadmap yet. Create a plan first.",
      };
    }

    if (todayIsDay7) {
      return {
        label: "Start Weekly Check →",
        href: "/practice/weekly-check",
        disabled: false,
        reason: "Day 7 is Weekly Check day.",
      };
    }

    return {
      label: "Start Today →",
      href: "/practice",
      disabled: false,
      reason: "Start the next set and keep momentum.",
    };
  }, [carryoverPending, roadmapUsable, todayIsDay7]);

  const onSaveExam = () => {
    if (!mounted) return;
    const iso = (examDraft ?? "").trim().slice(0, 10);
    if (!iso || iso.length < 10) return;
    localStorage.setItem(EXAM_DATE_KEY, iso);
    setExamISO(iso);
  };

  const onClearExam = () => {
    if (!mounted) return;
    localStorage.removeItem(EXAM_DATE_KEY);
    const fallback = "2026-07-28";
    setExamISO(fallback);
    setExamDraft(fallback);
  };

  const resetGoalToN5 = () => {
    if (!mounted) return;

    const prev = (() => {
      try {
        return (readWeeklyCheckStore() as any) ?? {};
      } catch {
        return {};
      }
    })();

    const nextWeekly: any = {
      ...(prev && typeof prev === "object" ? prev : {}),
      version: Number(prev?.version ?? 1) || 1,
      updatedAtISO: new Date().toISOString(),
      practiceLevel: "N5",
      currentPracticeLevel: "N5",
      promotion: {
        ...(prev?.promotion && typeof prev.promotion === "object" ? prev.promotion : {}),
        currentPracticeLevel: "N5",
        consecutiveAll90Weeks: 0,
      },
      streak90: { vocab: 0, grammar: 0, reading: 0 },
      practiceLevelBySkill: { vocab: "N5", grammar: "N5", reading: "N5" },
    };

    try {
      localStorage.setItem(WEEKLY_CHECK_KEY, JSON.stringify(nextWeekly));
    } catch {}
    setWeekly(nextWeekly);

    const rm = readJSON<any>(ROADMAP_KEY);
    if (rm && typeof rm === "object") {
      const next = { ...rm, goalLevel: "N5" as JLPTLevel, level: rm.level ?? "N5" };
      writeJSON(ROADMAP_KEY, next);
      setRoadmap(next as any);
    }
  };

  // Re-run Diagnostic: reset plan-related local state, then go to /diagnostic
  const rerunDiagnostic = () => {
    if (!mounted) return;
    if (planBusy) return;

    setPlanBusy(true);

    try {
      localStorage.removeItem(ROADMAP_KEY);
      localStorage.removeItem(ROADMAP_ACTIVE_KEY);
      localStorage.removeItem(STUDY_PLAN_KEY);

      // optional resets to avoid inconsistent gates
      localStorage.removeItem(WEEKLY_CHECK_KEY);
      localStorage.removeItem(CARRYOVER_KEY);

      setRoadmap(null);
      setCarryover(null);
      setWeekly(null);

      window.location.href = "/diagnostic";
    } finally {
      window.setTimeout(() => setPlanBusy(false), 800);
    }
  };

  // Launch: remove dev reset button from UI (keep handler if you want)
  const hardResetDev = () => {
    if (!mounted) return;
    localStorage.removeItem(EXAM_DATE_KEY);
    localStorage.removeItem(WEEKLY_CHECK_KEY);
    localStorage.removeItem(CARRYOVER_KEY);
    localStorage.removeItem(ROADMAP_KEY);
    localStorage.removeItem(ROADMAP_ACTIVE_KEY);
    localStorage.removeItem(STUDY_PLAN_KEY);
    location.reload();
  };

  const roadmapDays: any[] = Array.isArray((roadmap as any)?.days)
    ? (roadmap as any).days
    : [];

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
        {/* Header */}
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
            <div style={{ fontSize: 44, fontWeight: 950, letterSpacing: -0.5 }}>
              Dashboard
            </div>
            <div style={{ marginTop: 6, fontSize: 13, opacity: 0.75 }}>
              Today · Roadmap · Weekly Check
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <NavBtn href="/practice">Practice</NavBtn>
            <NavBtn href="/practice/weekly-check">Weekly Check</NavBtn>
            <NavBtn href="/mock-tests">Mock Tests</NavBtn>
            <NavBtn href="/reports">Reports</NavBtn>

            <SignOutButton>
              <button
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 12px",
                  borderRadius: 999,
                  border: "1px solid rgba(255,255,255,0.10)",
                  background: "rgba(0,0,0,0.22)",
                  color: "rgba(255,255,255,0.92)",
                  fontWeight: 900,
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                Sign out
              </button>
            </SignOutButton>
          </div>
        </div>

        {/* Plan (Diagnostic) card */}
        <div style={{ marginTop: 12 }}>
          <SoftCard>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                flexWrap: "wrap",
                alignItems: "center",
              }}
            >
              <div>
                <div style={{ fontSize: 12, opacity: 0.72, fontWeight: 950 }}>Plan</div>
                <div style={{ marginTop: 6, fontSize: 24, fontWeight: 950 }}>
                  Diagnostic & plan settings
                </div>
                <div style={{ marginTop: 6, fontSize: 13, opacity: 0.78, lineHeight: 1.6 }}>
                  Re-run Diagnostic anytime to reset your goal level, weakness focus, and
                  regenerate the 7-day roadmap.
                </div>
              </div>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <Pill>goal {goalLevel}</Pill>
                <Pill>week {weekId}</Pill>
                <Pill>{roadmapUsable ? "✅ roadmap ready" : "⛔ no roadmap"}</Pill>
                <Pill>{carryoverPending ? "⛔ carryover pending" : "✓ carryover ok"}</Pill>
              </div>
            </div>

            <div style={{ marginTop: 12, ...frame }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <GhostLink href="/diagnostic">Open Diagnostic →</GhostLink>
                <GhostButton onClick={rerunDiagnostic} disabled={planBusy}>
                  {planBusy ? "Resetting…" : "Re-run Diagnostic (reset plan) →"}
                </GhostButton>
              </div>

              <div style={{ marginTop: 10, fontSize: 12, opacity: 0.72, lineHeight: 1.6 }}>
                Re-run Diagnostic clears your roadmap and weekly state, then sends you to
                the Diagnostic flow.
              </div>
            </div>
          </SoftCard>
        </div>

        {/* Top grid */}
        <div
          style={{
            marginTop: 12,
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
            gap: 12,
          }}
        >
          {/* Today */}
          <SoftCard>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                flexWrap: "wrap",
                alignItems: "center",
              }}
            >
              <div>
                <div style={{ fontSize: 12, opacity: 0.72, fontWeight: 950 }}>Today</div>
                <div style={{ marginTop: 6, fontSize: 24, fontWeight: 950 }}>
                  {formatPretty(today)}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <Pill>week {weekId}</Pill>
                <Pill>goal {goalLevel}</Pill>
              </div>
            </div>

            <div style={{ marginTop: 12, ...frame }}>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <Pill>{carryoverPending ? "⛔ carryover pending" : "✓ carryover cleared"}</Pill>
                <Pill>{roadmapUsable ? "roadmap ok" : "run diagnostic"}</Pill>
              </div>

              <div
                style={{
                  marginTop: 12,
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 10,
                  alignItems: "baseline",
                }}
              >
                <div style={{ fontSize: 12, opacity: 0.72, fontWeight: 950 }}>SETS</div>
                <div style={{ fontSize: 28, fontWeight: 950, letterSpacing: -0.5 }}>
                  {todaySets.done}/{todaySets.planned}
                </div>
              </div>

              <div style={{ marginTop: 10 }}>
                <ProgressBar pct={todaySets.pct} />
              </div>

              {/* Single primary CTA */}
              <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <PrimaryLink href={primaryAction.href} disabled={primaryAction.disabled}>
                  {primaryAction.label}
                </PrimaryLink>
                <GhostLink href="/practice">Open Practice →</GhostLink>
              </div>

              <div style={{ marginTop: 10, fontSize: 12, opacity: 0.72, lineHeight: 1.6 }}>
                {primaryAction.reason}
              </div>
            </div>
          </SoftCard>

          {/* Exam */}
          <SoftCard>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                flexWrap: "wrap",
                alignItems: "center",
              }}
            >
              <div>
                <div style={{ fontSize: 12, opacity: 0.72, fontWeight: 950 }}>Exam date</div>
                <div style={{ marginTop: 6, fontSize: 24, fontWeight: 950 }}>
                  {formatPretty(examISO)}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <Pill>local key: {EXAM_DATE_KEY}</Pill>
              </div>
            </div>

            <div style={{ marginTop: 12, ...frame }}>
              <div style={{ fontSize: 12, opacity: 0.72, fontWeight: 950 }}>
                SET / UPDATE (YYYY-MM-DD)
              </div>
              <input
                value={examDraft}
                onChange={(e) => setExamDraft(e.target.value)}
                placeholder="2026-07-28"
                style={{
                  marginTop: 8,
                  width: "100%",
                  padding: "12px 12px",
                  borderRadius: 14,
                  border: "1px solid rgba(255,255,255,0.12)",
                  background: "rgba(0,0,0,0.25)",
                  color: "rgba(255,255,255,0.92)",
                  fontWeight: 900,
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />

              <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <button
                  type="button"
                  onClick={onSaveExam}
                  style={{
                    borderRadius: 14,
                    padding: "12px 14px",
                    background: "rgba(120, 90, 255, 0.92)",
                    color: "white",
                    fontWeight: 950,
                    border: "none",
                    cursor: "pointer",
                  }}
                >
                  Save →
                </button>
                <GhostButton onClick={onClearExam}>Clear →</GhostButton>
              </div>

              <div style={{ marginTop: 10, fontSize: 12, opacity: 0.7, lineHeight: 1.6 }}>
                Keep this date updated to stay focused.
              </div>
            </div>
          </SoftCard>

          {/* Weekly */}
          <SoftCard>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                flexWrap: "wrap",
                alignItems: "center",
              }}
            >
              <div>
                <div style={{ fontSize: 12, opacity: 0.72, fontWeight: 950 }}>Weekly Check</div>
                <div style={{ marginTop: 6, fontSize: 24, fontWeight: 950 }}>
                  Level & streak
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <Pill>history {weeklySummary.historyCount}</Pill>
              </div>
            </div>

            <div style={{ marginTop: 12, ...frame }}>
              <div style={{ display: "grid", gap: 8 }}>
                <Pill>Practice level {weeklySummary.unifiedLevel}</Pill>
                <Pill>All-skill 90% streak {weeklySummary.unifiedStreak}</Pill>
              </div>

              <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
                <Pill>V {weeklySummary.lvV} / streak {weeklySummary.streakV}</Pill>
                <Pill>G {weeklySummary.lvG} / streak {weeklySummary.streakG}</Pill>
                <Pill>R {weeklySummary.lvR} / streak {weeklySummary.streakR}</Pill>
              </div>

              <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr", gap: 10 }}>
                <PrimaryLink href="/practice/weekly-check">Go to Weekly Entry →</PrimaryLink>
                <GhostButton onClick={resetGoalToN5}>Reset goal to N5 →</GhostButton>
              </div>

              <div style={{ marginTop: 10, fontSize: 12, opacity: 0.7, lineHeight: 1.6 }}>
                Reset sets goalLevel=N5 and resets weekly levels & streak. For a full rebuild,
                re-run Diagnostic.
              </div>

              {/* Launch: dev reset hidden.
                  If you still want it for internal testing, uncomment below.

              <div style={{ marginTop: 10 }}>
                <button
                  type="button"
                  onClick={hardResetDev}
                  style={{
                    width: "100%",
                    borderRadius: 14,
                    padding: "12px 14px",
                    border: "1px solid rgba(240,80,80,0.22)",
                    background: "rgba(240,80,80,0.12)",
                    color: "rgba(255,255,255,0.92)",
                    fontWeight: 950,
                    cursor: "pointer",
                  }}
                >
                  Hard reset →
                </button>
              </div>
              */}
            </div>
          </SoftCard>
        </div>

        {/* Roadmap quick view */}
        <div style={{ marginTop: 12 }}>
          <SoftCard>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: 12,
                flexWrap: "wrap",
                alignItems: "center",
              }}
            >
              <div>
                <div style={{ fontSize: 12, opacity: 0.72, fontWeight: 950 }}>Roadmap</div>
                <div style={{ marginTop: 6, fontSize: 24, fontWeight: 950 }}>
                  7-day quick view
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <Pill>today dayIndex {todayDayIndex}</Pill>
                <Pill>weekId {weekId}</Pill>
              </div>
            </div>

            <div style={{ marginTop: 12, ...frame }}>
              {!roadmapDays.length ? (
                <div style={{ fontSize: 13, opacity: 0.75, lineHeight: 1.6 }}>
                  No roadmap yet. Run{" "}
                  <Link
                    href="/diagnostic"
                    style={{ color: "white", fontWeight: 950, textDecoration: "none" }}
                  >
                    Diagnostic
                  </Link>
                  .
                </div>
              ) : (
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                    gap: 10,
                  }}
                >
                  {roadmapDays.map((d: any) => {
                    const isToday = d?.dateISO === today;
                    const isAllowed = Number(d?.dayIndex ?? 0) === todayDayIndex;

                    const isWeeklyFlag =
                      !!d?.weeklyCheckOnly ||
                      !!d?.isWeeklyCheckDay ||
                      Number(d?.dayIndex ?? 0) === 7;

                    const nine = isNineSetRoadmapDay(d);
                    const { done, planned } = isWeeklyFlag
                      ? { done: 0, planned: 0 }
                      : nine
                      ? countDoneSetsForDay(d)
                      : { done: 0, planned: 9 };

                    const pct = planned > 0 ? Math.round((done / planned) * 100) : 0;
                    const isWeekly = isWeeklyFlag || planned === 0;

                    const href = isWeekly
                      ? "/practice/weekly-check"
                      : `/practice/session?day=${encodeURIComponent(String(d.dayIndex))}`;

                    return (
                      <div
                        key={String(d.dateISO ?? d.dayIndex)}
                        style={RoadCardStyle(isToday, !isAllowed, isWeekly)}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            gap: 10,
                            alignItems: "center",
                          }}
                        >
                          <div style={{ fontWeight: 950 }}>Day {d.dayIndex}</div>
                          <Link
                            href={href}
                            aria-disabled={!isAllowed ? "true" : "false"}
                            style={{
                              pointerEvents: !isAllowed ? "none" : "auto",
                              opacity: !isAllowed ? 0.6 : 0.95,
                              textDecoration: "none",
                              borderRadius: 999,
                              padding: "6px 10px",
                              border: "1px solid rgba(255,255,255,0.12)",
                              background: "rgba(255,255,255,0.05)",
                              color: "white",
                              fontWeight: 950,
                              fontSize: 12,
                            }}
                            title={!isAllowed ? "Today only" : "Open"}
                          >
                            {isWeekly ? "Weekly →" : "Open →"}
                          </Link>
                        </div>

                        <div style={{ marginTop: 6, fontSize: 12, opacity: 0.75 }}>
                          {formatPretty(String(d.dateISO))}
                        </div>

                        <div style={{ marginTop: 10 }}>
                          <ProgressBar pct={isWeekly ? 0 : pct} />
                        </div>

                        <div
                          style={{
                            marginTop: 8,
                            display: "flex",
                            justifyContent: "space-between",
                            gap: 10,
                            alignItems: "center",
                          }}
                        >
                          <div style={{ fontSize: 12, opacity: 0.7, fontWeight: 900 }}>
                            {isWeekly ? "weekly check" : `sets ${done}/${planned}`}
                          </div>
                          {!isAllowed ? (
                            <div style={{ fontSize: 12, opacity: 0.6, fontWeight: 900 }}>
                              🔒 Today only
                            </div>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </SoftCard>
        </div>

        {/* Optional internal-only reset (kept hidden for launch) */}
        {/* <div style={{ marginTop: 12 }}>
          <SoftCard>
            <div style={{ fontSize: 12, opacity: 0.72, fontWeight: 950 }}>Internal tools</div>
            <div style={{ marginTop: 12 }}>
              <GhostButton onClick={hardResetDev}>Hard reset →</GhostButton>
            </div>
          </SoftCard>
        </div> */}
      </div>
    </main>
  );
}