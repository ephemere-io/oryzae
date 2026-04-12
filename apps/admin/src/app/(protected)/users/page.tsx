'use client';

import { RefreshCw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { UserTable } from '@/features/users/components/user-table';
import { useUsers } from '@/features/users/hooks/use-users';

export default function UsersPage() {
  const router = useRouter();
  const { users, loading, error, refresh } = useUsers();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Users</h1>
          <p className="text-sm text-muted-foreground">
            ユーザー一覧と利用統計（{users.length} 人）
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          更新
        </Button>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {loading && users.length === 0 ? (
        <p className="text-sm text-muted-foreground">読み込み中...</p>
      ) : (
        <UserTable users={users} onUserClick={(id) => router.push(`/users/${id}`)} />
      )}
    </div>
  );
}
