# 品質ルール

## コミット前チェック

全チェックを実行し、失敗したら修正する。`--no-verify` で回避しない。

```bash
pnpm typecheck    # TypeScript 型チェック
pnpm lint         # Biome lint
pnpm test         # Vitest テスト
pnpm dep-cruise   # DDD レイヤー依存チェック
```

## コードスタイル

- Biome がフォーマットを担当（シングルクォート、セミコロン、2スペースインデント）
- 自明なコードにコメントを付けない
- ロジックが非自明な場合のみ docstring を付ける
- 1 ユースケース = 1 ファイル

## テスト方針

| レイヤー | テスト種別 | 必須度 |
|---------|----------|-------|
| domain/models, domain/services | ユニットテスト | 必須 |
| application/usecases | ユニットテスト（gateway モック） | 複雑なロジック時 |
| infrastructure | インテグレーションテスト | 可能な場合 |
| presentation | E2E テスト | 可能な場合 |

## 禁止事項

- `--no-verify` の使用
- `any` 型の使用（`unknown` + 型の絞り込みを使う）
- 本番コードでの `console.log`（適切なエラーハンドリングを使う）
- main への直接 push
