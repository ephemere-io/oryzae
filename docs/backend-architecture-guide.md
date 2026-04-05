# バックエンドアーキテクチャガイド

Oryzae サーバーサイドの横断的なアーキテクチャルール。
Bounded Context に依らず、全バックエンドコードに適用される。

設計思想は [video-processor](https://github.com/team-mirai-volunteer/video-processor/tree/develop) のレイヤードアーキテクチャに基づく。

---

## 技術選定の判断基準

| 判断軸 | 選定方針 |
| --- | --- |
| 言語 | TypeScript で全レイヤー統一。LLM が最も得意な言語 |
| API | 軽量フレームワーク + スキーマバリデーション |
| DB / 認証 | マネージドサービスで MVP を高速に立てる |
| モノレポ | シンプルに始め、必要になったら拡張する |
| リンター | 高速な統合ツール。ESLint + Prettier の分離を避ける |

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

| レイヤー | 責務 | 知ってはいけないもの |
| --- | --- | --- |
| **presentation** | HTTP ↔ ユースケース変換、バリデーション、DI 組み立て | DB クライアントの内部詳細 |
| **application** | ユースケースごとの処理フロー | infrastructure の具体実装 |
| **domain** | ビジネスルール、Result 型によるエラー表現 | 他の全レイヤー |
| **infrastructure** | 外部依存の具体実装 | application, presentation |

### インポートルールマトリクス

| From ＼ To | domain | application | infrastructure | presentation | shared |
| --- | --- | --- | --- | --- | --- |
| **domain** | self | NO | NO | NO | NO |
| **application** | YES | self | NO | NO | YES |
| **infrastructure** | YES (gateways+models) | NO | self | NO | YES |
| **presentation** | NO | YES | YES (DI のみ) | self | YES |

### なぜこの構造か

- domain を純粋に保つことで、ビジネスルールをテスト可能・再利用可能にする
- gateway IF による依存性逆転で、DB を差し替えてもドメインロジックに影響しない
- presentation が DI を組み立てることで、他の層はフレームワーク非依存になる

### ドメイン層の3要素

| 要素 | 何を置くか | 制約 |
| --- | --- | --- |
| **models** | 単一モデルの型、不変条件、ファクトリ | 外部依存なし |
| **services** | 複数モデルをまたぐ純粋ドメインロジック | gateway を呼ばない。純粋関数のみ |
| **gateways** | 外部依存の抽象 IF | IF の定義のみ。実装を含まない |

---

## ドメインモデルパターン

video-processor に準拠したリッチドメインモデル。全モデルがこのパターンに従う。

```typescript
class Model {
  readonly field: Type                          // 全フィールド readonly

  private constructor(props: ModelProps)         // 外部からの直接生成を禁止

  static create(params, generateId: () => string): Result<Model, ModelError>
  // バリデーション付きファクトリ。generateId は外部注入で domain を純粋に保つ

  static fromProps(props: ModelProps): Model     // DB 復元用（バリデーションなし、DB データを信頼）

  withField(value): Result<Model, ModelError>    // イミュータブルな状態変更（新インスタンス返却）

  toProps(): ModelProps                          // class → プレーンオブジェクト変換
}
```

**なぜリッチクラスか**: 貧血モデル（interface のみ）ではビジネスルールが usecase に漏れ出し、重複・不整合の温床になる。モデル自身がバリデーション・状態遷移を管理することで、ルールの一箇所化を実現する。

**エラー型**: モデルごとの判別共用体 `{ type: string; message: string }` で定義する。グローバルなエラー enum は使わない。

**gateway IF は class インスタンスを受け渡す**: Props ではなく class を渡すことで、repository が toProps() で変換し、fromProps() で復元する責務を明確にする。

---

## エラーハンドリング

### 原則

```
domain      → Result<T, E> を返す（throw 禁止）
application → Result を受け取り、失敗なら throw に変換
infra       → 外部エラーをそのまま throw
presentation → グローバルハンドラが throw → HTTP レスポンスに変換
```

**なぜ domain は throw しないか**: throw は型安全でなく、呼び出し元が失敗ケースを見逃しやすい。Result 型は成功・失敗の両方を型レベルで強制し、パターンマッチングで安全に処理できる。

**なぜ application は throw するか**: HTTP フレームワーク（Hono）のエラーハンドリング機構と統合するため。domain の Result を application で throw に変換し、presentation のグローバルハンドラで一元的に HTTP レスポンスにマッピングする。

---

## ディレクトリ構成の原則

各 Bounded Context は同じ4レイヤー構成を持つ:

```
contexts/
  {context}/
    presentation/    → HTTP ルート + DI 組み立て
    application/     → ユースケース（1ファイル = 1ユースケース）+ エラークラス
    domain/          → models + services + gateways
    infrastructure/  → gateway IF の具体実装
  shared/            → コンテキスト間共有（Result型、基底エラー、認証ミドルウェア等）
```

### ファイル命名規則

| 種別 | パターン |
| --- | --- |
| ユースケース | `{動詞}-{対象}.usecase.ts` |
| ドメインモデル | `{モデル名}.ts` |
| ドメインサービス | `{対象}.service.ts` |
| gateway IF（DB） | `{対象}-repository.gateway.ts` |
| gateway IF（外部 API） | `{対象}.gateway.ts` |
| インフラ実装（DB） | `{技術}-{対象}.repository.ts` |
| テスト | `{ファイル名}.test.ts`（ソースと同一ディレクトリ） |

---

## 並列開発フロー

gateway IF を「契約」として先に確定させ、以降のレイヤーを並列実装する。

```
Phase A: 契約（直列）
  domain/models/   → 型定義
  domain/gateways/ → 抽象 IF 定義
  ↓ 契約確定。以降は触るファイルが完全に別

Phase B: 並列実装
  B1: domain/services/     ← 純粋ロジック
  B2: infrastructure/      ← gateway 具体実装
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
- dependency-cruiser のルールに新コンテキストの隔離ルールを追加する

---

## 関連ドキュメント

| ドキュメント | 内容 |
| --- | --- |
| `docs/backend-testing-guide.md` | テスト戦略、ガードレール |
| `docs/entry-backend-guide.md` | Entry コンテキストのドメイン知識 |
| `docs/question-backend-guide.md` | Question コンテキストのドメイン知識 |
| `docs/infra-guide.md` | デプロイ・インフラ構成 |
