# Oryzae Architecture

# Oryzae Architecture

Picklesを前身とするジャーナリング支援アプリ。フルリニューアル。
現在のスコープは **entry（ジャーナルエントリ）の実装** に限定する。

型設計の詳細は EDITOR_API_INTERFACE.md を正とする。

参考実装: [team-mirai-volunteer/video-processor](https://github.com/team-mirai-volunteer/video-processor)（レイヤードアーキテクチャの実プロジェクト事例）

---

## システム構成

```
┌─────────────────────────────────────────────────┐
│  Client Layer                                    │
│                                                   │
│  macOS(RN) / iOS(Expo) / Web(Next) / Android(RN) │
│       │                                           │
│  packages/adapters  (OS差分吸収)                  │
│  packages/core      (型, スキーマ)                │
└───────────────────────┬─────────────────────────┘
                        │ REST API (HTTPS)
┌───────────────────────┴─────────────────────────┐
│  Server Layer (Hono on Supabase Edge Functions)  │
│                                                   │
│  presentation → application → domain ← infrastructure │
└──────────────────────────────────────────────────┘
```

---

## 技術スタック

| カテゴリ | 技術 |
| --- | --- |
| 言語 | TypeScript（全レイヤー） |
| モノレポ | Turborepo + pnpm |
| macOS | React Native for macOS（MVP） |
| API | Hono + Zod + zod-to-openapi |
| DB/認証 | Supabase (PostgreSQL + Auth + RLS) |

---

## レイヤードアーキテクチャ（Server Layer）

### 依存方向（絶対ルール）

```
presentation → application → domain ← infrastructure
```

- domain は何も import しない（最内層）
- infrastructure は domain の gateway IF を実装する（依存性逆転）
- presentation が infrastructure を直接触ることはない

### 各レイヤーの責務

| レイヤー | 責務 | 何を知っているか |
| --- | --- | --- |
| **presentation** | HTTP ↔ ユースケース変換。バリデーション | Hono, Zod |
| **application** | ユースケースごとの処理フロー | domain のモデル・サービス・gateway IF |
| **domain** | ビジネスルール。外部依存なし | 自分自身のみ |
| **infrastructure** | 外部依存（DB, 外部API等）の具体実装 | Supabase, 外部SDK |

### ドメイン層の3要素

video-processor リポジトリの実装に基づく設計:

| ディレクトリ | 役割 | 外部依存 | 例 |
| --- | --- | --- | --- |
| **models/** | 単一ドメインモデルのロジック・バリデーション | なし | Entry の不変条件、Snapshot の型定義 |
| **services/** | 複数のドメインモデルをまたぐ純粋なドメインロジック | なし | Entry × Snapshot のエディタスイッチ判定 |
| **gateways/** | 外部依存すべての抽象インターフェース | なし（IFのみ） | DB操作、外部API呼び出しの契約 |

**重要な区別:**

- gateway はDB操作 **だけでなく** 、外部API・ファイルシステム等あらゆる外部依存の抽象を置く場所
- services は外部依存を持たない純粋なドメインロジックの置き場。gateway を直接呼ばない

### レイヤー構成

```
apps/server/src/
├── contexts/
│   └── entry/                              # エントリ管理コンテキスト
│       ├── presentation/
│       │   ├── routes/
│       │   │   └── entries.ts              # APIエンドポイント定義
│       │   └── middleware/
│       │       └── auth.ts                 # 認証・バリデーション
│       ├── application/
│       │   └── usecases/
│       │       ├── create-entry.ts
│       │       ├── update-entry.ts
│       │       ├── get-entry.ts
│       │       ├── list-entries.ts
│       │       └── delete-entry.ts
│       ├── domain/
│       │   ├── models/
│       │   │   ├── entry.ts                # BaseEntry ドメインモデル
│       │   │   └── entry-snapshot.ts       # EntrySnapshot ドメインモデル
│       │   ├── services/
│       │   │   └── snapshot-restoration.service.ts
│       │   │       # Entry × Snapshot をまたぐドメインロジック
│       │   │       # エディタスイッチ時の extension 復元判定
│       │   └── gateways/
│       │       ├── entry-repository.gateway.ts
│       │       │   # entries テーブル操作の抽象IF
│       │       └── entry-snapshot-repository.gateway.ts
│       │           # entry_snapshots テーブル操作の抽象IF
│       └── infrastructure/
│           └── repositories/
│               ├── supabase-entry.repository.ts
│               │   # entry-repository.gateway の Supabase 実装
│               └── supabase-entry-snapshot.repository.ts
│                   # entry-snapshot-repository.gateway の Supabase 実装
│
├── shared/                                 # コンテキスト間共有コード（将来）
│   └── infrastructure/
│       └── supabase-client.ts              # DB接続の共通設定
│
└── index.ts                                # エントリーポイント
```

---

## ドメイン層 詳細設計

### domain/models/entry.ts

EDITOR_API_INTERFACE.md の Base Entry をドメインモデルとして定義。

```tsx
export interface BaseEntry {
  id: string
  content: string
  mediaUrls: string[]
  createdAt: string
  updatedAt: string
}
```

### domain/models/entry-snapshot.ts

entry_snapshots の1行を表すドメインモデル。

```tsx
export interface EntrySnapshot {
  id: string
  entryId: string
  content: string
  editorType: string
  editorVersion: string
  extension: Record<string, unknown>  // opaque JSON — Domain はこの中身を知らない
  createdAt: string
}
```

---

### domain/gateways/entry-repository.gateway.ts

entries テーブル操作の抽象インターフェース。

```tsx
import type { BaseEntry } from '../models/entry'

export interface EntryRepositoryGateway {
  findById(id: string): Promise<BaseEntry | null>
  listByUserId(userId: string, cursor?: string, limit?: number): Promise<BaseEntry[]>
  save(entry: BaseEntry): Promise<void>
  delete(id: string): Promise<void>
}
```

### domain/gateways/entry-snapshot-repository.gateway.ts

entry_snapshots テーブル操作の抽象インターフェース。
snapshot は immutable（append-only）。

```tsx
import type { EntrySnapshot } from '../models/entry-snapshot'

export interface EntrySnapshotRepositoryGateway {
  /**
   * entry_snapshots に1行追記（immutable append-only）。
   * @see EDITOR_API_INTERFACE.md DB設計
   */
  append(snapshot: Omit<EntrySnapshot, 'id' | 'createdAt'>): Promise<EntrySnapshot>

  /**
   * entry_snapshots から最新の1行を取得。
   * エディタスイッチ判定（snapshot-restoration.service.ts）に使う。
   * @see EDITOR_API_INTERFACE.md Case 3, Case 5
   */
  findLatestByEntryId(entryId: string): Promise<EntrySnapshot | null>
}
```

---

### domain/services/snapshot-restoration.service.ts

EDITOR_API_INTERFACE.md の Case 3 / Case 5 のビジネスルールを実装。
Entry と Snapshot の両方を知る必要があるドメインロジック。
外部依存なし（純粋関数）。

```tsx
import type { EntrySnapshot } from '../models/entry-snapshot'

/**
 * エディタスイッチ時の extension 復元判定。
 *
 * - 最新 snapshot の editorType が要求と一致 → extension を返す（復元可能）
 * - 一致しない or snapshot がない → null（エディタ側が新規初期化する）
 *
 * @see EDITOR_API_INTERFACE.md Case 3, Case 5
 */
export function resolveExtension(
  latestSnapshot: EntrySnapshot | null,
  requestedEditorType: string
): Record<string, unknown> | null {
  if (!latestSnapshot) return null
  if (latestSnapshot.editorType === requestedEditorType) {
    return latestSnapshot.extension
  }
  return null
}
```

---

## アプリケーション層 詳細設計

gateway IF だけを知る。Supabase を知らない。

### application/usecases/create-entry.ts

```tsx
import type { EntryRepositoryGateway } from '../../domain/gateways/entry-repository.gateway'
import type { EntrySnapshotRepositoryGateway } from '../../domain/gateways/entry-snapshot-repository.gateway'
import type { BaseEntry } from '../../domain/models/entry'

interface CreateEntryInput {
  content: string
  mediaUrls: string[]
  editorType: string
  editorVersion: string
  extension: Record<string, unknown>
}

export class CreateEntry {
  constructor(
    private entryRepo: EntryRepositoryGateway,
    private snapshotRepo: EntrySnapshotRepositoryGateway,
  ) {}

  async execute(userId: string, input: CreateEntryInput): Promise<BaseEntry> {
    const now = new Date().toISOString()
    const entry: BaseEntry = {
      id: crypto.randomUUID(),
      content: input.content,
      mediaUrls: input.mediaUrls,
      createdAt: now,
      updatedAt: now,
    }
    await this.entryRepo.save(entry)
    await this.snapshotRepo.append({
      entryId: entry.id,
      content: input.content,
      editorType: input.editorType,
      editorVersion: input.editorVersion,
      extension: input.extension,
    })
    return entry
  }
}
```

### application/usecases/get-entry.ts

エントリ取得時に最新 snapshot も返す。クライアントが editorType を見てスイッチ判定する。

```tsx
import type { EntryRepositoryGateway } from '../../domain/gateways/entry-repository.gateway'
import type { EntrySnapshotRepositoryGateway } from '../../domain/gateways/entry-snapshot-repository.gateway'

export class GetEntry {
  constructor(
    private entryRepo: EntryRepositoryGateway,
    private snapshotRepo: EntrySnapshotRepositoryGateway,
  ) {}

  async execute(entryId: string) {
    const entry = await this.entryRepo.findById(entryId)
    if (!entry) return null
    const latestSnapshot = await this.snapshotRepo.findLatestByEntryId(entryId)
    return { entry, latestSnapshot }
  }
}
```

### application/usecases/update-entry.ts

```tsx
import type { EntryRepositoryGateway } from '../../domain/gateways/entry-repository.gateway'
import type { EntrySnapshotRepositoryGateway } from '../../domain/gateways/entry-snapshot-repository.gateway'

interface UpdateEntryInput {
  content: string
  mediaUrls: string[]
  editorType: string
  editorVersion: string
  extension: Record<string, unknown>
}

export class UpdateEntry {
  constructor(
    private entryRepo: EntryRepositoryGateway,
    private snapshotRepo: EntrySnapshotRepositoryGateway,
  ) {}

  async execute(entryId: string, input: UpdateEntryInput) {
    const existing = await this.entryRepo.findById(entryId)
    if (!existing) return null

    const updated = {
      ...existing,
      content: input.content,
      mediaUrls: input.mediaUrls,
      updatedAt: new Date().toISOString(),
    }
    await this.entryRepo.save(updated)
    await this.snapshotRepo.append({
      entryId: entryId,
      content: input.content,
      editorType: input.editorType,
      editorVersion: input.editorVersion,
      extension: input.extension,
    })
    return updated
  }
}
```

---

## プレゼンテーション層 詳細設計

### presentation/routes/entries.ts

HTTP をユースケースに変換するだけ。ビジネスロジックを含まない。

```tsx
import { Hono } from 'hono'
import { CreateEntry } from '../../application/usecases/create-entry'
import { GetEntry } from '../../application/usecases/get-entry'
import { UpdateEntry } from '../../application/usecases/update-entry'

const entries = new Hono()

entries.post('/', async (c) => {
  const usecase = new CreateEntry(c.get('entryRepo'), c.get('snapshotRepo'))
  const entry = await usecase.execute(c.get('userId'), await c.req.json())
  return c.json(entry, 201)
})

entries.get('/:id', async (c) => {
  const usecase = new GetEntry(c.get('entryRepo'), c.get('snapshotRepo'))
  const result = await usecase.execute(c.req.param('id'))
  if (!result) return c.json({ error: 'not found' }, 404)
  return c.json(result)
})

entries.put('/:id', async (c) => {
  const usecase = new UpdateEntry(c.get('entryRepo'), c.get('snapshotRepo'))
  const result = await usecase.execute(c.req.param('id'), await c.req.json())
  if (!result) return c.json({ error: 'not found' }, 404)
  return c.json(result)
})

export { entries }
```

---

## インフラストラクチャ層 詳細設計

### infrastructure/repositories/supabase-entry.repository.ts

entry-repository.gateway の Supabase 実装。

```tsx
import type { SupabaseClient } from '@supabase/supabase-js'
import type { EntryRepositoryGateway } from '../../domain/gateways/entry-repository.gateway'
import type { BaseEntry } from '../../domain/models/entry'

export class SupabaseEntryRepository implements EntryRepositoryGateway {
  constructor(private supabase: SupabaseClient) {}

  async findById(id: string): Promise<BaseEntry | null> {
    const { data } = await this.supabase
      .from('entries').select('*').eq('id', id).single()
    return data ? this.toBaseEntry(data) : null
  }

  async save(entry: BaseEntry): Promise<void> {
    const { error } = await this.supabase
      .from('entries')
      .upsert({
        id: entry.id,
        content: entry.content,
        media_urls: entry.mediaUrls,
        created_at: entry.createdAt,
        updated_at: entry.updatedAt,
      })
    if (error) throw error
  }

  // ... listByUserId, delete, toBaseEntry
}
```

### infrastructure/repositories/supabase-entry-snapshot.repository.ts

entry-snapshot-repository.gateway の Supabase 実装。

```tsx
import type { SupabaseClient } from '@supabase/supabase-js'
import type { EntrySnapshotRepositoryGateway } from '../../domain/gateways/entry-snapshot-repository.gateway'
import type { EntrySnapshot } from '../../domain/models/entry-snapshot'

export class SupabaseEntrySnapshotRepository implements EntrySnapshotRepositoryGateway {
  constructor(private supabase: SupabaseClient) {}

  async append(snapshot: Omit<EntrySnapshot, 'id' | 'createdAt'>): Promise<EntrySnapshot> {
    const { data, error } = await this.supabase
      .from('entry_snapshots')
      .insert({
        entry_id: snapshot.entryId,
        content: snapshot.content,
        editor_type: snapshot.editorType,
        editor_version: snapshot.editorVersion,
        extension: snapshot.extension,
      })
      .select()
      .single()
    if (error) throw error
    return this.toEntrySnapshot(data)
  }

  async findLatestByEntryId(entryId: string): Promise<EntrySnapshot | null> {
    const { data } = await this.supabase
      .from('entry_snapshots')
      .select('*')
      .eq('entry_id', entryId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()
    if (!data) return null
    return this.toEntrySnapshot(data)
  }

  // ... toEntrySnapshot
}
```

---

## リクエストの流れ（例: エントリ保存）

```
クライアント（TypeTrace エディタ）
  │
  │  PUT /api/v1/entries/:id
  │  { content, mediaUrls, editorType, editorVersion, extension }
  │
  ▼
presentation/routes/entries.ts
  │  HTTP → UpdateEntryInput に変換
  ▼
application/usecases/update-entry.ts
  │  entryRepo.save(entry) + snapshotRepo.append(snapshot)
  ▼
domain/gateways/ (IF)
  │  entry-repository.gateway.ts
  │  entry-snapshot-repository.gateway.ts
  ▼
infrastructure/repositories/
  │  supabase-entry.repository.ts         → entries UPSERT
  │  supabase-entry-snapshot.repository.ts → entry_snapshots INSERT
  ▼
Supabase (PostgreSQL)
  │  entries テーブル: BaseEntry（typed JSON）
  │  entry_snapshots テーブル: content + editorType + editorVersion + extension（opaque JSON）
```

---

## 並列開発フェーズ

gateway IF を「契約」として先に確定させ、以降のレイヤーを並列実装する。

```
Phase A: 契約を決める（直列）
  1. domain/models/entry.ts, entry-snapshot.ts
  2. domain/gateways/entry-repository.gateway.ts
  3. domain/gateways/entry-snapshot-repository.gateway.ts
  ↓ 契約確定

Phase B: 並列実装（触るファイルが完全に別）
  B1: domain/services/snapshot-restoration.service.ts  ← 純粋ドメインロジック
  B2: infrastructure/repositories/supabase-entry.repository.ts
  B3: infrastructure/repositories/supabase-entry-snapshot.repository.ts
  B4: presentation/routes/entries.ts + middleware/

Phase C: 統合（直列）
  application/usecases/ でレイヤーを結合
```

Phase B の4タスクは触るファイルが完全に別なので **4並列で同時に実行可能**。

---

## ガードレール

### 1. dependency-cruiser によるレイヤー間依存方向の自動検証

```
domain/ → infrastructure/        ❌ 禁止
domain/ → presentation/          ❌ 禁止
domain/ → application/           ❌ 禁止
application/ → infrastructure/   ❌ 禁止（gateway IF 経由のみ）
presentation/ → infrastructure/  ❌ 禁止
コンテキスト間の直接依存          ❌ 禁止（shared/ 経由のみ）
```

CI で PR ごとに自動検証する。

### 2. レイヤーごとのテスト原則

| レイヤー | テスト種別 | 方針 |
| --- | --- | --- |
| domain/models, domain/services | ユニットテスト | 全ロジックに必須。外部依存なしなので高速 |
| application/usecases | ユニットテスト | gateway をモックして処理フローを検証 |
| infrastructure/repositories | インテグレーションテスト | 実際の Supabase に対して実行 |
| presentation/routes | E2Eテスト | APIエンドポイントの結合テスト |

### 3. Git フック（品質チェックの3段構え）

| タイミング | チェック内容 |
| --- | --- |
| pre-commit | lint-staged で変更ファイルのみ Biome check |
| pre-push | lint + typecheck（全体） |
| CI | Biome + dependency-cruiser + テスト |
- `-no-verify` は原則禁止（[CLAUDE.md](http://claude.md/) に明記）。

### 4. 1ユースケース = 1ファイル

### 5. [CLAUDE.md](http://claude.md/) + slash command による情報の構造化

- [CLAUDE.md](http://claude.md/): 共通ルール（薄く保つ）
- slash command: タスクに応じた専門情報を注入

```
.claude/commands/
├── plan.md              # 設計ドキュメント作成
├── review.md            # 設計ガイドライン違反チェック
├── entry-backend.md     # entry バックエンド実装時のガイド
└── entry-frontend.md    # entry フロントエンド実装時のガイド
```

---

## DB設計

EDITOR_API_INTERFACE.md に準拠。

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

create index idx_entries_user on entries(user_id, created_at desc);
create index idx_snapshots_entry on entry_snapshots(entry_id, created_at desc);

alter table public.entries enable row level security;
alter table public.entry_snapshots enable row level security;

create policy "entries_own_data" on public.entries
  for all using (user_id = auth.uid());

create policy "snapshots_own_data" on public.entry_snapshots
  for all using (
    entry_id in (select id from public.entries where user_id = auth.uid())
  );
```

---

## REST API エンドポイント

```
POST   /api/v1/entries              # 新規作成
GET    /api/v1/entries              # 一覧取得
GET    /api/v1/entries/:id          # 詳細取得（最新snapshot含む）
PUT    /api/v1/entries/:id          # 編集保存
DELETE /api/v1/entries/:id          # 削除
```

---

## 将来のコンテキスト拡張

```
contexts/
├── entry/              # 現在のスコープ
├── fermentation/       # AI分析・発酵（将来）
└── shared/             # コンテキスト間共有
```

`fermentation/` は `entry/` の `content` を使うが、直接 import せず `shared/` 経由またはイベント駆動で疎結合に接続する。

---

## 関連ドキュメント

| ドキュメント | 内容 |
| --- | --- |
| [REQUIREMENTS.md](http://requirements.md/) | ビジョン, 設計原則, 機能要件, フェーズ計画 |
| EDITOR_API_INTERFACE.md | Base Entry / Editor Extension の型分離, DB設計, 運用例 (Case 1-6) |
| FERMENTATION_DESIGN.md | 多層発酵システム設計（将来） |

---

*初版: 2026-02-03 / entry スコープ + レイヤードアーキテクチャ: 2026-03-20*