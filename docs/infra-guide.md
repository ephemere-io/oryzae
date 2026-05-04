# インフラガイド

Oryzae のデプロイ・インフラ構成の原則。

---

## システム構成

```
Browser → Next.js (same origin) → Hono (internal app.fetch()) → Supabase Cloud (PostgreSQL + Auth + RLS)
```

### アプリケーション

| アプリ | URL | Vercel プロジェクト | 用途 |
|---|---|---|---|
| client | https://oryzae-client.vercel.app | oryzae-client | ユーザー向け |
| admin | https://oryzae-admin.vercel.app | oryzae-admin | 管理画面・Observability |

### なぜこの構成か

- **単一 Vercel デプロイ**: Next.js App Router の Route Handler (`app/api/[...path]/route.ts`) が Hono アプリを内部で `app.fetch()` 呼び出しする。サーバー・クライアントを同一デプロイメントに統合
- **CORS 不要**: ブラウザと API が同一オリジンのため、CORS 設定は不要
- **Supabase Cloud**: DB・認証・RLS をマネージドで提供。Docker 不要でローカル開発も Supabase Cloud に直接接続

---

## Vercel 設定

client と admin で別プロジェクト。ビルド順序: shared → server → 各アプリ。

### 環境変数

各 `.env.example` を参照。カテゴリ:

| カテゴリ | 変数 | 用途 |
|---|---|---|
| Supabase | `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | DB・認証 |
| AI | `AI_GATEWAY_API_KEY` | Vercel AI Gateway 経由の LLM 呼び出し |
| PostHog | `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST`, `POSTHOG_PERSONAL_API_KEY` | ユーザー行動分析 |
| Sentry | `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_DSN`, `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` | エラー監視 |
| Upstash | `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | API レート制限 |
| Vercel | `VERCEL_TOKEN` | admin Observability でデプロイ状態取得 |

全監視系の環境変数はオプション。未設定でもアプリは正常に動作する。

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
