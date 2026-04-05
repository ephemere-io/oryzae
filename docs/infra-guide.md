# インフラガイド

Oryzae のデプロイ・インフラ構成の原則。

---

## システム構成

```
Client（将来）→ REST API (HTTPS) → Server (Vercel Serverless) → Supabase Cloud (PostgreSQL + Auth + RLS)
```

### なぜこの構成か

- **Vercel Serverless**: Hono アプリを API ルートとしてデプロイ。設定最小限で GitHub push → 自動デプロイ。将来の Next.js クライアントと同一プラットフォーム
- **Supabase Cloud**: DB・認証・RLS をマネージドで提供。Docker 不要でローカル開発も Supabase Cloud に直接接続

---

## デプロイの原則

- ローカル開発用とデプロイ用のエントリポイントを分離する（Hono アプリ定義は共通）
- 環境変数でサービス接続先を切り替える（コードに接続先を埋め込まない）
- DB マイグレーションは SQL ファイルで管理し、Supabase MCP または SQL Editor で適用する

### 環境変数

| 変数名 | 用途 |
| --- | --- |
| `SUPABASE_URL` | Supabase プロジェクト URL |
| `SUPABASE_ANON_KEY` | クライアント認証用キー |
| `SUPABASE_SERVICE_ROLE_KEY` | サーバー管理用キー |

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
pnpm --filter @oryzae/server dev
```

Docker 不要。Supabase Cloud に直接接続して開発する。
