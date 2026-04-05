---
name: plan
description: "Create a design document before implementation. Use when starting a new feature, API, or bounded context."
argument-hint: "[feature description]"
disable-model-invocation: true
allowed-tools: "Bash(date) Read Write Glob Grep Agent WebFetch WebSearch"
---

# Plan: 設計ドキュメント作成

## やること

1. ユーザーの要望から「なぜ（Why）」を明確にする。不明なら質問する
2. 既存のアーキテクチャを確認する
   - `docs/OryzaeArchitecture.md` を読む
   - 関連する既存コンテキストのコードを調査する
3. 設計ドキュメントを `docs/tasks/` に作成する
   - ファイル名: `YYYYMMDD_HHMM_{description}.md`（日付は `date` コマンドで取得）
   - 内容: 目的、影響範囲、ディレクトリ構成、ドメインモデル、API エンドポイント、DB 変更、実装手順
4. アーキテクチャガイドとの整合性を確認する
5. **ユーザーの承認を得るまで実装に着手しない**

## 制約

- `docs/OryzaeArchitecture.md` のレイヤードアーキテクチャに従うこと
- ドメインモデルはリッチクラスパターン（private constructor / create / fromProps / withXxx / toProps）
- 1ユースケース = 1ファイル
