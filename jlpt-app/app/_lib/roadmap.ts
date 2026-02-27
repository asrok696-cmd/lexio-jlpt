// app/_lib/roadmap.ts

// ============================================================
// Roadmap core (compat-safe)
// - v1/v2 mixed localStorage support
// - practice set detection for 9-set plan (vocab_01 / grammar_01 / reading_01)
// - progress helpers used by session pages
// ============================================================

// -----------------------------
// Basic domain types
// -----------------------------
export type JLPTLevel = "N5" | "N4" | "N3" | "N2" | "N1";
export type Skill = "vocab" | "grammar" | "reading";

export type DayStatus = "todo" | "in_progress" | "finish";

export type MasteryProgress = {
  total: number;
  mastered: string[];
  remaining: string[];
  wrongEver: string[];
  attempts: number;
  startedAtISO?: string;
  finishedAt?: string;
};

export type RoadmapSet = {
  setId: string;
  skill: Skill;
  plannedCount?: number;
  questionIds: string[];
  progress?: MasteryProgress;
  // misc compat fields
  meta?: Record<string, any>;
  [k: string]: any;
};

export type RoadmapDay = {
  dayIndex: number;
  dateISO: string;
  status: DayStatus;
  focusSkill: Skill;

  // compat: old/new both
  targets?: Record<Skill, number>;
  targetsMinutes?: Record<Skill, number>;

  sets: RoadmapSet[];

  // misc compat fields
  finishedAt?: string;
  meta?: Record<string, any>;
  [k: string]: any;
};

export type RoadmapWeekV1 = {
  version?: 1 | 2;
  weekId: string;
  goalLevel: JLPTLevel;

  // legacy fallback
  level?: JLPTLevel;

  days: RoadmapDay[];

  createdAt?: string;
  updatedAt?: string;
  meta?: Record<string, any>;
  [k: string]: any;
};

// -----------------------------
// Storage keys
// -----------------------------
export const ROADMAP_KEY = "lexio.roadmap.v1";
export const ROADMAP_ACTIVE_KEY = "lexio.roadmap.active.v1";
export const PRACTICE_LOG_KEY = "lexio.practiceLog.v1";

// -----------------------------
// JSON helpers
// -----------------------------
export function readJSON<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function writeJSON<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // no-op (quota/private mode etc.)
  }
}

// -----------------------------
// Date helper
// -----------------------------
/**
 * Local date (YYYY-MM-DD)
 * UTCズレを避けるためローカル日付で作る
 */
export function todayISO(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// -----------------------------
// Mastery progress helper
// -----------------------------
export function makeMasteryProgress(questionIds: string[]): MasteryProgress {
  const uniq = Array.from(
    new Set((Array.isArray(questionIds) ? questionIds : []).filter((x): x is string => typeof x === "string" && !!x))
  );

  return {
    total: uniq.length,
    mastered: [],
    remaining: [...uniq],
    wrongEver: [],
    attempts: 0,
  };
}

// -----------------------------
// Practice set detection
// -----------------------------
/**
 * practice set かどうかを判定
 *
 * ✅ practice 扱い:
 * - vocab_01, vocab_02, ...
 * - grammar_01, ...
 * - reading_01, ...
 * - （互換）vocab_main / grammar_main / reading_main など prefix ベースも許容
 *
 * ❌ practice 扱いしない:
 * - yesterday_mistakes（回収用）
 * - carryover 系
 * - weekly / wc 系
 * - main（旧単一セット名）
 *
 * Day完了判定で使うため、ここを厳密にしておく。
 */
export function isPracticeSet(input: unknown): boolean {
  const s = normalizeSetLike(input);
  if (!s) return false;

  const setId = String(s.setId ?? "").trim();
  const skill = s.skill;

  if (!setId || !isSkill(skill)) return false;

  // 明示的に除外したいもの
  if (
    setId === "yesterday_mistakes" ||
    setId === "carryover" ||
    setId.startsWith("carryover_") ||
    setId === "main" ||
    setId.startsWith("wc_") ||
    setId.startsWith("weekly")
  ) {
    return false;
  }

  // 新仕様: skill_nn（推奨）
  // vocab_01 / grammar_03 / reading_02
  const strictPattern = /^(vocab|grammar|reading)_(\d{1,3})$/;
  const m = setId.match(strictPattern);
  if (m) {
    return m[1] === skill;
  }

  // 互換: skillで始まるセット（例: vocab_main など）
  // ただし yesterday_mistakes 等は上で除外済み
  if (setId.startsWith(`${skill}_`)) return true;

  return false;
}

function normalizeSetLike(v: unknown): { setId?: unknown; skill?: unknown } | null {
  if (!v || typeof v !== "object") return null;
  return v as any;
}

function isSkill(v: unknown): v is Skill {
  return v === "vocab" || v === "grammar" || v === "reading";
}

// -----------------------------
// Optional small helpers (compat / utility)
// -----------------------------
export function isJLPTLevel(v: unknown): v is JLPTLevel {
  return v === "N5" || v === "N4" || v === "N3" || v === "N2" || v === "N1";
}

/**
 * 読み込み時に最低限 shape を整える軽いガード（必要な時だけ使う想定）
 */
export function normalizeRoadmapWeekLoose(v: unknown): RoadmapWeekV1 | null {
  if (!v || typeof v !== "object") return null;
  const x = v as any;
  if (!Array.isArray(x.days)) return null;

  const days: RoadmapDay[] = x.days
    .filter((d: any) => d && typeof d === "object")
    .map((d: any, idx: number) => {
      const dayIndex = Number(d.dayIndex ?? idx + 1);
      const focusSkill: Skill = isSkill(d.focusSkill) ? d.focusSkill : "vocab";

      const rawSets = Array.isArray(d.sets) ? d.sets : [];
      const sets: RoadmapSet[] = rawSets
        .filter((s: any) => s && typeof s === "object")
        .map((s: any) => ({
          ...s,
          setId: String(s.setId ?? ""),
          skill: isSkill(s.skill) ? s.skill : focusSkill,
          questionIds: Array.isArray(s.questionIds)
            ? s.questionIds.filter((q: any): q is string => typeof q === "string")
            : [],
          progress: normalizeProgressLoose(s.progress, s.questionIds),
        }));

      const targetsFallback = { vocab: 0, grammar: 0, reading: 0 } as Record<Skill, number>;
      const t1 = normalizeSkillNumberMap(d.targets) ?? null;
      const t2 = normalizeSkillNumberMap(d.targetsMinutes) ?? null;

      return {
        ...d,
        dayIndex: Number.isFinite(dayIndex) ? dayIndex : idx + 1,
        dateISO: typeof d.dateISO === "string" ? d.dateISO : "",
        status: d.status === "in_progress" || d.status === "finish" ? d.status : "todo",
        focusSkill,
        targets: t1 ?? t2 ?? targetsFallback,
        targetsMinutes: t2 ?? t1 ?? targetsFallback,
        sets,
      } as RoadmapDay;
    });

  const goalLevel: JLPTLevel = isJLPTLevel(x.goalLevel) ? x.goalLevel : isJLPTLevel(x.level) ? x.level : "N5";

  return {
    ...x,
    weekId: typeof x.weekId === "string" && x.weekId ? x.weekId : `wk-${todayISO()}`,
    goalLevel,
    level: goalLevel,
    days,
  } as RoadmapWeekV1;
}

function normalizeProgressLoose(progress: any, questionIds: any): MasteryProgress {
  const ids = Array.isArray(questionIds) ? questionIds.filter((q): q is string => typeof q === "string") : [];
  const base = makeMasteryProgress(ids);

  if (!progress || typeof progress !== "object") return base;

  const mastered = arrStr(progress.mastered);
  const wrongEver = arrStr(progress.wrongEver);
  const remainingRaw = arrStr(progress.remaining);

  const uniqIds = Array.from(new Set(ids));
  const masteredSet = new Set(mastered.filter((id) => uniqIds.includes(id)));
  const remaining = (remainingRaw.length ? remainingRaw : uniqIds).filter((id) => !masteredSet.has(id));

  return {
    total: uniqIds.length,
    mastered: Array.from(masteredSet),
    remaining,
    wrongEver: Array.from(new Set(wrongEver)),
    attempts: safeInt(progress.attempts, 0),
    startedAtISO: typeof progress.startedAtISO === "string" ? progress.startedAtISO : undefined,
    finishedAt: typeof progress.finishedAt === "string" ? progress.finishedAt : undefined,
  };
}

function normalizeSkillNumberMap(v: any): Record<Skill, number> | null {
  if (!v || typeof v !== "object") return null;
  return {
    vocab: safeInt(v.vocab, 0),
    grammar: safeInt(v.grammar, 0),
    reading: safeInt(v.reading, 0),
  };
}

function arrStr(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === "string");
}

function safeInt(v: unknown, fallback = 0): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.floor(n));
}