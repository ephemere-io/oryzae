'use client';

import { AccountRouteSkeleton } from '../_skeletons/account-route-skeleton';

/** `/account` の遷移ローディング。設定フォームのセクション枠を出す。 */
export default function Loading() {
  return <AccountRouteSkeleton />;
}
