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

- `app/` — Next.js App Router ページ + API Route Handler。端末判定もここ（URL に端末を出さない）
- `app/api/[...path]/` — Hono アプリへのリクエスト転送（変更しない）
- `features/` — 機能スライス
  - **`apps/client`**: ドメイン × reach。`features/{shared,pc,sp}/{domain}/`
    - `shared/{domain}/` — UIを持たない共有ロジック（データ hook `use-*`・型）。両端末が使う
    - `pc/{domain}/` / `sp/{domain}/` — 端末別 UI（components, hooks）
  - **`apps/admin`**: reach 軸なし。従来どおり `features/{domain}/`
- `components/ui/` — 汎用 UI コンポーネント（shadcn 等。feature 依存禁止）
- `lib/` — 基盤ユーティリティのみ（API クライアント・認証・分析等）。**ドメイン非依存・`use-*` のドメイン hook を置かない**

## 置き場の決定木（迷ったら上から）

1. ドメインを知らない汎用 UI → `components/ui/`
2. ドメインを知らない基盤 util（createApiClient・認証・分析・theme・debounce・markdown・定数）→ `lib/`
3. ドメイン固有 → ドメインを選び reach で分ける：両端末・UIなし → `features/shared/{domain}/` ／ PC UI → `features/pc/{domain}/` ／ SP UI → `features/sp/{domain}/`

## インポートルール（dependency-cruiser で機械的に検証）

`apps/client`（reach 軸あり）:

- `features/pc/*` ⇎ `features/sp/*` **禁止**（端末をまたぐ依存禁止）
- `features/{pc,sp,shared}/X`（ドメイン X）→ **他ドメイン禁止**。唯一の例外は **`features/shared/{同ドメイン}` への import 可**
- `features/shared/*` → `features/pc`, `features/sp` **禁止**（共有層は端末固有 UI を知らない）
- `components/` → `features/`, `app/` **禁止**
- `lib/` → `features/`, `app/`, `components/` **禁止**（ドメイン hook も置かない）
- `app/` からは `features/`, `components/`, `lib/` のみインポート可

`apps/admin`（reach 軸なし）: 従来どおり `features/X` → `features/Y` **禁止**。

## データフェッチング

- API 呼び出しは **`features/shared/{domain}/hooks/`** の Custom Hook に集約する（PC/SP 共通）
- 端末固有 UI（`pc` / `sp`）はこの共有 hook を import して使う
- コンポーネントから直接 API を呼ばない
- `lib/api.ts` の `createApiClient()` を使う

## テスト（絶対ルール）

### hooks テスト（vitest）
- `src/features/**/hooks/` にファイルを作成・変更したら、対応するテストを `test/features/` に **reach 構造をミラー**して**同時に**作成すること
- 命名（client）: `src/features/shared/auth/hooks/use-auth.ts` → `test/features/shared/auth/hooks/use-auth.test.ts`
- 共有データ hook のテストは PC/SP で重複させず `test/features/shared/{domain}` に1か所
- モックは `vi.fn()` の手動スタブ（モックライブラリ不使用）

### E2E テスト（Playwright）
- 新しいページや主要な機能を追加したら、対応する E2E テストを `e2e/` に追加すること
- テストは features と1:1対応: `e2e/auth.spec.ts`, `e2e/entries.spec.ts`, `e2e/questions.spec.ts`
- ログイン済み状態が必要なテストは `e2e/fixtures/auth.ts` のフィクスチャを使う

### 共通
- **テストなしで作業を完了してはならない**
