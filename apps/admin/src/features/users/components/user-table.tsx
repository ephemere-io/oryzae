'use client';

import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tooltip } from '@/components/ui/tooltip';
import type { AdminUser } from '../hooks/use-users';
import { compareUsers, type SortDir, type UserSortKey } from '../sort';
import {
  ACTIVE_WINDOW_DAYS,
  deriveUserStatus,
  USER_STATUS_LABELS,
  type UserStatus,
  type UserStatusFilter,
} from '../status';

function formatDate(iso: string | null): string {
  if (!iso) return '-';
  return new Date(iso).toLocaleString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getInitials(email: string): string {
  return email.slice(0, 2).toUpperCase();
}

/** 状態バッジの点の色。active だけが目に留まるようにしてある。 */
const STATUS_DOT_CLASS: Record<UserStatus, string> = {
  active: 'bg-green-500',
  dormant: 'bg-amber-500/60',
  never: 'bg-muted-foreground/40',
};

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <ArrowUpDown className="ml-1 inline h-3 w-3 opacity-30" />;
  return dir === 'asc' ? (
    <ArrowUp className="ml-1 inline h-3 w-3" />
  ) : (
    <ArrowDown className="ml-1 inline h-3 w-3" />
  );
}

interface UserTableProps {
  users: AdminUser[];
  onUserClick?: (userId: string) => void;
  searchQuery?: string;
  statusFilter?: UserStatusFilter;
}

export function UserTable({ users, onUserClick, searchQuery, statusFilter }: UserTableProps) {
  const [sortKey, setSortKey] = useState<UserSortKey>('createdAt');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  function handleSort(key: UserSortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  }

  const filtered = useMemo(() => {
    // 判定時刻は 1 レンダー内で固定する。行ごとに new Date() を呼ぶと、窓の境界を
    // またいだ瞬間にフィルタとバッジ表示が食い違いうる。
    const now = new Date();
    let result = users.map((user) => ({ user, status: deriveUserStatus(user, now) }));

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        ({ user }) => user.email.toLowerCase().includes(q) || user.id.includes(q),
      );
    }

    if (statusFilter && statusFilter !== 'all') {
      result = result.filter(({ status }) => status === statusFilter);
    }

    return [...result].sort((a, b) => compareUsers(a.user, b.user, sortKey, sortDir));
  }, [users, searchQuery, statusFilter, sortKey, sortDir]);

  const totalEntries = filtered.reduce((sum, { user }) => sum + user.entryCount, 0);
  const totalQuestions = filtered.reduce((sum, { user }) => sum + user.questionCount, 0);
  const totalFermentations = filtered.reduce((sum, { user }) => sum + user.fermentationTotal, 0);

  function SortableHead({
    label,
    sortKeyName,
    className,
  }: {
    label: string;
    sortKeyName: UserSortKey;
    className?: string;
  }) {
    return (
      <TableHead
        className={`cursor-pointer select-none hover:bg-muted/60 transition-colors ${className ?? ''}`}
        onClick={() => handleSort(sortKeyName)}
      >
        {label}
        <SortIcon active={sortKey === sortKeyName} dir={sortDir} />
      </TableHead>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <SortableHead label="ユーザー" sortKeyName="email" />
          <SortableHead label="登録日" sortKeyName="createdAt" />
          <SortableHead label="最終ログイン" sortKeyName="lastSignInAt" />
          <SortableHead label="最終活動" sortKeyName="lastActivityAt" />
          <SortableHead label="エントリー" sortKeyName="entryCount" className="text-right" />
          <SortableHead label="問い" sortKeyName="questionCount" className="text-right" />
          <SortableHead label="発酵" sortKeyName="fermentationTotal" className="text-right" />
          <TableHead>
            <Tooltip
              content={
                <span>
                  <strong>Active</strong>: 直近 {ACTIVE_WINDOW_DAYS} 日以内にエントリーを書いた
                  <br />
                  <span className="text-muted-foreground">　＝ MAU（Monthly Active User）</span>
                  <br />
                  <strong>Dormant</strong>: エントリーはあるが {ACTIVE_WINDOW_DAYS}{' '}
                  日以上書いていない
                  <br />
                  <strong>Never</strong>: エントリーが 1 件も無い
                  <br />
                  <span className="text-muted-foreground">
                    ※ 発酵は cron による自動実行で本人の利用を表さないため、判定に含めません
                    （「最終活動」列と同じ基準）
                  </span>
                </span>
              }
            >
              <span className="cursor-help underline decoration-dotted underline-offset-2">
                状態
              </span>
            </Tooltip>
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {filtered.map(({ user, status }) => (
          <TableRow
            key={user.id}
            className={onUserClick ? 'cursor-pointer hover:bg-muted/50' : undefined}
            onClick={onUserClick ? () => onUserClick(user.id) : undefined}
          >
            <TableCell>
              <div className="flex items-center gap-3">
                <Avatar className="h-7 w-7">
                  <AvatarFallback className="text-[10px]">{getInitials(user.email)}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm">{user.email}</p>
                  <p className="text-[11px] text-muted-foreground font-mono">
                    {user.id.slice(0, 8)}
                  </p>
                </div>
              </div>
            </TableCell>
            <TableCell className="whitespace-nowrap font-mono text-xs text-muted-foreground">
              {formatDate(user.createdAt)}
            </TableCell>
            <TableCell className="whitespace-nowrap font-mono text-xs text-muted-foreground">
              {formatDate(user.lastSignInAt)}
            </TableCell>
            <TableCell className="whitespace-nowrap font-mono text-xs text-muted-foreground">
              {formatDate(user.lastActivityAt)}
            </TableCell>
            <TableCell className="text-right font-mono text-sm">{user.entryCount}</TableCell>
            <TableCell className="text-right font-mono text-sm">{user.questionCount}</TableCell>
            <TableCell className="text-right">
              <span className="font-mono text-sm">{user.fermentationTotal}</span>
              {user.fermentationFailed > 0 && (
                <span className="ml-1 text-[11px] text-red-500">
                  ({user.fermentationFailed} failed)
                </span>
              )}
            </TableCell>
            <TableCell>
              <span className="inline-flex items-center gap-1.5 text-sm">
                <span
                  className={`inline-block h-1.5 w-1.5 rounded-full ${STATUS_DOT_CLASS[status]}`}
                />
                {USER_STATUS_LABELS[status]}
              </span>
            </TableCell>
          </TableRow>
        ))}
        {filtered.length === 0 && (
          <TableRow>
            <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
              ユーザーがいません
            </TableCell>
          </TableRow>
        )}
      </TableBody>
      {filtered.length > 0 && (
        <TableFooter>
          <TableRow>
            <TableCell colSpan={4} className="text-xs font-medium">
              合計（{filtered.length} 人）
            </TableCell>
            <TableCell className="text-right font-mono text-xs font-medium">
              {totalEntries}
            </TableCell>
            <TableCell className="text-right font-mono text-xs font-medium">
              {totalQuestions}
            </TableCell>
            <TableCell className="text-right font-mono text-xs font-medium">
              {totalFermentations}
            </TableCell>
            <TableCell />
          </TableRow>
        </TableFooter>
      )}
    </Table>
  );
}
