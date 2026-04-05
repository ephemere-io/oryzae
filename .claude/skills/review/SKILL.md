---
name: review
description: "Review current changes for architecture violations and code quality. Use before creating a PR."
disable-model-invocation: true
allowed-tools: "Bash(git) Read Glob Grep"
---

# Review: 設計ガイドライン違反チェック

## チェック項目

### 1. レイヤー依存ルール
- domain → application/infrastructure/presentation の依存がないか
- application → infrastructure の依存がないか
- コンテキスト間の直接依存がないか（shared 経由のみ）

### 2. ドメインモデル
- private constructor + create/fromProps/withXxx/toProps パターンに従っているか
- domain 層で throw していないか（Result 型を使うこと）
- generateId が外部から注入されているか

### 3. エラーハンドリング
- domain: Result<T, E> を返しているか
- application: ApplicationError 継承クラスを throw しているか
- presentation: errorHandler で statusCode → HTTP 変換しているか

### 4. 命名規則
- `{動詞}-{対象}.usecase.ts`, `{モデル名}.ts`, `{対象}.service.ts` に従っているか

### 5. テスト
- domain service にテストがあるか

## 出力形式

```
✅ Good: ...
💡 Suggestion: ... (file:line)
❌ Must fix: ... (file:line)
```
