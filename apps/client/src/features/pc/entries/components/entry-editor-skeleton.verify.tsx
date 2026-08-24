/**
 * EntryEditorSkeleton の検証スペック。
 * エディタは一覧と全く別の形（縦3段）なので、「3段が正しい順で置かれているか」を DOM で確認する。
 * Issue #228 で問いリンカ専用行を中央カラムへ畳んだので、段は toolbar / body / status-bar。
 */

import { registerUnit } from '@oryzae/verify';
import { skeletonInvariants } from '@/lib/verify/skeleton-invariants';
import { EntryEditorSkeleton } from './entry-editor-skeleton';

interface Props {
  chips?: number;
  bodyLoading?: boolean;
}

/** 実 EntryEditor と同じ縦順。 */
const ORDER = ['toolbar', 'body', 'status-bar'];

registerUnit<Props>({
  id: 'EntryEditorSkeleton',
  title: 'EntryEditorSkeleton',
  description:
    'PC エディタのロード枠: ツールバー（日付/タイトル/問い） / 執筆エリア / ステータスバー',
  kind: 'component',
  render: (props) => <EntryEditorSkeleton {...props} />,
  fixtures: [
    { id: 'default', description: '既定（問いチップ1件想定）', props: {} },
    {
      id: 'no-chips',
      probe: true,
      description: 'Probe: 問い未紐付（チップ0）でも中央カラムが崩れない',
      props: { chips: 0 },
    },
    {
      id: 'many-chips',
      probe: true,
      description: 'Probe: チップ枠が多くても3段構造は崩れない（縦に伸びるだけ）',
      props: { chips: 8 },
    },
    {
      id: 'existing-entry',
      description: '既存エントリ: 本文は取得待ちなので執筆エリアに PageLoading を1つ出す',
      props: { chips: 1, bodyLoading: true },
    },
  ],
  invariants: [
    ...skeletonInvariants<Props>(),
    {
      id: 'bands-in-order',
      description: '実 EntryEditor と同じ縦順（ツールバー→本文→ステータス）で並ぶ',
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
      id: 'body-has-no-fake-lines',
      description: '執筆エリアに偽の行を描かない（書字方向が mount 後に確定するため）',
      check: ({ root, props }) => {
        const body = root.querySelector('[data-skeleton-slot="body"]');
        if (!body) return 'body slot が無い';
        // 許されるのは「本文待ち」を示す PageLoading だけ。行の枠は1つも置かない。
        const fake = Array.from(body.children).filter(
          (el) => el.getAttribute('data-testid') !== 'page-loading',
        ).length;
        if (fake > 0) return `執筆エリアに ${fake} 個の行枠がある（縦書き確定時にズレる）`;
        const hasLoading = Boolean(body.querySelector('[data-testid="page-loading"]'));
        return (
          hasLoading === Boolean(props.bodyLoading) ||
          `本文のロード表示が bodyLoading と不一致: hasLoading=${hasLoading}`
        );
      },
    },
  ],
});
