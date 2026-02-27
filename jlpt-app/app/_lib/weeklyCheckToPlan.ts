// app/_lib/weeklyCheckToPlan.ts

import {
  ROADMAP_ACTIVE_KEY,
  ROADMAP_KEY,
  readJSON,
  writeJSON,
  type Skill,
  type JLPTLevel,
} from "@/app/_lib/roadmap";
import { toWeekV1FromRoadmap } from "@/app/_lib/roadmapCompat";
import { WEEKLY_BANK } from "@/app/_lib/weeklyCheckBank";
import { WEEKLY_CHECK_KEY } from "@/app/_lib/weeklyCheck";

/**
 * ============================================================
 * Types (loose / compat-first)
 * ============================================================
 */

type SkillRates = Record<Skill, number>;

type RoadmapWeekV1Like = {
  weekId?: string;
  goalLevel?: JLPTLevel;
  level?: JLPTLevel;
  days: any[];
  [k: string]: any;
};

type WeeklyStoreLoose = {
  practiceLevel?: JLPTLevel;
  practiceLevelBySkill?: Partial<Record<Skill, JLPTLevel>>;
  bySkill?: Partial<
    Record<
      Skill,
      {
        practiceLevel?: JLPTLevel;
        rate?: number;
        correct?: number;
        total?: number;
      }
    >
  >;

  lastWeeklyResultBySkill?: Partial<
    Record<
      Skill,
      {
        rate?: number;
        correct?: number;
        total?: number;
      }
    >
  >;

  history?: any[];

  // 追加互換（実装差分に強くする）
  lastResult?: any;
  lastWeeklyResult?: any;

  [k: string]: any;
};

/**
 * Weakness shape
 */
type WeaknessShape =
  | { kind: "all-equal" }
  | { kind: "one-weak"; weakest: Skill }
  | { kind: "two-weak-tie"; weakPair: [Skill, Skill]; strongest: Skill }
  | { kind: "stair"; order: [Skill, Skill, Skill] };

/**
 * ============================================================
 * Constants
 * ============================================================
 */

const SKILLS: Skill[] = ["vocab", "grammar", "reading"];
const LEVELS_ASC: JLPTLevel[] = ["N5", "N4", "N3", "N2", "N1"];
const LEVEL_TO_INDEX: Record<JLPTLevel, number> = { N5: 0, N4: 1, N3: 2, N2: 3, N1: 4 };

const DIAG_PHASE2_RESULT_KEY = "lexio.diag.phase2.result.v1";

/**
 * 9セット構成の基本ルール
 */
const QUESTIONS_PER_SET: Record<Skill, number> = {
  vocab: 10,
  grammar: 10,
  reading: 5,
};

const DAILY_TOTAL_SETS = 9; // Day1..6 only

/**
 * ============================================================
 * Utils
 * ============================================================
 */

function nowISO() {
  return new Date().toISOString();
}

function todayISOInLocal() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDaysISO(baseISO: string, plus: number) {
  const d = new Date(`${baseISO}T00:00:00`);
  d.setDate(d.getDate() + plus);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function uniq<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}

function isSkill(x: any): x is Skill {
  return x === "vocab" || x === "grammar" || x === "reading";
}

function isJLPTLevel(x: any): x is JLPTLevel {
  return x === "N5" || x === "N4" || x === "N3" || x === "N2" || x === "N1";
}

function asLevel(x: any, fallback: JLPTLevel): JLPTLevel {
  return isJLPTLevel(x) ? x : fallback;
}

function skillLabel(s: Skill) {
  if (s === "vocab") return "vocab";
  if (s === "grammar") return "grammar";
  return "reading";
}

function readRoadmapCompat(): RoadmapWeekV1Like | null {
  const a = readJSON<any>(ROADMAP_ACTIVE_KEY);
  const aCompat = toWeekV1FromRoadmap(a);
  if (aCompat?.days?.length) return aCompat as any;

  const b = readJSON<any>(ROADMAP_KEY);
  const bCompat = toWeekV1FromRoadmap(b);
  if (bCompat?.days?.length) return bCompat as any;

  return null;
}

/**
 * v1/v2 rawがあるなら daysだけ安全に更新
 */
function writeRoadmapCompat(nextWeekV1: RoadmapWeekV1Like) {
  const aRaw = readJSON<any>(ROADMAP_ACTIVE_KEY);
  const bRaw = readJSON<any>(ROADMAP_KEY);

  const targetKey =
    aRaw && (Array.isArray(aRaw?.days) || aRaw?.version === 1 || aRaw?.version === 2)
      ? ROADMAP_ACTIVE_KEY
      : bRaw && (Array.isArray(bRaw?.days) || bRaw?.version === 1 || bRaw?.version === 2)
        ? ROADMAP_KEY
        : ROADMAP_ACTIVE_KEY;

  const raw = readJSON<any>(targetKey);

  if (raw && typeof raw === "object" && Array.isArray(raw.days)) {
    const patched = {
      ...raw,
      days: nextWeekV1.days,
      weekId: (nextWeekV1 as any).weekId ?? raw.weekId,
      goalLevel: (nextWeekV1 as any).goalLevel ?? raw.goalLevel,
      updatedAt: nowISO(),
      weeklyPlanMeta: (nextWeekV1 as any).weeklyPlanMeta ?? raw.weeklyPlanMeta,
    };
    writeJSON(targetKey, patched);
    return;
  }

  writeJSON(targetKey, nextWeekV1);
}

function makeMasteryProgress(questionIds: string[]) {
  const ids = uniq((questionIds ?? []).filter((x): x is string => typeof x === "string"));
  return {
    total: ids.length,
    mastered: [] as string[],
    remaining: [...ids],
    wrongEver: [] as string[],
    attempts: 0,
    startedAtISO: nowISO(),
    finishedAt: null,
  };
}

/**
 * ============================================================
 * Weakness classification (local, compile-safe)
 * ============================================================
 */

function normalizeRates01(input: SkillRates): SkillRates {
  const out: SkillRates = { vocab: 0, grammar: 0, reading: 0 };
  for (const s of SKILLS) {
    const n = Number(input[s]);
    if (!Number.isFinite(n)) {
      out[s] = 0;
      continue;
    }
    // allow 0..1 or 0..100
    out[s] = n > 1 ? clamp(n / 100, 0, 1) : clamp(n, 0, 1);
  }
  return out;
}

function classifyWeaknessByRatesLocal(ratesRaw: SkillRates): WeaknessShape {
  const rates = normalizeRates01(ratesRaw);

  const rows = SKILLS.map((s) => ({ skill: s, rate: rates[s] }));
  rows.sort((a, b) => {
    if (a.rate !== b.rate) return a.rate - b.rate;
    return SKILLS.indexOf(a.skill) - SKILLS.indexOf(b.skill);
  });

  const [r1, r2, r3] = rows;
  const eq12 = r1.rate === r2.rate;
  const eq23 = r2.rate === r3.rate;

  if (eq12 && eq23) return { kind: "all-equal" };
  if (!eq12 && eq23) return { kind: "one-weak", weakest: r1.skill };
  if (eq12 && !eq23) return { kind: "two-weak-tie", weakPair: [r1.skill, r2.skill], strongest: r3.skill };
  return { kind: "stair", order: [r1.skill, r2.skill, r3.skill] };
}

/**
 * ============================================================
 * Diagnostic / Weekly result read
 * ============================================================
 */

type DiagPhase2Stored = {
  version?: number;
  createdAt?: string;
  bySkill?: Record<Skill, { rate?: number }>;
  weakestSkills?: Skill[];
  [k: string]: any;
};

function readDiagnosticPhase2Rates(): SkillRates | null {
  const p2 = readJSON<DiagPhase2Stored>(DIAG_PHASE2_RESULT_KEY);
  const by = p2?.bySkill;
  if (!by || typeof by !== "object") return null;

  const out: SkillRates = { vocab: 0, grammar: 0, reading: 0 };
  let hasAny = false;

  for (const s of SKILLS) {
    const rate = Number((by as any)?.[s]?.rate);
    if (Number.isFinite(rate)) {
      out[s] = rate > 1 ? clamp(rate / 100, 0, 1) : clamp(rate, 0, 1);
      hasAny = true;
    }
  }

  return hasAny ? out : null;
}

/**
 * ✅ IMPORTANT FIX:
 * weekly store の rate が無い場合、correct/total から rate を計算して読む
 */
function readRate01FromNode(node: any): number | null {
  if (!node || typeof node !== "object") return null;

  const r = Number((node as any).rate);
  if (Number.isFinite(r)) {
    // allow 0..1 or 0..100
    return r > 1 ? clamp(r / 100, 0, 1) : clamp(r, 0, 1);
  }

  const c = Number((node as any).correct);
  const t = Number((node as any).total);
  if (Number.isFinite(c) && Number.isFinite(t) && t > 0) {
    return clamp(c / t, 0, 1);
  }

  return null;
}

/**
 * WeeklyCheck store から「直近週の bySkill rate」を読む。
 * 互換的に以下の順で読む:
 * 1) store.lastWeeklyResultBySkill
 * 2) store.lastWeeklyResult / store.lastResult の bySkill
 * 3) store.history[-1].result.bySkill
 * 4) store.bySkill
 */
function readLastWeeklyCheckRatesFromStore(): SkillRates | null {
  const raw = readJSON<WeeklyStoreLoose>(WEEKLY_CHECK_KEY) as WeeklyStoreLoose | null;
  if (!raw || typeof raw !== "object") return null;

  const tryReadBySkillObj = (by: any): SkillRates | null => {
    if (!by || typeof by !== "object") return null;
    const out: SkillRates = { vocab: 0, grammar: 0, reading: 0 };
    let ok = false;

    for (const s of SKILLS) {
      const v = readRate01FromNode(by?.[s]);
      if (v !== null) {
        out[s] = v;
        ok = true;
      }
    }
    return ok ? out : null;
  };

  // 1) top-level mirror
  {
    const out = tryReadBySkillObj((raw as any).lastWeeklyResultBySkill);
    if (out) return out;
  }

  // 2) lastWeeklyResult / lastResult
  {
    const lastWeekly = (raw as any).lastWeeklyResult;
    const outA = tryReadBySkillObj(lastWeekly?.bySkill ?? lastWeekly);
    if (outA) return outA;

    const last = (raw as any).lastResult;
    const outB = tryReadBySkillObj(last?.bySkill ?? last);
    if (outB) return outB;
  }

  // 3) history tail
  {
    const hist = (raw as any).history;
    if (Array.isArray(hist) && hist.length > 0) {
      const tail = hist[hist.length - 1];
      const out = tryReadBySkillObj(tail?.result?.bySkill ?? tail?.bySkill);
      if (out) return out;
    }
  }

  // 4) current bySkill
  {
    const out = tryReadBySkillObj((raw as any).bySkill);
    if (out) return out;
  }

  return null;
}

/**
 * 次週配分用の rate source を決める
 */
function pickRatesForNextWeek(): { rates: SkillRates; source: "weekly" | "diag" | "fallback" } {
  const weekly = readLastWeeklyCheckRatesFromStore();
  if (weekly) return { rates: weekly, source: "weekly" };

  const diag = readDiagnosticPhase2Rates();
  if (diag) return { rates: diag, source: "diag" };

  return { rates: { vocab: 0.5, grammar: 0.5, reading: 0.5 }, source: "fallback" };
}

/**
 * ============================================================
 * Weakness -> daily set allocation (9 sets)
 * ============================================================
 */

type DailySetAllocation = Record<Skill, number>; // sums to 9

function allocationFromShape(shape: WeaknessShape, dayIndex: number): DailySetAllocation {
  const base: DailySetAllocation = { vocab: 3, grammar: 3, reading: 3 };

  if (shape.kind === "all-equal") return base;

  if (shape.kind === "one-weak") {
    const out: DailySetAllocation = { vocab: 2, grammar: 2, reading: 2 };
    out[shape.weakest] = 5;
    return out;
  }

  if (shape.kind === "two-weak-tie") {
    const [a, b] = shape.weakPair;
    const strongest = shape.strongest;

    const flip = dayIndex % 2 === 0; // Day2,4,6...
    const out: DailySetAllocation = { vocab: 0, grammar: 0, reading: 0 };
    out[a] = flip ? 3 : 4;
    out[b] = flip ? 4 : 3;
    out[strongest] = 2;
    return out;
  }

  if (shape.kind === "stair") {
    const [w1, w2, w3] = shape.order;
    const out: DailySetAllocation = { vocab: 0, grammar: 0, reading: 0 };
    out[w1] = 4;
    out[w2] = 3;
    out[w3] = 2;
    return out;
  }

  return base;
}

/**
 * ============================================================
 * Weekly bank helpers (level-aware id picking)
 * ============================================================
 */

type WeeklyBankItem = {
  id: string;
  skill: Skill;
  levelTag?: JLPTLevel | string;
  level?: JLPTLevel | string;
  [k: string]: any;
};

function readBankItems(skill: Skill): WeeklyBankItem[] {
  const arr = ((WEEKLY_BANK as any)?.[skill] ?? []) as WeeklyBankItem[];
  return Array.isArray(arr) ? arr.filter((q) => q && typeof q.id === "string") : [];
}

function itemLevelTag(q: WeeklyBankItem): JLPTLevel | null {
  const a = q?.levelTag;
  const b = q?.level;
  if (isJLPTLevel(a)) return a;
  if (isJLPTLevel(b)) return b;
  return null;
}

function pickQuestionIdsForPracticeSet(params: {
  skill: Skill;
  level: JLPTLevel;
  count: number;
  avoidIds?: Set<string>;
}): string[] {
  const { skill, level, count } = params;
  const avoid = params.avoidIds ?? new Set<string>();

  const all = readBankItems(skill);
  const exact = all.filter((q) => itemLevelTag(q) === level && !avoid.has(q.id));
  const pickedExact = shuffle(exact)
    .slice(0, count)
    .map((q) => q.id);

  if (pickedExact.length >= count) return pickedExact;

  const used = new Set([...avoid, ...pickedExact]);
  const fallback = shuffle(all.filter((q) => !used.has(q.id))).slice(0, count - pickedExact.length);
  return [...pickedExact, ...fallback.map((q) => q.id)];
}

/**
 * ============================================================
 * Roadmap builders (9-set daily + Day7 weekly only)
 * ============================================================
 */

function makePracticeSet(params: { setSeq: number; skill: Skill; level: JLPTLevel; questionIds: string[] }) {
  const { setSeq, skill, level, questionIds } = params;
  const setId = `${skill}_${setSeq}`;

  return {
    setId,
    kind: "practice",
    skill,
    levelTag: level,
    plannedCount: questionIds.length,
    questionIds,
    progress: makeMasteryProgress(questionIds),
    title: `${skillLabel(skill)} set ${setSeq}`,
  };
}

function makeDay(params: {
  dayIndex: number;
  dateISO: string;
  focusSkill: Skill;
  allocation: DailySetAllocation | null;
  practiceLevel: JLPTLevel;
}) {
  const { dayIndex, dateISO, focusSkill, allocation, practiceLevel } = params;

  if (dayIndex === 7) {
    return {
      dayIndex,
      dateISO,
      status: "todo",
      focusSkill,
      isWeeklyCheckDay: true,
      weeklyCheckOnly: true,
      targets: { vocab: 0, grammar: 0, reading: 0 },
      targetsMinutes: { vocab: 0, grammar: 0, reading: 0 },
      sets: [],
    };
  }

  const alloc = allocation ?? { vocab: 3, grammar: 3, reading: 3 };
  const order = [...SKILLS].sort((a, b) => alloc[b] - alloc[a]);

  const sets: any[] = [];
  const dayUsedIds: Record<Skill, Set<string>> = {
    vocab: new Set<string>(),
    grammar: new Set<string>(),
    reading: new Set<string>(),
  };
  const seqCounter: Record<Skill, number> = { vocab: 0, grammar: 0, reading: 0 };

  for (const s of order) {
    const nSets = alloc[s];
    for (let i = 0; i < nSets; i++) {
      seqCounter[s] += 1;

      const qCount = QUESTIONS_PER_SET[s];
      const qids = pickQuestionIdsForPracticeSet({
        skill: s,
        level: practiceLevel,
        count: qCount,
        avoidIds: dayUsedIds[s],
      });

      qids.forEach((id) => dayUsedIds[s].add(id));

      sets.push(
        makePracticeSet({
          setSeq: seqCounter[s],
          skill: s,
          level: practiceLevel,
          questionIds: qids,
        })
      );
    }
  }

  while (sets.length < DAILY_TOTAL_SETS) {
    const fallbackSkill: Skill = "vocab";
    seqCounter[fallbackSkill] += 1;
    const qids = pickQuestionIdsForPracticeSet({
      skill: fallbackSkill,
      level: practiceLevel,
      count: QUESTIONS_PER_SET[fallbackSkill],
      avoidIds: dayUsedIds[fallbackSkill],
    });
    qids.forEach((id) => dayUsedIds[fallbackSkill].add(id));
    sets.push(
      makePracticeSet({
        setSeq: seqCounter[fallbackSkill],
        skill: fallbackSkill,
        level: practiceLevel,
        questionIds: qids,
      })
    );
  }

  const finalSets = sets.slice(0, DAILY_TOTAL_SETS);

  return {
    dayIndex,
    dateISO,
    status: "todo",
    focusSkill,
    isWeeklyCheckDay: false,
    weeklyCheckOnly: false,
    targets: {
      vocab: alloc.vocab * 10,
      grammar: alloc.grammar * 10,
      reading: alloc.reading * 5,
    },
    targetsMinutes: {
      vocab: alloc.vocab * 10,
      grammar: alloc.grammar * 10,
      reading: alloc.reading * 5,
    },
    allocation: alloc,
    practiceLevel,
    sets: finalSets,
  };
}

function inferFocusSkillFromAllocation(a: DailySetAllocation): Skill {
  const rows = SKILLS.map((s) => ({ s, n: a[s] }));
  rows.sort((x, y) => y.n - x.n);
  return rows[0]?.s ?? "vocab";
}

function buildNextWeekDays(params: { startDateISO: string; practiceLevel: JLPTLevel; rates: SkillRates }) {
  const { startDateISO, practiceLevel, rates } = params;

  const shape = classifyWeaknessByRatesLocal(rates);

  const days: any[] = [];
  for (let dayIndex = 1; dayIndex <= 7; dayIndex++) {
    const dateISO = addDaysISO(startDateISO, dayIndex - 1);

    if (dayIndex === 7) {
      days.push(
        makeDay({
          dayIndex,
          dateISO,
          focusSkill: "vocab",
          allocation: null,
          practiceLevel,
        })
      );
      continue;
    }

    const alloc = allocationFromShape(shape, dayIndex);
    const focusSkill = inferFocusSkillFromAllocation(alloc);

    days.push(
      makeDay({
        dayIndex,
        dateISO,
        focusSkill,
        allocation: alloc,
        practiceLevel,
      })
    );
  }

  return { days, shape };
}

/**
 * ============================================================
 * Week ID helpers
 * ============================================================
 */

function parseWeekSerial(weekId?: string): number | null {
  if (!weekId || typeof weekId !== "string") return null;
  const m = weekId.match(/(\d+)(?!.*\d)/);
  if (!m) return null;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : null;
}

function makeNextWeekId(prevWeekId?: string): string {
  const n = parseWeekSerial(prevWeekId);
  if (n == null) return "wk-2";
  return `wk-${n + 1}`;
}

/**
 * ============================================================
 * Practice level (UNIFIED) from weekly store
 * ============================================================
 */

function pickUnifiedPracticeLevelFromWeeklyStore(store: WeeklyStoreLoose | null, goalLevel: JLPTLevel): JLPTLevel {
  if (!store || typeof store !== "object") return goalLevel;

  if (isJLPTLevel((store as any).practiceLevel)) {
    const lv = (store as any).practiceLevel as JLPTLevel;
    return LEVEL_TO_INDEX[lv] > LEVEL_TO_INDEX[goalLevel] ? goalLevel : lv;
  }

  const candidates: JLPTLevel[] = [];
  for (const s of SKILLS) {
    const lv = (store as any)?.bySkill?.[s]?.practiceLevel;
    if (isJLPTLevel(lv)) candidates.push(lv);
  }
  for (const s of SKILLS) {
    const lv = (store as any)?.practiceLevelBySkill?.[s];
    if (isJLPTLevel(lv)) candidates.push(lv);
  }

  if (candidates.length > 0) {
    let rep = candidates[0];
    for (const lv of candidates) {
      if (LEVEL_TO_INDEX[lv] > LEVEL_TO_INDEX[rep]) rep = lv;
    }
    return LEVEL_TO_INDEX[rep] > LEVEL_TO_INDEX[goalLevel] ? goalLevel : rep;
  }

  return goalLevel;
}

/**
 * ============================================================
 * Public API
 * ============================================================
 */

export function ensureNextRoadmapFromWeeklyCheck(args?: {
  goalLevel?: JLPTLevel;
  force?: boolean;
  dryRun?: boolean; // ✅ preview 用
}) {
  const force = !!args?.force;
  const dryRun = !!args?.dryRun;

  const currentWeek = readRoadmapCompat();
  if (!currentWeek || !Array.isArray(currentWeek.days) || currentWeek.days.length === 0) {
    throw new Error("Roadmap not found");
  }

  if (!force) {
    const day1 = currentWeek.days.find((d: any) => Number(d?.dayIndex) === 1);
    const today = todayISOInLocal();
    if (day1?.dateISO && typeof day1.dateISO === "string" && day1.dateISO > today) {
      return { roadmap: currentWeek, skipped: true, reason: "already-next-week" as const };
    }
  }

  const weeklyStore = readJSON<WeeklyStoreLoose>(WEEKLY_CHECK_KEY) as WeeklyStoreLoose | null;

  const goalLevel = asLevel(
    args?.goalLevel ?? (currentWeek as any)?.goalLevel ?? (currentWeek as any)?.level ?? "N5",
    "N5"
  );

  const practiceLevel = pickUnifiedPracticeLevelFromWeeklyStore(weeklyStore, goalLevel);

  // ✅ ここが今回の主修正：weekly で rate を correct/total から読めるようにした
  const { rates, source } = pickRatesForNextWeek();

  const day7 = currentWeek.days.find((d: any) => Number(d?.dayIndex) === 7);
  const startDateISO =
    typeof day7?.dateISO === "string"
      ? addDaysISO(day7.dateISO, 1)
      : addDaysISO(todayISOInLocal(), 1);

  const { days, shape } = buildNextWeekDays({
    startDateISO,
    practiceLevel,
    rates,
  });

  const nextWeekId = makeNextWeekId((currentWeek as any)?.weekId);

  const nextRoadmap: RoadmapWeekV1Like = {
    ...(currentWeek as any),
    weekId: nextWeekId,
    goalLevel,
    days,
    updatedAt: nowISO(),
    weeklyPlanMeta: {
      generatedAtISO: nowISO(),
      source, // "weekly" | "diag" | "fallback"
      weaknessRates: rates,
      weaknessShape: shape,
      practiceLevel,
      day7WeeklyCheckOnly: true,
      rules: {
        allEqual: "3,3,3",
        oneWeak: "5,2,2",
        twoWeakTie: "4,3,2 / 3,4,2 (alternate)",
        stair: "4,3,2",
      },
    },
  };

  // ✅ dryRun のときは書き込まない
  if (!dryRun) {
    writeRoadmapCompat(nextRoadmap);
  }

  return {
    roadmap: nextRoadmap,
    skipped: false as const,
    source,
    shape,
    practiceLevel,
    rates,
    dryRun,
  };
}