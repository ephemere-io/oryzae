'use client';

import { ExternalLink, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ErrorsView } from '@/features/errors/components/errors-view';
import { useErrors } from '@/features/errors/hooks/use-errors';

export default function ErrorsPage() {
  const { data, loading, error, refresh } = useErrors();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-medium">Errors</h1>
          <span className="text-sm text-muted-foreground">
            Sentry · {data?.environment ?? 'production'}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon-xs" onClick={refresh} disabled={loading}>
            <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          {data?.consoleUrl && (
            <a
              href={data.consoleUrl}
              target="_blank"
              rel="noopener noreferrer"
              title="Sentry で開く"
            >
              <Button variant="ghost" size="icon-xs">
                <ExternalLink className="h-3 w-3" />
              </Button>
            </a>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {loading && !data ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Loading...</p>
      ) : data ? (
        <ErrorsView data={data} />
      ) : null}
    </div>
  );
}
