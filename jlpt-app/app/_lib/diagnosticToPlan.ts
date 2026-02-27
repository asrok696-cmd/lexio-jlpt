// app/_lib/diagnosticToPlan.ts
// ============================================================
// Diagnostic -> Study Plan (initialization only)
// - Phase0(goal), Phase1(estimated current), Phase2(bySkill rates) から
//   初期StudyPlanを生成する
// - ここでは「昇格実行」はしない（weeklyProgression.ts の責務）
// - 1週目の配分は Phase2 の bySkill.rate を使う
//
// ✅ 追加:
// - practice/page.tsx 側が参照する plan.week.days[].setCounts をここで生成して埋める
// - 弱点別に Day1-6 のセット数が変わる（two-weak tie は日毎に 4/3 を交互）
// ============================================================

export type JLPTLevel = "N5" | "N4" | "N3" | "N2" | "N1";
export type Skill = "vocab" | "grammar" | "reading";

export const DIAG_SETTINGS_KEY = "lexio.diag.settings.v1";
export const DIAG_PHASE1_KEY = "lexio.diag.phase1.v1";
export const DIAG_PHASE2_RESULT_KEY = "lexio.diag.phase2.result.v1";

// Study plan key（既存で別キー使ってるなら合わせて変更してOK）
export const STUDY_PLAN_KEY = "lexio.studyPlan.v1";

type DiagnosticSettings = {
  version: 1;
  examDateISO?: string | null;
  goalLevel: JLPTLevel;
  updatedAt: string;
};

type Phase1Stored = {
  estimatedLevel?: JLPTLevel;
  estimated?: JLPTLevel; // 旧互換
};

type SkillStats = {
  total: number;
  correct: number;
  rate: number; // 0..100
};

type Phase2Stored = {
  version: 1;
  createdAt: string;
  baseLevel?: JLPTLevel | null;
  total: number;
  correct: number;
  bySkill: Record<Skill, SkillStats>;
  weakestSkills: Skill[];
  answers: Array<{
    qid: string;
    choice: number;
    correct: boolean;
    skill: Skill;
    level: JLPTLevel;
  }>;
};

export type StudyPlanSkillAllocation = Record<Skill, number>;

export type StudyPlanWeekPolicy = {
  source: "diagnostic-phase2" | "weekly-check";
  sourceWeekId?: string | null;
  bySkillRate: Record<Skill, number>;
  allocation: StudyPlanSkillAllocation; // e.g. {vocab:4, grammar:3, reading:2}
  pattern:
    | "all_equal_3_3_3"
    | "single_weak_5_2_2"
    | "two_weak_tie_alt_4_3_2"
    | "stair_4_3_2";
  // 弱点2つtieのとき、日ごとの交互用（Day1はfirstWeak=4, secondWeak=3）
  twoWeakTieOrder?: [Skill, Skill] | null;
};

export type StudyPlanPromotion = {
  // 練習級は統一（skill別ではない）
  currentPracticeLevel: JLPTLevel;
  consecutiveAll90Weeks: number; // weekly checkで all V/G/R >= 90 の連続数
  lastPromotionAtISO?: string | null;
  // どの weekly result を昇格/反映に使ったか（重複適用防止）
  // weeklyProgression.ts 側で更新する
  promotionConsumedForWeekId?: string | null;
};

// ✅ practice/page.tsx の isStudyPlanV2 が期待している形に寄せる
export type StudyPlanWeekDayV2 = {
  dayIndex: number; // 1..7
  dateISO: string; // YYYY-MM-DD (local)
  // practice/page.tsx の resolvePracticeSetCountsForDay が参照する
  setCounts?: Partial<Record<Skill, number>>;
  practiceSetCounts?: Partial<Record<Skill, number>>; // 互換
  targets: Record<Skill, number>;
  targetsMinutes?: Record<Skill, number>;
  // 任意
  notes?: string[];
};

export type StudyPlanWeekV2 = {
  startISO: string; // weekId としても使える
  days: StudyPlanWeekDayV2[];
};

export type StudyPlanTodayV2 = {
  dateISO: string; // YYYY-MM-DD (local)
  targets: Record<Skill, number>;
  targetsMinutes?: Record<Skill, number>;
};

export type StudyPlan = {
  version: 2;
  createdAt: string;
  updatedAt: string;

  goalLevel: JLPTLevel;
  estimatedCurrentLevel: JLPTLevel;
  examDateISO?: string | null;

  // 練習は統一級
  practiceLevel: JLPTLevel;

  // 週配分ポリシー（直近のもの）
  currentWeekPolicy: StudyPlanWeekPolicy;

  // ✅ practice/page.tsx が参照する（isStudyPlanV2）
  week: StudyPlanWeekV2;
  today: StudyPlanTodayV2;

  // Day7固定仕様
  day7WeeklyCheckOnly: true;

  // 昇格状態（実行は weeklyProgression.ts）
  promotion: StudyPlanPromotion;

  // メタ
  meta?: {
    initializedFromDiagnosticAtISO: string;
    diagnosticPhase2CreatedAtISO?: string | null;
    notes?: string[];
  };
};

// ---------- storage helpers ----------
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

// ---------- type guards ----------
function isJLPTLevel(v: any): v is JLPTLevel {
  return v === "N5" || v === "N4" || v === "N3" || v === "N2" || v === "N1";
}

function asJLPTLevel(v: any, fallback: JLPTLevel = "N5"): JLPTLevel {
  return isJLPTLevel(v) ? v : fallback;
}

function safeRate(n: any): number {
  const x = Number(n);
  if (!Number.isFinite(x)) return 0;
  return Math.max(0, Math.min(100, x));
}

function nowISO() {
  return new Date().toISOString();
}

// ✅ local date helper (YYYY-MM-DD)
function todayLocalISO(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function addDaysLocalISO(startISO: string, plusDays: number): string {
  // startISO is YYYY-MM-DD (local)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startISO)) return startISO;
  const [y, m, d] = startISO.split("-").map(Number);
  const base = new Date(y, (m ?? 1) - 1, d ?? 1);
  base.setDate(base.getDate() + plusDays);
  const yyyy = base.getFullYear();
  const mm = String(base.getMonth() + 1).padStart(2, "0");
  const dd = String(base.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

// ---------- JLPT level helpers ----------
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

/**
 * 初期練習級（統一級）
 *
 * 仕様:
 * - 現状 < 目標 -> 常に1段上から開始（ただし目標を超えない）
 * - 現状 = 目標 -> 目標級
 * - 現状 > 目標 -> 目標級
 */
export function decideInitialPracticeLevel(args: {
  estimatedCurrentLevel: JLPTLevel;
  goalLevel: JLPTLevel;
}): JLPTLevel {
  const cur = args.estimatedCurrentLevel;
  const goal = args.goalLevel;

  const ci = levelIndex(cur);
  const gi = levelIndex(goal);

  if (ci > gi) {
    // 現状が目標より上（例 N2 > N3）→ 目標級を出す
    return goal;
  }

  if (ci === gi) {
    return goal;
  }

  // 現状 < 目標 → 1段上から開始（上限は目標）
  return levelByIndex(Math.min(ci + 1, gi));
}

// ---------- allocation (phase2 / weekly共通ロジックの土台) ----------
type SkillRatePair = { skill: Skill; rate: number };

function readRatesFromPhase2(p2: Phase2Stored | null): Record<Skill, number> {
  return {
    vocab: safeRate(p2?.bySkill?.vocab?.rate),
    grammar: safeRate(p2?.bySkill?.grammar?.rate),
    reading: safeRate(p2?.bySkill?.reading?.rate),
  };
}

/**
 * 正答率順で判定（閾値なし）
 *
 * ルール（あなたの最終仕様）:
 * - 全同率 -> 3,3,3
 * - 弱点1個（最下位1つ、上位2つ同率） -> 5,2,2
 * - 弱点2個（最下位2つ同率、最上位1つ） -> 4,3,2 / 3,4,2 の交互
 *   Day1は最弱点に4、2番弱点に3（ここでは order を返す）
 * - 階段状（3つ全て異なる） -> 4,3,2（低い順に 4,3,2）
 */
export function buildWeekPolicyFromRates(args: {
  bySkillRate: Record<Skill, number>;
  source: "diagnostic-phase2" | "weekly-check";
  sourceWeekId?: string | null;
}): StudyPlanWeekPolicy {
  const bySkillRate = {
    vocab: safeRate(args.bySkillRate.vocab),
    grammar: safeRate(args.bySkillRate.grammar),
    reading: safeRate(args.bySkillRate.reading),
  };

  const arr: SkillRatePair[] = [
    { skill: "vocab", rate: bySkillRate.vocab },
    { skill: "grammar", rate: bySkillRate.grammar },
    { skill: "reading", rate: bySkillRate.reading },
  ];

  // rate昇順。tie時は skill名順で安定化（vocab, grammar, reading）
  arr.sort((a, b) => {
    if (a.rate !== b.rate) return a.rate - b.rate;
    return a.skill.localeCompare(b.skill);
  });

  const [a, b, c] = arr; // a=最下位, c=最上位
  const allEqual = a.rate === b.rate && b.rate === c.rate;
  const singleWeak = a.rate < b.rate && b.rate === c.rate;
  const twoWeakTie = a.rate === b.rate && b.rate < c.rate;

  if (allEqual) {
    return {
      source: args.source,
      sourceWeekId: args.sourceWeekId ?? null,
      bySkillRate,
      allocation: { vocab: 3, grammar: 3, reading: 3 },
      pattern: "all_equal_3_3_3",
      twoWeakTieOrder: null,
    };
  }

  if (singleWeak) {
    // 最弱点だけ 5、残り2つ 2,2
    return {
      source: args.source,
      sourceWeekId: args.sourceWeekId ?? null,
      bySkillRate,
      allocation: {
        vocab: a.skill === "vocab" ? 5 : 2,
        grammar: a.skill === "grammar" ? 5 : 2,
        reading: a.skill === "reading" ? 5 : 2,
      },
      pattern: "single_weak_5_2_2",
      twoWeakTieOrder: null,
    };
  }

  if (twoWeakTie) {
    // 4,3,2 を日ごと交互にする前提で、Day1の順序を記録
    // Day1は firstWeak(=a) に4、secondWeak(=b) に3、strongest(=c) に2
    return {
      source: args.source,
      sourceWeekId: args.sourceWeekId ?? null,
      bySkillRate,
      allocation: {
        vocab: c.skill === "vocab" ? 2 : a.skill === "vocab" ? 4 : 3,
        grammar: c.skill === "grammar" ? 2 : a.skill === "grammar" ? 4 : 3,
        reading: c.skill === "reading" ? 2 : a.skill === "reading" ? 4 : 3,
      },
      pattern: "two_weak_tie_alt_4_3_2",
      twoWeakTieOrder: [a.skill, b.skill],
    };
  }

  // stair 扱い + その他（保険）もここへ
  // 低い順に 4,3,2
  return {
    source: args.source,
    sourceWeekId: args.sourceWeekId ?? null,
    bySkillRate,
    allocation: {
      vocab: a.skill === "vocab" ? 4 : b.skill === "vocab" ? 3 : 2,
      grammar: a.skill === "grammar" ? 4 : b.skill === "grammar" ? 3 : 2,
      reading: a.skill === "reading" ? 4 : b.skill === "reading" ? 3 : 2,
    },
    pattern: "stair_4_3_2",
    twoWeakTieOrder: null,
  };
}

// ✅ 追加: policy → Day1-6 の setCounts を作る
type SetCounts = Record<Skill, number>;

function clampMin1(n: any): number {
  const v = Number(n);
  if (!Number.isFinite(v) || v <= 0) return 1;
  return Math.max(1, Math.floor(v));
}

export function buildDaySetCountsFromWeekPolicy(policy: StudyPlanWeekPolicy): SetCounts[] {
  const alloc = policy.allocation;

  const base: SetCounts = {
    vocab: clampMin1(alloc.vocab),
    grammar: clampMin1(alloc.grammar),
    reading: clampMin1(alloc.reading),
  };

  // Day1-6（6日分）
  const days: SetCounts[] = Array.from({ length: 6 }).map(() => ({ ...base }));

  // two weak tie のときだけ交互ロジック
  if (policy.pattern === "two_weak_tie_alt_4_3_2" && policy.twoWeakTieOrder?.length === 2) {
    const [firstWeak, secondWeak] = policy.twoWeakTieOrder;

    // strongest は allocation の中で "2" になってるskill（保険）
    const strongest: Skill =
      (["vocab", "grammar", "reading"] as Skill[]).find((s) => Number(base[s]) === 2) ?? "reading";

    for (let i = 0; i < days.length; i++) {
      const isOdd = (i + 1) % 2 === 1; // Day1,3,5...
      const dayAlloc: SetCounts = { vocab: 2, grammar: 2, reading: 2 };

      dayAlloc[strongest] = 2;
      dayAlloc[firstWeak] = isOdd ? 4 : 3;
      dayAlloc[secondWeak] = isOdd ? 3 : 4;

      // 最低1保証
      dayAlloc.vocab = clampMin1(dayAlloc.vocab);
      dayAlloc.grammar = clampMin1(dayAlloc.grammar);
      dayAlloc.reading = clampMin1(dayAlloc.reading);

      days[i] = dayAlloc;
    }
  }

  return days;
}

// ✅ 追加: setCounts → targets/targetsMinutes（practice側の fallback 互換のため）
function targetsFromSetCounts(setCounts: SetCounts): Record<Skill, number> {
  // ここは「分」でも「目標」でもよいが、practice/page.tsx は /10 で setCounts 推定してるので
  // 10分=1セット相当にしておくと辻褄が合う
  return {
    vocab: clampMin1(setCounts.vocab) * 10,
    grammar: clampMin1(setCounts.grammar) * 10,
    reading: clampMin1(setCounts.reading) * 10,
  };
}

// ✅ 追加: Week(days) を生成して plan.week に入れる
function buildWeekV2FromPolicy(args: {
  weekStartISO: string; // local YYYY-MM-DD
  policy: StudyPlanWeekPolicy;
}): StudyPlanWeekV2 {
  const daySetCounts = buildDaySetCountsFromWeekPolicy(args.policy);

  const days: StudyPlanWeekDayV2[] = Array.from({ length: 7 }).map((_, i) => {
    const dayIndex = i + 1;
    const dateISO = addDaysLocalISO(args.weekStartISO, i);

    if (dayIndex === 7) {
      return {
        dayIndex,
        dateISO,
        setCounts: { vocab: 0, grammar: 0, reading: 0 },
        targets: { vocab: 0, grammar: 0, reading: 0 },
        targetsMinutes: { vocab: 0, grammar: 0, reading: 0 },
        notes: ["Day7 is weekly-check only."],
      };
    }

    const sc = daySetCounts[i] ?? { vocab: 3, grammar: 3, reading: 3 };
    const targets = targetsFromSetCounts(sc);

    return {
      dayIndex,
      dateISO,
      setCounts: sc,
      targets,
      targetsMinutes: targets,
    };
  });

  return { startISO: args.weekStartISO, days };
}

// ---------- readers ----------
function readDiagSettings(): DiagnosticSettings | null {
  const v = readJSON<any>(DIAG_SETTINGS_KEY);
  if (!v || typeof v !== "object") return null;
  return {
    version: 1,
    goalLevel: asJLPTLevel(v.goalLevel, "N5"),
    examDateISO: typeof v.examDateISO === "string" ? v.examDateISO : null,
    updatedAt: typeof v.updatedAt === "string" ? v.updatedAt : nowISO(),
  };
}

function readPhase1EstimatedLevel(): JLPTLevel {
  const p1 = readJSON<Phase1Stored>(DIAG_PHASE1_KEY);
  return asJLPTLevel(p1?.estimatedLevel ?? p1?.estimated, "N5");
}

function readPhase2Result(): Phase2Stored | null {
  const p2 = readJSON<any>(DIAG_PHASE2_RESULT_KEY);
  if (!p2 || typeof p2 !== "object") return null;

  const bySkill = {
    vocab: {
      total: Number(p2?.bySkill?.vocab?.total ?? 0),
      correct: Number(p2?.bySkill?.vocab?.correct ?? 0),
      rate: safeRate(p2?.bySkill?.vocab?.rate),
    },
    grammar: {
      total: Number(p2?.bySkill?.grammar?.total ?? 0),
      correct: Number(p2?.bySkill?.grammar?.correct ?? 0),
      rate: safeRate(p2?.bySkill?.grammar?.rate),
    },
    reading: {
      total: Number(p2?.bySkill?.reading?.total ?? 0),
      correct: Number(p2?.bySkill?.reading?.correct ?? 0),
      rate: safeRate(p2?.bySkill?.reading?.rate),
    },
  } satisfies Record<Skill, SkillStats>;

  return {
    version: 1,
    createdAt: typeof p2.createdAt === "string" ? p2.createdAt : nowISO(),
    baseLevel: p2.baseLevel ? asJLPTLevel(p2.baseLevel, "N5") : null,
    total: Number(p2.total ?? 0),
    correct: Number(p2.correct ?? 0),
    bySkill,
    weakestSkills: Array.isArray(p2.weakestSkills) ? p2.weakestSkills.filter(isSkillLoose) : [],
    answers: Array.isArray(p2.answers) ? p2.answers : [],
  };
}

function isSkillLoose(v: any): v is Skill {
  return v === "vocab" || v === "grammar" || v === "reading";
}

// ---------- public API ----------
/**
 * 診断結果から初期StudyPlanを生成
 *
 * force=true:
 *   - 既存planがあっても上書き再生成
 * force=false:
 *   - 既存planがあればそのまま返す
 */
export function ensureStudyPlanFromDiagnostic(force = false): StudyPlan | null {
  const existing = readJSON<StudyPlan>(STUDY_PLAN_KEY);
  if (existing && !force) return existing;

  const settings = readDiagSettings();
  if (!settings) return null; // phase0未実施

  const estimatedCurrentLevel = readPhase1EstimatedLevel();
  const goalLevel = asJLPTLevel(settings.goalLevel, "N5");
  const p2 = readPhase2Result();

  const initialPracticeLevel = decideInitialPracticeLevel({
    estimatedCurrentLevel,
    goalLevel,
  });

  // 1週目配分は phase2 bySkill.rate を使う（なければ 3,3,3 fallback）
  const phase2Rates = readRatesFromPhase2(p2);
  const week1Policy = buildWeekPolicyFromRates({
    bySkillRate: phase2Rates,
    source: "diagnostic-phase2",
    sourceWeekId: null,
  });

  const now = nowISO();

  // ✅ week.days を作る（setCounts を埋める＝弱点でセット数が変わる根幹）
  const weekStartISO = todayLocalISO();
  const week = buildWeekV2FromPolicy({ weekStartISO, policy: week1Policy });

  // ✅ today も isStudyPlanV2 の条件に合わせて埋める
  const todayDay = week.days.find((d) => d.dateISO === weekStartISO) ?? week.days[0];
  const today: StudyPlanTodayV2 = {
    dateISO: todayDay?.dateISO ?? weekStartISO,
    targets: todayDay?.targets ?? { vocab: 30, grammar: 30, reading: 30 },
    targetsMinutes: todayDay?.targetsMinutes ?? todayDay?.targets ?? { vocab: 30, grammar: 30, reading: 30 },
  };

  const plan: StudyPlan = {
    version: 2,
    createdAt: now,
    updatedAt: now,

    goalLevel,
    estimatedCurrentLevel,
    examDateISO: settings.examDateISO ?? null,

    practiceLevel: initialPracticeLevel,

    currentWeekPolicy: week1Policy,

    week,
    today,

    day7WeeklyCheckOnly: true,

    promotion: {
      currentPracticeLevel: initialPracticeLevel,
      consecutiveAll90Weeks: 0,
      lastPromotionAtISO: null,
      promotionConsumedForWeekId: null, // weeklyProgression.ts が管理
    },

    meta: {
      initializedFromDiagnosticAtISO: now,
      diagnosticPhase2CreatedAtISO: p2?.createdAt ?? null,
      notes: [
        "Week1 allocation is based on Diagnostic Phase2 bySkill.rate.",
        "Day1-6 setCounts are generated from the week policy (weakness-based).",
        "Promotion is NOT applied here. Use weeklyProgression.ts for weekly-check based updates.",
        "Day7 is weekly-check only.",
      ],
    },
  };

  writeJSON(STUDY_PLAN_KEY, plan);
  return plan;
}