/**
 * EntryActionPalette の検証スペック。
 *
 * 操作は props（actions）で注入されるので、データ取得にも router にも依存せず孤立検証できる。
 * i18n は withVerifyProviders が供給する。
 *
 * 位置と畳み具合は localStorage に載るが、**fixture をまたいで漏れる**ので、
 * 位置に依存する検証はしない（既定位置＝未移動の状態だけを見る）。ドラッグは
 * pointermove を要する経路なので孤立検証では駆動できず、`dragging` 契約は false 固定になる。
 */

import { registerUnit } from '@oryzae/verify';
import { withVerifyProviders } from '@/lib/verify/with-providers';
import { EntryActionPalette, type PaletteAction } from './entry-action-palette';

interface Props {
  actions: PaletteAction[];
  visible: boolean;
  persistState?: boolean;
}

const PALETTE = '[data-verify-unit="EntryActionPalette"]';
const noop = () => {};

function icon(path: string) {
  return (
    <svg
      aria-hidden="true"
      className="h-4 w-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
    >
      <path d={path} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const ACTIONS: PaletteAction[] = [
  { id: 'question', label: '問いを結ぶ', icon: icon('M12 5v14M5 12h14'), onSelect: noop },
  { id: 'photo', label: '写真から文字を起こす', icon: icon('M4 7h16v12H4z'), onSelect: noop },
  { id: 'voice', label: '音声入力', icon: icon('M12 3v10'), onSelect: noop },
  { id: 'pickle', label: '漬け込む', icon: icon('M8 7h8l-.6 11H8.6z'), onSelect: noop },
  { id: 'fullscreen', label: 'フルスクリーン', icon: icon('M4 4h6M4 4v6'), onSelect: noop },
];

const WITH_DISABLED: PaletteAction[] = ACTIONS.map((a) =>
  a.id === 'pickle' ? { ...a, disabledReason: '本文を書くと漬け込めます' } : a,
);

registerUnit<Props>({
  id: 'EntryActionPalette',
  title: 'EntryActionPalette',
  description: 'エントリー画面の操作を集めたフローティングパレット（移動・折りたたみ可）',
  kind: 'component',
  render: (props) => withVerifyProviders(<EntryActionPalette {...props} />),
  fixtures: [
    {
      id: 'visible',
      description: '表示中（操作5つ）',
      props: { actions: ACTIONS, visible: true, persistState: false },
    },
    {
      id: 'hidden',
      description: '入力中：フォーカスモードで消えている（クリックも透過する）',
      props: { actions: ACTIONS, visible: false, persistState: false },
    },
    {
      id: 'with-disabled',
      description: '漬け込むが非活性（理由はホバーで出す）',
      props: { actions: WITH_DISABLED, visible: true, persistState: false },
    },
    {
      id: 'disabled-hovered',
      description: '非活性の操作にホバーすると理由がツールチップで出る',
      props: { actions: WITH_DISABLED, visible: true, persistState: false },
      act: async ({ root, wait }) => {
        const btn = root.querySelector<HTMLElement>('[data-palette-action="pickle"]');
        if (!btn) throw new Error('pickle ボタンが見つからない');
        // ホバーはボタンではなくラッパーが拾う（disabled 相当のボタンにマウス系
        // イベントを載せると React に抑止されるため、意図的にラッパー側にある）。
        const target = btn.parentElement ?? btn;
        target.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
        target.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
        await wait(16);
      },
    },
    {
      id: 'collapsed',
      description: '畳んだ状態（下端に貼りついた、開くつまみだけが残る）',
      props: { actions: ACTIONS, visible: true, persistState: false },
      act: async ({ root, wait }) => {
        const toggle = root.querySelector<HTMLElement>('button[aria-expanded="true"]');
        if (!toggle) throw new Error('折りたたみボタンが見つからない');
        toggle.click();
        await wait(16);
      },
    },
    {
      id: 'no-actions',
      probe: true,
      description: 'Probe: 操作が0件でも畳むボタンだけで崩れない',
      props: { actions: [], visible: true, persistState: false },
    },
  ],
  invariants: [
    {
      id: 'hidden-is-click-through',
      description: '消えているときはクリックを透過する（本文の操作を奪わない）',
      onlyFixtures: ['hidden'],
      check: ({ root }) => {
        const el = root.querySelector(PALETTE);
        if (!el) return 'パレットの契約要素が見つからない';
        return (
          el.className.includes('pointer-events-none') ||
          '非表示なのに pointer-events が生きている（透明な板が本文の上に残る）'
        );
      },
    },
    {
      id: 'action-count-matches',
      description: 'actionCount 契約が props の件数と一致する',
      check: ({ contract, props }) =>
        Number(contract.actionCount) === props.actions.length ||
        `actionCount=${contract.actionCount}, 期待=${props.actions.length}`,
    },
    {
      id: 'expanded-renders-every-action',
      description: '開いているときは操作がすべてボタンとして出る',
      check: ({ root, contract, props }) => {
        if (contract.collapsed === 'true') return true;
        const rendered = root.querySelectorAll('[data-palette-action]').length;
        return (
          rendered === props.actions.length ||
          `描画された操作=${rendered}, 期待=${props.actions.length}`
        );
      },
    },
    {
      id: 'collapsed-hides-actions',
      description: '畳むと操作は消え、開くつまみだけが残る',
      onlyFixtures: ['collapsed'],
      check: ({ root, contract }) => {
        if (contract.collapsed !== 'true') return '折りたたみが state に乗っていない';
        const rendered = root.querySelectorAll('[data-palette-action]').length;
        return rendered === 0 || `畳んだのに操作が ${rendered} 個描画されている`;
      },
    },
    {
      id: 'disabled-actions-are-marked-disabled',
      description: 'disabledReason のある操作は aria-disabled になる',
      check: ({ root, props }) => {
        for (const action of props.actions) {
          const btn = root.querySelector<HTMLButtonElement>(`[data-palette-action="${action.id}"]`);
          if (!btn) continue;
          const expected = Boolean(action.disabledReason);
          const actual = btn.getAttribute('aria-disabled') === 'true';
          if (actual !== expected) {
            return `${action.id}: aria-disabled=${actual}, 期待=${expected}`;
          }
        }
        return true;
      },
    },
    {
      id: 'reason-is-reachable',
      description:
        '押せない操作は本当の disabled にしない（disabled だとマウスもフォーカスも受けず、理由に到達できない）',
      check: ({ root, props }) => {
        for (const action of props.actions) {
          if (!action.disabledReason) continue;
          const btn = root.querySelector<HTMLButtonElement>(`[data-palette-action="${action.id}"]`);
          if (!btn) continue;
          if (btn.disabled) {
            return `${action.id}: disabled=true になっている（理由のツールチップが永久に出ない）`;
          }
        }
        return true;
      },
    },
    {
      id: 'reason-shown-on-hover-only',
      description: 'ホバーしていない間は理由のツールチップを出さない',
      onlyFixtures: ['with-disabled'],
      check: ({ root }) =>
        root.querySelector('[role="tooltip"]') === null ||
        'ホバーしていないのにツールチップが出ている',
    },
    {
      id: 'hovered-reason-is-rendered',
      description: '非活性の操作にホバーすると理由が出る',
      onlyFixtures: ['disabled-hovered'],
      check: ({ root }) => {
        const tip = root.querySelector('[role="tooltip"]');
        if (!tip) return 'ホバーしても理由が出ない';
        return (
          tip.textContent?.includes('漬け込めます') ||
          `ツールチップの内容が理由になっていない: "${tip.textContent}"`
        );
      },
    },
  ],
});
