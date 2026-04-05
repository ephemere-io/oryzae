# クライアントアーキテクチャガイド

Oryzae フロントエンドの横断的なアーキテクチャルール。
全クライアントコードに適用される。

設計思想は Feature-Sliced Architecture に基づき、機能単位でコードを分割・隔離する。

---

## 技術選定の判断基準

| 判断軸 | 選定方針 |
| --- | --- |
| フレームワーク | Next.js App Router。サーバーコンポーネントとクライアントコンポーネントを適切に使い分ける |
| スタイリング | Tailwind CSS。ユーティリティファーストで一貫したデザイン |
| API 通信 | `createApiClient()` ラッパー経由の fetch。同一オリジン（Hono が Next.js 内に埋め込み済み） |
| 認証 | バックエンド API (`/api/v1/auth/*`) 経由。クライアントから Supabase への直接アクセスは禁止 |
| バリデーション | `@oryzae/shared` の Zod スキーマを共有（SSoT） |

---

## 概要

Feature-Sliced Architecture は、機能（feature）を単位としてコードを分割するアーキテクチャパターンである。

**なぜ Feature-Sliced か**:
- 機能ごとにコードが閉じるため、変更の影響範囲が限定される
- 機能間の暗黙的な依存を排除し、並列開発を可能にする
- `app/` を薄いラッパーに保つことで、ルーティングとビジネスロジックを分離する

---

## ディレクトリ構造

```
apps/client/src/
├── app/                — Next.js App Router
│   ├── layout.tsx      — ルートレイアウト
│   ├── page.tsx        — トップページ
│   ├── api/[...path]/  — Hono API Route Handler（全 /api/* を転送）
│   ├── health/         — ヘルスチェック Route Handler
│   └── {route}/
│       ├── layout.tsx  — ルートごとのレイアウト
│       └── page.tsx    — features のコンポーネントを組み合わせるだけ
├── features/           — 機能スライス
│   └── {feature}/
│       ├── components/ — 機能固有 UI コンポーネント
│       ├── hooks/      — API 呼び出し・状態管理（Custom Hook）
│       └── types.ts    — 機能固有の型定義
└── lib/                — 横断ユーティリティ（API クライアント設定、トークン管理等）
```

### 各ディレクトリの責務

| ディレクトリ | 責務 | 知ってはいけないもの |
| --- | --- | --- |
| **app/** | ルーティング、レイアウト、features の組み合わせ、API Route Handler | API 呼び出しの詳細、状態管理ロジック |
| **app/api/** | Hono アプリへのリクエスト転送（Route Handler） | ビジネスロジック |
| **features/{feature}/** | 機能固有のUI・ロジック・型の全て | 他の feature の内部実装 |
| **lib/** | API クライアント設定、トークン管理、共通ユーティリティ | feature, app の存在 |

### API Route Handler について

`app/api/[...path]/route.ts` は Hono バックエンドアプリを Next.js 内に埋め込む仕組み。`@oryzae/server` からビルド済みの Hono アプリをインポートし、`app.fetch(req)` に転送する。これによりフロントエンドと API が同一オリジンで動作し、Vercel で単一デプロイが可能になる。

---

## インポートルール（絶対ルール）

| From ＼ To | app/ | features/X | features/Y | lib/ | @oryzae/shared |
| --- | --- | --- | --- | --- | --- |
| **app/** | self | YES | YES | YES | YES |
| **features/X** | NO | self | **NO** | YES | YES |
| **lib/** | NO | **NO** | **NO** | self | YES |

### 重要な禁止事項

- **features/X → features/Y: 禁止** — 機能間の直接依存は許さない。共通ロジックは `lib/` に切り出す
- **lib → 上位レイヤー: 禁止** — ユーティリティが画面やUIを知ってはならない
- **app/ での API 呼び出し: 禁止** — `page.tsx` や `layout.tsx` から直接 API を呼ばない。必ず features の hooks 経由

---

## データフェッチング

### 原則

API 呼び出しは `features/{feature}/hooks/` の Custom Hook に集約する。コンポーネントから直接 API を呼ぶことは禁止。

### API クライアント

`lib/api.ts` の `createApiClient(accessToken?)` を使用する。同一オリジン（Hono が Next.js 内に埋め込み済み）のため、ベース URL は不要。

```typescript
// lib/api.ts
export function createApiClient(accessToken?: string): ApiClient {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  return {
    baseUrl: '',
    headers,
    fetch(path, init?) {
      return fetch(path, { ...init, headers: { ...headers, ...init?.headers } });
    },
  };
}
```

### Hook のパターン

```typescript
// features/entries/hooks/use-entries.ts
export function useEntries(api: ApiClient | null, authLoading: boolean) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  // ...
  return { entries, loading, hasMore, loadMore };
}
```

**なぜ Hook に集約するか**: API 呼び出しがコンポーネントに散在すると、エラーハンドリングの一貫性が失われ、テスト困難になる。Hook に閉じ込めることで、API 通信の関心事を UI から分離する。

---

## 型安全性

### ルール

- **`as` キャストは原則禁止** — 型が合わない場合は型ガードを書く
- **例外**: ブラウザ API の型不足（Web Speech API, InputEvent, CompositionEvent 等）は `as` を許可。その場合は理由をコメントに記載する
- **`any` 禁止** — `unknown` を使い、型を絞り込む

### 型ガードの使用

```typescript
// 悪い例: as キャスト
const entry = response as Entry;

// 良い例: 型ガード
if ('id' in data && 'content' in data) {
  // data は Entry 相当として安全に使える
}
```

---

## エラーハンドリング

### 原則

```
API エラー     → hooks 内で処理
コンポーネント → error state を受け取り、UI に表示
```

- API エラーは hooks 内で処理する
- コンポーネントは `error` state を受け取り、表示のみを行う

---

## バリデーション

### SSoT: `@oryzae/shared` の Zod スキーマ

フォーム入力のバリデーションには `@oryzae/shared` パッケージの Zod スキーマを使う。クライアント独自のバリデーションスキーマを定義してはならない。

---

## 命名規則

| 種別 | パターン | 例 |
| --- | --- | --- |
| feature ディレクトリ | kebab-case | `features/auth/` |
| コンポーネントファイル | kebab-case | `entry-list.tsx` |
| コンポーネント名 | PascalCase | `export function EntryList()` |
| Hook ファイル | `use-{name}.ts` | `use-entries.ts` |
| Hook 関数名 | camelCase | `export function useEntries()` |
| ページ | `page.tsx` | `app/entries/page.tsx` |
| レイアウト | `layout.tsx` | `app/entries/layout.tsx` |
| ユーティリティ | kebab-case | `lib/api.ts` |

---

## 機能スライス追加ルール

新しい feature を追加する際:

1. `features/{feature-name}/` ディレクトリを作成する
2. `components/`, `hooks/` を配置する（`types.ts` は必要に応じて）
3. 他の feature への import がないことを確認する
4. `app/` に対応するルートを追加し、feature のコンポーネントを組み合わせる
