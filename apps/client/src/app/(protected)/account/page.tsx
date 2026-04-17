'use client';

import { useRouter } from 'next/navigation';
import { AccountPage } from '@/features/auth/components/account-page';
import { useAuth } from '@/features/auth/hooks/use-auth';

export default function AccountRoute() {
  const { auth, loading, logout } = useAuth();
  const router = useRouter();

  if (loading || !auth) {
    return (
      <div
        className="flex h-full items-center justify-center text-xs"
        style={{ color: 'var(--date-color)' }}
      >
        読み込み中...
      </div>
    );
  }

  function handleLogout() {
    logout();
    router.push('/login');
  }

  return <AccountPage user={auth.user} onLogout={handleLogout} />;
}
