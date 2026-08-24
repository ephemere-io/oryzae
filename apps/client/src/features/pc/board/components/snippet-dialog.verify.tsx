/**
 * SnippetDialog の検証スペック（A 移植）。
 * open=true で描画されるスニペット作成/編集ダイアログ。i18n（board.snippet_dialog）は
 * withVerifyProviders が供給。契約は mode（initialText 有無で create/edit）・source
 * （text=直接書く / image=画像から読み取る）・empty（trim 後 0 文字か）・tooLong
 * （50字超）・ocrStatus。「mode が initialText prop と一致」「submit の disabled が
 * empty/tooLong と一致」「テキスト入力で empty=false に反転」「編集モードでは画像タブを
 * 出さない」を invariant＋act で孤立検証する。
 * open=false は null 描画で契約が出ず dom-contract が FAIL になるため fixture には使わない
 * （open=true 相当のルートにのみ契約を付与している）。
 *
 * OCR は api 越しの fetch にしか出口が無いので、解決しない ApiClient を渡せば
 * ネットワーク0のまま「画像タブに切り替わる」ところまでは孤立検証できる。読み取り結果の
 * 反映（ocrStatus の遷移）はファイル選択＝実ファイル入力が要るため孤立検証には載せず、
 * hook 側（test/features/shared/board/hooks/use-ocr-snippet-text.test.ts）で担保する。
 */

import { MAX_SNIPPET_TEXT_LENGTH } from '@oryzae/shared';
import { registerUnit } from '@oryzae/verify';
import type { ApiClient } from '@/lib/api';
import { withVerifyProviders } from '@/lib/verify/with-providers';
import { SnippetDialog } from './snippet-dialog';

interface Props {
  open: boolean;
  api: ApiClient | null;
  initialText?: string;
  onSubmit: (text: string) => void;
  onClose: () => void;
}

const noop = () => {};

// 解決しない fetch を持つ ApiClient（OCR を叩いてもネットワーク0のまま pending）。
const neverResolveApi: ApiClient = {
  baseUrl: '',
  headers: {},
  fetch: () => new Promise<Response>(() => {}),
};

const IMAGE_TAB = 'button[data-verify-source-tab="image"]';
const EXACTLY_50 = '01234567890123456789012345678901234567890123456789';

registerUnit<Props>({
  id: 'SnippetDialog',
  title: 'SnippetDialog',
  description:
    'スニペットの作成/編集ダイアログ（直接書く／画像から読み取る。空・50字超のうちは送信不可）。',
  kind: 'component',
  render: (props) => withVerifyProviders(<SnippetDialog {...props} />),
  fixtures: [
    {
      id: 'create',
      description: '新規作成（initialText なし・空なので送信不可）',
      props: { open: true, api: neverResolveApi, initialText: '', onSubmit: noop, onClose: noop },
    },
    {
      id: 'edit',
      description: '編集（initialText あり・初期値が入っているので送信可能）',
      props: {
        open: true,
        api: neverResolveApi,
        initialText: '既存のスニペット',
        onSubmit: noop,
        onClose: noop,
      },
    },
    {
      id: 'typed',
      description: '空の状態からテキストを入力すると empty=false に反転し送信可能になる',
      props: { open: true, api: neverResolveApi, initialText: '', onSubmit: noop, onClose: noop },
      act: async (ctx) => {
        await ctx.type('textarea', '新しいスニペット');
        await ctx.wait(16);
      },
    },
    {
      id: 'image-source',
      description: '「画像から読み取る」タブに切り替えるとファイル選択と読み取りボタンが出る',
      props: { open: true, api: neverResolveApi, initialText: '', onSubmit: noop, onClose: noop },
      act: async (ctx) => {
        await ctx.click(IMAGE_TAB);
        await ctx.wait(16);
      },
    },
    {
      id: 'exactly-at-limit',
      probe: true,
      description: 'Probe: 50字ちょうど（境界）は tooLong=false で送信できる',
      props: {
        open: true,
        api: neverResolveApi,
        initialText: EXACTLY_50,
        onSubmit: noop,
        onClose: noop,
      },
    },
    {
      id: 'over-limit',
      probe: true,
      description:
        'Probe: 51字（OCR の結果はしばしばこうなる）は tooLong=true で送信不可のまま編集できる',
      props: {
        open: true,
        api: neverResolveApi,
        initialText: `${EXACTLY_50}x`,
        onSubmit: noop,
        onClose: noop,
      },
    },
    {
      id: 'no-api',
      probe: true,
      description: 'Probe: api=null（認証未解決）でも描画は崩れず、タブ構造も保たれる',
      props: { open: true, api: null, initialText: '', onSubmit: noop, onClose: noop },
    },
  ],
  invariants: [
    {
      id: 'mode-matches-initial-text',
      description: 'data-verify-mode が initialText の有無（edit/create）と一致する',
      check: ({ contract, props }) => {
        const expected = props.initialText ? 'edit' : 'create';
        return (
          contract.mode === expected ||
          `mode 契約不一致: initialText=${JSON.stringify(props.initialText)} → expected "${expected}", got "${contract.mode}"`
        );
      },
    },
    {
      id: 'submit-disabled-matches-empty-or-too-long',
      description: 'submit の disabled が empty または tooLong の契約と一致する',
      check: ({ root, contract }) => {
        const submit = root.querySelector<HTMLButtonElement>('button[type="submit"]');
        if (!submit) return 'submit ボタンが見つからない';
        const blocked = contract.empty === 'true' || contract.tooLong === 'true';
        return (
          submit.disabled === blocked ||
          `submit.disabled=${submit.disabled} だが empty="${contract.empty}", tooLong="${contract.tooLong}"`
        );
      },
    },
    {
      id: 'empty-when-no-text',
      description: '空の create では empty=true（送信不可）',
      onlyFixtures: ['create', 'no-api'],
      check: ({ contract }) =>
        contract.empty === 'true' || `expected empty=true, got "${contract.empty}"`,
    },
    {
      id: 'not-empty-after-typing',
      description: 'テキスト入力後は empty=false に反転する',
      onlyFixtures: ['typed'],
      check: ({ contract }) =>
        contract.empty === 'false' || `expected empty=false after typing, got "${contract.empty}"`,
    },
    {
      id: 'limit-boundary-is-inclusive',
      description: `${MAX_SNIPPET_TEXT_LENGTH}字ちょうどは tooLong=false、1字超えると tooLong=true`,
      onlyFixtures: ['exactly-at-limit', 'over-limit'],
      check: ({ contract, props }) => {
        const expected = (props.initialText ?? '').length > MAX_SNIPPET_TEXT_LENGTH;
        return (
          contract.tooLong === String(expected) ||
          `tooLong 契約不一致: len=${(props.initialText ?? '').length} → expected "${expected}", got "${contract.tooLong}"`
        );
      },
    },
    {
      id: 'char-counter-rendered-on-text-source',
      description: `テキストタブでは文字数カウンタ "<n>/${MAX_SNIPPET_TEXT_LENGTH}" が描画される`,
      check: ({ root, contract }) => {
        if (contract.source !== 'text') return true;
        return (
          Boolean(root.textContent?.includes(`/${MAX_SNIPPET_TEXT_LENGTH}`)) ||
          `"n/${MAX_SNIPPET_TEXT_LENGTH}" カウンタが描画されていない`
        );
      },
    },
    {
      id: 'image-tab-only-in-create-mode',
      description: '画像タブは新規作成のときだけ出す（編集では本文の丸ごと上書きを避ける）',
      check: ({ root, contract }) => {
        const hasImageTab = Boolean(root.querySelector(IMAGE_TAB));
        const expected = contract.mode === 'create';
        return (
          hasImageTab === expected || `画像タブ present=${hasImageTab} だが mode="${contract.mode}"`
        );
      },
    },
    {
      id: 'source-contract-matches-selected-tab',
      description: 'data-verify-source と aria-selected=true のタブが一致する（create のみ）',
      check: ({ root, contract }) => {
        if (contract.mode !== 'create') return true;
        const selected = Array.from(
          root.querySelectorAll('[role="tab"][aria-selected="true"]'),
        ).map((el) => el.getAttribute('data-verify-source-tab'));
        return (
          (selected.length === 1 && selected[0] === contract.source) ||
          `source 不一致: contract.source=${contract.source} → selected=[${selected.join(', ')}]`
        );
      },
    },
    {
      id: 'image-source-shows-file-picker',
      description: '画像タブでは画像用の file input と読み取りボタンが描画される',
      onlyFixtures: ['image-source'],
      check: ({ root }) => {
        const file = root.querySelector<HTMLInputElement>('input[type="file"]');
        const hasTextarea = Boolean(root.querySelector('textarea'));
        return (
          (Boolean(file) && file?.accept.includes('image/') === true && !hasTextarea) ||
          `画像タブの構造が崩れている: file=${Boolean(file)}, accept="${file?.accept}", textarea=${hasTextarea}`
        );
      },
    },
  ],
});
