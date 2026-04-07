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

### スクリーンショット・MCP 出力ファイルの保存先

Chrome DevTools MCP や Playwright MCP でスクリーンショットを撮る場合は、**必ず `.tmp/` ディレクトリに保存する**。プロジェクトルートにファイルを散らかさないこと。

```
take_screenshot filePath=.tmp/screenshots/{名前}.png
```

## コミット前チェック

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm dep-cruise && pnpm knip
```
