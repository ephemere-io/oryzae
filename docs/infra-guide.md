# インフラガイド

Oryzae のデプロイ・インフラ構成の原則。

---

## システム構成

```
ブラウザ → Next.js (Vercel)
            ├── /login, /entries, /questions  (フロントエンド)
            └── /api/v1/*, /health            (Hono API, 内部実行)
                    ↓
              Supabase Cloud (PostgreSQL + Auth + RLS)
```

### なぜこの構成か

- **単一デプロイ**: Next.js の Route Handler に Hono アプリを埋め込み、フロントエンドと API を1つの Vercel プロジェクトでデプロイ。CORS 不要、環境変数もシンプル
- **Hono 内蔵**: `apps/client/src/app/api/[...path]/route.ts` が全 `/api/*` リクエストを Hono の `app.fetch()` に転送する。サーバーを別途デプロイする必要はない
- **Supabase Cloud**: DB・認証・RLS をマネージドで提供

---

## デプロイの原則

- ローカル開発用とデプロイ用のエントリポイントを分離する（Hono アプリ定義は共通）
- 環境変数でサービス接続先を切り替える（コードに接続先を埋め込まない）
- DB マイグレーションは SQL ファイルで管理し、Supabase MCP または SQL Editor で適用する

### 環境変数

| 変数名 | 用途 | 設定場所 |
| --- | --- | --- |
| `SUPABASE_URL` | Supabase プロジェクト URL | Vercel + ローカル `.env` |
| `SUPABASE_ANON_KEY` | クライアント認証用キー | Vercel + ローカル `.env` |
| `SUPABASE_SERVICE_ROLE_KEY` | サーバー管理用キー | Vercel + ローカル `.env` |

---

## Vercel デプロイ設定

| 項目 | 値 |
| --- | --- |
| Root Directory | `apps/client` |
| Framework | Next.js |
| Build Command | `vercel.json` で定義（shared → server → client の順にビルド） |
| Install Command | `vercel.json` で定義 |

ビルド時に `@oryzae/shared` と `@oryzae/server` を先にコンパイルし、Next.js が `dist/` の成果物をインポートする。

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
cp apps/server/.env.example apps/server/.env  # Supabase Cloud のキーを設定
pnpm --filter @oryzae/shared build             # shared パッケージをビルド
pnpm --filter @oryzae/server build             # server をビルド
pnpm --filter @oryzae/client dev               # Next.js 起動 (port 3001)
```

`localhost:3001` でフロントエンドと API の両方にアクセスできる。サーバーを別途起動する必要はない。

スタンドアロンのバックエンド開発時:

```bash
pnpm --filter @oryzae/server dev               # Hono 単体起動 (port 3000)
```
