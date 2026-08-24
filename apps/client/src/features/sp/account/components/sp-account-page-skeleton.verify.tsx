/**
 * SpAccountPageSkeleton の検証スペック。
 *
 * このユニットは props を取らない（アカウント画面はロード時に出し分ける条件が無い）。
 * したがってハッピーパスという概念が無く、唯一の状態＝「表示すべきデータが1件も無い」
 * が既に敵対的ケースなので、fixture はその1つを probe として登録する。
 */

import { registerUnit } from '@oryzae/verify';
import { skeletonInvariants } from '@/lib/verify/skeleton-invariants';
import { SpAccountPageSkeleton } from './sp-account-page-skeleton';

registerUnit<Record<string, never>>({
  id: 'SpAccountPageSkeleton',
  title: 'SpAccountPageSkeleton',
  description: 'SP アカウント（/account）のロード枠: ヘッダ / プロフィール / 設定 / ログアウト',
  kind: 'component',
  render: () => <SpAccountPageSkeleton />,
  fixtures: [
    {
      id: 'no-user-data',
      probe: true,
      description: 'Probe: 認証解決前（ユーザー情報ゼロ）でも3ブロックすべての枠が出る',
      props: {},
    },
  ],
  invariants: [
    ...skeletonInvariants<Record<string, never>>(),
    {
      id: 'no-security-section',
      description: 'PC にあるセキュリティ／統計欄を SP には出さない（実 SpAccountPage と同じ構成）',
      check: ({ root }) => {
        const slots = Array.from(root.querySelectorAll('[data-skeleton-slot]')).map((el) =>
          el.getAttribute('data-skeleton-slot'),
        );
        const extra = slots.filter((s) => s === 'security' || s === 'stats');
        return extra.length === 0 || `SP に無いはずの欄が混ざっている: ${extra.join(', ')}`;
      },
    },
    {
      id: 'logout-is-last',
      description: 'ログアウトが最下段（実 SpAccountPage と同じ縦順）',
      check: ({ root }) => {
        const slots = Array.from(root.querySelectorAll('[data-skeleton-slot]'));
        const last = slots.at(-1)?.getAttribute('data-skeleton-slot');
        return last === 'logout' || `最後の slot が logout ではない: ${last}`;
      },
    },
  ],
});
