/**
 * SpEditorPalette の検証スペック（SP エディタのキーボード上の操作列）。
 *
 * props だけの presentational な部品。守るのは「操作はここに集める」「押せないものは
 * 押せないと言う」「キーボードが無ければ画面の下端」。キーボードの高さそのものは
 * jsdom には無いので、位置の式ではなく宣言（fixed）を見る。
 */

import { registerUnit } from '@oryzae/verify';
import { withVerifyProviders } from '@/lib/verify/with-providers';
import { type SpEditorAction, SpEditorPalette } from './sp-editor-palette';

interface Props {
  actions: SpEditorAction[];
}

const noop = () => {};

const ACTIONS: SpEditorAction[] = [
  { id: 'question', label: '問いを結ぶ', onSelect: noop, active: true },
  { id: 'photo', label: '写真', onSelect: noop },
  { id: 'ferment', label: '瓶に納めて発酵させる', onSelect: noop },
  { id: 'delete', label: '削除', onSelect: noop, tone: 'danger' },
];

registerUnit<Props>({
  id: 'SpEditorPalette',
  title: 'SpEditorPalette',
  description: 'SP エディタの操作列。キーボードの真上に付いてくる。',
  kind: 'component',
  render: (props) =>
    withVerifyProviders(
      <div style={{ position: 'relative', width: '390px', height: '200px' }}>
        <SpEditorPalette {...props} />
      </div>,
    ),
  fixtures: [
    { id: 'all', description: '問い（結んでいる）・写真・発酵・削除', props: { actions: ACTIONS } },
    {
      id: 'disabled',
      probe: true,
      description: 'Probe: 押せない操作は理由つきで押せない',
      props: {
        actions: [
          {
            id: 'ferment',
            label: '瓶に納めて発酵させる',
            onSelect: noop,
            disabledReason: '本文を書くと漬け込めます',
          },
        ],
      },
    },
    {
      id: 'busy',
      probe: true,
      description: 'Probe: 送信中は回る印になり押せない',
      props: {
        actions: [{ id: 'ferment', label: '瓶に納めて発酵させる', onSelect: noop, busy: true }],
      },
    },
  ],
  invariants: [
    {
      id: 'buttons-match-actions',
      description: '操作の数だけボタンがある（キーボードを閉じる以外）',
      check: ({ root, contract }) => {
        const buttons = root.querySelectorAll('button[data-palette-action]').length;
        return (
          String(buttons) === contract.actionCount ||
          `ボタン=${buttons} だが actionCount=${contract.actionCount}`
        );
      },
    },
    {
      id: 'every-button-has-a-name',
      description: 'アイコンだけの列なので、全ボタンに名前がある',
      check: ({ root }) => {
        const nameless = [...root.querySelectorAll('button')].filter(
          (b) => !b.getAttribute('aria-label'),
        );
        return nameless.length === 0 || `${nameless.length} 個に名前が無い`;
      },
    },
    {
      id: 'disabled-says-why',
      description: '押せない操作は aria-disabled で、名前に理由を添える',
      onlyFixtures: ['disabled'],
      check: ({ root }) => {
        const button = root.querySelector('button[data-palette-action]');
        if (!(button instanceof HTMLElement)) return 'ボタンが無い';
        if (button.getAttribute('aria-disabled') !== 'true') return '押せてしまう';
        return (button.getAttribute('aria-label') ?? '').includes('本文を書くと') || '理由が無い';
      },
    },
    {
      id: 'sticks-to-the-bottom',
      description: '画面に固定され、下端（キーボードの上端）に付く',
      check: ({ root }) => {
        const bar = root.querySelector('[data-verify-unit="SpEditorPalette"]');
        if (!(bar instanceof HTMLElement)) return '列が無い';
        return bar.classList.contains('fixed') || '固定されていない';
      },
    },
    {
      id: 'keyboard-dismiss-only-when-open',
      description: 'キーボードを閉じるボタンは、キーボードが出ているときだけ',
      check: ({ root, contract }) => {
        const dismiss = [...root.querySelectorAll('button')].some((b) =>
          (b.getAttribute('aria-label') ?? '').includes('キーボード'),
        );
        return (
          dismiss === (contract.keyboardOpen === 'true') ||
          `閉じる=${dismiss} だが keyboardOpen=${contract.keyboardOpen}`
        );
      },
    },
  ],
});
