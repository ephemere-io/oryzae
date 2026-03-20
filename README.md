# Oryzae

ジャーナリング支援アプリ「オリゼー」のバックエンド。
日記・日誌を通じて「問い」を育て、記録を「発酵」させるためのサーバーサイド API。

## 技術スタック

| カテゴリ | 技術 |
|---|---|
| 言語 | TypeScript |
| API フレームワーク | Hono |
| DB / 認証 | Supabase (PostgreSQL + Auth + RLS) |
| モノレポ | pnpm workspaces |
| テスト | Vitest |
| バリデーション | Zod |

## 前提条件

- **Node.js** v20 以上
- **pnpm** v10 以上
- **Docker Desktop** （Supabase ローカル環境に必要）

## セットアップ

### 1. 依存インストール

```bash
pnpm install
```

### 2. Supabase CLI のインストール

```bash
brew install supabase/tap/supabase
```

### 3. Supabase ローカル環境の起動

```bash
supabase init     # 初回のみ（supabase/ ディレクトリが既にあればスキップ）
supabase start    # Docker でローカル Supabase を起動
```

起動すると以下のような情報が表示されます:

```
API URL: http://127.0.0.1:54321
anon key: eyJ...
service_role key: eyJ...
```

### 4. 環境変数の設定

```bash
cp apps/server/.env.example apps/server/.env
```

`.env` を編集して、`supabase start` で表示された値を設定:

```
SUPABASE_URL=http://127.0.0.1:54321
SUPABASE_ANON_KEY=（表示された anon key）
SUPABASE_SERVICE_ROLE_KEY=（表示された service_role key）
PORT=3000
```

### 5. DB マイグレーション

ローカル Supabase を使う場合、`supabase start` 時に `supabase/migrations/` 配下の SQL が自動適用されます。

手動で適用する場合:

```bash
supabase db reset
```

### 6. サーバー起動

```bash
pnpm --filter @oryzae/server dev
```

`Server running on http://localhost:3000` と表示されれば成功。

## 動作確認

### ヘルスチェック

```bash
curl http://localhost:3000/health
```

```json
{"status":"ok"}
```

### テストユーザーの作成

Supabase ローカルダッシュボード（http://127.0.0.1:54323）にアクセスし、
Authentication > Users から手動でユーザーを作成するか、以下のコマンドで作成:

```bash
# ユーザー登録
curl -X POST http://127.0.0.1:54321/auth/v1/signup \
  -H "apikey: YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "password123"}'
```

### アクセストークンの取得

```bash
# ログイン → access_token を取得
curl -X POST http://127.0.0.1:54321/auth/v1/token?grant_type=password \
  -H "apikey: YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "password": "password123"}'
```

レスポンスの `access_token` を以降のリクエストで使います。
以下のコマンドで変数に保存しておくと便利です:

```bash
TOKEN="取得した access_token をここに貼り付け"
```

### エントリの CRUD 操作

**新規作成**

```bash
curl -X POST http://localhost:3000/api/v1/entries \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "今日、カント君の展示に行った。",
    "mediaUrls": [],
    "editorType": "typetrace",
    "editorVersion": "1.0.0",
    "extension": {"averageWPM": 6.64, "erasureTraces": []}
  }'
```

**一覧取得**

```bash
curl http://localhost:3000/api/v1/entries \
  -H "Authorization: Bearer $TOKEN"
```

**詳細取得**（最新 snapshot 含む）

```bash
curl http://localhost:3000/api/v1/entries/{id} \
  -H "Authorization: Bearer $TOKEN"
```

**更新**

```bash
curl -X PUT http://localhost:3000/api/v1/entries/{id} \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "content": "今日、カント君の展示に行った。すごく良かった。",
    "mediaUrls": [],
    "editorType": "typetrace",
    "editorVersion": "1.0.0",
    "extension": {"averageWPM": 7.2, "erasureTraces": []}
  }'
```

**削除**

```bash
curl -X DELETE http://localhost:3000/api/v1/entries/{id} \
  -H "Authorization: Bearer $TOKEN"
```

## テスト

```bash
# ユニットテスト実行
pnpm --filter @oryzae/server test

# ウォッチモード
pnpm --filter @oryzae/server test:watch

# 型チェック
pnpm --filter @oryzae/server typecheck
```

## API エンドポイント

| メソッド | パス | 説明 |
|---|---|---|
| GET | `/health` | ヘルスチェック |
| POST | `/api/v1/entries` | エントリ新規作成 |
| GET | `/api/v1/entries` | エントリ一覧（`?cursor=&limit=` でページネーション） |
| GET | `/api/v1/entries/:id` | エントリ詳細（最新 snapshot 含む） |
| PUT | `/api/v1/entries/:id` | エントリ更新（entries 更新 + snapshot 追記） |
| DELETE | `/api/v1/entries/:id` | エントリ削除（cascade で snapshots も削除） |

## ディレクトリ構成

```
apps/server/src/
├── index.ts                              # エントリーポイント
└── contexts/
    ├── entry/                            # エントリ管理コンテキスト
    │   ├── presentation/routes/          # HTTP ↔ ユースケース変換
    │   ├── application/usecases/         # 1 ユースケース = 1 ファイル
    │   ├── domain/
    │   │   ├── models/                   # BaseEntry, EntrySnapshot
    │   │   ├── services/                 # 純粋ドメインロジック
    │   │   └── gateways/                 # 外部依存の抽象 IF
    │   └── infrastructure/repositories/  # Supabase 実装
    └── shared/                           # コンテキスト間共有
        ├── infrastructure/               # Supabase クライアント
        └── presentation/middleware/      # 認証, エラーハンドリング

supabase/migrations/                      # DB マイグレーション
```

## アーキテクチャ

レイヤードアーキテクチャを採用。依存方向は:

```
presentation → application → domain ← infrastructure
```

- **domain** は何にも依存しない（最内層）
- **infrastructure** は domain の gateway IF を実装する（依存性逆転）
- 詳細は `OryzaeArchitecture-2.md` を参照
