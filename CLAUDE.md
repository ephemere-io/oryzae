# Oryzae

ジャーナリング支援アプリのバックエンド。

## Quick Commands

```bash
pnpm install              # 依存インストール
pnpm --filter @oryzae/server dev        # 開発サーバー起動
pnpm --filter @oryzae/server typecheck  # 型チェック
pnpm --filter @oryzae/server test       # テスト実行
```

## Architecture

レイヤードアーキテクチャ: `presentation → application → domain ← infrastructure`

- domain は何にも依存しない（最内層）
- infrastructure は domain の gateway IF を実装する（依存性逆転）
- `--no-verify` は原則禁止

## Directory

```
apps/server/src/contexts/
  entry/           # エントリ管理コンテキスト
    presentation/  # HTTP ↔ ユースケース変換
    application/   # ユースケース（1ファイル = 1ユースケース）
    domain/        # ビジネスルール（models, services, gateways）
    infrastructure/ # Supabase 実装
  shared/          # コンテキスト間共有
```

## Design Docs

- `OryzaeArchitecture-2.md` — サーバーアーキテクチャ（正）
- `EditorAPIInterfaceDesign.md` — 型設計（Base Entry / Editor Extension）
