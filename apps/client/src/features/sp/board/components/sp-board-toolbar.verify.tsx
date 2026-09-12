/**
 * SpBoardToolbar の検証スペック（SP のボードの道具箱）。
 *
 * props だけの presentational な部品。守るのは「**いま何ができるか**を道具の側が示す」
 * という設計そのもの: 何も選んでいなければ作るもの、選んでいればそのカードにできること。
 * 作るものは PC のパレットと同じ 3 つ（スニペット / 画像から読み取る / 写真）。
 *
 * i18n（sp.board）依存のため withVerifyProviders で包む。
 */

import { registerUnit } from '@oryzae/verify';
import { withVerifyProviders } from '@/lib/verify/with-providers';
import { SpBoardToolbar } from './sp-board-toolbar';

interface Props {
  selectedType: 'snippet' | 'photo' | null;
  onEdit?: () => void;
  onOpen?: () => void;
  onBringToFront?: () => void;
  onDelete?: () => void;
  onCreateSnippet?: () => void;
  onReadImage?: () => void;
  onCreatePhoto?: () => void;
  busy?: boolean;
}

const noop = () => {};

const ACTIONS = {
  onEdit: noop,
  onOpen: noop,
  onBringToFront: noop,
  onDelete: noop,
  onCreateSnippet: noop,
  onReadImage: noop,
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
      description: '何も選んでいない（作るものが並ぶ: スニペット / 読み取る / 写真）',
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
      description: 'Probe: 写真は本文を持たないので「編集」ではなく「開く」を出す',
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
      id: 'create-has-the-same-three-tools-as-pc',
      description: '作るものは PC と同じ 3 つ（スニペット / 画像から読み取る / 写真）',
      onlyFixtures: ['create', 'busy'],
      check: ({ root }) => {
        const names = [...root.querySelectorAll('button')].map(
          (b) => b.getAttribute('aria-label') ?? '',
        );
        const missing = ['スニペットを作成', '写真から文字を読み取る', '写真を追加'].filter(
          (name) => !names.includes(name),
        );
        return missing.length === 0 || `無い道具: ${missing.join(' / ')}`;
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
      id: 'open-only-for-photos',
      description: '「開く」は写真のときだけ出す（スニペットの全文は編集で読める）',
      check: ({ root, props }) => {
        const shown = (root.textContent ?? '').includes('開く');
        return (
          shown === (props.selectedType === 'photo') ||
          `開く=${shown} だが selectedType=${props.selectedType}`
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
        // left-1/2 の絶対配置は「親の右端まで」を幅の上限にするため、w-max が要る。
        if (!bar.classList.contains('w-max')) return '道具箱が親の半分の幅に畳まれる';
        const wrapped = [...root.querySelectorAll('button')].filter(
          (button) => !button.classList.contains('whitespace-nowrap'),
        );
        return wrapped.length === 0 || `折り返しうるボタン ${wrapped.length} 個`;
      },
    },
    {
      id: 'uses-the-palette-surface',
      description: '面は PC のパレットと同じ（地・縁）。字は道具の書体',
      check: ({ root }) => {
        const bar = root.querySelector('[data-verify-unit="SpBoardToolbar"]');
        if (!(bar instanceof HTMLElement)) return '道具箱が無い';
        if (!bar.style.backgroundColor.includes('--surface-raised')) return '地がパレットと違う';
        return bar.style.fontFamily.includes('Inter') || '字が道具の書体でない';
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
