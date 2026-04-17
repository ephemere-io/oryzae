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
import type { AdminUser } from '../hooks/use-users';

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

function isActive(user: AdminUser): boolean {
  return user.entryCount > 0 || user.fermentationTotal > 0;
}

type SortKey = 'email' | 'createdAt' | 'entryCount' | 'questionCount' | 'fermentationTotal';
type SortDir = 'asc' | 'desc';

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
  statusFilter?: 'all' | 'active' | 'inactive';
}

export function UserTable({ users, onUserClick, searchQuery, statusFilter }: UserTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('createdAt');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  }

  const filtered = useMemo(() => {
    let result = users;

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter((u) => u.email.toLowerCase().includes(q) || u.id.includes(q));
    }

    if (statusFilter === 'active') {
      result = result.filter(isActive);
    } else if (statusFilter === 'inactive') {
      result = result.filter((u) => !isActive(u));
    }

    return [...result].sort((a, b) => {
      const mul = sortDir === 'asc' ? 1 : -1;
      switch (sortKey) {
        case 'email':
          return mul * a.email.localeCompare(b.email);
        case 'createdAt':
          return mul * (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        case 'entryCount':
          return mul * (a.entryCount - b.entryCount);
        case 'questionCount':
          return mul * (a.questionCount - b.questionCount);
        case 'fermentationTotal':
          return mul * (a.fermentationTotal - b.fermentationTotal);
        default:
          return 0;
      }
    });
  }, [users, searchQuery, statusFilter, sortKey, sortDir]);

  const totalEntries = filtered.reduce((sum, u) => sum + u.entryCount, 0);
  const totalQuestions = filtered.reduce((sum, u) => sum + u.questionCount, 0);
  const totalFermentations = filtered.reduce((sum, u) => sum + u.fermentationTotal, 0);

  function SortableHead({
    label,
    sortKeyName,
    className,
  }: {
    label: string;
    sortKeyName: SortKey;
    className?: string;
  }) {
    return (
      <TableHead
        className={`cursor-pointer select-none ${className ?? ''}`}
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
          <SortableHead label="User" sortKeyName="email" />
          <SortableHead label="Registered" sortKeyName="createdAt" />
          <TableHead>Last Login</TableHead>
          <SortableHead label="Entries" sortKeyName="entryCount" className="text-right" />
          <SortableHead label="Questions" sortKeyName="questionCount" className="text-right" />
          <SortableHead
            label="Fermentations"
            sortKeyName="fermentationTotal"
            className="text-right"
          />
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {filtered.map((user) => (
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
                  className={`inline-block h-1.5 w-1.5 rounded-full ${isActive(user) ? 'bg-green-500' : 'bg-muted-foreground/40'}`}
                />
                {isActive(user) ? 'Active' : 'Inactive'}
              </span>
            </TableCell>
          </TableRow>
        ))}
        {filtered.length === 0 && (
          <TableRow>
            <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
              No users
            </TableCell>
          </TableRow>
        )}
      </TableBody>
      {filtered.length > 0 && (
        <TableFooter>
          <TableRow>
            <TableCell colSpan={3} className="text-xs font-medium">
              Total ({filtered.length} users)
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
