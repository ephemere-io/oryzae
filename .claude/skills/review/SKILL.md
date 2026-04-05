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

変更対象のパスに応じて、以下のリファレンスを読み込む:

- `apps/server/src/contexts/` 配下の変更 → `references/server-architecture.md` を読む
- 新しい Bounded Context の追加 → `docs/OryzaeArchitecture.md` の「将来のコンテキスト拡張」セクションを確認

### 3. レビュー実施

以下の **全観点** でレビューする。該当しない観点はスキップしてよい。

#### A. レイヤー依存（最重要）
- domain → application/infrastructure/presentation への依存がないか
- application → infrastructure への直接依存がないか
- コンテキスト間の直接依存がないか（shared 経由のみ許容）
- `pnpm dep-cruise` を実行し、違反がないことを確認

#### B. ドメインモデル
- private constructor + create/fromProps/withXxx/toProps パターンに従っているか
- domain 層で throw していないか（Result<T, E> 型で返すこと）
- generateId が外部から注入されているか（domain 内で crypto.randomUUID() を直接呼ばない）
- 全フィールドが readonly か
- エラー型がモデルごとの判別共用体 `{ type: string; message: string }` か

#### C. エラーハンドリング
- domain: `ok()`/`err()` で Result を返しているか
- application: `result.success` を検査し、失敗時に `ApplicationError` 継承クラスを throw しているか
- presentation: `errorHandler` で HTTP レスポンスに変換しているか
- エラークラスに `statusCode` があるか

#### D. ゲートウェイと依存性逆転
- gateway IF が domain/gateways/ にあるか
- gateway IF が class インスタンスを受け渡ししているか（Props ではなく）
- infrastructure が gateway IF を `implements` しているか
- repository に `toDomain()` メソッドで DB → class 変換があるか
- repository で `toProps()` を使って class → DB 変換しているか

#### E. ユースケース
- 1 ユースケース = 1 ファイルか
- コンストラクタで gateway IF を受け取っているか
- `generateId` をコンストラクタで受け取っているか（必要な場合）
- レスポンスが `toProps()` でプレーンオブジェクトに変換されているか

#### F. プレゼンテーション層
- Zod でリクエストバリデーションしているか
- DI 組み立て（new Repository, new Usecase）がルートファイル内で完結しているか
- ビジネスロジックがルートファイルに漏れていないか

#### G. 命名規則
- `{動詞}-{対象}.usecase.ts`、`{モデル名}.ts`、`{対象}.service.ts` 等に従っているか
- ファイル名とクラス名が一致しているか

#### H. テスト
- domain service に対するユニットテストがあるか
- テストファイルがソースと同一ディレクトリに配置されているか（`*.test.ts`）
- テストが Result 型の success/error 両方のケースをカバーしているか

#### I. コード品質
- 未使用の export がないか（`pnpm knip` で確認）
- `any` 型を使っていないか
- `console.log` が本番コードに残っていないか
- `--no-verify` を使っていないか

### 4. ツールによる自動検証

手動レビューに加え、以下を実行する:

```bash
pnpm dep-cruise   # レイヤー依存違反
pnpm knip         # 未使用コード
pnpm lint         # Biome lint
pnpm typecheck    # 型チェック
pnpm test         # テスト
```

### 5. 結果報告

以下のフォーマットで報告する。重大な問題がない場合は「設計上の問題は見つかりませんでした」と報告する。

```
## レビュー結果

### ✅ 良い点
- ...

### 💡 改善提案
- [ファイル名:行番号] 問題の説明 + 提案

### ❌ 要修正
- [ファイル名:行番号] 問題の説明 + 理由 + 修正案

### 🔧 自動検証結果
- dep-cruise: ✅ / ❌（違反内容）
- knip: ✅ / ❌（未使用コード一覧）
- lint: ✅ / ❌
- typecheck: ✅ / ❌
- test: ✅ / ❌
```
