---
paths:
  - "supabase/**"
  - "apps/server/src/**/infrastructure/**"
  - "apps/server/src/**/domain/models/**"
---

# データベースマイグレーションルール

## 絶対ルール: マイグレーションファイルの生成

DB スキーマを変更する場合（テーブル作成・カラム追加・インデックス・トリガー・RLS ポリシー等）、**必ず `supabase/migrations/` にマイグレーション SQL ファイルを生成すること**。

### 手順

1. **マイグレーションファイルを作成**: `supabase/migrations/NNNNN_<名前>.sql` に SQL を記述
   - 連番は既存ファイルの最大番号 + 1（例: `00005_create_board.sql`）
2. **Supabase MCP でリモート DB に適用**: `mcp__supabase__apply_migration` で本番/ステージング DB にも適用
3. **マイグレーションファイルをコミット**: git にファイルを含めること

### 禁止事項

- **Supabase MCP だけで migration を実行してリポジトリにファイルを残さないこと** — これをやるとリポジトリが DB の実態と乖離し、他の開発者やCI/CDが再現できなくなる
- **手動で Supabase Dashboard から DDL を実行すること** — 同様の理由

### マイグレーションファイルの命名

```
supabase/migrations/NNNNN_<動詞>_<対象>.sql
```

例:
- `00001_create_entries.sql`
- `00004_add_timestamps_to_fermentation_tables.sql`
- `00005_create_board.sql`

### マイグレーションの内容に含めるもの

- テーブル定義 (`CREATE TABLE`)
- インデックス (`CREATE INDEX`)
- RLS ポリシー (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY` + `CREATE POLICY`)
- トリガー・関数 (`CREATE FUNCTION` + `CREATE TRIGGER`)
- 必要に応じてデータ移行
