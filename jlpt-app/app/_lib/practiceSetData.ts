// app/_lib/practiceSetData.ts
"use client";

/**
 * セット定義（アプリ同梱データ）
 * - skillごとに PracticeSet を並べる
 * - questionIds は「セット＝複数問」対応（今は1問でもOK）
 */

import type { Skill } from "@/app/_lib/roadmap";

export type PracticeSetSource = "seed" | "weekly" | "update";

export type PracticeSet = {
  key: string;           // 一意ID（絶対に重複させない）
  skill: Skill;          // vocab/grammar/reading
  questionIds: string[]; // セットに含める問題ID（将来 10/10/5 でもOK）
  createdAtISO: string;  // 追加日時（並び替え/優先度に使える）
  source: PracticeSetSource;
};

export const PRACTICE_SETS: Record<Skill, PracticeSet[]> = {
  vocab: [
    {
      key: "set_vocab_0001",
      skill: "vocab",
      questionIds: ["vocab-1"],
      createdAtISO: "2026-02-01T00:00:00.000Z",
      source: "seed",
    },
  ],
  grammar: [
    {
      key: "set_grammar_0001",
      skill: "grammar",
      questionIds: ["grammar-1"],
      createdAtISO: "2026-02-01T00:00:00.000Z",
      source: "seed",
    },
  ],
  reading: [
    {
      key: "set_reading_0001",
      skill: "reading",
      questionIds: ["reading-1"],
      createdAtISO: "2026-02-01T00:00:00.000Z",
      source: "seed",
    },
  ],
};