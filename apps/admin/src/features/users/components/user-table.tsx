'use client';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
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

export function UserTable({ users }: { users: AdminUser[] }) {
  return (
    <Card>
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
            <TableRow key={user.id}>
              <TableCell>
                <div className="flex items-center gap-3">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="text-xs">{getInitials(user.email)}</AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-medium">{user.email}</p>
                    <p className="text-xs text-muted-foreground font-mono">{user.id.slice(0, 8)}</p>
                  </div>
                </div>
              </TableCell>
              <TableCell className="whitespace-nowrap text-sm">
                {formatDate(user.createdAt)}
              </TableCell>
              <TableCell className="whitespace-nowrap text-sm">
                {formatDate(user.lastSignInAt)}
              </TableCell>
              <TableCell className="text-right font-mono">{user.entryCount}</TableCell>
              <TableCell className="text-right font-mono">{user.questionCount}</TableCell>
              <TableCell className="text-right">
                <span className="font-mono">{user.fermentationTotal}</span>
                {user.fermentationFailed > 0 && (
                  <span className="ml-1 text-xs text-destructive">
                    ({user.fermentationFailed} failed)
                  </span>
                )}
              </TableCell>
              <TableCell>
                <Badge variant={isActive(user) ? 'default' : 'secondary'}>
                  {isActive(user) ? 'Active' : 'Inactive'}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
          {users.length === 0 && (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                ユーザーがいません
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </Card>
  );
}
