/**
 * EntryPickerDialog の検証スペック。
 *
 * 日記の一覧は props で丸ごと渡す完全制御なので、fetch もルータも要らず孤立検証できる。
 * 守りたい契約は3つ:
 *   - 置き済み（placed）の項目は**一覧から消さず**、押せなくする。消すと「さっき
 *     置いたものが無い」と読めてしまう
 *   - 読み込み中・失敗・空の3状態がそれぞれ画面に出る（黙って空にしない）
 *   - placeable 契約（置ける件数）が実際の非 disabled ボタン数と一致する
 *
 * i18n 依存なので withVerifyProviders で包む。
 */

import { registerUnit } from '@oryzae/verify';
import type { PlaceableEntry } from '@/features/shared/board/types';
import { withVerifyProviders } from '@/lib/verify/with-providers';
import { EntryPickerDialog } from './entry-picker-dialog';

interface Props {
  open: boolean;
  entries: PlaceableEntry[];
  loading: boolean;
  error: boolean;
  onPlace: (entryId: string) => Promise<void>;
  onClose: () => void;
}

const noop = () => {};
const asyncNoop = () => Promise.resolve();

function entry(id: string, title: string, placed: boolean): PlaceableEntry {
  return {
    id,
    title,
    preview: `${title}の本文`,
    createdAt: '2026-04-11T10:00:00Z',
    placed,
  };
}

const base: Props = {
  open: true,
  entries: [],
  loading: false,
  error: false,
  onPlace: asyncNoop,
  onClose: noop,
};

registerUnit<Props>({
  id: 'EntryPickerDialog',
  title: 'EntryPickerDialog',
  description: 'その期間に書いた日記から、盤面に置くものを選ぶダイアログ。',
  kind: 'component',
  render: (props) => withVerifyProviders(<EntryPickerDialog {...props} />),
  fixtures: [
    {
      id: 'mixed',
      description: '置けるものと置き済みが混ざっている',
      props: {
        ...base,
        entries: [entry('e-1', '朝の記録', false), entry('e-2', '夜の記録', true)],
      },
    },
    {
      id: 'loading',
      description: '読み込み中',
      props: { ...base, loading: true },
    },
    {
      id: 'error',
      probe: true,
      description: 'Probe: 一覧の取得に失敗（黙って空にせず理由を出す）',
      props: { ...base, error: true },
    },
    {
      id: 'empty',
      probe: true,
      description: 'Probe: この期間に日記が無い（空であることを言葉で伝える）',
      props: base,
    },
    {
      id: 'all-placed',
      probe: true,
      description: 'Probe: 全部置き済み（一覧からは消えず、押せないだけ）',
      props: {
        ...base,
        entries: [entry('e-1', '朝の記録', true), entry('e-2', '夜の記録', true)],
      },
    },
  ],
  invariants: [
    {
      id: 'dialog-semantics',
      description: 'role="dialog" かつ aria-label を持つ',
      check: ({ root }) => {
        const dialog = root.querySelector('[data-verify-unit="EntryPickerDialog"]');
        return (
          (dialog?.getAttribute('role') === 'dialog' &&
            Boolean(dialog.getAttribute('aria-label'))) ||
          `dialog semantics 欠落: role=${dialog?.getAttribute('role')}`
        );
      },
    },
    {
      id: 'placed-entries-stay-listed-but-disabled',
      description: '置き済みの日記は一覧に残り、押せない',
      check: ({ root, props }) => {
        for (const e of props.entries) {
          const button = root.querySelector<HTMLButtonElement>(
            `button[data-verify-entry-option="${e.id}"]`,
          );
          if (!button) return `${e.id} が一覧から消えている（置き済みでも残すこと）`;
          if (e.placed && !button.disabled) return `${e.id} は置き済みなのに押せてしまう`;
        }
        return true;
      },
    },
    {
      id: 'placeable-contract-matches-enabled-buttons',
      description: 'placeable 契約が、実際に押せるボタンの数と一致する',
      check: ({ root, contract }) => {
        const enabled = Array.from(
          root.querySelectorAll<HTMLButtonElement>('button[data-verify-entry-option]'),
        ).filter((b) => !b.disabled).length;
        return (
          contract.placeable === String(enabled) ||
          `placeable=${contract.placeable} だが押せるボタンは ${enabled} 個`
        );
      },
    },
    {
      id: 'never-silently-blank',
      description: '一覧が空のときは、必ず理由（読み込み中／失敗／日記なし）が出ている',
      check: ({ root, props }) => {
        if (props.entries.length > 0) return true;
        const shown = Array.from(root.querySelectorAll('p')).some(
          (p) => (p.textContent ?? '').trim().length > 0,
        );
        return shown || '一覧が空なのに、何も説明が出ていない';
      },
    },
  ],
});
