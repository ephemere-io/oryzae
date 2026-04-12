'use client';

import { RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
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
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function statusVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'completed':
      return 'default';
    case 'failed':
      return 'destructive';
    case 'processing':
      return 'outline';
    default:
      return 'secondary';
  }
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
    <Button variant="outline" size="xs" onClick={handleRetry} disabled={retrying}>
      <RefreshCw className={`h-3 w-3 ${retrying ? 'animate-spin' : ''}`} />
      Retry
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
    <Card>
      <CardHeader>
        <CardTitle>Fermentations ({fermentations.length})</CardTitle>
      </CardHeader>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Error</TableHead>
            {onRetry && <TableHead />}
          </TableRow>
        </TableHeader>
        <TableBody>
          {fermentations.map((f) => (
            <TableRow key={f.id}>
              <TableCell className="text-sm whitespace-nowrap">{formatDate(f.createdAt)}</TableCell>
              <TableCell>
                <Badge variant={statusVariant(f.status)}>{f.status}</Badge>
              </TableCell>
              <TableCell className="text-sm max-w-xs truncate" title={f.errorMessage ?? undefined}>
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
                className="text-center text-muted-foreground py-8"
              >
                No fermentations
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </Card>
  );
}
