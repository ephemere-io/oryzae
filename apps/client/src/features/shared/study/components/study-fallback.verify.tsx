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
      description: 'Probe: 読み込み中は何も描かない（地の色だけ）',
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
      description: '書斎が出せないときは白画面にならない（必ず何かが描かれる）',
      onlyFixtures: ['unsupported'],
      check: ({ root }) => {
        const hasGlyph = root.querySelector('svg') !== null;
        const hasText = (root.textContent ?? '').trim().length > 0;
        return hasGlyph || hasText || '文字も絵も描かれていない';
      },
    },
    {
      /**
       * **読み込み中に出してよいのは「憶えた部屋そのもの」だけ。**
       *
       * 「書斎に戻るときだけ謎のアイコンが出る」と報告された（PR #570）。悪いのは
       * 読み込み中に何かを出すことではなく、**別の何かを挟むこと**。書斎を模した絵も
       * 文字も、割り込みとして読まれる。出ていく直前に掴んだ 1 枚だけが、割り込みでは
       * なく「まだ遠い部屋」になる。
       */
      id: 'loading-shows-only-the-room',
      description: '読み込み中に出すのは憶えた部屋だけ（別の絵も文字も挟まない）',
      onlyFixtures: ['loading'],
      check: ({ root }) => {
        if (root.querySelector('svg') !== null) return '読み込み中なのに書斎の絵が出ている';
        const text = (root.textContent ?? '').trim();
        if (text.length > 0) return `読み込み中なのに文字が出ている: ${text}`;
        const images = [...root.querySelectorAll('img')];
        const stray = images.find((image) => !image.hasAttribute('data-study-backdrop'));
        return stray === undefined || '憶えた部屋以外の絵が出ている';
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
