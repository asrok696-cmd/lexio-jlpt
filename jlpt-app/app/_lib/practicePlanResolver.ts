// app/_lib/practicePlanResolver.ts

export type JLPTLevel = "N5" | "N4" | "N3" | "N2" | "N1";
export type Skill = "vocab" | "grammar" | "reading";

export type SkillRates = Record<Skill, number>;

export type PracticeSlotPattern = Record<Skill, number>; // 9 slots total (例: 5,2,2)
export type PracticeQuestionCounts = Record<Skill, number>; // 実問数 (V10 / G10 / R5 セット換算)

export type PracticePlanResolved = {
  version: 1;

  // 時点情報
  todayISO: string;
  weekId: string | number | null;
  dayIndex: number; // 1..7想定
  isWeeklyCheckDay: boolean;

  // 練習級（統一）
  practiceLevel: JLPTLevel;
  goalLevel: JLPTLevel;

  // どのデータをソースにしたか
  source: {
    type: "diagnostic_phase2" | "weekly_check_v2" | "fallback";
    reason: string;
    weekRule: "week1_diagnostic" | "week2plus_weeklycheck" | "fallback";
  };

  // 配分決定の元になった rate
  rates: SkillRates;

  // 弱点判定の結果（正答率順で判断）
  ranking: Array<{ skill: Skill; rate: number }>; // 昇順（弱い→強い）
  distributionKind:
    | "weekly_check_day"
    | "all_equal_or_all_weak"
    | "one_weak"
    | "two_weak"
    | "staircase";

  // Day1〜6 の練習配分
  slotPattern: PracticeSlotPattern; // 合計9（Day7は0,0,0）
  questionCounts: PracticeQuestionCounts; // 実問数（セット換算）
  setSizes: Record<Skill, number>; // vocab=10 grammar=10 reading=5

  // 表示用メモ
  notes: string[];
};

// =====================
// Keys
// =====================
const ROADMAP_KEY = "lexio.roadmap.v1";
const ROADMAP_ACTIVE_KEY = "lexio.roadmap.active.v1";

const DIAG_SETTINGS_KEY = "lexio.diag.settings.v1";
const DIAG_PHASE2_RESULT_KEY = "lexio.diag.phase2.result.v1";

const PRACTICE_LEVEL_STATE_KEY = "lexio.practice.levelState.v1";
const WEEKLY_CHECK_RESULT_KEY = "lexio.weeklycheck.result.v2";

// =====================
// Stored shapes (minimum compatible)
// =====================
type RoadmapLike = {
  weekId?: string | number;
  days?: Array<{ dayIndex?: number; dateISO?: string }>;
  goalLevel?: JLPTLevel;
  level?: JLPTLevel;
};

type DiagSettings = {
  version?: number;
  goalLevel?: JLPTLevel;
};

type DiagPhase2Result = {
  version?: number;
  bySkill?: {
    vocab?: { rate?: number };
    grammar?: { rate?: number };
    reading?: { rate?: number };
  };
  weakestSkills?: Skill[];
};

type PracticeLevelState = {
  version?: number;
  currentPracticeLevel?: JLPTLevel;
  updatedAt?: string;
  source?: string;
};

type WeeklyCheckResultV2 = {
  version?: number;
  createdAt?: string;
  weekId?: string | number | null;
  dayIndex?: number;
  currentPracticeLevel?: JLPTLevel;
  sections?: {
    vocab?: { rate?: number };
    grammar?: { rate?: number };
    reading?: { rate?: number };
  };
  passedAllSkills90?: boolean;
};

// =====================
// Constants
// =====================
const SET_SIZES: Record<Skill, number> = {
  vocab: 10,
  grammar: 10,
  reading: 5,
};

const LEVEL_ORDER_ASC: JLPTLevel[] = ["N5", "N4", "N3", "N2", "N1"];

// =====================
// Basic helpers
// =====================
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

function asLevel(x: any): JLPTLevel {
  return x === "N5" || x === "N4" || x === "N3" || x === "N2" || x === "N1" ? x : "N5";
}

function asSkill(x: any): Skill {
  return x === "vocab" || x === "grammar" || x === "reading" ? x : "vocab";
}

function safeRate(x: any): number {
  const n = Number(x);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, n));
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function levelToIndex(level: JLPTLevel): number {
  return LEVEL_ORDER_ASC.indexOf(level);
}

function clampLevel(level: JLPTLevel): JLPTLevel {
  const i = Math.max(0, Math.min(LEVEL_ORDER_ASC.length - 1, levelToIndex(level)));
  return LEVEL_ORDER_ASC[i]!;
}

// =====================
// Roadmap helpers
// =====================
function readRoadmapWeek(): RoadmapLike | null {
  const active = readJSON<RoadmapLike>(ROADMAP_ACTIVE_KEY);
  if (active && Array.isArray(active.days) && active.days.length > 0) return active;

  const base = readJSON<RoadmapLike>(ROADMAP_KEY);
  if (base && Array.isArray(base.days) && base.days.length > 0) return base;

  return null;
}

/**
 * dayIndex を決める
 * - roadmap.days の today 一致を優先
 * - なければ 1 を返す（fallback）
 */
function resolveTodayDayIndexFromRoadmap(rm: RoadmapLike | null): number {
  if (!rm?.days?.length) return 1;
  const t = todayISO();
  const found = rm.days.find((d) => d?.dateISO === t);
  const di = Number(found?.dayIndex ?? 0);
  if (di >= 1 && di <= 7) return di;
  return 1;
}

function resolveWeekId(rm: RoadmapLike | null): string | number | null {
  return (rm?.weekId ?? null) as any;
}

/**
 * 週番号（1週目かどうか）を推定
 * 実装方針:
 * - roadmap.weekId が number ならそのまま
 * - "week-1", "1" など文字列なら number 抜き出し
 * - 取れない場合は 1 扱い（安全側）
 */
function resolveWeekNumber(weekId: string | number | null): number {
  if (typeof weekId === "number" && Number.isFinite(weekId)) {
    return Math.max(1, Math.floor(weekId));
  }
  if (typeof weekId === "string") {
    const m = weekId.match(/\d+/);
    if (m) {
      const n = Number(m[0]);
      if (Number.isFinite(n) && n >= 1) return Math.floor(n);
    }
  }
  return 1;
}

// =====================
// Goal / Practice level
// =====================
function readGoalLevel(): JLPTLevel {
  const ds = readJSON<DiagSettings>(DIAG_SETTINGS_KEY);
  if (ds?.goalLevel) return asLevel(ds.goalLevel);

  const rm = readRoadmapWeek();
  if (rm?.goalLevel) return asLevel(rm.goalLevel);
  if (rm?.level) return asLevel(rm.level);

  return "N5";
}

/**
 * 練習級は統一級で保持（あなたの最新確定仕様）
 */
function readPracticeLevelUnified(goalLevel: JLPTLevel): JLPTLevel {
  const st = readJSON<PracticeLevelState>(PRACTICE_LEVEL_STATE_KEY);
  if (st?.currentPracticeLevel) return clampLevel(asLevel(st.currentPracticeLevel));
  return goalLevel; // fallback
}

// =====================
// Source rates readers
// =====================
function readRatesFromDiagnosticPhase2(): SkillRates | null {
  const p2 = readJSON<DiagPhase2Result>(DIAG_PHASE2_RESULT_KEY);
  const by = p2?.bySkill;
  if (!by) return null;

  return {
    vocab: safeRate(by.vocab?.rate),
    grammar: safeRate(by.grammar?.rate),
    reading: safeRate(by.reading?.rate),
  };
}

function readRatesFromWeeklyCheckV2(): { rates: SkillRates; practiceLevel?: JLPTLevel } | null {
  const wc = readJSON<WeeklyCheckResultV2>(WEEKLY_CHECK_RESULT_KEY);
  if (!wc?.sections) return null;

  const rates: SkillRates = {
    vocab: safeRate(wc.sections.vocab?.rate),
    grammar: safeRate(wc.sections.grammar?.rate),
    reading: safeRate(wc.sections.reading?.rate),
  };

  const practiceLevel = wc.currentPracticeLevel ? asLevel(wc.currentPracticeLevel) : undefined;

  return { rates, practiceLevel };
}

// =====================
// Ranking & distribution logic
// （正答率順に並べて判断する、あなたの確定仕様）
// =====================
function buildRanking(rates: SkillRates): Array<{ skill: Skill; rate: number }> {
  // tie-breaker は固定順（安定）
  const order: Skill[] = ["vocab", "grammar", "reading"];
  return order
    .map((s) => ({ skill: s, rate: safeRate(rates[s]) }))
    .sort((a, b) => {
      if (a.rate !== b.rate) return a.rate - b.rate; // 弱い→強い
      return order.indexOf(a.skill) - order.indexOf(b.skill);
    });
}

/**
 * Day1は最弱4、2番弱点3、最も強い2（以降交互）
 * → strict staircase だけでなく weak2 でも「Day1最弱4、次弱3」で統一運用
 *
 * 判定ルール（ユーザー確定）:
 * - 70/70/70 => 3,3,3
 * - 60/60/80 => 弱点2個（交互）
 * - 60/75/75 => 弱点1個（5,2,2）
 * - それ以外の strict staircase => 4,3,2（交互）
 */
function resolveDistributionByRates(
  rates: SkillRates,
  dayIndex: number
): {
  distributionKind: PracticePlanResolved["distributionKind"];
  slotPattern: PracticeSlotPattern;
  ranking: Array<{ skill: Skill; rate: number }>;
  notes: string[];
} {
  const ranking = buildRanking(rates); // [weakest, middle, strongest]
  const [a, b, c] = ranking;

  const ra = a.rate;
  const rb = b.rate;
  const rc = c.rate;

  const notes: string[] = [];
  const oddDay = dayIndex % 2 === 1; // Day1,3,5 ...
  const zero: PracticeSlotPattern = { vocab: 0, grammar: 0, reading: 0 };

  // Day7は weekly check only
  if (dayIndex === 7) {
    notes.push("Day 7 is Weekly Check only. No regular practice distribution.");
    return {
      distributionKind: "weekly_check_day",
      slotPattern: zero,
      ranking,
      notes,
    };
  }

  // all equal => 3,3,3
  if (ra === rb && rb === rc) {
    notes.push("All skill rates are equal → use balanced 3,3,3.");
    return {
      distributionKind: "all_equal_or_all_weak",
      slotPattern: { vocab: 3, grammar: 3, reading: 3 },
      ranking,
      notes,
    };
  }

  // one weak: lowest unique, top two equal => 5,2,2
  // 例: 60,75,75
  if (ra < rb && rb === rc) {
    const out: PracticeSlotPattern = { vocab: 2, grammar: 2, reading: 2 };
    out[a.skill] = 5;
    notes.push(`One weak skill (${a.skill}) detected → use 5,2,2.`);
    return {
      distributionKind: "one_weak",
      slotPattern: out,
      ranking,
      notes,
    };
  }

  // two weak: lowest two equal, top unique => 4,3,2 / 3,4,2 alternating
  // 例: 60,60,80
  if (ra === rb && rb < rc) {
    const weakestA = a.skill;
    const weakestB = b.skill;
    const strongest = c.skill;

    const out: PracticeSlotPattern = { vocab: 0, grammar: 0, reading: 0 };
    if (oddDay) {
      out[weakestA] = 4;
      out[weakestB] = 3;
    } else {
      out[weakestA] = 3;
      out[weakestB] = 4;
    }
    out[strongest] = 2;

    notes.push("Two weak skills detected (tie at lowest) → alternate 4,3,2 and 3,4,2.");
    notes.push(`Day ${dayIndex}: ${oddDay ? weakestA + "=4, " + weakestB + "=3" : weakestA + "=3, " + weakestB + "=4"}.`);
    return {
      distributionKind: "two_weak",
      slotPattern: out,
      ranking,
      notes,
    };
  }

  // strict staircase: ra < rb < rc => 4,3,2 / 3,4,2 alternating
  // （あなたの「Day1最弱4、2番弱点3（以降交互）」に合わせる）
  if (ra < rb && rb < rc) {
    const out: PracticeSlotPattern = { vocab: 0, grammar: 0, reading: 0 };

    if (oddDay) {
      out[a.skill] = 4; // 最弱
      out[b.skill] = 3; // 2番目弱点
    } else {
      out[a.skill] = 3;
      out[b.skill] = 4;
    }
    out[c.skill] = 2; // strongest

    notes.push("Staircase weakness detected → alternate 4,3,2 and 3,4,2.");
    notes.push(`Day ${dayIndex}: ${oddDay ? `${a.skill}=4, ${b.skill}=3, ${c.skill}=2` : `${a.skill}=3, ${b.skill}=4, ${c.skill}=2`}.`);
    return {
      distributionKind: "staircase",
      slotPattern: out,
      ranking,
      notes,
    };
  }

  // 念のための最終fallback（理論上ほぼ到達しない）
  notes.push("Unclassified rate pattern → fallback to balanced 3,3,3.");
  return {
    distributionKind: "all_equal_or_all_weak",
    slotPattern: { vocab: 3, grammar: 3, reading: 3 },
    ranking,
    notes,
  };
}

function slotsToQuestionCounts(slotPattern: PracticeSlotPattern): PracticeQuestionCounts {
  return {
    vocab: slotPattern.vocab * SET_SIZES.vocab,
    grammar: slotPattern.grammar * SET_SIZES.grammar,
    reading: slotPattern.reading * SET_SIZES.reading,
  };
}

// =====================
// Main resolver
// =====================
export function resolvePracticePlanForToday(): PracticePlanResolved {
  const rm = readRoadmapWeek();
  const weekId = resolveWeekId(rm);
  const weekNo = resolveWeekNumber(weekId);
  const dayIndex = resolveTodayDayIndexFromRoadmap(rm);

  const goalLevel = readGoalLevel();
  let practiceLevel = readPracticeLevelUnified(goalLevel);

  let rates: SkillRates = { vocab: 0, grammar: 0, reading: 0 };
  let sourceType: PracticePlanResolved["source"]["type"] = "fallback";
  let sourceReason = "No source data found; fallback balanced distribution.";
  let weekRule: PracticePlanResolved["source"]["weekRule"] = "fallback";
  const notes: string[] = [];

  // 1週目: diagnostic phase2
  if (weekNo <= 1) {
    const fromDiag = readRatesFromDiagnosticPhase2();
    if (fromDiag) {
      rates = fromDiag;
      sourceType = "diagnostic_phase2";
      sourceReason = "Week 1 uses diagnostic phase2 bySkill.rate.";
      weekRule = "week1_diagnostic";
      notes.push("Week 1 rule: use diagnostic phase2 bySkill.rate.");
    } else {
      rates = { vocab: 0, grammar: 0, reading: 0 };
      sourceType = "fallback";
      sourceReason = "Week 1 but diagnostic phase2 result not found.";
      weekRule = "fallback";
      notes.push("Week 1 fallback: diagnostic phase2 result missing.");
    }
  } else {
    // 2週目以降: weekly check v2
    const fromWc = readRatesFromWeeklyCheckV2();
    if (fromWc) {
      rates = fromWc.rates;
      sourceType = "weekly_check_v2";
      sourceReason = "Week 2+ uses weekly check v2 sections.*.rate.";
      weekRule = "week2plus_weeklycheck";
      notes.push("Week 2+ rule: use weekly check v2 sections rates.");
      // practiceLevel は統一級stateが正だが、万一 state が壊れていて weekly result にあるなら補助として採用してもよい
      if (!readJSON<PracticeLevelState>(PRACTICE_LEVEL_STATE_KEY)?.currentPracticeLevel && fromWc.practiceLevel) {
        practiceLevel = fromWc.practiceLevel;
        notes.push("Practice level recovered from weekly check result (state missing).");
      }
    } else {
      // weekly check 未実施/未保存時 fallback
      rates = { vocab: 0, grammar: 0, reading: 0 };
      sourceType = "fallback";
      sourceReason = "Week 2+ but weekly check result v2 not found.";
      weekRule = "fallback";
      notes.push("Week 2+ fallback: weekly check result v2 missing.");
    }
  }

  const dist = resolveDistributionByRates(rates, dayIndex);
  const questionCounts = slotsToQuestionCounts(dist.slotPattern);

  return {
    version: 1,
    todayISO: todayISO(),
    weekId,
    dayIndex,
    isWeeklyCheckDay: dayIndex === 7,

    practiceLevel,
    goalLevel,

    source: {
      type: sourceType,
      reason: sourceReason,
      weekRule,
    },

    rates,
    ranking: dist.ranking,
    distributionKind: dist.distributionKind,

    slotPattern: dist.slotPattern,
    questionCounts,
    setSizes: SET_SIZES,

    notes: [...notes, ...dist.notes],
  };
}

// =====================
// Optional helpers for callers (便利関数)
// =====================

/**
 * 練習画面側で使いやすい形に変換
 * - Day7なら weekly-check に誘導
 * - Day1〜6なら skillごとのセット回数と実問数を返す
 */
export function resolvePracticeExecutionForToday() {
  const plan = resolvePracticePlanForToday();

  if (plan.isWeeklyCheckDay) {
    return {
      kind: "weekly-check" as const,
      route: "/practice/weekly-check",
      plan,
    };
  }

  return {
    kind: "practice" as const,
    route: "/practice/session",
    practiceLevel: plan.practiceLevel,
    slotPattern: plan.slotPattern, // 例: { vocab:4, grammar:3, reading:2 }
    questionCounts: plan.questionCounts, // 例: { vocab:40, grammar:30, reading:10 }
    plan,
  };
}