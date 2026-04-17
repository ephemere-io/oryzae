'use client';

import { RotateCcw } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
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

function statusDotColor(status: string): string {
  if (status === 'completed') return 'bg-green-500';
  if (status === 'failed') return 'bg-red-500';
  if (status === 'processing') return 'bg-yellow-500';
  return 'bg-muted-foreground';
}

interface FermentationTableProps {
  items: FermentationItem[];
  onRetry?: (id: string) => Promise<boolean>;
  onRowClick?: (id: string) => void;
}

export function FermentationTable({ items, onRetry, onRowClick }: FermentationTableProps) {
  const [retryingId, setRetryingId] = useState<string | null>(null);

  const handleRetry = async (id: string) => {
    if (!onRetry) return;
    setRetryingId(id);
    await onRetry(id);
    setRetryingId(null);
  };

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Date</TableHead>
          <TableHead>User</TableHead>
          <TableHead>Period</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Error</TableHead>
          <TableHead>Cost</TableHead>
          <TableHead className="w-[48px]" />
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
                  disabled={retryingId === item.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRetry(item.id);
                  }}
                >
                  <RotateCcw
                    className={`h-3 w-3 ${retryingId === item.id ? 'animate-spin' : ''}`}
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
    </Table>
  );
}
