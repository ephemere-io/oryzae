---
name: plan
description: "設計ドキュメントを作成してから実装に進む。新機能、API、Bounded Context の追加時に使う。"
argument-hint: "[機能の説明]"
disable-model-invocation: true
allowed-tools: "Bash(date) Read Write Glob Grep Agent WebFetch WebSearch"
---

# Plan: 設計ドキュメント作成

## やること

1. ユーザーの要望から「なぜ（Why）」を明確にする。不明なら質問する
2. **`docs/OryzaeArchitecture.md`** を読んでアーキテクチャを確認する
3. 必要に応じて `docs/archive/` 配下の過去の設計指示書も参照する
4. 設計ドキュメントを `docs/tasks/` に作成する
   - ファイル名: `YYYYMMDD_HHMM_{description}.md`（日付は `date` コマンドで取得）
   - 内容: 目的、影響範囲、ディレクトリ構成、ドメインモデル、API、DB 変更、実装手順
5. `docs/OryzaeArchitecture.md` との整合性を確認する
6. **ユーザーの承認を得るまで実装に着手しない**
