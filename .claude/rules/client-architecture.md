---
paths:
  - "apps/client/src/**/*.ts"
  - "apps/client/src/**/*.tsx"
  - "apps/client/test/**/*.ts"
  - "apps/client/test/**/*.tsx"
  - "apps/admin/src/**/*.ts"
  - "apps/admin/src/**/*.tsx"
  - "apps/admin/test/**/*.ts"
  - "apps/admin/test/**/*.tsx"
---

# フロントエンドアーキテクチャルール

`apps/client`（ユーザー向け）と `apps/admin`（管理画面）の両方に適用される。

設計の正は **`docs/client-architecture-guide.md`** を参照。
テスト戦略の正は **`docs/client-testing-guide.md`** を参照。
型安全性・`as` 禁止・`any` 禁止は **`.claude/rules/quality.md`** を参照。

## ディレクトリ構造

- `app/` — Next.js App Router ページ + API Route Handler
- `app/api/[...path]/` — Hono アプリへのリクエスト転送（変更しない）
- `features/X/` — 機能スライス。components, hooks を含む
- `lib/` — 横断的ユーティリティ（API クライアント、トークン管理等）

## インポートルール（dependency-cruiser で機械的に検証）

- `features/X` → `features/Y` **禁止**（機能間の直接依存禁止）
- `lib/` → `features/`, `app/` **禁止**
- `app/` からは `features/`, `lib/` のみインポート可

## データフェッチング

- API 呼び出しは `features/X/hooks/` の Custom Hook に集約する
- コンポーネントから直接 API を呼ばない
- `lib/api.ts` の `createApiClient()` を使う

## テスト（絶対ルール）

### hooks テスト（vitest）
- `src/features/*/hooks/` にファイルを作成・変更したら、対応するテストを `test/features/*/hooks/` に**同時に**作成すること
- テストファイルの命名: `use-auth.ts` → `test/features/auth/hooks/use-auth.test.ts`
- モックは `vi.fn()` の手動スタブ（モックライブラリ不使用）

### E2E テスト（Playwright）
- 新しいページや主要な機能を追加したら、対応する E2E テストを `e2e/` に追加すること
- テストは features と1:1対応: `e2e/auth.spec.ts`, `e2e/entries.spec.ts`, `e2e/questions.spec.ts`
- ログイン済み状態が必要なテストは `e2e/fixtures/auth.ts` のフィクスチャを使う

### 共通
- **テストなしで作業を完了してはならない**
