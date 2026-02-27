// app/_lib/diagnosticPhase2.ts
import { DIAGNOSTIC_BANK } from "@/_lib/diagnosticBank";
import type { JLPTLevel } from "@/_lib/diagnosticPhase1";

export const DIAG_PHASE2_KEY = "lexio.diag.phase2.v1";

export type Skill = "vocab" | "grammar" | "reading";

export type BankQuestion = {
  id: string;
  level: JLPTLevel;
  phase: "phase1" | "phase2" | "weekly";
  skill: Skill;
  prompt: string;
  choices: [string, string, string, string];
  correct: 0 | 1 | 2 | 3;
};

export type Phase2Result = {
  version: 1;
  finishedAtISO: string;
  level: JLPTLevel;
  answers: Record<
    string,
    { pickedIndex: 0 | 1 | 2 | 3; correct: boolean; skill: Skill }
  >;
  bySkill: Record<Skill, { correct: number; total: number; rate: number }>;
  weakestSkills: Skill[]; // 1つ or 同率なら複数
};

// diagnosticBank.ts が Question[] の型を持ってても、ここでは必要最小限だけ合わせる
function isBankQuestion(x: any): x is BankQuestion {
  return (
    x &&
    typeof x.id === "string" &&
    (x.level === "N5" || x.level === "N4" || x.level === "N3" || x.level === "N2" || x.level === "N1") &&
    (x.phase === "phase1" || x.phase === "phase2" || x.phase === "weekly") &&
    (x.skill === "vocab" || x.skill === "grammar" || x.skill === "reading") &&
    typeof x.prompt === "string" &&
    Array.isArray(x.choices) &&
    x.choices.length === 4 &&
    typeof x.correct === "number"
  );
}

/**
 * Phase2: そのレベルの phase2 問題を 9問（vocab/grammar/reading 各3問）取得
 * - bank に 9問入ってる前提（あなたの設計通り）
 * - 足りない/偏りがある場合も落ちないように堅牢化（恒久対応）
 */
export function getPhase2Questions(level: JLPTLevel): BankQuestion[] {
  const pool = (DIAGNOSTIC_BANK as any[])
    .filter(isBankQuestion)
    .filter((q) => q.phase === "phase2" && q.level === level);

  const bySkill: Record<Skill, BankQuestion[]> = {
    vocab: pool.filter((q) => q.skill === "vocab"),
    grammar: pool.filter((q) => q.skill === "grammar"),
    reading: pool.filter((q) => q.skill === "reading"),
  };

  const picked: BankQuestion[] = [];
  (["vocab", "grammar", "reading"] as const).forEach((s) => {
    picked.push(...bySkill[s].slice(0, 3));
  });

  // もし bank の構成が崩れても 9問に寄せる（その場しのぎではなく“壊れない”防御）
  if (picked.length < 9) {
    const rest = pool.filter((q) => !picked.some((p) => p.id === q.id));
    picked.push(...rest.slice(0, 9 - picked.length));
  }
  return picked.slice(0, 9);
}

export function computePhase2Result(
  level: JLPTLevel,
  questions: BankQuestion[],
  answers: Record<string, 0 | 1 | 2 | 3>
): Phase2Result {
  const bySkill: Phase2Result["bySkill"] = {
    vocab: { correct: 0, total: 0, rate: 0 },
    grammar: { correct: 0, total: 0, rate: 0 },
    reading: { correct: 0, total: 0, rate: 0 },
  };

  const detail: Phase2Result["answers"] = {};

  for (const q of questions) {
    const pickedIndex: 0 | 1 | 2 | 3 = (answers[q.id] ?? 0) as any;
    const correct = pickedIndex === q.correct;

    detail[q.id] = { pickedIndex, correct, skill: q.skill };

    bySkill[q.skill].total += 1;
    if (correct) bySkill[q.skill].correct += 1;
  }

  (["vocab", "grammar", "reading"] as const).forEach((s) => {
    const t = bySkill[s].total || 1;
    bySkill[s].rate = Math.round((bySkill[s].correct / t) * 1000) / 10; // 1 decimal
  });

  // weakest = 最低正答率（同率なら複数）
  const minRate = Math.min(bySkill.vocab.rate, bySkill.grammar.rate, bySkill.reading.rate);
  const weakestSkills = (["vocab", "grammar", "reading"] as const).filter((s) => bySkill[s].rate === minRate);

  return {
    version: 1,
    finishedAtISO: new Date().toISOString(),
    level,
    answers: detail,
    bySkill,
    weakestSkills,
  };
}