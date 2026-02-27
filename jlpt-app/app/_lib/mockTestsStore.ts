// app/_lib/mockTestsStore.ts
"use client";

import type { JLPTLevel } from "@/app/_lib/mockEngine";
import { getMockResults, MOCK_RESULTS_KEY } from "@/app/_lib/mockStore";

export type MockSkill = "vocab" | "grammar" | "reading";

export type MockAttempt = {
  id: string;
  dateISO: string; // YYYY-MM-DD
  level?: JLPTLevel;
  slot?: number;

  // overall percent (0..100)
  total: number;

  // per-skill percent (0..100)
  bySkill: Record<MockSkill, number>;

  timeSec?: number;

  // keep extra info if needed (PASS/FAIL etc)
  meta?: Record<string, any>;
};

export type MockStore = {
  version: 1;
  updatedAtISO: string;
  attempts: MockAttempt[];
  sourceKey?: string;
};

// ✅ fallback keys ONLY（正規は mockStore.ts で読む）
const FALLBACK_KEYS = [
  "lexio.mockTests.v1",
  "lexio.mockTest.v1",
  "lexio.mockTests.results.v1",
  "lexio.mockTests.history.v1",
  "lexio.mockTests.v0",
  "lexio.mockTestResults.v1",
];

function safeParse(raw: string | null): any | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function toISODateLike(v: any): string | null {
  const s = String(v ?? "").trim();
  if (!s) return null;

  // accept YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  // accept ISO datetime
  const d = new Date(s);
  if (Number.isFinite(d.getTime())) {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  }
  return null;
}

function num(v: any, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function numOpt(v: any): number | undefined {
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

function ensureBySkillFlat(x: any): Record<MockSkill, number> {
  const v = x ?? {};
  return {
    vocab: num(v.vocab ?? v.V ?? v.vocabulary ?? v.word ?? 0),
    grammar: num(v.grammar ?? v.G ?? 0),
    reading: num(v.reading ?? v.R ?? 0),
  };
}

// ✅ MockResultV1 の bySkill(ネスト) → percent(flat) へ
function ensureBySkillFromMockResult(bySkill: any): Record<MockSkill, number> {
  const v = bySkill ?? {};
  return {
    vocab: num(v.vocab?.accuracy ?? v.vocab ?? 0),
    grammar: num(v.grammar?.accuracy ?? v.grammar ?? 0),
    reading: num(v.reading?.accuracy ?? v.reading ?? 0),
  };
}

function normalizeAttempt(raw: any, idx: number): MockAttempt | null {
  if (!raw || typeof raw !== "object") return null;

  const dateISO =
    toISODateLike(
      raw.dateISO ??
        raw.date ??
        raw.takenAtISO ??
        raw.finishedAtISO ??
        raw.startedAtISO ??
        raw.createdAtISO ??
        raw.createdAt ??
        raw.at
    ) ?? null;

  // ✅ total candidates
  const total = num(
    raw.total ??
      raw.score ??
      raw.totalScore ??
      raw.percent ?? // ✅ new field
      raw.accuracy ?? // ✅ MockResultV1
      raw.result?.total ??
      raw.summary?.total ??
      0
  );

  // ✅ bySkill candidates
  const bySkill =
    raw.bySkill
      ? raw.bySkill.vocab?.accuracy != null ||
        raw.bySkill.grammar?.accuracy != null ||
        raw.bySkill.reading?.accuracy != null
        ? ensureBySkillFromMockResult(raw.bySkill)
        : ensureBySkillFlat(raw.bySkill)
      : raw.bySkillPercent
        ? ensureBySkillFlat(raw.bySkillPercent)
        : raw.bySkillFlat
          ? ensureBySkillFlat(raw.bySkillFlat)
          : raw.sections
            ? ensureBySkillFlat(raw.sections)
            : raw.result?.bySkill
              ? ensureBySkillFlat(raw.result.bySkill)
              : raw.summary?.bySkill
                ? ensureBySkillFlat(raw.summary.bySkill)
                : ensureBySkillFlat(raw);

  // ignore empty
  if (!dateISO && total === 0 && bySkill.vocab === 0 && bySkill.grammar === 0 && bySkill.reading === 0) {
    return null;
  }

  const id = String(raw.id ?? raw.attemptId ?? raw.uuid ?? `mock-${dateISO ?? "na"}-${idx}`);

  const level = (raw.level ?? raw.goalLevel ?? raw.jlptLevel ?? raw.meta?.level) as JLPTLevel | undefined;
  const slot = raw.slot != null ? numOpt(raw.slot) : undefined;

  // ✅ time candidates
  const timeSec =
    raw.timeSec ?? raw.durationSec ?? raw.elapsedSec ?? raw.timeSpentSec ?? raw.meta?.timeSec;

  // ✅ keep pass/passRule if present (useful for Reports/Debug)
  const pass = typeof raw.pass === "boolean" ? raw.pass : undefined;
  const passRule = raw.passRule && typeof raw.passRule === "object" ? raw.passRule : undefined;

  return {
    id,
    dateISO: dateISO ?? "1970-01-01",
    level,
    slot,
    total,
    bySkill,
    timeSec: timeSec != null ? numOpt(timeSec) : undefined,
    meta: {
      ...(raw.meta && typeof raw.meta === "object" ? raw.meta : {}),
      ...(pass !== undefined ? { pass } : {}),
      ...(passRule ? { passRule } : {}),
    },
  };
}

/**
 * ✅ Reader（正規→fallback）
 * - 1) mockStore.ts (lexio.mockResults.v1) を最優先で読む
 * - 2) 無ければ旧キーを読む（救済）
 */
export function readMockStore(): MockStore {
  // -------------------------
  // 1) PRIMARY: mockStore.ts
  // -------------------------
  try {
    const v1 = getMockResults(); // reads lexio.mockResults.v1
    if (Array.isArray(v1) && v1.length) {
      const attempts = v1.map((r, i) => normalizeAttempt(r, i)).filter(Boolean) as MockAttempt[];

      if (attempts.length) {
        attempts.sort((a, b) => (a.dateISO < b.dateISO ? 1 : a.dateISO > b.dateISO ? -1 : 0));
        return {
          version: 1,
          updatedAtISO: new Date().toISOString(),
          attempts,
          sourceKey: MOCK_RESULTS_KEY,
        };
      }
    }
  } catch {
    // ignore; fallbackへ
  }

  // -------------------------
  // 2) FALLBACK: old keys
  // -------------------------
  for (const key of FALLBACK_KEYS) {
    const raw = safeParse(typeof window !== "undefined" ? localStorage.getItem(key) : null);
    if (!raw) continue;

    let list: any[] | null = null;

    if (Array.isArray(raw)) list = raw;
    else if (Array.isArray(raw.attempts)) list = raw.attempts;
    else if (Array.isArray(raw.history)) list = raw.history;
    else if (Array.isArray(raw.results)) list = raw.results;
    else if (Array.isArray(raw.items)) list = raw.items;

    if (!list || !list.length) continue;

    const attempts = list.map((x, i) => normalizeAttempt(x, i)).filter(Boolean) as MockAttempt[];
    if (!attempts.length) continue;

    attempts.sort((a, b) => (a.dateISO < b.dateISO ? 1 : a.dateISO > b.dateISO ? -1 : 0));

    return {
      version: 1,
      updatedAtISO: new Date().toISOString(),
      attempts,
      sourceKey: key,
    };
  }

  return {
    version: 1,
    updatedAtISO: new Date().toISOString(),
    attempts: [],
  };
}