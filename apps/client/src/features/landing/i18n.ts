import type { LandingLang } from './types';

type LandingDict = Record<string, string>;

const ja: LandingDict = {
  'nav.concept': 'コンセプト',
  'nav.process': '発酵の三段',
  'nav.preview': 'アプリ',
  'nav.philosophy': '思想',
  'nav.faq': 'FAQ',
  'nav.cta': 'アプリを試す',

  'hero.eyebrow': 'AN ASPERGILLUS FOR WORDS.',
  'hero.title.l1': '書くことを、',
  'hero.title.l2': '発酵させる。',
  'hero.lead':
    'Oryzaeは、日々の言葉を醸成し、あなたの問いを深める執筆の場です。コウジカビが澱粉を糖に変えるように、書かれた文章を分解し、問いの核となる切片と、ひと通の手紙を返します。',
  'hero.cta.primary': 'アプリを試す',
  'hero.cta.secondary': 'コンセプトを読む',
  'hero.foot': '縦書き・横書きいずれにも対応。日本語と英語で書き、考える人のための場。',
  'hero.chip.1': '死者の自律性',
  'hero.chip.2': '発酵的時間',
  'hero.chip.3': '媒介者',
  'hero.chip.4': '忘却の倫理',
  'hero.snippet.1': '「ぬか床が徐々に人の影響を吸収するように、AIもまた変化していく…」',
  'hero.question': '現在の問い',

  'concept.kicker': 'CONCEPT',
  'concept.title': '問いを、書きながら醸成する。',
  'concept.lead':
    'Oryzaeは「問い」を中心に据えた執筆アプリです。あなたが今いちばん考えたい問いをひとつ立て、その問いに沿って一週間日記を書く。週末、コウジカビ・乳酸菌・酵母の三段階を経てAIが文章を分解し、ふたたびあなたへ手渡します。要約ではなく、思考を進めるためのささやかなインスピレーションとして。',
  'concept.p1.title': '問いを立てる',
  'concept.p1.body': 'いま気になっていることを一文の問いとして書き留める。これが発酵の中核となる。',
  'concept.p2.title': '日々書く',
  'concept.p2.body':
    '縦書きの白い紙に、思いついたことをそのまま綴る。誤字も、寄り道も、書いた跡として残る。',
  'concept.p3.title': '手紙が届く',
  'concept.p3.body':
    '週ごとに、あなた自身の言葉から醸成された手紙とキーワードが返ってくる。読むのは、また書きはじめるため。',

  'process.kicker': 'THREE MICROBES',
  'process.title.l1': 'コウジカビ・乳酸菌・酵母',
  'process.title.l2': '— 発酵の三段',
  'process.lead':
    'Oryzaeの内部では、糠床のような三つの微生物がそれぞれ別の役割を担い、あなたの一週間の言葉を醸成する。',
  'process.koji.role': '分解 — Decomposition',
  'process.koji.body':
    '一週間ぶんの日記を、立てた問いに照らして読み解く。修正版グラウンデッド・セオリー・アプローチを参照しながら、原文から問いの核に触れる切片を抽出する。',
  'process.koji.output': '出力：分析ワークシート、結果図、問いを照らす切片',
  'process.lactic.role': '手紙 — A letter',
  'process.lactic.body':
    '切片とワークシートを参照して、問いをめぐる思考の変化を整理する。要約ではなく、書き手の語彙からあえてずらした言葉で、500字ほどの詩的なコメントが綴られる。',
  'process.lactic.output': '出力：500字の手紙',
  'process.yeast.role': 'キーワード — Widening',
  'process.yeast.body':
    '問いに囚われすぎないよう、視点を少し引いた角度から差し出すための語が3〜5つ生成される。「死者の自律性」「生者による死者の活性」のような短いフレーズが、想像の余白を広げる。',
  'process.yeast.output': '出力：3〜5のキーワード',

  'preview.kicker': 'THE APP',
  'preview.title': '三つの場所で書く。',
  'preview.lead':
    'Oryzaeのアプリは、書く・眺める・受け取るを別々の場所として用意している。日々の手は「Editor」へ。一週間ごとの俯瞰は「Jar」へ。',
  'preview.editor.title': 'タイトルを追加',
  'preview.editor.prompt': '今日は何を感じましたか？',
  'preview.editor.status': '編集中',
  'preview.editor.caption': 'Editor — 縦書きの白い紙、日本語IMEに最適化された静かな執筆面。',
  'preview.jar.chip.1': '却像的距離感',
  'preview.jar.chip.2': '認知的聖域',
  'preview.jar.chip.3': '霊的代行者',
  'preview.jar.chip.4': '与格的関係',
  'preview.jar.label': '現在の問い · 自然環境を身に宿すためのデザインとは？',
  'preview.jar.caption': 'Jar — 一週間の言葉が問いを軸に星座となって浮かび上がる眺め。',
  'preview.letter.from': '— Oryzae より、第18週の手紙',
  'preview.letter.body':
    'あなたは「死者と生者はどのように共生し続けられるのか」という問いの周りを、一週間ゆっくりと歩いていた。夢のなかで現れたYは、しゅるしゅると胎児にまで縮みながら去ったという。それは喪失の場面であると同時に、起源への回帰であり、円環としての生死観をかすかに照らしている。書き手はこの一週間、分析ではない仕方で大切な存在に向き合うことの必要に気づきはじめている。忘却もまた、共生のひとつのかたちかもしれない、と。',
  'preview.letter.caption':
    'Letter — 週ごとに届く、500字の手紙。要約ではなく、書き続けるためのちいさな種火。',

  'philosophy.kicker': 'PHILOSOPHY',
  'philosophy.title': '道具は、卒業されるためにある。',
  'philo.1.title': '身体性の回復',
  'philo.1.body':
    '縦書きと余白、明朝体。デジタルの整理整頓よりも、たしかに自分が書いたという手の感覚を優先する。',
  'philo.2.title': '即時性の排除',
  'philo.2.body':
    'AIの返答はあえて遅らせる。週に一度、手紙のように届くことで、やりとりは情報処理から関係性に変わる。',
  'philo.3.title': '発酵的時間',
  'philo.3.body':
    '即答ではなく、醸成。ぬか床が家ごとに固有の味になるように、思考もまた書き手の時間と微生物叢を吸って熟していく。',
  'philo.4.title': '卒業できるテクノロジー',
  'philo.4.body':
    '最終的にはツールに依存せず、自律的に自己と対話できるようになることを支援する。Oryzaeはそのための補助輪。',
  'philo.lineage.label': '系譜',
  'philo.lineage.body':
    'Oryzaeは、ジャーナリングを通じた自己対話のためのアプリ「Pickles」(2020–) の知見を引き継いでいます。研究の文脈は ephemere.io をご覧ください。',

  'faq.kicker': 'QUESTIONS',
  'faq.title': 'よくある問い',
  'faq.1.q': 'Picklesとの違いは？',
  'faq.1.a':
    'Picklesは日記そのものを書く場でした。Oryzaeは「問い」を中心に据え、書かれた言葉を発酵プロセスにかけて返すという、書く前後の時間まで含めて設計し直したものです。',
  'faq.2.q': '縦書きは必須ですか？',
  'faq.2.a':
    'いいえ。縦書きをデフォルトとしていますが、ワンクリックで横書きに切り替えられます。フォントも明朝とゴシックを選べます。',
  'faq.3.q': 'AIは何を読みますか？',
  'faq.3.a':
    'あなたが立てた「問い」と、その週に書いたエントリーのみです。問いに紐づけなかったエントリーは発酵に含まれません。',
  'faq.4.q': '日本語以外でも書けますか？',
  'faq.4.a':
    '英語をはじめとする多言語に対応しています。縦書きは日本語・中国語に最適化されています。',
  'faq.5.q': 'いまどの段階ですか？',
  'faq.5.a':
    'Oryzaeはリサーチ・プレビュー段階のプロジェクトです。仕様や挙動は研究の進行に伴って変化します。',

  'outro.l1': '問いはひとつあれば、',
  'outro.l2': '一週間が変わる。',
  'outro.cta': 'Oryzaeを開く',

  'foot.tag': 'Aspergillus oryzae for words.',
};

const en: LandingDict = {
  'nav.concept': 'Concept',
  'nav.process': 'Three microbes',
  'nav.preview': 'The app',
  'nav.philosophy': 'Philosophy',
  'nav.faq': 'FAQ',
  'nav.cta': 'Open the app',

  'hero.eyebrow': 'AN ASPERGILLUS FOR WORDS.',
  'hero.title.l1': 'Let your writing',
  'hero.title.l2': 'ferment.',
  'hero.lead':
    'Oryzae is a writing app inspired by koji mold — Aspergillus oryzae. Set a question that matters to you, write into it for a week, and the system decomposes your text, surfaces a few essential snippets, and returns a single short letter. Slow self-dialogue, made on purpose.',
  'hero.cta.primary': 'Open the app',
  'hero.cta.secondary': 'Read the concept',
  'hero.foot': 'Vertical or horizontal writing, in Japanese, English, and beyond.',
  'hero.chip.1': 'autonomy of the dead',
  'hero.chip.2': 'fermentative time',
  'hero.chip.3': 'the mediator',
  'hero.chip.4': 'an ethics of forgetting',
  'hero.snippet.1':
    '"As a nukadoko slowly absorbs the household it lives in, an AI may also change its character…"',
  'hero.question': 'YOUR QUESTION',

  'concept.kicker': 'CONCEPT',
  'concept.title': 'Brew your question while you write.',
  'concept.lead':
    "Oryzae is a writing app organised around a single question. Choose a question that won't leave you alone, and write into it for a week. At week's end, three microbes — koji, lactic, yeast — work in turn: the system decomposes your entries, returns a few essential snippets, a short letter, and a handful of keywords. Not a summary, but a small spark to keep you writing.",
  'concept.p1.title': 'Set a question',
  'concept.p1.body':
    'Capture, in one sentence, the question that matters most right now. Everything else ferments around it.',
  'concept.p2.title': 'Write daily',
  'concept.p2.body':
    'On a quiet vertical page, write whatever comes — typos, detours and all. The trace of your hand stays.',
  'concept.p3.title': 'A letter arrives',
  'concept.p3.body':
    'Each week, a short letter and a few keywords distilled from your own words come back. Read them, then begin again.',

  'process.kicker': 'THREE MICROBES',
  'process.title.l1': 'Koji · Lactic · Yeast',
  'process.title.l2': '— three stages of fermentation',
  'process.lead':
    'Inside Oryzae, three microbes — like the inhabitants of a nukadoko — each take a different role, and together brew a week of your words.',
  'process.koji.role': 'Decomposition — 分解',
  'process.koji.body':
    "Reads a week of entries through the lens of your question. Drawing on the Modified Grounded Theory Approach, it extracts the snippets that touch the core of what you've been asking.",
  'process.koji.output':
    'Output: an analysis worksheet, a result diagram, snippets that illuminate the question.',
  'process.lactic.role': 'A letter — 手紙',
  'process.lactic.body':
    'Working from the worksheet and the snippets, this stage traces how your thinking has moved this week — not as a summary, but as a roughly 500-character poetic note in vocabulary deliberately offset from your own.',
  'process.lactic.output': 'Output: a single 500-character letter.',
  'process.yeast.role': 'Widening — キーワード',
  'process.yeast.body':
    'Three to five short phrases — "the autonomy of the dead", "the dead activated by the living" — that step a little back from your question and widen the imaginative space around it.',
  'process.yeast.output': 'Output: 3–5 keywords.',

  'preview.kicker': 'THE APP',
  'preview.title': 'Three places to write.',
  'preview.lead':
    'Oryzae separates the writing, the looking, and the receiving. Daily hands belong to the Editor. The weekly view belongs to the Jar.',
  'preview.editor.title': 'Add a title',
  'preview.editor.prompt': 'What did you feel today?',
  'preview.editor.status': 'editing',
  'preview.editor.caption':
    'Editor — a quiet vertical page, tuned for Japanese IME, generous with whitespace.',
  'preview.jar.chip.1': 'reflective distance',
  'preview.jar.chip.2': 'cognitive sanctuary',
  'preview.jar.chip.3': 'a spiritual proxy',
  'preview.jar.chip.4': 'dative relations',
  'preview.jar.label': 'YOUR QUESTION · What is a design that lets nature inhabit the body?',
  'preview.jar.caption': "Jar — a week's words drawn into a constellation around your question.",
  'preview.letter.from': '— from Oryzae · Letter, week 18',
  'preview.letter.body':
    'You have walked, this week, around the question of how the dead and the living might continue to live together. In a dream, the figure of Y arrives in ordinary clothes, then shrinks — quietly — back into the shape of a foetus and disappears. It is loss, and it is also a return to origin, a faint outline of a circular view of life and death. Across the week you begin to notice that an analytical posture may not be the right one toward what matters most. Forgetting, perhaps, is one form of living-with.',
  'preview.letter.caption':
    'Letter — a 500-character letter, weekly. Not a summary; a small ember to keep you writing.',

  'philosophy.kicker': 'PHILOSOPHY',
  'philosophy.title': 'A tool worth outgrowing.',
  'philo.1.title': 'Embodied writing',
  'philo.1.body':
    "Vertical lines, generous margins, a serif. The point isn't to file information cleanly — it's to feel that you, in fact, wrote this.",
  'philo.2.title': 'Without immediacy',
  'philo.2.body':
    'AI replies are deliberately delayed — once a week, like a letter. The exchange shifts from information processing to a quiet kind of relationship.',
  'philo.3.title': 'Fermentative time',
  'philo.3.body':
    'Not an answer, a brewing. As a nukadoko takes on the flavour of the household it lives in, your thinking absorbs your own time and microbiome and slowly ripens.',
  'philo.4.title': 'Tech you can outgrow',
  'philo.4.body':
    'The point is not dependence. Oryzae is meant to support, then quietly fall away as your own self-dialogue gets stronger.',
  'philo.lineage.label': 'LINEAGE',
  'philo.lineage.body':
    'Oryzae carries forward what we learned from Pickles (2020–), a journaling tool for self-dialogue. The wider research context lives at ephemere.io.',

  'faq.kicker': 'QUESTIONS',
  'faq.title': 'Frequent questions',
  'faq.1.q': 'How is this different from Pickles?',
  'faq.1.a':
    'Pickles was a place to write the journal itself. Oryzae sets a question at the centre and adds the time around the writing — a fermentation process that returns your own words to you in a different shape.',
  'faq.2.q': 'Do I have to write vertically?',
  'faq.2.a':
    'No. Vertical writing is the default, but you can switch to horizontal in one click. The font flips between mincho (serif) and gothic (sans) too.',
  'faq.3.q': 'What does the AI read?',
  'faq.3.a':
    'Only the question you set, and the entries you tied to it during that week. Anything not tied to a question stays out of the fermentation.',
  'faq.4.q': 'Can I write in languages other than Japanese?',
  'faq.4.a':
    'Yes — multilingual input is supported, including English. Vertical writing is tuned for Japanese and Chinese.',
  'faq.5.q': 'What stage is the project at?',
  'faq.5.a':
    'Oryzae is a research preview. The shape of the app and its behaviour will continue to shift alongside the research.',

  'outro.l1': 'One question is enough',
  'outro.l2': 'to change a week.',
  'outro.cta': 'Open Oryzae',

  'foot.tag': 'Aspergillus oryzae for words.',
};

export const LANDING_I18N: Record<LandingLang, LandingDict> = { ja, en };

export const LANDING_TITLES: Record<LandingLang, string> = {
  ja: 'Oryzae — 書くことを、発酵させる。',
  en: 'Oryzae — Let your writing ferment.',
};
