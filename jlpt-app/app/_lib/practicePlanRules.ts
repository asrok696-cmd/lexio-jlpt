// app/_lib/practicePlanRules.ts
"use client";

import type { Skill, JLPTLevel } from "@/app/_lib/roadmap";

export type SetCounts = Record<Skill, number>;

/**
 * 練習は 1日あたり合計9セット（Day1-6）
 * Day7 は weekly check 専用のため 0/0/0
 *
 * ※ roadmap.ts から import すると未export時に落ちるので、このファイル内で定数化
 */
export const PRACTICE_SETS_PER_DAY = 9 as const;

/* -----------------------------
 * helpers
 * ----------------------------*/

function uniqSkills(xs: unknown): Skill[] {
  if (!Array.isArray(xs)) return [];
  const out: Skill[] = [];
  for (const x of xs) {
    if (x === "vocab" || x === "grammar" || x === "reading") {
      if (!out.includes(x)) out.push(x);
    }
  }
  return out;
}

function levelRank(lv: JLPTLevel) {
  // N5 easiest -> 1, N1 hardest -> 5
  return lv === "N5" ? 1 : lv === "N4" ? 2 : lv === "N3" ? 3 : lv === "N2" ? 4 : 5;
}

function prevLevel(lv: JLPTLevel): JLPTLevel {
  if (lv === "N1") return "N2";
  if (lv === "N2") return "N3";
  if (lv === "N3") return "N4";
  if (lv === "N4") return "N5";
  return "N5";
}

function allSkillsSameLevel(level: JLPTLevel): Record<Skill, JLPTLevel> {
  return {
    vocab: level,
    grammar: level,
    reading: level,
  };
}

/* -----------------------------
 * 1) practice level decision (UNIFIED)
 * ----------------------------*/

/**
 * ✅ 診断(base) と 目標(goal) から「今週やる練習レベル（統一）」を決める
 *
 * あなたの最終仕様（統一級）:
 * - base なし: goal
 * - base >= goal: goal（上限キャップ）
 * - base < goal:
 *   - 差1: goal
 *   - 差2以上: goalの1つ下（= 常に1段上から開始の考え方）
 *
 * 例:
 * - goal N3 / base N4 -> N3
 * - goal N3 / base N5 -> N4
 * - goal N3 / base N3 -> N3
 * - goal N3 / base N2 -> N3（目標より上でも目標級に揃える）
 */
export function decidePracticeLevel(base: JLPTLevel | null | undefined, goal: JLPTLevel): JLPTLevel {
  if (!base) return goal;

  const b = levelRank(base);
  const g = levelRank(goal);

  // 現状が目標以上（難しい級）なら、練習は目標級で統一
  if (b >= g) return goal;

  const diff = g - b;

  // 1段差なら目標級で開始（例: base N4, goal N3 => N3）
  if (diff === 1) return goal;

  // 2段差以上なら目標の1つ下から（例: base N5, goal N3 => N4）
  return prevLevel(goal);
}

/**
 * 互換API（過去コードが呼んでいても落ちないように残す）
 * ※ 実態は「統一級」を3skillへ展開するだけ
 */
export function decidePracticeLevelBySkill(params: {
  baseLevel?: JLPTLevel | null;
  baseLevelBySkill?: Partial<Record<Skill, JLPTLevel | null>>; // 無視（将来用）
  goalLevel: JLPTLevel;
}): Record<Skill, JLPTLevel> {
  const unified = decidePracticeLevel(params.baseLevel ?? null, params.goalLevel);
  return allSkillsSameLevel(unified);
}

/* -----------------------------
 * 2) weekly set allocation
 * ----------------------------*/

/**
 * ✅ 9セット配分（あなたの仕様）
 * - weakest 1つ: 5/2/2
 * - weakest 2つ: 非weak=2固定、weak2つは 4/3 を日替わり交互
 *   - Day1: 最弱点=4, 2番弱点=3（入力順を尊重）
 *   - Day2: 最弱点=3, 2番弱点=4
 *   - ...
 * - weakest 0 or 3: 3/3/3
 * - day7: 0/0/0（weekly-check専用）
 *
 * 判定自体（弱点1個/2個/階段状など）は upstream 側で行い、
 * この関数は「渡された weakestSkills の並び順」をそのまま使う。
 */
export function buildWeeklySetCounts(weakestSkillsRaw: Skill[]): SetCounts[] {
  const weakest = uniqSkills(weakestSkillsRaw);
  const skills: Skill[] = ["vocab", "grammar", "reading"];

  const days: SetCounts[] = Array.from({ length: 7 }).map((_, i) => {
    const dayIndex = i + 1;

    // Day7 = weekly check only
    if (dayIndex === 7) return { vocab: 0, grammar: 0, reading: 0 };

    // weakest 0 or 3 -> 3/3/3
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

    // weakest 2 -> fixed=2, weak2つは 4/3 交互
    const wA = weakest[0]; // Day1 はこちらを4（最弱点）
    const wB = weakest[1]; // Day1 はこちらを3（2番弱点）
    const fixed = skills.find((s) => s !== wA && s !== wB) ?? "vocab";

    const isEvenDay = dayIndex % 2 === 0; // Day1=false, Day2=true ...
    const a = isEvenDay ? 3 : 4;
    const b = isEvenDay ? 4 : 3;

    const out: SetCounts = { vocab: 0, grammar: 0, reading: 0 };
    out[fixed] = 2;
    out[wA] = a;
    out[wB] = b;

    // safety: 合計9に微調整（念のため）
    const total = out.vocab + out.grammar + out.reading;
    if (total !== PRACTICE_SETS_PER_DAY) {
      const diff = PRACTICE_SETS_PER_DAY - total;
      out[wA] = Math.max(0, out[wA] + diff);
    }

    return out;
  });

  return days;
}

/* -----------------------------
 * 3) まとめて“今週の方針”を決める
 * ----------------------------*/

export type DiagnosticSummary = {
  baseLevel?: JLPTLevel | null; // 診断推定級（Phase1）
  goalLevel: JLPTLevel; // 目標級（Phase0）
  weakestSkills?: Skill[]; // Phase2の弱点順（0〜3, 並び順を尊重）
  baseLevelBySkill?: Partial<Record<Skill, JLPTLevel | null>>; // 将来用（現状は未使用）
};

export type WeeklyPracticePolicy = {
  /**
   * ✅ 最終仕様: 練習級は統一
   */
  practiceLevel: JLPTLevel;

  /**
   * 互換用: 既存コードが skill別参照していても同じ級を返す
   */
  practiceLevelBySkill: Record<Skill, JLPTLevel>;

  /**
   * 7日分（day7は0/0/0）
   */
  weekCounts: SetCounts[];
};

/**
 * ✅ 診断結果から「今週の練習ポリシー」を確定する（1週目用）
 * - 練習級は統一
 * - 配分は weakestSkills の順序に従って 5/2/2 or 4/3/2 交互 etc.
 */
export function decideWeeklyPracticePolicyFromDiagnostic(diag: DiagnosticSummary): WeeklyPracticePolicy {
  const practiceLevel = decidePracticeLevel(diag.baseLevel ?? null, diag.goalLevel);
  const practiceLevelBySkill = allSkillsSameLevel(practiceLevel);
  const weekCounts = buildWeeklySetCounts((diag.weakestSkills ?? []) as Skill[]);

  return {
    practiceLevel,
    practiceLevelBySkill, // 互換
    weekCounts,
  };
}