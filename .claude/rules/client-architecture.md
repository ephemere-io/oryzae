# クライアントアーキテクチャルール

設計の正は **`docs/client-architecture-guide.md`** を参照。
テスト戦略の正は **`docs/client-testing-guide.md`** を参照。

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
- `lib/api.ts` の `createApiClient()` を使う（同一オリジン、ベース URL 不要）

## 型安全性

- **`as` キャストは原則禁止**。型が合わない場合は型ガードを書く
- **例外**: ブラウザ API の型不足（Web Speech API, InputEvent, CompositionEvent 等）は `as` を許可。理由をコメントに記載する
- `any` 型は使用禁止（`unknown` + 型ガードで対処）

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
