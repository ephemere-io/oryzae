/**
 * BackToStudy の検証スペック。
 *
 * 「マークはサブ画面で BACK TO STUDY として機能する」（40-acceptance.md「ナビゲーション」）。
 */

import { registerUnit } from '@oryzae/verify';
import { withVerifyProviders } from '@/lib/verify/with-providers';
import { BackToStudy } from './back-to-study';

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
      id: 'has-accessible-name',
      description: 'アイコンだけでも名前が読める',
      check: ({ root }) => {
        const link = root.querySelector('a');
        return Boolean(link?.getAttribute('aria-label')) || 'aria-label が無い';
      },
    },
  ],
});
