// app/_lib/weeklyCheckPicker.ts
"use client";

import { shuffle } from "@/app/_lib/bank";
import { WEEKLY_BANK, type WeeklyLevel, type WeeklySkill, type WeeklyQuestion } from "@/app/_lib/weeklyCheckBank";

export const WEEKLY_USED_KEY = "lexio.weeklyCheck.used.v1";
export const WEEKLY_SET_KEY = "lexio.weeklyCheck.set.v1";

type UsedStore = { usedIds: string[] };

// ✅ Record<skill, WeeklyQuestion[]> を 1配列に平坦化
function allQuestions(): WeeklyQuestion[] {
  const skills: WeeklySkill[] = ["vocab", "grammar", "reading"];
  return skills.flatMap((s) => WEEKLY_BANK[s] ?? []);
}

function readUsed(): string[] {
  try {
    const raw = localStorage.getItem(WEEKLY_USED_KEY);
    if (!raw) return [];
    const v = JSON.parse(raw) as UsedStore;
    return Array.isArray(v?.usedIds) ? v.usedIds : [];
  } catch {
    return [];
  }
}

function writeUsed(ids: string[]) {
  try {
    localStorage.setItem(WEEKLY_USED_KEY, JSON.stringify({ usedIds: ids } satisfies UsedStore));
  } catch {}
}

function levelRank(lv: WeeklyLevel) {
  return lv === "N5" ? 1 : lv === "N4" ? 2 : lv === "N3" ? 3 : lv === "N2" ? 4 : 5;
}

function nextLevel(lv: WeeklyLevel): WeeklyLevel {
  if (lv === "N5") return "N4";
  if (lv === "N4") return "N3";
  if (lv === "N3") return "N2";
  if (lv === "N2") return "N1";
  return "N1";
}

function clampHarder(lv: WeeklyLevel): WeeklyLevel {
  const n = nextLevel(lv);
  return levelRank(n) > levelRank("N1") ? "N1" : n;
}

// ✅ 6問=今週レベル + 4問=ちょいムズ（1段階上。ただしN1を超えない）
export function pickWeeklyQuestions(params: {
  skill: WeeklySkill;
  level: WeeklyLevel;
  nCurrent?: number; // default 6
  nHard?: number; // default 4
}): WeeklyQuestion[] {
  const { skill, level } = params;
  const nCurrent = typeof params.nCurrent === "number" ? params.nCurrent : 6;
  const nHard = typeof params.nHard === "number" ? params.nHard : 4;

  const harder = clampHarder(level);
  const used = new Set(readUsed());

  const bank = allQuestions();

  const poolCurrent = bank.filter((q) => q.skill === skill && q.level === level && !used.has(q.id));
  const poolHard = bank.filter((q) => q.skill === skill && q.level === harder && !used.has(q.id));

  const pick = (arr: WeeklyQuestion[], n: number) => shuffle(arr).slice(0, n);

  let selected = [...pick(poolCurrent, nCurrent), ...pick(poolHard, nHard)];

  // 足りない時：そのskillの未使用から補充（レベル問わず）
  if (selected.length < nCurrent + nHard) {
    const poolAny = bank.filter(
      (q) => q.skill === skill && !used.has(q.id) && !selected.some((s) => s.id === q.id)
    );
    selected = [...selected, ...pick(poolAny, (nCurrent + nHard) - selected.length)];
  }

  // それでも足りない時：used をリセットして再抽選（最後の保険）
  if (selected.length < nCurrent + nHard) {
    writeUsed([]);
    return pickWeeklyQuestions(params);
  }

  // used登録（使い切り）
  const nextUsed = Array.from(new Set([...Array.from(used), ...selected.map((q) => q.id)]));
  writeUsed(nextUsed);

  return shuffle(selected);
}

type WeeklySetStore = {
  version: 1;
  createdAtISO: string;
  level: WeeklyLevel;
  skill: WeeklySkill;
  questionIds: string[]; // WEEKLY_BANK の id
};

export function buildAndSaveWeeklySet(params: { level: WeeklyLevel; skill: WeeklySkill }) {
  const qs = pickWeeklyQuestions({ level: params.level, skill: params.skill });
  const store: WeeklySetStore = {
    version: 1,
    createdAtISO: new Date().toISOString(),
    level: params.level,
    skill: params.skill,
    questionIds: qs.map((q) => q.id),
  };
  try {
    localStorage.setItem(WEEKLY_SET_KEY, JSON.stringify(store));
  } catch {}
  return store;
}

export function readWeeklySet(): WeeklySetStore | null {
  try {
    const raw = localStorage.getItem(WEEKLY_SET_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as WeeklySetStore;
    if (v?.version !== 1) return null;
    if (!Array.isArray(v.questionIds)) return null;
    return v;
  } catch {
    return null;
  }
}

export function getWeeklyQuestionById(id: string): WeeklyQuestion | null {
  const bank = allQuestions();
  return bank.find((q) => q.id === id) ?? null;
}