'use client';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { CostItem } from '../hooks/use-cost-data';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('ja-JP', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatCost(cost: number | undefined): string {
  if (cost === undefined) return '-';
  return `$${cost.toFixed(4)}`;
}

function statusDotColor(status: string): string {
  if (status === 'completed') return 'bg-green-500';
  if (status === 'failed') return 'bg-red-500';
  return 'bg-muted-foreground/40';
}

export function CostTable({ items }: { items: CostItem[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Date</TableHead>
          <TableHead>User</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Input</TableHead>
          <TableHead className="text-right">Output</TableHead>
          <TableHead className="text-right">Cost</TableHead>
          <TableHead className="text-right">Latency</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item) => (
          <TableRow key={item.id}>
            <TableCell className="whitespace-nowrap font-mono text-xs">
              {formatDate(item.created_at)}
            </TableCell>
            <TableCell className="font-mono text-xs text-muted-foreground">
              {item.user_id.slice(0, 8)}
            </TableCell>
            <TableCell>
              <span className="inline-flex items-center gap-1.5 text-sm">
                <span
                  className={`inline-block h-1.5 w-1.5 rounded-full ${statusDotColor(item.status)}`}
                />
                {item.status}
              </span>
            </TableCell>
            <TableCell className="text-right font-mono text-xs">
              {item.cost?.promptTokens?.toLocaleString() ?? '-'}
            </TableCell>
            <TableCell className="text-right font-mono text-xs">
              {item.cost?.completionTokens?.toLocaleString() ?? '-'}
            </TableCell>
            <TableCell className="text-right font-mono text-sm">
              {formatCost(item.cost?.totalCost)}
            </TableCell>
            <TableCell className="text-right font-mono text-xs text-muted-foreground">
              {item.cost?.latency ? `${item.cost.latency}ms` : '-'}
            </TableCell>
          </TableRow>
        ))}
        {items.length === 0 && (
          <TableRow>
            <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
              No cost data
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}
