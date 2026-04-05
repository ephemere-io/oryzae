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

変更対象に応じてアーキテクチャドキュメント（SSoT）を読み込む:

- `apps/server/` 配下の変更 → **`docs/OryzaeArchitecture.md`** を読む
  - セクション3: レイヤードアーキテクチャ（依存方向、各層の責務）
  - セクション4: ディレクトリ構成、ファイル命名規則
  - セクション5: ドメインモデルパターン（create/fromProps/withXxx/toProps）
  - セクション6: エラーハンドリング（Result → throw → HTTP 変換）
  - セクション9: ガードレール（テスト方針、コーディング規約）
- 新しい Bounded Context の追加 → セクション12: 将来のコンテキスト拡張

### 3. レビュー実施

`docs/OryzaeArchitecture.md` の各セクションに照らし、以下の観点でレビューする。

#### A. レイヤー依存（セクション3.1, 3.4 参照）
- domain → application/infrastructure/presentation への依存がないか
- application → infrastructure への直接依存がないか
- コンテキスト間の直接依存がないか（shared 経由のみ許容）

#### B. ドメインモデル（セクション5 参照）
- private constructor + create/fromProps/withXxx/toProps パターンに従っているか
- domain 層で throw していないか（Result<T, E> で返す）
- generateId が外部から注入されているか
- 全フィールドが readonly か
- エラー型がモデルごとの判別共用体 `{ type: string; message: string }` か

#### C. エラーハンドリング（セクション6 参照）
- domain: ok()/err() で Result を返しているか
- application: result.success を検査し ApplicationError 継承クラスを throw しているか
- エラークラスに statusCode があるか

#### D. ゲートウェイと依存性逆転（セクション5 参照）
- gateway IF が domain/gateways/ にあるか
- gateway IF が class インスタンスを受け渡ししているか（Props ではなく）
- infrastructure が toProps()/fromProps() で変換しているか

#### E. ユースケース（セクション3.2 参照）
- 1 ユースケース = 1 ファイルか
- コンストラクタで gateway IF + generateId を受け取っているか
- レスポンスが toProps() でプレーンオブジェクトに変換されているか

#### F. プレゼンテーション層（セクション3.2 参照）
- Zod でリクエストバリデーションしているか
- DI 組み立てがルートファイル内で完結しているか
- ビジネスロジックがルートファイルに漏れていないか

#### G. 命名規則（セクション4 参照）
- ファイル命名規則に従っているか

#### H. テスト（セクション9.2 参照）
- domain service にユニットテストがあるか
- Result の success/error 両方のケースをカバーしているか

#### I. コード品質（セクション9 参照）
- 未使用の export がないか
- any 型を使っていないか
- console.log が残っていないか

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
- ...

### 💡 改善提案
- [ファイル名:行番号] 問題の説明 + 提案

### ❌ 要修正
- [ファイル名:行番号] 問題の説明 + 理由 + 修正案

### 🔧 自動検証結果
- dep-cruise: ✅ / ❌
- knip: ✅ / ❌
- lint: ✅ / ❌
- typecheck: ✅ / ❌
- test: ✅ / ❌
```
