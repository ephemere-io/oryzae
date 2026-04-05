# 品質ルール

テスト戦略・ガードレールの正は以下を参照:
- **`docs/backend-testing-guide.md`** — サーバーのテスト戦略
- **`docs/client-testing-guide.md`** — クライアントのテスト戦略

コミット前に全チェック実行。`--no-verify` 禁止。

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm dep-cruise && pnpm knip
```
