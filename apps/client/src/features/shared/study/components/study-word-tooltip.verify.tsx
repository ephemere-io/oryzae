/**
 * StudyWordTooltip の検証スペック。
 *
 * この部品の存在理由は「瓶の語が何を指すのか分かること」なので、守るのは 2 つ:
 * **出どころが出ること**と、**問いが消えていても語を黙って落とさないこと**。
 *
 * 「触れていなければ何も出さない」はここに置けない。描画物が無い＝契約ノードも
 * 出せないので、孤立検証の土台（dom-contract）が成立しない。素の単体テスト
 * （`study-word-tooltip.test.tsx`）で見る。
 */

import { registerUnit } from '@oryzae/verify';
import { withVerifyProviders } from '@/lib/verify/with-providers';
import { StudyWordTooltip } from './study-word-tooltip';

interface Props {
  word: string | null;
  question: string | null;
  screen: { x: number; y: number };
}

const AT = { x: 120, y: 90 };

registerUnit<Props>({
  id: 'StudyWordTooltip',
  title: 'StudyWordTooltip',
  description: '瓶の語に触れたときに出す、その語が出てきた問い',
  kind: 'component',
  render: (props) =>
    withVerifyProviders(
      <div style={{ position: 'relative', width: '360px', height: '200px' }}>
        <StudyWordTooltip {...props} />
      </div>,
    ),
  fixtures: [
    {
      id: 'with-question',
      description: '語と、その出どころの問い',
      props: { word: '余白', question: 'なぜ自分は急ぐのが苦手なのだろう', screen: AT },
    },
    {
      id: 'question-gone',
      probe: true,
      description: 'Probe: 問いが消えていても語は出す（出どころだけ出せないと伝える）',
      props: { word: '余白', question: null, screen: AT },
    },
  ],
  invariants: [
    {
      id: 'shows-the-word',
      description: '触れている語をそのまま出す',
      check: ({ root, props }) => {
        const text = root.textContent ?? '';
        if (props.word === null) return true;
        return text.includes(props.word) || `語 "${props.word}" が出ていない`;
      },
    },
    {
      id: 'shows-where-it-came-from',
      description: '出どころの問いを出す（語だけでは何を指すか分からない）',
      onlyFixtures: ['with-question'],
      check: ({ root, props }) => {
        const text = root.textContent ?? '';
        const question = props.question ?? '';
        return text.includes(question) || '出どころの問いが出ていない';
      },
    },
    {
      id: 'gone-question-still-shows-the-word',
      description: '問いが消えていても語は黙って落とさない',
      onlyFixtures: ['question-gone'],
      check: ({ root }) => {
        const text = (root.textContent ?? '').trim();
        if (!text.includes('余白')) return '語が消えている';
        // 語だけを出して黙るのではなく、出どころが無いことも言う。
        return text.length > '余白'.length || '出どころが無いことを伝えていない';
      },
    },
    {
      id: 'does-not-eat-the-pointer',
      description: '指やカーソルを奪わない（下の 3D を触り続けられる）',
      check: ({ root, props }) => {
        if (props.word === null) return true;
        const tooltip = root.querySelector('[data-verify-unit="StudyWordTooltip"]');
        const className = tooltip?.className ?? '';
        return (
          className.includes('pointer-events-none') ||
          'pointer-events-none が無い（ツールチップが当たりを奪う）'
        );
      },
    },
  ],
});
