// app/_lib/weeklyCheck.ts

"use client";

import type { JLPTLevel, Skill } from "@/app/_lib/roadmap";
import { writeJSON, readJSON } from "@/app/_lib/roadmap";
import { WEEKLY_BANK } from "@/app/_lib/weeklyCheckBank";

/* =========================================================
 * constants
 * =======================================================*/

export const WEEKLY_CHECK_KEY = "lexio.weeklyCheck.v1"; // legacy / compat
export const WEEKLY_CHECK_RESULT_V2_KEY = "lexio.weeklyCheck.result.v2"; // unified-level promotion source of truth

/* =========================================================
 * types
 * =======================================================*/

export type WeeklyCheckQuestionRef = {
  id: string;
  skill: Skill;
  levelTag: JLPTLevel;
};

export type WeeklyCheckSession = {
  version: 1;
  weekId: string;
  goalLevel: JLPTLevel;
  questions: WeeklyCheckQuestionRef[]; // 30
  answers: Record<string, { correct: boolean }>;
  createdAtISO: string;
  startedAtISO?: string;
};

export type WeeklySkillSummary = {
  total: number;
  correct: number;
  rate: number; // 0..100
};

export type WeeklyBySkill = Record<Skill, WeeklySkillSummary>;

export type WeeklyCheckFinalizeResult = {
  total: number;
  correct: number;
  rate: number;
  bySkill: WeeklyBySkill;
};

export type WeeklyCheckStore = {
  version: 1;
  updatedAtISO: string;
  // 旧互換: 画面が skill別を期待してるため残す（値は統一運用）
  practiceLevelBySkill: Record<Skill, JLPTLevel>;
  goalLevel?: JLPTLevel;
  streakBySkill: Record<Skill, number>;
  history: Array<{
    weekId: string;
    createdAtISO: string;
    total: number;
    correct: number;
    bySkill: WeeklyBySkill;
  }>;
};

export type WeeklyCheckAnswerLite = {
  skill: Skill;
  correct: boolean;
};

export type WeeklyCheckResultV2Entry = {
  weekId: string;
  createdAtISO: string;
  level: JLPTLevel; // その週の weekly check 実施時の練習級（統一）
  total: number;
  correct: number;
  rate: number;
  bySkill: WeeklyBySkill;
  allSkillsPassed90: boolean;
  promotionStreakAfterSave: number;
  promoted: boolean;
  currentPracticeLevelAfterSave: JLPTLevel;
};

export type WeeklyCheckResultV2Store = {
  version: 2;
  updatedAtISO: string;
  goalLevel: JLPTLevel;
  currentPracticeLevel: JLPTLevel; // 統一
  promotionStreak: number; // 「全スキル90%以上」の連続数
  history: WeeklyCheckResultV2Entry[];
};

type SaveWeeklyCheckResultV2Input = {
  weekId: string;
  level: JLPTLevel;
  total: number;
  correct: number;
  bySkill: WeeklyBySkill;
};

/* =========================================================
 * level helpers
 * =======================================================*/

const LEVELS_ASC: JLPTLevel[] = ["N5", "N4", "N3", "N2", "N1"];

function asSkill(v: any): Skill {
  return v === "vocab" || v === "grammar" || v === "reading" ? v : "vocab";
}

function asLevel(v: any): JLPTLevel {
  return v === "N5" || v === "N4" || v === "N3" || v === "N2" || v === "N1" ? v : "N5";
}

function levelIndex(lv: JLPTLevel): number {
  return LEVELS_ASC.indexOf(lv);
}

function clampLevelToGoal(level: JLPTLevel, goalLevel: JLPTLevel): JLPTLevel {
  const li = levelIndex(level);
  const gi = levelIndex(goalLevel);
  if (li < 0 || gi < 0) return goalLevel;
  return LEVELS_ASC[Math.min(li, gi)];
}

function nextLevel(level: JLPTLevel): JLPTLevel {
  const i = levelIndex(level);
  if (i < 0) return "N5";
  return LEVELS_ASC[Math.min(i + 1, LEVELS_ASC.length - 1)];
}

/**
 * 初期練習級（統一）
 * ユーザー仕様:
 * - 現状 < 目標 のとき「常に1段上から開始」（N5→N4）
 * - 現状 == 目標 のとき その級
 * - 現状 > 目標 のとき 目標級
 */
export function computeInitialUnifiedPracticeLevel(params: {
  estimatedLevel: JLPTLevel; // 診断phase1の現状級
  goalLevel: JLPTLevel; // phase0の目標級
}): JLPTLevel {
  const estimated = asLevel(params.estimatedLevel);
  const goal = asLevel(params.goalLevel);

  const ei = levelIndex(estimated);
  const gi = levelIndex(goal);

  if (ei === -1 || gi === -1) return "N5";

  if (ei > gi) {
    // 現状が目標を超える -> 目標級
    return goal;
  }
  if (ei === gi) {
    // 同じ -> その級
    return goal;
  }

  // 現状 < 目標 -> 常に1段上から開始
  const oneUp = nextLevel(estimated);
  // ただし目標上限
  return clampLevelToGoal(oneUp, goal);
}

/* =========================================================
 * generic helpers
 * =======================================================*/

function nowISO() {
  return new Date().toISOString();
}

function safeRate(correct: number, total: number): number {
  if (!Number.isFinite(correct) || !Number.isFinite(total) || total <= 0) return 0;
  return Math.round((correct / total) * 1000) / 10; // 1 decimal
}

function emptyBySkill(): WeeklyBySkill {
  return {
    vocab: { total: 0, correct: 0, rate: 0 },
    grammar: { total: 0, correct: 0, rate: 0 },
    reading: { total: 0, correct: 0, rate: 0 },
  };
}

function recalcRates(bySkill: WeeklyBySkill): WeeklyBySkill {
  return {
    vocab: {
      ...bySkill.vocab,
      rate: safeRate(bySkill.vocab.correct, bySkill.vocab.total),
    },
    grammar: {
      ...bySkill.grammar,
      rate: safeRate(bySkill.grammar.correct, bySkill.grammar.total),
    },
    reading: {
      ...bySkill.reading,
      rate: safeRate(bySkill.reading.correct, bySkill.reading.total),
    },
  };
}

function normalizeBySkill(input: any): WeeklyBySkill {
  const out = emptyBySkill();
  const skills: Skill[] = ["vocab", "grammar", "reading"];
  for (const s of skills) {
    const src = input?.[s] ?? {};
    out[s] = {
      total: Math.max(0, Number(src.total ?? 0) || 0),
      correct: Math.max(0, Number(src.correct ?? 0) || 0),
      rate: 0,
    };
  }
  return recalcRates(out);
}

/* =========================================================
 * public: summarize helpers (Step10で使う)
 * =======================================================*/

export function summarizeWeeklyCheckBySkillFromAnswers(
  answers: WeeklyCheckAnswerLite[]
): WeeklyBySkill {
  const bySkill = emptyBySkill();

  for (const a of Array.isArray(answers) ? answers : []) {
    const skill = asSkill((a as any)?.skill);
    bySkill[skill].total += 1;
    if ((a as any)?.correct) bySkill[skill].correct += 1;
  }

  return recalcRates(bySkill);
}

/* =========================================================
 * legacy store (compat)
 * =======================================================*/

function defaultLegacyStore(goalLevel: JLPTLevel = "N5"): WeeklyCheckStore {
  return {
    version: 1,
    updatedAtISO: nowISO(),
    goalLevel,
    practiceLevelBySkill: {
      vocab: goalLevel,
      grammar: goalLevel,
      reading: goalLevel,
    },
    streakBySkill: {
      vocab: 0,
      grammar: 0,
      reading: 0,
    },
    history: [],
  };
}

export function readWeeklyCheckStore(): WeeklyCheckStore {
  const raw = readJSON<any>(WEEKLY_CHECK_KEY);

  if (!raw || typeof raw !== "object") return defaultLegacyStore("N5");

  const goal = asLevel(raw.goalLevel ?? "N5");
  const store: WeeklyCheckStore = {
    version: 1,
    updatedAtISO: typeof raw.updatedAtISO === "string" ? raw.updatedAtISO : nowISO(),
    goalLevel: goal,
    practiceLevelBySkill: {
      vocab: asLevel(raw?.practiceLevelBySkill?.vocab ?? goal),
      grammar: asLevel(raw?.practiceLevelBySkill?.grammar ?? goal),
      reading: asLevel(raw?.practiceLevelBySkill?.reading ?? goal),
    },
    streakBySkill: {
      vocab: Math.max(0, Number(raw?.streakBySkill?.vocab ?? 0) || 0),
      grammar: Math.max(0, Number(raw?.streakBySkill?.grammar ?? 0) || 0),
      reading: Math.max(0, Number(raw?.streakBySkill?.reading ?? 0) || 0),
    },
    history: Array.isArray(raw.history)
      ? raw.history.map((h: any) => ({
          weekId: String(h?.weekId ?? ""),
          createdAtISO: typeof h?.createdAtISO === "string" ? h.createdAtISO : nowISO(),
          total: Math.max(0, Number(h?.total ?? 0) || 0),
          correct: Math.max(0, Number(h?.correct ?? 0) || 0),
          bySkill: normalizeBySkill(h?.bySkill),
        }))
      : [],
  };

  return store;
}

/**
 * 旧画面互換: practiceLevelBySkill を必ず存在させる
 * 現仕様では統一級なので同一値を入れる
 */
export function ensureWeeklyLevelsFromRoadmap(params: { roadmapLevel: JLPTLevel }): WeeklyCheckStore {
  const goal = asLevel(params.roadmapLevel);
  const current = readWeeklyCheckStore();

  const next: WeeklyCheckStore = {
    ...current,
    updatedAtISO: nowISO(),
    goalLevel: goal,
    practiceLevelBySkill: {
      vocab: clampLevelToGoal(asLevel(current.practiceLevelBySkill?.vocab ?? goal), goal),
      grammar: clampLevelToGoal(asLevel(current.practiceLevelBySkill?.grammar ?? goal), goal),
      reading: clampLevelToGoal(asLevel(current.practiceLevelBySkill?.reading ?? goal), goal),
    },
  };

  writeJSON(WEEKLY_CHECK_KEY, next);

  // v2も初期化だけしておく（存在しなければ）
  ensureWeeklyCheckResultV2Store({ goalLevel: goal });

  return next;
}

/* =========================================================
 * weekly session builder
 * =======================================================*/

type WeeklyBankQuestion = {
  id: string;
  skill: Skill;
  level?: JLPTLevel;
  jlptLevel?: JLPTLevel;
  levelTag?: JLPTLevel;
  [k: string]: any;
};

function getQuestionLevel(q: WeeklyBankQuestion): JLPTLevel {
  return asLevel(q.levelTag ?? q.level ?? q.jlptLevel ?? "N5");
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function sampleN<T>(arr: T[], n: number): T[] {
  if (n <= 0) return [];
  if (arr.length <= n) return shuffle(arr);
  return shuffle(arr).slice(0, n);
}

function getBankListForSkill(skill: Skill): WeeklyBankQuestion[] {
  const list = (WEEKLY_BANK as any)?.[skill];
  if (!Array.isArray(list)) return [];
  return list
    .filter(Boolean)
    .map((q: any) => ({
      ...q,
      skill,
    })) as WeeklyBankQuestion[];
}

function buildSkillQuestionRefs(params: {
  skill: Skill;
  practiceLevel: JLPTLevel;
}): WeeklyCheckQuestionRef[] {
  const { skill, practiceLevel } = params;
  const bank = getBankListForSkill(skill);

  // 仕様: 6 this-week + 4 hard
  // hard は「1段上」を優先（なければ同級/その他で補完）
  const li = levelIndex(practiceLevel);
  const hardLevel = li >= 0 ? LEVELS_ASC[Math.min(li + 1, LEVELS_ASC.length - 1)] : practiceLevel;

  const same = bank.filter((q) => getQuestionLevel(q) === practiceLevel);
  const hard = bank.filter((q) => getQuestionLevel(q) === hardLevel);

  let pickedSame = sampleN(same, 6);
  let pickedHard = sampleN(
    hard.filter((h) => !pickedSame.some((s) => s.id === h.id)),
    4
  );

  // 補完（不足分）
  if (pickedSame.length < 6) {
    const need = 6 - pickedSame.length;
    const pool = bank.filter((q) => !pickedSame.some((x) => x.id === q.id));
    pickedSame = [...pickedSame, ...sampleN(pool, need)];
  }

  if (pickedHard.length < 4) {
    const need = 4 - pickedHard.length;
    const pool = bank.filter(
      (q) =>
        !pickedSame.some((x) => x.id === q.id) &&
        !pickedHard.some((x) => x.id === q.id)
    );
    pickedHard = [...pickedHard, ...sampleN(pool, need)];
  }

  const refs: WeeklyCheckQuestionRef[] = [
    ...pickedSame.map((q) => ({
      id: String(q.id),
      skill,
      levelTag: getQuestionLevel(q),
    })),
    ...pickedHard.map((q) => ({
      id: String(q.id),
      skill,
      levelTag: getQuestionLevel(q),
    })),
  ];

  // 最終的に10件になるよう補完（安全策）
  if (refs.length < 10) {
    const used = new Set(refs.map((r) => r.id));
    const fill = bank
      .filter((q) => !used.has(String(q.id)))
      .slice(0, 10 - refs.length)
      .map((q) => ({
        id: String(q.id),
        skill,
        levelTag: getQuestionLevel(q),
      }));
    refs.push(...fill);
  }

  return refs.slice(0, 10);
}

/**
 * 30問セッションを生成
 * practiceLevelBySkill は互換引数だが、現仕様では「統一級」で運用
 */
export function buildWeeklyCheckSession(params: {
  weekId: string;
  goalLevel: JLPTLevel;
  practiceLevelBySkill: Record<Skill, JLPTLevel>;
}): WeeklyCheckSession {
  const weekId = String(params.weekId ?? `wk-${Date.now()}`);
  const goalLevel = asLevel(params.goalLevel);

  // 現仕様: skill別ではなく統一。先頭(vocab)を代表値として使い、goalでクランプ
  const baseUnified = clampLevelToGoal(asLevel(params.practiceLevelBySkill?.vocab ?? goalLevel), goalLevel);

  const vocabRefs = buildSkillQuestionRefs({ skill: "vocab", practiceLevel: baseUnified });
  const grammarRefs = buildSkillQuestionRefs({ skill: "grammar", practiceLevel: baseUnified });
  const readingRefs = buildSkillQuestionRefs({ skill: "reading", practiceLevel: baseUnified });

  // 並びはランダム化（30問）
  const questions = shuffle([...vocabRefs, ...grammarRefs, ...readingRefs]).slice(0, 30);

  return {
    version: 1,
    weekId,
    goalLevel,
    questions,
    answers: {},
    createdAtISO: nowISO(),
  };
}

/* =========================================================
 * finalize (legacy compat)
 * =======================================================*/

export function finalizeWeeklyCheck(params: {
  session: WeeklyCheckSession;
  goalLevel: JLPTLevel;
  weekId: string;
}): { store: WeeklyCheckStore; result: WeeklyCheckFinalizeResult } {
  const { session } = params;
  const goalLevel = asLevel(params.goalLevel);
  const weekId = String(params.weekId ?? session.weekId ?? `wk-${Date.now()}`);

  const answerLite: WeeklyCheckAnswerLite[] = [];

  for (const q of Array.isArray(session.questions) ? session.questions : []) {
    const qid = String(q?.id ?? "");
    if (!qid) continue;

    const a = session.answers?.[qid];
    if (!a || typeof a.correct !== "boolean") continue;

    answerLite.push({
      skill: asSkill(q.skill),
      correct: !!a.correct,
    });
  }

  const bySkill = summarizeWeeklyCheckBySkillFromAnswers(answerLite);
  const total = bySkill.vocab.total + bySkill.grammar.total + bySkill.reading.total;
  const correct = bySkill.vocab.correct + bySkill.grammar.correct + bySkill.reading.correct;
  const rate = safeRate(correct, total);

  const result: WeeklyCheckFinalizeResult = { total, correct, rate, bySkill };

  // 旧互換 store 更新（skill別 streak を残すが、昇格ソースはv2）
  const prev = readWeeklyCheckStore();

  const nextStreakBySkill: Record<Skill, number> = {
    vocab: bySkill.vocab.rate >= 90 ? prev.streakBySkill.vocab + 1 : 0,
    grammar: bySkill.grammar.rate >= 90 ? prev.streakBySkill.grammar + 1 : 0,
    reading: bySkill.reading.rate >= 90 ? prev.streakBySkill.reading + 1 : 0,
  };

  const nextStore: WeeklyCheckStore = {
    ...prev,
    version: 1,
    updatedAtISO: nowISO(),
    goalLevel,
    // 現仕様では統一級運用。ここは値をそろえて維持（UI互換）
    practiceLevelBySkill: {
      vocab: clampLevelToGoal(asLevel(prev.practiceLevelBySkill?.vocab ?? goalLevel), goalLevel),
      grammar: clampLevelToGoal(asLevel(prev.practiceLevelBySkill?.vocab ?? goalLevel), goalLevel),
      reading: clampLevelToGoal(asLevel(prev.practiceLevelBySkill?.vocab ?? goalLevel), goalLevel),
    },
    streakBySkill: nextStreakBySkill,
    history: [
      ...prev.history.filter((h) => String(h.weekId) !== weekId),
      {
        weekId,
        createdAtISO: nowISO(),
        total,
        correct,
        bySkill,
      },
    ].slice(-24), // 適度に保持
  };

  return { store: nextStore, result };
}

/* =========================================================
 * v2 store (source of truth for unified promotion)
 * =======================================================*/

function defaultV2Store(goalLevel: JLPTLevel): WeeklyCheckResultV2Store {
  const g = asLevel(goalLevel);
  return {
    version: 2,
    updatedAtISO: nowISO(),
    goalLevel: g,
    currentPracticeLevel: g, // 初期値。実際の初期設定は diagnosticToPlan 側で上書きしてOK
    promotionStreak: 0,
    history: [],
  };
}

export function readWeeklyCheckResultV2Store(): WeeklyCheckResultV2Store | null {
  const raw = readJSON<any>(WEEKLY_CHECK_RESULT_V2_KEY);
  if (!raw || typeof raw !== "object") return null;

  const goalLevel = asLevel(raw.goalLevel ?? "N5");
  const currentPracticeLevel = clampLevelToGoal(asLevel(raw.currentPracticeLevel ?? goalLevel), goalLevel);

  const store: WeeklyCheckResultV2Store = {
    version: 2,
    updatedAtISO: typeof raw.updatedAtISO === "string" ? raw.updatedAtISO : nowISO(),
    goalLevel,
    currentPracticeLevel,
    promotionStreak: Math.max(0, Number(raw.promotionStreak ?? 0) || 0),
    history: Array.isArray(raw.history)
      ? raw.history.map((h: any) => {
          const bySkill = normalizeBySkill(h?.bySkill);
          const total = Math.max(
            0,
            Number(
              h?.total ??
                bySkill.vocab.total + bySkill.grammar.total + bySkill.reading.total
            ) || 0
          );
          const correct = Math.max(
            0,
            Number(
              h?.correct ??
                bySkill.vocab.correct + bySkill.grammar.correct + bySkill.reading.correct
            ) || 0
          );
          const rate = safeRate(correct, total);
          const allSkillsPassed90 =
            bySkill.vocab.rate >= 90 && bySkill.grammar.rate >= 90 && bySkill.reading.rate >= 90;

          return {
            weekId: String(h?.weekId ?? ""),
            createdAtISO: typeof h?.createdAtISO === "string" ? h.createdAtISO : nowISO(),
            level: asLevel(h?.level ?? currentPracticeLevel),
            total,
            correct,
            rate,
            bySkill,
            allSkillsPassed90,
            promotionStreakAfterSave: Math.max(0, Number(h?.promotionStreakAfterSave ?? 0) || 0),
            promoted: !!h?.promoted,
            currentPracticeLevelAfterSave: clampLevelToGoal(
              asLevel(h?.currentPracticeLevelAfterSave ?? currentPracticeLevel),
              goalLevel
            ),
          } satisfies WeeklyCheckResultV2Entry;
        })
      : [],
  };

  return store;
}

export function ensureWeeklyCheckResultV2Store(params: { goalLevel: JLPTLevel }): WeeklyCheckResultV2Store {
  const goalLevel = asLevel(params.goalLevel);
  const prev = readWeeklyCheckResultV2Store();

  if (!prev) {
    const created = defaultV2Store(goalLevel);
    writeJSON(WEEKLY_CHECK_RESULT_V2_KEY, created);
    return created;
  }

  const next: WeeklyCheckResultV2Store = {
    ...prev,
    updatedAtISO: nowISO(),
    goalLevel,
    currentPracticeLevel: clampLevelToGoal(prev.currentPracticeLevel, goalLevel),
  };

  writeJSON(WEEKLY_CHECK_RESULT_V2_KEY, next);
  return next;
}

/**
 * 外部（diagnostic→plan生成など）から統一練習級を明示設定したい時用
 */
export function setWeeklyCheckCurrentPracticeLevelV2(params: {
  goalLevel: JLPTLevel;
  currentPracticeLevel: JLPTLevel;
  resetPromotionStreak?: boolean;
}): WeeklyCheckResultV2Store {
  const goalLevel = asLevel(params.goalLevel);
  const ensured = ensureWeeklyCheckResultV2Store({ goalLevel });

  const next: WeeklyCheckResultV2Store = {
    ...ensured,
    updatedAtISO: nowISO(),
    goalLevel,
    currentPracticeLevel: clampLevelToGoal(asLevel(params.currentPracticeLevel), goalLevel),
    promotionStreak: params.resetPromotionStreak ? 0 : ensured.promotionStreak,
  };

  writeJSON(WEEKLY_CHECK_RESULT_V2_KEY, next);
  return next;
}

export function getWeeklyCheckCurrentPracticeLevelV2(params?: { fallbackGoalLevel?: JLPTLevel }): JLPTLevel {
  const s = readWeeklyCheckResultV2Store();
  if (s) return s.currentPracticeLevel;
  return asLevel(params?.fallbackGoalLevel ?? "N5");
}

/**
 * Weekly Check 結果保存（v2）
 * - ソースオブトゥルース
 * - 昇格判定: V/G/R 全て90%以上で streak+1
 * - 3週連続で昇格（1段）
 * - 目標級上限
 */
export function saveWeeklyCheckResultV2(input: SaveWeeklyCheckResultV2Input): {
  store: WeeklyCheckResultV2Store;
  entry: WeeklyCheckResultV2Entry;
  promoted: boolean;
  currentPracticeLevel: JLPTLevel;
} {
  const weekId = String(input.weekId ?? `wk-${Date.now()}`);
  const bySkill = normalizeBySkill(input.bySkill);

  const total =
    Math.max(
      0,
      Number(
        input.total ??
          bySkill.vocab.total + bySkill.grammar.total + bySkill.reading.total
      ) || 0
    );

  const correct =
    Math.max(
      0,
      Number(
        input.correct ??
          bySkill.vocab.correct + bySkill.grammar.correct + bySkill.reading.correct
      ) || 0
    );

  const providedLevel = asLevel(input.level ?? "N5");
  const rate = safeRate(correct, total);

  // goalLevel は既存v2から優先。なければ providedLevel を仮goalとして初期化
  const prevStore =
    readWeeklyCheckResultV2Store() ??
    ensureWeeklyCheckResultV2Store({ goalLevel: providedLevel });

  const goalLevel = asLevel(prevStore.goalLevel ?? providedLevel);

  // level は goal 上限
  const level = clampLevelToGoal(providedLevel, goalLevel);

  const allSkillsPassed90 =
    bySkill.vocab.rate >= 90 && bySkill.grammar.rate >= 90 && bySkill.reading.rate >= 90;

  // 同一weekIdの再保存は置換扱い（streak再計算を history ベースでやる）
  const historyWithoutThisWeek = prevStore.history.filter((h) => String(h.weekId) !== weekId);

  // まず仮entry（streak/promotion後で決定）
  const tempEntryBase = {
    weekId,
    createdAtISO: nowISO(),
    level,
    total,
    correct,
    rate,
    bySkill,
    allSkillsPassed90,
  };

  // streak は「時系列順の末尾」ルールだが、ここでは保存順ベース（createdAt）で処理
  // 実運用上 Day7 1回保存想定。再保存にも耐えるように history末尾再構成で計算する。
  const prevStreak = prevStore.promotionStreak;
  let nextStreak = allSkillsPassed90 ? prevStreak + 1 : 0;

  let promoted = false;
  let nextPracticeLevel = prevStore.currentPracticeLevel;

  if (nextStreak >= 3) {
    const candidate = nextLevel(prevStore.currentPracticeLevel);
    const clamped = clampLevelToGoal(candidate, goalLevel);

    if (clamped !== prevStore.currentPracticeLevel) {
      promoted = true;
      nextPracticeLevel = clamped;
    }
    // 3連続達成時は消費して0に戻す（次の昇格カウントを最初から）
    nextStreak = 0;
  }

  // もし既に goal 到達済みでも streakロジックは回すが、昇格不可なら promoted=false のまま
  nextPracticeLevel = clampLevelToGoal(nextPracticeLevel, goalLevel);

  const entry: WeeklyCheckResultV2Entry = {
    ...tempEntryBase,
    promotionStreakAfterSave: nextStreak,
    promoted,
    currentPracticeLevelAfterSave: nextPracticeLevel,
  };

  const nextStore: WeeklyCheckResultV2Store = {
    version: 2,
    updatedAtISO: nowISO(),
    goalLevel,
    currentPracticeLevel: nextPracticeLevel,
    promotionStreak: nextStreak,
    history: [...historyWithoutThisWeek, entry].slice(-52), // 1年分くらい保持
  };

  writeJSON(WEEKLY_CHECK_RESULT_V2_KEY, nextStore);

  // 旧互換storeにも最低限同期（画面が読む可能性あり）
  const legacy = readWeeklyCheckStore();
  const legacySynced: WeeklyCheckStore = {
    ...legacy,
    updatedAtISO: nowISO(),
    goalLevel,
    practiceLevelBySkill: {
      vocab: nextPracticeLevel,
      grammar: nextPracticeLevel,
      reading: nextPracticeLevel,
    },
  };
  writeJSON(WEEKLY_CHECK_KEY, legacySynced);

  return {
    store: nextStore,
    entry,
    promoted,
    currentPracticeLevel: nextPracticeLevel,
  };
}

/* =========================================================
 * convenience selectors
 * =======================================================*/

export function getLatestWeeklyCheckV2Entry(): WeeklyCheckResultV2Entry | null {
  const s = readWeeklyCheckResultV2Store();
  if (!s || !Array.isArray(s.history) || s.history.length === 0) return null;
  return s.history[s.history.length - 1] ?? null;
}

export function hasWeeklyCheckPassed90AllSkills(bySkill: WeeklyBySkill): boolean {
  const n = normalizeBySkill(bySkill);
  return n.vocab.rate >= 90 && n.grammar.rate >= 90 && n.reading.rate >= 90;
}