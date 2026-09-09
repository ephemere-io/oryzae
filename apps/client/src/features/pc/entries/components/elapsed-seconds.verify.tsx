/**
 * ElapsedSeconds の検証スペック。
 *
 * 固定したいのは **残り時間を出さないこと**。ここに「あと N 秒」を足すには、この写真・
 * このモデル・この回線での所要時間が要るが、そんな数字はどこにも無い。推定を混ぜると、
 * 外れたときに「止まっているのか遅いだけなのか」がかえって分からなくなる。
 *
 * 秒数そのものは時間で動くので固定しない。出す／出さないの切り替わりだけを見る。
 */

import { registerUnit } from '@oryzae/verify';
import { ElapsedSeconds } from './elapsed-seconds';

interface Props {
  running: boolean;
}

registerUnit<Props>({
  id: 'ElapsedSeconds',
  title: 'ElapsedSeconds',
  description: '文字起こし中に出る経過秒数（実測のみ。残り時間は出さない）',
  kind: 'component',
  render: (props) => <ElapsedSeconds running={props.running} label={(s) => `${s} 秒経過`} />,
  fixtures: [
    { id: 'running', description: '読み取り中', props: { running: true } },
    {
      id: 'idle',
      probe: true,
      description: 'Probe: 待機中は何も出さない（0.0 秒とも出さない）',
      props: { running: false },
    },
  ],
  invariants: [
    {
      id: 'silent-when-idle',
      description: '動いていないときは何も描かない',
      check: ({ root, props }) => {
        if (props.running) return true;
        const text = root.textContent?.trim() ?? '';
        return text === '' || `待機中なのに "${text}" を描いている`;
      },
    },
    {
      id: 'shows-measured-seconds',
      description: '動いている間は経過秒数を出す',
      check: ({ root, props }) => {
        if (!props.running) return true;
        return /\d+\.\d\s*秒経過/.test(root.textContent ?? '') || '経過秒数が出ていない';
      },
    },
    {
      id: 'no-remaining-estimate',
      description: '残り時間を出さない（推定を混ぜない）',
      check: ({ root }) => {
        const text = root.textContent ?? '';
        return !/あと|残り|remaining|ETA/i.test(text) || `残り時間らしき表示がある: "${text}"`;
      },
    },
    {
      id: 'announced-politely',
      description: '読み上げに割り込まない形で伝える',
      check: ({ root }) => {
        const live =
          root.getAttribute('aria-live') ??
          root.querySelector('[aria-live]')?.getAttribute('aria-live');
        return live === 'polite' || `aria-live が polite でない: ${live}`;
      },
    },
  ],
});
