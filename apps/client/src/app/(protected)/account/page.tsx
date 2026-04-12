'use client';

import { AccountPage } from '@/features/auth/components/account-page';
import { useAuth } from '@/features/auth/hooks/use-auth';

export default function AccountRoute() {
  const { auth, loading } = useAuth();

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

  return <AccountPage user={auth.user} />;
}
