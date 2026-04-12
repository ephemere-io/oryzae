# フロントエンドアーキテクチャガイド

Oryzae フロントエンドの横断的なアーキテクチャルール。
`apps/client`（ユーザー向け）と `apps/admin`（管理画面）の両方に適用される。

設計思想は Feature-Sliced Architecture に基づき、機能単位でコードを分割・隔離する。

---

## 技術選定の判断基準

| 判断軸 | 選定方針 |
| --- | --- |
| フレームワーク | Next.js 16 App Router。サーバーコンポーネントとクライアントコンポーネントを適切に使い分ける |
| スタイリング | Tailwind CSS 4。ユーティリティファーストで一貫したデザイン |
| API 通信 | `createApiClient()` による plain fetch。同一オリジンの Route Handler 経由で Hono に転送 |
| 認証 | バックエンド API 経由。クライアントから Supabase への直接アクセスは禁止 |
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
apps/{client,admin}/src/
├── app/                    — Next.js App Router。薄いラッパーのみ
│   ├── api/[...path]/      — Route Handler: Hono アプリへのリクエスト転送（変更しない）
│   ├── layout.tsx          — ルートレイアウト
│   ├── page.tsx            — トップページ
│   └── {route}/
│       ├── layout.tsx      — ルートごとのレイアウト
│       └── page.tsx        — features のコンポーネントを組み合わせるだけ
├── features/               — 機能スライス
│   └── {feature}/
│       ├── components/     — 機能固有 UI コンポーネント
│       ├── hooks/          — API 呼び出し・状態管理（Custom Hook）
│       └── types.ts        — 機能固有の型定義
├── components/ui/          — 汎用 UI コンポーネント（feature 依存禁止）
└── lib/                    — 横断ユーティリティ（API クライアント設定、定数等）
```

### 各ディレクトリの責務

| ディレクトリ | 責務 | 知ってはいけないもの |
| --- | --- | --- |
| **app/** | ルーティング、レイアウト、Route Handler、features の組み合わせ | API 呼び出しの詳細、状態管理ロジック |
| **app/api/[...path]/** | Hono アプリへのリクエスト転送 | ビジネスロジック（サーバー側に委譲） |
| **features/{feature}/** | 機能固有のUI・ロジック・型の全て | 他の feature の内部実装 |
| **lib/** | API クライアント設定、共通ユーティリティ | feature, app の存在 |

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

### Hook の返却パターン

全ての API フック は `{ data, error, loading }` パターンで返す:

```typescript
// features/entries/hooks/use-entries.ts
export function useEntries() {
  const [data, setData] = useState<Entry[] | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchEntries = async () => {
      try {
        const api = createApiClient(accessToken);
        const res = await api.fetch('/api/v1/entries');
        if (!res.ok) {
          setError(await parseApiError(res));
          return;
        }
        setData(await res.json());
      } catch (e) {
        setError({ type: "network", message: "通信エラーが発生しました" });
      } finally {
        setLoading(false);
      }
    };
    fetchEntries();
  }, []);

  return { data, error, loading };
}
```

### コンポーネントでの使用

```typescript
// features/entries/components/entry-list.tsx
export function EntryList() {
  const { data, error, loading } = useEntries();

  if (loading) return <Skeleton />;
  if (error) return <ErrorMessage error={error} />;
  return <ul>{data.map(entry => <EntryItem key={entry.id} entry={entry} />)}</ul>;
}
```

**なぜ Hook に集約するか**: API 呼び出しがコンポーネントに散在すると、エラーハンドリングの一貫性が失われ、テスト困難になる。Hook に閉じ込めることで、API 通信の関心事を UI から分離する。

---

## 型安全性

### 絶対ルール

- **`as` キャスト禁止** — 型が合わない場合は型ガードを書く。例外: `// @type-assertion-allowed: <reason>` コメントを付与した場合のみ許可
- **`any` 禁止** — `unknown` を使い、型を絞り込む

### API クライアント

```typescript
// lib/api.ts
import { createApiClient } from "./api";

const api = createApiClient(accessToken);
const res = await api.fetch('/api/v1/entries');
const data = await res.json();
```

`createApiClient()` は plain fetch のラッパーであり、同一オリジンの Route Handler (`/api/[...path]`) を経由してサーバーの Hono アプリにリクエストを転送する。

### 型ガードの使用

```typescript
// 悪い例: as キャスト
const entry = response as Entry;

// 良い例: 型ガード
function isEntry(value: unknown): value is Entry {
  return (
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    "content" in value
  );
}

if (isEntry(response)) {
  // response は Entry 型として安全に使える
}
```

---

## エラーハンドリング

### 原則

```
API エラー     → hooks 内で処理・分類
コンポーネント → error state を受け取り、UI に表示
```

- API エラーは hooks 内で catch し、統一された `ApiError` 型に変換する
- コンポーネントは `error` state を受け取り、表示のみを行う
- コンポーネント内で try-catch を書かない

### エラー型

```typescript
// lib/api-error.ts
type ApiError = {
  type: "validation" | "unauthorized" | "not_found" | "server" | "network";
  message: string;
};
```

**なぜ hooks 内で処理するか**: エラーハンドリングをコンポーネントに散在させると、処理の一貫性が保てない。hooks に集約することで、エラー分類とユーザーへの通知を統一する。

---

## バリデーション

### SSoT: `@oryzae/shared` の Zod スキーマ

フォーム入力のバリデーションには `@oryzae/shared` パッケージの Zod スキーマを使う。クライアント独自のバリデーションスキーマを定義してはならない。

```typescript
// @oryzae/shared で定義
export const createEntrySchema = z.object({
  content: z.string().min(1).max(10000),
  mood: z.enum(["good", "neutral", "bad"]),
});

// features/entries/hooks/use-create-entry.ts でそのまま使う
import { createEntrySchema } from "@oryzae/shared";

const result = createEntrySchema.safeParse(formData);
if (!result.success) {
  setError({ type: "validation", message: formatZodError(result.error) });
  return;
}
```

**なぜ共有するか**: バリデーションルールがクライアントとサーバーで乖離すると、クライアントで通過した入力がサーバーで弾かれるという UX 上の問題が発生する。Zod スキーマを SSoT にすることでこれを防ぐ。

---

## 命名規則

| 種別 | パターン | 例 |
| --- | --- | --- |
| feature ディレクトリ | kebab-case | `features/journal-entry/` |
| コンポーネントファイル | kebab-case | `entry-card.tsx` |
| コンポーネント名 | PascalCase | `export function EntryCard()` |
| Hook ファイル | `use-{name}.ts` | `use-entries.ts` |
| Hook 関数名 | camelCase | `export function useEntries()` |
| 型ファイル | `types.ts` | `features/entries/types.ts` |
| ページ | `page.tsx` | `app/entries/page.tsx` |
| レイアウト | `layout.tsx` | `app/entries/layout.tsx` |
| ユーティリティ | kebab-case | `lib/api.ts` |

---

## 機能スライス追加ルール

新しい feature を追加する際:

1. `features/{feature-name}/` ディレクトリを作成する
2. `components/`, `hooks/`, `types.ts` の3要素を配置する
3. 他の feature への import がないことを確認する
4. `app/` に対応するルートを追加し、feature のコンポーネントを組み合わせる

---

## 関連ドキュメント

| ドキュメント | 内容 |
| --- | --- |
| `docs/backend-architecture-guide.md` | バックエンドのレイヤードアーキテクチャ |
| `docs/backend-testing-guide.md` | テスト戦略、ガードレール |
| `docs/infra-guide.md` | Vercel + Supabase デプロイ |
