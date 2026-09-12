/**
 * SpJarMap の検証スペック（SP の瓶の地図）。
 *
 * 守るのは PC と同じ構造であること: 中央に壜、まわりに問いの円、円は世界座標に置かれて
 * 寄り引き（`useCanvasViewport`）に乗る。SP の違いは円の中に中身を並べないことだけ。
 */

import { registerUnit } from '@oryzae/verify';
import { withVerifyProviders } from '@/lib/verify/with-providers';
import { type MapQuestion, SpJarMap } from './sp-jar-map';

interface Props {
  questions: MapQuestion[];
  onSelect: (id: string) => void;
}

const noop = () => {};

const three: MapQuestion[] = [
  {
    id: 'q-1',
    text: '最近うれしかったことは？',
    jarX: null,
    jarY: null,
    hasLetter: true,
    unread: true,
  },
  { id: 'q-2', text: 'なぜ続けているのか', jarX: 30, jarY: 30, hasLetter: true, unread: false },
  {
    id: 'q-3',
    text: 'ここ数ヶ月のあいだに自分のなかで静かに変わってしまったものは何だったのか、それをいまあらためて言葉にするとどんな形になるだろうか',
    jarX: null,
    jarY: null,
    hasLetter: false,
    unread: false,
  },
];

registerUnit<Props>({
  id: 'SpJarMap',
  title: 'SpJarMap',
  description: 'SP の瓶の地図。中央に壜、まわりに小さなシャーレ（問い）。ピンチとパンで見る。',
  kind: 'component',
  render: (props) =>
    withVerifyProviders(
      <div style={{ position: 'relative', width: '390px', height: '640px' }}>
        <SpJarMap {...props} />
      </div>,
    ),
  fixtures: [
    {
      id: 'three',
      description: '問いが 3 つ（未読の手紙 1・既読 1・無し 1）',
      props: { questions: three, onSelect: noop },
    },
    {
      id: 'one',
      probe: true,
      description: 'Probe: 問いが 1 つでも既定の席に置かれる',
      props: { questions: three.slice(0, 1), onSelect: noop },
    },
    {
      id: 'empty',
      probe: true,
      description: 'Probe: 問いが無くても壜は出る',
      props: { questions: [], onSelect: noop },
    },
  ],
  invariants: [
    {
      id: 'circles-match-count',
      description: '円の数が問いの数と一致する',
      check: ({ root, contract }) => {
        const circles = root.querySelectorAll('button[data-question-id]').length;
        return String(circles) === contract.count || `円=${circles} だが count=${contract.count}`;
      },
    },
    {
      id: 'circles-do-not-pan',
      description: '円の上で始まった指はパンにしない（押せる）',
      check: ({ root }) => {
        const bad = [...root.querySelectorAll('button[data-question-id]')].filter(
          (b) => !b.hasAttribute('data-canvas-no-pan'),
        );
        return bad.length === 0 || `${bad.length} 個の円がパンを奪われる`;
      },
    },
    {
      id: 'circles-are-plain',
      description: '円の中は問いだけ（言葉・抜粋の予告は並べない。読むのは開いた先）',
      check: ({ root }) => {
        const circle = root.querySelector('button[data-question-id]');
        if (!circle) return true;
        // 中身は「問いの文」と「手紙の印」の 2 種まで。
        return circle.children.length <= 2 || `円の中に ${circle.children.length} 個の要素がある`;
      },
    },
    {
      id: 'letter-mark-iff-letter',
      description: '手紙の印は手紙があるときだけ',
      check: ({ root, props }) => {
        const marks = root.querySelectorAll('[data-letter-mark]').length;
        const expected = props.questions.filter((q) => q.hasLetter).length;
        return marks === expected || `印=${marks}（期待: ${expected}）`;
      },
    },
    {
      id: 'has-zoom-controls',
      description: '寄り引きの段階ボタンがある（ピンチが苦手でも操作できる）',
      check: ({ root }) =>
        root.querySelector('[data-verify-unit="CanvasZoomControls"]') !== null ||
        'ズームの段階ボタンが無い',
    },
  ],
});
