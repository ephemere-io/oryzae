# バックエンドアーキテクチャガイド

Oryzae サーバーサイドの横断的なアーキテクチャルール。
Bounded Context に依らず、全バックエンドコードに適用される。

設計思想は [video-processor](https://github.com/team-mirai-volunteer/video-processor/tree/develop) のレイヤードアーキテクチャに基づく。

---

## 技術スタック

| カテゴリ | 技術 | 選定理由 |
| --- | --- | --- |
| 言語 | TypeScript | 全レイヤー統一 |
| API フレームワーク | Hono + Zod | 軽量・高速。Zod でバリデーション |
| DB / 認証 / Storage | Supabase (PostgreSQL + Auth + RLS + Storage) | マネージド |
| モノレポ | pnpm workspaces | シンプル |
| リンター | Biome | 高速。ESLint + Prettier 代替 |
| デッドコード | Knip | 未使用 export 検出 |
| テスト | Vitest | TypeScript ネイティブ |

---

## レイヤードアーキテクチャ

### 依存方向（絶対ルール）

```
presentation → application → domain ← infrastructure
```

- **domain は何にも依存しない**（最内層）
- infrastructure は domain の gateway IF を実装する（依存性逆転）
- presentation → infrastructure の直接依存は **DI 組み立て時のみ** 許容
- application → infrastructure の直接依存は禁止（gateway IF 経由のみ）

### 各レイヤーの責務

| レイヤー | 責務 | 知っていいもの | 知ってはいけないもの |
| --- | --- | --- | --- |
| **presentation** | HTTP ↔ ユースケース変換、Zod バリデーション、DI 組み立て | Hono, Zod, infrastructure (DI のみ) | Supabase 内部詳細 |
| **application** | ユースケースごとの処理フロー | domain の全要素 | infrastructure 具体実装 |
| **domain** | ビジネスルール、Result 型によるエラー表現 | 自分自身のみ | 他の全レイヤー |
| **infrastructure** | 外部依存の具体実装 | domain の gateways IF + models | application, presentation |

### インポートルールマトリクス

| From ＼ To | domain | application | infrastructure | presentation | shared |
| --- | --- | --- | --- | --- | --- |
| **domain** | self | NO | NO | NO | NO |
| **application** | YES | self | NO | NO | YES |
| **infrastructure** | YES (gateways+models) | NO | self | NO | YES |
| **presentation** | NO | YES | YES (DI のみ) | self | YES |

### ドメイン層の3要素

```
domain/
├── models/       ドメインモデル（型、不変条件、ファクトリ）
├── services/     複数モデルをまたぐ純粋ドメインロジック
└── gateways/     外部依存の抽象 IF のみ
```

---

## ドメインモデルパターン

video-processor に準拠したリッチドメインモデル。

```typescript
// エラー型: モデルごとの判別共用体
type XxxError = { type: 'ERROR_CODE'; message: string }

// Props: プレーンオブジェクト（DB ↔ class 変換用）
interface XxxProps { ... }

class Xxx {
  readonly field: Type                          // 全フィールド readonly

  private constructor(props: XxxProps)          // 外部からの直接生成を禁止

  static create(params, generateId: () => string): Result<Xxx, XxxError>
  // バリデーション付きファクトリ。generateId は外部注入

  static fromProps(props: XxxProps): Xxx        // DB 復元（バリデーションなし）

  withField(value): Result<Xxx, XxxError>       // 失敗しうる状態変更
  withStatus(status): Xxx                        // 常に安全な状態変更

  toProps(): XxxProps                            // プレーンオブジェクトに変換
}
```

---

## エラーハンドリング

```
domain      → Result<T, E> を返す（throw 禁止）
application → if (!result.success) throw new ApplicationError(...)
infra       → 外部エラーをそのまま throw
presentation → errorHandler で ApplicationError.statusCode → HTTP
```

### Result<T, E> 型（domain 層）

```typescript
// shared/domain/types/result.ts
type Result<T, E> = { success: true; value: T } | { success: false; error: E }
function ok<T, E>(value: T): Result<T, E>
function err<T, E>(error: E): Result<T, E>
```

### ApplicationError 階層（application 層）

```typescript
abstract class ApplicationError extends Error { abstract readonly statusCode: number }
class ValidationError extends ApplicationError { statusCode = 400 }
class NotFoundError extends ApplicationError { statusCode = 404 }
```

### usecase での変換パターン

```typescript
const result = Xxx.create(params, generateId)
if (!result.success) throw new XxxValidationError(result.error.message)
const xxx = result.value
```

---

## ディレクトリ構成

```
apps/server/src/
├── contexts/
│   ├── {context}/                    # Bounded Context（entry, question, ...）
│   │   ├── presentation/routes/     # Hono ルート + DI 組み立て
│   │   ├── application/usecases/    # 1 ユースケース = 1 ファイル
│   │   ├── application/errors/      # コンテキスト固有エラー
│   │   ├── domain/models/           # リッチドメインモデル
│   │   ├── domain/services/         # 純粋ドメインロジック
│   │   ├── domain/gateways/         # 外部依存の抽象 IF
│   │   └── infrastructure/repositories/  # Supabase 実装
│   └── shared/                      # コンテキスト間共有
├── app.ts                           # Hono アプリ定義
└── index.ts                         # ローカル dev エントリポイント
```

### ファイル命名規則

| 種別 | パターン | 例 |
| --- | --- | --- |
| ユースケース | `{動詞}-{対象}.usecase.ts` | `create-entry.usecase.ts` |
| ドメインモデル | `{モデル名}.ts` | `entry.ts` |
| ドメインサービス | `{対象}.service.ts` | `snapshot-restoration.service.ts` |
| gateway IF（DB） | `{対象}-repository.gateway.ts` | `entry-repository.gateway.ts` |
| gateway IF（API） | `{対象}.gateway.ts` | `ai.gateway.ts` |
| インフラ実装（DB） | `{技術}-{対象}.repository.ts` | `supabase-entry.repository.ts` |
| インフラ実装（API） | `{対象}.client.ts` | `openai.client.ts` |
| テスト | `{ファイル名}.test.ts`（同一ディレクトリ） | `snapshot-restoration.service.test.ts` |

---

## 並列開発フロー

gateway IF を「契約」として先に確定させ、以降のレイヤーを並列実装する。

```
Phase A: 契約を決める（直列）
  domain/models/   → ドメインモデルの型定義
  domain/gateways/ → 外部依存の抽象 IF 定義
  ↓ 契約確定

Phase B: 並列実装（触るファイルが完全に別）
  B1: domain/services/     ← 純粋ロジック
  B2: infrastructure/      ← gateway IF の具体実装
  B3: presentation/        ← ルート + ミドルウェア

Phase C: 統合（直列）
  application/usecases/ で全レイヤーを結合
```

---

## コンテキスト拡張ルール

新しい Bounded Context を追加する際:
- 同じ4レイヤー構成を踏襲する
- コンテキスト間の直接 import は禁止（shared/ 経由のみ）
- gateway IF を先に定義し、並列開発フローに従う
- dependency-cruiser のルールに新コンテキストを追加する

---

## 関連ドキュメント

| ドキュメント | 内容 |
| --- | --- |
| `docs/backend-testing-guide.md` | テスト戦略、ガードレール |
| `docs/entry-backend-guide.md` | Entry コンテキストの実装ガイド |
| `docs/question-backend-guide.md` | Question コンテキストの実装ガイド |
| `docs/infra-guide.md` | Vercel + Supabase デプロイ |

| 外部リソース | 内容 |
| --- | --- |
| [video-processor](https://github.com/team-mirai-volunteer/video-processor/tree/develop) | 参考実装 |
| [ハーネスエンジニアリング](https://note.com/jujunjun110/n/n66306cab294a) | 設計思想 |
