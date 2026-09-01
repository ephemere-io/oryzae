# 品質ルール

テスト戦略・ガードレールの正は以下を参照:
- **`docs/backend-testing-guide.md`** — サーバーのテスト戦略
- **`docs/client-testing-guide.md`** — クライアントのテスト戦略

## 絶対ルール

### `as` キャスト禁止

全コードで `as` による型アサーションを使ってはならない。型が合わない場合は型ガードを書く。

やむを得ない場合（ブラウザ API の型定義不足等）は、**同じ行の末尾か前の行**に理由を記載する:
```typescript
// @type-assertion-allowed: InputEvent.inputType は標準 TS DOM 型に含まれない
const ie = e as InputEvent;
```

`pnpm check:as`（CI ジョブ **Static Checks** の "No `as` Casts" ステップ）がこれを強制する。理由が空の
`@type-assertion-allowed` は違反として扱う。検出器は `scripts/check-type-assertions.mjs`。
`as const` と import/export の別名（`import * as X`）は対象外。

検出器自体は自前の字句解析なので、`scripts/check-type-assertions.test.mjs` に
自己テストがある（`pnpm check:as` が本体より先に実行する）。検出ロジックを触ったら
ここにケースを足すこと。**検出漏れは「CI が緑なのにルールが守られていない」状態を作る**ため、
false negative のケースを特に厚くしてある。

サーバーの Supabase 行マッピングは、キャストではなく
`contexts/shared/infrastructure/row.ts` のリーダー（`readString` / `readNumber` /
`readEnum` など）を使う。DB スキーマがずれた時に、どのカラムがどう違ったのかが
分かる例外になる。

### `any` 型禁止

`any` を使わない。`unknown` を使い、型ガードで絞り込む。

### `--no-verify` 禁止

Git hooks をスキップしてはならない。hook が失敗したら原因を修正する。

### 新規 client コンポーネントには検証ハーネスを付ける

`apps/client/src/features/**/components/*.tsx` に**新しくコンポーネントを追加**したら、隣に
`<name>.verify.tsx`（`registerUnit` + probe を1つ以上）を置き、コンポーネントには `verifyAttrs`
で DOM 契約を公表する。書き方は `docs/verify-harness-rollout.md` §3、雛形は
`pc/entries/components/editor-status-bar.verify.tsx` 等。i18n 依存部品は
`@/lib/verify/with-providers` の `withVerifyProviders` で包む。

孤立検証に乗らない部品（router/データ取得/Selection・Range 依存・ページ級合成）は、
コンポーネント先頭に理由付きで `// verify-exempt: <理由>` を記載すれば免除される。

**CI の `verify-coverage-gate` がこれを強制する**（新規追加ファイルのみ判定。既存の未カバー部品や
リネーム＝移設は対象外）。Claude セッションでは PostToolUse フックが書き忘れを指摘する。

### スクリーンショット・MCP 出力ファイルの保存先

Chrome DevTools MCP や Playwright MCP でスクリーンショットを撮る場合は、**必ず `.tmp/` ディレクトリに保存する**。プロジェクトルートにファイルを散らかさないこと。

```
take_screenshot filePath=.tmp/screenshots/{名前}.png
```

## コミット前チェック

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm dep-cruise && pnpm knip && pnpm check:as && pnpm security:rls
```

## セキュリティ

Oryzae は他人の日記を預かる。**「ある人の日記が本人以外の目に触れる経路が無いか」**が
唯一の最上位基準。詳細は `docs/security-guide.md`。

### 認可の急所（これを誤解しないこと）

ユーザー向け API は `authMiddleware` が **anon key + ユーザー JWT** でクライアントを作るため、
**RLS が認可境界**。repository に `.eq('user_id', ...)` が無くても RLS が守る。
一方 `getSupabaseClient()` は **service role key で RLS を完全にバイパス**する。

### 絶対ルール: 新規テーブルには必ず RLS

`supabase/migrations/` でテーブルを作ったら、必ず RLS を有効化しポリシーを書く。
`pnpm security:rls` が CI で強制する。

- `USING (true)` を書くときは必ず `TO service_role` を添える
  （TO 省略時は PUBLIC 扱いになり、同テーブルの own-data ポリシーを無効化する）
- 読み取りを許すポリシー（`FOR SELECT` / `FOR ALL`）の条件式には `auth.uid()` を必ず含める
  （所有者を辿るサブクエリでも可。含まれないと全ユーザー分の行が読める）
- 意図的な例外は対象文の直前行に `-- @rls-exempt: <理由>` を記載
- 既知の未修正リスクは `supabase/rls-baseline.json` で管理（直したら項目を削除する）

### 絶対ルール: service role の利用箇所を増やさない

`getSupabaseClient()` の import 元は `apps/server/.dependency-cruiser.cjs` の
`service-role-client-containment` で許可リスト化されている。追加が必要な場合は、
その PR で「なぜ RLS バイパスが要るか」「ユーザー入力の ID をそのままクエリ条件に
渡していないか」をレビューしたうえで許可リストに明示的に足すこと。

### 日記本文をログ・監視に載せない

`console.log` / `logger.*` / `Sentry.captureException` / PostHog イベントに、
entry の本文・snapshot・snippet・letter を含めない。例外メッセージへの本文埋め込みも同様
（Sentry に自動送信される）。

## Stop hook による自動テスト

Claude の応答完了時に `.claude/hooks/run-tests-on-stop.sh` が `pnpm typecheck && pnpm test` を実行する。失敗するとブロックされ、Claude がもう一周して修正する（`stop_hook_active` で 2 周目は通す）。

## フロントエンド変更時の検証

`apps/client` / `apps/admin` の UI を変更したら、報告前に必ず Chrome DevTools MCP で実機確認する。Stop hook の vitest は表示・操作までは検証しない。

- `/auto-qa` skill を呼ぶ、または `mcp__chrome-devtools__*` を直接使う
- dev server (`pnpm --filter @oryzae/client dev` or `admin`) を立てて `navigate_page` → 該当フロー実行 → `take_screenshot`
- `list_console_messages` でエラーが出てないかも確認
- スクリーンショット保存先は `.tmp/screenshots/`
