/**
 * SelectionFrame の検証スペック（複数選択したときに出る、群を囲む枠）。
 *
 * 守るのは 2 つ。**枠は指を通す**（塞ぐと群を掴んで動かせなくなる）ことと、
 * **掴めるのは 4 隅のつまみだけ**であること。回転は出さない。
 */

import { registerUnit } from '@oryzae/verify';
import { SelectionFrame } from './selection-frame';

interface Props {
  bounds: { x: number; y: number; width: number; height: number };
  count: number;
}

const noop = () => {};

registerUnit<Props>({
  id: 'SelectionFrame',
  title: 'SelectionFrame',
  description: '複数選択しているカードを囲む枠。角のつまみで群ごと大きさを変える。',
  kind: 'component',
  render: (props) => (
    <div style={{ position: 'relative', width: '420px', height: '260px' }}>
      <SelectionFrame {...props} onResizeStart={noop} />
    </div>
  ),
  fixtures: [
    {
      id: 'pair',
      probe: true,
      description: 'Probe: 2 枚を囲む',
      props: {
        bounds: { x: 40, y: 60, width: 320, height: 150 },
        count: 2,
      },
    },
    {
      id: 'many',
      description: '7 枚を囲む（枚数が二桁に近づいても枠からはみ出さない）',
      props: {
        bounds: { x: 20, y: 40, width: 380, height: 200 },
        count: 7,
      },
    },
  ],
  invariants: [
    {
      id: 'frame-lets-pointers-through',
      description: '枠は指を通す（塞ぐと、選んだカードを掴んで動かせなくなる）',
      check: ({ root }) => {
        const frame = root.querySelector('[data-verify-unit="SelectionFrame"]');
        if (!(frame instanceof HTMLElement)) return '枠が無い';
        return frame.classList.contains('pointer-events-none') || '枠が指を受け取ってしまっている';
      },
    },
    {
      id: 'four-corners-are-grabbable',
      description: '掴めるのは 4 隅のつまみだけ（回転は出さない）',
      check: ({ root }) => {
        const handles = [...root.querySelectorAll('[data-verify-handle]')];
        const corners = handles.map((h) => h.getAttribute('data-verify-handle')).sort();
        if (corners.join(',') !== 'ne,nw,se,sw') return `つまみが ${corners.join(',')}`;
        for (const handle of handles) {
          if (!(handle instanceof HTMLElement)) return 'つまみが要素ではない';
          if (handle.style.pointerEvents !== 'auto')
            return `${handle.getAttribute('data-verify-handle')} が掴めない`;
        }
        return root.querySelector('[role="slider"]') === null || '群に回転のつまみが出ている';
      },
    },
    {
      id: 'count-matches-selection',
      description: '出ている枚数が、選んでいる枚数と一致する',
      check: ({ root, props }) => {
        const badge = root.querySelector('[data-verify-part="count"]');
        const shown = badge?.textContent?.trim() ?? '';
        return shown === String(props.count) || `枚数が「${shown}」（期待: ${props.count}）`;
      },
    },
    {
      id: 'count-does-not-sit-on-a-handle',
      description: '枚数は四隅に置かない（つまみの席なので、重なると数字が読めない）',
      // 実ビルドで踏んだ: 左上に出していたら `nw` のつまみが数字の上に完全に乗った。
      // jsdom に版組みは無いので、「辺の中央に置く」という**置き方**そのものを見る。
      check: ({ root }) => {
        const badge = root.querySelector('[data-verify-part="count"]');
        if (!(badge instanceof HTMLElement)) return '枚数が無い';
        return (
          badge.style.left === '50%' ||
          `枚数が角に寄っている（left=${badge.style.left || '未指定'}）`
        );
      },
    },
    {
      id: 'handles-do-not-start-pan',
      description: 'つまみを掴んでも盤面は動かない（data-canvas-no-pan）',
      check: ({ root }) => {
        const loose = [...root.querySelectorAll('[data-verify-handle]')].filter(
          (handle) => !handle.hasAttribute('data-canvas-no-pan'),
        );
        return loose.length === 0 || `${loose.length} 個のつまみが盤面を動かしてしまう`;
      },
    },
  ],
});
