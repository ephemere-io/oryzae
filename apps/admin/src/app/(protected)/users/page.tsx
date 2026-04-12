'use client';

import { RefreshCw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { UserTable } from '@/features/users/components/user-table';
import { useUsers } from '@/features/users/hooks/use-users';

export default function UsersPage() {
  const router = useRouter();
  const { users, loading, error, refresh } = useUsers();

  const active = users.filter((u) => u.entryCount > 0 || u.fermentationTotal > 0).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-medium">Users</h1>
          <span className="text-sm text-muted-foreground">
            {users.length} total
            <span className="mx-1.5 text-border">|</span>
            {active} active
          </span>
        </div>
        <Button variant="ghost" size="icon-xs" onClick={refresh} disabled={loading}>
          <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {loading && users.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">Loading...</p>
      ) : (
        <UserTable users={users} onUserClick={(id) => router.push(`/users/${id}`)} />
      )}
    </div>
  );
}
