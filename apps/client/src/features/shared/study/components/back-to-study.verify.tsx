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
      id: 'has-accessible-name',
      description: 'アイコンだけでも名前が読める',
      check: ({ root }) => {
        const link = root.querySelector('a');
        return Boolean(link?.getAttribute('aria-label')) || 'aria-label が無い';
      },
    },
  ],
});
