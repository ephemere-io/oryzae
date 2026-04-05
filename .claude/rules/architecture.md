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
- **テストは各レイヤーで必須**:
  - テストは `test/` ディレクトリに分離する（`src/` にテストファイルを置かない）
  - `test/contexts/` が `src/contexts/` のディレクトリ構造をミラーする
  - `test/integration/` にインテグレーションテストを配置する
  - インポートは `@/` エイリアス（`src/` を指す）を使う
  - **domain (models, services)**: 全ロジックにユニットテスト必須
    - create() のバリデーション境界値、withXxx() のイミュータブル性、fromProps/toProps ラウンドトリップ
  - **application (usecases)**: 極力全ての usecase にユニットテスト必須
    - gateway を `vi.fn()` の手動スタブでモック。モッククラスやモックライブラリは使わない
    - 正常系の戻り値 + gateway 呼び出し引数を検証
    - 異常系は `rejects.toThrow(ApplicationError)` で検証
  - **infrastructure (repositories)**: インテグレーションテストを書く
    - `test/integration/` に配置。実際の DB に対して実行。環境がなければ `describe.skipIf` でスキップ
  - 新規ファイル作成時、対応するテストを `test/` に同時に作成すること
  - テストなしで作業を完了してはならない
