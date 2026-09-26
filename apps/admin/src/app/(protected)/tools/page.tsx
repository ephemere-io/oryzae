'use client';

import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ToolsTable } from '@/features/tools/components/tools-table';
import { useToolsSummary } from '@/features/tools/hooks/use-tools-summary';

export default function ToolsPage() {
  const { data, loading, error, refresh } = useToolsSummary();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-xl font-medium">Tools</h1>
          <p className="text-xs text-muted-foreground">
            {'Oryzae が連携している外部ツールの一覧。環境変数の列は admin（oryzae-admin）のデプロイの設定です。' +
              'client（oryzae-client）の設定は Vercel で確認してください。'}
          </p>
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
        <p className="py-8 text-center text-sm text-muted-foreground">Loading...</p>
      ) : data ? (
        <ToolsTable data={data} />
      ) : null}
    </div>
  );
}
