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
│   ├── shared/{domain}/          — 端末非依存（**全 fetch・全ドメイン型**・端末で変わらない UI）
│   │   ├── components/           — 両端末で同じ UI（ログインフォーム等）
│   │   ├── hooks/                — データ取得・保存などの Custom Hook（use-*）
│   │   └── types.ts              — ドメイン固有の共有型
│   ├── pc/{domain}/              — PC 体験
│   │   ├── components/           — PC 固有 UI
│   │   └── hooks/                — PC 固有の操作・演出 hook（fetch は持たない）
│   └── sp/{domain}/              — SP 体験
│       ├── components/           — SP 固有 UI（縦長・片手・音声）
│       └── hooks/                — SP 固有の操作 hook（fetch は持たない）
├── components/                   — ドメイン非依存 UI・seam プリミティブ・provider
│   ├── device-view.tsx           —   端末出し分けの唯一の seam
│   └── ui/                       —   汎用 UI コンポーネント（feature 非依存）
└── lib/                          — 基盤ユーティリティのみ（ドメイン非依存）
```

`{domain}` は `entries` / `fermentation` / `questions` / `board` / `account` / `navigation` など。
同じドメインの `shared` / `pc` / `sp` は 1:1:1 で対応する（例: `entries` の取得 hook は `shared/entries`、PC エディタは `pc/entries`、SP エディタは `sp/entries`）。

**`features/` の直下は `shared` / `pc` / `sp` の 3 つだけ。**端末非依存のものは、ロジックでも UI でも `features/shared/{domain}/` に置く（`auth` のフォーム、`onboarding` など）。`features/{domain}/` のようなフラットな第4のグループは作らない（`features-are-reach-only.test.ts` が強制）。

> **なぜ flat 層を廃したか（2026-08）**: 以前は「端末非依存の UI」を `features/{domain}/` に置き、`shared` は UI を持たないロジック専用層としていた。しかしこの形には穴があった —
> `pc`/`sp` は他ドメインを import できず（例外は `features/shared` のみ）flat features を使えない、かつ `shared` には UI を置けない。
> その結果「両端末で同じ見た目で、pc と sp の双方から使いたいドメイン UI」に置き場がなく、コピーするしかなかった。
> **これは #490 そのもの**（SP が PC のコードを再利用できず重複が生まれる）で、ロジックについては直したのに UI については同じ罠を残していた。
> 懸念していた「`shared` の中で端末が分岐する」は、UI を禁じるのではなく端末判定そのものを禁じる `shared-no-device-detection` で直接防ぐ。

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
| **shared** | 端末非依存のすべて | データ取得・保存の `use-*` hook、ドメイン型、両端末で同じ UI | 持てる（ただし端末判定は禁止） |
| **pc** | PC 体験 | PC の画面・操作・演出 | 持つ |
| **sp** | SP 体験 | SP の画面・操作（縦長・片手・音声） | 持つ |

> **`shared` の条件は「今どちらの端末が使っているか」ではない。**
> データ取得・更新（fetch）とドメイン型は、**片端末しか使っていなくても `features/shared`** に置く。
> `pc` に置くと、あとで SP を足すときに reach 分離（`reach-slice-isolation`）に阻まれて
> 必ずコピーが発生する。実際 Issue #490 の崩れはこれが原因で、fermentation の detail 取得が
> 3実装、profile の更新が 2実装に増殖した。`shared` は「両端末が使っているもの」ではなく
> **「両端末が使えるようにしておく場所」** と読む。

---

## 置き場の決定木

コードを追加・修正するときは、**上から順に**当てはめる。これで置き場が一意に決まる。

1. **ドメインを知らない汎用 UI か？**（ボタン・モーダルの土台など）→ `components/ui/`
2. **ドメインを知らない基盤ユーティリティか？**（`createApiClient`・認証・分析・theme/context・`debounce`・日付整形・`markdown`・定数）→ `lib/`
3. **データ取得・更新（fetch）か？ ドメイン型か？** → 端末の利用状況を問わず `features/shared/{domain}/`
   （`hooks/` に fetch、`types.ts` に型。**ここが唯一の fetch 置き場**）
4. **残り（＝ UI と、その UI 専用の状態・演出）** → 判定軸＝**「端末ごとに別 UI を持つか」**で分ける：
   - **PC 固有**の画面・操作・演出 → `features/pc/{domain}/`
   - **SP 固有**の画面・操作 → `features/sp/{domain}/`
   - 機能まるごと**端末非依存**（両端末で同じ画面。例: `auth` のフォーム・`onboarding`）→ `features/shared/{domain}/components/`

> `lib/` には `use-*` のドメイン hook を置かない。`lib/` は端末・ドメインの両方を知らない基盤専用（`createApiClient`・トークン保存・分析・context・`useDebounce` 等）。
>
> **3 が 4 より先にあるのが重要**。「PC 専用画面のためのデータ hook」は 3 で `shared` に落ちる。
> 「PC 専用画面だから `pc` へ」と 4 で判断してはならない（Issue #490 の崩れの再発防止）。
>
> **残る1点の判断**: UI を `pc`/`sp` に分けるか `shared` にまとめるかは「端末ごとに別 UI を持つか」という**プロダクト判断**が最後に残る。決定木は配置をほぼ一意化するが、この性質判断だけは機械化できない。迷ったら `shared` から始めてよい — 後から端末差が出たらその時 `pc`/`sp` に割ればよく、逆（コピーが増えてから統合する）より安全。

---

## 各ディレクトリの責務

| ディレクトリ | 責務 | 知ってはいけないもの |
| --- | --- | --- |
| **app/** | ルーティング、レイアウト、Route Handler、端末判定、features の組み合わせ | API 呼び出し、ドメイン加工、`features/{pc,sp}/**/hooks/` |
| **app/api/[...path]/** | Hono アプリへのリクエスト転送 | ビジネスロジック（サーバー側に委譲） |
| **features/shared/{domain}/** | 端末非依存のすべて（**全 fetch**・ドメイン型・両端末で同じ UI） | 端末判定（`lib/use-device`・`components/device-view`）、`pc` / `sp` の存在 |
| **features/pc/{domain}/** | PC 体験の UI・操作・演出 | fetch、ドメイン型定義、他ドメイン、`sp`、`app` |
| **features/sp/{domain}/** | SP 体験の UI・操作 | fetch、ドメイン型定義、他ドメイン、`pc`、`app` |
| **components/** | ドメイン非依存 UI・seam プリミティブ（`device-view`）・provider | 端末固有 UI（`sp-*` / `pc-*`）、feature, app の存在 |
| **components/ui/** | 汎用 UI コンポーネント（shadcn 等） | feature, app の存在 |
| **lib/** | API クライアント・認証・分析・context・汎用 hook 等の基盤 | feature, app, components の存在、ドメイン |

**シェル（ナビゲーション）は端末固有 UI である。** PC サイドバーは `features/pc/navigation/`、SP ボトムナビは `features/sp/navigation/` に置く。`components/` 直下に端末固有 UI を置いてはならない（reach 軸を迂回してしまうため）。`app/(protected)/layout.tsx` はそれを選ぶだけ。

---

## インポートルール（絶対ルール）

`apps/client`（reach 軸あり）の許可マトリクス:

| From ＼ To | app/ | features/pc/X | features/sp/X | features/shared/* | components/ | lib/ | lib/api | @oryzae/shared |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **app/** | self | components のみ | components のみ | YES | YES | YES | **NO** | YES |
| **features/pc/X** | NO | self のみ | **NO** | **YES** | YES | YES | 型のみ | YES |
| **features/sp/X** | NO | **NO** | self のみ | **YES** | YES | YES | 型のみ | YES |
| **features/shared/X** | NO | **NO** | **NO** | YES | YES | YES | YES | YES |
| **components/** | NO | NO | NO | NO | self | YES | 型のみ | YES |
| **lib/** | NO | NO | NO | NO | NO | self | YES | YES |

- 「self のみ」＝ 自分のスライス内のみ。**`pc` / `sp` は同一 reach 内でも別ドメインの import を禁止**（例: `pc/entries → pc/fermentation` は NG）。共有したいロジックは `features/shared/{domain}` に置く。
- `features/shared` は端末非依存の基礎層なので、`shared` どうしの import は許可（ただし `pc` / `sp` は import しない）。
- 「components のみ」＝ `app/` は `features/{pc,sp}/{domain}/components/` だけを import してよい。**`hooks/` は import 禁止**（下記）。
- 「型のみ」＝ `import type { ApiClient }` は可。`createApiClient()` の呼び出しは不可。

### 重要な禁止事項

- **features/pc ⇎ features/sp: 禁止** — 端末をまたぐ直接依存は許さない。「別路線」を構造で保証する
- **features → 他ドメイン: 禁止** — ドメイン間の直接依存は許さない。**唯一の例外は `features/shared`**（両端末・全ドメインから import 可）
- **features/shared → pc / sp: 禁止** — 共有層が端末固有 UI を知ってはならない
- **lib → 上位レイヤー / ドメイン: 禁止** — 基盤がドメインや画面を知ってはならない。ドメイン hook を置かない
- **app/ での API 呼び出し: 禁止** — `page.tsx` / `layout.tsx` から直接 API を呼ばない。必ず `features/shared` の hook 経由
- **`features/shared` 以外での fetch: 禁止** — `features/{pc,sp}`・`components/`・`app/` に `/api/v1/...` を書かない
- **`app/` → `features/{pc,sp}/**/hooks/`: 禁止** — 端末固有 hook は `DeviceView` の分岐と無関係に**両端末で実行される**。端末固有のロジックは必ずその端末のコンポーネントの中に閉じる（seam 漏れの防止）
- **`components/` 直下の端末固有 UI: 禁止** — `sp-*` / `pc-*` は `features/{sp,pc}/{domain}/components/` へ

### 機械強制（dep-cruiser）

上記は `apps/client/.dependency-cruiser.cjs`（import の向き）と `test/architecture/`（import では見えない層）の二段で機械強制している。

**dep-cruiser（import の向き）**:

| ルール | 内容 |
| --- | --- |
| `reach-slice-isolation` | `features/pc/*` ⇎ `features/sp/*` 相互禁止 ＋ `pc`/`sp` 内の別ドメイン禁止（`→ features/shared` のみ許可） |
| `reach-shared-purity` | `features/shared → features/{pc,sp}` 禁止 |
| `shared-no-device-detection` | `features/shared` → `lib/use-device` / `components/device-view` の import 禁止（shared の中で端末を分岐させない） |
| `app-no-api-client` | `app/`（Route Handler 除く）→ `lib/api` の実装 import 禁止 |
| `app-no-reach-hooks` | `app/` → `features/{pc,sp}/*/hooks/` 禁止（seam 漏れ防止） |
| `protected-pages-use-device-view` | 保護ルートの `page.tsx` は `DeviceView` 経由（required ルール） |

**静的テスト（dep-cruiser では見えないもの）**:

| テスト | 内容 |
| --- | --- |
| `features-are-reach-only.test.ts` | `features/` 直下は `pc` / `sp` / `shared` の 3 つだけ（flat 層を作らせない） |
| `fetch-lives-in-shared.test.ts` | `/api/v1/...` を `features/shared`・`lib`・`app/api` の外に書かない |
| `device-ui-lives-in-reach.test.ts` | `components/`・`features/shared` に `sp-*` / `pc-*` を置かない |
| `types-live-in-types-file.test.ts` | `hooks/` から型を export しない（ドメイン型は `types.ts`） |
| `dep-cruiser-rules.test.ts` | 上記 dep-cruiser ルールの存在・形を検証（**番人テスト**） |

これらが落ちたら強制が弱体化したサイン。静的テストの 3 本は移行中の既知違反を `MIGRATING` 配列で明示的に許容し、**「陳腐化した allowlist を残さない」テストが対になっている**（直したのに配列から消し忘れると落ちる）。allowlist は減る一方であること — 追加は負債の追認なのでレビューで止める。

> **限界**: `import { EntryList, type FilterableQuestion }` のような値と型の混在 import は dep-cruiser で型だけを禁止できない。ドメイン型を `features/shared/{domain}/types.ts` に置く規律で担保する。

`apps/admin/.dependency-cruiser.cjs` は reach 軸を持たないため従来どおり（`features/X → features/Y` 禁止）。

---

## 端末の出し分け（device seam）

- **URL に端末を出さない。** PC もスマホも同じ URL（例 `/entries`）を使う。リンクが端末をまたいでも壊れない
- 端末判定は middleware の UA 判定（`device` cookie）を基本とし、誤判定に備えた手動切替（`device-pref` cookie）を優先。クライアントは `useDevice()` で読む
- シェル（サイドバー / SP ボトムナビ）の選択は **`app/(protected)/layout.tsx` の1か所**
- **page は必ず `<DeviceView pc={…} sp={…} />`（`components/device-view`）で出し分ける。これが唯一の seam プリミティブ。** `sp` を渡し忘れても PC を SP シェルに描画せず「未対応」表示にフォールバックする（安全既定）。新しい保護ルートを足すときも DeviceView を使えば SP 考慮を忘れても壊れない
- スマホ全画面ブロック `DesktopOnlyOverlay` は `(auth)` と `(protected)` の SP では撤去（モバイルでログイン〜利用が可能）。PC の狭幅×touch 保護として `(protected)` の PC ブランチにのみ残置

---

## ロード表示（スケルトン / PageLoading）

スケルトンは「読み込み中である」ことを伝える飾りではない。**これから表示されるレイアウトを先に置き、
データが届いた瞬間に同じ位置へコンテンツが入るようにする**ためのもの。

ここから2つの原則が出る。

1. **汎用のスケルトンは存在しえない** — 画面ごとに形が違うので、共通の枠は必ずどれかの画面で嘘になる
2. **予告できない画面にスケルトンを出さない** — 枠が実物と同じ位置に来ないなら、それは予告ではなく
   ただの模様。読み込み完了時に全部差し替わるので、スケルトンの目的の逆になる

### 何を出すか（判断基準は「レイアウトを予告できるか」の一点）

| 画面 | 出すもの | 理由 |
| --- | --- | --- |
| 行・カード・フォームが並ぶ（`/entries`・`/questions`・`/account`・SP の `/jar`） | **スケルトン** | 実 DOM と同じ位置に枠を置けるので、データ到着時に何も動かない |
| キャンバス（PC の `/jar` の瓶・`/board` の盤面） | **`PageLoading`** | 位置がサーバー保存のレイアウト依存だったり、そもそも並ぶコンテンツが無い。枠を置いても当たらない |
| 待つコンテンツが無い（`/entries/new`） | **どちらも出さない** | エディタは開いた瞬間に書ける画面で、本文は実際に空。chrome（ツールバー等）は静的なので枠だけ置き、本文は空のままにする |
| 一部だけ予告できない（`/entries/[id]` の本文） | **その領域だけ `PageLoading`** | 書字方向が mount 後に確定するため行の枠は置けない。chrome は枠、本文は `PageLoading` |

`components/ui/page-loading.tsx` の `PageLoading` は**ルート遷移中も画面内のデータ取得中も同じものを出す**
ためにある。BoardView のように本体側にもロード表示がある画面は、必ずこれを使う
（別々のものを出すと `枠 → ローダー → 本体` と表示が二度三度変わる）。

### 1画面 = 1ロード表示

| 置き場 | 何を持つか |
| --- | --- |
| `features/{pc,sp}/{domain}/components/*-skeleton.tsx` | **画面本体の形**。実コンポーネントの隣に置き、レイアウトを変えたら一緒に直す |
| `app/(protected)/_loading/*-route-loading.tsx` | **page.tsx と同じ合成**。page が持つ chrome（見出し・作成フォーム等）の枠 ＋ 上記のスケルトン or `PageLoading` ＋ `DeviceView` での端末出し分け |
| `app/(protected)/{route}/loading.tsx` | 対応する `*RouteLoading` を描くだけ |

`components/ui/skeleton.tsx` が持つのは網掛け1本（`Skeleton`）だけ。**ここに「一覧の枠」のような
画面の形を置かない**（置いた瞬間に全画面へ流用されて上の原則が壊れる）。

スケルトンの粒度は2段用意する。画面まるごとの枠（遷移・初回描画用）と、行/カードだけの枠
（本体が chrome を実物で描いている最中のデータ待ち用）。同じファイルから両方 export し、
本体側のデータ待ちにも同じ行の形を使うことで、`枠 → chrome実物+行枠 → 実データ` の3段階で
行の位置が動かない。

### ロード表示が出る2つの経路（どちらも行き先に合わせる）

1. **ハードリロード**: `(protected)/layout.tsx` は mount 前（SSR＋hydration）に children を描けない
   （時刻/認証依存レンダリングの不一致対策）。このとき出るのが `_loading/route-loading.tsx` の
   `RouteLoading`＝**パスから引いたその画面のロード表示**。Suspense が挟まらないので `loading.tsx` は出番が無い
2. **クライアント遷移**: Next が行き先セグメントの `loading.tsx` を出す。
   **ルートグループに1枚だけ置いてはいけない**（どの画面へ移動しても同じものが出る）

### 解決待ちに空を返さない

`page.tsx` が `if (loading) return null` で真っ白を返すと、レイアウトが mount 前に出していた
ロード表示が一度消える（**ロード表示 → 真っ白 → 本体**）。ハードリロードでは必ずこの順を通る
（クライアント遷移は認証解決済みなのでガードを素通りし、症状が出ないぶん見落としやすい）。

解決待ちの間は対応する `*RouteLoading` を返し続けること。

```tsx
// ✗ 直前まで出ていた枠が一度消える
if (authLoading || !api) return null;

// ○ 表示が途切れない
if (authLoading || !api) return <BoardRouteLoading />;
```

### 機械強制

- `test/architecture/route-loading.test.ts` — `page.tsx` のあるルートには `loading.tsx` が同居する／
  ルートグループ直下に共通の `loading.tsx` を置かない／`loading.tsx` は `_loading` のものを描く／
  **`page.tsx` は解決待ちに `return null` しない**
- `test/app/protected-pages-loading.test.tsx` — 認証解決前に page が空を返さないことを実描画で確認
- `test/app/route-loading.test.tsx` — パス × 端末で**実際に出るものが変わる**こと、
  および**キャンバス画面がスケルトンを1つも持たない**ことを DOM で確認
- 各スケルトンの `*.verify.tsx` — `lib/verify/skeleton-invariants.ts` の共通 invariant
  （宣言した slot が描かれている／文字を持たない／`aria-hidden`）＋ 画面固有の形

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

1. **先に** データ hook（fetch）とドメイン型を `features/shared/{domain}/`（`hooks/`, `types.ts`）に置く。
   片端末しか使う予定が無くてもここに置く（後から SP/PC を足すときのコピーを構造で防ぐ）
2. PC の画面が要るなら `features/pc/{domain}/`（`components/`, `hooks/`）を作る。`hooks/` は演出・操作の状態のみ
3. SP の画面が要るなら `features/sp/{domain}/`（`components/`, `hooks/`）を作る。同上
4. 端末固有スライスは `features/shared/{domain}` 以外の feature を import しないことを確認する
5. `app/` の対応ルートで、`DeviceView` により端末に応じた **components** を組み合わせる（URL は不変）。
   page に fetch・ドメイン加工・端末固有 hook を置かない

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
