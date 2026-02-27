// app/_lib/diagnosticRules.ts
"use client";

export type Skill = "vocab" | "grammar" | "reading";
export type JLPTLevel = "N5" | "N4" | "N3" | "N2" | "N1";

export type SetCounts = Record<Skill, number>;

export type Step1Input = {
  baseLevel: JLPTLevel | null;
  goalLevel: JLPTLevel;
  weakestSkills: unknown; // 外部入力は信用しない
};

export type Step1Output = {
  practiceLevel: JLPTLevel;
  weekCounts: SetCounts[]; // length=7
  weakest: Skill[];        // 正規化済み（0..3）
};

// --------------------
// helpers (normalize)
// --------------------
function isSkill(x: any): x is Skill {
  return x === "vocab" || x === "grammar" || x === "reading";
}

function uniqSkills(xs: unknown): Skill[] {
  if (!Array.isArray(xs)) return [];
  const out: Skill[] = [];
  for (const x of xs) {
    if (isSkill(x) && !out.includes(x)) out.push(x);
  }
  return out;
}

function levelRank(lv: JLPTLevel) {
  return lv === "N5" ? 1 : lv === "N4" ? 2 : lv === "N3" ? 3 : lv === "N2" ? 4 : 5;
}

function prevLevel(lv: JLPTLevel): JLPTLevel {
  if (lv === "N1") return "N2";
  if (lv === "N2") return "N3";
  if (lv === "N3") return "N4";
  if (lv === "N4") return "N5";
  return "N5";
}

// --------------------
// 1) practice level rule
// --------------------
export function decidePracticeLevel(base: JLPTLevel | null, goal: JLPTLevel): JLPTLevel {
  if (!base) return goal;

  const b = levelRank(base);
  const g = levelRank(goal);

  if (b >= g) return goal;

  const diff = g - b;
  if (diff === 1) return goal;

  return prevLevel(goal);
}

// --------------------
// 2) weekly set allocation (9/day, day7=0)
// --------------------
export const PRACTICE_SETS_PER_DAY = 9;

function zero(): SetCounts {
  return { vocab: 0, grammar: 0, reading: 0 };
}

export function buildWeeklySetCounts(weakestSkillsRaw: unknown): SetCounts[] {
  const weakest = uniqSkills(weakestSkillsRaw);
  const skills: Skill[] = ["vocab", "grammar", "reading"];

  const days: SetCounts[] = Array.from({ length: 7 }).map((_, i) => {
    const dayIndex = i + 1;

    // day7: weekly-check
    if (dayIndex === 7) return zero();

    // weakest 0 or 3
    if (weakest.length === 0 || weakest.length >= 3) {
      return { vocab: 3, grammar: 3, reading: 3 };
    }

    // weakest 1 -> 5/2/2
    if (weakest.length === 1) {
      const w = weakest[0];
      return {
        vocab: w === "vocab" ? 5 : 2,
        grammar: w === "grammar" ? 5 : 2,
        reading: w === "reading" ? 5 : 2,
      };
    }

    // weakest 2 -> fixed=2, others swap 4/3
    const wA = weakest[0];
    const wB = weakest[1];
    const fixed = skills.find((s) => s !== wA && s !== wB) ?? "vocab";

    const swap = dayIndex % 2 === 0; // Day1 false: 4/3, Day2 true: 3/4...
    const a = swap ? 3 : 4;
    const b = swap ? 4 : 3;

    const out: SetCounts = { vocab: 0, grammar: 0, reading: 0 };
    out[fixed] = 2;
    out[wA] = a;
    out[wB] = b;

    // safety: total=9
    const total = out.vocab + out.grammar + out.reading;
    if (total !== PRACTICE_SETS_PER_DAY) {
      const diff = PRACTICE_SETS_PER_DAY - total;
      out[wA] = Math.max(0, out[wA] + diff);
    }

    return out;
  });

  return days;
}

// --------------------
// bundled runner
// --------------------
export function runStep1(input: Step1Input): Step1Output {
  const weakest = uniqSkills(input.weakestSkills);
  const practiceLevel = decidePracticeLevel(input.baseLevel, input.goalLevel);
  const weekCounts = buildWeeklySetCounts(weakest);

  return { practiceLevel, weekCounts, weakest };
}