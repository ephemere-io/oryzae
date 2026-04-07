# Oryzae

ジャーナリング支援アプリ。問いを育て、振り返りを通じて思考を深める。

## Tech Stack

| 層 | 技術 |
|---|---|
| Backend | Hono + TypeScript (DDD layered architecture) |
| Frontend | Next.js + Tailwind CSS (Feature-Sliced Architecture) |
| Database | Supabase (PostgreSQL + Auth + RLS) |
| Shared | Zod schemas + constants (`packages/shared`) |
| Deploy | Vercel |
| Monorepo | pnpm workspaces |

## Getting Started

```bash
pnpm install
cp apps/server/.env.example apps/server/.env  # Supabase のキーを設定

# shared → server をビルドしてから client を起動
pnpm --filter @oryzae/shared build
pnpm --filter @oryzae/server build
pnpm --filter @oryzae/client dev
```

`http://localhost:3001` でフロントエンドと API の両方にアクセスできます。Hono API は Next.js Route Handler に内蔵されているため、サーバーを別途起動する必要はありません。

## Quality Checks

```bash
pnpm typecheck   # TypeScript strict mode (server + shared + client)
pnpm lint        # Biome (format + lint)
pnpm test        # Vitest (server + client)
pnpm dep-cruise  # Architecture dependency rules (server + client)
pnpm knip        # Dead code detection
```

Git hooks (pre-commit / pre-push) で自動実行されます。`--no-verify` は禁止です。

## Project Structure

```
apps/
  server/         # Hono backend (@oryzae/server)
  client/         # Next.js frontend (@oryzae/client)
packages/
  shared/         # Shared Zod schemas & constants (@oryzae/shared)
docs/             # Design docs (Single Source of Truth)
```

## Design Docs

設計判断の正はすべて `docs/` 配下にあります。

| ドキュメント | 内容 |
|---|---|
| `docs/backend-architecture-guide.md` | DDD レイヤー依存、ドメインモデル、エラー処理 |
| `docs/backend-testing-guide.md` | バックエンドテスト戦略、ガードレール |
| `docs/client-architecture-guide.md` | Feature-Sliced 構造、インポートルール |
| `docs/client-testing-guide.md` | フロントエンドテスト戦略 |
| `docs/shared-package-guide.md` | `@oryzae/shared` の使用ルール |
| `docs/entry-backend-guide.md` | Entry コンテキスト実装ガイド |
| `docs/question-backend-guide.md` | Question コンテキスト実装ガイド |
| `docs/infra-guide.md` | Vercel + Supabase デプロイ |
