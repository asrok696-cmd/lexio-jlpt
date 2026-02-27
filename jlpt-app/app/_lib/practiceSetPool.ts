// app/_lib/practiceSetPool.ts
"use client";

/**
 * Step2: セットプール（unused/archive/pending）
 *
 * 要件を満たす:
 * - 同じセットは「unusedを使い切るまで」再利用しない（archiveに移す）
 * - unusedが尽きたら archive を戻して2周目（recycle）
 * - update追加分は「次週から」優先 → pending に積んでおき、新週開始でunused先頭へ
 */

import type { Skill } from "@/app/_lib/roadmap";
import type { PracticeSet, PracticeSetSource } from "@/app/_lib/practiceSetData";
import { PRACTICE_SETS } from "@/app/_lib/practiceSetData";

export const PRACTICE_SET_POOL_KEY = "lexio.practiceSetPool.v1";

export type PracticeSetPool = {
  version: 1;
  updatedAtISO: string;

  // 全セット実体
  setsById: Record<string, PracticeSet>;

  // 未使用（次に使う順）
  unusedIdsBySkill: Record<Skill, string[]>;

  // 使用済み
  archiveIdsBySkill: Record<Skill, string[]>;

  // 次週から優先投入したい（updateなど）
  pendingIdsBySkill: Record<Skill, string[]>;

  // 同じ週で activate を二重適用しないため
  lastActivatedWeekId?: string;
};

function nowISO() {
  return new Date().toISOString();
}

function emptyIds(): Record<Skill, string[]> {
  return { vocab: [], grammar: [], reading: [] };
}

function normalizeSkill(x: any): Skill | null {
  return x === "vocab" || x === "grammar" || x === "reading" ? x : null;
}

function normalizeSet(x: any, fallbackSource: PracticeSetSource): PracticeSet | null {
  const key = typeof x?.key === "string" ? x.key.trim() : "";
  const skill = normalizeSkill(x?.skill);
  const ids = Array.isArray(x?.questionIds) ? x.questionIds.filter((s: any) => typeof s === "string" && s.trim()) : [];
  const createdAtISO = typeof x?.createdAtISO === "string" && x.createdAtISO ? x.createdAtISO : nowISO();
  const srcRaw = (x?.source ?? fallbackSource) as any;
  const source: PracticeSetSource = srcRaw === "seed" || srcRaw === "weekly" || srcRaw === "update" ? srcRaw : fallbackSource;

  if (!key) return null;
  if (!skill) return null;
  if (ids.length === 0) return null;

  return { key, skill, questionIds: ids, createdAtISO, source };
}

export function readPracticeSetPool(): PracticeSetPool {
  if (typeof window === "undefined") {
    // SSR安全
    return {
      version: 1,
      updatedAtISO: nowISO(),
      setsById: {},
      unusedIdsBySkill: emptyIds(),
      archiveIdsBySkill: emptyIds(),
      pendingIdsBySkill: emptyIds(),
      lastActivatedWeekId: undefined,
    };
  }

  try {
    const raw = localStorage.getItem(PRACTICE_SET_POOL_KEY);
    if (!raw) throw new Error("no pool");
    const v = JSON.parse(raw) as PracticeSetPool;

    if (!v || typeof v !== "object" || v.version !== 1) throw new Error("bad pool");

    const fix = (r: any): Record<Skill, string[]> => ({
      vocab: Array.isArray(r?.vocab) ? r.vocab.filter((x: any) => typeof x === "string") : [],
      grammar: Array.isArray(r?.grammar) ? r.grammar.filter((x: any) => typeof x === "string") : [],
      reading: Array.isArray(r?.reading) ? r.reading.filter((x: any) => typeof x === "string") : [],
    });

    return {
      version: 1,
      updatedAtISO: typeof v.updatedAtISO === "string" ? v.updatedAtISO : nowISO(),
      setsById: v.setsById && typeof v.setsById === "object" ? v.setsById : {},
      unusedIdsBySkill: fix(v.unusedIdsBySkill),
      archiveIdsBySkill: fix(v.archiveIdsBySkill),
      pendingIdsBySkill: fix(v.pendingIdsBySkill),
      lastActivatedWeekId: typeof v.lastActivatedWeekId === "string" ? v.lastActivatedWeekId : undefined,
    };
  } catch {
    return {
      version: 1,
      updatedAtISO: nowISO(),
      setsById: {},
      unusedIdsBySkill: emptyIds(),
      archiveIdsBySkill: emptyIds(),
      pendingIdsBySkill: emptyIds(),
      lastActivatedWeekId: undefined,
    };
  }
}

export function writePracticeSetPool(next: PracticeSetPool) {
  if (typeof window === "undefined") return;
  try {
    const v: PracticeSetPool = {
      ...next,
      version: 1,
      updatedAtISO: nowISO(),
    };
    localStorage.setItem(PRACTICE_SET_POOL_KEY, JSON.stringify(v));
  } catch {}
}

export function ensurePracticeSetPool(): PracticeSetPool {
  const cur = readPracticeSetPool();
  if (Object.keys(cur.setsById ?? {}).length > 0) return cur;

  // 初回は同梱データをseedとして投入
  const seed = [
    ...(PRACTICE_SETS.vocab ?? []),
    ...(PRACTICE_SETS.grammar ?? []),
    ...(PRACTICE_SETS.reading ?? []),
  ];
  return initPoolWithSets(seed, "seed");
}

/**
 * セットを pool に投入（重複keyは無視）
 * - defaultDest:
 *    - "unused": すぐ使う候補（seed/weeklyなど）
 *    - "pending": 次週から優先（update用）
 */
function addSetsToPool(
  pool: PracticeSetPool,
  incomingRaw: PracticeSet[],
  fallbackSource: PracticeSetSource,
  defaultDest: "unused" | "pending"
): PracticeSetPool {
  const incoming = (Array.isArray(incomingRaw) ? incomingRaw : [])
    .map((x) => normalizeSet(x, fallbackSource))
    .filter((x): x is PracticeSet => !!x);

  if (incoming.length === 0) return pool;

  const next: PracticeSetPool = {
    ...pool,
    setsById: { ...(pool.setsById ?? {}) },
    unusedIdsBySkill: {
      vocab: [...(pool.unusedIdsBySkill?.vocab ?? [])],
      grammar: [...(pool.unusedIdsBySkill?.grammar ?? [])],
      reading: [...(pool.unusedIdsBySkill?.reading ?? [])],
    },
    archiveIdsBySkill: {
      vocab: [...(pool.archiveIdsBySkill?.vocab ?? [])],
      grammar: [...(pool.archiveIdsBySkill?.grammar ?? [])],
      reading: [...(pool.archiveIdsBySkill?.reading ?? [])],
    },
    pendingIdsBySkill: {
      vocab: [...(pool.pendingIdsBySkill?.vocab ?? [])],
      grammar: [...(pool.pendingIdsBySkill?.grammar ?? [])],
      reading: [...(pool.pendingIdsBySkill?.reading ?? [])],
    },
    updatedAtISO: nowISO(),
  };

  const hasKey = (key: string) => {
    if (next.setsById[key]) return true;
    return false;
  };

  // createdAt新しい順（update優先の並べ替えに使える）
  incoming.sort((a, b) => String(b.createdAtISO).localeCompare(String(a.createdAtISO)));

  for (const s of incoming) {
    if (hasKey(s.key)) continue;
    next.setsById[s.key] = s;

    if (defaultDest === "pending") {
      // pendingは先頭（新しいほど先に）
      next.pendingIdsBySkill[s.skill] = [s.key, ...(next.pendingIdsBySkill[s.skill] ?? [])];
    } else {
      // unusedも先頭（新しいほど先に）
      next.unusedIdsBySkill[s.skill] = [s.key, ...(next.unusedIdsBySkill[s.skill] ?? [])];
    }
  }

  return next;
}

/**
 * 初期投入（seed/weekly想定）→ unusedに積む
 */
export function initPoolWithSets(sets: PracticeSet[], source: PracticeSetSource = "seed") {
  let pool = readPracticeSetPool();
  pool = addSetsToPool(pool, sets, source, "unused");
  writePracticeSetPool(pool);
  return pool;
}

/**
 * アップデート追加分（update想定）→ pendingに積む
 * ※「途中で入れば3週目でやる」= 次週生成まで反映しないため
 */
export function addPendingSets(sets: PracticeSet[], source: PracticeSetSource = "update") {
  let pool = readPracticeSetPool();
  pool = addSetsToPool(pool, sets, source, "pending");
  writePracticeSetPool(pool);
  return pool;
}

/**
 * 新週開始時に呼ぶ:
 * - pending を unused 先頭へ移す（優先使用）
 * - 同じ週で二重適用しない（lastActivatedWeekId）
 */
export function activatePendingForNewWeek(weekId?: string) {
  let pool = ensurePracticeSetPool();

  const wid = weekId ?? "";
  if (wid && pool.lastActivatedWeekId === wid) return pool;

  const next: PracticeSetPool = {
    ...pool,
    unusedIdsBySkill: {
      vocab: [...(pool.unusedIdsBySkill?.vocab ?? [])],
      grammar: [...(pool.unusedIdsBySkill?.grammar ?? [])],
      reading: [...(pool.unusedIdsBySkill?.reading ?? [])],
    },
    pendingIdsBySkill: {
      vocab: [...(pool.pendingIdsBySkill?.vocab ?? [])],
      grammar: [...(pool.pendingIdsBySkill?.grammar ?? [])],
      reading: [...(pool.pendingIdsBySkill?.reading ?? [])],
    },
    updatedAtISO: nowISO(),
    lastActivatedWeekId: wid || pool.lastActivatedWeekId,
  };

  (["vocab", "grammar", "reading"] as Skill[]).forEach((sk) => {
    const pending = next.pendingIdsBySkill[sk] ?? [];
    if (pending.length === 0) return;

    // pending（新セット）を unused の先頭へ
    next.unusedIdsBySkill[sk] = [...pending, ...(next.unusedIdsBySkill[sk] ?? [])];
    next.pendingIdsBySkill[sk] = [];
  });

  writePracticeSetPool(next);
  return next;
}

/**
 * unusedが空なら archive を戻して2周目へ（recycle）
 */
function recycleIfEmpty(pool: PracticeSetPool, skill: Skill): PracticeSetPool {
  const unused = pool.unusedIdsBySkill?.[skill] ?? [];
  if (unused.length > 0) return pool;

  const archive = pool.archiveIdsBySkill?.[skill] ?? [];
  if (archive.length === 0) return pool;

  // archiveを unusedへ戻し、archiveを空にする
  const next: PracticeSetPool = {
    ...pool,
    unusedIdsBySkill: { ...pool.unusedIdsBySkill, [skill]: [...archive] },
    archiveIdsBySkill: { ...pool.archiveIdsBySkill, [skill]: [] },
    updatedAtISO: nowISO(),
  };
  return next;
}

/**
 * n個 draw（=使用済みにして archiveへ移す）
 */
export function drawPracticeSets(skill: Skill, n: number): PracticeSet[] {
  const want = Math.max(0, Math.floor(n));
  if (want <= 0) return [];

  let pool = ensurePracticeSetPool();
  pool = recycleIfEmpty(pool, skill);

  const unused = [...(pool.unusedIdsBySkill?.[skill] ?? [])];
  const archive = [...(pool.archiveIdsBySkill?.[skill] ?? [])];

  const out: PracticeSet[] = [];

  while (out.length < want) {
    if (unused.length === 0) {
      // recycleして再挑戦
      pool = {
        ...pool,
        unusedIdsBySkill: { ...pool.unusedIdsBySkill, [skill]: unused },
        archiveIdsBySkill: { ...pool.archiveIdsBySkill, [skill]: archive },
        updatedAtISO: nowISO(),
      };
      pool = recycleIfEmpty(pool, skill);

      unused.length = 0;
      unused.push(...(pool.unusedIdsBySkill?.[skill] ?? []));
      archive.length = 0;
      archive.push(...(pool.archiveIdsBySkill?.[skill] ?? []));

      if (unused.length === 0) break;
    }

    const id = unused.shift();
    if (!id) break;

    const set = pool.setsById?.[id];
    if (!set) continue;

    out.push(set);
    // 使用済みは先頭に積む（履歴として新しい順）
    archive.unshift(id);
  }

  const next: PracticeSetPool = {
    ...pool,
    unusedIdsBySkill: { ...pool.unusedIdsBySkill, [skill]: unused },
    archiveIdsBySkill: { ...pool.archiveIdsBySkill, [skill]: archive },
    updatedAtISO: nowISO(),
  };

  writePracticeSetPool(next);
  return out;
}

/**
 * 1日分まとめて引く（v/g/r）
 */
export function popSetsForDay(counts: Record<Skill, number>): PracticeSet[] {
  const v = drawPracticeSets("vocab", counts.vocab ?? 0);
  const g = drawPracticeSets("grammar", counts.grammar ?? 0);
  const r = drawPracticeSets("reading", counts.reading ?? 0);
  return [...v, ...g, ...r];
}