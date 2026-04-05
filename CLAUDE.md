# Oryzae

ジャーナリング支援アプリのバックエンド。

## Commands

```bash
pnpm install                                # 依存インストール
pnpm --filter @oryzae/server dev            # 開発サーバー起動
pnpm typecheck                              # 型チェック
pnpm test                                   # テスト実行
pnpm lint                                   # Biome lint
pnpm dep-cruise                             # DDD レイヤー依存チェック
pnpm knip                                   # デッドコード検出
```

## Architecture

`presentation → application → domain ← infrastructure`

- domain は何にも依存しない（最内層）
- ドメインモデルはリッチクラス（private constructor + create/fromProps/withXxx/toProps）
- domain: Result<T,E> で返す（throw 禁止）→ application: throw に変換
- 1 ユースケース = 1 ファイル
- `--no-verify` 禁止

## Design Docs (SSoT)

設計判断の正はすべて `docs/` 配下にある。

| ドキュメント | 内容 |
| --- | --- |
| `docs/backend-architecture-guide.md` | レイヤー依存、ドメインモデル、エラー処理、命名規則 |
| `docs/backend-testing-guide.md` | テスト戦略、ガードレール、CI |
| `docs/entry-backend-guide.md` | Entry コンテキスト実装ガイド |
| `docs/question-backend-guide.md` | Question コンテキスト実装ガイド |
| `docs/infra-guide.md` | Vercel + Supabase デプロイ |
| `docs/archive/` | 過去の設計指示書 |
