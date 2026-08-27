# Oryzae

ジャーナリング支援アプリ（バックエンド + フロントエンド）。

設計・実装で迷ったら以下を思想の拠り所にすること:
- [video-processor](https://github.com/team-mirai-volunteer/video-processor/tree/develop) — 参考実装（DDD + レイヤードアーキテクチャ）
- [超並列LLMコーディングのハーネスエンジニアリング](https://note.com/jujunjun110/n/n66306cab294a) — ガードレール・並列開発の設計思想

## Commands

```bash
pnpm install                                # 依存インストール
pnpm --filter @oryzae/client dev            # クライアント起動 (port 3000, API 内蔵)
pnpm --filter @oryzae/admin dev             # 管理画面起動 (port 3001, API 内蔵)
pnpm typecheck                              # 型チェック（server + shared + client + admin）
pnpm test                                   # テスト実行（server + client + admin）
pnpm lint                                   # Biome lint
pnpm dep-cruise                             # アーキテクチャ依存チェック（server + client + admin）
pnpm knip                                   # デッドコード検出
```

## Architecture

### Backend (`apps/server`)

`presentation → application → domain ← infrastructure`

- domain は何にも依存しない（最内層）
- ドメインモデルはリッチクラス（private constructor + create/fromProps/withXxx/toProps）
- domain: Result<T,E> で返す（throw 禁止）→ application: throw に変換
- 1 ユースケース = 1 ファイル

### Frontend (`apps/client`, `apps/admin`)

両アプリとも Feature-Sliced Architecture を採用:

- `app/` — Next.js ページ（薄いラッパー、API 呼び出し禁止、端末判定）
- `features/` — 機能スライス
  - `apps/client` は **ドメイン × reach**: `features/{shared,pc,sp}/{domain}`（shared=UIなし共有hook/型、pc/sp=端末別UI）
    - reach は「端末で体験が変わる機能」だけに適用する。端末非依存の機能（`auth` / `onboarding`）は
      `features/{domain}/` のフラットなまま置く。フラット機能どうしの直接 import は禁止、`features/shared` のみ可
  - `apps/admin` は単一体験で `features/{domain}`（reach 軸なし）
- `components/ui/` — 汎用 UI（feature 依存禁止）
- `lib/` — 基盤ユーティリティのみ（ドメイン非依存。`use-*` のドメイン hook を置かない）

`apps/client` はユーザー向け（port 3000）、`apps/admin` は管理画面（port 3001）。
device（端末）はフロントだけの軸で `apps/client` のみ reach を持つ。backend・`packages/shared` は端末非依存。
ガードレール・テスト戦略は共通。詳細は `docs/client-architecture-guide.md`。

### Shared (`packages/shared`)

- Zod バリデーションスキーマと定数のみ配置
- ドメインロジック・ドメイン型は禁止
- サーバー domain 層からの import 禁止

### 共通ルール

- `--no-verify` 禁止
- `any` 型禁止
- `as` キャスト禁止（CI で検出。例外は `// @type-assertion-allowed: <理由>` を前行に記載）

## Design Docs (SSoT)

設計判断の正はすべて `docs/` 配下にある。実装前に必ず該当ドキュメントを確認すること。一覧は `README.md` を参照。
