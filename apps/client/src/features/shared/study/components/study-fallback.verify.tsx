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
      description: 'Probe: 読み込み中は理由文を出さない（すぐ書斎に置き換わる）',
      props: { loading: true },
    },
  ],
  invariants: [
    {
      id: 'three-destinations',
      description: '瓶・記録・ボードの 3 つへ行けるリンクが残る',
      check: ({ root }) => {
        const hrefs = [...root.querySelectorAll('a')].map((a) => a.getAttribute('href'));
        for (const href of ['/jar', '/entries/new', '/board']) {
          if (!hrefs.includes(href)) return `${href} へのリンクが無い`;
        }
        return true;
      },
    },
    {
      id: 'not-blank',
      description: '白画面にならない（必ず何かが描かれる）',
      check: ({ root }) =>
        (root.textContent ?? '').trim().length > 0 || '文字が 1 つも描かれていない',
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
