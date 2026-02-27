// app/_lib/profile.ts

// ------------------------------------
// Types
// ------------------------------------
export type JLPTLevel = "N5" | "N4" | "N3" | "N2" | "N1";
export type Skill = "vocab" | "grammar" | "reading";

// ------------------------------------
// Storage Key
// ------------------------------------
export const PROFILE_KEY = "lexio.profile.v1";

// ------------------------------------
// Profile Type (v1)
// ------------------------------------
export type ProfileV1 = {
  version: 1;
  updatedAt: string;

  // from diagnostic
  currentLevel: JLPTLevel;
  weakestSkill: Skill;
  skillAcc: Record<Skill, number>; // 0..100
  idkCount?: number;

  // from phase0 settings
  goalLevel: JLPTLevel;
  dailyMinutes: 10 | 20 | 30;
  examDateISO?: string | null;
};

// ------------------------------------
// JSON Helpers
// ------------------------------------
export function readJSON<T>(key: string): T | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function writeJSON<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}