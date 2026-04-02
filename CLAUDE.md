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
- ドメインモデルはリッチクラス（private constructor + create/fromProps/withXxx/toProps）
- `--no-verify` は原則禁止

## Directory

```
apps/server/src/contexts/
  entry/           # エントリ管理コンテキスト
    presentation/  # HTTP ↔ ユースケース変換 + DI 組み立て
    application/   # ユースケース（1ファイル = 1ユースケース）
    domain/        # ビジネスルール（models, services, gateways）
    infrastructure/ # Supabase 実装
  shared/          # コンテキスト間共有
    domain/types/  # Result<T, E> 型
    application/errors/ # ApplicationError 基底クラス
```

## Error Handling

- domain 層: `Result<T, E>` 型（`{ success, value/error }`）で戻り値表現（throw 禁止）
- application 層: Result を受け取り、失敗なら `ApplicationError` 継承クラスを throw
- infrastructure 層: 外部エラーをそのまま throw
- presentation 層: `errorHandler` で `ApplicationError.statusCode` → HTTP レスポンスに変換

## Design Docs

- `OryzaeArchitecture.md` — サーバーアーキテクチャ（正）
- `EditorAPIInterfaceDesign.md` — 型設計（Base Entry / Editor Extension）
