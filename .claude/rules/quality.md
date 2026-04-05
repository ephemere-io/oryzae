# 品質ルール

テスト戦略・ガードレールの正は **`docs/backend-testing-guide.md`** を参照。

コミット前に全チェック実行。`--no-verify` 禁止。

```bash
pnpm typecheck && pnpm lint && pnpm test && pnpm dep-cruise && pnpm knip
```
