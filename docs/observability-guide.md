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
| `/observability/spend` | Anthropic Cost API + DB | 実請求額の日別チャート・推定との乖離・ユーザー別推定内訳 |
| `/observability/deploys` | Vercel API | デプロイ一覧（状態, ビルド時間, コミットメッセージ） |
| `/costs` | DB (保存トークン) | per-request の推定コスト詳細（レガシー、将来的に /observability/spend に統合） |

## LLM コストの二系統（重要）

コストには **性質の違う2系統** があり、混ぜてはならない。

| | 実請求額 (actual) | 推定 (estimated) |
|---|---|---|
| 出典 | Anthropic Admin API `/v1/organizations/cost_report` | `fermentation_results` の保存トークン × 価格表 |
| 正確さ | **正**。実際に課金された額 | 近似。キャッシュ読み書き・値引き・課金丸めを反映しない |
| 粒度 | UTC 日バケット固定（`bucket_width=1d` のみ） | 任意の期間・**ユーザー別**・発酵単位 |
| ユーザー別 | **不可**（Anthropic は Oryzae のユーザーを知らない） | 可能。これが推定を残す唯一の理由 |
| 実装 | `shared/infrastructure/anthropic-cost-api.ts` | `shared/infrastructure/fermentation-cost-query.ts` + `claude-pricing.ts` |

原則:

- **金額を出す画面・通知では、それが実額か推定かを必ず明示する。**
- **取得できないときに `$0` を表示しない。** `ActualCostResult` は
  `ok` / `not-configured` / `error` のユニオンで返す。null や 0 に潰すと
  「未設定」を「$0」と誤読させる（issue #490 で報告された症状そのもの）。
- **日次レポートは JST 日**（発酵 cron が JST 03:00 に走るため）。
  実額は UTC 日でしか取れないので、`utcDateKeyOfJstFermentationRun()` で
  対応 UTC 日を求め、表示に「UTC」と明記する。
- 価格表 (`claude-pricing.ts`) は `vercel-ai-analysis.gateway.ts` のモデルと
  対で管理する。モデルを変えたら価格も変える。

### 既知の限界

- リトライ (`retryOf`) は同じ行を再利用するため、前回試行ぶんのトークンは上書きされる。
  実額との乖離要因になる（`/observability/spend` の乖離率で観測できる）。
- `cost_report` は Priority Tier のコストを含まない（Oryzae は standard のみ利用）。
- 反映ラグは通常5分程度。直近の利用は実額に載らないことがある。

## ツール追加時の手順

1. `.env.example` に環境変数を追加（カテゴリコメント付き）
2. 未設定時に graceful skip するコードを書く
3. admin の Observability ハブページにカードを追加
4. 必要なら詳細サブページを作成
5. Vercel の環境変数に値を設定
