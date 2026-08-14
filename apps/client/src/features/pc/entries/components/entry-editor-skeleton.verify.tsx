/**
 * EntryEditorSkeleton の検証スペック。
 * エディタは一覧と全く別の形（縦4段）なので、「4段が正しい順で置かれているか」を DOM で確認する。
 */

import { registerUnit } from '@oryzae/verify';
import { skeletonInvariants } from '@/lib/verify/skeleton-invariants';
import { EntryEditorSkeleton } from './entry-editor-skeleton';

interface Props {
  chips?: number;
}

/** 実 EntryEditor と同じ縦順。 */
const ORDER = ['toolbar', 'question-linker', 'body', 'status-bar'];

registerUnit<Props>({
  id: 'EntryEditorSkeleton',
  title: 'EntryEditorSkeleton',
  description: 'PC エディタのロード枠: ツールバー / 問いリンカ / 執筆エリア / ステータスバー',
  kind: 'component',
  render: (props) => <EntryEditorSkeleton {...props} />,
  fixtures: [
    { id: 'default', description: '既定（問いチップ1件想定）', props: {} },
    {
      id: 'no-chips',
      probe: true,
      description: 'Probe: 問い未紐付（チップ0）でもリンカ行の高さが変わらない',
      props: { chips: 0 },
    },
    {
      id: 'many-chips',
      probe: true,
      description: 'Probe: チップが多くても4段構造は崩れない（横に溢れるだけ）',
      props: { chips: 8 },
    },
  ],
  invariants: [
    ...skeletonInvariants<Props>(),
    {
      id: 'four-bands-in-order',
      description: '実 EntryEditor と同じ縦順（ツールバー→リンカ→本文→ステータス）で並ぶ',
      check: ({ root }) => {
        const found = Array.from(root.querySelectorAll('[data-skeleton-slot]')).map((el) =>
          el.getAttribute('data-skeleton-slot'),
        );
        return (
          found.join(',') === ORDER.join(',') ||
          `段の順序が実エディタと違う: ${found.join(',')} (期待: ${ORDER.join(',')})`
        );
      },
    },
    {
      id: 'body-is-empty',
      description: '執筆エリアに偽の行を描かない（書字方向が mount 後に確定するため）',
      check: ({ root }) => {
        const body = root.querySelector('[data-skeleton-slot="body"]');
        if (!body) return 'body slot が無い';
        return (
          body.childElementCount === 0 ||
          `執筆エリアに ${body.childElementCount} 個の枠が描かれている（縦書き確定時にズレる）`
        );
      },
    },
  ],
});
