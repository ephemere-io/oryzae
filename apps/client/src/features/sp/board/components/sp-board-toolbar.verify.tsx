/**
 * SpBoardToolbar の検証スペック（SP のボードの道具箱）。
 *
 * props だけの presentational な部品。守るのは「**いま何ができるか**を道具の側が示す」
 * という設計そのもの: 何も選んでいなければ作るもの、選んでいればそのカードにできること。
 *
 * i18n（sp.board）依存のため withVerifyProviders で包む。
 */

import { registerUnit } from '@oryzae/verify';
import { withVerifyProviders } from '@/lib/verify/with-providers';
import { SpBoardToolbar } from './sp-board-toolbar';

interface Props {
  selectedType: 'snippet' | 'photo' | null;
  onEdit?: () => void;
  onBringToFront?: () => void;
  onDelete?: () => void;
  onCreateSnippet?: () => void;
  onCreatePhoto?: () => void;
  busy?: boolean;
}

const noop = () => {};

const ACTIONS = {
  onEdit: noop,
  onBringToFront: noop,
  onDelete: noop,
  onCreateSnippet: noop,
  onCreatePhoto: noop,
};

registerUnit<Props>({
  id: 'SpBoardToolbar',
  title: 'SpBoardToolbar',
  description: 'SP のボードの道具箱。選んでいるものに応じて中身が入れ替わる。',
  kind: 'component',
  render: (props) =>
    withVerifyProviders(
      <div style={{ position: 'relative', width: '390px', height: '160px' }}>
        <SpBoardToolbar {...props} />
      </div>,
    ),
  fixtures: [
    {
      id: 'create',
      description: '何も選んでいない（作るものが並ぶ）',
      props: { selectedType: null, ...ACTIONS },
    },
    {
      id: 'snippet-selected',
      description: 'スニペットを選んでいる（編集 / 前面へ / 外す）',
      props: { selectedType: 'snippet', ...ACTIONS },
    },
    {
      id: 'photo-selected',
      probe: true,
      description: 'Probe: 写真は本文を持たないので「編集」を出さない',
      props: { selectedType: 'photo', ...ACTIONS },
    },
    {
      id: 'busy',
      probe: true,
      description: 'Probe: 作っている最中は作るものを押せない（二重に作らせない）',
      props: { selectedType: null, busy: true, ...ACTIONS },
    },
  ],
  invariants: [
    {
      id: 'mode-follows-selection',
      description: '選んでいるかどうかで中身が入れ替わる',
      check: ({ contract, props }) => {
        const expected = props.selectedType === null ? 'create' : 'card';
        return contract.mode === expected || `mode=${contract.mode}（期待: ${expected}）`;
      },
    },
    {
      id: 'edit-only-for-snippets',
      description: '「編集」はスニペットのときだけ出す（写真に本文は無い）',
      check: ({ root, props }) => {
        const shown = (root.textContent ?? '').includes('編集');
        return (
          shown === (props.selectedType === 'snippet') ||
          `編集=${shown} だが selectedType=${props.selectedType}`
        );
      },
    },
    {
      id: 'create-and-card-never-mix',
      description: '作るものと、カードにできることが同時に並ばない',
      check: ({ root }) => {
        const text = root.textContent ?? '';
        const creating = text.includes('スニペット') || text.includes('写真');
        const acting = text.includes('外す');
        return !(creating && acting) || '作るものとカードの操作が同時に出ている';
      },
    },
    {
      id: 'labels-never-wrap',
      description: '語の途中で折り返さない（「前面／へ」のような割れ方を作らない）',
      // jsdom には版組みが無いので、折り返しを止めている宣言そのものを見る。
      // 実際の見た目は /verify/SpBoardToolbar/* を開いて確かめる。
      check: ({ root }) => {
        const bar = root.querySelector('[data-verify-unit="SpBoardToolbar"]');
        if (!(bar instanceof HTMLElement)) return '道具箱が無い';
        // 下端の列は画面の幅いっぱい（#616 の ActionPalette と同じ形）。
        if (!bar.classList.contains('w-full')) return '道具の列が幅いっぱいに敷かれていない';
        const wrapped = [...root.querySelectorAll('button')].filter(
          (button) => !button.classList.contains('whitespace-nowrap'),
        );
        return wrapped.length === 0 || `折り返しうるボタン ${wrapped.length} 個`;
      },
    },
    {
      id: 'actions-are-icon-plus-caption',
      description: 'PC と同じ絵（アイコン）に、短い名前を添える（スマホにはホバーが無い）',
      check: ({ root }) => {
        const buttons = [...root.querySelectorAll('button[data-palette-action]')];
        if (buttons.length === 0) return '道具が 1 つも無い';
        for (const button of buttons) {
          if (!button.querySelector('svg'))
            return `${button.getAttribute('aria-label')} に絵が無い`;
          const caption = button.querySelector('span')?.textContent ?? '';
          if (caption.trim() === '') return `${button.getAttribute('aria-label')} に名前が無い`;
        }
        return true;
      },
    },
    {
      id: 'busy-disables-creation',
      description: '作っている最中は、作る道具だけを押せなくする',
      onlyFixtures: ['busy'],
      check: ({ root }) => {
        // 止めるのは**作る道具だけ**。カードにできること（前面へ・外す）や盤面の
        // 寄り引きは、作っている最中でも押せてよい（二重に作る原因にならない）。
        const creating = [...root.querySelectorAll('button[data-verify-creates]')].filter(
          (element): element is HTMLButtonElement => element instanceof HTMLButtonElement,
        );
        if (creating.length === 0) return '作る道具が見つからない';
        const enabled = creating.filter((button) => !button.disabled).length;
        return enabled === 0 || `${enabled} 個の作る道具がまだ押せる`;
      },
    },
  ],
});
