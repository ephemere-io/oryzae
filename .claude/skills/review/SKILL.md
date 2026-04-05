---
name: review
description: "現在の変更に対して設計レビューを行う。PR 作成前やコード変更後に使う。アーキテクチャ違反、レイヤー依存、ドメインモデルパターン、エラーハンドリング、命名規則、テスト有無を検査する。コードレビュー、設計レビュー、品質チェックを求められた時にも使う。"
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

- `apps/server/` 配下の変更 → **`docs/backend-architecture-guide.md`** を読む
- `apps/server/src/contexts/entry/` 配下 → 追加で **`docs/entry-backend-guide.md`** を読む
- `apps/server/src/contexts/question/` 配下 → 追加で **`docs/question-backend-guide.md`** を読む
- テスト・ガードレール関連 → **`docs/backend-testing-guide.md`** を読む
- デプロイ・インフラ関連 → **`docs/infra-guide.md`** を読む

### 3. レビュー実施

ガイドラインに照らして以下の観点でレビューする:

- **A. レイヤー依存**: domain → 他層の依存がないか、application → infrastructure がないか
- **B. ドメインモデル**: リッチクラスパターン（create/fromProps/withXxx/toProps）に従っているか
- **C. エラーハンドリング**: domain は Result、application は throw、presentation は errorHandler
- **D. ゲートウェイ**: IF が class インスタンスを受け渡し、infrastructure が toProps/fromProps で変換
- **E. ユースケース**: 1 ファイル = 1 ユースケース、コンストラクタ DI、toProps でレスポンス
- **F. プレゼンテーション**: Zod バリデーション、DI がルートファイル内で完結
- **G. 命名規則**: ファイル命名規則に従っているか
- **H. テスト（必須）**: 以下を全て満たしているか確認する
  - domain/models/ の各ファイルに対応する `.test.ts` が存在するか（**必須**）
  - domain/services/ の各ファイルに対応する `.test.ts` が存在するか（**必須**）
  - create() のバリデーション境界値（成功・各エラーパターン）をテストしているか
  - Result<T,E> の success / error 両方のケースをカバーしているか
  - withXxx() のイミュータブル性（元インスタンスが変更されないこと）をテストしているか
  - fromProps → toProps のラウンドトリップをテストしているか
  - テストファイルがない domain model/service がある場合は **❌ 要修正** として報告する
- **I. コード品質**: 未使用 export、any 型、console.log

### 4. ツールによる自動検証

```bash
pnpm dep-cruise   # レイヤー依存違反
pnpm knip         # 未使用コード
pnpm lint         # Biome lint
pnpm typecheck    # 型チェック
pnpm test         # テスト
```

### 5. 結果報告

```
## レビュー結果

### ✅ 良い点
### 💡 改善提案 — [ファイル名:行番号] 問題 + 提案
### ❌ 要修正 — [ファイル名:行番号] 問題 + 理由 + 修正案

### 🔧 自動検証結果
- dep-cruise / knip / lint / typecheck / test: ✅ or ❌
```
