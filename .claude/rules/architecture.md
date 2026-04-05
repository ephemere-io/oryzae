---
paths:
  - "apps/server/src/**/*.ts"
---

# サーバーアーキテクチャルール

## レイヤー依存方向（絶対ルール）

```
presentation → application → domain ← infrastructure
```

- domain は自分自身以外を import しない（shared/domain のみ例外）
- application は domain のみ import する（infrastructure を直接参照しない）
- infrastructure は domain の gateways + models のみ import する
- presentation は application + infrastructure を import する（DI 組み立てのみ）

## ドメインモデルパターン

全ドメインモデルは以下に従う:
- `private constructor(props: XxxProps)`
- `static create(params, generateId: () => string): Result<T, E>` または `T`
- `static fromProps(props): T`（DB 復元用、バリデーションなし）
- `withXxx(): Result<T, E>` または `T`（イミュータブルな状態変更）
- `toProps(): XxxProps`（プレーンオブジェクトに変換）
- 全フィールド `readonly`

## エラーの流れ

- domain: `ok()`/`err()` で `Result<T, E>` を返す。throw 禁止
- application: `result.success` を検査し、失敗なら `ApplicationError` 継承クラスを throw
- infrastructure: 外部エラーをそのまま throw
- presentation: `errorHandler` が `ApplicationError.statusCode` → HTTP レスポンスに変換

## ファイル命名規則

- ユースケース: `{動詞}-{対象}.usecase.ts`
- モデル: `{モデル名}.ts`
- サービス: `{対象}.service.ts`
- ゲートウェイ IF: `{対象}-repository.gateway.ts`（DB）/ `{対象}.gateway.ts`（外部 API）
- インフラ実装: `{技術}-{対象}.repository.ts` / `{対象}.client.ts`
- テスト: `{ファイル名}.test.ts`（ソースと同一ディレクトリに配置）
