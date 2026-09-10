/**
 * BackToStudy の検証スペック。
 *
 * 「サブ画面から書斎へ戻れる」（40-acceptance.md「ナビゲーション」）。
 *
 * 見るのは**置き場の約束**が中心。この部品は 3 巡のレビューで毎回「既存の操作に被る」と
 * 指摘され続けた場所（左上）から下端へ移した経緯があり、隅へ戻すと同じことが起きる。
 * どの画面も左右の下隅には自分の操作を置いている（倍率・ミニマップ・保存状態・文字数）。
 */

import { registerUnit } from '@oryzae/verify';
import { withVerifyProviders } from '@/lib/verify/with-providers';
import { BackToStudy } from './back-to-study';

registerUnit<Record<string, never>>({
  id: 'BackToStudy',
  title: 'BackToStudy',
  description: 'サブ画面の下端に浮く「書斎へ戻る」',
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
      id: 'sits-at-the-bottom-center',
      description: '下端の中央に置く（左右の隅は画面側が使っている）',
      check: ({ root }) => {
        const className = root.querySelector('a')?.className ?? '';
        const missing: string[] = [];
        if (!className.includes('fixed')) missing.push('fixed');
        if (!/\bbottom-/.test(className)) missing.push('bottom-*');
        if (!className.includes('left-1/2')) missing.push('left-1/2');
        if (!className.includes('-translate-x-1/2')) missing.push('-translate-x-1/2');
        if (missing.length > 0) return `下端の中央になっていない: ${missing.join(', ')}`;
        // 隅へ寄せ直されていないこと。ここが崩れると 3 巡ぶんの指摘に逆戻りする。
        if (/\b(left-4|right-4|top-4|left-6|right-6|top-6)\b/.test(className)) {
          return '隅に置き直されている（画面側の操作と取り合いになる）';
        }
        return true;
      },
    },
    {
      id: 'quiet-until-touched',
      description: '常時は薄く、触れたときだけ濃くなる（下端に居座らない）',
      check: ({ root }) => {
        const className = root.querySelector('a')?.className ?? '';
        if (!/\bopacity-\d+/.test(className)) return '常時の薄さが指定されていない';
        return className.includes('hover:opacity-100') || 'ホバーで濃くならない';
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
