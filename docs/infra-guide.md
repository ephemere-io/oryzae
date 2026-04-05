# インフラガイド

Oryzae のデプロイ・インフラ構成の原則。

---

## システム構成

```
Browser → Next.js (same origin) → Hono (internal app.fetch()) → Supabase Cloud (PostgreSQL + Auth + RLS)
```

### なぜこの構成か

- **単一 Vercel デプロイ**: Next.js App Router の Route Handler (`app/api/[...path]/route.ts`) が Hono アプリを内部で `app.fetch()` 呼び出しする。サーバー・クライアントを同一デプロイメントに統合
- **CORS 不要**: ブラウザと API が同一オリジンのため、CORS 設定は不要
- **Supabase Cloud**: DB・認証・RLS をマネージドで提供。Docker 不要でローカル開発も Supabase Cloud に直接接続

---

## Vercel 設定

| 項目 | 値 |
| --- | --- |
| Root Directory | `apps/client` |
| Framework | Next.js |
| Build Command | `pnpm --filter @oryzae/shared build && pnpm --filter @oryzae/server build && pnpm --filter @oryzae/client build` |
| Install Command | `pnpm install --filter @oryzae/client...` |

ビルド順序: shared → server → client（`apps/client/vercel.json` で定義）。

### 環境変数

| 変数名 | 用途 |
| --- | --- |
| `SUPABASE_URL` | Supabase プロジェクト URL |
| `SUPABASE_ANON_KEY` | クライアント認証用キー |
| `SUPABASE_SERVICE_ROLE_KEY` | サーバー管理用キー |

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

### クライアント統合開発（推奨）

```bash
pnpm install
cp apps/server/.env.example apps/server/.env  # Supabase Cloud のキーを設定
pnpm --filter @oryzae/shared build && pnpm --filter @oryzae/server build && pnpm --filter @oryzae/client dev
```

Next.js dev server 上で API も動作する。ブラウザから `/api/v1/*` にアクセス可能。

### サーバー単体開発

```bash
pnpm --filter @oryzae/server dev
```

Hono アプリ単体で起動。API のみの開発・デバッグに使用。

Docker 不要。Supabase Cloud に直接接続して開発する。
