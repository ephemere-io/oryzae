'use client';

import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { useMemo, useState } from 'react';
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

type SortKey =
  | 'created_at'
  | 'user_email'
  | 'status'
  | 'promptTokens'
  | 'completionTokens'
  | 'totalCost'
  | 'latency';
type SortDir = 'asc' | 'desc';

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <ArrowUpDown className="ml-1 inline h-3 w-3 opacity-30" />;
  return dir === 'asc' ? (
    <ArrowUp className="ml-1 inline h-3 w-3" />
  ) : (
    <ArrowDown className="ml-1 inline h-3 w-3" />
  );
}

interface CostTableProps {
  items: CostItem[];
  onRowClick?: (id: string) => void;
}

export function CostTable({ items, onRowClick }: CostTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('created_at');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  }

  const sorted = useMemo(() => {
    return [...items].sort((a, b) => {
      const mul = sortDir === 'asc' ? 1 : -1;
      switch (sortKey) {
        case 'created_at':
          return mul * (new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        case 'user_email':
          return mul * (a.user_email || '').localeCompare(b.user_email || '');
        case 'status':
          return mul * a.status.localeCompare(b.status);
        case 'promptTokens':
          return mul * ((a.cost?.promptTokens ?? 0) - (b.cost?.promptTokens ?? 0));
        case 'completionTokens':
          return mul * ((a.cost?.completionTokens ?? 0) - (b.cost?.completionTokens ?? 0));
        case 'totalCost':
          return mul * ((a.cost?.totalCost ?? 0) - (b.cost?.totalCost ?? 0));
        case 'latency':
          return mul * ((a.cost?.latency ?? 0) - (b.cost?.latency ?? 0));
        default:
          return 0;
      }
    });
  }, [items, sortKey, sortDir]);

  const totalCost = items.reduce((sum, item) => sum + (item.cost?.totalCost ?? 0), 0);
  const totalInput = items.reduce((sum, item) => sum + (item.cost?.promptTokens ?? 0), 0);
  const totalOutput = items.reduce((sum, item) => sum + (item.cost?.completionTokens ?? 0), 0);

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
          <SortableHead label="Date" sortKeyName="created_at" />
          <SortableHead label="User" sortKeyName="user_email" />
          <SortableHead label="Status" sortKeyName="status" />
          <SortableHead label="Input" sortKeyName="promptTokens" className="text-right" />
          <SortableHead label="Output" sortKeyName="completionTokens" className="text-right" />
          <SortableHead label="Cost" sortKeyName="totalCost" className="text-right" />
          <SortableHead label="Latency" sortKeyName="latency" className="text-right" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {sorted.map((item) => (
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
