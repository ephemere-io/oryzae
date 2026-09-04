# 60 — 実装時の決着（仕様と実コードのズレ）

`00-overview.md` 〜 `50-rollout.md` は実装前に書かれている。リポジトリを読んだ結果、
いくつか前提が実際と違っていた。**このファイルが後から書かれた分だけ新しい**ので、
矛盾したらここを優先する。

## 1. `readiness` は上流に既にあった

`10-data-contract.md` は「上流にあるのは `FermentationSummary.status` だけ」としているが、
これは誤り。次のものが既にある。

| もの | 場所 |
| --- | --- |
| `readinessScore` (0..1) を返すドメインサービス | `fermentation-eligibility.service.ts` の `evaluateEligibility()` |
| それを組む usecase | `get-fermentation-readiness.usecase.ts`（admin から使用済み） |
| 永続化カラム | `user_fermentation_state.readiness_score numeric(3,2)` |
| 本人の SELECT を許す RLS | `supabase/migrations/00014_...sql` |

00014 のコメントに「readiness は admin ダッシュボード表示と **Jar アニメーションへの反映**を
意図する」と明記されており、最初からユーザーに出す前提で作られていた。

**決着: 案 A。** ただし新規実装ではなく、既存 usecase を本人向けに公開するだけ
（`GET /api/v1/fermentations/readiness`）。マイグレーション不要。

**案 B は採らない。** 案 B の式は `pickledSinceLastFermentation / threshold` だが、実際の
発火条件は `countCharsByUserIdSince()` ＝ *fermentation_enabled に関わらず全エントリの
合計文字数*。案 B は「サーバーの条件が変わると嘘になる」以前に、書かれた時点で既に嘘。

### 返す形

admin 版は `threshold` / `charsCurrent` / `hoursElapsed` まで返すが、本人向けは
`{ readiness, eligible, nextRunAt }` に絞る。「readiness を数値で出さない」方針
（`00-overview.md`「コピー」）と、閾値を晒さないため。

### `status` はサーバーから来ない

`StudyState.fermentation.status: 'idle' | 'fermenting' | 'completed'` は瓶の見た目の語彙で、
上流に 1:1 の対応が無い。サーバーの `FermentationStatus` は
`'pending' | 'processing' | 'completed' | 'failed'` で、しかも**発酵 1 件ごとの状態**
（ユーザーの状態ではない）。

**決着: クライアントで合成する**（`use-study-state.ts`）。

- `completed` … 未読の完了発酵がある。未読判定は localStorage にしか無く、**構造的に
  サーバーでは決められない**
- `idle` … 完了発酵が無く readiness が 0
- それ以外 … `fermenting`

## 2. `notebooks` は新設した

`GET /api/v1/entries/monthly-counts`。`created_at` は timestamptz、「月」はユーザーの
ローカル暦月なので、board API と同じ規約で `tzOffsetMinutes` を受ける
（これが無いと JST の月初 0–9 時の記録が前月に落ちる）。

実装は Postgres 集計ではなく「`created_at` だけを読んでサーバーで畳む」方式。
`user-me.ts` の `selectAllRows` と同じ id カーソルページングを使う（offset だと読んでいる
最中の INSERT でずれる）。行数が問題になったら RPC に差し替える — API 契約は変わらない。

**クライアント近似は不可。** 既存の `/entries?limit=20` から数えると 40 件の月が 20 件に
見え、手帳の厚みが嘘になる。

## 3. 「漂う言葉」は発酵中には存在しない

`fermentation_keywords` は `run-fermentation.usecase.ts` で `withStatus('completed')` の
直前に一括保存される。発酵は段階的な処理ではなく **LLM の 1 バッチ**なので、
`status: 'fermenting'` の間にキーワードは 1 件も無い。

`00-overview.md` の「readiness に応じて言葉が漂う／readiness が低ければ表示語数も減る」は
上流の作りと成立しない。

**決着: 直近に完了した発酵のキーワードを漂わせる**（＝いま漬けているものではなく、
前回の残り香）。追加 API は要らず、表示語数を readiness で絞れば「発酵が浅いほど語が少ない」
という見た目の規則もそのまま満たせる。

## 4. ファイル配置は `20-3d-component.md` と変えた

doc の配置は client の dep-cruise ルール 3 つに当たる。

- `shared-no-device-detection` … `features/shared/**` → `components/device-view` を禁止
- `reach-shared-purity` … `features/shared/**` → `features/{pc,sp}/**` を禁止
- `protected-pages-use-device-view` … `app/(protected)/**/page.tsx` に device-view を要求

また `scene/` を `features/pc/study/` に置くと `reach-slice-isolation` により
`features/sp/study` から import できず、SP 用に丸ごと二重実装になる。

**決着:**

```
apps/client/src/features/shared/study/
  types.ts                        StudyState など
  layout.ts                       PC/SP の座標・fov・尺度（端末名ではなく「配置」として持つ）
  constants.ts                    duration / easing / カメラ距離の唯一の置き場
  scene/                          three.js だけに依存する純関数（React 非依存）
    materials.ts jar.ts books.ts board.ts camera.ts labels.ts scene.ts
  hooks/use-study-state.ts
  components/study-canvas.tsx     layout を受け取る。端末を判定しない
  components/study-chrome.tsx
  components/entry-list-overlay.tsx
  components/study-fallback.tsx
apps/client/src/features/pc/study/components/pc-study.tsx   PC_LAYOUT を渡す薄い入口
apps/client/src/features/sp/study/components/sp-study.tsx    SP_LAYOUT を渡す薄い入口
apps/client/src/app/(protected)/study/page.tsx               ここで DeviceView 分岐
```

`study-canvas` には `device` 文字列ではなく `layout` オブジェクトを渡す。shared の中で
端末を分岐しないという規約に正直に沿うため。

## 5. SP のボードは**存在しない**

`app/(protected)/board/page.tsx` は `<DeviceView pc={<BoardView />} />` で `sp` を
渡していない。つまり SP でボードを開くと「スマホ未対応」が出る。

`30-branch-and-commits.md` のコミット 10「SP のボードから右ペインを外し、カードを
ドラッグできるように」は、実際には **SP ボードの新規実装**であって、規模が他の全コミットに
匹敵する。かつ「既存の board 画面は変更しない」という今回の縛りとも衝突する。

**決着: 当初は別 PR に分離したが、この PR で実装した。**
`features/sp/board/` に新設し、`/board` の `DeviceView` に `sp` を渡した。

- `sp-board-surface.tsx` — 見た目と指の操作（検証可能な純粋な描画）
- `sp-board.tsx` — 取得と初期フィット

PC の `BoardView` は触っていない。`reach-slice-isolation` により `features/sp` から
`features/pc` は import できないので、カードの描画は SP 用に別に書いた。とはいえ
コピーではない — PC が持つ意味的ズーム・選択・回転・リサイズ・ツールバー・ミニマップは
どれも無く、指の移動 1 つに絞ってある（`no-cross-device-duplication` の閾値 0.6 に対して
十分低い）。

**仕様との差: 位置を保存する。** `30-branch-and-commits.md` のコミット 10 は
「位置の永続化はしない（この段では見た目だけ）」としているが、`40-acceptance.md` は
「離した位置に留まる」と書いており、保存しないとリロードで配置が消える。PC が使っている
`useBoardSave`（debounce つき PUT）がそのまま使えるので、指を離した時に投げる。

**日の切り替えは付けていない。** 00-overview.md が SP について挙げているのは
「日付とカード枚数だけを隅に小さく浮かせる」だけで、日付ナビゲーションに触れていない。
そのため当日のボード固定になっている。過去の日を見る導線が要るかは別途の判断。

## 6. SP のボトムナビも書斎ホームでは外す

**当初は残す判断にしていたが、撤回した。** 書斎は「それ自体が唯一のグローバル
ナビゲーションになる」（00-overview.md）のだから、PC のサイドバーだけを外して SP に
ナビを残すのは半端になる。書斎ホームでだけ `SpBottomNav` を描かない
（サイドバーと同じ条件）。サブ画面ではこれまでどおり出る。

ナビが退いたぶん縦の余白が空いたので、SP でも下端キャプション（書斎 / STUDY / 状態）を
出す。当初これを省いていた理由は 64px のナビとの競合だったため、理由ごと消えた。

**残る穴: `/questions` へ書斎から行けない。** `SpBottomNav` のタブは
エントリー / 問い / 書く / 瓶 / アカウント の 5 つで、`/questions` は SP のここにしか
入口が無い（PC ではサイドバーに無く、瓶ビューの中にある）。書斎の的は
瓶 / 手帳 / 棚 / ボードの 4 つで、問いは含まれない。

いまは「書斎 → 瓶などサブ画面へ入る → そこのボトムナビから問いへ」で到達できるが、
ホームから直接は行けない。問いを書斎のどこに置くか（瓶の中に見えている問いを押せる
ようにするのが自然）は 00-overview.md が決めていないので、別途の判断が要る。

## 7. `--sidebar-width` も分岐対象

`00-overview.md` は「`<Sidebar />` と `marginLeft: SIDEBAR_WIDTH` を外す」としか書いていないが、
`(protected)/layout.tsx` が `<main>` に生やす CSS 変数 `--sidebar-width` は **board が読んでいる**
（`board-view.tsx` のツールバー、`board-toolbar.tsx` の中央寄せ）。無条件に外すとボードの
ツールバーが 40px ずれる。`/study` のときだけ両方を 0 にする。

なお `SidebarProvider` の既存 `hidden`（エディタの集中モードが使う）は opacity と
pointer-events を切るだけで `marginLeft` は残るので、書斎の全幅描画には足りない。

## 8. コミット順を変えた

- サーバー側（元コミット 11）を**先頭近く**へ。readiness は既存 usecase の薄い公開で済み、
  案 B の近似は入れても嘘になるため。
- docs 取り込み（元コミット 12）を**最初**へ。以降のコミットが参照する SSoT が
  リポジトリに無い状態を作らない。
- 各コミットにユニットテストか `*.verify.tsx` を**同梱**する。「ここまでは画面に出ない」
  ＝どこからも import されない export ＝ `pnpm knip` が落ちる（pre-push と CI の両方）。
  空の `scene/` ディレクトリを置くコミットも git が空ディレクトリを持てないので成立しない。

## 9. 残っている穴: 古い月の一覧が空になる

一覧オーバーレイは `useEntries`（`GET /api/v1/entries?limit=20`）が取ってきた
**直近 20 件**を月で絞っているだけ。そのため、20 件より古い月を選ぶと
「この月の記録はありません」と出る。

実機で確認した食い違い（2026-09-04 時点のテストアカウント）:

| 月 | 手帳／棚が言う件数 | 一覧が出す件数 |
| --- | --- | --- |
| 2026.09 | 6 | 6 |
| 2026.08 | 14 | 14 |
| 2026.04 | 1 以上（棚に背表紙がある） | **0** |

見出しも `2026.04 — 0 ENTRIES` と出るので、**手帳の厚みと矛盾した数字を自分で
名乗ってしまう**のが厄介。件数は `monthly-counts`（全期間の集計）から来るのに、
一覧は直近 20 件しか見ていない。

直し方は 1 つで、`GET /api/v1/entries` に月の絞り込みを足すこと
（`questionId` と同じ形の `month=YYYY-MM`。サーバー側は `localDayRange` と同じ
`tzOffsetMinutes` を受けて期間で絞る）。クライアントでページングを繰り返して
埋めるのは、月が古いほど往復が増えるので採らない。

今回のコミット群には**入れていない**。30-branch-and-commits.md のどのコミットにも
無い新しいサーバー変更で、入口の設計（過去月の手帳を押す）そのものに関わるため、
独立して判断・レビューされるべきだと考えた。机に積む直近 3 ヶ月は 20 件に収まる
ことが多く、棚（4 ヶ月以上前）を押したときに出やすい。

## 10. ⚠️ レビュー用の一時的な端末切替（マージ前に外す）

画面右下に PC / SP の切替スイッチを置いてある。端末は middleware が `device-pref`
cookie（無ければ UA）から確定して `x-device` ヘッダで渡す作りなので、切り替えには
cookie の書き換えとリロードの両方が要り、レビュー中に DevTools の Console を毎回
開くことになっていた。プレビューで PC / SP を見比べる間だけの足場。

一時的なものだと見た目で分かるよう、枠を破線・テラコッタにしてある。

**外し方（3 箇所）:**

1. `apps/client/src/components/device-switch.tsx` を消す
2. `apps/client/src/app/(protected)/layout.tsx` の `<DeviceSwitch />` と import を消す
   （どちらにも `TODO(review):` を付けてある）
3. この節を消す

`git grep 'TODO(review)'` で 2 箇所とも出る。
