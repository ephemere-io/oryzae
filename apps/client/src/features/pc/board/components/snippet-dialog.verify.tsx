/**
 * SnippetDialog の検証スペック（A 移植）。
 * open=true で描画されるスニペット作成/編集ダイアログ。i18n（board.snippet_dialog）は
 * withVerifyProviders が供給。mode（initialText 有無で create/edit）と empty（trim 後 0 文字か）を
 * 契約として公表し、「mode が initialText prop と一致」「submit ボタンの disabled が empty 契約と一致」
 * 「テキスト入力で empty=false に反転し submit が有効化」を invariant＋act で孤立検証する。
 * open=false は null 描画で契約が出ず dom-contract が FAIL になるため fixture には使わない
 * （open=true 相当のルートにのみ契約を付与している）。
 */

import { registerUnit } from '@oryzae/verify';
import { withVerifyProviders } from '@/lib/verify/with-providers';
import { SnippetDialog } from './snippet-dialog';

interface Props {
  open: boolean;
  initialText?: string;
  onSubmit: (text: string) => void;
  onClose: () => void;
}

const noop = () => {};

registerUnit<Props>({
  id: 'SnippetDialog',
  title: 'SnippetDialog',
  description: 'スニペットの作成/編集ダイアログ（空のうちは送信不可）。',
  kind: 'component',
  render: (props) => withVerifyProviders(<SnippetDialog {...props} />),
  fixtures: [
    {
      id: 'create',
      description: '新規作成（initialText なし・空なので送信不可）',
      props: { open: true, initialText: '', onSubmit: noop, onClose: noop },
    },
    {
      id: 'edit',
      description: '編集（initialText あり・初期値が入っているので送信可能）',
      props: { open: true, initialText: '既存のスニペット', onSubmit: noop, onClose: noop },
    },
    {
      id: 'typed',
      description: '空の状態からテキストを入力すると empty=false に反転し送信可能になる',
      props: { open: true, initialText: '', onSubmit: noop, onClose: noop },
      act: async (ctx) => {
        await ctx.type('textarea', '新しいスニペット');
        await ctx.wait(16);
      },
    },
    {
      id: 'near-limit',
      probe: true,
      description: 'Probe: 50字ちょうどの initialText で n/50 カウンタが上限に張り付く',
      props: {
        open: true,
        initialText: '01234567890123456789012345678901234567890123456789',
        onSubmit: noop,
        onClose: noop,
      },
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
      id: 'submit-disabled-matches-empty',
      description: 'submit ボタンの disabled が empty 契約と一致する（空のうちは送信不可）',
      check: ({ root, contract }) => {
        const submit = root.querySelector<HTMLButtonElement>('button[type="submit"]');
        if (!submit) return 'submit ボタンが見つからない';
        const isEmpty = contract.empty === 'true';
        return (
          submit.disabled === isEmpty ||
          `submit.disabled=${submit.disabled} だが contract.empty="${contract.empty}"`
        );
      },
    },
    {
      id: 'empty-when-no-text',
      description: '空の create では empty=true（送信不可）',
      onlyFixtures: ['create'],
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
      id: 'char-counter-rendered',
      description: '文字数カウンタ "<n>/50" が描画される',
      check: ({ root }) =>
        Boolean(root.textContent?.includes('/50')) || '"n/50" カウンタが描画されていない',
    },
  ],
});
