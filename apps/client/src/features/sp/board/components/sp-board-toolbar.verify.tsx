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
      description: '抜粋を選んでいる（編集 / 前面へ / 外す）',
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
      description: '「編集」は抜粋のときだけ出す（写真に本文は無い）',
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
        const creating = text.includes('抜粋') || text.includes('写真');
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
        // left-1/2 の絶対配置は「親の右端まで」を幅の上限にするため、w-max が要る。
        if (!bar.classList.contains('w-max')) return '道具箱が親の半分の幅に畳まれる';
        const wrapped = [...root.querySelectorAll('button')].filter(
          (button) => !button.classList.contains('whitespace-nowrap'),
        );
        return wrapped.length === 0 || `折り返しうるボタン ${wrapped.length} 個`;
      },
    },
    {
      id: 'busy-disables-creation',
      description: '作っている最中は押せない',
      onlyFixtures: ['busy'],
      check: ({ root }) => {
        const enabled = [...root.querySelectorAll('button')].filter((b) => !b.disabled).length;
        return enabled === 0 || `${enabled} 個のボタンがまだ押せる`;
      },
    },
  ],
});
