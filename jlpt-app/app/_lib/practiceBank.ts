// app/_lib/practiceBank.ts

import type { Skill, JLPTLevel } from "@/app/_lib/roadmap";
import type { BankChoiceQ } from "@/app/_lib/bank";

/**
 * 通常練習用バンク（Day1-Day6）
 * - weeklyCheckBank とは分離
 * - Pick / Session で使う
 * - Vocab / Grammar / Reading を skill別に管理
 *
 * 注意:
 * bank.ts / 既存コード互換のため、問題オブジェクトに以下を揃える
 * - id
 * - skill
 * - prompt
 * - choices (4択)
 * - correct (index)
 * - levelTag（+ 互換で level も入れる）
 */

export type PracticeChoiceQ = BankChoiceQ & {
  skill: Skill;
  levelTag: JLPTLevel;
  level?: JLPTLevel; // compat
};

type PracticeBank = Record<Skill, PracticeChoiceQ[]>;

function q(params: {
  id: string;
  skill: Skill;
  levelTag: JLPTLevel;
  prompt: string;
  choices: string[];
  correct: number;
}): PracticeChoiceQ {
  return {
    ...params,
    level: params.levelTag, // compat
  } as PracticeChoiceQ;
}

/* =========================================================
 * ✅ PRACTICE_BANK（動作確認用の最低限データ入り）
 *    - vocab: 30問（N5）
 *    - grammar: 30問（N5）
 *    - reading: 15問（N5）
 * これで基本的に
 *   vocab/grammar = 10問 × 3セット
 *   reading       = 5問 × 3セット
 * を重複少なめで回せる
 * ========================================================= */
export const PRACTICE_BANK: PracticeBank = {
  vocab: [
    q({
      id: "pv_n5_001",
      skill: "vocab",
      levelTag: "N5",
      prompt: "「たべる」の意味に最も近い英語は？",
      choices: ["to drink", "to eat", "to buy", "to go"],
      correct: 1,
    }),
    q({
      id: "pv_n5_002",
      skill: "vocab",
      levelTag: "N5",
      prompt: "「のむ」の意味に最も近い英語は？",
      choices: ["to sleep", "to read", "to drink", "to write"],
      correct: 2,
    }),
    q({
      id: "pv_n5_003",
      skill: "vocab",
      levelTag: "N5",
      prompt: "「いく」の意味に最も近い英語は？",
      choices: ["to go", "to come", "to sit", "to stand"],
      correct: 0,
    }),
    q({
      id: "pv_n5_004",
      skill: "vocab",
      levelTag: "N5",
      prompt: "「みる」の意味に最も近い英語は？",
      choices: ["to hear", "to see", "to say", "to wait"],
      correct: 1,
    }),
    q({
      id: "pv_n5_005",
      skill: "vocab",
      levelTag: "N5",
      prompt: "「きく」の意味に最も近い英語は？",
      choices: ["to ask / listen", "to run", "to open", "to close"],
      correct: 0,
    }),
    q({
      id: "pv_n5_006",
      skill: "vocab",
      levelTag: "N5",
      prompt: "「おおきい」の意味に最も近い英語は？",
      choices: ["small", "long", "big", "new"],
      correct: 2,
    }),
    q({
      id: "pv_n5_007",
      skill: "vocab",
      levelTag: "N5",
      prompt: "「ちいさい」の意味に最も近い英語は？",
      choices: ["small", "strong", "bright", "hot"],
      correct: 0,
    }),
    q({
      id: "pv_n5_008",
      skill: "vocab",
      levelTag: "N5",
      prompt: "「あたらしい」の意味に最も近い英語は？",
      choices: ["old", "new", "cheap", "dark"],
      correct: 1,
    }),
    q({
      id: "pv_n5_009",
      skill: "vocab",
      levelTag: "N5",
      prompt: "「ふるい」の意味に最も近い英語は？",
      choices: ["old", "young", "early", "late"],
      correct: 0,
    }),
    q({
      id: "pv_n5_010",
      skill: "vocab",
      levelTag: "N5",
      prompt: "「ともだち」の意味に最も近い英語は？",
      choices: ["teacher", "friend", "family", "student"],
      correct: 1,
    }),
    q({
      id: "pv_n5_011",
      skill: "vocab",
      levelTag: "N5",
      prompt: "「せんせい」の意味に最も近い英語は？",
      choices: ["doctor", "teacher", "engineer", "driver"],
      correct: 1,
    }),
    q({
      id: "pv_n5_012",
      skill: "vocab",
      levelTag: "N5",
      prompt: "「がくせい」の意味に最も近い英語は？",
      choices: ["student", "parent", "child", "manager"],
      correct: 0,
    }),
    q({
      id: "pv_n5_013",
      skill: "vocab",
      levelTag: "N5",
      prompt: "「くる」の意味に最も近い英語は？",
      choices: ["to come", "to leave", "to make", "to use"],
      correct: 0,
    }),
    q({
      id: "pv_n5_014",
      skill: "vocab",
      levelTag: "N5",
      prompt: "「かう」の意味に最も近い英語は？",
      choices: ["to sell", "to buy", "to cut", "to send"],
      correct: 1,
    }),
    q({
      id: "pv_n5_015",
      skill: "vocab",
      levelTag: "N5",
      prompt: "「よむ」の意味に最も近い英語は？",
      choices: ["to read", "to write", "to speak", "to listen"],
      correct: 0,
    }),
    q({
      id: "pv_n5_016",
      skill: "vocab",
      levelTag: "N5",
      prompt: "「かく」の意味に最も近い英語は？",
      choices: ["to open", "to draw", "to write", "to carry"],
      correct: 2,
    }),
    q({
      id: "pv_n5_017",
      skill: "vocab",
      levelTag: "N5",
      prompt: "「はやい」の意味に最も近い英語は？",
      choices: ["slow", "fast / early", "heavy", "warm"],
      correct: 1,
    }),
    q({
      id: "pv_n5_018",
      skill: "vocab",
      levelTag: "N5",
      prompt: "「おそい」の意味に最も近い英語は？",
      choices: ["late / slow", "early", "high", "clean"],
      correct: 0,
    }),
    q({
      id: "pv_n5_019",
      skill: "vocab",
      levelTag: "N5",
      prompt: "「しろい」の意味に最も近い英語は？",
      choices: ["black", "blue", "white", "red"],
      correct: 2,
    }),
    q({
      id: "pv_n5_020",
      skill: "vocab",
      levelTag: "N5",
      prompt: "「くろい」の意味に最も近い英語は？",
      choices: ["black", "yellow", "green", "pink"],
      correct: 0,
    }),
    q({
      id: "pv_n5_021",
      skill: "vocab",
      levelTag: "N5",
      prompt: "「やま」の意味に最も近い英語は？",
      choices: ["river", "mountain", "sea", "forest"],
      correct: 1,
    }),
    q({
      id: "pv_n5_022",
      skill: "vocab",
      levelTag: "N5",
      prompt: "「かわ」の意味に最も近い英語は？",
      choices: ["river", "road", "bridge", "lake"],
      correct: 0,
    }),
    q({
      id: "pv_n5_023",
      skill: "vocab",
      levelTag: "N5",
      prompt: "「うみ」の意味に最も近い英語は？",
      choices: ["hill", "sea", "rain", "cloud"],
      correct: 1,
    }),
    q({
      id: "pv_n5_024",
      skill: "vocab",
      levelTag: "N5",
      prompt: "「くるま」の意味に最も近い英語は？",
      choices: ["train", "car", "bicycle", "bus stop"],
      correct: 1,
    }),
    q({
      id: "pv_n5_025",
      skill: "vocab",
      levelTag: "N5",
      prompt: "「でんしゃ」の意味に最も近い英語は？",
      choices: ["train", "plane", "ship", "taxi"],
      correct: 0,
    }),
    q({
      id: "pv_n5_026",
      skill: "vocab",
      levelTag: "N5",
      prompt: "「えき」の意味に最も近い英語は？",
      choices: ["station", "airport", "office", "factory"],
      correct: 0,
    }),
    q({
      id: "pv_n5_027",
      skill: "vocab",
      levelTag: "N5",
      prompt: "「いえ」の意味に最も近い英語は？",
      choices: ["school", "house", "store", "park"],
      correct: 1,
    }),
    q({
      id: "pv_n5_028",
      skill: "vocab",
      levelTag: "N5",
      prompt: "「へや」の意味に最も近い英語は？",
      choices: ["room", "door", "window", "floor"],
      correct: 0,
    }),
    q({
      id: "pv_n5_029",
      skill: "vocab",
      levelTag: "N5",
      prompt: "「つくえ」の意味に最も近い英語は？",
      choices: ["chair", "desk", "bag", "lamp"],
      correct: 1,
    }),
    q({
      id: "pv_n5_030",
      skill: "vocab",
      levelTag: "N5",
      prompt: "「いす」の意味に最も近い英語は？",
      choices: ["bed", "table", "chair", "shelf"],
      correct: 2,
    }),
  ],

  grammar: [
    q({
      id: "pg_n5_001",
      skill: "grammar",
      levelTag: "N5",
      prompt: "わたしは 毎日 学校___ 行きます。",
      choices: ["を", "に", "で", "と"],
      correct: 1,
    }),
    q({
      id: "pg_n5_002",
      skill: "grammar",
      levelTag: "N5",
      prompt: "りんご___ 食べます。",
      choices: ["を", "に", "へ", "がら"],
      correct: 0,
    }),
    q({
      id: "pg_n5_003",
      skill: "grammar",
      levelTag: "N5",
      prompt: "日曜日___ 友だちと会いました。",
      choices: ["で", "に", "を", "へ"],
      correct: 1,
    }),
    q({
      id: "pg_n5_004",
      skill: "grammar",
      levelTag: "N5",
      prompt: "日本語___ 勉強しています。",
      choices: ["が", "を", "に", "と"],
      correct: 1,
    }),
    q({
      id: "pg_n5_005",
      skill: "grammar",
      levelTag: "N5",
      prompt: "これは わたし___ 本です。",
      choices: ["の", "を", "に", "で"],
      correct: 0,
    }),
    q({
      id: "pg_n5_006",
      skill: "grammar",
      levelTag: "N5",
      prompt: "きのうは とても___ です。",
      choices: ["あつい", "あつかった", "あつく", "あつさ"],
      correct: 1,
    }),
    q({
      id: "pg_n5_007",
      skill: "grammar",
      levelTag: "N5",
      prompt: "今、雨___ 降っています。",
      choices: ["を", "に", "が", "で"],
      correct: 2,
    }),
    q({
      id: "pg_n5_008",
      skill: "grammar",
      levelTag: "N5",
      prompt: "コーヒー___ 飲みませんか。",
      choices: ["を", "が", "は", "で"],
      correct: 0,
    }),
    q({
      id: "pg_n5_009",
      skill: "grammar",
      levelTag: "N5",
      prompt: "田中さん___ 来ました。",
      choices: ["が", "を", "に", "へ"],
      correct: 0,
    }),
    q({
      id: "pg_n5_010",
      skill: "grammar",
      levelTag: "N5",
      prompt: "部屋___ テレビがあります。",
      choices: ["に", "で", "を", "と"],
      correct: 0,
    }),

    q({
      id: "pg_n5_011",
      skill: "grammar",
      levelTag: "N5",
      prompt: "わたしは 日本___ 住んでいます。",
      choices: ["を", "に", "で", "と"],
      correct: 1,
    }),
    q({
      id: "pg_n5_012",
      skill: "grammar",
      levelTag: "N5",
      prompt: "毎朝 6時___ 起きます。",
      choices: ["を", "が", "に", "へ"],
      correct: 2,
    }),
    q({
      id: "pg_n5_013",
      skill: "grammar",
      levelTag: "N5",
      prompt: "きょうだい___ 2人います。",
      choices: ["が", "を", "に", "へ"],
      correct: 0,
    }),
    q({
      id: "pg_n5_014",
      skill: "grammar",
      levelTag: "N5",
      prompt: "わたしは パン___ 牛乳を かいました。",
      choices: ["や", "も", "に", "で"],
      correct: 0,
    }),
    q({
      id: "pg_n5_015",
      skill: "grammar",
      levelTag: "N5",
      prompt: "ここ___ 名前を 書いてください。",
      choices: ["で", "に", "を", "が"],
      correct: 1,
    }),
    q({
      id: "pg_n5_016",
      skill: "grammar",
      levelTag: "N5",
      prompt: "駅まで あるいて 行きました。駅___ バスに 乗りました。",
      choices: ["を", "で", "に", "へ"],
      correct: 1,
    }),
    q({
      id: "pg_n5_017",
      skill: "grammar",
      levelTag: "N5",
      prompt: "これは とても___ かばんです。",
      choices: ["きれい", "きれいな", "きれいに", "きれいで"],
      correct: 1,
    }),
    q({
      id: "pg_n5_018",
      skill: "grammar",
      levelTag: "N5",
      prompt: "わたしは すし___ すきです。",
      choices: ["を", "が", "に", "へ"],
      correct: 1,
    }),
    q({
      id: "pg_n5_019",
      skill: "grammar",
      levelTag: "N5",
      prompt: "この本は おもしろ___ です。",
      choices: ["い", "く", "かった", "かったです"],
      correct: 3,
    }),
    q({
      id: "pg_n5_020",
      skill: "grammar",
      levelTag: "N5",
      prompt: "あした 東京___ 行く 予定です。",
      choices: ["を", "へ", "で", "が"],
      correct: 1,
    }),

    q({
      id: "pg_n5_021",
      skill: "grammar",
      levelTag: "N5",
      prompt: "わたしの うちは 学校___ 近いです。",
      choices: ["で", "を", "に", "から"],
      correct: 2,
    }),
    q({
      id: "pg_n5_022",
      skill: "grammar",
      levelTag: "N5",
      prompt: "土曜日は 仕事___ ありません。",
      choices: ["が", "は", "を", "に"],
      correct: 0,
    }),
    q({
      id: "pg_n5_023",
      skill: "grammar",
      levelTag: "N5",
      prompt: "この店は 9時___ 17時までです。",
      choices: ["を", "から", "まで", "へ"],
      correct: 1,
    }),
    q({
      id: "pg_n5_024",
      skill: "grammar",
      levelTag: "N5",
      prompt: "わたしは 日曜日___ 勉強しません。",
      choices: ["に", "で", "を", "へ"],
      correct: 0,
    }),
    q({
      id: "pg_n5_025",
      skill: "grammar",
      levelTag: "N5",
      prompt: "先生の 話を よく___ ください。",
      choices: ["きいて", "きく", "きき", "きいた"],
      correct: 0,
    }),
    q({
      id: "pg_n5_026",
      skill: "grammar",
      levelTag: "N5",
      prompt: "ここで 写真を とっ___ いいですか。",
      choices: ["た", "て", "たり", "と"],
      correct: 1,
    }),
    q({
      id: "pg_n5_027",
      skill: "grammar",
      levelTag: "N5",
      prompt: "雨だから、かさを 持っ___ 行きます。",
      choices: ["て", "た", "で", "に"],
      correct: 0,
    }),
    q({
      id: "pg_n5_028",
      skill: "grammar",
      levelTag: "N5",
      prompt: "わたしは 毎晩 11時に 寝___。",
      choices: ["ます", "ました", "ません", "ましょう"],
      correct: 0,
    }),
    q({
      id: "pg_n5_029",
      skill: "grammar",
      levelTag: "N5",
      prompt: "このりんごは 3つ___ 100円です。",
      choices: ["を", "で", "に", "と"],
      correct: 1,
    }),
    q({
      id: "pg_n5_030",
      skill: "grammar",
      levelTag: "N5",
      prompt: "兄は わたし___ 背が 高いです。",
      choices: ["より", "ほど", "まで", "しか"],
      correct: 0,
    }),
  ],

  reading: [
    q({
      id: "pr_n5_001",
      skill: "reading",
      levelTag: "N5",
      prompt:
        "【短文】あした、わたしは ともだちと こうえんへ いきます。そこで サッカーを します。質問：あした、どこへ いきますか。",
      choices: ["学校", "公園", "駅", "図書館"],
      correct: 1,
    }),
    q({
      id: "pr_n5_002",
      skill: "reading",
      levelTag: "N5",
      prompt:
        "【短文】きょうは あめです。わたしは うちで ほんを よみます。質問：きょう、わたしは 何をしますか。",
      choices: ["走ります", "本を読みます", "買い物します", "料理します"],
      correct: 1,
    }),
    q({
      id: "pr_n5_003",
      skill: "reading",
      levelTag: "N5",
      prompt:
        "【短文】わたしの いもうとは まいにち 7じに おきます。質問：いもうとは 何時に起きますか。",
      choices: ["6時", "7時", "8時", "9時"],
      correct: 1,
    }),
    q({
      id: "pr_n5_004",
      skill: "reading",
      levelTag: "N5",
      prompt:
        "【短文】この みせは 10じから 8じまでです。質問：店は 何時に はじまりますか。",
      choices: ["8時", "9時", "10時", "11時"],
      correct: 2,
    }),
    q({
      id: "pr_n5_005",
      skill: "reading",
      levelTag: "N5",
      prompt:
        "【短文】わたしは すしが すきですが、なっとうは すきではありません。質問：わたしが すきではないものは 何ですか。",
      choices: ["すし", "なっとう", "さかな", "ごはん"],
      correct: 1,
    }),
    q({
      id: "pr_n5_006",
      skill: "reading",
      levelTag: "N5",
      prompt:
        "【短文】でんしゃで 会社へ 行きます。会社まで 30分です。質問：会社まで どのくらい かかりますか。",
      choices: ["10分", "20分", "30分", "40分"],
      correct: 2,
    }),
    q({
      id: "pr_n5_007",
      skill: "reading",
      levelTag: "N5",
      prompt:
        "【短文】きのう、スーパーで りんごと パンを かいました。質問：きのう、何を かいましたか。",
      choices: ["りんごとパン", "牛乳と卵", "本とノート", "くつとふく"],
      correct: 0,
    }),
    q({
      id: "pr_n5_008",
      skill: "reading",
      levelTag: "N5",
      prompt:
        "【短文】わたしの 学校は 8じ半に はじまります。質問：学校は 何時に はじまりますか。",
      choices: ["8時", "8時半", "9時", "9時半"],
      correct: 1,
    }),
    q({
      id: "pr_n5_009",
      skill: "reading",
      levelTag: "N5",
      prompt:
        "【短文】日曜日に かぞくと えいがを みました。とても おもしろかったです。質問：だれと えいがを みましたか。",
      choices: ["友だち", "先生", "家族", "一人で"],
      correct: 2,
    }),
    q({
      id: "pr_n5_010",
      skill: "reading",
      levelTag: "N5",
      prompt:
        "【短文】この バスは えきへ 行きません。びょういんへ 行きます。質問：このバスは どこへ 行きますか。",
      choices: ["駅", "病院", "学校", "市役所"],
      correct: 1,
    }),
    q({
      id: "pr_n5_011",
      skill: "reading",
      levelTag: "N5",
      prompt:
        "【短文】わたしは まいばん 9じから 10じまで 日本語を べんきょうします。質問：どのくらい 日本語を 勉強しますか。",
      choices: ["30分", "1時間", "2時間", "3時間"],
      correct: 1,
    }),
    q({
      id: "pr_n5_012",
      skill: "reading",
      levelTag: "N5",
      prompt:
        "【短文】田中さんは コーヒーを のみますが、わたしは おちゃを のみます。質問：わたしは 何を のみますか。",
      choices: ["コーヒー", "お茶", "水", "ジュース"],
      correct: 1,
    }),
    q({
      id: "pr_n5_013",
      skill: "reading",
      levelTag: "N5",
      prompt:
        "【短文】へやに つくえが ひとつ と いすが ふたつ あります。質問：いすは いくつ ありますか。",
      choices: ["1つ", "2つ", "3つ", "4つ"],
      correct: 1,
    }),
    q({
      id: "pr_n5_014",
      skill: "reading",
      levelTag: "N5",
      prompt:
        "【短文】わたしの たんじょうびは 5月10日です。質問：わたしの たんじょうびは いつですか。",
      choices: ["4月10日", "5月1日", "5月10日", "10月5日"],
      correct: 2,
    }),
    q({
      id: "pr_n5_015",
      skill: "reading",
      levelTag: "N5",
      prompt:
        "【短文】けさは 7じに おきて、8じに うちを でました。質問：うちを でたのは 何時ですか。",
      choices: ["7時", "7時半", "8時", "8時半"],
      correct: 2,
    }),
  ],
};

/**
 * （任意）開発中に確認しやすい簡易メタ
 */
export const PRACTICE_BANK_META = {
  counts: {
    vocab: PRACTICE_BANK.vocab.length,
    grammar: PRACTICE_BANK.grammar.length,
    reading: PRACTICE_BANK.reading.length,
  },
};

if (typeof window !== "undefined") {
  // 開発中の「空配列だった」事故を気づきやすくする
  const c = PRACTICE_BANK_META.counts;
  if (c.vocab === 0 || c.grammar === 0 || c.reading === 0) {
    // eslint-disable-next-line no-console
    console.warn("[practiceBank] Some PRACTICE_BANK arrays are empty:", c);
  }
}

/* =========================================================
 * ✅ ここから追加（Session / Pick 用の取得API）
 * ========================================================= */

export type PracticeSessionQuestion = {
  qid: string;
  prompt: string;
  choices: string[];
  answerIndex: number;
  explanation?: string;
  // debug / analytics で使いやすいように保持
  skill: Skill;
  level: JLPTLevel;
  sourceId: string; // 元のbank id
};

function isSkill(v: unknown): v is Skill {
  return v === "vocab" || v === "grammar" || v === "reading";
}

function isJLPTLevel(v: unknown): v is JLPTLevel {
  return v === "N5" || v === "N4" || v === "N3" || v === "N2" || v === "N1";
}

function clampPositiveInt(n: unknown, fallback: number): number {
  const v = Number(n);
  if (!Number.isFinite(v) || v <= 0) return fallback;
  return Math.max(1, Math.floor(v));
}

function questionCountPerSet(skill: Skill): number {
  return skill === "reading" ? 5 : 10;
}

function parseSetSeq(input: string | number | null | undefined): number {
  if (typeof input === "number") return clampPositiveInt(input, 1);

  const s = String(input ?? "").trim();

  // "vocab_2" / "grammar_3" / "reading_1"
  const m = s.match(/_(\d+)$/);
  if (m) return clampPositiveInt(Number(m[1]), 1);

  // 素の "2"
  return clampPositiveInt(Number(s), 1);
}

function normalizeChoices(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return input.map((x) => String(x ?? ""));
}

function isValidChoiceQuestion(row: PracticeChoiceQ | null | undefined): row is PracticeChoiceQ {
  if (!row) return false;
  if (typeof row.id !== "string" || row.id.length === 0) return false;
  if (!isSkill((row as any).skill)) return false;
  if (typeof (row as any).prompt !== "string" || (row as any).prompt.length === 0) return false;

  const lv = (row.levelTag ?? row.level) as unknown;
  if (!isJLPTLevel(lv)) return false;

  const choices = normalizeChoices((row as any).choices);
  if (choices.length < 2) return false;

  const correct = Number((row as any).correct);
  if (!Number.isInteger(correct)) return false;
  if (correct < 0 || correct >= choices.length) return false;

  return true;
}

/**
 * 軽い安定シャッフル（seed固定）
 * - sessionごとに毎回同じ順序にしたい時に使う
 * - Math.random() 依存を避ける
 */
function hashString32(str: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  let t = seed >>> 0;
  return function () {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function seededShuffle<T>(arr: T[], seedKey: string): T[] {
  const out = [...arr];
  const rand = mulberry32(hashString32(seedKey));

  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }

  return out;
}

/**
 * level fallback:
 * 指定levelが不足している場合、同skill内で近い級へフォールバック
 */
const LEVEL_FALLBACK_ORDER: Record<JLPTLevel, JLPTLevel[]> = {
  N5: ["N5", "N4", "N3", "N2", "N1"],
  N4: ["N4", "N5", "N3", "N2", "N1"],
  N3: ["N3", "N4", "N2", "N5", "N1"],
  N2: ["N2", "N3", "N1", "N4", "N5"],
  N1: ["N1", "N2", "N3", "N4", "N5"],
};

export function getPracticeBankBySkill(skill: Skill): PracticeChoiceQ[] {
  const rows = PRACTICE_BANK?.[skill];
  if (!Array.isArray(rows)) return [];
  return rows.filter(isValidChoiceQuestion);
}

export function getPracticeBankBySkillLevel(skill: Skill, level: JLPTLevel): PracticeChoiceQ[] {
  return getPracticeBankBySkill(skill).filter((row) => (row.levelTag ?? row.level) === level);
}

/**
 * 指定skill/levelの候補を、不足時フォールバック込みで必要数以上集める
 */
export function getPracticeCandidates(params: {
  skill: Skill;
  level: JLPTLevel;
  minCount?: number;
}): PracticeChoiceQ[] {
  const skill = params.skill;
  const level = params.level;
  const need = clampPositiveInt(params.minCount, questionCountPerSet(skill));

  if (!isSkill(skill) || !isJLPTLevel(level)) return [];

  const all = getPracticeBankBySkill(skill);
  if (all.length === 0) return [];

  const levels = LEVEL_FALLBACK_ORDER[level] ?? [level];
  const out: PracticeChoiceQ[] = [];
  const seen = new Set<string>();

  for (const lv of levels) {
    const chunk = all.filter((row) => (row.levelTag ?? row.level) === lv);

    for (const item of chunk) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      out.push(item);
    }

    if (out.length >= need) break;
  }

  return out;
}

/**
 * 内部用: 同一配列から count 個を、offset起点で循環取得
 */
function pickCircularSlice<T>(ordered: T[], offset: number, count: number): T[] {
  if (ordered.length === 0 || count <= 0) return [];

  const out: T[] = [];
  for (let i = 0; i < count; i++) {
    const idx = (offset + i) % ordered.length;
    out.push(ordered[idx]);
  }
  return out;
}

/**
 * 内部用: 同一set内で重複を可能な限り避ける
 * - 候補数 < count のときは重複を許容
 */
function dedupeWithinSet<T extends { id: string }>(rows: T[], fullOrderedPool: T[], count: number): T[] {
  if (rows.length === 0) return [];
  if (fullOrderedPool.length < count) {
    // 候補が足りないので重複許容
    return rows.slice(0, count);
  }

  const out: T[] = [];
  const seen = new Set<string>();

  for (const row of rows) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    out.push(row);
    if (out.length >= count) return out;
  }

  for (const row of fullOrderedPool) {
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    out.push(row);
    if (out.length >= count) return out;
  }

  return out.slice(0, count);
}

/**
 * ✅ set単位で安定選出
 *
 * 例:
 * - vocab N5 は 30問ある
 * - set size = 10
 * - vocab_1 / vocab_2 / vocab_3 を seed shuffle 後に切り出す
 */
export function getPracticeSetQuestions(params: {
  skill: Skill;
  level: JLPTLevel;
  set: string | number;  // "vocab_2" or 2
  day?: number | string; // 任意（seed用）
  weekId?: string;       // 任意（seed用）
  count?: number;        // override（通常はskill依存）
}): PracticeChoiceQ[] {
  const skill = params.skill;
  const level = params.level;

  if (!isSkill(skill) || !isJLPTLevel(level)) return [];

  const setSeq = parseSetSeq(params.set);
  const count = clampPositiveInt(params.count, questionCountPerSet(skill));

  // 候補（不足時フォールバック込み）
  // 3set運用を想定して count*3 以上を確保しようとする
  const candidates = getPracticeCandidates({
    skill,
    level,
    minCount: Math.max(count, count * 3),
  });

  if (candidates.length === 0) return [];

  const seedKey = [
    "practice",
    params.weekId ?? "no-week",
    `day:${params.day ?? "?"}`,
    `skill:${skill}`,
    `level:${level}`,
  ].join("|");

  const ordered = seededShuffle(candidates, seedKey);

  // set ごとのスライス（1-indexed）
  const start = (setSeq - 1) * count;
  const raw = pickCircularSlice(ordered, start, count);
  const picked = dedupeWithinSet(raw, ordered, count);

  if (typeof window !== "undefined") {
    // eslint-disable-next-line no-console
    console.log("[practiceBank] getPracticeSetQuestions", {
      skill,
      level,
      set: params.set,
      setSeq,
      count,
      pool: ordered.length,
      picked: picked.length,
      ids: picked.map((r) => r.id),
    });
  }

  return picked;
}

/**
 * ✅ qidベースで問題を引く（roadmap側に questionIds がある時に使える）
 * - 順序は questionIds を優先
 * - 足りない分だけ set選出で補完
 */
export function getPracticeQuestionsByIds(params: {
  skill: Skill;
  level: JLPTLevel;
  questionIds: string[];
  fillIfMissing?: boolean;
  fillSet?: string | number;
  day?: number | string;
  weekId?: string;
  count?: number;
}): PracticeChoiceQ[] {
  const {
    skill,
    level,
    questionIds,
    fillIfMissing = false,
    fillSet = 1,
    day,
    weekId,
    count,
  } = params;

  if (!isSkill(skill) || !isJLPTLevel(level)) return [];

  const desiredCount = clampPositiveInt(count, questionCountPerSet(skill));
  const bank = getPracticeBankBySkill(skill);
  const byId = new Map<string, PracticeChoiceQ>(bank.map((row) => [row.id, row]));

  const out: PracticeChoiceQ[] = [];
  const seen = new Set<string>();

  for (const qidRaw of Array.isArray(questionIds) ? questionIds : []) {
    const qid = String(qidRaw ?? "");
    if (!qid || seen.has(qid)) continue;

    const row = byId.get(qid);
    if (!row) continue;

    // roadmapのquestionIdsを信頼（level違いでも採用）
    seen.add(row.id);
    out.push(row);

    if (out.length >= desiredCount) break;
  }

  if (!fillIfMissing || out.length >= desiredCount) {
    return out.slice(0, desiredCount);
  }

  const fallbackRows = getPracticeSetQuestions({
    skill,
    level,
    set: fillSet,
    day,
    weekId,
    count: desiredCount,
  });

  for (const row of fallbackRows) {
    if (out.length >= desiredCount) break;
    if (seen.has(row.id)) continue;
    seen.add(row.id);
    out.push(row);
  }

  return out.slice(0, desiredCount);
}

/**
 * ✅ session UI用に変換（page.tsx 側でそのまま使える形）
 */
export function buildSessionQuestionsFromPracticeBank(params: {
  skill: Skill;
  level: JLPTLevel;
  set: string | number;
  day?: number | string;
  weekId?: string;
  count?: number;
  questionIds?: string[];      // roadmapで指定済みなら優先利用
  preferQuestionIds?: boolean; // default true
}): PracticeSessionQuestion[] {
  const {
    skill,
    level,
    set,
    day,
    weekId,
    count,
    questionIds = [],
    preferQuestionIds = true,
  } = params;

  if (!isSkill(skill) || !isJLPTLevel(level)) return [];

  const targetCount = clampPositiveInt(count, questionCountPerSet(skill));

  const rows =
    preferQuestionIds && Array.isArray(questionIds) && questionIds.length > 0
      ? getPracticeQuestionsByIds({
          skill,
          level,
          questionIds,
          fillIfMissing: true,
          fillSet: set,
          day,
          weekId,
          count: targetCount,
        })
      : getPracticeSetQuestions({
          skill,
          level,
          set,
          day,
          weekId,
          count: targetCount,
        });

  const sessionRows = rows
    .filter(isValidChoiceQuestion)
    .slice(0, targetCount)
    .map((row) => {
      const normalizedChoices = normalizeChoices((row as any).choices);
      const safeAnswerIndexRaw = Number((row as any).correct ?? 0);
      const safeAnswerIndex =
        Number.isInteger(safeAnswerIndexRaw) &&
        safeAnswerIndexRaw >= 0 &&
        safeAnswerIndexRaw < normalizedChoices.length
          ? safeAnswerIndexRaw
          : 0;

      const rowLevel = (row.levelTag ?? row.level) as JLPTLevel;

      return {
        qid: row.id,
        sourceId: row.id,
        skill: row.skill,
        level: rowLevel,
        prompt: String((row as any).prompt ?? ""),
        choices: normalizedChoices,
        answerIndex: safeAnswerIndex,
        explanation: (row as any).explanation ?? "解説は未登録です。",
      };
    });

  if (typeof window !== "undefined") {
    // eslint-disable-next-line no-console
    console.log("[practiceBank] buildSessionQuestionsFromPracticeBank", {
      skill,
      level,
      set,
      targetCount,
      actualCount: sessionRows.length,
      preferQuestionIds,
      questionIdsCount: Array.isArray(questionIds) ? questionIds.length : 0,
      ids: sessionRows.map((r) => r.qid),
    });
  }

  return sessionRows;
}

/**
 * 互換用 alias（古い import 名に備える）
 * もし別ファイルで旧名/typo を import していても壊れにくくする
 */
export const buildSessionQuestionsFromPracticeBankCompat = buildSessionQuestionsFromPracticeBank;
export const buildSessionQuestionFromPracticeBank = buildSessionQuestionsFromPracticeBank; // s抜け互換