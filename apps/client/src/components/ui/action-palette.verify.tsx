/**
 * ActionPalette の検証スペック。
 *
 * エントリー・ボード・瓶で同じ部品を使う。ここで見るのは部品の契約だけ:
 * 並べた数だけ押せる列ができる、押せない理由が名前に添えられる、キーボードが出ているときだけ
 * 右端に「閉じる」が出る、危険な操作は色が違う。中身の意味は各画面の verify が見る。
 */

import { registerUnit } from '@oryzae/verify';
import { ActionPalette, type PaletteAction } from './action-palette';
import { PhotoIcon, SendToBackIcon, SnippetIcon, TrashIcon } from './palette-icons';

interface Props {
  actions: PaletteAction[];
  keyboardOpen: boolean;
}

const noop = () => {};

const CREATE: PaletteAction[] = [
  { id: 'snippet', label: 'スニペット', icon: <SnippetIcon />, onSelect: noop },
  {
    id: 'photo',
    label: '写真',
    icon: <PhotoIcon />,
    onSelect: noop,
    file: { accept: 'image/*', onFile: noop },
  },
];

const CARD: PaletteAction[] = [
  { id: 'edit', label: '編集', icon: <SnippetIcon />, onSelect: noop, active: true },
  { id: 'back', label: '背面へ', icon: <SendToBackIcon />, onSelect: noop },
  { id: 'busy', label: '送信中', icon: <PhotoIcon />, onSelect: noop, busy: true },
  {
    id: 'locked',
    label: '漬け込む',
    icon: <PhotoIcon />,
    onSelect: noop,
    disabledReason: '漬け込み済み',
  },
  { id: 'delete', label: '外す', icon: <TrashIcon />, onSelect: noop, tone: 'danger' },
];

registerUnit<Props>({
  id: 'ActionPalette',
  title: 'ActionPalette',
  description: '画面の下端の操作の列（エントリー・ボード・瓶で共通）',
  kind: 'component',
  render: (props) => (
    <div style={{ width: '390px' }}>
      <ActionPalette
        actions={props.actions}
        ariaLabel="操作"
        keyboardOpen={props.keyboardOpen}
        dismissKeyboardLabel="キーボードを閉じる"
      />
    </div>
  ),
  fixtures: [
    {
      id: 'create',
      description: '作るものが 2 つ、キーボード無し',
      props: { actions: CREATE, keyboardOpen: false },
    },
    {
      id: 'keyboard',
      description: 'キーボードが出ている（右端に閉じる）',
      props: { actions: CREATE, keyboardOpen: true },
    },
    {
      id: 'card',
      description: 'カードを選んでいる（効いている印・送信中・押せない理由・危険）',
      props: { actions: CARD, keyboardOpen: false },
    },
    {
      id: 'press-locked',
      probe: true,
      description: 'Probe: 押せない列を押すと理由が出て、列は残る',
      props: { actions: CARD, keyboardOpen: true },
      act: async (ctx) => {
        await ctx.click('button[data-palette-action="locked"]');
        await ctx.click('button[data-palette-action="dismiss-keyboard"]');
        await ctx.wait(16);
      },
    },
    {
      id: 'hint',
      description: '押せない操作を押すと、理由がパレットの上に 1 行で出る',
      props: { actions: CARD, keyboardOpen: false },
      act: async (ctx) => {
        await ctx.click('button[data-palette-action="locked"]');
        await ctx.wait(16);
      },
    },
  ],
  invariants: [
    {
      id: 'disabled-press-says-why',
      description: '押せない操作を押したら、その理由が見える（読み上げだけにしない）',
      onlyFixtures: ['hint'],
      check: ({ root }) => {
        const hint = root.querySelector('[data-palette-hint]');
        return (hint?.textContent ?? '').includes('漬け込み済み') || '理由が出ていない';
      },
    },
    {
      id: 'one-button-per-action',
      description: '並べた数だけ押せる列がある',
      check: ({ root, contract }) => {
        const count = root.querySelectorAll(
          '[data-palette-action]:not([data-palette-action="dismiss-keyboard"])',
        ).length;
        return (
          String(count) === contract.actionCount ||
          `列=${count} だが contract.actionCount="${contract.actionCount}"`
        );
      },
    },
    {
      id: 'file-action-is-the-input',
      description:
        '写真を選ぶ操作は、押した指がそのまま input[type=file] に当たる（iOS のメニューがボタンから出る）',
      onlyFixtures: ['create', 'keyboard'],
      check: ({ root }) => {
        const cell = root.querySelector('[data-palette-action="photo"]');
        const input = cell?.querySelector('input[type="file"]');
        if (!(input instanceof HTMLInputElement)) return '写真の操作に input[type=file] が無い';
        if (input.getAttribute('aria-label') !== '写真') return '写真の input に名前が無い';
        return (
          (input.className.includes('absolute') && input.className.includes('inset-0')) ||
          'input がボタンの箱に重なっていない'
        );
      },
    },
    {
      id: 'dismiss-only-with-keyboard',
      description: '「キーボードを閉じる」はキーボードが出ているときだけ',
      check: ({ root, contract }) => {
        const has = root.querySelector('button[data-palette-action="dismiss-keyboard"]') !== null;
        return (
          has === (contract.keyboardOpen === 'true') ||
          `閉じる=${has}, keyboardOpen=${contract.keyboardOpen}`
        );
      },
    },
    {
      id: 'disabled-reason-in-name',
      description: '押せない理由は名前（読み上げ）に添える',
      onlyFixtures: ['card', 'press-locked'],
      check: ({ root }) => {
        const locked = root.querySelector('button[data-palette-action="locked"]');
        const name = locked?.getAttribute('aria-label') ?? '';
        return (
          (locked?.getAttribute('aria-disabled') === 'true' && name.includes('漬け込み済み')) ||
          `aria-disabled=${locked?.getAttribute('aria-disabled')}, name=${name}`
        );
      },
    },
    {
      id: 'busy-is-disabled',
      description: '送信中は押せない',
      onlyFixtures: ['card'],
      check: ({ root }) =>
        root.querySelector('button[data-palette-action="busy"]')?.getAttribute('aria-disabled') ===
          'true' || '送信中なのに押せる',
    },
  ],
});
