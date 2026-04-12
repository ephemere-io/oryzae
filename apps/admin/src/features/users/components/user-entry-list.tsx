'use client';

import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { UserEntry } from '../hooks/use-user-detail';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function UserEntryList({ entries }: { entries: UserEntry[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Entries ({entries.length})</CardTitle>
      </CardHeader>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead className="text-right">Character Count</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.map((entry) => (
            <TableRow key={entry.id}>
              <TableCell className="text-sm">{formatDate(entry.createdAt)}</TableCell>
              <TableCell className="text-right font-mono">{entry.characterCount}</TableCell>
            </TableRow>
          ))}
          {entries.length === 0 && (
            <TableRow>
              <TableCell colSpan={2} className="text-center text-muted-foreground py-8">
                No entries
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </Card>
  );
}
