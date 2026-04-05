# サーバーアーキテクチャ リファレンス（レビュー用）

本ファイルは `docs/OryzaeArchitecture.md` の要点をレビュー観点に特化して抽出したもの。
正式な設計は `docs/OryzaeArchitecture.md` を参照すること。

## レイヤー構成

```
apps/server/src/contexts/
  {context}/
    presentation/    routes/ (Hono + Zod + DI 組み立て)
    application/     usecases/ + errors/
    domain/          models/ + services/ + gateways/
    infrastructure/  repositories/
  shared/
    domain/types/    Result<T, E> + ok()/err()
    application/     ApplicationError 基底クラス
    presentation/    auth middleware, error-handler
    infrastructure/  supabase-client
```

## 依存方向マトリクス

| From ＼ To | domain | application | infrastructure | presentation | shared |
|-----------|--------|-------------|----------------|-------------|--------|
| domain | self | NO | NO | NO | NO |
| application | YES | self | NO | NO | YES |
| infrastructure | YES(gateways+models) | NO | self | NO | YES |
| presentation | NO | YES | YES(DIのみ) | self | YES |

## ドメインモデル必須パターン

```typescript
// エラー型: モデルごとの判別共用体
type XxxError = { type: 'ERROR_CODE'; message: string }

// Props: プレーンオブジェクト（DB ↔ class 変換用）
interface XxxProps { ... }

class Xxx {
  readonly field1: Type
  private constructor(props: XxxProps) { ... }

  // ファクトリ: バリデーション → Result で返す
  static create(params, generateId: () => string): Result<Xxx, XxxError>

  // DB 復元: バリデーションなし
  static fromProps(props: XxxProps): Xxx

  // 状態変更: イミュータブル（新インスタンスを返す）
  withField(value): Result<Xxx, XxxError>  // 失敗しうる場合
  withStatus(status): Xxx                   // 常に安全な場合

  // シリアライズ
  toProps(): XxxProps
}
```

## エラーハンドリングフロー

```
domain      → Result<T, E> を返す（throw 禁止）
application → if (!result.success) throw new XxxError(result.error.message)
infra       → 外部エラーをそのまま throw
presentation → app.onError(errorHandler) で ApplicationError.statusCode → HTTP
```

```typescript
// shared/application/errors/application.errors.ts
abstract class ApplicationError extends Error {
  abstract readonly statusCode: number
}
class ValidationError extends ApplicationError { statusCode = 400 }
class NotFoundError extends ApplicationError { statusCode = 404 }
```

## ゲートウェイパターン

```typescript
// domain/gateways/ — IF のみ、class インスタンスを受け渡す
interface XxxRepositoryGateway {
  findById(id: string): Promise<Xxx | null>  // class を返す
  save(xxx: Xxx): Promise<void>               // class を受け取る
}

// infrastructure/repositories/ — gateway を実装
class SupabaseXxxRepository implements XxxRepositoryGateway {
  async save(xxx: Xxx): Promise<void> {
    const props = xxx.toProps()  // class → plain object
    await this.supabase.from('table').upsert({ ...snakeCase(props) })
  }
  async findById(id: string): Promise<Xxx | null> {
    const { data } = await this.supabase.from('table')...
    return data ? Xxx.fromProps(toCamelCase(data)) : null  // DB → class
  }
}
```

## プレゼンテーション層のパターン

```typescript
// routes/xxx.ts — DI 組み立て + Zod バリデーション
const generateId = () => crypto.randomUUID()  // ここで定義

route.post('/', async (c) => {
  const body = schema.parse(await c.req.json())         // Zod バリデーション
  const repo = new SupabaseXxxRepository(c.get('supabase'))  // DI
  const usecase = new CreateXxxUsecase(repo, generateId)     // DI
  const result = await usecase.execute(c.get('userId'), body)
  return c.json(result, 201)
})
```

## Bounded Context 間の通信

- 直接 import 禁止（shared 経由のみ）
- 例外: presentation 層の DI 組み立てで他コンテキストの infrastructure を import する場合
  （例: entry-questions.ts が SupabaseEntryRepository を DI 注入）
- domain/application/infrastructure 間の直接参照は dependency-cruiser で禁止
