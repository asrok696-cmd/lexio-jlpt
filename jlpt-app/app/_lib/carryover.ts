// app/_lib/carryover.ts
"use client";

// ✅ roadmap.ts から PracticeEvent 型が消えていても動くようにする
import { readJSON, writeJSON, todayISO } from "./roadmap";

// ------------------------------------
// Keys
// ------------------------------------
export const CARRYOVER_KEY = "lexio.carryover.v1";

// ✅ practice/page.tsx が import してたキー（ログは既存キーに合わせる）
export const PRACTICE_LOG_KEY = "lexio.practiceLog.v1";

// ------------------------------------
// Types
// ------------------------------------

// ✅ roadmap.ts の PracticeEvent export 不在に備えたローカル互換型
export type PracticeEvent = {
  dateISO?: string;
  qid?: string;
  correct?: boolean;
  [key: string]: any;
};

export type CarryoverItem = {
  qid: string;
};

export type Carryover = {
  version: 1;
  dateISO: string; // 「昨日」(元データの日付)
  items: CarryoverItem[]; // 昨日間違えた問題
  cleared: boolean; // 今日それを全問正解で潰したか
  updatedAt: string;
};

// ------------------------------------
// Internal helpers
// ------------------------------------
function addDaysISO(baseISO: string, addDays: number) {
  const d = new Date(baseISO);
  d.setDate(d.getDate() + addDays);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function yesterdayISO() {
  return addDaysISO(todayISO(), -1);
}

function uniqStrings(xs: string[]) {
  return Array.from(new Set(xs.filter((x) => typeof x === "string" && x.length > 0)));
}

// ------------------------------------
// Core: ensureCarryoverForToday
// ------------------------------------
/**
 * ✅ 今日の carryover を保証する
 * - 保存済みで「今日のために作られたもの」ならそれを返す
 * - そうでなければ、昨日の PracticeLog から「間違えたqid」を抽出して生成
 *
 * note:
 * - “前日のやつだけでいい” → yesterday の log だけを見る
 * - “必ず最初にする” → practice/page.tsx 側で cleared=false の時にロックすればOK
 */
export function ensureCarryoverForToday(): Carryover {
  const yISO = yesterdayISO();

  const saved = readJSON<Carryover>(CARRYOVER_KEY);

  // 既に「昨日由来のcarryover」が保存されていればそれを優先
  if (saved && saved.version === 1 && typeof saved.dateISO === "string") {
    // saved.dateISO は「昨日」を指す想定（= yISO）
    // もし日付がズレてたら作り直す
    if (saved.dateISO === yISO) {
      // 日付は合ってる。items/cleared の形だけ補正して返す
      const items = Array.isArray(saved.items)
        ? saved.items.filter((it) => typeof it?.qid === "string")
        : [];
      const cleared = !!saved.cleared;

      const normalized: Carryover = {
        version: 1,
        dateISO: yISO,
        items,
        cleared,
        updatedAt: saved.updatedAt || new Date().toISOString(),
      };

      // ちょい壊れ補正だけ保存
      if (JSON.stringify(normalized) !== JSON.stringify(saved)) {
        writeJSON(CARRYOVER_KEY, normalized);
      }
      return normalized;
    }
  }

  // 作り直し：昨日の log から wrong を抽出
  const log = readJSON<PracticeEvent[]>(PRACTICE_LOG_KEY) ?? [];
  const wrongQids = uniqStrings(
    log
      .filter((e) => e?.dateISO === yISO)
      .filter((e) => e && e.correct === false)
      .map((e) => String(e.qid ?? ""))
  );

  const next: Carryover = {
    version: 1,
    dateISO: yISO,
    items: wrongQids.map((qid) => ({ qid })),
    cleared: wrongQids.length === 0, // 昨日ミスが無ければ cleared 扱いでOK
    updatedAt: new Date().toISOString(),
  };

  writeJSON(CARRYOVER_KEY, next);
  return next;
}

// ------------------------------------
// Optional: mark cleared
// ------------------------------------
/**
 * セッション側で「carryover set を全問 mastered」したら呼ぶ用。
 * いまは practice/page.tsx のロック解除に使える。
 */
export function markCarryoverCleared() {
  const yISO = yesterdayISO();
  const saved = readJSON<Carryover>(CARRYOVER_KEY);

  const next: Carryover = {
    version: 1,
    dateISO: yISO,
    items: saved?.dateISO === yISO && Array.isArray(saved.items) ? saved.items : [],
    cleared: true,
    updatedAt: new Date().toISOString(),
  };

  writeJSON(CARRYOVER_KEY, next);
  return next;
}