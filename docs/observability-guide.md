# Observability ガイド

Oryzae の監視・可観測性の方針。「何をなぜ監視するか」を記述する。
具体的なツール設定やキーは `.env.example` とコードが正。

---

## 監視の関心事

| 関心事 | 問い | 判断基準 |
|---|---|---|
| **ユーザー行動** | ユーザーはプロダクトをどう使っているか | PV, セッション, 滞在時間, 導線 |
| **エラー** | 何が壊れているか | 例外の発生頻度, 影響ユーザー数, スタックトレース |
| **LLM コスト** | AI にいくらかかっているか | 実請求額 (Anthropic cost_report), per-request トークン数, ユーザー別推定 |
| **API 保護** | 不正アクセスや過負荷を防げているか | レート制限の発動頻度 |
| **デプロイ** | 本番は正常に動いているか | ビルド状態, サーバーログ |

## 原則

- **各ツールは1つの関心事に対応する** — 1ツールで全部やろうとしない
- **未設定でもアプリが動く** — 全監視ツールの env var はオプション。未設定なら silent skip
- **admin 画面がポータル** — `/observability` でハブ、詳細は各サブページまたは外部ダッシュボード
- **API で取れるデータは admin に表示する** — 外部ツールに行かなくても概要がわかる状態を保つ

## admin の Observability ページ構成

| パス | データソース | 内容 |
|---|---|---|
| `/observability` | 全ツール API | ハブ。各ツールのキー指標をカードで一覧 |
| `/analytics` | PostHog API | PV・セッション・滞在時間・ページ別・日別推移 |
| `/observability/errors` | Sentry API | 未解決 issue 一覧（タイトル, 発生回数, 影響ユーザー数） |
| `/observability/spend` | Anthropic Cost API + DB | 実請求額の日別チャート・推定との乖離・用途別（発酵/OCR）内訳・ユーザー別推定内訳 |
| `/observability/deploys` | Vercel API | デプロイ一覧（状態, ビルド時間, コミットメッセージ） |
| `/costs` | DB (保存トークン) | **発酵の** per-request 推定コスト詳細（OCR は含まない。レガシー、将来的に /observability/spend に統合） |

## LLM コストの二系統（重要）

コストには **性質の違う2系統** があり、混ぜてはならない。

| | 実請求額 (actual) | 推定 (estimated) |
|---|---|---|
| 出典 | Anthropic Admin API `/v1/organizations/cost_report` | `fermentation_results` + `ocr_usage` の保存トークン × 価格表 |
| **対象範囲** | **org 全体**。CI のレビュー・手元の検証・他プロジェクトも含む | **Oryzae が記録した呼び出しだけ** |
| 正確さ | **正**。実際に課金された額 | 近似。キャッシュ読み書き・値引き・課金丸めを反映しない |
| 粒度 | UTC 日バケット固定（`bucket_width=1d` のみ） | 任意の期間・**ユーザー別**・**用途別**（発酵 / OCR） |
| ユーザー別 | **不可**（Anthropic は Oryzae のユーザーを知らない） | 可能。これが推定を残す唯一の理由 |
| 実装 | `shared/infrastructure/anthropic-cost-api.ts` | `fermentation-cost-query.ts` + `ocr-cost-query.ts` + `claude-pricing.ts` |

### 実請求 ≧ 推定 が常態（ズレ自体は異常ではない）

実請求は **org 全体**の額で、Oryzae のアプリ以外の利用も含む。一方 推定は
**Oryzae が自分で記録した呼び出しだけ**を数える。したがって差が出るのが正常で、
**差額は「記録していない利用」の量**を意味する。

「推定が全然合っていない」と読めてしまうのを防ぐため、画面・通知では

- 見出しに範囲を書く（「実請求額 (org 全体)」「推定コスト (Oryzae 記録分)」）
- 差額そのものと、それが何なのかを書く
- 推定は**計算式を並記**する（`in 5,972 × $3.00/MTok = $0.017916`）。
  金額だけだと、計算が壊れているのか対象範囲が違うのかを切り分けられない

### 実額と推定の使い分け

**実額 (actual)** は Anthropic Admin API `/v1/organizations/cost_report` から取る。
`ANTHROPIC_ADMIN_KEY` が要る（Console > Settings > Admin keys、org 管理者のみ発行可）。
未設定でもアプリは動き、画面・通知には「未設定」と出る（$0 とは区別される）。

**推定 (estimated)** は保存トークン × 公表単価。Anthropic は Oryzae のユーザーを
知らないため、**ユーザー別内訳はこの推定でしか出せない**。これが推定を残す理由。

推定はこの用途では十分に正確である。Oryzae の LLM 呼び出しは **standard tier・
プロンプトキャッシュ無し・バッチ無し・サーバーツール無し** なので、
`トークン数 × 公表単価` は Anthropic が請求額を出すのと同じ計算式になる。
トークン数は Anthropic 自身が返した値であり、独自に数えた推測値ではない。

### 用途ごとにモデルと単価が違う

| 用途 | モデル | 単価 (in / out per MTok) | 記録先 |
|---|---|---|---|
| 発酵 | `claude-sonnet-4-6` | $3 / $15 | `fermentation_results.{input,output}_tokens` |
| OCR | `claude-opus-5` | $5 / $25 | `ocr_usage`（migration 00023） |

**合算してから一律単価を掛けてはいけない。** `computeCostFromTokens` は単価を
必須引数にしてあり、呼び出し側が用途に応じた `*_MODEL_RATE` を明示する。
既定値を置くと、別モデルの呼び出しが誤った単価で計算されても何も失敗せず、
合計が増えるだけなので気づけない。

`ocr_usage` は `model` を列に持ち、集計は**行ごとに** `rateForModel()` で単価を
引き直す（gateway のモデルを差し替えた前後のレコードが混在しうるため）。
価格表に無いモデルは既定単価で埋めず `untrackedCount` に計上する。

OCR に専用テーブルがあるのは、**呼び出しごとに残るレコードが無い**ため。
読み取っただけでスニペットを作らない場合もあるが、課金は発生している。

### 前提が崩れたときに気づく仕組み

| 崩れ方 | 検知 |
|---|---|
| モデルを変更した | 各 gateway が `FERMENTATION_MODEL_ID` / `OCR_MODEL_ID` を import。価格表に無いモデルは**型エラー**で CI が止まる |
| プロンプトキャッシュを導入した | 両 gateway が `cacheReadTokens`/`cacheWriteTokens` を検知して警告ログ（単価が 0.1x / 1.25x・2x に変わるため） |
| 公表単価が改定された | 手動。`claude-pricing.ts` の `RATES` を更新する（テストが単価を固定しているので更新漏れは落ちる） |
| トークン未保存の行がある | `untrackedCount` として件数を返し、通知・画面に出す |
| 価格表に無いモデルで動いた | 同上。金額 0 のまま `untrackedCount` に計上し、`byModel` に `unpriced` を立てる |
| `ocr_usage` を読めない（migration 未適用） | `$0` ではなく「取得失敗」と出し、推定の status を `partial` にする |
| 件数が集計上限を超えた | `truncated` として返し「過少集計」と明示する |
| 推定と実額がズレた | Spend 画面の乖離率で観測できる |

原則:

- **金額を出す画面・通知では、それが実額か推定かを必ず明示する。**
- **取得できないときに `$0` を表示しない。** `ActualCostResult` は
  `ok` / `not-configured` / `error` のユニオンで返す。null や 0 に潰すと
  「未設定」を「$0」と誤読させる（issue #490 で報告された症状そのもの）。
- **日次レポートは JST 日**（発酵 cron が JST 03:00 に走るため）。
  実額は UTC 日でしか取れないので、`utcDateKeyOfJstFermentationRun()` で
  対応 UTC 日を求め、表示に「UTC」と明記する。
- 価格表 (`claude-pricing.ts`) は各 gateway のモデルと対で管理する。
  モデルを変えたら価格も変える。
- **LLM を叩く経路を増やしたら、必ずトークンを記録する。** 記録しないと課金だけ
  発生して推定には $0 しか乗らず、実額との差が「原因不明の乖離」になる
  （OCR が実際にこの状態だった）。

### 既知の限界

- リトライ (`retryOf`) は同じ行を再利用するため、前回試行ぶんのトークンは上書きされる。
  実額との乖離要因になる（`/observability/spend` の乖離率で観測できる）。
- `cost_report` は Priority Tier のコストを含まない（Oryzae は standard のみ利用）。
- 反映ラグは通常5分程度。直近の利用は実額に載らないことがある。
- OCR の記録に失敗しても読み取り結果は返す（課金は既に発生していて取り返せない）。
  その分は推定から漏れるので、実額との差として現れる。
- `/costs` 画面は発酵のみ。OCR を含む合計は `/observability/spend` を見る。

## ツール追加時の手順

1. `.env.example` に環境変数を追加（カテゴリコメント付き）
2. 未設定時に graceful skip するコードを書く
3. admin の Observability ハブページにカードを追加
4. 必要なら詳細サブページを作成
5. Vercel の環境変数に値を設定
