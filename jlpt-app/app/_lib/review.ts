// app/_lib/review.ts

export type ReviewSkill = "vocab" | "grammar" | "reading";

export type ReviewItem = {
  id: string;            // unique id (qidがあればqid推奨)
  createdAtISO: string;  // when saved
  skill: ReviewSkill;

  prompt: string;
  choices: string[];
  chosenIndex: number;   // user chosen
  correctIndex: number;  // correct
};

type ReviewStoreV1 = {
  version: 1;
  updatedAtISO: string;
  items: ReviewItem[];
};

export const REVIEW_KEY = "lexio.review.v1";

// ----------------------------
// safe storage helpers
// ----------------------------
function readStore(): ReviewStoreV1 {
  if (typeof window === "undefined") {
    return { version: 1, updatedAtISO: new Date().toISOString(), items: [] };
  }
  try {
    const raw = localStorage.getItem(REVIEW_KEY);
    if (!raw) {
      return { version: 1, updatedAtISO: new Date().toISOString(), items: [] };
    }
    const parsed = JSON.parse(raw) as ReviewStoreV1;
    if (!parsed || parsed.version !== 1 || !Array.isArray(parsed.items)) {
      return { version: 1, updatedAtISO: new Date().toISOString(), items: [] };
    }
    return parsed;
  } catch {
    return { version: 1, updatedAtISO: new Date().toISOString(), items: [] };
  }
}

function writeStore(next: ReviewStoreV1) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(REVIEW_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
}

// ----------------------------
// public API
// ----------------------------
export function getReviewItems(): ReviewItem[] {
  const s = readStore();
  // newest first
  return [...s.items].sort((a, b) => (a.createdAtISO < b.createdAtISO ? 1 : -1));
}

export function clearReviewItems() {
  writeStore({ version: 1, updatedAtISO: new Date().toISOString(), items: [] });
}

export function removeReviewItem(id: string) {
  const s = readStore();
  const next = s.items.filter((x) => x.id !== id);
  writeStore({ ...s, updatedAtISO: new Date().toISOString(), items: next });
}

/**
 * ✅ Practice側で「⭐ Save to Review」を押した時に呼ぶ想定
 * - 同じ id があれば上書き（最新化）
 */
export function upsertReviewItem(item: ReviewItem) {
  const s = readStore();
  const nextItems = s.items.filter((x) => x.id !== item.id);
  nextItems.unshift(item);
  writeStore({ version: 1, updatedAtISO: new Date().toISOString(), items: nextItems });
}

/**
 * 便利関数: 必要なら Practice からこれで生成して保存できる
 */
export function makeReviewItem(input: {
  id: string;
  skill: ReviewSkill;
  prompt: string;
  choices: string[];
  chosenIndex: number;
  correctIndex: number;
}): ReviewItem {
  return {
    ...input,
    createdAtISO: new Date().toISOString(),
  };
}
