// app/_lib/weeklyCheckBank.ts
import type { Skill } from "./roadmap";

export type WeeklySkill = Skill;
export type WeeklyLevel = "N5" | "N4" | "N3" | "N2" | "N1";

export type WeeklyQuestion = {
  id: string;
  skill: WeeklySkill;
  level: WeeklyLevel;
  prompt: string;
  choices: string[];
  correct: number; // 0..3
};

function q(
  id: string,
  skill: WeeklySkill,
  level: WeeklyLevel,
  prompt: string,
  choices: [string, string, string, string],
  correct: number
): WeeklyQuestion {
  return { id, skill, level, prompt, choices, correct };
}

/**
 * ✅ ID正規化（weekly-check の session / bank の命名ゆれ吸収）
 * 例:
 * - wc_r_008      -> r_008
 * - r_008         -> r_008
 * - reading_008   -> r_008
 * - wc_reading_008 -> r_008
 */
export function normalizeWeeklyQuestionId(raw: unknown): string {
  let s = String(raw ?? "").trim().toLowerCase();
  if (!s) return "";

  // 先頭プレフィックス除去
  s = s.replace(/^wc_/, "");

  // long prefix -> short prefix
  s = s
    .replace(/^vocab_/, "v_")
    .replace(/^grammar_/, "g_")
    .replace(/^reading_/, "r_");

  // 余分な空白・重複 _
  s = s.replace(/\s+/g, "").replace(/__+/g, "_");

  // "r8" / "r-8" / "r_8" っぽいものを "r_008" に寄せる（保険）
  const m = s.match(/^([vgr])[_-]?(\d{1,3})$/);
  if (m) {
    const p = m[1];
    const n = String(Number(m[2])).padStart(3, "0");
    return `${p}_${n}`;
  }

  // すでに r_008 / v_010 / g_001 なら桁だけ正規化
  const m2 = s.match(/^([vgr])_(\d{1,3})$/);
  if (m2) {
    const p = m2[1];
    const n = String(Number(m2[2])).padStart(3, "0");
    return `${p}_${n}`;
  }

  return s;
}

/**
 * skill から short prefix
 */
export function weeklySkillPrefix(skill: WeeklySkill): "v" | "g" | "r" {
  if (skill === "vocab") return "v";
  if (skill === "grammar") return "g";
  return "r";
}

/**
 * 問題1件から alias 候補を作る（検索用）
 */
export function getWeeklyQuestionIdAliases(question: WeeklyQuestion): string[] {
  const raw = String(question?.id ?? "");
  const normalized = normalizeWeeklyQuestionId(raw);

  const aliases = new Set<string>();
  if (raw) aliases.add(raw.toLowerCase());
  if (normalized) aliases.add(normalized);

  // normalized が r_008 のような形なら追加 alias を作る
  const m = normalized.match(/^([vgr])_(\d{3})$/);
  if (m) {
    const p = m[1];
    const n = m[2];

    aliases.add(`wc_${p}_${n}`);

    if (p === "v") aliases.add(`vocab_${n}`);
    if (p === "g") aliases.add(`grammar_${n}`);
    if (p === "r") aliases.add(`reading_${n}`);

    if (p === "v") aliases.add(`wc_vocab_${n}`);
    if (p === "g") aliases.add(`wc_grammar_${n}`);
    if (p === "r") aliases.add(`wc_reading_${n}`);
  }

  return Array.from(aliases);
}

/**
 * Record<vocab|grammar|reading, WeeklyQuestion[]> を平坦化
 */
export function flattenWeeklyBank(
  bank: Record<WeeklySkill, WeeklyQuestion[]> = WEEKLY_BANK
): WeeklyQuestion[] {
  return [
    ...(Array.isArray(bank.vocab) ? bank.vocab : []),
    ...(Array.isArray(bank.grammar) ? bank.grammar : []),
    ...(Array.isArray(bank.reading) ? bank.reading : []),
  ];
}

/**
 * 正規化IDベースの検索 index を生成
 * - key は normalizeWeeklyQuestionId(rawId) で引ける
 * - alias も登録するので id ゆれに強い
 */
export function buildWeeklyBankIndex(
  bank: Record<WeeklySkill, WeeklyQuestion[]> = WEEKLY_BANK
): Map<string, WeeklyQuestion> {
  const map = new Map<string, WeeklyQuestion>();

  for (const question of flattenWeeklyBank(bank)) {
    const aliases = getWeeklyQuestionIdAliases(question);

    for (const alias of aliases) {
      const key = normalizeWeeklyQuestionId(alias) || alias.toLowerCase();
      if (key && !map.has(key)) {
        map.set(key, question);
      }
    }

    // raw alias でも引けるように（normalizeしない直接一致の保険）
    for (const alias of aliases) {
      const k = alias.toLowerCase();
      if (k && !map.has(k)) {
        map.set(k, question);
      }
    }
  }

  return map;
}

/**
 * IDゆれ対応つきの問題検索
 * 例:
 * - findWeeklyQuestionById("wc_r_008")
 * - findWeeklyQuestionById("r_008")
 * - findWeeklyQuestionById("reading_008")
 */
export function findWeeklyQuestionById(
  id: unknown,
  bank: Record<WeeklySkill, WeeklyQuestion[]> = WEEKLY_BANK
): WeeklyQuestion | null {
  const raw = String(id ?? "").trim();
  if (!raw) return null;

  const index = buildWeeklyBankIndex(bank);

  return (
    index.get(raw.toLowerCase()) ??
    index.get(normalizeWeeklyQuestionId(raw)) ??
    null
  );
}

/**
 * skill + 番号から問題を引く（fallback用）
 * - skill: "reading", no: 8 -> wc_r_008
 */
export function findWeeklyQuestionBySkillAndSeq(
  skill: WeeklySkill,
  seq: number,
  bank: Record<WeeklySkill, WeeklyQuestion[]> = WEEKLY_BANK
): WeeklyQuestion | null {
  const list = Array.isArray(bank?.[skill]) ? bank[skill] : [];
  if (!Number.isFinite(seq)) return null;

  const prefix = weeklySkillPrefix(skill);
  const normalized = `${prefix}_${String(Math.max(1, Math.floor(seq))).padStart(3, "0")}`;

  for (const item of list) {
    const itemNorm = normalizeWeeklyQuestionId(item?.id);
    if (itemNorm === normalized) return item;
  }

  return null;
}

/**
 * ✅ Weekly Check Bank (temporary / seed)
 * - Vocab 10
 * - Grammar 10
 * - Reading 10
 * まずは全部 N5 でOK（後で N4/N3…に増やせる）
 *
 * id は "wc_v_001 / wc_g_001 / wc_r_001" を canonical にする
 * （session側が r_001 / reading_001 でも normalize で吸収可能）
 */
export const WEEKLY_BANK: Record<WeeklySkill, WeeklyQuestion[]> = {
  vocab: [
    q(
      "wc_v_001",
      "vocab",
      "N5",
      "「迅速」の意味は？",
      ["おそい", "はやい", "あかるい", "しずか"],
      1
    ),
    q(
      "wc_v_002",
      "vocab",
      "N5",
      "「利用する」に近い意味は？",
      ["つかう", "すてる", "かえる", "あつめる"],
      0
    ),
    q(
      "wc_v_003",
      "vocab",
      "N5",
      "「到着」の意味は？",
      ["出発すること", "着くこと", "休むこと", "戻ること"],
      1
    ),
    q(
      "wc_v_004",
      "vocab",
      "N5",
      "「不足」の意味は？",
      ["多すぎる", "足りない", "同じ", "変わらない"],
      1
    ),
    q(
      "wc_v_005",
      "vocab",
      "N5",
      "「準備」の意味は？",
      ["出かけること", "用意すること", "食べること", "探すこと"],
      1
    ),
    q(
      "wc_v_006",
      "vocab",
      "N5",
      "「価格」の意味は？",
      ["ねだん", "きせつ", "じかん", "しゅみ"],
      0
    ),
    q(
      "wc_v_007",
      "vocab",
      "N5",
      "「確認する」の意味は？",
      ["しらべる", "わすれる", "ねる", "たたく"],
      0
    ),
    q(
      "wc_v_008",
      "vocab",
      "N5",
      "「経験」の意味は？",
      ["けいかく", "たいけん", "けんか", "けんきゅう"],
      1
    ),
    q(
      "wc_v_009",
      "vocab",
      "N5",
      "「案内」の意味は？",
      ["せつめいしてつれていくこと", "あやまること", "たのむこと", "ならぶこと"],
      0
    ),
    q(
      "wc_v_010",
      "vocab",
      "N5",
      "「提出」の意味は？",
      ["出して出すこと（書類など）", "買ってくること", "消すこと", "守ること"],
      0
    ),
  ],

  grammar: [
    q(
      "wc_g_001",
      "grammar",
      "N5",
      "雨が降る_____、試合は中止になった。",
      ["ため", "ので", "から", "けれど"],
      1
    ),
    q(
      "wc_g_002",
      "grammar",
      "N5",
      "時間がない_____、タクシーで行きます。",
      ["から", "けれど", "のに", "だけ"],
      0
    ),
    q(
      "wc_g_003",
      "grammar",
      "N5",
      "この本は難しい_____、おもしろい。",
      ["けれど", "ので", "から", "まで"],
      0
    ),
    q(
      "wc_g_004",
      "grammar",
      "N5",
      "きのうは忙しくて、映画を見_____。",
      ["ませんでした", "ます", "ました", "たいです"],
      0
    ),
    q(
      "wc_g_005",
      "grammar",
      "N5",
      "毎朝6時に起きて、ジョギング_____します。",
      ["を", "に", "で", "へ"],
      0
    ),
    q(
      "wc_g_006",
      "grammar",
      "N5",
      "ここに名前を_____ください。",
      ["書いて", "書きて", "書くて", "書いた"],
      0
    ),
    q(
      "wc_g_007",
      "grammar",
      "N5",
      "駅まで_____分ぐらいかかります。",
      ["歩く", "歩いて", "歩いた", "歩き"],
      1
    ),
    q(
      "wc_g_008",
      "grammar",
      "N5",
      "私は日本語_____勉強しています。",
      ["を", "が", "に", "で"],
      0
    ),
    q(
      "wc_g_009",
      "grammar",
      "N5",
      "先生は教室に_____。",
      ["います", "あります", "いきます", "しました"],
      0
    ),
    q(
      "wc_g_010",
      "grammar",
      "N5",
      "寒い_____、コートを着ましょう。",
      ["から", "けれど", "のに", "だけ"],
      0
    ),
  ],

  reading: [
    q(
      "wc_r_001",
      "reading",
      "N5",
      "文章：彼は毎日早く起きて勉強する。彼はどんな人？",
      ["なまけもの", "努力家", "怒りっぽい", "忘れっぽい"],
      1
    ),
    q(
      "wc_r_002",
      "reading",
      "N5",
      "文章：店は10時に開き、8時に閉まる。店は何時に閉まる？",
      ["8時", "10時", "20時", "18時"],
      0
    ),
    q(
      "wc_r_003",
      "reading",
      "N5",
      "文章：今日は雨なので、傘を持っていく。なぜ傘を持っていく？",
      ["暑いから", "雨だから", "風が強いから", "雪だから"],
      1
    ),
    q(
      "wc_r_004",
      "reading",
      "N5",
      "文章：田中さんは野菜が好きではない。田中さんは何が好きではない？",
      ["肉", "魚", "野菜", "果物"],
      2
    ),
    q(
      "wc_r_005",
      "reading",
      "N5",
      "文章：来週の月曜日に会議があります。会議はいつ？",
      ["今週の月曜日", "来週の月曜日", "来週の日曜日", "今週の金曜日"],
      1
    ),
    q(
      "wc_r_006",
      "reading",
      "N5",
      "文章：このバスは駅の前に止まります。バスはどこに止まる？",
      ["駅の前", "駅の中", "駅の後ろ", "駅の上"],
      0
    ),
    q(
      "wc_r_007",
      "reading",
      "N5",
      "文章：Aさん『すみません、もう一度言ってください。』Aさんは何をしたい？",
      ["話をやめたい", "もう一度聞きたい", "帰りたい", "食べたい"],
      1
    ),
    q(
      "wc_r_008",
      "reading",
      "N5",
      "文章：図書館では静かにしてください。図書館でどうする？",
      ["大きな声で話す", "走る", "静かにする", "歌う"],
      2
    ),
    q(
      "wc_r_009",
      "reading",
      "N5",
      "文章：この道をまっすぐ行って、二つ目の角を右です。どこで右に曲がる？",
      ["一つ目の角", "二つ目の角", "三つ目の角", "信号の前"],
      1
    ),
    q(
      "wc_r_010",
      "reading",
      "N5",
      "文章：きのうは熱があったので、学校を休みました。なぜ休んだ？",
      ["お金がないから", "熱があったから", "雨だから", "眠いから"],
      1
    ),
  ],
};