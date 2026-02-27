// app/_lib/entitlements.ts
// Entitlements (Clerk-first, local fallback)
// - If logged in: read plan from Clerk user publicMetadata.plan
// - Else: localStorage (PLAN_KEY / legacy ENTITLEMENT_KEY)
// - setPlan() is dev-only (local), keeps legacy writes for compatibility.

export type JLPTLevel = "N5" | "N4" | "N3" | "N2" | "N1";
export type Plan = "free" | "pro";

export const LEVELS: JLPTLevel[] = ["N5", "N4", "N3", "N2", "N1"];

// Mock slots spec:
// - Free: Slot 1 only
// - Pro: Slots 1–11
export const MOCK_SLOTS = Array.from({ length: 11 }, (_, i) => i + 1) as ReadonlyArray<number>;

// ------------------------------------
// Storage keys
// ------------------------------------

// ✅ current canonical key
export const PLAN_KEY = "lexio.plan.v1";

// ✅ legacy key (older pages used this)
export const ENTITLEMENT_KEY = "lexio.entitlement.v1"; // { plan: "free"|"pro", updatedAt?: string }

// ✅ legacy/compat: per-level attempt counter
export const MOCK_ATTEMPTS_KEY = "lexio.mockAttempts.v1";

// ------------------------------------
// Types
// ------------------------------------
export type PlanState = {
  plan: Plan;
  updatedAtISO: string;
};

export type LegacyEntitlementState = {
  plan: Plan;
  updatedAt?: string; // legacy
  updatedAtISO?: string; // sometimes legacy used ISO name
};

export type MockAttemptsState = {
  // attempts used per level (count of started sessions)
  used: Record<JLPTLevel, number>;
  updatedAtISO: string;
};

// ------------------------------------
// Utils
// ------------------------------------
export function nowISO() {
  return new Date().toISOString();
}

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

function normalizePlan(x: any): Plan {
  return x === "pro" ? "pro" : "free";
}

// ------------------------------------
// ✅ Clerk (login-tied plan)
// ------------------------------------
function isBrowser() {
  return typeof window !== "undefined";
}

/**
 * Read plan from Clerk user metadata (client-side).
 * We try publicMetadata first; unsafeMetadata is a fallback for dev.
 *
 * Expected:
 *   window.Clerk.user.publicMetadata.plan = "free" | "pro"
 */
export function readPlanFromClerk(): Plan | null {
  if (!isBrowser()) return null;

  try {
    const clerk = (window as any)?.Clerk;
    const raw =
      clerk?.user?.publicMetadata?.plan ??
      clerk?.user?.unsafeMetadata?.plan ??
      null;

    const p = normalizePlan(raw);
    // normalizePlan returns "free" for unknown; treat unknown as null here
    if (raw === "pro" || raw === "free") return p;
    return null;
  } catch {
    return null;
  }
}

// ------------------------------------
// Plan (with migration) + Clerk priority
// ------------------------------------
export function getPlan(): Plan {
  // ✅ 0) Clerk first (login tied)
  const clerkPlan = readPlanFromClerk();
  if (clerkPlan) return clerkPlan;

  // 1) canonical
  const s = readJSON<PlanState>(PLAN_KEY);
  if (s?.plan === "pro" || s?.plan === "free") return s.plan;

  // 2) legacy entitlement key → migrate
  const legacy = readJSON<LegacyEntitlementState>(ENTITLEMENT_KEY);
  if (legacy?.plan === "pro" || legacy?.plan === "free") {
    const plan = normalizePlan(legacy.plan);
    // migrate forward (local only)
    setPlan(plan);
    return plan;
  }

  // 3) default
  return "free";
}

/**
 * Dev/local setter.
 * - Writes PLAN_KEY + legacy ENTITLEMENT_KEY for compat
 * - Does NOT update Clerk (that should be done by server/webhook later)
 */
export function setPlan(plan: Plan) {
  const next: PlanState = { plan: normalizePlan(plan), updatedAtISO: nowISO() };
  writeJSON(PLAN_KEY, next);

  // ✅ also write legacy key for safety (older pages still reading it won’t break)
  const legacy: LegacyEntitlementState = { plan: next.plan, updatedAtISO: next.updatedAtISO };
  writeJSON(ENTITLEMENT_KEY, legacy);

  // ✅ notify listeners (some pages rely on "storage" to refresh)
  try {
    window.dispatchEvent(new Event("storage"));
  } catch {
    // no-op
  }
}

export function isPro(plan: Plan = getPlan()) {
  return plan === "pro";
}

// ------------------------------------
// Practice Ad gate (Free only)
// Spec:
// - Free: must watch ad before starting a practice set
// - Pro: no ads, no skip prompt
// ------------------------------------
export function requiresPracticeAd(plan: Plan = getPlan()) {
  return plan !== "pro";
}

// ------------------------------------
// Mock: Slot lock (UI gating)
// ------------------------------------
export function isMockSlotLocked(plan: Plan, slot: number) {
  if (plan === "pro") return false;
  return slot !== 1;
}

export function canAccessMock(plan: Plan, slot: number) {
  return { ok: !isMockSlotLocked(plan, slot) };
}

// ------------------------------------
// Mock: Attempts / Limits (usage tracking) [legacy compat]
// Spec: Free = 1 / level, Pro = 10 / level
// ------------------------------------
export function getMockLimit(plan: Plan): number {
  return plan === "pro" ? 10 : 1;
}

export function getAttempts(): MockAttemptsState {
  const s = readJSON<MockAttemptsState>(MOCK_ATTEMPTS_KEY);
  if (s?.used) return s;

  const empty: MockAttemptsState = {
    used: { N5: 0, N4: 0, N3: 0, N2: 0, N1: 0 },
    updatedAtISO: nowISO(),
  };
  writeJSON(MOCK_ATTEMPTS_KEY, empty);
  return empty;
}

export function resetAttempts() {
  const empty: MockAttemptsState = {
    used: { N5: 0, N4: 0, N3: 0, N2: 0, N1: 0 },
    updatedAtISO: nowISO(),
  };
  writeJSON(MOCK_ATTEMPTS_KEY, empty);
}

export function canStartMock(level: JLPTLevel, plan = getPlan()) {
  const lim = getMockLimit(plan);
  const s = getAttempts();
  const used = s.used[level] ?? 0;
  return { ok: used < lim, used, limit: lim };
}

export function consumeMockAttempt(level: JLPTLevel) {
  const plan = getPlan();
  const lim = getMockLimit(plan);
  const s = getAttempts();
  const used = s.used[level] ?? 0;

  if (used >= lim) {
    return { ok: false, used, limit: lim };
  }

  const next: MockAttemptsState = {
    used: { ...s.used, [level]: used + 1 },
    updatedAtISO: nowISO(),
  };
  writeJSON(MOCK_ATTEMPTS_KEY, next);
  return { ok: true, used: used + 1, limit: lim };
}