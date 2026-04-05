# Strategy C: API バリデーションテスト

`evaluate_script` からバックエンド API を直接呼び出し、バリデーションロジックやエラーハンドリングを検証する。

## いつ使うか

- UIからは到達しにくいバリデーションエラーを検証したい
- エントリ・質問の CRUD 操作の正常系/異常系を網羅的にテストしたい
- バックエンドのバリデーションロジックがリグレッションしていないか確認したい

## 手順

### 1. 認証トークンの取得

`scripts/get-token.js` を `evaluate_script` で実行し、localStorage から認証トークンを取得する。

### 2. API 呼び出し

`scripts/api-call.js` を `evaluate_script` で実行。args に [method, path, bodyJson] を渡す。

### 3. テストの流れ（例: エントリ作成の境界値テスト）

```
1. Read scripts/get-token.js → evaluate_script で実行 → トークン取得
2. Read scripts/api-call.js → evaluate_script で実行（正常系）
   → ステータス 201 を期待
3. Read scripts/api-call.js → evaluate_script で実行（空文字コンテンツ）
   → ステータス 400 を期待
4. Read scripts/api-call.js → evaluate_script で実行（100,000文字超）
   → ステータス 400 を期待
```

## API エンドポイント

エンドポイント一覧はコードから動的に取得する:
```
Read apps/server/src/app.ts
```

主要エンドポイント:
- `POST /api/v1/auth/login` — ログイン
- `POST /api/v1/auth/signup` — サインアップ
- `GET /POST /PUT /DELETE /api/v1/entries` — エントリ CRUD
- `GET /POST /api/v1/questions` — 質問 CRUD
- `POST /api/v1/questions/:id/archive` — アーカイブ

## 注意点

- テストで作成したデータは削除すること（エントリは DELETE、質問はアーカイブ）
- バリデーションルールの定数は `packages/shared/src/constants.ts` で確認
