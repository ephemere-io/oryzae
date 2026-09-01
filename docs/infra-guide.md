# インフラガイド

Oryzae のデプロイ・インフラ構成の原則。

---

## システム構成

```
Browser → Next.js (same origin) → Hono (internal app.fetch()) → Supabase Cloud (PostgreSQL + Auth + RLS)
```

### アプリケーション

| アプリ | URL | Vercel プロジェクト | リポジトリ | 用途 |
|---|---|---|---|---|
| client | https://oryzae.ephemere.io | oryzae-client | ephemere-io/oryzae | ユーザー向け（要ログイン） |
| admin | https://oryzae-admin.vercel.app | oryzae-admin | ephemere-io/oryzae | 管理画面・Observability |
| docs | https://docs.oryzae.ephemere.io | oryzae-docs | **ephemere-io/oryzae-docs** | 公開サイト（LP・/support・/privacy） |

**公開サイトは別リポジトリ・別ドメイン。** ログインしていない人が見るものだけを分離してある。
認証もデータベースも持たず、設計ドキュメント（`docs/`）もこのリポジトリに残る。

### なぜこの構成か

- **単一 Vercel デプロイ**: Next.js App Router の Route Handler (`app/api/[...path]/route.ts`) が Hono アプリを内部で `app.fetch()` 呼び出しする。サーバー・クライアントを同一デプロイメントに統合
- **アプリ内は CORS 不要**: ブラウザと API が同一オリジンのため、通常の API 呼び出しに CORS 設定は要らない
- **Supabase Cloud**: DB・認証・RLS をマネージドで提供。Docker 不要でローカル開発も Supabase Cloud に直接接続

### 公開サイトとの境界（切れていない線）

ドメインを分けても、次の3点はまたいだままなので設定を落とすと壊れる。

1. **CORS はこの 1 本だけ開いている** — 公開サイトの LP が登録枠バッジのために
   `GET /api/v1/auth/signup/availability` をクロスオリジンで叩く。
   `contexts/shared/presentation/middleware/public-cors.ts` がこのエンドポイントに限って
   許可する。**`/api/v1/*` 全体に広げてはならない**（認証済み API まで別オリジンから叩ける）。
   許可オリジンは `PUBLIC_SITE_ORIGINS`（カンマ区切り、既定は本番の公開サイト）。
2. **Supabase のメール確認リダイレクトの着地点はアプリ側 `/`** — hash のトークンは
   サーバーに送られないため、`features/auth/components/home-gate.tsx` が受ける。
   Supabase 側の Redirect URL 設定は分割前から変えていない。
3. **旧 URL の 301** — `/privacy` と `/support` は App Store の審査情報やメール文面から
   参照されている。`apps/client/next.config.ts` の `redirects()` が公開サイトへ恒久転送する。
   公開サイトのドメインが立つ**前に**この転送を本番へ出すと、参照が切れる。

相互リンクは必ず絶対 URL にする。アプリ側は `lib/docs-site.ts` の `docsHref()`、
公開サイト側は `lib/app-url.ts` の `appHref()` を通す。

---

## Vercel 設定

client と admin で別プロジェクト。ビルド順序: shared → server → 各アプリ。

### 環境変数

各 `.env.example` を参照。カテゴリ:

| カテゴリ | 変数 | 用途 |
|---|---|---|
| Supabase | `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | DB・認証 |
| AI | `ANTHROPIC_API_KEY` | fermentation の LLM 呼び出し（Anthropic API 直叩き、issue #352） |
| AI | `ANTHROPIC_ADMIN_KEY` | 実請求額の取得（Admin API `cost_report`）。コスト日次レポート・admin Spend 画面。org 管理者のみ発行可。未設定でも動作（推定のみになる） |
| AI | `AI_GATEWAY_API_KEY` | #352 以前の `generation_id` レコードを `/costs` 一覧で解決するフォールバックのみ |
| PostHog | `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST`, `POSTHOG_PERSONAL_API_KEY` | ユーザー行動分析 |
| Sentry | `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_DSN`, `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` | エラー監視 |
| Upstash | `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | API レート制限 |
| Vercel | `VERCEL_TOKEN` | admin Observability でデプロイ状態取得 |
| 公開サイト | `NEXT_PUBLIC_DOCS_SITE_URL` | 公開サイトへの導線・旧 URL の 301 転送先（既定: 本番ドメイン） |
| 公開サイト | `PUBLIC_SITE_ORIGINS` | 登録枠 API の CORS 許可オリジン（カンマ区切り。既定: 本番の公開サイト） |

全監視系の環境変数はオプション。未設定でもアプリは正常に動作する。
公開サイト系の 2 つも既定値が本番を指すため、本番では未設定でよい。
Vercel プレビュー同士でつなぐときだけ明示する。

---

## デプロイの原則

- GitHub push → Vercel 自動デプロイ（設定最小限）
- 環境変数でサービス接続先を切り替える（コードに接続先を埋め込まない）
- DB マイグレーションは SQL ファイルで管理し、Supabase MCP または SQL Editor で適用する

---

## マイグレーション運用

- `supabase/migrations/` に `{連番}_{説明}.sql` で格納
- DDL（テーブル作成・変更）のみ。データ投入は含めない
- RLS ポリシーはマイグレーションに含める
- 適用は Supabase MCP (`apply_migration`) または SQL Editor

---

## ローカル開発

```bash
pnpm install
cp apps/server/.env.example apps/server/.env
cp apps/client/.env.example apps/client/.env
cp apps/admin/.env.example apps/admin/.env
# 各 .env にキーを設定

pnpm --filter @oryzae/shared build && pnpm --filter @oryzae/server build
pnpm --filter @oryzae/client dev    # port 3000
pnpm --filter @oryzae/admin dev     # port 3001
```

Docker 不要。Supabase Cloud に直接接続して開発する。
