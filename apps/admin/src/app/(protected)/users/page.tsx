'use client';

import { RefreshCw, Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { UserTable } from '@/features/users/components/user-table';
import { useUsers } from '@/features/users/hooks/use-users';
import {
  ACTIVE_WINDOW_DAYS,
  deriveUserStatus,
  USER_STATUS_FILTER_OPTIONS,
  type UserStatusFilter,
} from '@/features/users/status';

export default function UsersPage() {
  const router = useRouter();
  const { users, loading, error, refresh } = useUsers();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<UserStatusFilter>('all');

  // 判定は features/users/status.ts の 1 箇所に寄せてある。ここで条件を書き直すと
  // 表の状態列と食い違う（#620 はまさにその状態だった）。
  const active = useMemo(() => {
    const now = new Date();
    return users.filter((u) => deriveUserStatus(u, now) === 'active').length;
  }, [users]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-medium">Users</h1>
          <span className="text-sm text-muted-foreground">
            {users.length} 人<span className="mx-1.5 text-border">|</span>
            うち Active {active} 人（直近 {ACTIVE_WINDOW_DAYS} 日に記入）
          </span>
        </div>
        <Button variant="ghost" size="icon-xs" onClick={refresh} disabled={loading}>
          <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="メールアドレスで検索..."
            className="h-7 w-56 rounded-md border border-border bg-transparent pl-7 pr-2 text-xs placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <div className="flex items-center gap-0.5">
          {USER_STATUS_FILTER_OPTIONS.map((s) => (
            <button
              key={s.value}
              type="button"
              onClick={() => setStatusFilter(s.value)}
              className={`rounded-md px-2 py-1 text-xs transition-colors ${
                statusFilter === s.value
                  ? 'bg-foreground text-background'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {loading && users.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">読み込み中…</p>
      ) : (
        <UserTable
          users={users}
          onUserClick={(id) => router.push(`/users/${id}`)}
          searchQuery={searchQuery}
          statusFilter={statusFilter}
        />
      )}
    </div>
  );
}
