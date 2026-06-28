'use client';

import { useRouter } from 'next/navigation';
import { DeviceView } from '@/components/device-view';
import { AccountPage } from '@/features/auth/components/account-page';
import { SpAccountPage } from '@/features/sp/account/components/sp-account-page';
import { useAuth } from '@/lib/auth-context';

export default function AccountRoute() {
  const { auth, loading, logout } = useAuth();
  const router = useRouter();

  if (loading || !auth) return null;

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
