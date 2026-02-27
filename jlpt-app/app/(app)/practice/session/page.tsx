"use client";

import Link from "next/link";
import React, { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { toWeekV1FromRoadmap } from "@/app/_lib/roadmapCompat";
import {
  ROADMAP_ACTIVE_KEY,
  ROADMAP_KEY,
  readJSON,
  todayISO,
  type RoadmapWeekV1,
  type RoadmapDay,
  type RoadmapSet,
  type Skill,
  type JLPTLevel,
} from "@/app/_lib/roadmap";

// ---------------- UI atoms ----------------

const pageWrap: React.CSSProperties = { minHeight: "100vh", color: "rgba(255,255,255,0.92)" };
const container: React.CSSProperties = { maxWidth: 1100, margin: "0 auto", padding: 24 };

function SoftCard({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        borderRadius: 18,
        border: "1px solid rgba(255,255,255,0.10)",
        background: "rgba(255,255,255,0.04)",
        padding: 16,
        boxShadow: "0 0 0 1px rgba(0,0,0,0.25) inset",
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
        color: "rgba(255,255,255,0.88)",
        whiteSpace: "nowrap",
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
        background: "rgba(255,255,255,0.05)",
        color: "white",
        fontWeight: 900,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.65 : 0.95,
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

// ---------------- helpers ----------------

function readActiveWeek(): RoadmapWeekV1 | null {
  const a = readJSON<any>(ROADMAP_ACTIVE_KEY);
  const aCompat = toWeekV1FromRoadmap(a);
  if (aCompat?.days?.length) return aCompat;

  const b = readJSON<any>(ROADMAP_KEY);
  const bCompat = toWeekV1FromRoadmap(b);
  if (bCompat?.days?.length) return bCompat;

  return null;
}

function isJLPTLevel(v: unknown): v is JLPTLevel {
  return v === "N5" || v === "N4" || v === "N3" || v === "N2" || v === "N1";
}

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

function asNum(v: unknown, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function isPracticeSet(setObj: RoadmapSet): boolean {
  const id = String((setObj as any)?.setId ?? "");
  return (
    id.startsWith("vocab_") ||
    id.startsWith("grammar_") ||
    id.startsWith("reading_") ||
    id === "yesterday_mistakes"
  );
}

function resolveSetSkill(day: RoadmapDay, setObj: RoadmapSet): Skill {
  const fromSet = (setObj as any)?.skill as Skill | undefined;
  const fromId = inferSkillFromSetId(String((setObj as any)?.setId ?? ""));
  const fromDay = (day as any)?.focusSkill as Skill | undefined;
  return (fromSet ?? fromId ?? fromDay ?? "vocab") as Skill;
}

function resolveSetLevel(week: RoadmapWeekV1, _day: RoadmapDay, setObj: RoadmapSet): JLPTLevel {
  const explicit = (setObj as any)?.levelTag ?? (setObj as any)?.level;
  if (isJLPTLevel(explicit)) return explicit;
  return (((week as any)?.goalLevel ?? "N5") as JLPTLevel) ?? "N5";
}

function plannedCountForSet(s: RoadmapSet | null, skill: Skill): number {
  const planned = asNum((s as any)?.plannedCount, 0);
  if (planned > 0) return Math.floor(planned);
  return skill === "reading" ? 5 : 10;
}

function progressStats(s: RoadmapSet | null) {
  const p = (s as any)?.progress ?? {};
  const total = asNum(p.total, Array.isArray((s as any)?.questionIds) ? (s as any).questionIds.length : 0);
  const mastered = Array.isArray(p.mastered) ? p.mastered.length : 0;
  const attempts = asNum(p.attempts, 0);
  const finished = !!p.finishedAt || (total > 0 && mastered >= total);
  return { total, mastered, attempts, finished };
}

function getSetSeq(setObj: RoadmapSet): number {
  const setId = String((setObj as any)?.setId ?? "");
  const m = setId.match(/_(\d+)$/);
  return m ? Number(m[1]) : 0;
}

function getDaySets(day: RoadmapDay | null): RoadmapSet[] {
  if (!day) return [];
  const sets = Array.isArray((day as any)?.sets) ? ((day as any).sets as RoadmapSet[]) : [];
  return sets.filter(isPracticeSet);
}

function getSkillSets(day: RoadmapDay | null, skill: Skill): RoadmapSet[] {
  return getDaySets(day)
    .filter((s) => resolveSetSkill(day as RoadmapDay, s) === skill)
    .sort((a, b) => getSetSeq(a) - getSetSeq(b));
}

function getSkillSummary(day: RoadmapDay | null, skill: Skill) {
  const sets = getSkillSets(day, skill);
  const completed = sets.filter((s) => progressStats(s).finished).length;
  const totalQuestions = sets.reduce((acc, s) => acc + plannedCountForSet(s, skill), 0);
  return {
    sets,
    plannedSets: sets.length,
    completedSets: completed,
    totalQuestions,
  };
}

function getDailyQueue(day: RoadmapDay | null): RoadmapSet[] {
  return getDaySets(day).slice();
}

function firstIncompleteSet(sets: RoadmapSet[]): RoadmapSet | null {
  return sets.find((s) => !progressStats(s).finished) ?? null;
}

function formatSetDisplayName(setObj: RoadmapSet) {
  const setId = String((setObj as any)?.setId ?? "");
  const skill = inferSkillFromSetId(setId);
  const seq = getSetSeq(setObj);
  if (!skill || !seq) return setId;
  return `${skillLabel(skill)} Set ${seq}`;
}

function parseDayParam(v: string | null) {
  const n = Number(v ?? "1");
  if (!Number.isFinite(n)) return 1;
  return Math.max(1, Math.min(7, Math.floor(n)));
}

function estimatedMinutesForDay(day: RoadmapDay | null) {
  if (!day) return "—";
  const sets = getDaySets(day);
  let min = 0;
  let max = 0;
  for (const s of sets) {
    const sid = String((s as any)?.setId ?? "");
    if (sid.startsWith("reading_")) {
      min += 5;
      max += 7;
    } else {
      min += 4;
      max += 6;
    }
  }
  return `${min}-${max} min`;
}

function setActionLabel(st: { finished: boolean; attempts: number; mastered: number }) {
  if (st.finished) return "Retry set →";
  if (st.attempts > 0 || st.mastered > 0) return "Continue set →";
  return "Start set →";
}

// ---------------- page ----------------

export default function PracticeSessionPage() {
  const router = useRouter();
  const sp = useSearchParams();

  const dayParam = parseDayParam(sp.get("day"));
  const skillParamRaw = sp.get("skill");
  const skillParam = isSkill(skillParamRaw) ? skillParamRaw : null;

  const [mounted, setMounted] = useState(false);
  const [week, setWeek] = useState<RoadmapWeekV1 | null>(null);

  useEffect(() => {
    setMounted(true);
    setWeek(readActiveWeek());
  }, []);

  const day = useMemo(() => {
    if (!week) return null;
    return week.days.find((d) => Number((d as any)?.dayIndex ?? d.dayIndex) === dayParam) ?? null;
  }, [week, dayParam]);

  const goalLevel = (((week as any)?.goalLevel ?? "N5") as JLPTLevel) ?? "N5";

  const dailyQueue = useMemo(() => getDailyQueue(day), [day]);
  const nextDailySet = useMemo(() => firstIncompleteSet(dailyQueue), [dailyQueue]);

  const vocabSummary = useMemo(() => getSkillSummary(day, "vocab"), [day]);
  const grammarSummary = useMemo(() => getSkillSummary(day, "grammar"), [day]);
  const readingSummary = useMemo(() => getSkillSummary(day, "reading"), [day]);

  const selectedSkillSets = useMemo(
    () => (skillParam && day ? getSkillSets(day, skillParam) : []),
    [day, skillParam]
  );

  const selectedSkillSummary = useMemo(() => {
    if (!skillParam) return null;
    const sets = selectedSkillSets;
    const completed = sets.filter((s) => progressStats(s).finished).length;
    return {
      planned: sets.length,
      done: completed,
      next: firstIncompleteSet(sets),
      totalQuestions: sets.reduce((acc, s) => acc + plannedCountForSet(s, skillParam), 0),
    };
  }, [selectedSkillSets, skillParam]);

  if (!mounted) {
    return (
      <main style={pageWrap}>
        <div style={container}>
          <SoftCard>
            <div style={{ fontWeight: 950 }}>Practice Session</div>
            <div style={{ marginTop: 6, fontSize: 13, opacity: 0.75 }}>Loading…</div>
          </SoftCard>
        </div>
      </main>
    );
  }

  if (!week) {
    return (
      <main style={pageWrap}>
        <div style={container}>
          <SoftCard>
            <div style={{ fontWeight: 950, fontSize: 16 }}>Roadmap not found</div>
            <div style={{ marginTop: 8, fontSize: 13, opacity: 0.75 }}>
              Practice plan is not ready yet. Run Diagnostic (or regenerate roadmap) first.
            </div>
            <div
              style={{
                marginTop: 14,
                display: "grid",
                gap: 12,
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              }}
            >
              <PrimaryBtn onClick={() => router.replace("/diagnostic")}>Run Diagnostic →</PrimaryBtn>
              <GhostBtn onClick={() => router.replace("/practice")}>Back to Practice →</GhostBtn>
            </div>
          </SoftCard>
        </div>
      </main>
    );
  }

  if (!day) {
    return (
      <main style={pageWrap}>
        <div style={container}>
          <SoftCard>
            <div style={{ fontWeight: 950, fontSize: 16 }}>Day not found</div>
            <div style={{ marginTop: 8, fontSize: 13, opacity: 0.75 }}>
              day={dayParam} is not available in the current roadmap.
            </div>
            <div style={{ marginTop: 14 }}>
              <PrimaryBtn onClick={() => router.replace("/practice")}>Back to Practice →</PrimaryBtn>
            </div>
          </SoftCard>
        </div>
      </main>
    );
  }

  const isDay7 =
    Number((day as any)?.dayIndex ?? day.dayIndex) === 7 ||
    !!(day as any)?.weeklyCheckOnly ||
    !!(day as any)?.isWeeklyCheckDay;

  if (isDay7) {
    return (
      <main style={pageWrap}>
        <div style={container}>
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
              <div style={{ marginTop: 6, fontSize: 13, opacity: 0.75 }}>
                Day {day.dayIndex} · Weekly Check day
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <Link href="/practice" style={{ color: "white", textDecoration: "none", opacity: 0.85 }}>
                ← Practice
              </Link>
              <Pill>week {(week as any)?.weekId ?? "—"}</Pill>
              <Pill>goal {goalLevel}</Pill>
            </div>
          </div>

          <div style={{ marginTop: 12 }}>
            <SoftCard>
              <div style={{ fontWeight: 950, fontSize: 20 }}>Day 7 is Weekly Check only</div>
              <div style={{ marginTop: 8, fontSize: 13, opacity: 0.8 }}>
                通常の practice sets はありません。Weekly Check（V/G/R 各10問）を実施してください。
              </div>

              <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
                <Pill>V 10</Pill>
                <Pill>G 10</Pill>
                <Pill>R 10</Pill>
                <Pill>Skill-based promotion</Pill>
              </div>

              <div
                style={{
                  marginTop: 14,
                  display: "grid",
                  gap: 12,
                  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                }}
              >
                <PrimaryBtn onClick={() => router.replace("/practice/weekly-check")}>
                  Go to Weekly Check →
                </PrimaryBtn>
                <GhostBtn onClick={() => router.replace("/practice")}>Back to Practice →</GhostBtn>
              </div>
            </SoftCard>
          </div>
        </div>
      </main>
    );
  }

  // ---------- B flow: Skill Set List ----------
  if (skillParam) {
    const done = selectedSkillSummary?.done ?? 0;
    const planned = selectedSkillSummary?.planned ?? 0;
    const pct = planned > 0 ? Math.round((done / planned) * 100) : 0;

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
              <div style={{ fontSize: 28, fontWeight: 950 }}>
                {skillEmoji(skillParam)} {skillLabel(skillParam)} Sets
              </div>
              <div style={{ marginTop: 6, fontSize: 13, opacity: 0.75 }}>
                Day {day.dayIndex} · {(week as any)?.weekId ?? "—"} · level {goalLevel}
              </div>
            </div>

            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <Link
                href={`/practice/session?day=${encodeURIComponent(String(day.dayIndex))}`}
                style={{ color: "white", textDecoration: "none", opacity: 0.85 }}
              >
                ← Day Hub
              </Link>
              <Pill>{skillLabel(skillParam)}</Pill>
              <Pill>
                {done}/{planned} sets
              </Pill>
              <Pill>{selectedSkillSummary?.totalQuestions ?? 0} questions</Pill>
            </div>
          </div>

          {/* Summary */}
          <div style={{ marginTop: 12 }}>
            <SoftCard>
              <div style={{ fontWeight: 950, fontSize: 16 }}>Skill Progress</div>
              <div style={{ marginTop: 10 }}>
                <ProgressBar pct={pct} />
                <div style={{ marginTop: 8, fontSize: 12, opacity: 0.75 }}>
                  {done}/{planned} sets completed ({pct}%)
                </div>
              </div>

              <div
                style={{
                  marginTop: 14,
                  display: "grid",
                  gap: 12,
                  gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                }}
              >
                <PrimaryBtn
                  onClick={() => {
                    const next = selectedSkillSummary?.next ?? selectedSkillSets[0];
                    if (!next) return;
                    const setId = String((next as any)?.setId ?? "");
                    router.replace(
                      `/practice/vgr/session?day=${encodeURIComponent(
                        String(day.dayIndex)
                      )}&skill=${encodeURIComponent(skillParam)}&set=${encodeURIComponent(setId)}`
                    );
                  }}
                  disabled={selectedSkillSets.length === 0}
                >
                  {selectedSkillSummary?.next ? "Start next set →" : "Start first set →"}
                </PrimaryBtn>

                <GhostBtn
                  onClick={() =>
                    router.replace(`/practice/session?day=${encodeURIComponent(String(day.dayIndex))}`)
                  }
                >
                  Back to Day Hub →
                </GhostBtn>
              </div>
            </SoftCard>
          </div>

          {/* Set list */}
          <div style={{ marginTop: 12, display: "grid", gap: 12 }}>
            {selectedSkillSets.length === 0 ? (
              <SoftCard>
                <div style={{ fontWeight: 950, fontSize: 16 }}>No sets found</div>
                <div style={{ marginTop: 8, fontSize: 13, opacity: 0.75 }}>
                  {skillLabel(skillParam)} sets are not generated for this day.
                </div>
                <div style={{ marginTop: 14 }}>
                  <GhostBtn
                    onClick={() =>
                      router.replace(`/practice/session?day=${encodeURIComponent(String(day.dayIndex))}`)
                    }
                  >
                    Back to Day Hub →
                  </GhostBtn>
                </div>
              </SoftCard>
            ) : (
              selectedSkillSets.map((setObj, idx) => {
                const setId = String((setObj as any)?.setId ?? `set_${idx + 1}`);
                const st = progressStats(setObj);
                const total = st.total || plannedCountForSet(setObj, skillParam);
                const pct = total > 0 ? Math.round((st.mastered / total) * 100) : 0;
                const statusLabel = st.finished
                  ? "✅ completed"
                  : st.attempts > 0 || st.mastered > 0
                  ? "🕒 in progress"
                  : "○ not started";

                return (
                  <SoftCard key={setId}>
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
                        <div style={{ fontSize: 17, fontWeight: 950 }}>{formatSetDisplayName(setObj)}</div>
                        <div style={{ marginTop: 6, fontSize: 12, opacity: 0.75 }}>
                          {setId} · {plannedCountForSet(setObj, skillParam)} questions
                        </div>
                      </div>

                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <Pill>level {resolveSetLevel(week, day, setObj)}</Pill>
                        <Pill>
                          mastered {st.mastered}/{total}
                        </Pill>
                        <Pill>{statusLabel}</Pill>
                      </div>
                    </div>

                    <div style={{ marginTop: 12 }}>
                      <ProgressBar pct={pct} />
                      <div style={{ marginTop: 6, fontSize: 12, opacity: 0.7 }}>
                        progress {pct}% · attempts {st.attempts}
                      </div>
                    </div>

                    <div style={{ marginTop: 14 }}>
                      <PrimaryBtn
                        onClick={() =>
                          router.replace(
                            `/practice/vgr/session?day=${encodeURIComponent(
                              String(day.dayIndex)
                            )}&skill=${encodeURIComponent(skillParam)}&set=${encodeURIComponent(setId)}`
                          )
                        }
                      >
                        {setActionLabel(st)}
                      </PrimaryBtn>
                    </div>
                  </SoftCard>
                );
              })
            )}
          </div>
        </div>
      </main>
    );
  }

  // ---------- Day Session Hub (B flow entry) ----------
  const queuePreview = dailyQueue.slice(0, 9);
  const doneDailySets = dailyQueue.filter((s) => progressStats(s).finished).length;
  const totalDailySets = dailyQueue.length;
  const dailyPct = totalDailySets > 0 ? Math.round((doneDailySets / totalDailySets) * 100) : 0;

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
            <div style={{ fontSize: 28, fontWeight: 950 }}>Practice Session</div>
            <div style={{ marginTop: 6, fontSize: 13, opacity: 0.75 }}>
              Day {day.dayIndex} · {(week as any)?.weekId ?? todayISO()} · goal {goalLevel}
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <Link href="/practice" style={{ color: "white", textDecoration: "none", opacity: 0.85 }}>
              ← Practice
            </Link>
            <Pill>day {day.dayIndex}</Pill>
            <Pill>level {goalLevel}</Pill>
            <Pill>{estimatedMinutesForDay(day)}</Pill>
          </div>
        </div>

        {/* Today plan summary */}
        <div style={{ marginTop: 12 }}>
          <SoftCard>
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
                <div style={{ fontWeight: 950, fontSize: 18 }}>Today’s mission</div>
                <div style={{ marginTop: 6, fontSize: 13, opacity: 0.8 }}>
                  Choose a skill to open sets, or start the recommended daily queue.
                </div>
              </div>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <Pill>V {vocabSummary.plannedSets}</Pill>
                <Pill>G {grammarSummary.plannedSets}</Pill>
                <Pill>R {readingSummary.plannedSets}</Pill>
                <Pill>total {totalDailySets} sets</Pill>
              </div>
            </div>

            <div style={{ marginTop: 12 }}>
              <ProgressBar pct={dailyPct} />
              <div style={{ marginTop: 8, fontSize: 12, opacity: 0.75 }}>
                Daily progress {doneDailySets}/{totalDailySets} sets completed
              </div>
            </div>

            <div
              style={{
                marginTop: 14,
                display: "grid",
                gap: 12,
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              }}
            >
              <PrimaryBtn
                onClick={() => {
                  const target = nextDailySet ?? dailyQueue[0];
                  if (!target) return;
                  const setId = String((target as any)?.setId ?? "");
                  const skill = inferSkillFromSetId(setId) ?? "vocab";
                  router.replace(
                    `/practice/vgr/session?day=${encodeURIComponent(
                      String(day.dayIndex)
                    )}&skill=${encodeURIComponent(skill)}&set=${encodeURIComponent(setId)}`
                  );
                }}
                disabled={dailyQueue.length === 0}
              >
                {nextDailySet ? "Continue daily practice →" : "Start daily practice →"}
              </PrimaryBtn>

              <GhostBtn onClick={() => router.replace(`/practice/pick?day=${encodeURIComponent(String(day.dayIndex))}`)}>
                View all sets (legacy list) →
              </GhostBtn>
            </div>
          </SoftCard>
        </div>

        {/* Skill cards */}
        <div
          style={{
            marginTop: 12,
            display: "grid",
            gap: 12,
            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
          }}
        >
          {([
            ["vocab", vocabSummary],
            ["grammar", grammarSummary],
            ["reading", readingSummary],
          ] as const).map(([skill, summary]) => {
            const pct = summary.plannedSets > 0 ? Math.round((summary.completedSets / summary.plannedSets) * 100) : 0;
            const nextSet = firstIncompleteSet(summary.sets);
            const questionUnit = skill === "reading" ? 5 : 10;

            return (
              <SoftCard key={skill}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 10,
                    alignItems: "center",
                    flexWrap: "wrap",
                  }}
                >
                  <div style={{ fontWeight: 950, fontSize: 16 }}>
                    {skillEmoji(skill)} {skillLabel(skill)}
                  </div>
                  <Pill>{summary.plannedSets} sets</Pill>
                </div>

                <div style={{ marginTop: 10, fontSize: 13, lineHeight: 1.6, opacity: 0.86 }}>
                  <div>Level: {goalLevel}</div>
                  <div>
                    Questions: {summary.totalQuestions} ({questionUnit} × {summary.plannedSets})
                  </div>
                  <div>
                    Progress: {summary.completedSets}/{summary.plannedSets} sets
                  </div>
                </div>

                <div style={{ marginTop: 10 }}>
                  <ProgressBar pct={pct} />
                </div>

                <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
                  <PrimaryBtn
                    onClick={() =>
                      router.replace(
                        `/practice/session?day=${encodeURIComponent(String(day.dayIndex))}&skill=${encodeURIComponent(
                          skill
                        )}`
                      )
                    }
                    disabled={summary.plannedSets === 0}
                  >
                    Open {skillLabel(skill)} sets →
                  </PrimaryBtn>

                  {nextSet ? (
                    <GhostBtn
                      onClick={() => {
                        const setId = String((nextSet as any)?.setId ?? "");
                        router.replace(
                          `/practice/vgr/session?day=${encodeURIComponent(
                            String(day.dayIndex)
                          )}&skill=${encodeURIComponent(skill)}&set=${encodeURIComponent(setId)}`
                        );
                      }}
                    >
                      Quick start next set →
                    </GhostBtn>
                  ) : (
                    <GhostBtn disabled onClick={() => {}}>
                      All sets completed
                    </GhostBtn>
                  )}
                </div>
              </SoftCard>
            );
          })}
        </div>

        {/* Queue preview */}
        <div style={{ marginTop: 12 }}>
          <SoftCard>
            <div style={{ fontWeight: 950, fontSize: 16 }}>Recommended queue (preview)</div>
            <div style={{ marginTop: 8, fontSize: 13, opacity: 0.78 }}>
              You can start by skill, but this is the suggested order for the day.
            </div>

            <div style={{ marginTop: 12, display: "flex", gap: 8, flexWrap: "wrap" }}>
              {queuePreview.length === 0 ? (
                <div style={{ fontSize: 13, opacity: 0.75 }}>No queue available.</div>
              ) : (
                queuePreview.map((s, i) => {
                  const setId = String((s as any)?.setId ?? "");
                  const st = progressStats(s);
                  const skill = inferSkillFromSetId(setId);
                  return (
                    <Pill key={`${setId}_${i}`}>
                      {i + 1}. {skill ? skillLabel(skill) : "Set"} #{getSetSeq(s)} {st.finished ? "✅" : ""}
                    </Pill>
                  );
                })
              )}
            </div>
          </SoftCard>
        </div>
      </div>
    </main>
  );
}