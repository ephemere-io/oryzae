---
paths:
  - "apps/client/src/**/*.ts"
  - "apps/client/src/**/*.tsx"
---

# クライアントアーキテクチャルール

設計の正は **`docs/client-architecture-guide.md`** を参照。
テスト戦略の正は **`docs/client-testing-guide.md`** を参照。

## ディレクトリ構造

- `app/` — Next.js App Router ページ。薄いラッパーのみ。**API 呼び出し禁止**
- `features/X/` — 機能スライス。components, hooks, types を含む
- `components/ui/` — 汎用 UI コンポーネント。feature 依存禁止
- `lib/` — 横断的ユーティリティ（API クライアント等）

## インポートルール（dependency-cruiser で機械的に検証）

- `features/X` → `features/Y` **禁止**（機能間の直接依存禁止）
- `components/ui` → `features/`, `app/` **禁止**
- `lib/` → `features/`, `app/`, `components/` **禁止**
- `app/` からは `features/`, `components/ui/`, `lib/` のみインポート可

## データフェッチング

- API 呼び出しは `features/X/hooks/` の Custom Hook に集約する
- コンポーネントから直接 `api.api.v1...` を呼ばない
- hooks は `{ data, error, loading }` パターンで返す
- `fetch()` を直接使わない。`createApiClient()` の Hono RPC クライアントを使う

## 型安全性

- レスポンスの **`as` キャストは禁止**。Hono RPC の型推論を活用する
- 型が合わない場合は型ガードを書く
- `any` 型は使用禁止（`unknown` + 型ガードで対処）

## バリデーション

- `@oryzae/shared` の Zod スキーマをクライアントでも使う（SSoT）
- HTML5 バリデーション属性だけに依存しない

## テスト

- 新しい hooks を作成したら、対応するテストを `test/features/` に同時に作成すること
- テストファイルは `test/features/` に `src/features/` をミラーして配置
- モックは `vi.fn()` の手動スタブ（モックライブラリ不使用）
- **テストなしで作業を完了してはならない**

## 品質チェック

コミット前に全チェック実行。`--no-verify` 禁止。

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm dep-cruise && pnpm knip
```
