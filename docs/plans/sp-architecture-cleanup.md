# スマホ版導入で乱れたアーキテクチャの修正 — 作業プラン

Issue: [#490 スマホ版導入で乱れたアーキテクチャを修正する](https://github.com/ephemere-io/oryzae/issues/490)

対象: `apps/client`（`apps/server` / `apps/admin` / `packages/shared` は端末非依存なので無傷）

最終更新: 2026-08-03 / ステータス: 計画

---

## 1. 診断 — 何が起きたか

### 根本原因

SP 導入（#363 系, 27 コミット）で **reach 軸（`shared` / `pc` / `sp`）は正しく作られたが、既存の PC コードが reach 軸へ移行されなかった**。

- SP は新規なので、きれいに `features/sp/{domain}` に入った
- PC は昔のまま `features/{auth,...}`（flat）と `features/pc/{domain}` に散在したまま
- そこへ `reach-slice-isolation`（pc ⇎ sp 禁止・pc 内のドメイン跨ぎ禁止）が**正しく**効いた

結果、SP 実装者は PC のロジックを import できず、逃げ道は3つしか無かった。**dep-cruiser 上はすべて合法**なので、CI は一度も落ちていない。これが「静かに崩れた」理由。

| 逃げ道 | 何が起きたか |
| --- | --- |
| **① 押し上げ** | features 間 import 禁止を回避するため、`app/` の page が API を叩き props で配る |
| **② コピー** | 同じ fetch・同じ型・同じユーティリティを端末ごとに二重・三重実装 |
| **③ 非対称** | 同じ機能なのに PC と SP で置き場が違う（account / nav） |

コード中のコメントが自白している:

- `app/(protected)/entries/page.tsx:8` — 「features 間直接依存禁止のため、ページ層で取得して EntryList に props で渡す」
- `features/sp/account/components/sp-account-page.tsx:32` — 「features/auth(flat) への越境 import を避ける」
- `features/sp/entries/components/sp-entry-list.tsx:51` — 「PC の useDebounce 相当を内製」

### さらに、SSoT 自体に矛盾がある

`docs/client-architecture-guide.md` の2箇所が食い違っており、判断が揺れる余地を残している。

- 「置き場の決定木」: `shared` = **両端末が使う**・UI を持たないもの
- 「データフェッチング」: API 呼び出しは **必ず** `features/shared/{domain}/hooks/` に集約する

→ 「片端末しか今は使っていないデータ hook」の置き場が未定義。実際 `pc/board/hooks/use-board.ts` などが `pc` に取り残されている。ここを先に確定しないと、直してもまた同じ形に戻る。

---

## 2. 違反インベントリ

### A. `app/` 層への漏れ（「app/ での API 呼び出し禁止」違反）

| 場所 | 症状 |
| --- | --- |
| `app/(protected)/jar/page.tsx:47` | `api.fetch('/api/v1/questions')` を直叩き。`QuestionData` 型と一覧 state も page が持つ |
| `app/(protected)/entries/new/page.tsx:32` | `api.fetch('/api/v1/entries/{id}/questions/{qid}')` を直叩き |
| `app/(protected)/entries/page.tsx:12-28` | `useQuestions` を呼び `availableQuestions` を整形（ドメイン加工が page に） |
| `app/(auth)/callback/page.tsx:38,86` | OAuth callback / finalize を直叩き（SP 以前からの負債だが同じ違反） |
| `app/(auth)/auth/confirm/page.tsx:54` | 同上 |

### B. 端末 seam の漏れ

| 場所 | 症状 |
| --- | --- |
| `app/(protected)/entries/[id]/page.tsx:8`<br>`app/(protected)/entries/new/page.tsx:7` | PC 専用演出 `useSaveTransition`（`features/pc/entries/hooks/`）を page が呼ぶ。hook は DeviceView の分岐と無関係に**SP でも実行される** |
| `components/sp-bottom-nav.tsx` | 端末固有 UI が端末非依存レイヤー（`components/`）に置かれている |

### C. 重複実装（コピーの結果）

| 重複 | 実装箇所 |
| --- | --- |
| **fermentation detail 取得**（`/api/v1/fermentations?questionId=` + `/api/v1/fermentations/{id}`）**× 3** | `pc/fermentation/hooks/use-fermentation-results.ts:63`<br>`pc/entries/hooks/use-entry-fermentation-detail.ts:187`<br>`shared/fermentation/hooks/use-fermentation-inbox.ts:137` |
| **同じドメインの型 × 3** | `FermentationDetail`(pc/fermentation) / `EntryFermentationDetail`(pc/entries) / `FermentationDetail`(shared/fermentation, 非 export) |
| **profile PATCH（nickname）× 2** | `features/auth/components/account-page.tsx:508`<br>`features/sp/account/components/sp-account-page.tsx:144` |
| **`/api/v1/questions` 取得 × 2** | `shared/entry-questions/hooks/use-entry-questions.ts:33`<br>`app/(protected)/jar/page.tsx:47`（型も別: `LinkedQuestion` vs `QuestionData`） |
| **debounce × 2** | `pc/entries/hooks/use-debounce.ts`<br>`sp/entries/components/sp-entry-list.tsx:51`（内製 setTimeout） |
| **日付整形 × 4** | `pc/entries/components/format-entry-date.ts`<br>`pc/board/components/entry-card-content.tsx:15`<br>`sp/entries/components/sp-entry-list.tsx:26`<br>`sp/fermentation/components/sp-jar.tsx:21` |

### D. データ hook が `pc` / flat に閉じ込められている（SP から再利用不能）

`pc/board/hooks/{use-board,use-board-save}.ts` ・ `pc/fermentation/hooks/{use-fermentation-results,use-jar-layout-save}.ts` ・ `pc/entries/hooks/{use-entry-fermentation-detail,use-user-me}.ts` ・ `features/auth/hooks/use-user-stats.ts` ・ `features/onboarding/hooks/use-onboarding.ts`

`use-user-me` に至っては**ドメインすら違う**（user 情報の取得が `pc/entries` の中にある）。

### E. 型の置き場が無い

- `features/shared/` に **`types.ts` が1つも存在しない**（SSoT では `features/shared/{domain}/types.ts` が正）
- ドメイン型が PC のコンポーネント／hook から export されている: `FilterableQuestion`(pc/entries/components/entry-list.tsx) / `FermentationDetail`(pc/fermentation/hooks) / `EntryFermentationDetail`(pc/entries/hooks)
- `app/(protected)/entries/page.tsx` は **PC コンポーネント由来の型 `FilterableQuestion` を SP コンポーネントに渡している** — `pc → sp` の依存を app 経由でロンダリングしている（dep-cruiser は app→pc / app→sp を許可しているため検出されない）

### F. 置き場の非対称

| 機能 | PC | SP |
| --- | --- | --- |
| アカウント画面 | `features/auth/components/account-page.tsx` | `features/sp/account/components/sp-account-page.tsx` |
| ナビシェル | `features/auth/components/sidebar.tsx` | `components/sp-bottom-nav.tsx` |

- `features/auth`（flat = 端末非依存のはず）に **PC 専用 UI**（sidebar / account-page / writing-stats）が同居
- auth ドメインが `features/auth` と `features/shared/auth` に二分（`use-user-stats` は flat、`use-signup-availability` は shared）
- `components/` 直下は SSoT に**定義が無いレイヤー**（doc は `components/ui/` しか定義していない）

### G. ガードレールの穴（＝ドリフトが全部「合法」だった理由）

| 塞がれていない抜け道 | 現状 |
| --- | --- |
| `app/` → `features/pc/**/hooks/` | 無制限に許可 → 押し上げ・seam 漏れが検出されない |
| `app/` からの API 呼び出し | doc の禁止事項だが**機械強制なし** |
| `features/{pc,sp}` 内の fetch | doc は shared 集約を要求するが**機械強制なし** |
| `components/` 直下の端末固有 UI | 禁止ルールなし |
| `features/shared` に UI を入れない | ✅ `test/architecture/shared-no-ui.test.ts` で強制済み（この方向だけは守られている） |

### H. i18n への device 軸の漏れ（低優先）

`i18n/messages/*.json` の top-level に `sp` namespace があり、`entries` / `questions` / `fermentation` と**並列**になっている。端末軸が i18n ツリーに漏れ、同じ意味のラベルが二重管理になる。

---

## 3. 直したあとの姿（不変条件）

各レイヤーを**一行で言い切れる**形にする。これが復元力の本体。

| レイヤー | 持つもの | 持たないもの |
| --- | --- | --- |
| `features/shared/{domain}/` | **すべてのデータ取得・更新**（`hooks/`）と**すべてのドメイン型**（`types.ts`）。片端末しか今使っていなくてもここ | UI（`.tsx` 禁止・既存テストで強制） |
| `features/{pc,sp}/{domain}/` | 端末別 UI と、その UI 専用の状態・演出 hook | fetch、ドメイン型定義、他ドメイン、他 reach |
| `features/{domain}/`（flat） | 端末非依存 UI と、その UI 専用の状態 hook | fetch、他 flat feature |
| `components/` | ドメイン非依存 UI（`ui/`）と seam プリミティブ（`device-view`）、providers | 端末固有 UI（`sp-*` / `pc-*`）、features 依存 |
| `lib/` | 基盤（api / auth / device / theme / debounce 等） | ドメイン hook、features 依存 |
| `app/` | ルーティング、`DeviceView` による組み合わせ | fetch、ドメイン加工、`features/{pc,sp}/**/hooks/` の import |

**「片端末しか使っていなくてもデータ hook は shared」** が今回の肝。`pc` に置くと SP を足すとき必ずコピーが発生する（今回まさにそれが起きた）。

### 目標ディレクトリ

```
features/
  shared/                       ← 全 fetch + 全ドメイン型（UI なし）
    account/   hooks/ types.ts      (新設: profile 更新)
    auth/      hooks/ types.ts      (use-user-stats を統合)
    board/     hooks/ types.ts      (pc から移設)
    entries/   hooks/ types.ts
    entry-questions/ hooks/ types.ts
    fermentation/ hooks/ types.ts   (detail 取得を1本化)
    onboarding/ hooks/              (flat から移設)
    questions/ hooks/ types.ts
    user/      hooks/ types.ts      (use-user-me を移設)
  pc/
    account/ components/            (features/auth から移設)
    navigation/ components/         (sidebar を移設)
    board/ entries/ fermentation/ questions/
  sp/
    account/ navigation/ entries/ fermentation/ questions/
  auth/ landing/ onboarding/    ← 端末非依存 UI のみ（fetch なし）
components/  ui/ device-view providers
lib/         api auth device theme debounce format-date …
```

---

## 4. 実装計画

各 Phase = 1 PR。**Phase 順に依存**（前を前提に次が成立）。

### Phase 0 — SSoT を確定する（コードは触らない）

`docs/client-architecture-guide.md` を更新し、上記「不変条件」の表を正とする。

- 「置き場の決定木」の分岐を書き換え: `shared` の条件を「両端末が使う」から **「データ取得・更新・ドメイン型であること（端末の利用状況を問わない）」** に変更 → データフェッチング節との矛盾を解消
- `components/`（`ui/` 以外）を正式なレイヤーとして定義し、端末固有 UI の禁止を明記
- シェル（sidebar / bottom-nav）の置き場を `features/{pc,sp}/navigation/` と明記
- `app/` の禁止事項に「`features/{pc,sp}/**/hooks/` の import 禁止」を追加

**規模**: doc 1ファイル。**受入**: `README.md` の構造図と齟齬がない。

---

### Phase 1 — 網を先に張る（`severity: warn` で追加、可視化のみ）

このフェーズでは**何も直さない**。既存違反が warn として全部出る状態を作り、Phase 2〜5 の進捗を機械で測れるようにする。

**dep-cruiser（`apps/client/.dependency-cruiser.cjs`）に追加:**

| ルール名 | 内容 |
| --- | --- |
| `app-no-api-client` | `^src/app/`（`^src/app/api/` 除く）→ `^src/lib/api` 禁止 |
| `app-no-reach-hooks` | `^src/app/` → `^src/features/(pc\|sp)/[^/]+/hooks/` 禁止（seam 漏れを塞ぐ） |
| `flat-features-no-api` | `^src/features/(?!pc\|sp\|shared)` → `^src/lib/api` 禁止 |

**静的テスト（`apps/client/test/architecture/` に追加）** — dep-cruiser は import しか見ないので、文字列レベルは vitest で見る:

| テスト | 内容 |
| --- | --- |
| `no-fetch-outside-shared.test.ts` | `src/**` を走査し `/api/v1/` リテラルを検出。許可は `src/features/shared/**`・`src/lib/**`・`src/app/api/**` のみ |
| `no-device-ui-outside-reach.test.ts` | `src/components/**` と flat features に `sp-*` / `pc-*` ファイル名を禁止 |
| `shared-has-types.test.ts` | `features/shared/{domain}/` に `types.ts` が存在することを要求（型の置き場を強制） |

`test/architecture/dep-cruiser-rules.test.ts`（番人テスト）にも新ルールの存在チェックを追加する。

**規模**: 設定1 + テスト3〜4。**受入**: 新テストが「既知の違反件数」を明示して落ちる／warn を出す状態。

---

### Phase 2 — 共有層の確立（型と fetch を `shared` へ集約）

重複の解消はここが本体。**型 → hook → 呼び出し元差し替え**の順に進める。

1. **fermentation を1本化**
   - `features/shared/fermentation/types.ts` を新設し、3つの型定義（`FermentationDetail` / `EntryFermentationDetail` / inbox 内部型）を統合
   - `features/shared/fermentation/hooks/use-fermentation-detail.ts` に detail 取得を1本化
   - `pc/fermentation/use-fermentation-results.ts`・`pc/entries/use-entry-fermentation-detail.ts` を削除し、共有 hook + 表示整形に置換
   - ⚠️ 2実装は**正規化の厳しさが違う**（`use-entry-fermentation-detail` は型ガードで normalize、`use-fermentation-results` は素通し）。**厳しい方（normalize あり）に寄せる**
2. **questions / entries / board の型を `types.ts` へ**
   - `FilterableQuestion`(pc/entries/components) → `features/shared/questions/types.ts`
   - `QuestionData`(jar page) / `QuestionItem`(sp-questions) / `LinkedQuestion`(shared/entry-questions) を統合
   - `features/shared/board/{hooks,types.ts}` を新設し `pc/board/hooks/*` を `git mv`
3. **user ドメインを切る**
   - `features/shared/user/hooks/use-user-me.ts`（`pc/entries` から移設）
   - `features/shared/auth/hooks/use-user-stats.ts`（`features/auth` から移設）
   - `features/shared/onboarding/hooks/use-onboarding.ts`（flat から移設。UI は flat のまま）
4. **`pc/fermentation/hooks/use-jar-layout-save.ts` を `features/shared/fermentation/hooks/` へ**
5. **汎用ユーティリティを `lib/` へ**
   - `lib/use-debounce.ts`（`pc/entries/hooks` から移設）→ `sp-entry-list` の内製 debounce も差し替え
   - `lib/format-date.ts` に日付整形を集約（4箇所を統合。i18n ロケール対応の余地もここで一元化）

**移設後に残る `pc`/`sp` の hooks は演出・操作のみ**: `use-jar-drag` / `use-overlay-drag` / `use-ghost-effect` / `use-eraser-trace` / `use-pressure-bleed` / `use-amp-effect` / `use-time-inscription` / `use-voice-dynamics` / `use-focus-mode` / `use-editor-settings` / `use-browser-nav-guard` / `use-link-question-sync` / `use-save-transition`。

**規模**: 最大のフェーズ。移動 ~12 ファイル + 型統合。分割するなら `2a: fermentation` / `2b: 型と board/user` / `2c: lib ユーティリティ` の3 PR。
**受入**: `no-fetch-outside-shared` が `features/{pc,sp}` について green。`test/` のパスも追随移設。

---

### Phase 3 — account / profile の対称化

1. `features/shared/account/hooks/use-profile.ts` を新設 — nickname PATCH / change-email / change-password を集約（現在 PC コンポーネント内に3箇所インライン）
2. `features/auth/components/account-page.tsx` → `features/pc/account/components/account-page.tsx` に `git mv`。`writing-stats.tsx` も同伴
3. `features/sp/account/components/sp-account-page.tsx` から `createApiClient` を除去し、`use-profile` を使う（**重複 fetch の解消**）
4. `features/auth`（flat）には**端末非依存の認証 UI のみ**を残す: login / signup / forgot-password / reset-password / google-login-button / error-messages

**規模**: 移動2 + 新規1 + 改修2。
**受入**: `/api/v1/auth/profile` の呼び出し箇所が **1** になる。`features/auth` に `createApiClient` が残るのはフォーム群のみ → Phase 5 で解消。

---

### Phase 4 — シェル（ナビ）の対称化

1. `features/auth/components/sidebar.tsx` → `features/pc/navigation/components/sidebar.tsx`
2. `components/sp-bottom-nav.tsx` → `features/sp/navigation/components/bottom-nav.tsx`
3. `app/(protected)/layout.tsx` の import 更新（シェル選択の1箇所ロジックは維持）
4. `components/` 直下に残すのは `device-view` / `desktop-only-overlay` / `posthog-provider` / `service-worker-register` / `ui/`

**規模**: 移動2 + import 更新。**受入**: `no-device-ui-outside-reach` が green。

---

### Phase 5 — `app/` の薄型化

1. **jar page**: 直叩き `/api/v1/questions` → `features/shared/questions/hooks/use-active-questions.ts`（`shared/entry-questions` の `useActiveQuestions` と統合。`jarX`/`jarY` を含む型に一本化）
2. **new entry page**: 直叩きの link を `features/shared/entry-questions` に `useLinkEntryQuestion(api)` を追加して解消
   （既存 `useEntryQuestions(api, entryId)` は entryId を hook 生成時に束縛するため、保存後に entryId が決まる新規作成では使えなかった。これが直叩きの原因）
3. **entries page**: `availableQuestions` の整形を `features/shared/questions/hooks/use-filterable-questions.ts` へ
4. **`useSaveTransition` の seam 漏れ**: page から外し、`features/pc/entries` 側（`EntryEditor` またはその薄いラッパー）に閉じる。page は遷移先の決定だけ渡す
5. **`(auth)` の OAuth 直叩き**: `features/shared/auth/hooks/use-oauth-callback.ts` / `use-email-confirm.ts` へ

**規模**: page 5ファイル + 共有 hook 3〜4。
**受入**: `app-no-api-client` / `app-no-reach-hooks` / `no-fetch-outside-shared` がすべて green。

---

### Phase 6 — 網を `error` に上げて締める

1. Phase 1 で追加した dep-cruiser ルールを **`severity: 'error'`** に昇格
2. 静的テストの許容リスト（暫定 allowlist）を削除
3. `docs/client-architecture-guide.md` の「機械強制（dep-cruiser）」節を実態に更新
4. `app/verify/register.ts` の import パス・`test/` 配置・`knip.json` を移設に追随
5. `pnpm typecheck && pnpm lint && pnpm test && pnpm dep-cruise && pnpm knip` 通過

---

### Phase 7（任意・別 Issue 推奨）— i18n の device 軸を解消

`sp.*` namespace を廃し、ドメイン namespace の下に端末差分を置く（例 `entries.list.sp.*`）。翻訳は Google Sheets が SSoT なので `docs/i18n-guide.md` の運用と合わせて別途調整が要る。**今回のスコープ外を推奨**。

---

## 5. 進め方の注意

- **移動は `git mv`** で履歴を保つ。1 PR の中で「移動」と「改修」を混ぜない（移動コミット → 改修コミットに分ける）とレビューが読める
- **`verify` ハーネス**: `quality.md` の verify-coverage-gate は「新規追加ファイルのみ判定、リネーム＝移設は対象外」なので、移設フェーズは gate に引っかからない。ただし `app/verify/register.ts` の import パス更新は必須
- **テストの追随**: `test/` は `src/` とミラー構造。移設のたびに `test/features/pc/...` → `test/features/shared/...` を同時に動かす
- **フロント変更の実機確認**: Phase 3〜5 は UI に触るので、報告前に Chrome DevTools MCP で PC / SP 両方を確認（`.claude/rules/quality.md`）
- **PC 品質を落とさない**: `use-entry-fermentation-detail` の normalize のように、2実装のうち**厳しい方に寄せる**。「共通化＝機能の後退」にしない

## 6. スコープ外

- `apps/server` / `packages/shared` / `apps/admin`（端末非依存。今回の崩れとは無関係）
- SP 版 board の新規実装（`DeviceView` の「未対応」フォールバックは意図された安全既定であり、崩れではない）
- 演出・UI デザインの変更
