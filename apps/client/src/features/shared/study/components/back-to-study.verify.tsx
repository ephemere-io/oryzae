/**
 * BackToStudy の検証スペック。
 *
 * 「マークはサブ画面で BACK TO STUDY として機能する」（40-acceptance.md「ナビゲーション」）。
 */

import { registerUnit } from '@oryzae/verify';
import { withVerifyProviders } from '@/lib/verify/with-providers';
import { BACK_MARK, BACK_MARK_SEAT_X, BackToStudy } from './back-to-study';

registerUnit<Record<string, never>>({
  id: 'BackToStudy',
  title: 'BackToStudy',
  description: 'サブ画面の左上に浮く「書斎へ戻る」マーク',
  kind: 'component',
  render: () => withVerifyProviders(<BackToStudy />),
  fixtures: [
    {
      id: 'default',
      probe: true,
      description: 'Probe: /study へのリンクとして機能する',
      props: {},
    },
  ],
  invariants: [
    {
      id: 'links-to-study',
      description: '/study へ行ける',
      check: ({ root }) =>
        Boolean(root.querySelector('a[href="/study"]')) || '/study へのリンクが無い',
    },
    {
      id: 'mark-is-the-room',
      description: '書斎の縮図を出す（書斎側の左上マークと同じ絵）',
      check: ({ root }) => {
        // 戻り先が「さっきまで居たあの部屋」だと繋がるよう、両側で同じ絵を使う。
        // 片方だけ差し替えられると、行き先と戻り先が別物に見える。
        const mark = root.querySelector('[data-study-mark]');
        return mark !== null || '書斎のマークが描かれていない';
      },
    },
    {
      id: 'seat-matches-the-mark',
      description: '席（--study-back-inset）がマークの実寸を覆う',
      check: ({ root }) => {
        // 席をマークと別に手で決めていたころ、マークを縮めたときに席だけ詰めてしまい、
        // 席がマークより狭くなって重なりが残った（実機で「押せない機能が発生」）。
        const link = root.querySelector('a');
        const className = link?.className ?? '';
        const marks: string[] = [];
        // クラス名と BACK_MARK が対であることを見る（jsdom には版組みが無い）。
        if (!className.includes('left-4')) marks.push('left-4');
        if (!className.includes('top-4')) marks.push('top-4');
        if (!className.includes('h-8')) marks.push('h-8');
        if (!className.includes('px-2.5')) marks.push('px-2.5');
        if (!className.includes('gap-1.5')) marks.push('gap-1.5');
        if (marks.length > 0) return `BACK_MARK と食い違う指定: ${marks.join(', ')}`;
        return BACK_MARK_SEAT_X >= BACK_MARK.offset + BACK_MARK.width || '席がマークより狭い';
      },
    },
    {
      id: 'has-accessible-name',
      description: 'アイコンだけでも名前が読める',
      check: ({ root }) => {
        const link = root.querySelector('a');
        return Boolean(link?.getAttribute('aria-label')) || 'aria-label が無い';
      },
    },
  ],
});
