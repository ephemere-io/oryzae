/**
 * AccountPageSkeleton の検証スペック。
 * 「中央 2xl 幅の設定フォーム（4セクション）」であることと、OAuth のみのアカウントで
 * パスワード欄ぶんの枠が消えることを固定する。
 */

import { registerUnit } from '@oryzae/verify';
import { skeletonInvariants } from '@/lib/verify/skeleton-invariants';
import { AccountPageSkeleton } from './account-page-skeleton';

interface Props {
  isOAuthOnly?: boolean;
}

registerUnit<Props>({
  id: 'AccountPageSkeleton',
  title: 'AccountPageSkeleton',
  description:
    'PC アカウント（/account）のロード枠: タイトル / プロフィール / セキュリティ / 統計 / 設定',
  kind: 'component',
  render: (props) => <AccountPageSkeleton {...props} />,
  fixtures: [
    { id: 'email-account', description: 'メール認証のアカウント（パスワード欄あり）', props: {} },
    {
      id: 'oauth-only',
      probe: true,
      description: 'Probe: OAuth のみ → 実画面と同じくパスワード欄ぶんの枠を出さない',
      props: { isOAuthOnly: true },
    },
  ],
  invariants: [
    ...skeletonInvariants<Props>(),
    {
      id: 'security-fields-follow-oauth',
      description: 'セキュリティ欄の項目数が実 AccountPage と一致する（OAuth のみは1項目）',
      check: ({ root, props }) => {
        const security = root.querySelector('[data-skeleton-slot="security"] > div:last-child');
        const expected = props.isOAuthOnly ? 1 : 2;
        const actual = security?.childElementCount ?? -1;
        return (
          actual === expected || `セキュリティ欄の項目数が不一致: ${actual} (期待: ${expected})`
        );
      },
    },
    {
      id: 'is-centered-form',
      description: '中央寄せ 2xl 幅の枠（一覧やキャンバスの全幅ではない）',
      check: ({ root }) => {
        const el = root.querySelector('[data-verify-unit="AccountPageSkeleton"]');
        const cls = el?.className ?? '';
        return (
          (cls.includes('mx-auto') && cls.includes('max-w-2xl')) ||
          `中央寄せ 2xl 幅になっていない: "${cls}"`
        );
      },
    },
  ],
});
