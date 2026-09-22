# ヘルプモード

初めて入った人が、**操作の仕方・考え方・ここで何が返ってくるか**を、画面を触りながら
理解できるようにするための面。初回のオンボーディング（4 段の紹介を順に進める画面）を
置き換えたもの。

## なぜモードなのか

以前のオンボーディングは**不可逆**だった。ログイン直後に 4 枚の紹介が出て、最後に最初の
問いを立てさせ、終えると二度と戻れない。途中で画面を試すこともできず、あとで「あれは
何だったか」を確かめる場所も無かった。

ヘルプは**モード**にする。開いている間も画面はそのまま触れる。触れたものの説明が面に出て、
閉じてもまた開ける。初めての人には自動で開くが、それは「一度だけ出る画面」ではなく
「最初から開いている面」に過ぎない。

## 形

| | PC | SP |
| --- | --- | --- |
| 面 | 右の面（`features/pc/help/components/help-sidebar.tsx`）。`<main>` の隣に立ち、本文はそのぶん詰まる（被らない）。幅・地・縁は発酵の面と同じ（`SIDE_PANEL_WIDTH` / `--surface-sunken`） | 下から出るシート（`features/sp/help/components/sp-help-sheet.tsx`） |
| 開く | 書斎のメモ帳／左の列の「使い方」／`?` キー | 書斎のメモ帳のピル／アカウントの「使い方を開く」 |
| 閉じる | 面の ×／`Esc`／`?`／メモ帳・「使い方」をもう一度 | 面の ×／背景 |
| 触れると説明 | ある | 無い（代わりに「いま開いている画面」が頭に来る） |

面の中身（`features/shared/help/components/help-panel.tsx`）は両端末で共有する。上から:

1. **検索欄** — 「したいこと」を書く
2. **いま触れているもの** — 触れている物・項目の話題。何にも触れていなければ、いま開いている画面の話題
3. **話題の一覧** — はじめに／書斎のもの／画面／困ったとき。行を押すと本文・線画・「開く」が出る

開閉は localStorage に憶える。画面を移っても開いたまま。

## 話題

説明は**話題（topic）**の一覧でできている。骨組みは `features/shared/help/topics.ts`
（節・線画・「開く」の行き先）、文面は i18n の `help.topics.<id>`（題・一言・本文・鍵語。
4 言語）。

| 節 | 話題 |
| --- | --- |
| はじめに | `concept` Oryzae とは → `question` 問いを立てる → `write` 書く → `pickle` 瓶に漬ける。**上から読めば一周する** |
| 書斎のもの | `jar` 瓶 / `notebook` 手帳 / `board` ボード / `archive` 書庫 |
| 画面 | `letter` 手紙・ことば・断片 / `snippet` スニペット / `list` 一覧 / `questions` 問いの変遷 / `account` アカウント |
| 困ったとき | `support` よくある質問・お問い合わせ（公開サイト、新しいタブ）/ `help` このヘルプの使い方 |

文面の語は `docs/glossary.md` に従う。話題を足すときは `HelpTopicId` に 1 つ足し、
4 言語の `help.topics` に文面を足す（`test/features/shared/help/topics.test.ts` が揃いを見る）。

線画（`help-illustrations.tsx`）は書斎の物と同じ **1 本の線**で描く。塗らない。
旧オンボーディングの挿絵は別系統の塗り色（`--ob-*`）で、書斎の世界と別物に見えた。

## 触れると説明が出る

ヘルプが開いている間、`HelpProvider` が `pointerover` を捕まえて「いま触れているもの」を
決める（`features/shared/help/hover.ts`）。決め方は 3 段:

1. **名乗り** — 部品が `data-help="<話題>"` を持っていれば、それ。先祖の名乗りも効く
   （`NavRow` の `help` prop、書斎の的は `topicForStudyLabel`）
2. **名前** — 名乗っていない押せるもの（button / a など）は、名前（aria-label → title → 文字）を
   手元の照合にかける。決まればそれ、決まらなければ先祖の名乗り
3. **Jev** — 名乗りも無く名前でも決まらないときだけ、ポインタが止まってから Jev に訊く

隙間に出ただけでは消さない（160ms 待つ）。面の中で動いても変えない。

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
false なら面を自動で開き、「ようこそ」と最初の話題（Oryzae とは）を開いた状態にする。
閉じたら `PATCH /api/v1/users/me/onboarding` で記録する。以後は自動で開かない。

旗の名前は旧オンボーディングのまま。意味は「初回のヘルプを閉じたことがある」になった。
エディタのナッジ（Issue #316）もこの旗を見て「初回の案内が済んだ人にだけ出す」ので、
旗を増やさず同じものを使う。

旧オンボーディングが最後に立てさせていた「最初の問い」は、ここでは求めない。問いは
瓶の中で立てられ、書く画面からも結べる（「問いを立てる」の話題がそこへ導く）。

## 置き場

| 何 | どこ |
| --- | --- |
| 状態（開閉・触れているもの・検索欄） | `features/shared/help/help-context.tsx`（`HelpProvider` / `useHelpMode`） |
| 話題の骨組み | `features/shared/help/topics.ts` |
| 手元の照合 | `features/shared/help/search.ts` |
| DOM から「触れているもの」を読む | `features/shared/help/hover.ts` |
| 手元 + Jev の解決 | `features/shared/help/hooks/use-help-resolver.ts` |
| 面の中身 | `features/shared/help/components/help-panel.tsx`（+ `help-topic-card` / `help-illustrations`） |
| PC の右の面 | `features/pc/help/components/help-sidebar.tsx` |
| SP のシート | `features/sp/help/components/sp-help-sheet.tsx` |
| Jev への問い合わせ | `apps/server/src/contexts/shared/infrastructure/typesafe-systemone.ts` |
| 入力の形 | `packages/shared/src/schemas.ts` の `helpSearchSchema` |
| 文面 | `apps/client/src/i18n/messages/*.json` の `help` |

シェル（`app/(protected)/layout.tsx`）が `HelpProvider` を張り、PC は `<main>` の隣に
`HelpSidebar`、SP はシェルの末尾に `SpHelpSheet` を置く。
