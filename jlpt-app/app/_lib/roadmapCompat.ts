// app/_lib/roadmapCompat.ts
"use client";

import type {
  RoadmapDay,
  RoadmapSet,
  RoadmapWeekV1,
  Skill,
} from "@/app/_lib/roadmap";

function asObj(v: unknown): Record<string, any> | null {
  return v && typeof v === "object" ? (v as Record<string, any>) : null;
}

function asArr<T = any>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

function asNum(v: unknown, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function asStr(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

function isSkill(v: unknown): v is Skill {
  return v === "vocab" || v === "grammar" || v === "reading";
}

function skillOrDefault(v: unknown): Skill {
  return isSkill(v) ? v : "vocab";
}

function normTargets(t: any): Record<Skill, number> {
  return {
    vocab: asNum(t?.vocab, 0),
    grammar: asNum(t?.grammar, 0),
    reading: asNum(t?.reading, 0),
  };
}

function inferSkillFromSetId(setId: string): Skill | undefined {
  if (setId.startsWith("vocab_")) return "vocab";
  if (setId.startsWith("grammar_")) return "grammar";
  if (setId.startsWith("reading_")) return "reading";
  return undefined;
}

function normalizeSet(s: any): RoadmapSet {
  const setId = asStr(s?.setId, "main");
  const inferredSkill = inferSkillFromSetId(setId);

  // ✅ roadmap.ts 側の progress shape が増減しても壊れにくい互換 progress
  //    必須項目だけ最低限埋めつつ、残りはそのまま保持
  const rawProgress = asObj(s?.progress) ?? {};
  const normalizedProgress = {
    ...rawProgress,
    total: asNum(rawProgress.total, Array.isArray(s?.questionIds) ? s.questionIds.length : 0),
    mastered: asArr<string>(rawProgress.mastered),
    attempts: asNum(rawProgress.attempts, 0),
    finishedAt: rawProgress.finishedAt ? String(rawProgress.finishedAt) : undefined,
  } as any;

  const out: RoadmapSet = {
    ...(asObj(s) ?? {}),
    setId,
    // union変更対策で loose
    kind: asStr(s?.kind, "legacy") as any,
    skill: skillOrDefault(s?.skill ?? inferredSkill),
    title: asStr(s?.title, "Set"),
    rule: (s?.rule ?? "mastery") as any,
    plannedCount: asNum(s?.plannedCount, 0),
    questionIds: asArr<string>(s?.questionIds),
    progress: normalizedProgress,
  };

  return out;
}

function normalizeDay(d: any, idx: number): RoadmapDay {
  const sets = asArr<any>(d?.sets).map(normalizeSet);

  const targetsMinutes = normTargets(d?.targetsMinutes ?? d?.targets);
  const fallbackDateISO = (() => {
    const dayIndex = asNum(d?.dayIndex, idx + 1);
    return `day-${dayIndex}`;
  })();

  const out: RoadmapDay = {
    ...(asObj(d) ?? {}),
    dayIndex: asNum(d?.dayIndex, idx + 1),
    dateISO: asStr(d?.dateISO, fallbackDateISO),
    status: (d?.status === "finish" ? "finish" : "todo") as any,
    focusSkill: d?.focusSkill ? skillOrDefault(d.focusSkill) : undefined,
    targetsMinutes,
    // 旧互換
    targets: normTargets(d?.targets ?? d?.targetsMinutes),
    sets,
  };

  return out;
}

function looksLikeWeekV1(x: any): x is RoadmapWeekV1 {
  return !!x && Array.isArray(x.days) && x.days.length > 0 && x.days.every((d: any) => d && typeof d === "object");
}

export function toWeekV1FromRoadmap(input: unknown): RoadmapWeekV1 | null {
  const x = asObj(input);
  if (!x) return null;

  // すでに week v1 っぽい
  if (looksLikeWeekV1(x)) {
    return {
      ...(x as any),
      weekId: asStr((x as any).weekId, "week-1"),
      goalLevel: ((x as any).goalLevel ?? (x as any).level ?? "N5") as any,
      days: asArr<any>((x as any).days).map((d, i) => normalizeDay(d, i)),
    } as RoadmapWeekV1;
  }

  // roadmap.week.days のケース吸収
  const nestedWeek = asObj(x.week);
  if (nestedWeek && Array.isArray(nestedWeek.days)) {
    return {
      ...(nestedWeek as any),
      weekId: asStr((nestedWeek as any).weekId ?? x.weekId, "week-1"),
      goalLevel: ((nestedWeek as any).goalLevel ?? x.goalLevel ?? x.level ?? "N5") as any,
      days: asArr<any>((nestedWeek as any).days).map((d, i) => normalizeDay(d, i)),
    } as RoadmapWeekV1;
  }

  // flat roadmap-like
  if (Array.isArray(x.days)) {
    return {
      weekId: asStr(x.weekId, "week-1"),
      goalLevel: (x.goalLevel ?? x.level ?? "N5") as any,
      days: asArr<any>(x.days).map((d, i) => normalizeDay(d, i)),
      createdAt: x.createdAt,
      updatedAt: x.updatedAt,
    } as RoadmapWeekV1;
  }

  return null;
}