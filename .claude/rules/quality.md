# 品質ルール

ガードレールの詳細は `docs/OryzaeArchitecture.md` セクション9を参照。

## コミット前チェック

全チェックを実行し、失敗したら修正する。`--no-verify` で回避しない。

```bash
pnpm typecheck    # TypeScript 型チェック
pnpm lint         # Biome lint
pnpm test         # Vitest テスト
pnpm dep-cruise   # DDD レイヤー依存チェック
pnpm knip         # デッドコード検出
```

## 禁止事項

- `--no-verify` の使用
- `any` 型の使用
- 本番コードでの `console.log`
- main への直接 push
