// app/_lib/mockEngine.ts
export type Skill = "vocab" | "grammar" | "reading";
export type JLPTLevel = "N5" | "N4" | "N3" | "N2" | "N1";

export type MockQuestion = {
  id: string;
  skill: Skill;
  prompt: string;
  choices: string[];
  answerIndex: number;
  explanation?: string;
};

export type MockPaperV1 = {
  version: 1;
  level: JLPTLevel;
  slot: number;
  title: string;
  timeLimitSec: number; // e.g. 1800 = 30min
  questions: MockQuestion[];

  /**
   * OPTIONAL (policy fields; can be included in JSON)
   * - overall pass threshold (percent)
   * - per-skill minimum threshold (percent)
   */
  passPercent?: number; // default 60
  minSkillPercent?: number; // default 40
};

export type MockAnswerMap = Record<string, number>; // qid -> chosen index

export type MockResultV1 = {
  version: 1;
  id: string; // run id
  level: JLPTLevel;
  slot: number;
  title: string;

  startedAtISO: string;
  finishedAtISO: string;

  timeLimitSec: number;
  timeSpentSec: number;

  totalQ: number;
  correctQ: number;
  accuracy: number; // 0..100

  bySkill: Record<Skill, { totalQ: number; correctQ: number; accuracy: number }>;

  // ✅ product-level fields for Result UI
  percent: number; // alias of accuracy (0..100)
  pass: boolean;
  passRule: { totalPassPct: number; minSkillPct: number };
  bySkillPercent: Record<Skill, number>;

  /**
   * ✅ compat fields (so older UI that expects "total" + flat bySkill can still work)
   * - total: same as percent
   * - bySkillFlat: same scale as percent (0..100 per skill)
   */
  total: number;
  bySkillFlat: Record<Skill, number>;

  // for review
  answers: Array<{
    qid: string;
    skill: Skill;
    chosenIndex: number;
    correctIndex: number;
    correct: boolean;
  }>;
};

export function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export function runId() {
  return `run_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export function calcResult(args: {
  paper: MockPaperV1;
  answers: MockAnswerMap;
  startedAtISO: string;
  finishedAtISO: string;
  timeSpentSec: number;
}): MockResultV1 {
  const { paper, answers, startedAtISO, finishedAtISO, timeSpentSec } = args;

  let correctQ = 0;

  const bySkill: Record<Skill, { totalQ: number; correctQ: number; accuracy: number }> = {
    vocab: { totalQ: 0, correctQ: 0, accuracy: 0 },
    grammar: { totalQ: 0, correctQ: 0, accuracy: 0 },
    reading: { totalQ: 0, correctQ: 0, accuracy: 0 },
  };

  const answerRows: MockResultV1["answers"] = [];

  for (const q of paper.questions) {
    const chosenIndex = typeof answers[q.id] === "number" ? (answers[q.id] as number) : -1;
    const isCorrect = chosenIndex === q.answerIndex;

    bySkill[q.skill].totalQ += 1;
    if (isCorrect) bySkill[q.skill].correctQ += 1;

    if (isCorrect) correctQ += 1;

    answerRows.push({
      qid: q.id,
      skill: q.skill,
      chosenIndex,
      correctIndex: q.answerIndex,
      correct: isCorrect,
    });
  }

  (["vocab", "grammar", "reading"] as Skill[]).forEach((s) => {
    const t = bySkill[s].totalQ;
    const c = bySkill[s].correctQ;
    bySkill[s].accuracy = t <= 0 ? 0 : Math.round((c / t) * 100);
  });

  const totalQ = paper.questions.length;
  const accuracy = totalQ <= 0 ? 0 : Math.round((correctQ / totalQ) * 100);

  // ✅ pass/fail rules (paper can override)
  const totalPassPct = clamp(Math.round(Number((paper as any)?.passPercent ?? 60)), 0, 100);
  const minSkillPct = clamp(Math.round(Number((paper as any)?.minSkillPercent ?? 40)), 0, 100);

  const bySkillPercent: Record<Skill, number> = {
    vocab: bySkill.vocab.accuracy,
    grammar: bySkill.grammar.accuracy,
    reading: bySkill.reading.accuracy,
  };

  // ✅ percent used by UI (0..100)
  const percent = clamp(accuracy, 0, 100);

  // ✅ PASS: overall + per-skill cutline
  // If some skill has 0 questions, we ignore that skill in cutline check.
  const pass =
    percent >= totalPassPct &&
    (["vocab", "grammar", "reading"] as Skill[]).every((s) => {
      const t = bySkill[s].totalQ;
      if (t <= 0) return true;
      return bySkillPercent[s] >= minSkillPct;
    });

  // ✅ compat: flat scores
  const bySkillFlat: Record<Skill, number> = { ...bySkillPercent };
  const total = percent;

  return {
    version: 1,
    id: runId(),
    level: paper.level,
    slot: paper.slot,
    title: paper.title,
    startedAtISO,
    finishedAtISO,
    timeLimitSec: paper.timeLimitSec,
    timeSpentSec: clamp(Math.round(timeSpentSec), 0, 365 * 24 * 3600),
    totalQ,
    correctQ,
    accuracy,
    bySkill,

    // product fields
    percent,
    pass,
    passRule: { totalPassPct, minSkillPct },
    bySkillPercent,

    // compat fields
    total,
    bySkillFlat,

    answers: answerRows,
  };
}

export function fmtSec(sec: number) {
  const s = Math.max(0, Math.floor(sec));
  const mm = String(Math.floor(s / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

export function safeParsePaper(x: any): MockPaperV1 | null {
  try {
    if (!x || x.version !== 1) return null;
    if (!x.level || !x.slot || !Array.isArray(x.questions)) return null;
    if (typeof x.timeLimitSec !== "number") return null;

    // minimal validation
    for (const q of x.questions) {
      if (!q?.id || !q?.skill || !q?.prompt) return null;
      if (!Array.isArray(q.choices) || typeof q.answerIndex !== "number") return null;
    }

    // optional rules sanity
    if (x.passPercent != null && typeof x.passPercent !== "number") return null;
    if (x.minSkillPercent != null && typeof x.minSkillPercent !== "number") return null;

    return x as MockPaperV1;
  } catch {
    return null;
  }
}