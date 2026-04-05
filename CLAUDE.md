# Oryzae

ジャーナリング支援アプリ（バックエンド + フロントエンド）。

設計・実装で迷ったら以下を思想の拠り所にすること:
- [video-processor](https://github.com/team-mirai-volunteer/video-processor/tree/develop) — 参考実装（DDD + レイヤードアーキテクチャ）
- [超並列LLMコーディングのハーネスエンジニアリング](https://note.com/jujunjun110/n/n66306cab294a) — ガードレール・並列開発の設計思想

## Commands

```bash
pnpm install                                # 依存インストール
pnpm --filter @oryzae/server dev            # バックエンド起動 (port 3000)
pnpm --filter @oryzae/client dev            # フロントエンド起動 (port 3001)
pnpm typecheck                              # 型チェック（server + shared + client）
pnpm test                                   # テスト実行（server + client）
pnpm lint                                   # Biome lint
pnpm dep-cruise                             # アーキテクチャ依存チェック（server + client）
pnpm knip                                   # デッドコード検出
```

## Architecture

### Backend (`apps/server`)

`presentation → application → domain ← infrastructure`

- domain は何にも依存しない（最内層）
- ドメインモデルはリッチクラス（private constructor + create/fromProps/withXxx/toProps）
- domain: Result<T,E> で返す（throw 禁止）→ application: throw に変換
- 1 ユースケース = 1 ファイル

### Frontend (`apps/client`)

Feature-Sliced Architecture:

- `app/` — Next.js ページ（薄いラッパー、API 呼び出し禁止）
- `features/` — 機能スライス（components, hooks, types）
- `components/ui/` — 汎用 UI（feature 依存禁止）
- `lib/` — 横断ユーティリティ

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
