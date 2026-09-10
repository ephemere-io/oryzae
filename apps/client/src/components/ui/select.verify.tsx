/**
 * Select の検証スペック。
 *
 * 見張るのは**キーボードが死んでいないこと**。行は本物の <button> なので、
 * トリガーにだけ onKeyDown を付けると、フォーカスが行へ移った瞬間に ↑↓ / Enter /
 * Escape が効かなくなる。これは目で見ても分からない壊れ方なので、
 * 「行は Tab で入れない」「いまいる行を aria-activedescendant が指す」を契約にする。
 */

import { registerUnit } from '@oryzae/verify';
import { Select } from './select';

interface Props {
  value: string;
}

const OPTIONS = [
  { value: 'fontSize', label: '大きさ' },
  { value: 'fontWeight', label: '太さ' },
  { value: 'pressureBleed', label: 'にじみ' },
];

const TRIGGER = 'button[role="combobox"]';

registerUnit<Props>({
  id: 'Select',
  title: 'Select',
  description: '選択肢が3つ以上のときに面へ畳む選び方（2つ以下は Segmented）。',
  kind: 'component',
  render: (props) => (
    <div className="w-64 p-6">
      <Select ariaLabel="時間の表し方" value={props.value} options={OPTIONS} onChange={() => {}} />
    </div>
  ),
  fixtures: [
    { id: 'closed', description: '閉じている', props: { value: 'fontSize' } },
    {
      id: 'open',
      description: '開いている（3行）',
      props: { value: 'fontSize' },
      act: async (ctx) => {
        await ctx.click(TRIGGER);
        await ctx.wait(16);
      },
    },
    {
      id: 'unknown-value',
      probe: true,
      description: '保存値が選択肢に無い — 空で開き、行は全部出る',
      props: { value: 'unsupported' },
      act: async (ctx) => {
        await ctx.click(TRIGGER);
        await ctx.wait(16);
      },
    },
  ],
  invariants: [
    {
      id: 'closed-renders-no-panel',
      description: '閉じているときは面を描かない',
      onlyFixtures: ['closed'],
      check: ({ root }) =>
        root.querySelector('[role="listbox"]') === null || '閉じているのに面が出ている',
    },
    {
      id: 'open-lists-every-option',
      description: '開いたら選択肢を過不足なく出す',
      onlyFixtures: ['open', 'unknown-value'],
      check: ({ root }) => {
        const rows = root.querySelectorAll('[role="option"]').length;
        return rows === OPTIONS.length || `行数=${rows}, 期待=${OPTIONS.length}`;
      },
    },
    {
      id: 'rows-are-not-tab-stops',
      // 行にフォーカスが移ると、器の onKeyDown までイベントが上がってこない。
      description: '行は Tab で入れない（キー操作は器が捌く）',
      onlyFixtures: ['open', 'unknown-value'],
      check: ({ root }) => {
        const rows = Array.from(root.querySelectorAll('[role="option"]'));
        const tabbable = rows.filter((r) => r.getAttribute('tabindex') !== '-1');
        return tabbable.length === 0 || `Tab で入れる行が ${tabbable.length} 個ある`;
      },
    },
    {
      id: 'active-row-is-announced',
      description: '開いているとき、いまいる行を aria-activedescendant が指す',
      onlyFixtures: ['open', 'unknown-value'],
      check: ({ root }) => {
        const trigger = root.querySelector(TRIGGER);
        const id = trigger?.getAttribute('aria-activedescendant');
        if (!id) return 'aria-activedescendant が無い（どの行にいるか伝わらない）';
        return (
          root.querySelector(`#${CSS.escape(id)}`) !== null ||
          `aria-activedescendant="${id}" に対応する行が無い`
        );
      },
    },
    {
      id: 'no-native-select',
      description: 'ネイティブ <select> を使わない（OS 依存の見た目を出さない）',
      check: ({ root }) =>
        root.querySelector('select') === null || 'ネイティブ <select> が残っている',
    },
  ],
});
