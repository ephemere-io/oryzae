# Entry バックエンドガイド

Entry（ジャーナルエントリ）コンテキストの実装ガイド。
横断的なルールは `docs/backend-architecture-guide.md` を参照。

---

## ディレクトリ構成

```
apps/server/src/contexts/entry/
├── presentation/routes/
│   └── entries.ts                    # API ルート + DI 組み立て
├── application/
│   ├── usecases/
│   │   ├── create-entry.usecase.ts
│   │   ├── update-entry.usecase.ts
│   │   ├── get-entry.usecase.ts
│   │   ├── list-entries.usecase.ts
│   │   └── delete-entry.usecase.ts
│   └── errors/
│       └── entry.errors.ts
├── domain/
│   ├── models/
│   │   ├── entry.ts                  # Entry class
│   │   └── entry-snapshot.ts         # EntrySnapshot class
│   ├── services/
│   │   └── snapshot-restoration.service.ts
│   └── gateways/
│       ├── entry-repository.gateway.ts
│       └── entry-snapshot-repository.gateway.ts
└── infrastructure/repositories/
    ├── supabase-entry.repository.ts
    └── supabase-entry-snapshot.repository.ts
```

---

## ドメインモデル

### Entry

ジャーナルエントリの最新状態。mutable（updatedAt が変わる）。

```typescript
class Entry {
  readonly id, userId, content, mediaUrls, createdAt, updatedAt

  static create(params, generateId): Result<Entry, EntryError>
  // バリデーション: content 空文字禁止、100,000文字上限

  static fromProps(props): Entry
  withContent(content, mediaUrls): Result<Entry, EntryError>
  toProps(): EntryProps
}
```

### EntrySnapshot

保存のたびに追記される immutable な履歴。`extension` は opaque JSON（エディタ固有データ）。

```typescript
class EntrySnapshot {
  readonly id, entryId, content, editorType, editorVersion, extension, createdAt

  static create(params, generateId): EntrySnapshot  // バリデーション不要
  static fromProps(props): EntrySnapshot
  toProps(): EntrySnapshotProps
}
```

### ドメインサービス

`resolveExtension(latestSnapshot, requestedEditorType)`: エディタスイッチ時の extension 復元判定。最新 snapshot の editorType が一致すれば extension を返す。

---

## Gateway IF

```typescript
interface EntryRepositoryGateway {
  findById(id: string): Promise<Entry | null>
  listByUserId(userId: string, cursor?: string, limit?: number): Promise<Entry[]>
  save(entry: Entry): Promise<void>
  delete(id: string): Promise<void>
}

interface EntrySnapshotRepositoryGateway {
  append(snapshot: EntrySnapshot): Promise<void>
  findLatestByEntryId(entryId: string): Promise<EntrySnapshot | null>
}
```

---

## API エンドポイント

```
POST   /api/v1/entries              新規作成
GET    /api/v1/entries              一覧取得（カーソルページネーション）
GET    /api/v1/entries/:id          詳細取得（最新 snapshot 含む）
PUT    /api/v1/entries/:id          編集保存（entries 更新 + snapshot 追記）
DELETE /api/v1/entries/:id          削除（cascade で snapshots も削除）
```

認証: `Authorization: Bearer <access_token>`

---

## DB スキーマ

```sql
create table public.entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  content text not null,
  media_urls text[] default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.entry_snapshots (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.entries(id) on delete cascade,
  content text not null,
  editor_type text not null,
  editor_version text not null,
  extension jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
```

RLS: `user_id = auth.uid()` / `entry_id IN (SELECT id FROM entries WHERE user_id = auth.uid())`

---

## 変更ポイント早見表

| やりたいこと | 変更するファイル |
| --- | --- |
| Entry のフィールド追加 | `domain/models/entry.ts` → `EntryProps` + class |
| 新しいユースケース追加 | `application/usecases/` に新ファイル |
| API エンドポイント追加 | `presentation/routes/entries.ts` |
| DB カラム追加 | `supabase/migrations/` + repository の toDomain/toProps |
