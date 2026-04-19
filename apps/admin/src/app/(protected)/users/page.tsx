'use client';

import { RefreshCw, Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { UserTable } from '@/features/users/components/user-table';
import { useUsers } from '@/features/users/hooks/use-users';

const STATUS_OPTIONS = ['all', 'active', 'inactive'] as const;

export default function UsersPage() {
  const router = useRouter();
  const { users, loading, error, refresh } = useUsers();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

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
          {STATUS_OPTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatusFilter(s)}
              className={`rounded-md px-2 py-1 text-xs transition-colors ${
                statusFilter === s
                  ? 'bg-foreground text-background'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {s}
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
        <p className="text-sm text-muted-foreground py-8 text-center">Loading...</p>
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
