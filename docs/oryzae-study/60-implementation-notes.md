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

**決着: 別 PR に分離。** 書斎の SP `BOARD` ピルは `/board` へ行き、そこで現行の
「スマホ未対応」表示に落ちる（書斎側は壊れない）。`40-acceptance.md` の SP ボード 4 項目は
この PR の対象外。

## 6. SP のボトムナビは残す

`SpBottomNav` のタブは エントリー / 問い / 書く / 瓶 / アカウント の 5 つで、
**`/questions` は SP のここにしか入口が無い**（PC ではサイドバーに無く、瓶ビューの中にある）。
書斎ホームでナビを消すと問いに行けなくなる。

**決着: 第 1 段では残す。** 代わりに `00-overview.md` の SP「下端キャプション」は出さない
（64px のナビと競合するため）。ナビの撤廃は PC サイドバーだけに閉じ、SP のナビ設計は別途。

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
