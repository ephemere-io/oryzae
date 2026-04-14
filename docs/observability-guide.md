# Observability ガイド

Oryzae の監視・可観測性の方針。「何をなぜ監視するか」を記述する。
具体的なツール設定やキーは `.env.example` とコードが正。

---

## 監視の関心事

| 関心事 | 問い | 判断基準 |
|---|---|---|
| **ユーザー行動** | ユーザーはプロダクトをどう使っているか | PV, セッション, 滞在時間, 導線 |
| **エラー** | 何が壊れているか | 例外の発生頻度, 影響ユーザー数, スタックトレース |
| **LLM コスト** | AI にいくらかかっているか | per-request トークン数, USD, ユーザー別集計 |
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
| `/observability/spend` | AI Gateway API | 日別コストチャート・ユーザー別集計・クレジット残高 |
| `/observability/deploys` | Vercel API | デプロイ一覧（状態, ビルド時間, コミットメッセージ） |
| `/costs` | AI Gateway API | per-request コスト詳細（レガシー、将来的に /observability/spend に統合） |

## ツール追加時の手順

1. `.env.example` に環境変数を追加（カテゴリコメント付き）
2. 未設定時に graceful skip するコードを書く
3. admin の Observability ハブページにカードを追加
4. 必要なら詳細サブページを作成
5. Vercel の環境変数に値を設定
