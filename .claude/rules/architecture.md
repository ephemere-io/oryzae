---
paths:
  - "apps/server/src/**/*.ts"
---

# サーバーアーキテクチャルール

設計の正は以下の docs/ を参照:
- **`docs/backend-architecture-guide.md`** — レイヤー依存、ドメインモデルパターン、エラーハンドリング
- **`docs/entry-backend-guide.md`** — Entry コンテキスト固有の実装ガイド
- **`docs/question-backend-guide.md`** — Question コンテキスト固有の実装ガイド

要点:
- `presentation → application → domain ← infrastructure`
- domain は何にも依存しない。Result<T,E> で返す。throw 禁止
- ドメインモデルはリッチクラス（private constructor + create/fromProps/withXxx/toProps）
- **domain/models と domain/services のテストは必須**:
  - 新規ファイル作成時、対応する `.test.ts` を同時に作成すること
  - create() のバリデーション境界値（成功・各エラー）をテストすること
  - withXxx() のイミュータブル性をテストすること
  - fromProps → toProps のラウンドトリップをテストすること
  - テストなしで作業を完了してはならない
