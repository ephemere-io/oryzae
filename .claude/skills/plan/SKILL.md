---
name: plan
description: "設計ドキュメントを作成してから実装に進む。新機能、API、UI、Bounded Context の追加時に使う。"
argument-hint: "[機能の説明]"
disable-model-invocation: true
allowed-tools: "Bash(date) Read Write Glob Grep Agent WebFetch WebSearch"
---

# Plan: 設計ドキュメント作成

## やること

1. ユーザーの要望から「なぜ（Why）」を明確にする。不明なら質問する
2. 以下のガイドラインを読んでアーキテクチャを確認する:

   **サーバー関連:**
   - **`docs/backend-architecture-guide.md`** — DDD レイヤー依存、ドメインモデル
   - 関連するコンテキストのガイド（`docs/entry-backend-guide.md` 等）

   **クライアント関連:**
   - **`docs/client-architecture-guide.md`** — Feature-Sliced 構造、データフェッチング
   - **`docs/client-testing-guide.md`** — フロントエンドテスト戦略

   **共有・インフラ:**
   - **`docs/shared-package-guide.md`** — `@oryzae/shared` の使用ルール
   - **`docs/infra-guide.md`** — Vercel デプロイ（Hono 内蔵 + 単一デプロイ）

3. 必要に応じて `docs/archive/` 配下の過去の設計指示書も参照する
4. 設計ドキュメントを `docs/tasks/` に作成する
   - ファイル名: `YYYYMMDD_HHMM_{description}.md`（日付は `date` コマンドで取得）
   - 内容: 目的、影響範囲、ディレクトリ構成、ドメインモデル/コンポーネント設計、API、DB 変更、実装手順
5. ガイドラインとの整合性を確認する
6. **ユーザーの承認を得るまで実装に着手しない**
