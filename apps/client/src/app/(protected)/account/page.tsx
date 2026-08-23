'use client';

import { useRouter } from 'next/navigation';
import { DeviceView } from '@/components/device-view';
import { AccountPage } from '@/features/pc/account/components/account-page';
import { SpAccountPage } from '@/features/sp/account/components/sp-account-page';
import { useAuth } from '@/lib/auth-context';
import { AccountRouteLoading } from '../_loading/account-route-loading';

export default function AccountRoute() {
  const { auth, loading, logout } = useAuth();
  const router = useRouter();

  // 認証解決までロード表示を出し続ける（null だと枠が一度消えて真っ白になる）。
  if (loading || !auth) return <AccountRouteLoading />;

  function handleLogout() {
    logout();
    router.push('/login');
  }

  return (
    <DeviceView
      pc={<AccountPage user={auth.user} onLogout={handleLogout} />}
      sp={<SpAccountPage user={auth.user} onLogout={handleLogout} />}
    />
  );
}
