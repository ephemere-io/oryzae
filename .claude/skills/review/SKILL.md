---
name: review
description: "現在の変更に対して設計レビューを行う。PR 作成前やコード変更後に使う。アーキテクチャ違反、レイヤー依存、型安全性、テスト有無を検査する。コードレビュー、設計レビュー、品質チェックを求められた時にも使う。"
disable-model-invocation: true
allowed-tools: "Bash(git,pnpm) Read Glob Grep Agent"
---

# Review: 設計レビュー

## 現在の状況

- ブランチ: !`git branch --show-current`
- 変更ファイル: !`git diff --name-only HEAD~1 2>/dev/null || git diff --name-only --cached 2>/dev/null || git diff --name-only`

## 手順

### 1. 変更内容の把握

`git diff` で変更ファイルの差分を取得する。必要に応じて関連ファイルも読み込む。

### 2. ガイドラインの参照

変更対象に応じて以下のガイドラインを読み込む:

**サーバー（`apps/server/`）:**
- **`docs/backend-architecture-guide.md`** — レイヤー依存、ドメインモデル、エラーハンドリング
- **`docs/entry-backend-guide.md`** — Entry コンテキスト
- **`docs/question-backend-guide.md`** — Question コンテキスト
- **`docs/backend-testing-guide.md`** — テスト戦略

**クライアント（`apps/client/`）:**
- **`docs/client-architecture-guide.md`** — Feature-Sliced 構造、データフェッチング、型安全性
- **`docs/client-testing-guide.md`** — フロントエンドテスト戦略

**共有・インフラ:**
- **`docs/shared-package-guide.md`** — `@oryzae/shared` の使用ルール
- **`docs/infra-guide.md`** — Vercel デプロイ

### 3. レビュー実施

#### サーバー（`apps/server/` 配下の変更）

- **A. レイヤー依存**: domain → 他層の依存がないか、application → infrastructure がないか
- **B. ドメインモデル**: リッチクラスパターン（create/fromProps/withXxx/toProps）に従っているか
- **C. エラーハンドリング**: domain は Result、application は throw、presentation は errorHandler
- **D. ゲートウェイ**: IF が class インスタンスを受け渡し、infrastructure が toProps/fromProps で変換
- **E. ユースケース**: 1 ファイル = 1 ユースケース、コンストラクタ DI
- **F. プレゼンテーション**: Zod バリデーション、DI がルートファイル内で完結
- **G. テスト（必須）**: domain/models, domain/services の全ファイルにテストが存在するか
- **H. `@oryzae/shared`**: domain 層から import していないか

#### クライアント（`apps/client/` 配下の変更）

- **I. Feature 隔離**: features/X → features/Y の依存がないか
- **J. データフェッチング**: API 呼び出しが hooks に集約されているか（コンポーネントから直接呼んでいないか）
- **K. 型安全性**: `as` キャストがないか（あれば `// @type-assertion-allowed` コメント付きか）、`any` がないか
- **L. hooks テスト（必須）**: `features/*/hooks/` の新規・変更ファイルに対応テストがあるか
- **M. インポート**: `lib/` が `features/` や `app/` に依存していないか
- **N. app/ の責務**: page.tsx や layout.tsx が直接 API を呼んでいないか

#### 共通

- **O. 命名規則**: ファイル命名規則に従っているか
- **P. コード品質**: 未使用 export、`any` 型、`console.log`
- **Q. `--no-verify`**: 使用されていないか

### 4. ツールによる自動検証

```bash
pnpm typecheck    # 型チェック
pnpm lint         # Biome lint
pnpm test         # テスト（server 85 + client 19）
pnpm dep-cruise   # レイヤー依存違反 + feature 隔離
pnpm knip         # 未使用コード
```

### 5. 結果報告

```
## レビュー結果

### ✅ 良い点
### 💡 改善提案 — [ファイル名:行番号] 問題 + 提案
### ❌ 要修正 — [ファイル名:行番号] 問題 + 理由 + 修正案

### 🔧 自動検証結果
- typecheck / lint / test / dep-cruise / knip: ✅ or ❌
```
