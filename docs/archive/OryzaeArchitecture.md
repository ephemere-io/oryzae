# Oryzae Architecture

ジャーナリング支援アプリ「オリゼー」のサーバーサイドアーキテクチャ。
本ドキュメントがサーバー設計の **唯一の正** である。

現在のスコープは **entry（ジャーナルエントリ）** と **question（問い）** 。
型設計の詳細は `docs/archive/EditorAPIInterfaceDesign.md` を参照。

設計思想は [video-processor](https://github.com/team-mirai-volunteer/video-processor/tree/develop) のレイヤードアーキテクチャに基づく。
参考記事: [超並列LLMコーディングのハーネスエンジニアリング](https://note.com/jujunjun110/n/n66306cab294a)

---

## 1. システム構成

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
│  Server Layer (Hono on Node.js / Vercel)         │
│                                                   │
│  presentation → application → domain ← infrastructure │
└──────────────────────────────────────────────────┘
```

MVP はサーバーサイドの API 配信を先に完成させる。
クライアントは後続フェーズで接続する。

---

## 2. 技術スタック

| カテゴリ | 技術 | 選定理由 |
| --- | --- | --- |
| 言語 | TypeScript | 全レイヤー統一。LLM が最も得意な言語 |
| ランタイム | Node.js（開発）/ Vercel Serverless Functions（本番） | Hono の Vercel アダプター (`@hono/vercel`) で簡潔にデプロイ |
| API フレームワーク | Hono + Zod | 軽量・高速。Zod でリクエストバリデーション |
| DB / 認証 / Storage | Supabase (PostgreSQL + Auth + RLS + Storage) | マネージドで MVP 向き。Vercel とは独立して利用 |
| モノレポ | pnpm workspaces | シンプルに始める |
| リンター / フォーマッタ | Biome | 高速。ESLint + Prettier の代替 |
| デッドコード検出 | Knip | 不要コードの蓄積を防ぐ |
| テスト | Vitest | 高速、TypeScript ネイティブ |

---

## 3. レイヤードアーキテクチャ

### 3.1 依存方向（絶対ルール）

```
presentation → application → domain ← infrastructure
```

- **domain は何にも依存しない**（最内層）
- infrastructure は domain の gateway インターフェースを実装する（依存性逆転）
- presentation → infrastructure の直接依存は **DI 組み立て時のみ** 許容
- application → infrastructure の直接依存は禁止（gateway IF 経由のみ）

### 3.2 各レイヤーの責務

| レイヤー | 責務 | 知っていいもの | 知ってはいけないもの |
| --- | --- | --- | --- |
| **presentation** | HTTP ↔ ユースケース変換、バリデーション、認証、DI 組み立て | Hono, Zod, infrastructure（DI組み立てのみ） | Supabase の内部詳細 |
| **application** | ユースケースごとの処理フロー | domain の全要素（models, services, gateways IF） | infrastructure の具体実装 |
| **domain** | ビジネスルール、Result 型によるエラー表現 | 自分自身のみ | 他の全レイヤー |
| **infrastructure** | 外部依存の具体実装 | domain の gateways IF と models | application, presentation |

### 3.3 ドメイン層の3要素

```
domain/
├── models/       ドメインモデルの型定義とバリデーション
├── services/     複数モデルをまたぐ純粋なドメインロジック
└── gateways/     外部依存すべての抽象インターフェース
```

| ディレクトリ | 何を置くか | 外部依存 |
| --- | --- | --- |
| **models/** | 単一モデルの型、不変条件、ファクトリ、Result 型 | なし |
| **services/** | 複数モデルをまたぐドメインロジック。**純粋関数のみ。gateway を直接呼ばない** | なし |
| **gateways/** | DB・外部 API・ストレージ等あらゆる外部依存の **抽象 IF のみ** | なし（IF のみ） |

### 3.4 インポートルールマトリクス

| From ＼ To | domain | application | infrastructure | presentation | shared |
| --- | --- | --- | --- | --- | --- |
| **domain** | self | NO | NO | NO | NO |
| **application** | YES | self | NO | NO | YES |
| **infrastructure** | YES (gateways+models) | NO | self | NO | YES |
| **presentation** | NO | YES | YES (DI 組み立てのみ) | self | YES |

> **DI 組み立ての許容**: presentation 層のルートファイルが infrastructure の具体クラスを `new` してユースケースに注入する。これはアーキテクチャ上の例外として明示的に許容する。将来的に Composition Root に分離可能。

---

## 4. ディレクトリ構成

Bounded Context 単位でディレクトリを完全に分離する。
現在は entry コンテキストのみ。新しいコンテキストを追加する際も同じ構造で拡張する。

```
apps/server/src/
├── contexts/
│   ├── entry/                                    # エントリ管理コンテキスト
│   │   ├── presentation/
│   │   │   └── routes/
│   │   │       └── entries.ts                    # API エンドポイント定義 + DI 組み立て
│   │   ├── application/
│   │   │   ├── usecases/
│   │   │   │   ├── create-entry.usecase.ts
│   │   │   │   ├── update-entry.usecase.ts
│   │   │   │   ├── get-entry.usecase.ts
│   │   │   │   ├── list-entries.usecase.ts
│   │   │   │   └── delete-entry.usecase.ts
│   │   │   └── errors/
│   │   │       └── entry.errors.ts               # アプリケーション層のエラークラス
│   │   ├── domain/
│   │   │   ├── models/
│   │   │   │   ├── entry.ts                      # Entry class（リッチドメインモデル）
│   │   │   │   └── entry-snapshot.ts             # EntrySnapshot class
│   │   │   ├── services/
│   │   │   │   └── snapshot-restoration.service.ts
│   │   │   └── gateways/
│   │   │       ├── entry-repository.gateway.ts
│   │   │       └── entry-snapshot-repository.gateway.ts
│   │   └── infrastructure/
│   │       └── repositories/
│   │           ├── supabase-entry.repository.ts
│   │           └── supabase-entry-snapshot.repository.ts
│   │
│   └── shared/                                   # コンテキスト間共有
│       ├── domain/
│       │   └── types/
│       │       └── result.ts                     # 共通 Result<T, E> 型 + ok()/err() ヘルパー
│       ├── application/
│       │   └── errors/
│       │       └── application.errors.ts         # ApplicationError 基底クラス
│       ├── infrastructure/
│       │   └── supabase-client.ts                # DB 接続の共通設定
│       └── presentation/
│           └── middleware/
│               ├── auth.ts                       # Supabase Auth 認証
│               └── error-handler.ts              # グローバルエラーハンドラ
│
├── index.ts                                      # エントリーポイント
│
├── packages/
│   └── shared/                                   # クライアント・サーバー共有の型定義
│       └── types/
│
└── supabase/
    └── migrations/                               # DB マイグレーション
```

### ファイル命名規則

| 種別 | 命名パターン | 例 |
| --- | --- | --- |
| ユースケース | `{動詞}-{対象}.usecase.ts` | `create-entry.usecase.ts` |
| ドメインモデル | `{モデル名}.ts` | `entry.ts`, `entry-snapshot.ts` |
| ドメインサービス | `{対象}.service.ts` | `snapshot-restoration.service.ts` |
| gateway IF（DB） | `{対象}-repository.gateway.ts` | `entry-repository.gateway.ts` |
| gateway IF（外部 API 等） | `{対象}.gateway.ts` | `ai.gateway.ts`, `storage.gateway.ts` |
| infrastructure 実装（DB） | `{具体技術}-{対象}.repository.ts` | `supabase-entry.repository.ts` |
| infrastructure 実装（外部 API 等） | `{対象}.client.ts` | `openai.client.ts` |
| ルート | `{リソース名}.ts` | `entries.ts` |
| エラー | `{対象}.errors.ts` | `entry.errors.ts` |
| テスト | `{ファイル名}.test.ts`（同一ディレクトリに配置） | `snapshot-restoration.service.test.ts` |

---

## 5. Entry ドメイン設計

video-processor に準拠したリッチドメインモデルパターンを採用する。

### ドメインモデルの共通パターン

すべてのドメインモデルは以下のパターンに従う:

```
class Model {
  private constructor(props: ModelProps)     // 外部からの直接生成を禁止
  static create(params, generateId) → Result<Model, ModelError>  // バリデーション付きファクトリ
  static fromProps(props) → Model            // DB復元用（バリデーションなし）
  withXxx(args) → Result<Model, ModelError>  // イミュータブルな状態変更
  toProps() → ModelProps                     // プレーンオブジェクトに変換
}
```

- `generateId: () => string` は外部から注入（domain を純粋に保つ）
- エラー型はモデルごとの判別共用体: `{ type: string; message: string }`
- gateway IF は class インスタンスを直接受け渡す

### models/entry.ts

```typescript
export type EntryError =
  | { type: 'EMPTY_CONTENT'; message: string }
  | { type: 'CONTENT_TOO_LONG'; message: string }

export class Entry {
  readonly id: string
  readonly userId: string
  readonly content: string
  readonly mediaUrls: string[]
  readonly createdAt: string
  readonly updatedAt: string

  private constructor(props: EntryProps) { /* assigns all props */ }

  static create(params: CreateEntryParams, generateId: () => string): Result<Entry, EntryError>
  static fromProps(props: EntryProps): Entry
  withContent(content: string, mediaUrls: string[]): Result<Entry, EntryError>
  toProps(): EntryProps
}
```

### models/entry-snapshot.ts

保存のたびに 1 行追記される immutable な履歴。
`extension` は opaque JSON — ドメイン層はこの中身を解釈しない。

```typescript
export class EntrySnapshot {
  readonly id: string
  readonly entryId: string
  readonly content: string
  readonly editorType: string
  readonly editorVersion: string
  readonly extension: Record<string, unknown>
  readonly createdAt: string

  private constructor(props: EntrySnapshotProps) { /* assigns all props */ }

  static create(params: CreateEntrySnapshotParams, generateId: () => string): EntrySnapshot
  static fromProps(props: EntrySnapshotProps): EntrySnapshot
  toProps(): EntrySnapshotProps
}
```

### gateways（gateway IF は class インスタンスを受け渡す）

```typescript
export interface EntryRepositoryGateway {
  findById(id: string): Promise<Entry | null>
  listByUserId(userId: string, cursor?: string, limit?: number): Promise<Entry[]>
  save(entry: Entry): Promise<void>
  delete(id: string): Promise<void>
}

export interface EntrySnapshotRepositoryGateway {
  append(snapshot: EntrySnapshot): Promise<void>
  findLatestByEntryId(entryId: string): Promise<EntrySnapshot | null>
}
```

### services/snapshot-restoration.service.ts

Entry x Snapshot をまたぐドメインロジック。外部依存なし。Result 型で返す。

```typescript
export function resolveExtension(
  latestSnapshot: EntrySnapshot | null,
  requestedEditorType: string
): Result<Record<string, unknown>, 'no-snapshot' | 'editor-mismatch'>
```

---

## 6. エラーハンドリング

### エラーの流れ

```
domain:       Result<T, E> を返す（throw しない）
application:  Result を受け取り、失敗なら throw に変換
presentation: throw をキャッチして HTTP レスポンスに変換
```

### 6.1 Result<T, E> 型（domain 層）

domain 層は例外を投げない。すべての失敗を戻り値で表現する。

```typescript
// shared/domain/types/result.ts
export type Result<T, E> =
  | { success: true; value: T }
  | { success: false; error: E }

export function ok<T, E>(value: T): Result<T, E>
export function err<T, E>(error: E): Result<T, E>
```

- 成功: `ok(value)` → `{ success: true, value }`
- 失敗: `err(error)` → `{ success: false, error }`
- エラー型はモデルごとの判別共用体: `{ type: string; message: string }`
- `T | null` で十分なケース（findById 等）はそのまま使ってよい

### 6.2 throw（application / infrastructure 層）

application 層は `ApplicationError` 基底クラスを継承したエラーを throw する。

```typescript
// shared/application/errors/application.errors.ts
export abstract class ApplicationError extends Error {
  abstract readonly statusCode: number
}

export class ValidationError extends ApplicationError {
  readonly statusCode = 400
}

export class NotFoundError extends ApplicationError {
  readonly statusCode = 404
}
```

```typescript
// entry/application/errors/entry.errors.ts
export class EntryNotFoundError extends NotFoundError { ... }
export class EntryValidationError extends ValidationError { ... }
```

usecase での変換パターン:

```typescript
const result = Entry.create(params, generateId)
if (!result.success) {
  throw new EntryValidationError(result.error.message)  // Result → throw
}
const entry = result.value
```

### 6.3 ErrorHandler（presentation 層）

グローバルエラーハンドラが `ApplicationError` の `statusCode` で HTTP レスポンスに変換する。

```typescript
// shared/presentation/middleware/error-handler.ts
export function errorHandler(err: Error, c: Context) {
  if (err instanceof ApplicationError) {
    return c.json({ error: err.message }, err.statusCode)
  }
  return c.json({ error: 'Internal server error' }, 500)
}
```

---

## 7. REST API

```
POST   /api/v1/entries              新規作成
GET    /api/v1/entries              一覧取得（カーソルページネーション）
GET    /api/v1/entries/:id          詳細取得（最新 snapshot 含む）
PUT    /api/v1/entries/:id          編集保存（entries 更新 + snapshot 追記）
DELETE /api/v1/entries/:id          削除（cascade で snapshots も削除）
```

- 認証: `Authorization: Bearer <access_token>` — shared auth middleware で検証
- ページネーション: カーソルベース（`created_at` 降順）
- バリデーション: Zod スキーマで request body を検証

---

## 8. DB 設計

`EditorAPIInterfaceDesign.md` に準拠。

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

マイグレーション命名: `{連番}_{説明}.sql`（例: `00001_create_entries.sql`）

---

## 9. ガードレール

### 9.1 dependency-cruiser によるレイヤー依存の自動検証

CI で PR ごとに検証する。

```
domain/ → infrastructure/        ❌ 禁止
domain/ → presentation/          ❌ 禁止
domain/ → application/           ❌ 禁止
application/ → infrastructure/   ❌ 禁止（gateway IF 経由のみ）
presentation/ → infrastructure/  ⚠️ DI 組み立てのみ許容
コンテキスト間の直接依存          ❌ 禁止（shared/ 経由のみ）
循環依存                          ❌ 禁止
```

### 9.2 テスト戦略（4段階）

| レイヤー | テスト種別 | 方針 |
| --- | --- | --- |
| domain/models, domain/services | ユニットテスト | 全ロジックに必須。外部依存なし |
| application/usecases | ユニットテスト | gateway をモックして処理フローを検証 |
| infrastructure/repositories | インテグレーションテスト | 実際の Supabase に対して実行 |
| presentation/routes | E2E テスト | Hono テストクライアントで API エンドポイントを結合テスト |

テストファイルはソースと同一ディレクトリに `*.test.ts` として配置する。

### 9.3 Git フック（品質チェックの3段構え）

| タイミング | チェック内容 |
| --- | --- |
| pre-commit | lint-staged で変更ファイルのみ Biome check |
| pre-push | lint + typecheck（全体） |
| CI | Biome + Knip + dependency-cruiser + テスト |

**`--no-verify` は原則禁止。**

### 9.4 コーディング規約（Biome）

| 項目 | ルール |
| --- | --- |
| クォート | シングルクォート |
| セミコロン | あり |
| インデント | 2スペース |
| フォーマッタ | Biome（ESLint + Prettier の代替） |

### 9.5 デッドコード検出（Knip）

CI で未使用の export・依存を検出する。不要コードの蓄積を防ぐ。

---

## 10. 並列開発フロー

gateway IF を「契約」として先に確定させ、以降のレイヤーを並列実装する。

```
Phase A: 契約を決める（直列）
  domain/models/      → ドメインモデルの型定義
  domain/gateways/    → 外部依存の抽象 IF 定義
  ↓ 契約確定。以降は触るファイルが完全に別なので並列実装可能

Phase B: 並列実装
  B1: domain/services/     ← 純粋ロジック
  B2: infrastructure/      ← gateway IF の具体実装
  B3: presentation/        ← ルート + ミドルウェア

Phase C: 統合（直列）
  application/usecases/ で全レイヤーを結合
```

### Claude Code への指示テンプレート

```
下記設計ドキュメントの Phase B2 を実装してください。
設計書: docs/OryzaeArchitecture.md
並列で別のエージェントも別のタスクを作業しているので、他のタスクは着手しないでください。
```

---

## 11. Claude Code 連携

### CLAUDE.md（薄く保つ）

CLAUDE.md に書くもの（常に読まれる共通情報）:
- クイックコマンド一覧（dev, lint, typecheck, test）
- ディレクトリ構成の概要
- 依存方向ルール（1行）
- コーディング規約
- `--no-verify` 禁止
- 設計ドキュメントへのリンク

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

## 12. 将来のコンテキスト拡張

```
contexts/
├── entry/              # 現在のスコープ
├── {new-context}/      # 将来追加するコンテキスト
│   ├── presentation/
│   ├── application/
│   ├── domain/
│   └── infrastructure/
└── shared/             # コンテキスト間共有
```

新しいコンテキストを追加する際の原則:
- 同じ4レイヤー構成（presentation / application / domain / infrastructure）を踏襲する
- コンテキスト間の直接 import は禁止。`shared/` 経由またはイベント駆動で疎結合に接続する
- gateway IF を先に定義し、並列開発フローに従う

---

## 13. 関連ドキュメント

| ドキュメント | 内容 |
| --- | --- |
| `docs/archive/EditorAPIInterfaceDesign.md` | Base Entry / Editor Extension の型分離, DB 設計, 運用例 (Case 1-6) |
| `docs/archive/question_proposal.md` | 問いモデルの仕様（初期要件） |
| `docs/archive/oryzae-data-schema.html` | 全テーブルスキーマ（初期設計） |

| 外部リソース | 内容 |
| --- | --- |
| [video-processor](https://github.com/team-mirai-volunteer/video-processor/tree/develop) | 本アーキテクチャの参考実装。DDD + レイヤードアーキテクチャの実プロジェクト |
| [超並列LLMコーディングのハーネスエンジニアリング](https://note.com/jujunjun110/n/n66306cab294a) | 設計思想の元記事。並列開発フロー、ガードレールの考え方 |

---

*統合版作成: 2026-04-02 / 初版: 2026-02-03*
