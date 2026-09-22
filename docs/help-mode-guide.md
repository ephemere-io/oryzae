# ヘルプモード

初めて入った人が、**操作の仕方・考え方・ここで何が返ってくるか**を、画面を触りながら
理解できるようにするための面。初回のオンボーディング（4 段の紹介を順に進める画面）を
置き換えたもの。

## なぜモードなのか

以前のオンボーディングは**不可逆**だった。ログイン直後に 4 枚の紹介が出て、最後に最初の
問いを立てさせ、終えると二度と戻れない。途中で画面を試すこともできず、あとで「あれは
何だったか」を確かめる場所も無かった。

ヘルプは**モード**にする。有効な間は画面の右上に「?」が居て、押すと右の面が開く。開いている
間も画面はそのまま触れ、触れたものの説明が面に出る。閉じても同じ「?」からまた開ける。
初めての人には自動で開くが、それは「一度だけ出る画面」ではなく「最初から開いている面」。

**書斎の中にヘルプの入口を置かない。** 一度メモ帳を置いて押すと面が開閉する形にしたが、
物を押してモードが切り替わるのは戻り道が読めない（「メモというよりヘルプモードという
体験」）。メモ帳そのものも外した（「MEMO はいらないんじゃない？」）。書斎の物は瓶・手帳・
板・棚・鉛筆だけで、どれも本人のものを映す。

## 形

| | PC | SP |
| --- | --- | --- |
| 入口 | 画面の右上の「?」（`HelpToggle`。ヘルプモードが有効な間、全画面に居る）／`?` キー／左サイドバーの「使い方」（`?study=off` のとき） | 書斎の右上の「?」（サブ画面の SP は上端に題があり、右上に席が無い） |
| 面 | 右の面（`features/pc/help/components/help-sidebar.tsx`）。`<main>` の隣に立ち、本文はそのぶん詰まる（被らない）。幅 0 ⇄ 面の幅で出入りする（160ms）。既定の幅・縁は発酵の面と同じ、地は紙、縁に左へ落ちる薄い影。**左の縁を掴んで幅を変えられる**（280–560px、憶える。2 度押しで既定に戻る。掴み手は見えず、触れたときだけ縁に細い線）。面が立って書斎が横に狭くなると、書斎は机が丸ごと入るぶん引く（`zoomForAspect`） | 下から出るシート（`features/sp/help/components/sp-help-sheet.tsx`） |
| 閉じる | 面の ×／`Esc`／`?`／右上の「?」をもう一度 | 面の ×／背景 |
| 触れると説明 | ある | 無い（頭の 1 枚は「いま開いている画面」） |
| 設定 | アカウント →「ヘルプモード」。切ると「?」も消え、キーも効かない。既定は有効 | 同じ |

「?」は面が開いている間も消えない（押された状態になる）。面の幅（`--help-width`）のぶん
左へ寄るので、面の左肩に居続ける。右上に居る他の物（瓶の画面の「問いの変遷」）は
`--help-toggle-reserve` で 48px 左へ寄る。

## 面の中身

上から **検索欄 → 生きている 1 枚 → まず試してみよう（三歩）→ 話題の一覧**（`help-panel.tsx`）。

地は紙（`--bg`）。読む面なので沈んだ灰にはしない。色を持つのは生きている 1 枚の線画と
縁、三歩の番号（アクセントの緑）だけ。

### 言葉で説明しない

ここが一番大事な決めごと。**見れば分かることを言葉にしない。**

- 面の名前（「使い方」）は書かない。右上の「?」を押して出た面が何かは、押した人が知っている
- 生きている 1 枚（`help-live-card.tsx`）に見出し（「いま触れているもの」）を付けない。
  触れるたびに中身が変わる — それ自体が「ここは触れているものを映す面だ」と伝える。
  「カーソルを載せると説明が出ます」と書いた版は、書かなくても分かることを言葉にしていた
- 生きている 1 枚に**押すもの（「開く」）を置かない**。ボタンへ向かう途中で別の物に触れて
  中身が変わるので、押せた試しが無かった。行き先へは下の一覧から行く
- 一覧に節の見出し（「書斎のもの」「画面」）を付けない。行の間の空きで束が分かり、
  行の線画で何の話かが分かる
- 初めての人への「ようこそ」は 3 行だけ（挨拶・案内の在処・始める）。面の中には書かない

人は面の文を上から全部読んで理解するのではなく、形と動きから推測する。説明を足すほど
読まれなくなる。参考にしたもの:

- Ableton Live の **Info View** — 触れているものの名前と一段落だけを、決まった場所に出す。
  見出しも装飾も無い。生きている 1 枚はこれと同じ作り
- Nielsen Norman Group「Instructional Overlays and Coach Marks」— 説明の重ね書きは
  読まれない。文脈の中で、要るときに、短く
- Intercom / Help Scout の Beacon — 検索欄と記事の列。節の見出しは無く、記事の題と
  1 行目だけ。ここの一覧はこの形
- Apple の Human Interface Guidelines「Onboarding」— アプリの使い方を教える画面より、
  使いながら分かる作りを

### 生きている 1 枚

線画（88px、アクセント色）・題・一言・本文。触れているものが変わると 1 枚ごと入れ替わる
（`help-fade`、180ms）。動きが「変わった」ことを言う。何にも触れていなければ、
いま開いている画面（`topicForScreen`）。**面の中に入ったら「触れていない」に戻る** —
面の隣の物（瓶の画面の「問いの変遷」）を横切った直後に面へ入ると、その物の説明が
面の中に居座っていた。

### まず試してみよう（`help-first-steps.tsx`）

このアプリの筋書きを三歩で見せる: **問いを立てる → エントリーを書く → 瓶に漬けて待つ**。
「はじめに」の 4 話題を読む物としてではなく辿る物として置く。それぞれ押すと行き先へ
（瓶 / 書く / 瓶）。三歩目には最初の手紙が届く条件（問いを結んだエントリーが日本語で
1,000 字・英語で 500 字ほど溜まると、翌日の夜に発酵）を添える — 何も起きない時間を
「壊れている」と思わせないため。

### 一覧

「はじめに」以外の 11 話題を 3 つの束に分けて並べる（束の間は細い線 1 本、行の余白は
どの行も同じ）。行は線画（30px）・題・一言。押すと本文と「開く →」が行の下から伸びて出る
（`grid-template-rows` 0fr ⇄ 1fr、200ms。外へ出る話題は ↗）。閉じている間の本文は `inert`。

### 検索欄

「したいこと」を書くと、一覧の代わりに近い話題だけを出す（上位 6 件、1 件目は開いた状態）。
Jev が選んだ 1 件には「おすすめ」の印。

## 話題

説明は**話題（topic）**の一覧でできている。骨組みは `features/shared/help/topics.ts`
（束・線画・「開く」の行き先）、文面は i18n の `help.topics.<id>`（題・一言・本文・鍵語。
4 言語）。

| 束 | 話題 |
| --- | --- |
| 1（上から読めば一周する） | `concept` Oryzae とは → `question` 問いを立てる → `write` 書く → `pickle` 瓶に漬ける |
| 2（書斎のもの） | `jar` 瓶 / `notebook` 手帳 / `board` ボード / `archive` 書庫 |
| 3（画面） | `letter` 手紙・ことば・断片 / `snippet` スニペット / `list` 一覧 / `questions` 問いの変遷 / `account` アカウント |
| 4（困ったとき） | `support` よくある質問・お問い合わせ（公開サイト、新しいタブ）/ `help` このヘルプの使い方 |

文面の語は `docs/glossary.md` に従う。話題を足すときは `HelpTopicId` に 1 つ足し、
4 言語の `help.topics` に文面を足す（`test/features/shared/help/topics.test.ts` が揃いを見る）。

線画（`help-illustrations.tsx`）は書斎の物と同じ **1 本の線**で描く。塗らない。
旧オンボーディングの挿絵は別系統の塗り色（`--ob-*`）で、書斎の世界と別物に見えた。

## 触れると説明が出る

ヘルプが開いている間、`HelpProvider` が `pointerover` を捕まえて「いま触れているもの」を
決める（`features/shared/help/hover.ts`）。決め方は 3 段:

1. **名乗り** — 部品が `data-help="<話題>"` を持っていれば、それ。先祖の名乗りも効く
   （`NavRow` / `FloatingPalette` の `help` prop、書斎の的は `topicForStudyLabel`）
2. **名前** — 名乗っていない押せるもの（button / a など）は、名前（aria-label → title → 文字）を
   手元の照合にかける。決まればそれ、決まらなければ先祖の名乗り
3. **Jev** — 名乗りも無く名前でも決まらないときだけ、ポインタが止まってから Jev に訊く

隙間に出ただけでは 160ms 待って消す。面の中で動いても変えない。

名乗っている部品（`data-help`）。**画面の主な区画は必ず名乗る** — 名前の照合と Jev は
名乗りの無い細かな部品のための補いで、鍵が無い環境では名乗りだけが確実に効く。

| 部品 | 話題 |
| --- | --- |
| 左サイドバーの各行（`NavRow.help`） | jar / board / list / write / help / account |
| 書斎の 3D の的（`topicForStudyLabel`） | jar / notebook / board / archive / write（鉛筆）。何にも触れていなければ画面の話題 |
| 書斎の左下のアバター | account |
| エントリーのパレット（`FloatingPalette.help`）・設定の面 | write |
| 問いのチップ・瓶の円・問いを立てるフォーム | question |
| 発酵の面・瓶の詳細ペイン・カバーフロー | letter |
| ボードの上段バー・道具箱・写真のカード | board |
| スニペットのカード | snippet |
| エントリーの一覧・書斎の一覧オーバーレイ | list |
| 問いの変遷 | questions |
| アカウントの画面 | account |

部品を足したら、その区画の話題を `data-help` で名乗らせる（`HelpTopicId` のどれか）。

## 検索欄と Jev

検索欄に書いた「したいこと」は、まず**手元の照合**（`features/shared/help/search.ts`）にかける。
話題の題・一言・本文・鍵語を、英語は語で、CJK は 2 文字の並び（bigram）と漢字・ハングルの
1 文字で重ねる。**Jev が無くてもこれだけで動く。**

1 位が 2 位を十分に引き離せなければ（`isDecisive`）、少し待ってから
`POST /api/v1/help/search` へ回す。サーバー（`apps/server/src/contexts/shared/infrastructure/typesafe-systemone.ts`）
が TypeSafe AI の System One モデル **Jev** に、話題の選択肢から 1 つ選ばせる。

- Jev は文章を生成しない。状態と型付きの問い（`choice`）を渡すと、選択肢から 1 つ選んで
  確からしさを返す。説明の文面はこちらが持つので、モデルが勝手な使い方を語ることは無い
- 確からしさ 0.5 未満は採らない。採れば結果の先頭に「おすすめ」の印つきで置く
- `TYPESAFE_API_KEY` が無ければサーバーは `configured: false` を返し、クライアントは以後
  訊かない。CI・ローカルはこの状態で動く
- 選択肢（話題の題と一言）はクライアントが毎回送る。文面の正は i18n にあり、サーバーで
  二重に持たない
- 送るのは検索欄の文・画面のパス・言語だけ。**エントリーの本文は送らない。** サーバーは
  問いの本文をログにも載せない
- 同じ問いは憶えていて、二度目は訊かない

## 初めての人

`HelpProvider` が `/api/v1/users/me` の `onboardingCompleted` を見る（`use-help-first-visit.ts`）。
false なら**面を開いた状態で始め、面以外を半透明で沈めて「ようこそ」を出す**
（`help-welcome.tsx`）。書斎を初めて見せられても何の部屋か分からないので、最初に伝えるのは
2 つだけ — 使い方は面（PC は右、SP は下）にあること、「始めてみよう」。ボタンか沈みを押すと
晴れ、面はそのまま残る（三歩が見えている）。面を閉じても晴れる。

初めて閉じたとき、右上の「?」が 3 回脈打ち、隣に「ヘルプ」の字が数秒だけ出る — 言葉で
「ここから開けます」と説明する代わりに、動きと位置で居場所を教える。同時に
`PATCH /api/v1/users/me/onboarding` で記録し、以後は自動で開かない。

旗の名前は旧オンボーディングのまま。意味は「初回のヘルプを閉じたことがある」になった。
エディタのナッジ（Issue #316）もこの旗を見て「初回の案内が済んだ人にだけ出す」ので、
旗を増やさず同じものを使う。

旧オンボーディングが最後に立てさせていた「最初の問い」は、ここでは求めない。問いは
瓶の中で立てられ、書く画面からも結べる（「問いを立てる」の話題がそこへ導く）。

## 憶えるもの（localStorage）

| 鍵 | 何 |
| --- | --- |
| `oryzae-help-mode` | 有効か（`'0'` で無効。無ければ有効） |
| `oryzae-help-open` | 開いているか |
| `oryzae-help-width` | 面の幅（px） |

## 置き場

| 何 | どこ |
| --- | --- |
| 状態（有効・開閉・幅・触れているもの・検索欄） | `features/shared/help/help-context.tsx`（`HelpProvider` / `useHelpMode`） |
| 右上の「?」 | `features/shared/help/components/help-toggle.tsx`（配線）/ `help-toggle-button.tsx`（見た目） |
| 初めての人の「ようこそ」 | `features/shared/help/components/help-welcome-gate.tsx`（配線）/ `help-welcome.tsx`（見た目） |
| 話題の骨組み | `features/shared/help/topics.ts` |
| 手元の照合 | `features/shared/help/search.ts` |
| DOM から「触れているもの」を読む | `features/shared/help/hover.ts` |
| 手元 + Jev の解決 | `features/shared/help/hooks/use-help-resolver.ts` |
| 面の中身 | `features/shared/help/components/help-panel.tsx`（+ `help-live-card` / `help-first-steps` / `help-topic-card` / `help-illustrations`） |
| PC の右の面（幅を掴んで変える） | `features/pc/help/components/help-sidebar.tsx` |
| SP のシート | `features/sp/help/components/sp-help-sheet.tsx` |
| 設定 | `features/pc/account/components/account-page.tsx` / `features/sp/account/components/sp-account-page.tsx` の「ヘルプモード」 |
| Jev への問い合わせ | `apps/server/src/contexts/shared/infrastructure/typesafe-systemone.ts` |
| 入力の形 | `packages/shared/src/schemas.ts` の `helpSearchSchema` |
| 文面 | `apps/client/src/i18n/messages/*.json` の `help` / `account.help_mode` |

シェル（`app/(protected)/layout.tsx`）が `HelpProvider` を張り、PC は `<main>` の隣に
`HelpSidebar`、SP はシェルの末尾に `SpHelpSheet`、「?」は PC の全画面と SP の書斎に置く。

**画面の右端に貼りつく fixed の層は流れを見ない**（エディタ・「書斎へ戻る」のタブ・
問いの変遷・「?」・ボードの上段バー）。`HelpSidebar` が `--help-width` を `:root` に配り、
`.sidebar-anchored` の右端・`CONTENT_CENTERED_STYLE`・各 fixed の `right` がそれを引く。
左のサイドバーが `--sidebar-width` を配るのと同じ作り。
