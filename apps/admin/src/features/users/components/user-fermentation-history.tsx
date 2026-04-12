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
import type { UserFermentation } from '../hooks/use-user-detail';

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
  return 'bg-muted-foreground/40';
}

function RetryButton({
  fermentationId,
  onRetry,
}: {
  fermentationId: string;
  onRetry: (id: string) => Promise<boolean>;
}) {
  const [retrying, setRetrying] = useState(false);

  const handleRetry = async () => {
    setRetrying(true);
    try {
      await onRetry(fermentationId);
    } finally {
      setRetrying(false);
    }
  };

  return (
    <Button variant="ghost" size="icon-xs" onClick={handleRetry} disabled={retrying}>
      <RotateCcw className={`h-3 w-3 ${retrying ? 'animate-spin' : ''}`} />
    </Button>
  );
}

export function UserFermentationHistory({
  fermentations,
  onRetry,
}: {
  fermentations: UserFermentation[];
  onRetry?: (id: string) => Promise<boolean>;
}) {
  return (
    <div>
      <p className="text-xs text-muted-foreground uppercase tracking-wider mb-2">
        Fermentations
        <span className="ml-1.5 text-foreground">{fermentations.length}</span>
      </p>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Error</TableHead>
            {onRetry && <TableHead className="w-[36px]" />}
          </TableRow>
        </TableHeader>
        <TableBody>
          {fermentations.map((f) => (
            <TableRow key={f.id}>
              <TableCell className="font-mono text-xs whitespace-nowrap">
                {formatDate(f.createdAt)}
              </TableCell>
              <TableCell>
                <span className="inline-flex items-center gap-1.5 text-sm">
                  <span
                    className={`inline-block h-1.5 w-1.5 rounded-full ${statusDotColor(f.status)}`}
                  />
                  {f.status}
                </span>
              </TableCell>
              <TableCell
                className="text-[11px] text-muted-foreground max-w-[200px] truncate"
                title={f.errorMessage ?? undefined}
              >
                {f.errorMessage ?? '-'}
              </TableCell>
              {onRetry && (
                <TableCell>
                  {f.status === 'failed' && <RetryButton fermentationId={f.id} onRetry={onRetry} />}
                </TableCell>
              )}
            </TableRow>
          ))}
          {fermentations.length === 0 && (
            <TableRow>
              <TableCell
                colSpan={onRetry ? 4 : 3}
                className="text-center text-muted-foreground py-6"
              >
                No fermentations
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
