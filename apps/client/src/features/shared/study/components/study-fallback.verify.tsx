/**
 * StudyFallback の検証スペック。
 *
 * 「WebGL 非対応で静止フォールバックが出る（白画面にならない）」という受け入れ基準
 * （40-acceptance.md「品質」）は、**行き先が残っていること**まで含めて満たされる。
 */

import { registerUnit } from '@oryzae/verify';
import { withVerifyProviders } from '@/lib/verify/with-providers';
import { StudyFallback } from './study-fallback';

interface Props {
  loading?: boolean;
}

registerUnit<Props>({
  id: 'StudyFallback',
  title: 'StudyFallback',
  description: '書斎が出せないときの静止表現（WebGL 非対応・読み込み中）',
  kind: 'component',
  render: (props) => withVerifyProviders(<StudyFallback {...props} />),
  fixtures: [
    { id: 'unsupported', description: 'WebGL 非対応', props: {} },
    {
      id: 'loading',
      probe: true,
      description: 'Probe: 読み込み中は理由文も行き先も出さない（書斎の絵だけ）',
      props: { loading: true },
    },
  ],
  invariants: [
    {
      id: 'three-destinations',
      description: '書斎が出せないときは、瓶・記録・ボードの 3 つへ行けるリンクが残る',
      onlyFixtures: ['unsupported'],
      check: ({ root }) => {
        const hrefs = [...root.querySelectorAll('a')].map((a) => a.getAttribute('href'));
        for (const href of ['/jar', '/entries/new', '/board']) {
          if (!hrefs.includes(href)) return `${href} へのリンクが無い`;
        }
        return true;
      },
    },
    {
      id: 'loading-offers-no-destinations',
      description: '読み込み中は行き先を出さない（すぐ書斎に置き換わるのに選択を迫らない）',
      onlyFixtures: ['loading'],
      check: ({ root }) => {
        const links = root.querySelectorAll('a').length;
        return links === 0 || `読み込み中なのにリンクが ${links} 本ある`;
      },
    },
    {
      id: 'not-blank',
      description: '白画面にならない（必ず何かが描かれる）',
      check: ({ root }) => {
        // 読み込み中は文字を持たないので、書斎の絵が出ていることで判定する。
        const hasGlyph = root.querySelector('svg') !== null;
        const hasText = (root.textContent ?? '').trim().length > 0;
        return hasGlyph || hasText || '文字も絵も描かれていない';
      },
    },
    {
      id: 'loading-hides-reason',
      description: '読み込み中は失敗の理由文を出さない',
      check: ({ root, props }) => {
        const hasHeading = Boolean(root.querySelector('h1'));
        return hasHeading === !props.loading || '読み込み中なのに理由文が出ている';
      },
    },
  ],
});
