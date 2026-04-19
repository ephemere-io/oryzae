'use client';

import { ArrowDown, ArrowUp, ArrowUpDown, PlayCircle } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
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

function statusDotColor(status: string): string {
  if (status === 'completed') return 'bg-green-500';
  if (status === 'failed') return 'bg-red-500';
  if (status === 'processing') return 'bg-yellow-500';
  return 'bg-muted-foreground';
}

type SortKey = 'created_at' | 'user_email' | 'target_period' | 'status';
type SortDir = 'asc' | 'desc';

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <ArrowUpDown className="ml-1 inline h-3 w-3 opacity-30" />;
  return dir === 'asc' ? (
    <ArrowUp className="ml-1 inline h-3 w-3" />
  ) : (
    <ArrowDown className="ml-1 inline h-3 w-3" />
  );
}

interface FermentationTableProps {
  items: FermentationItem[];
  onRetry?: (id: string) => Promise<boolean>;
  onRowClick?: (id: string) => void;
}

export function FermentationTable({ items, onRetry, onRowClick }: FermentationTableProps) {
  const [retryingId, setRetryingId] = useState<string | null>(null);
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
        case 'target_period':
          return mul * a.target_period.localeCompare(b.target_period);
        case 'status':
          return mul * a.status.localeCompare(b.status);
        default:
          return 0;
      }
    });
  }, [items, sortKey, sortDir]);

  const handleRetry = async (id: string) => {
    if (!onRetry) return;
    setRetryingId(id);
    await onRetry(id);
    setRetryingId(null);
  };

  const completed = items.filter((i) => i.status === 'completed').length;
  const failed = items.filter((i) => i.status === 'failed').length;
  const tracked = items.filter((i) => i.generation_id).length;

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
          <SortableHead label="Period" sortKeyName="target_period" />
          <SortableHead label="Status" sortKeyName="status" />
          <TableHead>Error</TableHead>
          <TableHead>Cost</TableHead>
          <TableHead className="w-[48px]" />
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
            <TableCell className="text-sm">{item.target_period}</TableCell>
            <TableCell>
              <span className="inline-flex items-center gap-1.5 text-sm">
                <span
                  className={`inline-block h-1.5 w-1.5 rounded-full ${statusDotColor(item.status)}`}
                />
                {item.status}
              </span>
            </TableCell>
            <TableCell className="max-w-[300px]">
              {item.error_message ? (
                <span
                  className="truncate block text-[11px] text-muted-foreground"
                  title={item.error_message}
                >
                  {item.error_message}
                </span>
              ) : (
                <span className="text-[11px] text-muted-foreground/50">-</span>
              )}
            </TableCell>
            <TableCell>
              {item.generation_id ? (
                <span className="text-xs text-muted-foreground">Tracked</span>
              ) : null}
            </TableCell>
            <TableCell>
              {item.status === 'failed' && onRetry && (
                <Button
                  variant="ghost"
                  size="icon-xs"
                  title="再実行"
                  disabled={retryingId === item.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRetry(item.id);
                  }}
                >
                  <PlayCircle
                    className={`h-3.5 w-3.5 ${retryingId === item.id ? 'animate-pulse' : ''}`}
                  />
                </Button>
              )}
            </TableCell>
          </TableRow>
        ))}
        {items.length === 0 && (
          <TableRow>
            <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
              No fermentation data
            </TableCell>
          </TableRow>
        )}
      </TableBody>
      {items.length > 0 && (
        <TableFooter>
          <TableRow>
            <TableCell colSpan={3} className="text-xs font-medium">
              Page Total ({items.length} items)
            </TableCell>
            <TableCell className="text-xs font-medium">
              {completed} completed / {failed} failed
            </TableCell>
            <TableCell />
            <TableCell className="text-xs font-medium">{tracked} tracked</TableCell>
            <TableCell />
          </TableRow>
        </TableFooter>
      )}
    </Table>
  );
}
