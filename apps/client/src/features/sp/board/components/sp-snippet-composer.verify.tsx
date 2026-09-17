/**
 * SpSnippetComposer の検証スペック。
 *
 * キーボードの真上に張り付く 1 行の入力。見出しを持たない（「スニペットを作成」は要らない、
 * と実機レビュー）。見るのは: 空なら送れない、長すぎれば送れない、読み取り中は打てない・送れない、
 * 直すときは読み取りの口が無い、送ると本文が渡る。
 */

import { registerUnit } from '@oryzae/verify';
import { withVerifyProviders } from '@/lib/verify/with-providers';
import { SpSnippetComposer, type SpSnippetOcrStatus } from './sp-snippet-composer';

interface Props {
  open: boolean;
  mode: 'create' | 'edit';
  initialText: string;
  saving: boolean;
  ocrStatus: SpSnippetOcrStatus;
  fromImage: boolean;
  hasPickImage: boolean;
  onSubmit: (text: string) => void;
  onClose: () => void;
}

const noop = () => {};

const BASE: Props = {
  open: true,
  mode: 'create',
  initialText: '',
  saving: false,
  ocrStatus: 'idle',
  fromImage: false,
  hasPickImage: true,
  onSubmit: noop,
  onClose: noop,
};

registerUnit<Props>({
  id: 'SpSnippetComposer',
  title: 'SpSnippetComposer',
  description: 'スニペットを書く／直す欄（キーボードの真上の 1 行）',
  kind: 'component',
  render: (props) =>
    withVerifyProviders(
      <div style={{ width: '390px' }}>
        <SpSnippetComposer
          open={props.open}
          mode={props.mode}
          initialText={props.initialText}
          saving={props.saving}
          ocrStatus={props.ocrStatus}
          fromImage={props.fromImage}
          onPickImage={props.hasPickImage ? noop : undefined}
          onSubmit={props.onSubmit}
          onClose={props.onClose}
        />
      </div>,
    ),
  fixtures: [
    { id: 'create-empty', description: '新しく作る・空（送れない）', props: BASE },
    {
      id: 'edit',
      description: '直す（本文入り・読み取りの口は無い）',
      props: { ...BASE, mode: 'edit', initialText: 'うまく言えない' },
    },
    {
      id: 'reading',
      description: '画像を読み取っている（打てない・送れない）',
      props: { ...BASE, ocrStatus: 'reading' },
    },
    {
      id: 'from-image',
      description: '読み取った下書きが入っている（誤りの注意を添える）',
      props: { ...BASE, initialText: '朝の光がきれいだった', fromImage: true },
    },
    {
      id: 'ocr-failed',
      description: '読み取りに失敗した（もう一度の口）',
      props: { ...BASE, ocrStatus: 'failed' },
    },
    {
      id: 'too-long',
      description: '長すぎる（送れない）',
      props: { ...BASE, initialText: 'あ'.repeat(2001) },
    },
    {
      id: 'type-and-send',
      probe: true,
      description: 'Probe: 打つと送れるようになり、送ると本文が渡る',
      props: { ...BASE, initialText: 'ひとこと' },
      act: async (ctx) => {
        await ctx.wait(16);
        await ctx.click('button[data-composer-submit]');
        await ctx.wait(16);
      },
    },
  ],
  invariants: [
    {
      id: 'no-heading',
      description: '見出し（「スニペットを作成」）を出さない',
      check: ({ root }) =>
        !(root.textContent ?? '').includes('スニペットを作成') || '見出しが出ている',
    },
    {
      id: 'submit-iff-sendable',
      description: '空・長すぎ・読み取り中・保存中は送れない',
      check: ({ root, contract }) => {
        const submit = root.querySelector('button[data-composer-submit]');
        if (!(submit instanceof HTMLButtonElement)) return '送るボタンが無い';
        const sendable =
          contract.empty === 'false' &&
          contract.tooLong === 'false' &&
          contract.ocrStatus !== 'reading' &&
          contract.saving === 'false';
        return (
          submit.disabled !== sendable || `disabled=${submit.disabled}, 送れるべき=${sendable}`
        );
      },
    },
    {
      id: 'ocr-only-when-creating',
      description: '画像から読み取る口は新しく作るときだけ',
      check: ({ root, contract }) => {
        const has = root.querySelector('button[data-ocr-trigger]') !== null;
        return has === (contract.mode === 'create') || `読み取り=${has}, mode=${contract.mode}`;
      },
    },
    {
      id: 'field-locked-while-reading',
      description: '読み取り中は欄に打てない',
      onlyFixtures: ['reading'],
      check: ({ root }) => {
        const field = root.querySelector('textarea');
        return (field instanceof HTMLTextAreaElement && field.disabled) || '読み取り中に打てる';
      },
    },
  ],
});
