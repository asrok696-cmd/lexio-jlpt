// app/_lib/diagnostic.ts
// ✅ Engine (logic) only. Question data lives in diagnosticPhase1/diagnosticPhase2.

export type JLPTLevel = "N5" | "N4" | "N3" | "N2" | "N1";
export type Skill = "vocab" | "grammar" | "reading";

export const DIAG_SETTINGS_KEY = "lexio.diag.settings.v1";
export const DIAG_PHASE1_KEY = "lexio.diag.phase1.v1";
export const DIAG_PHASE2_KEY = "lexio.diag.phase2.v1";

// ✅ これが「診断完了」フラグ（middleware/intro側と揃える）
export const DIAG_DONE_COOKIE = "lexio.diag.done.v1";
export const DIAG_DONE_LS = "lexio.diag.done.v1";

export type DiagnosticSettings = {
  examDateISO?: string | null; // optional
  goalLevel: JLPTLevel; // required
  dailyMinutes: 10 | 20 | 30; // required
  updatedAt: string;
};

export type DiagQ = {
  id: string;
  level: JLPTLevel;
  skill: Skill;
  prompt: string;
  choices: string[]; // 4 choices
  correctIndex: number; // ✅ 0..3 (統一)
};

export type PhaseAnswer = {
  qid: string;
  picked: number | null; // null = idk
  correct: boolean;
  isIdk: boolean;
};

export type Phase1Result = {
  finishedAt: string;
  answers: PhaseAnswer[];

  // Phase1 は「級ごと」に集計（例：各級3問）
  byLevelCorrect: Record<JLPTLevel, number>;
  byLevelTotal: Record<JLPTLevel, number>;
  byLevelAcc: Record<JLPTLevel, number>; // 0..100

  estimatedLevel: JLPTLevel;
  idkCount: number;
  thresholdPerLevel: number; // e.g. 2 (meaning 2/3)
};

export type Phase2Result = {
  finishedAt: string;
  level: JLPTLevel;
  answers: PhaseAnswer[];
  bySkillCorrect: Record<Skill, number>;
  bySkillTotal: Record<Skill, number>;
  bySkillAcc: Record<Skill, number>; // 0..100
  weakestSkill: Skill;
  idkCount: number;
};

export const LEVELS: JLPTLevel[] = ["N5", "N4", "N3", "N2", "N1"];
export const SKILLS: Skill[] = ["vocab", "grammar", "reading"];

// =====================================================
// Storage helpers
// =====================================================
export function readJSON<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function writeJSON<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(value));
}

export function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

// client-side cookie helper (introなどで使う用)
export function setCookieOneYear(name: string, value: string) {
  if (typeof document === "undefined") return;
  const maxAge = 60 * 60 * 24 * 365;
  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAge}; SameSite=Lax`;
}

// =====================================================
// Question data imports (single source of truth)
// =====================================================
// ✅ ここが重要：問題はこの2ファイルから引っ張る（ダミーバンク禁止）
import { PHASE1_QUESTIONS } from "./diagnosticPhase1";
import { DIAGNOSTIC_BANK } from "./diagnosticBank";

// =====================================================
// Bank builders (derived, deterministic)
// =====================================================
export function getPhase1Questions(): DiagQ[] {
  // ✅ Phase1は「固定で変えない」方針：順番も固定で返す
  return PHASE1_QUESTIONS.map(normalizeQuestion);
}

export function getPhase2Questions(level: JLPTLevel): DiagQ[] {
  return DIAGNOSTIC_BANK
    .filter((q) => q.phase === "phase2" && q.level === level)
    .map(normalizeQuestion);
}

function normalizeQuestion(q: any): DiagQ {
  // ✅ 互換吸収（correct / correctIndex どっちが来ても correctIndex に統一）
  const correctIndex =
    typeof q.correctIndex === "number"
      ? q.correctIndex
      : typeof q.correct === "number"
        ? q.correct
        : 0;

  return {
    id: String(q.id),
    level: q.level as JLPTLevel,
    skill: q.skill as Skill,
    prompt: String(q.prompt ?? ""),
    choices: Array.isArray(q.choices) ? q.choices.map(String) : [],
    correctIndex,
  };
}

// =====================================================
// Grading
// =====================================================
export function gradeOne(q: DiagQ, picked: number | null) {
  const isIdk = picked === null || picked === undefined;
  const correct = !isIdk && picked === q.correctIndex;
  return { correct, isIdk };
}

// =====================================================
// Phase1 compute (✅ ここが「全問正解でもN5になる」系のバグを潰す要)
// =====================================================
export function computePhase1Result(params: {
  questions: DiagQ[];
  pickedByQid: Record<string, number | null | undefined>; // UI側の状態
  thresholdPerLevel?: number; // default 2
}): Phase1Result {
  const { questions, pickedByQid } = params;
  const thresholdPerLevel = typeof params.thresholdPerLevel === "number" ? params.thresholdPerLevel : 2;

  const byLevelCorrect: Record<JLPTLevel, number> = { N5: 0, N4: 0, N3: 0, N2: 0, N1: 0 };
  const byLevelTotal: Record<JLPTLevel, number> = { N5: 0, N4: 0, N3: 0, N2: 0, N1: 0 };
  const answers: PhaseAnswer[] = [];

  let idkCount = 0;

  for (const q of questions) {
    const picked = pickedByQid[q.id] ?? null;
    const { correct, isIdk } = gradeOne(q, picked);

    answers.push({
      qid: q.id,
      picked: picked === null ? null : picked,
      correct,
      isIdk,
    });

    byLevelTotal[q.level] += 1;
    if (correct) byLevelCorrect[q.level] += 1;
    if (isIdk) idkCount += 1;
  }

  // acc
  const byLevelAcc: Record<JLPTLevel, number> = {
    N5: byLevelTotal.N5 ? Math.round((byLevelCorrect.N5 / byLevelTotal.N5) * 100) : 0,
    N4: byLevelTotal.N4 ? Math.round((byLevelCorrect.N4 / byLevelTotal.N4) * 100) : 0,
    N3: byLevelTotal.N3 ? Math.round((byLevelCorrect.N3 / byLevelTotal.N3) * 100) : 0,
    N2: byLevelTotal.N2 ? Math.round((byLevelCorrect.N2 / byLevelTotal.N2) * 100) : 0,
    N1: byLevelTotal.N1 ? Math.round((byLevelCorrect.N1 / byLevelTotal.N1) * 100) : 0,
  };

  // ✅ 推定級：thresholdを満たす最高レベル
  // ただし「そのレベルの問題が0問なら判定対象外」にする（ここが重要）
  let estimatedLevel: JLPTLevel = "N5";
  for (const lv of LEVELS) {
    if (byLevelTotal[lv] <= 0) continue; // ← 0問なら無視
    if (byLevelCorrect[lv] >= thresholdPerLevel) estimatedLevel = lv;
  }

  return {
    finishedAt: new Date().toISOString(),
    answers,
    byLevelCorrect,
    byLevelTotal,
    byLevelAcc,
    estimatedLevel,
    idkCount,
    thresholdPerLevel,
  };
}

// =====================================================
// Phase2 compute
// =====================================================
export function computePhase2Result(params: {
  level: JLPTLevel;
  questions: DiagQ[];
  pickedByQid: Record<string, number | null | undefined>;
}): Phase2Result {
  const { level, questions, pickedByQid } = params;

  const bySkillCorrect: Record<Skill, number> = { vocab: 0, grammar: 0, reading: 0 };
  const bySkillTotal: Record<Skill, number> = { vocab: 0, grammar: 0, reading: 0 };
  const answers: PhaseAnswer[] = [];
  let idkCount = 0;

  for (const q of questions) {
    const picked = pickedByQid[q.id] ?? null;
    const { correct, isIdk } = gradeOne(q, picked);

    answers.push({
      qid: q.id,
      picked: picked === null ? null : picked,
      correct,
      isIdk,
    });

    bySkillTotal[q.skill] += 1;
    if (correct) bySkillCorrect[q.skill] += 1;
    if (isIdk) idkCount += 1;
  }

  const bySkillAcc: Record<Skill, number> = {
    vocab: bySkillTotal.vocab ? Math.round((bySkillCorrect.vocab / bySkillTotal.vocab) * 100) : 0,
    grammar: bySkillTotal.grammar ? Math.round((bySkillCorrect.grammar / bySkillTotal.grammar) * 100) : 0,
    reading: bySkillTotal.reading ? Math.round((bySkillCorrect.reading / bySkillTotal.reading) * 100) : 0,
  };

  // ✅ weakest: 同点のブレを消す（固定優先 grammar → reading → vocab）
  const order: Skill[] = ["grammar", "reading", "vocab"];
  let weakest: Skill = order[0];
  for (const sk of order) {
    if (bySkillAcc[sk] < bySkillAcc[weakest]) weakest = sk;
  }

  return {
    finishedAt: new Date().toISOString(),
    level,
    answers,
    bySkillCorrect,
    bySkillTotal,
    bySkillAcc,
    weakestSkill: weakest,
    idkCount,
  };
}

// =====================================================
// Persistence convenience
// =====================================================
export function savePhase1Result(res: Phase1Result) {
  writeJSON(DIAG_PHASE1_KEY, res);
}

export function savePhase2Result(res: Phase2Result) {
  writeJSON(DIAG_PHASE2_KEY, res);
}

export function markDiagnosticDone() {
  if (typeof window !== "undefined") {
    localStorage.setItem(DIAG_DONE_LS, "1");
  }
  setCookieOneYear(DIAG_DONE_COOKIE, "1");
}

export function isDiagnosticDoneClient(): boolean {
  if (typeof window === "undefined") return false;

  const ls = localStorage.getItem(DIAG_DONE_LS) === "1";

  let ck = false;
  try {
    ck = document.cookie.split("; ").some((x) => x.startsWith(`${DIAG_DONE_COOKIE}=1`));
  } catch {
    ck = false;
  }

  return ls || ck;
}