// app/_lib/diagnosticPhase1.ts

export type JLPTLevel = "N5" | "N4" | "N3" | "N2" | "N1";

export type Phase1Question = {
  id: string;
  level: JLPTLevel;
  skill: "vocab" | "grammar" | "reading";
  prompt: string;
  choices: [string, string, string, string];
  correctIndex: 0 | 1 | 2 | 3;
};

export const DIAG_PHASE1_KEY = "lexio.diag.phase1.v1";

export type Phase1Result = {
  version: 1;
  finishedAtISO: string;
  // per question
  answers: Record<
    string,
    {
      pickedIndex: 0 | 1 | 2 | 3;
      correct: boolean;
      level: JLPTLevel;
      skill: "vocab" | "grammar" | "reading";
    }
  >;
  // per level
  byLevel: Record<
    JLPTLevel,
    {
      correct: number;
      total: number; // always 3
      cleared: boolean; // correct >= 2
    }
  >;
  estimatedLevel: JLPTLevel;
};

export const PHASE1_QUESTIONS: Phase1Question[] = [
  // 🟢 N5
  {
    id: "p1-n5-1",
    level: "N5",
    skill: "vocab",
    prompt: "「ねこ」のいみは？",
    choices: ["cat", "dog", "bird", "fish"],
    correctIndex: 0,
  },
  {
    id: "p1-n5-2",
    level: "N5",
    skill: "grammar",
    prompt: "わたしは学生（　）。",
    choices: ["です", "ます", "でした", "ません"],
    correctIndex: 0,
  },
  {
    id: "p1-n5-3",
    level: "N5",
    skill: "reading",
    prompt:
      "「きょうは雨です。わたしは家にいます。」\n\nわたしは きょう、どこにいますか。",
    choices: ["学校", "家", "駅", "店"],
    correctIndex: 1,
  },

  // 🔵 N4
  {
    id: "p1-n4-1",
    level: "N4",
    skill: "vocab",
    prompt: "「しゅくだい」の意味はどれ？",
    choices: ["homework", "holiday", "hospital", "hobby"],
    correctIndex: 0,
  },
  {
    id: "p1-n4-2",
    level: "N4",
    skill: "grammar",
    prompt: "あした、雨が（　）かもしれない。",
    choices: ["ふる", "ふった", "ふります", "ふらない"],
    correctIndex: 0,
  },
  {
    id: "p1-n4-3",
    level: "N4",
    skill: "reading",
    prompt: "「この店は10時に開いて、8時に閉まります。」\n\nこの店は何時に閉まりますか。",
    choices: ["8時", "10時", "18時", "20時"],
    correctIndex: 3,
  },

  // 🟡 N3
  {
    id: "p1-n3-1",
    level: "N3",
    skill: "vocab",
    prompt: "「たしかに」の使い方として正しいものはどれ？",
    choices: [
      "たしかに、彼は来ないでしょう。",
      "たしかに、ここは静かですね。",
      "たしかに、今から帰ったほうがいいよ。",
      "たしかに、彼は昨日来ます。",
    ],
    correctIndex: 1,
  },
  {
    id: "p1-n3-2",
    level: "N3",
    skill: "grammar",
    prompt: "雨が降ろう（　）降るまい（　）、試合は行われます。",
    choices: ["と / と", "が / が", "に / に", "も / も"],
    correctIndex: 0,
  },
  {
    id: "p1-n3-3",
    level: "N3",
    skill: "reading",
    prompt: "「この薬は食後に飲んでください。」\n\nこの薬はいつ飲みますか。",
    choices: ["食前", "食後", "空腹時", "朝だけ"],
    correctIndex: 1,
  },

  // 🟠 N2
  {
    id: "p1-n2-1",
    level: "N2",
    skill: "vocab",
    prompt: "「見落とす」の意味はどれ？",
    choices: ["気づかずに通り過ぎる", "よく見て確認する", "わざと無視する", "見てから忘れる"],
    correctIndex: 0,
  },
  {
    id: "p1-n2-2",
    level: "N2",
    skill: "grammar",
    prompt: "彼は忙しい（　）、会議に出席した。",
    choices: ["にもかかわらず", "おかげで", "せいで", "ために"],
    correctIndex: 0,
  },
  {
    id: "p1-n2-3",
    level: "N2",
    skill: "reading",
    prompt:
      "筆者は何を言いたいか。\n\n「道具そのものが悪いのではなく、使い方が大切だ。」",
    choices: ["道具は使うべきではない", "道具は危険だ", "道具は使い方次第で役立つ", "道具が増えるほど悪い"],
    correctIndex: 2,
  },

  // 🔴 N1
  {
    id: "p1-n1-1",
    level: "N1",
    skill: "vocab",
    prompt: "「杞憂」の意味はどれ？",
    choices: ["必要のない心配", "予想どおりに進むこと", "強い怒りを抑えること", "物事の本質を見失うこと"],
    correctIndex: 0,
  },
  {
    id: "p1-n1-2",
    level: "N1",
    skill: "grammar",
    prompt: "彼は毎日練習した（　）優勝できたのだ。",
    choices: ["からこそ", "からには", "ところで", "にしても"],
    correctIndex: 0,
  },
  {
    id: "p1-n1-3",
    level: "N1",
    skill: "reading",
    prompt: "「制度は改善されたとはいえ、依然として課題は山積している。」\n\n筆者の立場はどれ？",
    choices: ["制度は完璧だ", "制度は改善されたが問題は残っている", "制度は悪化している", "制度は変わっていない"],
    correctIndex: 1,
  },
];

export const LEVELS_ASC: JLPTLevel[] = ["N5", "N4", "N3", "N2", "N1"];

export function computePhase1Result(
  answers: Record<string, 0 | 1 | 2 | 3>
): Phase1Result {
  const byLevel: Phase1Result["byLevel"] = {
    N5: { correct: 0, total: 3, cleared: false },
    N4: { correct: 0, total: 3, cleared: false },
    N3: { correct: 0, total: 3, cleared: false },
    N2: { correct: 0, total: 3, cleared: false },
    N1: { correct: 0, total: 3, cleared: false },
  };

  const detail: Phase1Result["answers"] = {};

  for (const q of PHASE1_QUESTIONS) {
    const picked = answers[q.id];
    const pickedIndex: 0 | 1 | 2 | 3 = (picked ?? 0) as any;
    const correct = pickedIndex === q.correctIndex;

    detail[q.id] = {
      pickedIndex,
      correct,
      level: q.level,
      skill: q.skill,
    };
    if (correct) byLevel[q.level].correct += 1;
  }

  for (const lv of LEVELS_ASC) {
    byLevel[lv].cleared = byLevel[lv].correct >= 2; // 2/3 rule
  }

  // estimatedLevel = "2/3クリアした最高レベル"
  let estimated: JLPTLevel = "N5";
  for (const lv of LEVELS_ASC) {
    if (byLevel[lv].cleared) estimated = lv;
  }

  return {
    version: 1,
    finishedAtISO: new Date().toISOString(),
    answers: detail,
    byLevel,
    estimatedLevel: estimated,
  };
}