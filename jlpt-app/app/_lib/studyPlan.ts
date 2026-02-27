// app/_lib/studyPlan.ts
export const EXAM_DATE_KEY = "jlpt_exam_date_v1";
export const STUDY_PLAN_KEY = "lexio.studyPlan.v2";

export type Skill = "vocab" | "grammar" | "reading";

export type ExamDatePayload = {
  dateISO: string;
  updatedAt: string;
};

export type StudyPlanDay = {
  dayIndex: number; // 1..7
  dateISO: string;  // YYYY-MM-DD
  focus?: Skill;
  headline?: string;
  notes?: string[];
  targets?: Record<Skill, number>;
  actions?: Array<{ label: string; href: string }>;
};

export type StudyPlan = {
  version: 2;
  createdAtISO: string;
  today: {
    dateISO: string;
    targets: Record<Skill, number>;
  };
  week: {
    // startISO は今なくても動くけど、後で便利なので optional にしておく
    startISO?: string;
    days: StudyPlanDay[];
  };
};

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

export function todayISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function daysUntil(fromISO: string, toISO: string) {
  const a = new Date(fromISO).getTime();
  const b = new Date(toISO).getTime();
  const diff = Math.ceil((b - a) / (1000 * 60 * 60 * 24));
  return diff;
}

// --------------------
// ✅ ここから追加（Practice/Weekly-check 用）
// --------------------

export function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export function sumTargets(t?: Partial<Record<Skill, number>> | null) {
  if (!t) return 0;
  return (t.vocab ?? 0) + (t.grammar ?? 0) + (t.reading ?? 0);
}

export function isStudyPlanV2(x: any): x is StudyPlan {
  return (
    !!x &&
    x.version === 2 &&
    typeof x.createdAtISO === "string" &&
    !!x.today &&
    typeof x.today.dateISO === "string" &&
    !!x.today.targets &&
    !!x.week &&
    Array.isArray(x.week.days)
  );
}

/**
 * ✅ week.days の中から「今日」を探す
 * 見つからなければ null
 */
export function getTodayFromWeek(plan: StudyPlan, iso: string = todayISO()): StudyPlanDay | null {
  const days = plan?.week?.days;
  if (!Array.isArray(days)) return null;
  return (days.find((d) => d?.dateISO === iso) as StudyPlanDay) ?? null;
}

/**
 * ✅ Practice が使う「今日のtargets」を1本化
 * 優先：week.days の今日 → plan.today → null
 */
export function getTodayTargets(plan: StudyPlan, iso: string = todayISO()): Record<Skill, number> | null {
  const fromWeek = getTodayFromWeek(plan, iso);
  if (fromWeek?.targets) return fromWeek.targets;
  if (plan?.today?.dateISO === iso && plan.today.targets) return plan.today.targets;
  return null;
}