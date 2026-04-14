'use client';

import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ObservabilityTable } from '@/features/observability/components/tool-cards';
import { useObservability } from '@/features/observability/hooks/use-observability';

export default function ObservabilityPage() {
  const { data, loading, error, refresh } = useObservability();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-medium">Observability</h1>
          <span className="text-sm text-muted-foreground">5 tools</span>
        </div>
        <Button variant="ghost" size="icon-xs" onClick={refresh} disabled={loading}>
          <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {loading && !data ? (
        <p className="text-sm text-muted-foreground py-8 text-center">Loading...</p>
      ) : data ? (
        <ObservabilityTable data={data} />
      ) : null}
    </div>
  );
}
