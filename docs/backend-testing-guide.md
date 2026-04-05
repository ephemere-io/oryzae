# バックエンドテスト・ガードレールガイド

テスト戦略と品質ガードレールの定義。

---

## テスト戦略（4段階）

| レイヤー | テスト種別 | 方針 | コマンド |
| --- | --- | --- | --- |
| domain/models, domain/services | ユニットテスト | 全ロジック必須。外部依存なし | `pnpm test` |
| application/usecases | ユニットテスト | gateway をモックして処理フロー検証 | `pnpm test` |
| infrastructure/repositories | インテグレーションテスト | 実際の Supabase に対して実行 | `pnpm test` |
| presentation/routes | E2E テスト | Hono テストクライアントで結合テスト | `pnpm test` |

### テストファイル配置

ソースと同一ディレクトリに `*.test.ts` として配置する。

```
domain/services/
  snapshot-restoration.service.ts
  snapshot-restoration.service.test.ts      ← ここ
```

### テスト作成ルール

- Result<T, E> の success / error 両方のケースをカバーする
- ドメインモデルの create() でバリデーション境界値をテストする
- テストデータは最小限にし、テスト対象に直接関係するフィールドだけ設定する

---

## ガードレールスタック

### Git フック（品質チェックの3段構え）

| タイミング | チェック | ツール |
| --- | --- | --- |
| pre-commit | 変更ファイルのみフォーマット + lint | lint-staged + Biome |
| pre-push | 全体 lint + typecheck | Biome + TypeScript |
| CI | lint + typecheck + test + dep-cruise + knip | 全ツール |

**`--no-verify` は原則禁止。** フック失敗時は必ず修正する。

### CI（GitHub Actions）

PR と main push で5つのジョブを並列実行:

| ジョブ | コマンド | 検証内容 |
| --- | --- | --- |
| lint | `pnpm lint` | Biome フォーマット + lint |
| typecheck | `pnpm typecheck` | TypeScript 型チェック |
| test | `pnpm test` | Vitest テスト |
| dependency-check | `pnpm dep-cruise` | DDD レイヤー依存違反 |
| knip | `pnpm knip` | 未使用 export / ファイル |

### dependency-cruiser（DDD レイヤー強制）

`apps/server/.dependency-cruiser.cjs` で以下を禁止:

```
domain/ → infrastructure/        ❌
domain/ → presentation/          ❌
domain/ → application/           ❌
application/ → infrastructure/   ❌（gateway IF 経由のみ）
presentation/ → infrastructure/  ⚠️ DI 組み立てのみ
コンテキスト間の直接依存          ❌（shared/ 経由のみ）
循環依存                          ❌
```

---

## コーディング規約

| 項目 | ルール |
| --- | --- |
| フォーマッタ | Biome（シングルクォート、セミコロン、2スペースインデント） |
| 1 ユースケース | 1 ファイル |
| `any` 型 | 禁止（`unknown` + 型の絞り込みを使う） |
| `console.log` | 本番コード禁止 |
| main への直接 push | 禁止 |

---

## コマンド一覧

```bash
pnpm test               # テスト実行
pnpm typecheck           # 型チェック
pnpm lint               # Biome lint
pnpm lint:fix           # Biome 自動修正
pnpm dep-cruise         # DDD レイヤー依存チェック
pnpm knip               # デッドコード検出
```
