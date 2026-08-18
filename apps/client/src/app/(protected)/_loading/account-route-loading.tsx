'use client';

import { DeviceView } from '@/components/device-view';
import { AccountPageSkeleton } from '@/features/pc/account/components/account-page-skeleton';
import { SpAccountPageSkeleton } from '@/features/sp/account/components/sp-account-page-skeleton';
import { useAuth } from '@/lib/auth-context';

/**
 * `/account` のロード枠。page 側に chrome は無く、画面の形は feature 側が持つ。
 *
 * PC のセキュリティ欄は OAuth のみのアカウントでパスワード変更欄が消える。クライアント遷移の
 * 時点では認証が解決済みなので、ここで実際の値を渡して枠の高さを合わせる
 * （初回描画＝認証解決前は既定の「メール認証あり」で近似する）。
 */
export function AccountRouteLoading() {
  const { auth } = useAuth();
  const providers = auth?.user.providers ?? [];
  const isOAuthOnly = providers.length > 0 && !providers.includes('email');

  return (
    <DeviceView
      sp={<SpAccountPageSkeleton />}
      pc={<AccountPageSkeleton isOAuthOnly={isOAuthOnly} />}
    />
  );
}
