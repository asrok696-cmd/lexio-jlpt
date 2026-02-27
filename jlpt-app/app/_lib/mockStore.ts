// app/_lib/mockStore.ts
"use client";

import type { JLPTLevel, MockResultV1 } from "./mockEngine";

export const MOCK_RESULTS_KEY = "lexio.mockResults.v1";

type MockResultsState = {
  version: 1;
  updatedAtISO: string;
  results: MockResultV1[]; // newest first
};

function nowISO() {
  return new Date().toISOString();
}

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

function writeJSON<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(value));
}

/**
 * ✅ 正規取得関数（唯一の正規入口）
 */
export function getMockResults(): MockResultV1[] {
  const s = readJSON<MockResultsState>(MOCK_RESULTS_KEY);
  if (!s || s.version !== 1) return [];
  if (!Array.isArray(s.results)) return [];
  return s.results;
}

/**
 * ✅ 保存（常に newest first / 同じrun idは重複させない）
 */
export function saveMockResult(result: MockResultV1) {
  const cur = readJSON<MockResultsState>(MOCK_RESULTS_KEY);
  const prev = Array.isArray(cur?.results) ? cur!.results : [];

  // ✅ dedupe by run id
  const filtered = prev.filter((r) => String(r.id) !== String(result.id));

  const next: MockResultsState = {
    version: 1,
    updatedAtISO: nowISO(),
    results: [result, ...filtered].slice(0, 300), // keep latest 300
  };

  writeJSON(MOCK_RESULTS_KEY, next);
}

/**
 * ✅ レベル＆スロット別の最新結果
 */
export function getLatestResult(level: JLPTLevel, slot: number): MockResultV1 | null {
  const all = getMockResults();
  return all.find((r) => r.level === level && r.slot === slot) ?? null;
}

/**
 * ✅ run ID で取得（Resultページ用）
 */
export function getResultById(id: string): MockResultV1 | null {
  const all = getMockResults();
  return all.find((r) => String(r.id) === String(id)) ?? null;
}

/**
 * ✅ 完全削除（開発用）
 */
export function clearMockResults() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(MOCK_RESULTS_KEY);
}