// app/_lib/weeklyProgression.ts
// ============================================================
// Weekly progression (week2+ update)
// - weekly check result を使って次週ポリシーを更新
// - 3週連続 all V/G/R >= 90 で「次の週から」統一練習級を1段昇格
// - 昇格/反映の二重適用防止（consumed week id）
// ============================================================

import {
  STUDY_PLAN_KEY,
  type JLPTLevel,
  type Skill,
  type StudyPlan,
  type StudyPlanWeekPolicy,
  buildWeekPolicyFromRates,
} from "@/app/_lib/diagnosticToPlan";

// 既存 weeklyCheck lib を source of truth にする（あなた指定）
import { readWeeklyCheckStore } from "@/app/_lib/weeklyCheck";

// -----------------------------
// Types (weeklyCheck store 互換のゆるい型)
// -----------------------------
type WeeklyCheckSkillRate = {
  total?: number;
  correct?: number;
  rate?: number;
};

type WeeklyCheckResultLike = {
  // 週識別子（あれば使う）
  weekId?: string | null;
  createdAt?: string;
  completedAt?: string;

  // bySkill.rate を source of truth
  bySkill?: {
    vocab?: WeeklyCheckSkillRate;
    grammar?: WeeklyCheckSkillRate;
    reading?: WeeklyCheckSkillRate;
  };

  [k: string]: any;
};

// weeklyCheck store shape は実装差分があり得るので、最後の結果を安全に抜く
type WeeklyCheckStoreLike = {
  latestResult?: WeeklyCheckResultLike | null;
  lastResult?: WeeklyCheckResultLike | null;
  result?: WeeklyCheckResultLike | null;
  history?: any[];
  weeklyHistory?: any[];
  results?: any[];

  // 現行/旧互換で top-level に mirror がある可能性
  lastWeeklyResultBySkill?: {
    vocab?: WeeklyCheckSkillRate;
    grammar?: WeeklyCheckSkillRate;
    reading?: WeeklyCheckSkillRate;
  };

  bySkill?: {
    vocab?: WeeklyCheckSkillRate;
    grammar?: WeeklyCheckSkillRate;
    reading?: WeeklyCheckSkillRate;
  };

  [k: string]: any;
};

// -----------------------------
// Storage helpers
// -----------------------------
function readJSON<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function writeJSON<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(value));
}

function nowISO() {
  return new Date().toISOString();
}

// -----------------------------
// Level helpers
// -----------------------------
const LEVEL_ASC: JLPTLevel[] = ["N5", "N4", "N3", "N2", "N1"]; // easier -> harder

function levelIndex(lv: JLPTLevel): number {
  return LEVEL_ASC.indexOf(lv);
}

function clampLevelIndex(i: number): number {
  return Math.max(0, Math.min(LEVEL_ASC.length - 1, i));
}

function levelByIndex(i: number): JLPTLevel {
  return LEVEL_ASC[clampLevelIndex(i)];
}

function isJLPTLevel(x: any): x is JLPTLevel {
  return x === "N5" || x === "N4" || x === "N3" || x === "N2" || x === "N1";
}

function safeRate(n: any): number {
  const x = Number(n);
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(100, x));
}

// -----------------------------
// Weekly result extraction
// -----------------------------
function normalizeWeeklyResult(v: any): WeeklyCheckResultLike | null {
  if (!v || typeof v !== "object") return null;

  // 普通の result 形式
  const directBySkill = {
    vocab: {
      total: Number(v?.bySkill?.vocab?.total ?? 0),
      correct: Number(v?.bySkill?.vocab?.correct ?? 0),
      rate: safeRate(v?.bySkill?.vocab?.rate),
    },
    grammar: {
      total: Number(v?.bySkill?.grammar?.total ?? 0),
      correct: Number(v?.bySkill?.grammar?.correct ?? 0),
      rate: safeRate(v?.bySkill?.grammar?.rate),
    },
    reading: {
      total: Number(v?.bySkill?.reading?.total ?? 0),
      correct: Number(v?.bySkill?.reading?.correct ?? 0),
      rate: safeRate(v?.bySkill?.reading?.rate),
    },
  };

  // top-level mirror 互換（result本体がなく store直下だけあるケース吸収）
  const mirrorBySkill = {
    vocab: {
      total: Number(v?.lastWeeklyResultBySkill?.vocab?.total ?? v?.bySkill?.vocab?.total ?? 0),
      correct: Number(v?.lastWeeklyResultBySkill?.vocab?.correct ?? v?.bySkill?.vocab?.correct ?? 0),
      rate: safeRate(v?.lastWeeklyResultBySkill?.vocab?.rate ?? v?.bySkill?.vocab?.rate),
    },
    grammar: {
      total: Number(v?.lastWeeklyResultBySkill?.grammar?.total ?? v?.bySkill?.grammar?.total ?? 0),
      correct: Number(v?.lastWeeklyResultBySkill?.grammar?.correct ?? v?.bySkill?.grammar?.correct ?? 0),
      rate: safeRate(v?.lastWeeklyResultBySkill?.grammar?.rate ?? v?.bySkill?.grammar?.rate),
    },
    reading: {
      total: Number(v?.lastWeeklyResultBySkill?.reading?.total ?? v?.bySkill?.reading?.total ?? 0),
      correct: Number(v?.lastWeeklyResultBySkill?.reading?.correct ?? v?.bySkill?.reading?.correct ?? 0),
      rate: safeRate(v?.lastWeeklyResultBySkill?.reading?.rate ?? v?.bySkill?.reading?.rate),
    },
  };

  const hasDirect =
    Number.isFinite(directBySkill.vocab.rate) ||
    Number.isFinite(directBySkill.grammar.rate) ||
    Number.isFinite(directBySkill.reading.rate);

  return {
    weekId: typeof v.weekId === "string" ? v.weekId : null,
    createdAt: typeof v.createdAt === "string" ? v.createdAt : undefined,
    completedAt: typeof v.completedAt === "string" ? v.completedAt : undefined,
    bySkill: hasDirect ? directBySkill : mirrorBySkill,
  };
}

function extractWeeklyHistory(store: WeeklyCheckStoreLike | null): WeeklyCheckResultLike[] {
  if (!store || typeof store !== "object") return [];

  const candidates = [
    ...(Array.isArray(store.history) ? store.history : []),
    ...(Array.isArray(store.weeklyHistory) ? store.weeklyHistory : []),
    ...(Array.isArray(store.results) ? store.results : []),
  ]
    .map(normalizeWeeklyResult)
    .filter(Boolean) as WeeklyCheckResultLike[];

  // latest/last/result も historyに無ければ末尾として補う
  const singles = [store.latestResult, store.lastResult, store.result]
    .map(normalizeWeeklyResult)
    .filter(Boolean) as WeeklyCheckResultLike[];

  // store 直下 bySkill/lastWeeklyResultBySkill しかない実装も拾う
  const rootAsResult = normalizeWeeklyResult(store);

  const keyOf = (x: WeeklyCheckResultLike) =>
    [
      x.weekId ?? "",
      x.completedAt ?? "",
      x.createdAt ?? "",
      x.bySkill?.vocab?.rate ?? "",
      x.bySkill?.grammar?.rate ?? "",
      x.bySkill?.reading?.rate ?? "",
    ].join("|");

  const seen = new Set<string>();
  const merged: WeeklyCheckResultLike[] = [];

  for (const r of [...candidates, ...singles, ...(rootAsResult ? [rootAsResult] : [])]) {
    const k = keyOf(r);
    if (seen.has(k)) continue;
    seen.add(k);
    merged.push(r);
  }

  // 時系列っぽくソート（completedAt > createdAt）
  merged.sort((a, b) => {
    const ta = Date.parse(a.completedAt ?? a.createdAt ?? "") || 0;
    const tb = Date.parse(b.completedAt ?? b.createdAt ?? "") || 0;
    return ta - tb;
  });

  return merged;
}

function latestWeeklyResult(store: WeeklyCheckStoreLike | null): WeeklyCheckResultLike | null {
  const hist = extractWeeklyHistory(store);
  if (hist.length > 0) return hist[hist.length - 1] ?? null;

  const direct =
    normalizeWeeklyResult(store?.latestResult) ||
    normalizeWeeklyResult(store?.lastResult) ||
    normalizeWeeklyResult(store?.result) ||
    normalizeWeeklyResult(store);

  return direct ?? null;
}

function weeklyResultRates(r: WeeklyCheckResultLike | null): Record<Skill, number> {
  return {
    vocab: safeRate(r?.bySkill?.vocab?.rate),
    grammar: safeRate(r?.bySkill?.grammar?.rate),
    reading: safeRate(r?.bySkill?.reading?.rate),
  };
}

function isAll90OrMore(r: WeeklyCheckResultLike | null): boolean {
  const rates = weeklyResultRates(r);
  return rates.vocab >= 90 && rates.grammar >= 90 && rates.reading >= 90;
}

function computeConsecutiveAll90FromHistory(history: WeeklyCheckResultLike[]): number {
  // 末尾から連続で all>=90 を数える
  let streak = 0;
  for (let i = history.length - 1; i >= 0; i--) {
    const r = history[i];
    if (isAll90OrMore(r)) streak += 1;
    else break;
  }
  return streak;
}

// -----------------------------
// two-weak tie の day allocation 交互化
// -----------------------------
/**
 * currentWeekPolicy.pattern === "two_weak_tie_alt_4_3_2" のとき、
 * Day1は base allocation のまま、
 * Day2で tie弱点2つの 4/3 を入れ替える、Day3で戻す…という想定で使えるヘルパー。
 *
 * dayIndex: 1..7（Day7はweekly-onlyなので通常は1..6で使う）
 */
export function getDailyAllocationFromWeekPolicy(policy: StudyPlanWeekPolicy, dayIndex: number): Record<Skill, number> {
  const base = {
    vocab: Number((policy as any)?.allocation?.vocab ?? 3),
    grammar: Number((policy as any)?.allocation?.grammar ?? 3),
    reading: Number((policy as any)?.allocation?.reading ?? 3),
  };

  if ((policy as any)?.pattern !== "two_weak_tie_alt_4_3_2") return base;
  if (!(policy as any)?.twoWeakTieOrder || dayIndex <= 0) return base;
  if (dayIndex === 7) return base; // Day7はweekly only
  if (dayIndex % 2 === 1) return base; // Day1,3,5 = base（Day1最弱点4・2番弱点3）

  const tieOrder = (policy as any).twoWeakTieOrder as Skill[] | undefined;
  if (!Array.isArray(tieOrder) || tieOrder.length < 2) return base;

  const firstWeak = tieOrder[0];
  const secondWeak = tieOrder[1];
  if (!firstWeak || !secondWeak) return base;

  // 偶数日は 4/3 を入れ替える
  const out = { ...base };
  const a = out[firstWeak];
  const b = out[secondWeak];

  out[firstWeak] = b;
  out[secondWeak] = a;
  return out;
}

// -----------------------------
// Public API
// -----------------------------
export type ApplyWeeklyProgressionResult =
  | { ok: false; reason: string }
  | {
      ok: true;
      applied: boolean;
      consumedWeekId: string | null;
      practiceLevelBefore: JLPTLevel;
      practiceLevelAfter: JLPTLevel;
      promoted: boolean;
      consecutiveAll90Weeks: number;
      currentWeekPolicy: StudyPlanWeekPolicy;
    };

/**
 * weekly check の最新結果を使って「次週の学習ポリシー」を更新する
 *
 * 想定タイミング:
 * - Day7 weekly check 完了後、次週 roadmap を作る直前/作成時に1回呼ぶ
 *
 * 重要:
 * - 同じ weekly result の二重適用を防ぐ（promotionConsumedForWeekId）
 * - 昇格条件: V/G/R 全て 90%以上を3週連続
 * - 昇格は次週から反映（この関数は「次週ポリシー作成前」に呼ぶ前提）
 */
export function applyWeeklyCheckToStudyPlanForNextWeek(): ApplyWeeklyProgressionResult {
  const plan = readJSON<StudyPlan>(STUDY_PLAN_KEY);
  if (!plan) {
    return { ok: false, reason: "StudyPlan not found. Run diagnostic first." };
  }

  let storeRaw: any = null;
  try {
    storeRaw = readWeeklyCheckStore() as any;
  } catch {
    return { ok: false, reason: "Failed to read weekly check store." };
  }

  const store = (storeRaw ?? null) as WeeklyCheckStoreLike | null;
  const latest = latestWeeklyResult(store);
  if (!latest) {
    return { ok: false, reason: "No weekly check result found." };
  }

  // weekIdがない実装でも最低限一意化したい
  const latestWeekId =
    latest.weekId ??
    `wc:${latest.completedAt ?? latest.createdAt ?? ""}:${safeRate(latest.bySkill?.vocab?.rate)}-${safeRate(
      latest.bySkill?.grammar?.rate
    )}-${safeRate(latest.bySkill?.reading?.rate)}`;

  const prevConsumedWeekId = (plan as any)?.promotion?.promotionConsumedForWeekId ?? null;
  const alreadyConsumed = prevConsumedWeekId === latestWeekId;

  if (alreadyConsumed) {
    return {
      ok: true,
      applied: false,
      consumedWeekId: latestWeekId,
      practiceLevelBefore: isJLPTLevel((plan as any).practiceLevel) ? (plan as any).practiceLevel : (plan as any).goalLevel,
      practiceLevelAfter: isJLPTLevel((plan as any).practiceLevel) ? (plan as any).practiceLevel : (plan as any).goalLevel,
      promoted: false,
      consecutiveAll90Weeks: Number((plan as any)?.promotion?.consecutiveAll90Weeks ?? 0),
      currentWeekPolicy: (plan as any).currentWeekPolicy,
    };
  }

  const history = extractWeeklyHistory(store);
  const streak = computeConsecutiveAll90FromHistory(history);

  const practiceLevelBefore: JLPTLevel = isJLPTLevel((plan as any).practiceLevel)
    ? (plan as any).practiceLevel
    : isJLPTLevel((plan as any).goalLevel)
    ? (plan as any).goalLevel
    : "N5";

  let practiceLevelAfter: JLPTLevel = practiceLevelBefore;
  let promoted = false;

  // 昇格条件: 3週連続 all>=90 かつ 目標未達
  const goalLevel: JLPTLevel = isJLPTLevel((plan as any).goalLevel) ? (plan as any).goalLevel : "N5";
  const goalIndex = levelIndex(goalLevel);
  const curIndex = levelIndex(practiceLevelBefore);

  if (streak >= 3 && curIndex < goalIndex) {
    practiceLevelAfter = levelByIndex(curIndex + 1);
    promoted = true;
  }

  // 次週配分は latest weekly result の bySkill.rate を使用
  const nextWeekPolicy = buildWeekPolicyFromRates({
    bySkillRate: weeklyResultRates(latest),
    source: "weekly-check",
    sourceWeekId: latestWeekId,
  });

  // ---- meta / promotion を loose に組み立てて型不一致を回避 ----
  const prevMeta: any = (plan as any).meta && typeof (plan as any).meta === "object" ? { ...(plan as any).meta } : {};
  const prevNotes = Array.isArray(prevMeta.notes) ? (prevMeta.notes as string[]) : [];

  const nextMeta: any = {
    ...prevMeta,
    notes: [...prevNotes, `Weekly progression applied from ${latestWeekId} at ${nowISO()}.`].slice(-20),
  };

  const prevPromotion: any =
    (plan as any).promotion && typeof (plan as any).promotion === "object" ? { ...(plan as any).promotion } : {};

  const nextPromotion: any = {
    ...prevPromotion,
    currentPracticeLevel: practiceLevelAfter,
    consecutiveAll90Weeks: streak,
    lastPromotionAtISO: promoted ? nowISO() : prevPromotion.lastPromotionAtISO ?? null,
    // この weekly result は反映済みとして記録（配分更新 + 昇格判定）
    promotionConsumedForWeekId: latestWeekId,
  };

  // StudyPlan 型の詳細差分で落ちないよう any 経由で最終代入
  const nextLoose: any = {
    ...(plan as any),
    updatedAt: nowISO(),
    practiceLevel: practiceLevelAfter, // 統一級
    currentWeekPolicy: nextWeekPolicy,
    promotion: nextPromotion,
    meta: nextMeta,
  };

  writeJSON(STUDY_PLAN_KEY, nextLoose as StudyPlan);

  return {
    ok: true,
    applied: true,
    consumedWeekId: latestWeekId,
    practiceLevelBefore,
    practiceLevelAfter,
    promoted,
    consecutiveAll90Weeks: streak,
    currentWeekPolicy: nextWeekPolicy,
  };
}