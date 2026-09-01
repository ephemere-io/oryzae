---
paths:
  - "apps/client/src/**/*.ts"
  - "apps/client/src/**/*.tsx"
  - "apps/client/test/**/*.ts"
  - "apps/client/test/**/*.tsx"
  - "apps/admin/src/**/*.ts"
  - "apps/admin/src/**/*.tsx"
  - "apps/admin/test/**/*.ts"
  - "apps/admin/test/**/*.tsx"
---

# フロントエンドアーキテクチャルール

`apps/client`（ユーザー向け）と `apps/admin`（管理画面）の両方に適用される。

設計の正は **`docs/client-architecture-guide.md`** を参照。
テスト戦略の正は **`docs/client-testing-guide.md`** を参照。
型安全性・`as` 禁止・`any` 禁止は **`.claude/rules/quality.md`** を参照。

## ディレクトリ構造

- `app/` — Next.js App Router ページ + API Route Handler。端末判定もここ（URL に端末を出さない）
- `app/api/[...path]/` — Hono アプリへのリクエスト転送（変更しない）
- `features/` — 機能スライス
  - **`apps/client`**: ドメイン × reach。`features/{shared,pc,sp}/{domain}/`
    - `shared/{domain}/` — UIを持たないドメインロジック（**全 fetch** の `hooks/`・**全ドメイン型** の `types.ts`）
    - `pc/{domain}/` / `sp/{domain}/` — 端末別 UI（components, hooks）。**fetch とドメイン型は持たない**
    - **`features/` 直下は shared / pc / sp の 3 つだけ**。端末非依存のものはロジックも UI も `features/shared/{domain}/` へ（`auth` のフォーム・`onboarding` 等）。フラットな第4のグループは作らない
    - シェルは端末固有 UI: PC サイドバー → `features/pc/navigation/`、SP ボトムナビ → `features/sp/navigation/`
  - **`apps/admin`**: reach 軸なし。従来どおり `features/{domain}/`
- `components/` — ドメイン非依存 UI・seam プリミティブ（`device-view`）・provider。**端末固有 UI（`sp-*`/`pc-*`）禁止**
- `components/ui/` — 汎用 UI コンポーネント（shadcn 等。feature 依存禁止）
- `lib/` — 基盤ユーティリティのみ（API クライアント・認証・分析・`useDebounce`・日付整形等）。**ドメイン非依存・ドメイン hook を置かない**

## 置き場の決定木（迷ったら上から）

1. ドメインを知らない汎用 UI → `components/ui/`
2. ドメインを知らない基盤 util（createApiClient・認証・分析・theme・debounce・日付整形・markdown・定数）→ `lib/`
3. **データ取得・更新（fetch）か? ドメイン型か?** → `features/shared/{domain}/`（`hooks/` と `types.ts`）
4. 残り（UI と、その UI 専用の状態・演出）→ PC UI → `features/pc/{domain}/` ／ SP UI → `features/sp/{domain}/` ／ 端末非依存 UI → `features/shared/{domain}/components/`

> **3 が 4 より先**。「PC 専用画面のためのデータ hook」も `shared` に落ちる。片端末しか使わなくても
> `shared` に置く（`pc` に置くと SP 追加時に reach 分離に阻まれて必ずコピーが生まれる。Issue #490）。

## インポートルール（dependency-cruiser で機械的に検証）

`apps/client`（reach 軸あり）:

- `features/pc/*` ⇎ `features/sp/*` **禁止**（端末をまたぐ依存禁止）
- `features/{pc,sp,shared}/X`（ドメイン X）→ **他ドメイン禁止**。唯一の例外は **`features/shared/{同ドメイン}` への import 可**
- `features/shared/*` → `features/pc`, `features/sp` **禁止**（共有層は端末固有 UI を知らない）
- `components/` → `features/`, `app/` **禁止**
- `lib/` → `features/`, `app/`, `components/` **禁止**（ドメイン hook も置かない）
- `app/` からは `features/`, `components/`, `lib/` のみインポート可。ただし
  - `app/` → `lib/api` の実装 **禁止**（`import type { ApiClient }` は可）= `app-no-api-client`
  - `app/` → `features/{pc,sp}/*/hooks/` **禁止** = `app-no-reach-hooks`
    （DeviceView は描画を分岐するが hook は分岐しない。端末固有 hook を page が呼ぶと両端末で実行される）
- `features/shared/*` → `lib/use-device`, `components/device-view` **禁止** = `shared-no-device-detection`
  （shared は UI を持ってよいが、その中で端末を分岐させない。分岐は DeviceView の1か所だけ）

import では見えない層は `test/architecture/` の静的テストで強制する:
`fetch-lives-in-shared`（`/api/v1` の置き場）・`device-ui-lives-in-reach`（`sp-*`/`pc-*` の置き場）・
`types-live-in-types-file`（`hooks/` から型を export しない）・`features-are-reach-only`（`features/` 直下は 3 つだけ）。

`apps/admin`（reach 軸なし）: 従来どおり `features/X` → `features/Y` **禁止**。

## feature 追加手順（迷ったらこの順。各ステップは dep-cruiser/テストで機械検証される）

1. **置き場を決定木で決める**（reach: shared / pc / sp）
2. `features/{reach}/{domain}/` に作る（pc/sp は `components`・`hooks`、shared は `hooks`・型）
3. **データ取得・保存は `features/shared/{domain}/hooks` に**置き、pc/sp はそれを import（直接 API を叩かない）。端末非依存の hook（例 `use-auth`）も shared に置けば pc/sp 双方から使える
4. 画面を出すなら **page は必ず `<DeviceView pc={…} sp={…} />`**（`components/device-view`）で出し分ける。SP 変種が無ければ `pc` だけでよい（SP は安全な「未対応」表示にフォールバック）。← `protected-pages-use-device-view` で必須化
5. **hook を作ったら同時にテスト**を `test/features/{reach}/{domain}/hooks/` に（reach ミラー）
6. `pnpm dep-cruise && pnpm typecheck && pnpm test` で確認（配置・seam・依存違反を機械検出）

## データフェッチング

- API 呼び出しは **`features/shared/{domain}/hooks/`** の Custom Hook に集約する（PC/SP 共通）
- 端末固有 UI（`pc` / `sp`）はこの共有 hook を import して使う
- コンポーネントから直接 API を呼ばない
- `lib/api.ts` の `createApiClient()` を使う

## テスト（絶対ルール）

### hooks テスト（vitest）
- `src/features/**/hooks/` にファイルを作成・変更したら、対応するテストを `test/features/` に **reach 構造をミラー**して**同時に**作成すること
- 命名（client）: `src/features/shared/auth/hooks/use-auth.ts` → `test/features/shared/auth/hooks/use-auth.test.ts`
- 共有データ hook のテストは PC/SP で重複させず `test/features/shared/{domain}` に1か所
- モックは `vi.fn()` の手動スタブ（モックライブラリ不使用）

### E2E テスト（Playwright）
- 新しいページや主要な機能を追加したら、対応する E2E テストを `e2e/` に追加すること
- テストは features と1:1対応: `e2e/auth.spec.ts`, `e2e/entries.spec.ts`, `e2e/questions.spec.ts`
- ログイン済み状態が必要なテストは `e2e/fixtures/auth.ts` のフィクスチャを使う

### 共通
- **テストなしで作業を完了してはならない**
