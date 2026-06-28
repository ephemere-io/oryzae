# 品質ルール

テスト戦略・ガードレールの正は以下を参照:
- **`docs/backend-testing-guide.md`** — サーバーのテスト戦略
- **`docs/client-testing-guide.md`** — クライアントのテスト戦略

## 絶対ルール

### `as` キャスト禁止

全コードで `as` による型アサーションを使ってはならない。型が合わない場合は型ガードを書く。

やむを得ない場合（ブラウザ API の型定義不足等）は、前の行に理由を記載する:
```typescript
// @type-assertion-allowed: InputEvent.inputType は標準 TS DOM 型に含まれない
const ie = e as InputEvent;
```

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
pnpm typecheck && pnpm lint && pnpm test && pnpm dep-cruise && pnpm knip
```

## Stop hook による自動テスト

Claude の応答完了時に `.claude/hooks/run-tests-on-stop.sh` が `pnpm typecheck && pnpm test` を実行する。失敗するとブロックされ、Claude がもう一周して修正する（`stop_hook_active` で 2 周目は通す）。

## フロントエンド変更時の検証

`apps/client` / `apps/admin` の UI を変更したら、報告前に必ず Chrome DevTools MCP で実機確認する。Stop hook の vitest は表示・操作までは検証しない。

- `/auto-qa` skill を呼ぶ、または `mcp__chrome-devtools__*` を直接使う
- dev server (`pnpm --filter @oryzae/client dev` or `admin`) を立てて `navigate_page` → 該当フロー実行 → `take_screenshot`
- `list_console_messages` でエラーが出てないかも確認
- スクリーンショット保存先は `.tmp/screenshots/`
