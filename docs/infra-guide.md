# インフラガイド

Oryzae のデプロイ・インフラ構成。

---

## システム構成

```
┌─────────────────────────────────────────────────┐
│  Client Layer（将来）                            │
│  Web(Next.js) / macOS(RN) / iOS(Expo)           │
└───────────────────────┬─────────────────────────┘
                        │ REST API (HTTPS)
┌───────────────────────┴─────────────────────────┐
│  Server Layer                                    │
│  Hono on Vercel Serverless Functions             │
└───────────────────────┬─────────────────────────┘
                        │
┌───────────────────────┴─────────────────────────┐
│  Supabase Cloud                                  │
│  PostgreSQL + Auth + RLS + Storage               │
└──────────────────────────────────────────────────┘
```

---

## Vercel デプロイ

### エントリポイント

```
apps/server/
├── src/app.ts       ← Hono アプリ定義（ローカル・Vercel 共通）
├── src/index.ts     ← ローカル開発用（@hono/node-server）
├── api/index.ts     ← Vercel Serverless Function エントリポイント
└── vercel.json      ← 全リクエストを /api に rewrite
```

### Vercel 設定

1. GitHub リポジトリを Vercel に接続
2. **Root Directory**: `apps/server`
3. **Build Command**: なし（Vercel が自動ビルド）
4. **Output Directory**: なし（api/ が自動検出）

### 環境変数

| 変数名 | 説明 |
| --- | --- |
| `SUPABASE_URL` | Supabase プロジェクト URL |
| `SUPABASE_ANON_KEY` | Supabase anon key（レガシー JWT 形式） |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key |

---

## Supabase

### プロジェクト

- ダッシュボード: https://supabase.com/dashboard
- Auth: メール + パスワード（Confirm email OFF で開発）
- RLS: 全テーブル有効

### マイグレーション

`supabase/migrations/` に SQL ファイルを格納。命名: `{連番}_{説明}.sql`

```
supabase/migrations/
├── 00001_create_entries.sql
└── 00002_create_questions.sql
```

Supabase MCP または SQL Editor で実行。

---

## ローカル開発

```bash
pnpm install                           # 依存インストール
cp apps/server/.env.example apps/server/.env  # 環境変数設定
pnpm --filter @oryzae/server dev       # http://localhost:3000
```

`.env` に Supabase Cloud のキーを設定する。Docker 不要。
