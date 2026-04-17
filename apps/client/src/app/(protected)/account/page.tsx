'use client';

import { useRouter } from 'next/navigation';
import { AccountPage } from '@/features/auth/components/account-page';
import { useAuth } from '@/features/auth/hooks/use-auth';

export default function AccountRoute() {
  const { auth, loading, logout } = useAuth();
  const router = useRouter();

  if (loading || !auth) return null;

  function handleLogout() {
    logout();
    router.push('/login');
  }

  return <AccountPage user={auth.user} onLogout={handleLogout} />;
}
