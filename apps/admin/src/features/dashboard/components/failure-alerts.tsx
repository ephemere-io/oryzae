'use client';

import { AlertTriangle, CheckCircle, RotateCcw } from 'lucide-react';
import { useState } from 'react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { FailureGroup } from '../hooks/use-failure-alerts';

function formatDate(iso: string): string {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return `${text.slice(0, maxLen)}...`;
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
    await onRetry(fermentationId);
    setRetrying(false);
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleRetry}
      disabled={retrying}
      className="shrink-0"
    >
      <RotateCcw className={`mr-1 h-3 w-3 ${retrying ? 'animate-spin' : ''}`} />
      Retry
    </Button>
  );
}

export function FailureAlerts({
  groups,
  retryFermentation,
}: {
  groups: FailureGroup[];
  retryFermentation: (id: string) => Promise<boolean>;
}) {
  const hasFailures = groups.length > 0;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-2">
        <AlertTriangle className="h-4 w-4 text-amber-500" />
        <CardTitle className="text-sm font-medium">要対応</CardTitle>
        {!hasFailures && (
          <Badge variant="outline" className="ml-2 border-green-600 text-green-500">
            <CheckCircle className="mr-1 h-3 w-3" />
            問題なし
          </Badge>
        )}
      </CardHeader>
      {hasFailures && (
        <CardContent className="space-y-4">
          {groups.map((group) => (
            <div key={group.userId} className="space-y-2">
              <div className="flex items-center gap-2">
                <Avatar size="sm">
                  <AvatarFallback>{group.email.charAt(0).toUpperCase()}</AvatarFallback>
                </Avatar>
                <span className="text-sm font-medium">{group.email}</span>
                <Badge variant="destructive" className="ml-auto">
                  {group.failures.length}
                </Badge>
              </div>
              <div className="ml-8 space-y-1.5">
                {group.failures.map((f) => (
                  <div
                    key={f.fermentationId}
                    className="flex items-center gap-3 rounded-md bg-muted/50 px-3 py-2 text-sm"
                  >
                    <span className="flex-1 truncate text-muted-foreground" title={f.errorMessage}>
                      {truncate(f.errorMessage, 60)}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {formatDate(f.createdAt)}
                    </span>
                    <RetryButton fermentationId={f.fermentationId} onRetry={retryFermentation} />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      )}
    </Card>
  );
}
