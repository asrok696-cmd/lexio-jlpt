// app/_lib/diagnosticBank.ts

export type JLPTLevel = "N5" | "N4" | "N3" | "N2" | "N1";
export type Skill = "vocab" | "grammar" | "reading";

export type Question = {
  id: string;
  level: JLPTLevel;
  phase: "phase2";
  skill: Skill;
  prompt: string;
  choices: string[];
  correct: number; // 0-based index
};

export const DIAGNOSTIC_BANK: Question[] = [
  // =========================================================
  // N5 Phase2（弱点特定）9問 修正版（N5想定）
  // =========================================================

  {
    id: "n5_p2_01",
    level: "N5",
    phase: "phase2",
    skill: "vocab",
    prompt: "きのうは とても（　）。",
    choices: ["あつい", "あつかった", "あつく", "あつさ"],
    correct: 1,
  },
  {
    id: "n5_p2_02",
    level: "N5",
    phase: "phase2",
    skill: "vocab",
    prompt: "「駅」の読み方はどれ？",
    choices: ["えき", "いき", "えぎ", "いぎ"],
    correct: 0,
  },
  {
    id: "n5_p2_03",
    level: "N5",
    phase: "phase2",
    skill: "vocab",
    prompt: "「高い」の読み方はどれ？",
    choices: ["たかい", "たがい", "こうい", "たこう"],
    correct: 0,
  },
  {
    id: "n5_p2_04",
    level: "N5",
    phase: "phase2",
    skill: "grammar",
    prompt: "私は毎日7時（　）起きます。",
    choices: ["で", "に", "を", "へ"],
    correct: 1,
  },
  {
    id: "n5_p2_05",
    level: "N5",
    phase: "phase2",
    skill: "grammar",
    prompt: "これは先生（　）本です。",
    choices: ["が", "に", "の", "を"],
    correct: 2,
  },
  {
    id: "n5_p2_06",
    level: "N5",
    phase: "phase2",
    skill: "grammar",
    prompt: "雨が降っている（　）、出かけません。",
    choices: ["ので", "のに", "けれど", "まで"],
    correct: 0,
  },
  {
    id: "n5_p2_07",
    level: "N5",
    phase: "phase2",
    skill: "reading",
    prompt: `山田さんは朝七時に家を出ました。
会社まではバスで三十分かかります。
今日は道がすいていたので、二十分で着きました。

今日は何分で会社に着きましたか。`,
    choices: ["七分", "二十分", "三十分", "十分"],
    correct: 1,
  },
  {
    id: "n5_p2_08",
    level: "N5",
    phase: "phase2",
    skill: "reading",
    prompt: `山田さんは毎日バスで会社へ行きますが、今日は電車で行きました。

今日は何で行きましたか。`,
    choices: ["バス", "電車", "車", "自転車"],
    correct: 1,
  },
  {
    id: "n5_p2_09",
    level: "N5",
    phase: "phase2",
    skill: "reading",
    prompt: `田中さんは本を二冊買いました。
そのあと、もう一冊買いました。

田中さんは全部で何冊本を買いましたか。`,
    choices: ["二冊", "三冊", "四冊", "五冊"],
    correct: 1,
  },

  // =========================================================
  // 【N4 レベル】（基礎・日常会話）9問
  // =========================================================

  {
    id: "n4_p2_01",
    level: "N4",
    phase: "phase2",
    skill: "vocab",
    prompt: "「夕方」の読み方はどれ？",
    choices: ["ゆうかた", "ゆうがた", "ゆかた", "ゆがた"],
    correct: 1,
  },
  {
    id: "n4_p2_02",
    level: "N4",
    phase: "phase2",
    skill: "vocab",
    prompt: "弟は部屋を（　）しました。",
    choices: ["そうじ", "すいじ", "しょくじ", "かじ"],
    correct: 0,
  },
  {
    id: "n4_p2_03",
    level: "N4",
    phase: "phase2",
    skill: "vocab",
    prompt: "冷蔵庫の中に肉と野菜が（　）あります。",
    choices: ["いれて", "はいって", "おいて", "並べて"],
    correct: 1,
  },
  {
    id: "n4_p2_04",
    level: "N4",
    phase: "phase2",
    skill: "grammar",
    prompt: "私は来年、日本へ（　）つもりです。",
    choices: ["行く", "行った", "行って", "行こう"],
    correct: 0,
  },
  {
    id: "n4_p2_05",
    level: "N4",
    phase: "phase2",
    skill: "grammar",
    prompt: "宿題を忘れたので、先生に（　）しまいました。",
    choices: ["しかられて", "しかって", "しからせて", "しかり"],
    correct: 0,
  },
  {
    id: "n4_p2_06",
    level: "N4",
    phase: "phase2",
    skill: "grammar",
    prompt: "この漢字の読み方を（　）ください。",
    choices: ["教えて", "教わって", "教えていて", "教わらないで"],
    correct: 0,
  },
  {
    id: "n4_p2_07",
    level: "N4",
    phase: "phase2",
    skill: "reading",
    prompt: `「佐藤さん、明日の会議は午後2時からですよ。3時じゃありませんから、間違えないでくださいね。」
「あ、わかりました。ありがとうございます。」

明日の会議は何時からですか。`,
    choices: ["午後2時", "午後3時", "午前2時", "午前3時"],
    correct: 0,
  },
  {
    id: "n4_p2_08",
    level: "N4",
    phase: "phase2",
    skill: "reading",
    prompt: `私は昨日、デパートで赤い靴を買いました。でも、家に帰ってから履いてみたら、少し小さかったです。明日、店に行ってサイズを替えてもらいます。

私は明日、何をしますか。`,
    choices: ["赤い靴を買う", "靴のサイズを替える", "家で靴を履く", "デパートへ行かない"],
    correct: 1,
  },
  {
    id: "n4_p2_09",
    level: "N4",
    phase: "phase2",
    skill: "reading",
    prompt: `Ａ「駅までバスで行きましょうか。」
Ｂ「バスは時間がかかりますよ。タクシーのほうが早いです。」
Ａ「そうですね。じゃあ、そうしましょう。」

二人は何で行きますか。`,
    choices: ["バス", "タクシー", "電車", "歩いて"],
    correct: 1,
  },

  // =========================================================
  // 【N3 レベル】（日常・ややフォーマル）9問
  // =========================================================

  {
    id: "n3_p2_01",
    level: "N3",
    phase: "phase2",
    skill: "vocab",
    prompt: "パソコンの調子が悪いので、（　）してもらった。",
    choices: ["修正", "修理", "治療", "改正"],
    correct: 1,
  },
  {
    id: "n3_p2_02",
    level: "N3",
    phase: "phase2",
    skill: "vocab",
    prompt: "彼はとても（　）性格で、みんなに好かれている。",
    choices: ["積極的な", "具体的な", "基本的な", "能動的な"],
    correct: 0,
  },
  {
    id: "n3_p2_03",
    level: "N3",
    phase: "phase2",
    skill: "vocab",
    prompt: "会議の資料を（　）しておいてください。",
    choices: ["用意", "利用", "活用", "信用"],
    correct: 0,
  },
  {
    id: "n3_p2_04",
    level: "N3",
    phase: "phase2",
    skill: "grammar",
    prompt: "運動不足なので、毎日少しでも歩く（　）。",
    choices: ["ことだ", "ことになる", "ことにしている", "ことになっている"],
    correct: 2,
  },
  {
    id: "n3_p2_05",
    level: "N3",
    phase: "phase2",
    skill: "grammar",
    prompt: "社長の命令とあれば、やりたくない仕事でも引き受けない（　）。",
    choices: ["わけにはいかない", "わけもいない", "わけではない", "わけがない"],
    correct: 0,
  },
  {
    id: "n3_p2_06",
    level: "N3",
    phase: "phase2",
    skill: "grammar",
    prompt: "もっと早く家を（　）、電車に間に合ったのに。",
    choices: ["出るなら", "出たら", "出ていれば", "出ると"],
    correct: 2,
  },
  {
    id: "n3_p2_07",
    level: "N3",
    phase: "phase2",
    skill: "reading",
    prompt: `この店は、ランチタイムは禁煙だが、夜はお酒を出すので喫煙が可能になる。しかし、最近はお客さんから「夜も禁煙にしてほしい」という声が増えているらしい。

この店について正しいものはどれですか。`,
    choices: ["昼も夜もタバコが吸える。", "昼も夜もタバコが吸えない。", "昼は吸えないが、夜は吸える。", "昼は吸えるが、夜は吸えない。"],
    correct: 2,
  },
  {
    id: "n3_p2_08",
    level: "N3",
    phase: "phase2",
    skill: "reading",
    prompt: `（メール）
件名：明日の待ち合わせ
田中さん、お疲れ様です。
明日の待ち合わせ場所ですが、駅前のカフェが工事中だったので、西口の公園に変更してもいいですか。時間はそのまま10時でお願いします。
山下

明日の待ち合わせ場所はどこですか。`,
    choices: ["駅前のカフェ", "西口の公園", "駅の改札", "工事現場"],
    correct: 1,
  },
  {
    id: "n3_p2_09",
    level: "N3",
    phase: "phase2",
    skill: "reading",
    prompt: `人間は失敗する生き物だ。失敗した時に「なぜ失敗したのか」を深く考える人と、「運が悪かった」で済ませる人とでは、その後の成長に大きな差が出る。

筆者はどうするべきだと言っていますか。`,
    choices: ["失敗しないように気をつけるべきだ。", "失敗したら運が悪かったと考えるべきだ。", "失敗の原因を深く考えるべきだ。", "失敗しても気にしないほうがいい。"],
    correct: 2,
  },

  // =========================================================
  // 【N2 レベル】（ビジネス・一般）9問
  // =========================================================

  {
    id: "n2_p2_01",
    level: "N2",
    phase: "phase2",
    skill: "vocab",
    prompt: "新しいプロジェクトのリーダーを（　）された。",
    choices: ["任命", "運命", "革命", "使命"],
    correct: 0,
  },
  {
    id: "n2_p2_02",
    level: "N2",
    phase: "phase2",
    skill: "vocab",
    prompt: "契約の内容をよく（　）してからサインしてください。",
    choices: ["確認", "確立", "確信", "確定"],
    correct: 0,
  },
  {
    id: "n2_p2_03",
    level: "N2",
    phase: "phase2",
    skill: "vocab",
    prompt: "両国の関係は、急速に（　）している。",
    choices: ["悪化", "消化", "変化", "美化"],
    correct: 0,
  },
  {
    id: "n2_p2_04",
    level: "N2",
    phase: "phase2",
    skill: "grammar",
    prompt: "この仕事は、君の協力（　）成功しなかっただろう。",
    choices: ["をぬきにしては", "をめぐって", "にもかかわらず", "にとって"],
    correct: 0,
  },
  {
    id: "n2_p2_05",
    level: "N2",
    phase: "phase2",
    skill: "grammar",
    prompt: "忙しい（　）、手抜きをすることは許されない。",
    choices: ["からといって", "としたら", "あげく", "ついでに"],
    correct: 0,
  },
  {
    id: "n2_p2_06",
    level: "N2",
    phase: "phase2",
    skill: "grammar",
    prompt: "あのレストランは味がいい（　）、値段も安い。",
    choices: ["反面", "ものの", "うえに", "くせに"],
    correct: 2,
  },
  {
    id: "n2_p2_07",
    level: "N2",
    phase: "phase2",
    skill: "reading",
    prompt: `現代社会では「効率」が重視されがちだ。しかし、無駄だと思える時間の中にこそ、新しいアイデアの種が隠されていることがある。常に忙しく動き回っているだけでは、その種を見つけることは難しいだろう。

筆者が言いたいことは何ですか。`,
    choices: ["効率を最優先にして働くべきだ。", "無駄な時間はできるだけ減らすべきだ。", "一見無駄な時間も大切にするべきだ。", "アイデアを出すために忙しくするべきだ。"],
    correct: 2,
  },
  {
    id: "n2_p2_08",
    level: "N2",
    phase: "phase2",
    skill: "reading",
    prompt: `（社内通知）
来週月曜日の午前9時から12時まで、電気設備の点検のため全館停電となります。その間、エレベーターやパソコンは使用できません。重要なデータは必ず金曜日中に保存してください。

社員は何をしなければなりませんか。`,
    choices: ["月曜日の朝にデータを保存する。", "月曜日はパソコンを使わないようにする。", "金曜日のうちにデータを保存しておく。", "エレベーターを使って移動する。"],
    correct: 2,
  },
  {
    id: "n2_p2_09",
    level: "N2",
    phase: "phase2",
    skill: "reading",
    prompt: `Ａ社の製品は性能は良いがデザインが古い。一方、Ｂ社の製品はデザインは洗練されているが、壊れやすいという欠点がある。消費者はどちらを重視するかによって選ぶ商品が変わるだろう。

Ｂ社の製品の特徴は何ですか。`,
    choices: ["性能が良く、デザインも良い。", "デザインは良いが、壊れやすい。", "性能は良いが、デザインが古い。", "デザインが悪く、壊れやすい。"],
    correct: 1,
  },

  // =========================================================
  // 【N1 レベル】（高度・抽象的）9問
  // =========================================================

  {
    id: "n1_p2_01",
    level: "N1",
    phase: "phase2",
    skill: "vocab",
    prompt: "彼は自らの非を認め、潔く（　）した。",
    choices: ["辞任", "辞退", "辞職", "没収"],
    correct: 0,
  },
  {
    id: "n1_p2_02",
    level: "N1",
    phase: "phase2",
    skill: "vocab",
    prompt: "長年の交渉がようやく（　）した。",
    choices: ["妥結", "団結", "連結", "直結"],
    correct: 0,
  },
  {
    id: "n1_p2_03",
    level: "N1",
    phase: "phase2",
    skill: "vocab",
    prompt: "彼女の態度は、あまりにも（　）だ。",
    choices: ["露骨", "露呈", "暴露", "披露"],
    correct: 0,
  },
  {
    id: "n1_p2_04",
    level: "N1",
    phase: "phase2",
    skill: "grammar",
    prompt: "彼が犯人だなんて、あの真面目な性格（　）信じられない。",
    choices: ["からすると", "からして", "からといって", "からある"],
    correct: 0,
  },
  {
    id: "n1_p2_05",
    level: "N1",
    phase: "phase2",
    skill: "grammar",
    prompt: "いかなる理由が（　）、暴力は許されない。",
    choices: ["あろうとも", "あるまじき", "あっての", "あればこそ"],
    correct: 0,
  },
  {
    id: "n1_p2_06",
    level: "N1",
    phase: "phase2",
    skill: "grammar",
    prompt: "プロの料理人（　）、味への妥協は許されない。",
    choices: ["たるもの", "ともなると", "なりに", "まじき"],
    correct: 0,
  },
  {
    id: "n1_p2_07",
    level: "N1",
    phase: "phase2",
    skill: "reading",
    prompt: `歴史を学ぶ意義は、過去の出来事を暗記することではない。過去の人々がどのような状況でどう判断し、どのような結果を招いたのか、その因果関係を考察し、現代や未来の課題解決への指針とすることにある。

筆者が考える歴史を学ぶ意義とは何ですか。`,
    choices: ["過去の出来事を正確に記憶すること。", "過去の失敗を批判すること。", "過去の事例から未来への教訓を得ること。", "歴史上の人物の感情を理解すること。"],
    correct: 2,
  },
  {
    id: "n1_p2_08",
    level: "N1",
    phase: "phase2",
    skill: "reading",
    prompt: `科学技術の進歩は我々の生活を豊かにしたが、同時に環境破壊や倫理的な問題も引き起こした。技術そのものは中立であり、善にも悪にもなり得る。重要なのは、それを扱う人間がどのような「哲学」を持っているかである。

科学技術について、筆者はどう述べていますか。`,
    choices: ["技術の進歩は常に良い結果をもたらす。", "技術自体に善悪はなく、使う人間次第である。", "環境破壊を防ぐために技術開発を止めるべきだ。", "人間は技術に支配されつつある。"],
    correct: 1,
  },
  {
    id: "n1_p2_09",
    level: "N1",
    phase: "phase2",
    skill: "reading",
    prompt: `「言葉」は思考の道具であると同時に、思考を枠組む檻（おり）でもある。我々は知っている言葉の範囲でしか物事を認識できないことが多い。だからこそ、新しい概念や言葉を学ぶことは、自らの世界を拡張することに他ならない。

「思考を枠組む檻」とはどういう意味ですか。`,
    choices: ["言葉を知らないと思考が自由に広まらないという制限。", "言葉を使うことで思考が整理されるという利点。", "悪い言葉を使うと性格が悪くなるという警告。", "言葉を学びすぎると頭が固くなるという欠点。"],
    correct: 0,
  },
];