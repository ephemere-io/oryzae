# 検証ハーネス（Verify Harness）導入ガイドライン

> このドキュメントは SSoT。検証ハーネスを Oryzae（および将来の別プロジェクト）へ
> 低コストで横展開するための設計判断と手順をまとめる。実装は `packages/verify`
> （`@oryzae/verify`）に集約する。

## 0. これは何か / なぜやるか

CLAUDE.md が思想の拠り所として挙げる「[超並列LLMコーディングのハーネスエンジニアリング](https://note.com/jujunjun110/n/n66306cab294a)」と**同じ思想（ガードレール／自己検証）を、記事が扱っていないフロントエンドUIの実行時検証へ拡張・応用したもの**。（記事のハーネスは CLAUDE.md＋slash command / dependency-cruiser / レイヤー別テスト / git hook / `/review` という静的解析・バックエンド寄りの層が中心で、フロント UI の「描画後の実行時状態」の検証には触れていない。本ハーネスはその空白を埋める。）

複数エージェントが長時間自律で開発する時代の大前提は、**エージェントがアプリの状態を実行時に観測・検証できること**。そのために各コンポーネントが自分の状態を機械可読な「DOM契約（`data-verify-*`）」として公表し、その契約に対して fixture（状態）と invariant（不変条件）を宣言する。

この1セットの定義が、**3つの利用者を同時に満たす**のが最大の利点（Storybook やアサート追加では3面を1定義で賄えない）:

| 利用者 | 何をするか |
|---|---|
| **CI回帰ゲート** | PR ごとに全ユニット×fixture を検証し、契約違反・probe欠落をブロック |
| **人間QA / デザインレビュー** | `/verify` ダッシュボードで各部品の状態を目視確認 |
| **AIエージェントの自己検証** | 稼働中アプリで `window.__verify` を叩き、自分の変更を実行時に確認 |

設計の出典は Code with Claude のワークショップ `how-we-claude-code/phase-3-verify`（動く実装）。`@oryzae/verify` はそれを Oryzae 向けに移植した「動く正解」であり、本ガイドラインが破綻しても実体が常に残る。

## 1. 用語

- **DOM契約（contract）**: コンポーネントが `data-verify-*` 属性として公表する自己申告の状態。例 `data-verify-unit="EntryCard" data-verify-status="draft"`。
- **VerifiableUnit（ユニット）**: 検証対象の単位。単一コンポーネントでも、複数を束ねた feature スライスでもよい。
- **fixture**: 名前付きの再現可能な状態（props ＋ 任意の `act()` 操作）。`probe: true` は「壊しにかかる」敵対的エッジケース。
- **invariant（不変条件）**: マウントされたDOM上で常に真であるべき述語。`onlyFixtures` で特定 fixture に限定可。
- **verifier（検証器）**: ユニットに依存しないプラグイン（schema / invariants / dom-contract / a11y）。
- **verdict**: `PASS | FAIL | BLOCKED | SKIP`。`BLOCKED`（観測不能）は `FAIL`（観測して不正）と区別する。

## 2. 配置（monorepo）

エンジンは共有パッケージに1度だけ。定義は各アプリに置く。

```
packages/
  shared/                       既存（Zodスキーマ）。propsSchema に流用できる
  verify/   ← @oryzae/verify     エンジン（移植・全アプリ/将来プロジェクトで再利用）
    src/core/                    contract / types / registry / runner
    src/verifiers/               schema / invariants / dom-contract / a11y
    src/harness/                 handle(window.__verify) / Dashboard / UnitPage / ReplayPage
apps/client/                    （admin も同型）
  src/app/verify/register.ts     全 *.verify を import ＋ ビルトイン verifier 登録（バレル）
  src/app/verify/                ダッシュボード/孤立マウント/replay の薄いルート（dev限定）
  scripts/record-verify.mjs      replay をヘッドレスで録画して .webm を出す（Playwright）
  src/features/<x>/*.verify.tsx  各 feature のユニット定義（co-located）
  test/verify.matrix.test.ts     CIゲート（全ユニット×fixture を実行・probe必須を強制）
```

> 登録バレルを `lib/` ではなく `app/verify/` に置くのは、dep-cruise の `lib-independence`
> ルール（`lib/` は `features/` を import 不可）のため。feature の spec を集約する以上、
> features を合成できる `app/` 層に置く。

**エンジン＝道具、`*.verify.tsx`＝中身**。エンジンは1回書いて `client`/`admin`/将来の別リポジトリが使い回す。これが低コスト横展開の本体。

## 3. コンポーネント側に書くこと

### (a) 状態をDOMに公表する

```tsx
import { verifyAttrs } from '@oryzae/verify';

<article
  {...verifyAttrs({
    unit: 'EntryCard',
    status: entry.status,
    hasPrompt: Boolean(entry.prompt),
    len: entry.body.length,
  })}
>
```

`verifyAttrs({status: 'draft'})` → `data-verify-status="draft"`。**FSAのどの層のコンポーネントにも付けられる**。これがハーネスの最小単位。

### (b) ユニットを登録する（`*.verify.tsx`）

feature の隣に co-located（例 `src/features/entries/entry-card.verify.tsx`）:

```tsx
import { registerUnit } from '@oryzae/verify';
import { EntryCardSchema } from '@oryzae/shared'; // 既存Zodを流用可
import { EntryCard } from './components/entry-card';

registerUnit({
  id: 'EntryCard',
  title: 'EntryCard',
  description: 'ジャーナルのエントリ表示カード',
  kind: 'component',
  render: (props) => <EntryCard {...props} />,
  propsSchema: EntryCardSchema,
  fixtures: [
    { id: 'draft', description: '下書き状態', props: { /* ... */ } },
    { id: 'empty-body', probe: true, description: 'Probe: 本文空でも崩れない', props: { /* ... */ } },
  ],
  invariants: [
    {
      id: 'status-contract-matches-class',
      description: 'data-verify-status と見た目のクラスが一致する',
      check: ({ root, contract }) => {
        const el = root.querySelector('[data-verify-unit="EntryCard"]');
        const hasDraftClass = Boolean(el?.classList.contains('is-draft'));
        return hasDraftClass === (contract.status === 'draft')
          || `class/contract mismatch: status=${contract.status}`;
      },
    },
  ],
});
```

**ルール: 全ユニットは最低1つの probe fixture を持つこと**（ハッピーパスだけの検証は禁止）。CI がこれを強制する（§5）。

## 4. 3つの利用者の配線（実パス）

### CI回帰ゲート — `apps/client/test/verify.matrix.test.ts`

`apps/client` の test スクリプトは `vitest run test/`（環境 jsdom 設定済み）。`test/` 配下に matrix を置けば既存の `pnpm test` に自動で乗り、**`.github/workflows/ci.yml` の `test` ジョブ経由で PR ごとにCIゲートになる**（新規ワークフロー不要）。

### 人間QA — `apps/client/src/app/verify/`（dev限定）

- `app/verify/page.tsx` … ダッシュボード（「Run all」→ verdict グリッド・`/verify/replay` への導線）
- `app/verify/[unit]/[fixture]/page.tsx` … そのユニットだけを孤立マウント
- `app/verify/replay/page.tsx` … replay（全ユニット×fixture をライブ順送り再生・§4.1）

FSA 規約に従い `app/` は薄いラッパーにし、UI 本体は `@oryzae/verify` の harness コンポーネントを使う。**本番ビルドに出さない**よう `process.env.NODE_ENV !== 'production'` でガードする。

### AIエージェント自己検証 — `window.__verify`

dev 時のみ `installVerifyHandle()` を呼び、稼働中アプリに `window.__verify` を生やす。エージェント（Claude Code / Playwright）は次で自己検証できる:

```js
await window.__verify.runAll();              // 全マトリクスを実行→結果JSON
window.__verify.manifest();                  // 全ユニット×fixtureを列挙
// ハンドル無しでもDOM直読み可:
document.querySelector('[data-verify-unit="EntryCard"]').dataset;
```

### 4.1 Replay（ライブ再生 ＋ 録画デモ） — `/verify/replay`（dev限定）

> ⚠ これは**「記録済み検証結果の再生」ではない**。毎回その場で**ライブ再実行**する。

登録済みの全ユニット×fixture を、ステージに1つずつマウント → verifier 実行 → verdict 表示 → 次へ、と目に見える形で順送りする画面。`act` のある fixture は「描画 → クリック/入力（ハイライト付き）→ 検証」まで演出付きで再生する。`runFixture` は CI ゲート（`verify.matrix.test.ts`）と同じ経路なので、**緑なら本当に緑**。

- **「全green を毎回確認できる」緑ゲート自体は CI の matrix が既に担保**している（`pnpm test`）。replay の固有価値は別で、**(1) 人が見て分かるデモ**と **(2) コミット/PR 添付できる動画成果物**。
- クエリ: `?dwell=<ms>`（各 fixture 保持）・`?chrome=0`（操作UIを隠す）・`?auto=0`（停止で開始）・`?key=<ms>`（タイプ速度）・`?unit=<UnitId>`（**1ユニットだけ再生** = 録画を1 feature に絞る）。
- キーボード: Space=一時停止/再開 ・ →=スキップ ・ Esc=停止して集計。
- `window.__verify_replay = { playing, idx, total, done, results }` を公開（外部レコーダの開始/終了検知用）。

**録画**（committable な .webm を作る）:

```bash
# 別ターミナルで dev サーバ起動（/verify は dev 限定）
pnpm --filter @oryzae/client dev
# Playwright で replay を録画（全ユニット）
pnpm --filter @oryzae/client verify:record
# 1 feature だけ録画（例: PoC の LandingFaqItem → 全green デモ）
pnpm --filter @oryzae/client verify:record --unit LandingFaqItem
# → apps/client/recordings/replay-<unit>-<ts>.webm（recordings/ は .gitignore）
```

意図的に壊した probe（`EXPECTED_FAIL`、例 `ExampleProgress::inconsistent`）は replay でも赤❌として正しく映る。「全green の録画」が欲しいときは `?unit=` で**全PASSになるユニットに絞る**こと（全ユニット録画はゲートのデモ＝赤を含むのが正しい姿）。

## 5. CIで「probe必須」を強制する

`verify.matrix.test.ts` が、全登録ユニットについて (1) 各 fixture の verdict、(2) **probe fixture を最低1つ持つこと**を assert する。これは `pnpm test`（CI の `test` ジョブ）でそのまま走る。Biome のカスタム lint は無理に作らず、**強制は matrix（Vitest）で行う**のが低コストかつ確実。

意図的に失敗する probe（例: 契約とクラスを不一致にした fixture）を1つ用意し、「FAILすることを期待する」と assert しておくと、**ハーネスが嘘を捕まえられること自体**を保証できる。

## 6. どの導入タイミングでも成立させる（アダプション手順）

エンジン導入は既存コードに無影響で、**マトリクスは「登録されたユニットだけ」を検査する**。この性質が新規/既存どちらでも成立させる。

**新規（greenfield）**: 1日目から、新コンポーネントは `verifyAttrs` ＋ `.verify.tsx`（probe込み）をセットで出す。matrix が最初からゲート。

**既存（brownfield・段階導入）**:
1. `@oryzae/verify` を入れる（既存コードへの影響ゼロ）
2. **回帰しやすい / エージェントがよく触る**コンポーネントから契約と `.verify.tsx` を足す
3. matrix は登録済みユニットだけ縛るのでビッグバン不要。未対応は素通り
4. **カバレッジ・ラチェット**: 契約済み比率を記録し、PR で下がったら落とす（後戻り禁止・前進は任意）

どちらも「登録したものは厳格（probe必須）、未登録は自由」なので、同じガイドラインで回る。

## 7. Oryzae 固有の制約への準拠（重要）

CLAUDE.md の共通ルールに従い、移植コードは以下を厳守（CI検出）:

- **`any` 禁止** … エンジンは `unknown` ＋ ジェネリクスで型付け（移植時に workshop の `any` を除去済み）
- **`as` キャスト禁止** … 型ガード / ジェネリクスで回避。やむを得ない箇所は前行に `// @type-assertion-allowed: <理由>`
- **`--no-verify` 禁止** … pre-commit（simple-git-hooks + lint-staged）を飛ばさない
- Biome: single quote / 2スペース / セミコロンあり / trailing comma all / lineWidth 100
- `next.config.ts` の `transpilePackages` に `@oryzae/verify` を追加（source-only パッケージのため）
- `knip.json` に `packages/verify` ワークスペースを追加（デッドコード検出の対象化）
- ルート `package.json` の `typecheck` に `@oryzae/verify` を追加

## 8. 最初のPRチェックリスト（PoC）

1. `@oryzae/verify` を作成（`core/` `verifiers/` `harness/` を移植、`any`/`as` 除去）
2. `apps/client` に依存追加＋`transpilePackages`＋`knip.json`＋ルート`typecheck` を更新
3. **回帰しやすいUIを1つ**選び `verifyAttrs` ＋ `.verify.tsx`（probe込み）
4. `test/verify.matrix.test.ts` を追加（`pnpm test` で緑になる＝CIゲート成立）
5. dev限定で `app/verify` ダッシュボード＋`window.__verify`
6. **わざと壊して**（契約とクラスを不一致に）CI・ダッシュボード・`window.__verify` の3面で FAIL が出ることを確認 → そのままチームへのデモになる

## 9. 将来の拡張（今回は対象外）

- **バックエンド（Hono DDD）**: 同じ「契約＋不変条件＋probe」を、`packages/shared` の Zod を契約に、domain 層の不変条件を invariant に対応させて段階展開（ハーネス階層の②）
- **別プロジェクト**: `@oryzae/verify` を publish すれば、他リポジトリは `*.verify.tsx` を書くだけ
- **視覚回帰 / perf / i18n**: verifier を1ファイル追加して登録するだけ（コンポーネント無改変）
