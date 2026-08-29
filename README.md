# Oryzae

ジャーナリング支援アプリ。問いを育て、振り返りを通じて思考を深める。

## Tech Stack

| 層 | 技術 |
|---|---|
| Backend | Hono + TypeScript (DDD layered architecture) |
| Frontend | Next.js + Tailwind CSS (Feature-Sliced Architecture) |
| Admin | Next.js + shadcn/ui (管理画面・Observability) |
| Database | Supabase (PostgreSQL + Auth + RLS) |
| Shared | Zod schemas + constants (`packages/shared`) |
| Deploy | Vercel |
| Monorepo | pnpm workspaces |

## Getting Started

```bash
pnpm install
cp .env.example .env  # ルートの .env にキーを設定（各アプリはシンボリックリンクで共有）

# shared → server をビルドしてから起動
pnpm --filter @oryzae/shared build
pnpm --filter @oryzae/server build
pnpm --filter @oryzae/client dev    # ユーザー向け (port 3000)
pnpm --filter @oryzae/admin dev     # 管理画面 (port 3001)
```

Hono API は Next.js Route Handler に内蔵されているため、サーバーを別途起動する必要はありません。

## Quality Checks

```bash
pnpm typecheck   # TypeScript strict mode (server + shared + client + admin)
pnpm lint        # Biome (format + lint)
pnpm test        # Vitest (server + client + admin)
pnpm dep-cruise  # Architecture dependency rules (server + client + admin)
pnpm knip        # Dead code detection
pnpm check:as    # `as` 型アサーション禁止（例外は @type-assertion-allowed で明示）
```

Git hooks (pre-commit / pre-push) で自動実行されます。`--no-verify` は禁止です。

## Project Structure

```
apps/
  server/         # Hono backend (@oryzae/server)
  client/         # Next.js frontend (@oryzae/client)
  admin/          # Next.js admin dashboard (@oryzae/admin)
packages/
  shared/         # Shared Zod schemas & constants (@oryzae/shared)
  verify/         # 検証ハーネスのランタイム（@oryzae/verify）
scripts/          # リポジトリ共通のガードレール（as キャスト検出など）
docs/             # Design docs (Single Source of Truth)
supabase/
  migrations/     # DB migration SQL files
```

### Backend structure (`apps/server`)

`apps/server` は **境界づけられたコンテキスト × DDD レイヤード**。依存は内向き（`presentation → application → domain ← infrastructure`、domain は何にも依存しない）。

```
apps/server/src/
  contexts/                # 境界づけられたコンテキスト
    {context}/             # 1 コンテキスト = 4 レイヤー
      presentation/        #   HTTP(Hono) ルート・入出力
      application/         #   ユースケース（1 ファイル = 1 ユースケース）
      domain/              #   ドメインモデル（最内層・何にも依存しない）
      infrastructure/      #   DB・外部アクセス（domain の実装）
```

配置・依存ルールの詳細は `docs/backend-architecture-guide.md`（SSoT）を参照。

### Frontend structure (`apps/client`)

`apps/client` は機能を **ドメイン × reach（shared/pc/sp）** で薄切りする（device はフロントだけの軸）。

```
apps/client/src/
  app/                     # ルーティング（端末非依存・薄いラッパー）
    (auth)/ (protected)/   #   認証境界。(protected)/layout.tsx で端末(PC/SP)を出し分け
    api/[...path]/         #   Hono への転送（変更しない）
  features/                # 機能スライス: ドメイン × reach
    shared/{domain}/       #   端末非依存のロジック（全 fetch・全ドメイン型・UI なし）
      hooks/               #     データ取得・保存（use-*）
      types.ts             #     ドメイン共有型
    pc/{domain}/           #   PC 体験
      components/  hooks/   #     PC 固有の UI・操作・演出（fetch は持たない）
    sp/{domain}/           #   SP 体験
      components/  hooks/   #     SP 固有の UI（縦長・片手・音声）
  features/{domain}/        # 端末非依存の UI はフラット（auth / landing / onboarding）
  components/              # ドメイン非依存 UI・seam(device-view)・provider
    ui/                    #   汎用 UI（feature 非依存）
  lib/                     # 基盤ユーティリティ（ドメイン非依存）
```

reach（pc/sp）は端末で体験が変わる機能だけに適用し、端末非依存の UI はフラットに置く。
**fetch とドメイン型は、片端末しか使っていなくても必ず `features/shared/{domain}` に置く**
（`pc` に置くと SP 追加時にコピーが発生するため。Issue #490）。
`apps/admin` は単一体験のため reach を持たず `features/{domain}` で薄切りする。
配置の決定木・インポートルールなど詳細は `docs/client-architecture-guide.md`（SSoT）を参照。

## Design Docs

設計判断の正はすべて `docs/` 配下にあります。

| ドキュメント | 内容 |
|---|---|
| `docs/backend-architecture-guide.md` | DDD レイヤー依存、ドメインモデル、エラー処理 |
| `docs/backend-testing-guide.md` | バックエンドテスト戦略、ガードレール |
| `docs/client-architecture-guide.md` | Feature-Sliced 構造（ドメイン × reach: shared/pc/sp）、インポートルール、端末出し分け |
| `docs/client-testing-guide.md` | フロントエンドテスト戦略 |
| `docs/shared-package-guide.md` | `@oryzae/shared` の使用ルール |
| `docs/entry-backend-guide.md` | Entry コンテキスト実装ガイド |
| `docs/question-backend-guide.md` | Question コンテキスト実装ガイド |
| `docs/infra-guide.md` | Vercel + Supabase デプロイ |
| `docs/observability-guide.md` | 監視・可観測性の方針 |
| `docs/i18n-guide.md` | apps/client の日英バイリンガル運用（next-intl + Google Sheets SSoT） |
