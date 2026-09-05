/**
 * SpSnippetSheet の検証スペック（抜粋を書く／直すシート）。
 *
 * props だけの presentational な部品。守るのは「**空では保存させない**」「上限を超えたら
 * 保存させない」「保存中は閉じさせない」の 3 つ。どれも押せてしまうと、失敗が
 * 盤面に出ないまま黙って何も起きない（ボードには専用のエラー表示が無い）。
 *
 * i18n（sp.board）依存のため withVerifyProviders で包む。
 */

import { MAX_SNIPPET_TEXT_LENGTH } from '@oryzae/shared';
import { registerUnit } from '@oryzae/verify';
import { withVerifyProviders } from '@/lib/verify/with-providers';
import { SpSnippetSheet } from './sp-snippet-sheet';

interface Props {
  open: boolean;
  initialText?: string;
  saving?: boolean;
  onSubmit: (text: string) => void;
  onClose: () => void;
}

const noop = () => {};
const ACTIONS = { onSubmit: noop, onClose: noop };

registerUnit<Props>({
  id: 'SpSnippetSheet',
  title: 'SpSnippetSheet',
  description: '抜粋の本文を書く／直す下からのシート。',
  kind: 'component',
  render: (props) =>
    withVerifyProviders(
      <div style={{ position: 'relative', width: '390px', height: '640px' }}>
        <SpSnippetSheet {...props} />
      </div>,
    ),
  fixtures: [
    {
      id: 'create',
      description: '新しく書く（空なので保存は押せない）',
      props: { open: true, ...ACTIONS },
    },
    {
      id: 'edit',
      description: '既にある本文を直す',
      props: { open: true, initialText: '朝の光がきれいだった', ...ACTIONS },
    },
    {
      id: 'saving',
      probe: true,
      description: 'Probe: 保存中は閉じさせない・二重に送らせない',
      props: { open: true, initialText: '朝の光がきれいだった', saving: true, ...ACTIONS },
    },
    {
      id: 'too-long',
      probe: true,
      description: 'Probe: 上限を超えたら保存させない（サーバーに弾かせない）',
      props: { open: true, initialText: 'あ'.repeat(MAX_SNIPPET_TEXT_LENGTH + 1), ...ACTIONS },
    },
  ],
  invariants: [
    {
      id: 'submit-blocked-when-unusable',
      description: '空・長すぎ・保存中は保存を押せない',
      check: ({ root, contract }) => {
        const save = [...root.querySelectorAll('button')].find((b) =>
          b.textContent?.includes('保存'),
        );
        if (!save) return '保存ボタンが無い';
        const blocked =
          contract.empty === 'true' || contract.tooLong === 'true' || contract.saving === 'true';
        return (
          save.disabled === blocked ||
          `disabled=${save.disabled} だが empty=${contract.empty} tooLong=${contract.tooLong} saving=${contract.saving}`
        );
      },
    },
    {
      id: 'cannot-close-while-saving',
      description: '保存中は閉じられない（途中で消えると結果が分からない）',
      onlyFixtures: ['saving'],
      check: ({ root }) => {
        const cancel = [...root.querySelectorAll('button')].find((b) =>
          b.textContent?.includes('キャンセル'),
        );
        return cancel?.disabled === true || '保存中なのにキャンセルが押せる';
      },
    },
    {
      id: 'counter-only-near-limit',
      description: '文字数は上限が近いときだけ数える',
      onlyFixtures: ['create', 'edit'],
      check: ({ root }) => {
        const text = root.textContent ?? '';
        return !text.includes(String(MAX_SNIPPET_TEXT_LENGTH)) || '短い本文で上限を数えている';
      },
    },
    {
      id: 'edit-starts-from-existing-text',
      description: '直すときは元の本文から始まる',
      onlyFixtures: ['edit'],
      check: ({ root }) => {
        const area = root.querySelector('textarea');
        return (
          area?.value === '朝の光がきれいだった' || `本文が入っていない: "${area?.value ?? ''}"`
        );
      },
    },
  ],
});
