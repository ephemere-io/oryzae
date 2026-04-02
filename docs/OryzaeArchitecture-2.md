# Oryzae Architecture - 2

# Oryzae Architecture

ジャーナリング支援アプリ「オリゼー」のサーバーサイドアーキテクチャ。
Claude Code に渡して実装を進めるための指針ドキュメント。

現在のスコープは **entry（ジャーナルエントリ）** に限定する。
型設計の詳細は EDITOR_API_INTERFACE.md を正とする。

設計思想は [video-processor](https://github.com/team-mirai-volunteer/video-processor/tree/develop) のレイヤードアーキテクチャに基づく。

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
│  Server Layer (Supabase Edge Functions)          │
│                                                   │
│  presentation → application → domain ← infrastructure │
└──────────────────────────────────────────────────┘
```

MVP はサーバーサイドの API 配信を先に完成させる。
クライアントは後続フェーズで接続する。

---

## 技術スタック

| カテゴリ | 技術 | 選定理由 |
| --- | --- | --- |
| 言語 | TypeScript | 全レイヤー統一。LLM が最も得意な言語 |
| ランタイム | Supabase Edge Functions (Deno) | DB/認証と同一基盤でクイックに MVP を立てる |
| DB/認証/Storage | Supabase (PostgreSQL + Auth + RLS + Storage) | マネージドで MVP 向き |
| モノレポ | pnpm workspaces | シンプルに始める |
| リンター/フォーマッタ | Biome | 高速。ESLint + Prettier の代替 |
| デッドコード検出 | Knip | 不要コードの蓄積を防ぐ |

---

## レイヤードアーキテクチャ

### 依存方向（絶対ルール）

```
presentation → application → domain ← infrastructure
```

- **domain は何にも依存しない**（最内層）
- infrastructure は domain の gateway インターフェースを実装する（依存性逆転）
- presentation → infrastructure の直接依存は禁止
- application → infrastructure の直接依存は禁止（gateway IF 経由のみ）

### 各レイヤーの責務

| レイヤー | 責務 | 知っていいもの | 知ってはいけないもの |
| --- | --- | --- | --- |
| **presentation** | HTTP ↔ ユースケース変換、バリデーション、認証 | フレームワーク（Hono等）、Zod | Supabase、外部SDK |
| **application** | ユースケースごとの処理フロー | domain の全要素（models, services, gateways IF） | infrastructure の具体実装 |
| **domain** | ビジネスルール | 自分自身のみ | 他の全レイヤー |
| **infrastructure** | 外部依存の具体実装 | domain の gateways IF と models | application, presentation |

### ドメイン層の3要素

[video-processor](https://github.com/team-mirai-volunteer/video-processor/tree/develop) の実装パターンに基づく。

```
domain/
├── models/       ドメインモデルの型定義とバリデーション
├── services/     複数モデルをまたぐ純粋なドメインロジック
└── gateways/     外部依存すべての抽象インターフェース
```

| ディレクトリ | 何を置くか | 外部依存 | video-processor での実例 |
| --- | --- | --- | --- |
| **models/** | 単一モデルの型、不変条件、ファクトリ | なし | `clip.ts`, `video.ts`, `transcription.ts` |
| **services/** | 複数モデルをまたぐドメインロジック。純粋関数 | なし | `clip-analysis-prompt.service.ts`（プロンプト組立+パース） |
| **gateways/** | DB、外部API、ファイルシステム等あらゆる外部依存の抽象IF | なし（IFのみ） | `clip-repository.gateway.ts`（DB）、`ai.gateway.ts`（AI API）、`storage.gateway.ts`（GCS） |

**重要な区別:**

- **gateways/** は DB 操作だけでなく、外部 API・ストレージ等すべての外部依存の抽象を置く場所
- **services/** は外部依存を持たない。gateway を直接呼ばない。純粋なロジックのみ

---

## ディレクトリ構成

Bounded Context 単位でディレクトリを完全に分離する。
現在は entry コンテキストのみ。将来 fermentation 等を追加する際も同じ構造で拡張する。

```
apps/server/src/
├── contexts/
│   ├── entry/                                    # エントリ管理コンテキスト
│   │   ├── presentation/
│   │   │   └── routes/
│   │   │       └── entries.ts                    # APIエンドポイント定義
│   │   ├── application/
│   │   │   ├── usecases/
│   │   │   │   ├── create-entry.usecase.ts
│   │   │   │   ├── update-entry.usecase.ts
│   │   │   │   ├── get-entry.usecase.ts
│   │   │   │   ├── list-entries.usecase.ts
│   │   │   │   └── delete-entry.usecase.ts
│   │   │   └── errors/
│   │   │       └── entry.errors.ts
│   │   ├── domain/
│   │   │   ├── models/
│   │   │   │   ├── entry.ts                      # BaseEntry ドメインモデル
│   │   │   │   └── entry-snapshot.ts             # EntrySnapshot ドメインモデル
│   │   │   ├── services/
│   │   │   │   └── snapshot-restoration.service.ts
│   │   │   └── gateways/
│   │   │       ├── entry-repository.gateway.ts   # entries テーブル操作の抽象IF
│   │   │       └── entry-snapshot-repository.gateway.ts
│   │   └── infrastructure/
│   │       └── repositories/
│   │           ├── supabase-entry.repository.ts
│   │           └── supabase-entry-snapshot.repository.ts
│   │
│   └── shared/                                   # コンテキスト間共有
│       ├── domain/
│       │   └── gateways/                         # 共通の外部依存IF（将来）
│       ├── infrastructure/
│       │   └── supabase-client.ts                # DB接続の共通設定
│       └── presentation/
│           └── middleware/
│               ├── auth.ts                       # Supabase Auth 認証
│               └── error-handler.ts
│
├── index.ts                                      # エントリーポイント
│
├── packages/
│   └── shared/                                   # クライアント・サーバー共有の型定義
│       └── types/
│           ├── entry.ts                          # API リクエスト/レスポンス型
│           └── index.ts
│
└── supabase/
    └── migrations/                               # DBマイグレーション
```

### ファイル命名規則

video-processor に準拠:

| 種別 | 命名パターン | 例 |
| --- | --- | --- |
| ユースケース | `{動詞}-{対象}.usecase.ts` | `create-entry.usecase.ts` |
| ドメインモデル | `{モデル名}.ts` | `entry.ts`, `entry-snapshot.ts` |
| ドメインサービス | `{対象}.service.ts` | `snapshot-restoration.service.ts` |
| gateway IF | `{対象}-repository.gateway.ts` (DB) | `entry-repository.gateway.ts` |
| gateway IF | `{対象}.gateway.ts` (外部API等) | `ai.gateway.ts`, `storage.gateway.ts` |
| infrastructure 実装 | `{具体技術}-{対象}.repository.ts` (DB) | `supabase-entry.repository.ts` |
| infrastructure 実装 | `{対象}.client.ts` (外部API等) | `openai.client.ts` |
| ルート | `{リソース名}.ts` | `entries.ts` |
| エラー | `{対象}.errors.ts` | `entry.errors.ts` |

---

## Entry ドメイン設計

### domain/models/entry.ts

EDITOR_API_INTERFACE.md の Base Entry。サーバーが理解し、AI 分析・検索に使う。

```tsx
export interface BaseEntry {
  id: string
  content: string
  mediaUrls: string[]
  createdAt: string   // ISO 8601
  updatedAt: string   // ISO 8601
}
```

### domain/models/entry-snapshot.ts

保存のたびに1行追記される immutable な履歴。
`extension` は opaque JSON — ドメイン層はこの中身を解釈しない。

```tsx
export interface EntrySnapshot {
  id: string
  entryId: string
  content: string
  editorType: string
  editorVersion: string
  extension: Record<string, unknown>
  createdAt: string
}
```

### domain/gateways/entry-repository.gateway.ts

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

```tsx
import type { EntrySnapshot } from '../models/entry-snapshot'

export interface EntrySnapshotRepositoryGateway {
  /** immutable append-only */
  append(snapshot: Omit<EntrySnapshot, 'id' | 'createdAt'>): Promise<EntrySnapshot>

  /** 最新の1行を取得。エディタスイッチ判定に使う */
  findLatestByEntryId(entryId: string): Promise<EntrySnapshot | null>
}
```

### domain/services/snapshot-restoration.service.ts

Entry × Snapshot をまたぐドメインロジック。外部依存なし。
EDITOR_API_INTERFACE.md の Case 3（復元不可）/ Case 5（復元可能）を実装。

```tsx
import type { EntrySnapshot } from '../models/entry-snapshot'

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

## REST API

```
POST   /api/v1/entries              新規作成
GET    /api/v1/entries              一覧取得（カーソルページネーション）
GET    /api/v1/entries/:id          詳細取得（最新 snapshot 含む）
PUT    /api/v1/entries/:id          編集保存（entries 更新 + snapshot 追記）
DELETE /api/v1/entries/:id          削除（cascade で snapshots も削除）
```

---

## DB 設計

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

## 並列開発フロー

video-processor の開発手法に倣う。
gateway IF を「契約」として先に確定させ、以降のレイヤーを並列実装する。

```
Phase A: 契約を決める（直列）
  domain/models/      → BaseEntry, EntrySnapshot の型定義
  domain/gateways/    → EntryRepositoryGateway, EntrySnapshotRepositoryGateway の IF 定義
  ↓ 契約確定。以降は触るファイルが完全に別なので並列実装可能

Phase B: 並列実装
  B1: domain/services/snapshot-restoration.service.ts     ← 純粋ロジック
  B2: infrastructure/repositories/supabase-entry.repository.ts
  B3: infrastructure/repositories/supabase-entry-snapshot.repository.ts
  B4: presentation/routes/entries.ts + middleware/

Phase C: 統合（直列）
  application/usecases/ で全レイヤーを結合
```

Phase B は **4並列で同時実行可能**。

### Claude Code への指示テンプレート

```
下記設計ドキュメントの Phase B2 を実装してください。
設計書: docs/renewal/ARCHITECTURE.md
並列で別のエージェントも別のタスクを作業しているので、他のタスクは着手しないでください。
```

---

## ガードレール

### 1. dependency-cruiser によるレイヤー依存の自動検証

CI で PR ごとに検証。video-processor と同じルール体系。

```
domain/ → infrastructure/        ❌
domain/ → presentation/          ❌
domain/ → application/           ❌
application/ → infrastructure/   ❌（gateway IF 経由のみ）
presentation/ → infrastructure/  ❌
コンテキスト間の直接依存          ❌（shared/ 経由のみ）
循環依存                          ❌
```

### 2. レイヤーごとのテスト原則

| レイヤー | テスト種別 | 方針 |
| --- | --- | --- |
| domain/models, domain/services | ユニットテスト | 全ロジックに必須。外部依存なし |
| application/usecases | ユニットテスト | gateway をモックして処理フローを検証 |
| infrastructure/repositories | インテグレーションテスト | 実際の Supabase に対して実行 |

### 3. Git フック（品質チェックの3段構え）

video-processor と同じ構成。

| タイミング | チェック内容 |
| --- | --- |
| pre-commit | lint-staged で変更ファイルのみ Biome check |
| pre-push | lint + typecheck（全体） |
| CI | Biome + Knip + dependency-cruiser + テスト |
- **`-no-verify` は原則禁止**。[CLAUDE.md](http://claude.md/) に明記する。

### 4. コーディング規約

| 項目 | ルール |
| --- | --- |
| フォーマッタ | Biome（シングルクォート、セミコロンあり、インデント2スペース） |
| エラーハンドリング | domain 層は戻り値で表現、application/infrastructure 層は throw |
| ユースケース | 1ユースケース = 1ファイル |

---

## [CLAUDE.md](http://claude.md/) + slash command 設計

video-processor に倣い、[CLAUDE.md](http://claude.md/) は薄く保ち、slash command でタスク固有のガイドを注入する。

### [CLAUDE.md](http://claude.md/) に書くもの（常に読まれる共通情報）

- クイックコマンド一覧（dev, lint, typecheck, test）
- ディレクトリ構成の概要
- 依存方向ルール（1行）
- コーディング規約（Biome 設定）
- `-no-verify` 禁止
- 機能別ガイドへのリンク

### slash command

```
.claude/commands/
├── plan.md              # 設計ドキュメント作成 → docs/tasks/ に保存
├── review.md            # 設計ガイドライン違反チェック
├── entry-backend.md     # entry バックエンド実装（アーキテクチャガイド読込）
├── entry-frontend.md    # entry フロントエンド実装（将来）
├── pr.md                # ブランチ作成 → 品質チェック → PR 作成
└── sync.md              # develop を pull
```

---

## 将来のコンテキスト拡張

```
contexts/
├── entry/              # 現在のスコープ
├── fermentation/       # AI分析・発酵（将来）
└── shared/             # コンテキスト間共有
```

fermentation コンテキストは entry の content を使うが、entry を直接 import せず shared 経由で疎結合に接続する。
新しいコンテキストを追加する際も同じレイヤー構成（presentation / application / domain / infrastructure）を踏襲する。

---

## 関連ドキュメント

| ドキュメント | 内容 |
| --- | --- |
| EDITOR_API_INTERFACE.md | Base Entry / Editor Extension の型分離, DB設計, 運用例 (Case 1-6) |
| [REQUIREMENTS.md](http://requirements.md/) | ビジョン, 設計原則, 機能要件, フェーズ計画 |
| FERMENTATION_DESIGN.md | 多層発酵システム設計（将来） |

## 参考

| リソース | 内容 |
| --- | --- |
| [video-processor](https://github.com/team-mirai-volunteer/video-processor/tree/develop) | 本アーキテクチャの参考実装。DDD + レイヤードアーキテクチャの実プロジェクト |
| [超並列LLMコーディングのハーネスエンジニアリング](https://note.com/jujunjun110/n/n66306cab294a) | 設計思想の元記事。並列開発フロー、ガードレールの考え方 |