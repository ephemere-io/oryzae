'use client';

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
import type { FermentationItem } from '../hooks/use-fermentations';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('ja-JP', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function statusVariant(status: string): 'default' | 'destructive' | 'secondary' | 'outline' {
  if (status === 'completed') return 'default';
  if (status === 'failed') return 'destructive';
  if (status === 'processing') return 'outline';
  return 'secondary';
}

export function FermentationTable({ items }: { items: FermentationItem[] }) {
  const completed = items.filter((i) => i.status === 'completed').length;
  const failed = items.filter((i) => i.status === 'failed').length;

  return (
    <div className="space-y-4">
      <div className="flex gap-4">
        <Card className="flex-1 p-4">
          <p className="text-sm text-muted-foreground">Page Results</p>
          <p className="text-2xl font-bold">{items.length}</p>
        </Card>
        <Card className="flex-1 p-4">
          <p className="text-sm text-muted-foreground">Completed</p>
          <p className="text-2xl font-bold text-green-600">{completed}</p>
        </Card>
        <Card className="flex-1 p-4">
          <p className="text-sm text-muted-foreground">Failed</p>
          <p className="text-2xl font-bold text-destructive">{failed}</p>
        </Card>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Period</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Cost Tracking</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.id}>
                <TableCell className="whitespace-nowrap">{formatDate(item.created_at)}</TableCell>
                <TableCell className="font-mono text-xs">{item.user_id.slice(0, 8)}...</TableCell>
                <TableCell>{item.target_period}</TableCell>
                <TableCell>
                  <Badge variant={statusVariant(item.status)}>{item.status}</Badge>
                </TableCell>
                <TableCell>
                  {item.generation_id ? (
                    <Badge variant="outline">Tracked</Badge>
                  ) : (
                    <span className="text-xs text-muted-foreground">-</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {items.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  発酵データがありません
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
