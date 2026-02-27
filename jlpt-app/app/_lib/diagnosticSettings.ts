// app/_lib/diagnosticSettings.ts
export type JLPTLevel = "N5" | "N4" | "N3" | "N2" | "N1";

export const DIAG_SETTINGS_KEY = "lexio.diag.settings.v1";

export type DiagnosticSettings = {
  version: 1;
  goalLevel: JLPTLevel;          // required
  examDateISO: string | null;    // optional
  createdAt: string;
  updatedAt: string;
};

export function readJSON<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function writeJSON<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(value));
}

export function isJLPTLevel(x: any): x is JLPTLevel {
  return x === "N5" || x === "N4" || x === "N3" || x === "N2" || x === "N1";
}

export function todayISO() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}