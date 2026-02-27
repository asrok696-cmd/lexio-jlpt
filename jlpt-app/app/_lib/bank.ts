// app/_lib/bank.ts

export type Skill = "vocab" | "grammar" | "reading";

export type BankChoiceQ = {
  id: string;
  skill: Skill;
  prompt: string;
  choices: string[];
  correct: number; // index
  level?: string;  // optional (N5/N4 etc)
  tags?: string[];
};

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = a[i];
    a[i] = a[j];
    a[j] = tmp;
  }
  return a;
}

/**
 * ✅ どんな形のBANKでも拾えるようにする
 * - bank[skill] が配列 → それを返す
 * - ネスト構造 → 再帰で全走査して {id,prompt,choices,correct,skill} っぽいものを拾う
 */
export function pickQuestionsFromBank(bank: any, skill: Skill): BankChoiceQ[] {
  if (!bank) return [];

  // 1) いちばん多い形: { vocab: [...], grammar: [...], reading: [...] }
  const direct = bank?.[skill];
  if (Array.isArray(direct)) {
    return direct
      .map(normalizeQuestion)
      .filter((q): q is BankChoiceQ => !!q && q.skill === skill);
  }

  // 2) その他の形: ネストを全部走査して拾う
  const collected: BankChoiceQ[] = [];
  walk(bank, (x) => {
    const q = normalizeQuestion(x);
    if (q && q.skill === skill) collected.push(q);
  });

  // 重複ID排除
  const seen = new Set<string>();
  const uniq: BankChoiceQ[] = [];
  for (const q of collected) {
    if (seen.has(q.id)) continue;
    seen.add(q.id);
    uniq.push(q);
  }
  return uniq;
}

// ---------------------------
// internal helpers
// ---------------------------

function normalizeQuestion(x: any): BankChoiceQ | null {
  if (!x || typeof x !== "object") return null;

  // 必須っぽいもの
  const id = String(x.id ?? "");
  const prompt = typeof x.prompt === "string" ? x.prompt : typeof x.q === "string" ? x.q : "";
  const choices = Array.isArray(x.choices) ? x.choices.map(String) : Array.isArray(x.options) ? x.options.map(String) : null;
  const correctRaw = x.correct ?? x.answer ?? x.correctIndex;

  // skill 推定
  const skill = toSkill(x.skill ?? x.type ?? x.kind ?? inferSkillFromId(id) ?? null);

  if (!id || !prompt || !choices || choices.length < 2) return null;
  const correct = Number(correctRaw);
  if (!Number.isFinite(correct) || correct < 0 || correct >= choices.length) return null;
  if (!skill) return null;

  const level = typeof x.level === "string" ? x.level : undefined;
  const tags = Array.isArray(x.tags) ? x.tags.map(String) : undefined;

  return { id, prompt, choices, correct, skill, level, tags };
}

function toSkill(v: any): Skill | null {
  if (v === "vocab" || v === "grammar" || v === "reading") return v;
  return null;
}

function inferSkillFromId(id: string): Skill | null {
  const s = id.toLowerCase();
  if (s.includes("vocab")) return "vocab";
  if (s.includes("gram")) return "grammar";
  if (s.includes("read")) return "reading";
  return null;
}

function walk(node: any, visit: (x: any) => void) {
  if (!node) return;

  if (Array.isArray(node)) {
    for (const v of node) walk(v, visit);
    return;
  }

  if (typeof node === "object") {
    visit(node);
    for (const k of Object.keys(node)) {
      walk(node[k], visit);
    }
  }
}