'use client';

import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
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

interface CostTableProps {
  items: CostItem[];
  onRowClick?: (id: string) => void;
}

export function CostTable({ items, onRowClick }: CostTableProps) {
  const totalCost = items.reduce((sum, item) => sum + (item.cost?.totalCost ?? 0), 0);
  const totalInput = items.reduce((sum, item) => sum + (item.cost?.promptTokens ?? 0), 0);
  const totalOutput = items.reduce((sum, item) => sum + (item.cost?.completionTokens ?? 0), 0);

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
          <TableRow
            key={item.id}
            className={onRowClick ? 'cursor-pointer hover:bg-muted/50' : undefined}
            onClick={onRowClick ? () => onRowClick(item.id) : undefined}
          >
            <TableCell className="whitespace-nowrap font-mono text-xs">
              {formatDate(item.created_at)}
            </TableCell>
            <TableCell className="text-xs text-muted-foreground">
              {item.user_email || item.user_id.slice(0, 8)}
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
      {items.length > 0 && (
        <TableFooter>
          <TableRow>
            <TableCell colSpan={3} className="text-xs font-medium">
              Page Total ({items.length} requests)
            </TableCell>
            <TableCell className="text-right font-mono text-xs font-medium">
              {totalInput.toLocaleString()}
            </TableCell>
            <TableCell className="text-right font-mono text-xs font-medium">
              {totalOutput.toLocaleString()}
            </TableCell>
            <TableCell className="text-right font-mono text-sm font-medium">
              {formatCost(totalCost)}
            </TableCell>
            <TableCell />
          </TableRow>
        </TableFooter>
      )}
    </Table>
  );
}
