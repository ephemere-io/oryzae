# ドメインルール参照ガイド

ビジネスルールはコードに定義されている。このファイルは「どこを見るか」のポインタ集であり、ルール自体をここに複製しない。

## ビジネスルールの所在

テストケースを導出する際は、以下のファイルを **動的に Read/Grep** して最新のルールを把握する。

### Entry（ジャーナルエントリ）

```
apps/server/src/contexts/entry/domain/models/entry.ts
```

- `MAX_CONTENT_LENGTH` — コンテンツ最大長
- `create()` — バリデーション（空文字禁止、最大長）
- `withContent()` — 更新バリデーション

```
apps/server/src/contexts/entry/domain/models/entry-snapshot.ts
```

- エントリのスナップショット（編集履歴）
- `editorType`, `editorVersion`, `extension` — エディタメタデータ

### Question（質問/問い）

```
apps/server/src/contexts/question/domain/models/question.ts
```

- `create()` — 質問作成
- `withArchived()` / `withUnarchived()` — アーカイブ/復元
- `isActive` — アクティブ判定（not archived AND validated）
- Oryzae 提案の承認/却下ロジック

```
apps/server/src/contexts/question/domain/models/question-transaction.ts
```

- `MAX_STRING_LENGTH` — 質問テキスト最大長（64文字）
- テキスト編集のバージョン管理

### 共有バリデーションスキーマ

```
packages/shared/src/schemas.ts
```

- `createEntrySchema` — エントリ作成/更新のZodスキーマ
- `questionStringSchema` — 質問テキストのZodスキーマ
- `credentialsSchema` — 認証のZodスキーマ

```
packages/shared/src/constants.ts
```

- `MAX_CONTENT_LENGTH`, `MAX_QUESTION_STRING_LENGTH`

### API ルート

```
apps/server/src/app.ts
```

- 全エンドポイントの構成とミドルウェア（CORS, 認証）

```
apps/server/src/contexts/entry/presentation/routes/entries.ts
apps/server/src/contexts/question/presentation/routes/questions.ts
apps/server/src/contexts/question/presentation/routes/entry-questions.ts
apps/server/src/contexts/shared/presentation/routes/auth.ts
```

### フロントエンド構造

```
apps/client/src/features/auth/     — 認証（ログイン/サインアップ/ヘッダー）
apps/client/src/features/entries/  — エントリ（一覧/作成/編集/削除）
apps/client/src/features/questions/ — 質問（一覧/作成/アーカイブ/提案）
```

## テストケース導出の手順

1. ユーザーの指示からキーワードを抽出
2. 上記のポインタから該当するソースコードを `Read` / `Grep`
3. 以下のテストケースを導出:
   - **正常系**: 制約範囲内で成功
   - **境界値**: 制限値ちょうど / 制限値+1
   - **異常系**: 期待するエラーメッセージが表示される
   - **UI表示**: 関連画面の表示が正しい
4. 既存のユニットテスト（`apps/server/test/`）も参考にする
