'use client';

import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ToolCards } from '@/features/observability/components/tool-cards';
import { useObservability } from '@/features/observability/hooks/use-observability';

export default function ObservabilityPage() {
  const { tools, loading, error, refresh } = useObservability();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Observability</h1>
        <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          更新
        </Button>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {loading && tools.length === 0 ? (
        <p className="text-sm text-muted-foreground">読み込み中...</p>
      ) : (
        <ToolCards tools={tools} />
      )}
    </div>
  );
}
