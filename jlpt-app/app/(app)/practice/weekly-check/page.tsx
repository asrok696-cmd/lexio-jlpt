// app/(app)/practice/weekly-check/page.tsx
"use client";

import Link from "next/link";
import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { toWeekV1FromRoadmap } from "@/app/_lib/roadmapCompat";
import {
  ROADMAP_ACTIVE_KEY,
  ROADMAP_KEY,
  readJSON,
  todayISO,
  type RoadmapWeekV1,
} from "@/app/_lib/roadmap";
import { CARRYOVER_KEY, type Carryover } from "@/app/_lib/carryover";
import type { JLPTLevel } from "@/app/_lib/roadmap";
import { PROFILE_KEY, type ProfileV1 } from "@/app/_lib/profile";
import { ensureWeeklyLevelsFromRoadmap, readWeeklyCheckStore } from "@/app/_lib/weeklyCheck";

// ==============================
// ✅ DEV FLAGS（LAUNCH: false）
// ==============================
const DEV_BYPASS_WEEKLY_LOCK = false;
const DEV_FORCE_READY = false;
const DEV_SHOW_DEBUG_BADGES = false;

const pageWrap: React.CSSProperties = { minHeight: "100vh", color: "rgba(255,255,255,0.92)" };
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

// ✅ spanではなくdiv（入れ子事故予防）
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
  try {
    const raw = localStorage.getItem(CARRYOVER_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as Carryover;
    if (!v || typeof v !== "object") return null;
    return v;
  } catch {
    return null;
  }
}

function readProfile(): ProfileV1 | null {
  try {
    const p = readJSON<any>(PROFILE_KEY);
    if (!p || typeof p !== "object") return null;
    return p as ProfileV1;
  } catch {
    return null;
  }
}

function normLevel(x: any, fallback: JLPTLevel = "N5"): JLPTLevel {
  return x === "N5" || x === "N4" || x === "N3" || x === "N2" || x === "N1" ? x : fallback;
}

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

export default function WeeklyCheckEntryPage() {
  const router = useRouter();

  const [week, setWeek] = useState<RoadmapWeekV1 | null>(null);
  const [carryover, setCarryover] = useState<Carryover | null>(null);
  const [mounted, setMounted] = useState(false);
  const [isNavigating, setIsNavigating] = useState(false);

  // optional debug/visibility UI
  const [practiceLevelBySkill, setPracticeLevelBySkill] = useState<{
    vocab: JLPTLevel;
    grammar: JLPTLevel;
    reading: JLPTLevel;
  } | null>(null);

  useEffect(() => {
    setMounted(true);

    const w = readActiveWeek();
    setWeek(w ?? null);

    const c = readCarryover();
    setCarryover(c);

    // weekly store init（型安全版）
    try {
      const rm = readJSON<any>(ROADMAP_KEY);
      const p = readProfile();

      const goalFromRoadmap = normLevel(rm?.goalLevel ?? rm?.level ?? "N5", "N5");
      const profileCurrent = p?.currentLevel ? normLevel(p.currentLevel, "N5") : undefined;
      const profileGoal = p?.goalLevel ? normLevel(p.goalLevel, goalFromRoadmap) : undefined;

      const store = ensureWeeklyLevelsFromRoadmap({
        roadmapLevel: goalFromRoadmap,
      });

      const s = readWeeklyCheckStore();

      setPracticeLevelBySkill({
        vocab: normLevel(
          s?.practiceLevelBySkill?.vocab,
          normLevel(store?.practiceLevelBySkill?.vocab, profileCurrent ?? profileGoal ?? goalFromRoadmap)
        ),
        grammar: normLevel(
          s?.practiceLevelBySkill?.grammar,
          normLevel(store?.practiceLevelBySkill?.grammar, profileCurrent ?? profileGoal ?? goalFromRoadmap)
        ),
        reading: normLevel(
          s?.practiceLevelBySkill?.reading,
          normLevel(store?.practiceLevelBySkill?.reading, profileCurrent ?? profileGoal ?? goalFromRoadmap)
        ),
      });
    } catch {
      // fail-soft
      try {
        const s = readWeeklyCheckStore();
        setPracticeLevelBySkill({
          vocab: normLevel(s?.practiceLevelBySkill?.vocab, "N5"),
          grammar: normLevel(s?.practiceLevelBySkill?.grammar, "N5"),
          reading: normLevel(s?.practiceLevelBySkill?.reading, "N5"),
        });
      } catch {}
    }
  }, []);

  const rawLockReason = useMemo(() => getLockReason(week, carryover), [week, carryover]);
  const effectiveLockReason = DEV_BYPASS_WEEKLY_LOCK || DEV_FORCE_READY ? null : rawLockReason;
  const locked = !!effectiveLockReason;

  const weekId = (week as any)?.weekId ?? "—";
  const goal = normLevel((week as any)?.goalLevel ?? (week as any)?.level ?? "N5", "N5");

  const todayDebug = useMemo(() => {
    const today = todayISO();
    const todayDay = week?.days?.find((d) => d.dateISO === today) ?? null;
    return {
      todayISO: today,
      dayIndex: Number(todayDay?.dayIndex ?? 0) || null,
      carryoverItems: carryover?.items?.length ?? 0,
      carryoverCleared: carryover?.cleared ?? null,
    };
  }, [week, carryover]);

  function startWeeklyCheck() {
    setIsNavigating(true);
    const target = "/practice/weekly-check/session";

    try {
      router.push(target);

      // fallback
      window.setTimeout(() => {
        try {
          if (window.location.pathname === "/practice/weekly-check") {
            window.location.href = target;
          }
        } catch {
          window.location.href = target;
        }
      }, 350);
    } catch {
      window.location.href = target;
    } finally {
      window.setTimeout(() => setIsNavigating(false), 1200);
    }
  }

  if (!mounted) {
    return (
      <main style={pageWrap}>
        <div style={container}>
          <SoftCard>
            <div style={{ fontWeight: 950 }}>Weekly Check</div>
            <div style={{ marginTop: 8, fontSize: 13, opacity: 0.75 }}>Loading…</div>
          </SoftCard>
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
              30 questions · V/G/R each 10 · (6 this-week + 4 hard) · all skills 90% x3 weeks → promotion
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <Link href="/practice" style={{ fontSize: 13, opacity: 0.86, color: "white", textDecoration: "none" }}>
              ← Practice
            </Link>
            <Pill>week {weekId}</Pill>
            <Pill>goal {goal}</Pill>
            <Pill>{locked ? "🔒 locked" : "✅ ready"}</Pill>
            {DEV_SHOW_DEBUG_BADGES && (DEV_BYPASS_WEEKLY_LOCK || DEV_FORCE_READY) ? <Pill>DEV: lock bypass</Pill> : null}
          </div>
        </div>

        {/* Current practice level */}
        <div style={{ marginTop: 12 }}>
          <SoftCard>
            <div style={{ fontWeight: 950, fontSize: 14 }}>Current practice level</div>
            <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
              <Pill>V {practiceLevelBySkill?.vocab ?? "—"}</Pill>
              <Pill>G {practiceLevelBySkill?.grammar ?? "—"}</Pill>
              <Pill>R {practiceLevelBySkill?.reading ?? "—"}</Pill>
            </div>
            <div style={{ marginTop: 8, fontSize: 12, opacity: 0.7 }}>
              ※ 昇格判定は「V/G/R 全て90%以上を3週連続」で次週から反映
            </div>

            {DEV_SHOW_DEBUG_BADGES ? (
              <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
                <Pill>today {todayDebug.todayISO}</Pill>
                <Pill>dayIndex {todayDebug.dayIndex ?? "—"}</Pill>
                <Pill>carry items {todayDebug.carryoverItems}</Pill>
                <Pill>
                  carry{" "}
                  {todayDebug.carryoverCleared === null ? "—" : todayDebug.carryoverCleared ? "cleared" : "not-cleared"}
                </Pill>
              </div>
            ) : null}
          </SoftCard>
        </div>

        {/* Lock / Ready */}
        <div style={{ marginTop: 12 }}>
          <SoftCard>
            {locked ? (
              <>
                <div style={{ fontWeight: 950, fontSize: 16 }}>Locked</div>
                <div style={{ marginTop: 8, fontSize: 13, opacity: 0.8 }}>🔒 {effectiveLockReason}</div>

                <div
                  style={{
                    marginTop: 14,
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                    gap: 12,
                  }}
                >
                  <PrimaryBtn onClick={() => router.replace("/practice")}>Back to Practice →</PrimaryBtn>
                  <GhostBtn onClick={() => router.replace("/practice/session?mode=carryover")}>Go to Carryover →</GhostBtn>
                </div>
              </>
            ) : (
              <>
                <div style={{ fontWeight: 950, fontSize: 16 }}>Ready</div>
                <div style={{ marginTop: 8, fontSize: 13, opacity: 0.8 }}>
                  Day 7 unlocked. Press start to begin the Weekly Check.
                </div>

                <div
                  style={{
                    marginTop: 14,
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                    gap: 12,
                  }}
                >
                  <PrimaryBtn onClick={startWeeklyCheck} disabled={isNavigating}>
                    {isNavigating ? "Opening..." : "Start Weekly Check →"}
                  </PrimaryBtn>
                  <GhostBtn onClick={() => router.replace("/practice")}>Back to Practice →</GhostBtn>
                </div>
              </>
            )}
          </SoftCard>
        </div>
      </div>
    </main>
  );
}