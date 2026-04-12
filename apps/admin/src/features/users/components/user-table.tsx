'use client';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Table,
  TableBody,
  TableCell,
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

export function UserTable({
  users,
  onUserClick,
}: {
  users: AdminUser[];
  onUserClick?: (userId: string) => void;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>User</TableHead>
          <TableHead>Registered</TableHead>
          <TableHead>Last Login</TableHead>
          <TableHead className="text-right">Entries</TableHead>
          <TableHead className="text-right">Questions</TableHead>
          <TableHead className="text-right">Fermentations</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {users.map((user) => (
          <TableRow
            key={user.id}
            className={onUserClick ? 'cursor-pointer' : undefined}
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
        {users.length === 0 && (
          <TableRow>
            <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
              No users
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}
