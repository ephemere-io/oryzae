# フロントエンドアーキテクチャガイド

Oryzae フロントエンドの横断的なアーキテクチャルール。
`apps/client`（ユーザー向け）と `apps/admin`（管理画面）の両方に適用される。

設計思想は Feature-Sliced Architecture に基づき、機能単位でコードを分割・隔離する。
さらに `apps/client` では、機能を **ドメイン × reach（shared / pc / sp）** の2軸で薄切りする。

> **device（端末）は フロントエンドだけの軸である。**
> `apps/server`（DDD）も `packages/shared`（Zod 契約）も端末を一切知らない。
> したがって PC / スマホ（SP）の差は `apps/client` の見せ方にのみ現れ、ここで `reach` 軸として表現する。
> `apps/admin` は単一体験（デスクトップ管理画面）なので reach 軸を持たず、従来どおり `features/{domain}` で薄切りする。

---

## 技術選定の判断基準

| 判断軸 | 選定方針 |
| --- | --- |
| フレームワーク | Next.js 16 App Router。サーバーコンポーネントとクライアントコンポーネントを適切に使い分ける |
| スタイリング | Tailwind CSS 4。ユーティリティファーストで一貫したデザイン |
| API 通信 | `createApiClient()` による plain fetch。同一オリジンの Route Handler 経由で Hono に転送 |
| 認証 | バックエンド API 経由。クライアントから Supabase への直接アクセスは禁止 |
| バリデーション | `@oryzae/shared` の Zod スキーマを共有（SSoT） |
| 端末対応 | 同一 URL・同一 API。見せ方だけ `reach`(pc/sp) で分け、共有ロジックは `features/shared` に集約 |

---

## 概要

Feature-Sliced Architecture は、機能（feature）を単位としてコードを分割するアーキテクチャパターンである。

**なぜ Feature-Sliced か**:
- 機能ごとにコードが閉じるため、変更の影響範囲が限定される
- 機能間の暗黙的な依存を排除し、並列開発を可能にする
- `app/` を薄いラッパーに保つことで、ルーティングとビジネスロジックを分離する

**なぜ reach 軸（apps/client）か**:
- PC とスマホは「同じ体験の質」を別の手段（広い画面／片手・音声）で実現する別路線。画面は別物にしたい
- ただし API・取得・保存などの**振る舞い**は端末で変わらない＝共有したい
- そこで「振る舞い＝`shared`」「見せ方・操作＝`pc` / `sp`」と物理的に分け、置き場を構造で一意にする

---

## ディレクトリ構造

### apps/client（reach 軸あり）

```
apps/client/src/
├── app/                          — ルーティング（端末非依存・薄いラッパー）
│   ├── api/[...path]/            — Route Handler: Hono へのリクエスト転送（変更しない）
│   ├── (auth)/ … (protected)/    — 認証境界
│   │   └── (protected)/layout.tsx — 端末を判定し PC/SP のシェルを出し分ける
│   └── {route}/page.tsx          — features を組み合わせるだけ（URL に端末は出さない）
├── features/                     — 機能スライス（ドメイン × reach）
│   ├── shared/{domain}/          — UIを持たない共有ロジック（両端末が使う）
│   │   ├── hooks/                — データ取得・保存などの Custom Hook（use-*）
│   │   └── types.ts              — ドメイン固有の共有型
│   ├── pc/{domain}/              — PC 体験
│   │   ├── components/           — PC 固有 UI
│   │   └── hooks/                — PC 固有の操作・演出 hook
│   └── sp/{domain}/              — SP 体験
│       ├── components/           — SP 固有 UI（縦長・片手・音声）
│       └── hooks/                — SP 固有の操作 hook
├── components/ui/                — 汎用 UI コンポーネント（feature 非依存）
└── lib/                          — 基盤ユーティリティのみ（ドメイン非依存）
```

`{domain}` は `entries` / `fermentation` / `questions` / `board` など。
同じドメインの `shared` / `pc` / `sp` は 1:1:1 で対応する（例: `entries` の取得 hook は `shared/entries`、PC エディタは `pc/entries`、SP エディタは `sp/entries`）。

### apps/admin（reach 軸なし・単一体験）

```
apps/admin/src/
├── app/
├── features/{domain}/            — components / hooks / types（端末分けなし）
├── components/ui/
└── lib/
```

### reach（共有レベル）の定義

| reach | 役割 | 置くもの | UI |
| --- | --- | --- | --- |
| **shared** | 両端末が使う、端末非依存のドメインロジック | データ取得・保存の `use-*` hook、ドメイン型 | 持たない |
| **pc** | PC 体験 | PC の画面・操作・演出 | 持つ |
| **sp** | SP 体験 | SP の画面・操作（縦長・片手・音声） | 持つ |

---

## 置き場の決定木

コードを追加・修正するときは、**上から順に**当てはめる。これで置き場が一意に決まる。

1. **ドメインを知らない汎用 UI か？**（ボタン・モーダルの土台など）→ `components/ui/`
2. **ドメインを知らない基盤ユーティリティか？**（`createApiClient`・認証・分析・theme/context・`debounce`・`markdown`・定数）→ `lib/`
3. **ドメイン固有** → ドメイン（entries / fermentation / …）を選び、reach で分ける：
   - 両端末が使う・**UI を持たない**（データ hook・型）→ `features/shared/{domain}/`
   - **PC** の画面・操作 → `features/pc/{domain}/`
   - **SP** の画面・操作 → `features/sp/{domain}/`

> `lib/` には `use-*` のドメイン hook を置かない。`lib/` は端末・ドメインの両方を知らない基盤専用。

---

## 各ディレクトリの責務

| ディレクトリ | 責務 | 知ってはいけないもの |
| --- | --- | --- |
| **app/** | ルーティング、レイアウト、Route Handler、端末判定、features の組み合わせ | API 呼び出しの詳細、状態管理ロジック |
| **app/api/[...path]/** | Hono アプリへのリクエスト転送 | ビジネスロジック（サーバー側に委譲） |
| **features/shared/{domain}/** | 端末非依存のドメインロジック（データ hook・型） | UI、`pc` / `sp` の存在 |
| **features/pc/{domain}/** | PC 体験の UI・操作・演出 | 他ドメイン、`sp`、`app` |
| **features/sp/{domain}/** | SP 体験の UI・操作 | 他ドメイン、`pc`、`app` |
| **components/ui/** | 汎用 UI コンポーネント（shadcn 等） | feature, app の存在 |
| **lib/** | API クライアント・認証・分析・context 等の基盤 | feature, app, components の存在、ドメイン |

---

## インポートルール（絶対ルール）

`apps/client`（reach 軸あり）の許可マトリクス:

| From ＼ To | app/ | features/pc/X | features/sp/X | features/shared/* | components/ui/ | lib/ | @oryzae/shared |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **app/** | self | YES | YES | YES | YES | YES | YES |
| **features/pc/X** | NO | self のみ | **NO** | **YES** | YES | YES | YES |
| **features/sp/X** | NO | **NO** | self のみ | **YES** | YES | YES | YES |
| **features/shared/X** | NO | **NO** | **NO** | YES | YES | YES | YES |
| **components/ui/** | NO | NO | NO | NO | self | YES | YES |
| **lib/** | NO | NO | NO | NO | NO | self | YES |

- 「self のみ」＝ 自分のスライス内のみ。**`pc` / `sp` は同一 reach 内でも別ドメインの import を禁止**（例: `pc/entries → pc/fermentation` は NG）。共有したいロジックは `features/shared/{domain}` に置く。
- `features/shared` は端末非依存の基礎層なので、`shared` どうしの import は許可（ただし `pc` / `sp` は import しない）。

### 重要な禁止事項

- **features/pc ⇎ features/sp: 禁止** — 端末をまたぐ直接依存は許さない。「別路線」を構造で保証する
- **features → 他ドメイン: 禁止** — ドメイン間の直接依存は許さない。**唯一の例外は `features/shared`**（両端末・全ドメインから import 可）
- **features/shared → pc / sp: 禁止** — 共有層が端末固有 UI を知ってはならない
- **lib → 上位レイヤー / ドメイン: 禁止** — 基盤がドメインや画面を知ってはならない。`use-*` のドメイン hook を置かない
- **app/ での API 呼び出し: 禁止** — `page.tsx` / `layout.tsx` から直接 API を呼ばない。必ず `features/shared` の hook 経由

### 機械強制（dep-cruiser）

上記は `apps/client/.dependency-cruiser.cjs` で機械強制する。reach 軸の導入に伴い、最低限こう更新する:
- `features/pc/*` ⇎ `features/sp/*` を相互禁止
- `features/{pc,sp,shared}` 内の**別ドメイン**間 import を禁止（ただし `→ features/shared` は許可）
- `features/shared → features/{pc,sp}` を禁止
- `lib/` からドメイン hook を排除（基盤のみ）

`apps/admin/.dependency-cruiser.cjs` は reach 軸を持たないため従来どおり（`features/X → features/Y` 禁止）。

---

## 端末の出し分け（device seam）

- **URL に端末を出さない。** PC もスマホも同じ URL（例 `/entries`）を使う。リンクが端末をまたいでも壊れない
- 端末の判定と PC/SP シェルの選択は **`app/(protected)/layout.tsx` の1か所**に閉じる。各 `page.tsx` は端末に応じた feature（`pc/*` または `sp/*`）を組み立てる
- 端末判定は middleware の UA 判定を基本とし、誤判定に備えて手動切替（"PC版/スマホ版を見る"）を併設する
- スマホ全画面ブロックの暫定処置（`DesktopOnlyOverlay`）は、この seam の導入で廃止する

---

## データフェッチング

### 原則

API 呼び出しは **`features/shared/{domain}/hooks/`** の Custom Hook に集約する。コンポーネントから直接 API を呼ぶことは禁止。
端末固有 UI（`pc` / `sp`）は、この共有 hook を import して使う。

### Hook の返却パターン

全ての API フックは `{ data, error, loading }` パターンで返す:

```typescript
// features/shared/entries/hooks/use-entries.ts
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
// features/sp/entries/components/sp-entry-list.tsx
import { useEntries } from '@/features/shared/entries/hooks/use-entries';

export function SpEntryList() {
  const { data, error, loading } = useEntries();

  if (loading) return <Skeleton />;
  if (error) return <ErrorMessage error={error} />;
  return <ul>{data.map(entry => <SpEntryItem key={entry.id} entry={entry} />)}</ul>;
}
```

**なぜ共有 hook に集約するか**: API 呼び出しがコンポーネントに散在すると、エラーハンドリングの一貫性が失われ、テスト困難になる。端末ごとに再実装すると振る舞いが乖離する。`features/shared` の hook に閉じ込めることで、PC/SP の挙動を1か所で揃える。

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

`createApiClient()` は plain fetch のラッパーであり、同一オリジンの Route Handler (`/api/[...path]`) を経由してサーバーの Hono アプリにリクエストを転送する。端末非依存の基盤なので `lib/` に置く。

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
API エラー     → hooks 内で処理・分類（features/shared）
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

// features/shared/entries/hooks/use-create-entry.ts でそのまま使う
import { createEntrySchema } from "@oryzae/shared";

const result = createEntrySchema.safeParse(formData);
if (!result.success) {
  setError({ type: "validation", message: formatZodError(result.error) });
  return;
}
```

**なぜ共有するか**: バリデーションルールがクライアントとサーバーで乖離すると、クライアントで通過した入力がサーバーで弾かれるという UX 上の問題が発生する。Zod スキーマを SSoT にすることでこれを防ぐ。`@oryzae/shared` は端末非依存なので、PC/SP どちらの hook からも同じスキーマを使う。

---

## 命名規則

| 種別 | パターン | 例 |
| --- | --- | --- |
| reach ディレクトリ（client） | `shared` / `pc` / `sp` | `features/sp/` |
| ドメインディレクトリ | kebab-case | `features/pc/journal-entry/` |
| コンポーネントファイル | kebab-case | `entry-card.tsx` |
| コンポーネント名 | PascalCase | `export function EntryCard()` |
| Hook ファイル | `use-{name}.ts` | `use-entries.ts` |
| Hook 関数名 | camelCase | `export function useEntries()` |
| 型ファイル | `types.ts` | `features/shared/entries/types.ts` |
| ページ | `page.tsx` | `app/(protected)/entries/page.tsx` |
| レイアウト | `layout.tsx` | `app/(protected)/layout.tsx` |
| ユーティリティ | kebab-case | `lib/api.ts` |

---

## 機能スライス追加ルール（apps/client）

新しい機能を追加するときは「置き場の決定木」に従い、reach ごとに配置する:

1. 端末非依存のデータ hook・型を `features/shared/{domain}/` に置く
2. PC の画面が要るなら `features/pc/{domain}/`（`components/`, `hooks/`）を作る
3. SP の画面が要るなら `features/sp/{domain}/`（`components/`, `hooks/`）を作る
4. 端末固有スライスは `features/shared/{domain}` 以外の feature を import しないことを確認する
5. `app/` の対応ルートで、端末に応じた feature を組み合わせる（URL は不変）

> `apps/admin` は reach 軸を持たないため、`features/{domain}/`（`components/`, `hooks/`, `types.ts`）をそのまま作る。

---

## 関連ドキュメント

| ドキュメント | 内容 |
| --- | --- |
| `docs/client-testing-guide.md` | フロントエンドテスト戦略・テスト配置（reach 対応） |
| `docs/i18n-guide.md` | apps/client の日英バイリンガル運用 |
| `docs/backend-architecture-guide.md` | バックエンドのレイヤードアーキテクチャ（端末非依存） |
| `docs/shared-package-guide.md` | `@oryzae/shared` の使用ルール（端末非依存） |
| `docs/infra-guide.md` | Vercel + Supabase デプロイ |
