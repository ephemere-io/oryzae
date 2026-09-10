/**
 * MenuPanel / MenuOption の検証スペック。
 *
 * この2つは**設定パネルの Select と、問いを結ぶチップのドロップダウンが共有する面と行**。
 * ここが崩れると、同じ「選ぶ」操作が画面ごとに別の見た目になる。
 * 見張るのは (1) 行の高さが揃っていること (2) 選択の印の場所が固定であること。
 */

import { registerUnit } from '@oryzae/verify';
import { MenuOption, MenuPanel } from './menu';

interface Props {
  role: 'listbox' | 'menu';
  selectedIndex: number;
}

const ITEMS = ['縦書き', '横書き', '内側から外側へ'];

registerUnit<Props>({
  id: 'MenuPanel',
  title: 'MenuPanel',
  description: '開いて選ぶ面と、その中の1行（Select と問いチップが共有する）。',
  kind: 'component',
  render: (props) => (
    <div className="w-64 p-6">
      <MenuPanel role={props.role} ariaLabel="選ぶ">
        {ITEMS.map((label, i) => (
          <MenuOption
            key={label}
            role={props.role === 'listbox' ? 'option' : 'menuitemcheckbox'}
            selected={i === props.selectedIndex}
            onClick={() => {}}
          >
            {label}
          </MenuOption>
        ))}
      </MenuPanel>
    </div>
  ),
  fixtures: [
    {
      id: 'listbox-single',
      description: '単一選択（設定パネルの Select）',
      props: { role: 'listbox', selectedIndex: 0 },
    },
    {
      id: 'menu-checkable',
      description: '付け外し（問いを結ぶチップ）',
      props: { role: 'menu', selectedIndex: 1 },
    },
    {
      id: 'nothing-selected',
      probe: true,
      description: '何も選ばれていない — 印の枠だけが残り、文字の左端が動かない',
      props: { role: 'listbox', selectedIndex: -1 },
    },
  ],
  invariants: [
    {
      id: 'rows-share-one-height',
      description: '面の中の行はすべて同じ高さ（32px）',
      check: ({ root }) => {
        const rows = [...root.querySelectorAll('[role="option"],[role="menuitemcheckbox"]')];
        if (rows.length !== ITEMS.length)
          return `expected ${ITEMS.length} rows, got ${rows.length}`;
        const classes = new Set(rows.map((r) => r.className));
        // 選択の有無で色は変わるが、高さのクラス（h-8）は全行に付いていること。
        const allH8 = rows.every((r) => r.className.includes('h-8'));
        return allH8 || `rows do not share one height: ${[...classes].join(' | ')}`;
      },
    },
    {
      id: 'check-slot-is-reserved',
      description: '選択の印の場所は、選ばれていない行にも同じだけ空いている',
      check: ({ root }) => {
        const rows = [...root.querySelectorAll('[role="option"],[role="menuitemcheckbox"]')];
        const slots = rows.map((r) => r.querySelector('[aria-hidden="true"]'));
        return (
          slots.every((s) => s !== null) ||
          '選択の印の枠が無い行がある（選ぶたびに文字が横に跳ねる）'
        );
      },
    },
    {
      id: 'at-most-one-selected',
      description: '選ばれている行は多くても1つ',
      check: ({ root }) => {
        const selected = root.querySelectorAll('[aria-selected="true"],[aria-checked="true"]');
        return selected.length <= 1 || `expected at most 1 selected, got ${selected.length}`;
      },
    },
    {
      id: 'nothing-selected-shows-no-mark',
      description: '何も選ばれていない fixture では印がどこにも付かない',
      onlyFixtures: ['nothing-selected'],
      check: ({ root }) => {
        const selected = root.querySelectorAll('[aria-selected="true"],[aria-checked="true"]');
        return selected.length === 0 || `expected 0 selected, got ${selected.length}`;
      },
    },
  ],
});
