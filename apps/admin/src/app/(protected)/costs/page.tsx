'use client';

import { RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { CostTable } from '@/features/cost-tracking/components/cost-table';
import { UserCostTable } from '@/features/cost-tracking/components/user-cost-table';
import { useCostData } from '@/features/cost-tracking/hooks/use-cost-data';
import { useUserCostSummary } from '@/features/cost-tracking/hooks/use-user-cost-summary';

export default function CostsPage() {
  const [page, setPage] = useState(1);
  const { data, pagination, loading, error, refresh } = useCostData({ page });
  const {
    data: userCosts,
    loading: userCostsLoading,
    error: userCostsError,
    refresh: refreshUserCosts,
  } = useUserCostSummary();

  const totalPages = Math.ceil(pagination.total / pagination.limit);

  function handleRefresh() {
    refresh();
    refreshUserCosts();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Cost Tracking</h1>
          <p className="text-sm text-muted-foreground">Vercel AI Gateway per-request コスト</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={loading || userCostsLoading}
        >
          <RefreshCw
            className={`mr-2 h-4 w-4 ${loading || userCostsLoading ? 'animate-spin' : ''}`}
          />
          更新
        </Button>
      </div>

      {(error || userCostsError) && (
        <div className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error || userCostsError}
        </div>
      )}

      <div>
        <h2 className="text-lg font-semibold mb-3">ユーザー別集計</h2>
        {userCostsLoading && userCosts.length === 0 ? (
          <p className="text-sm text-muted-foreground">読み込み中...</p>
        ) : (
          <UserCostTable items={userCosts} />
        )}
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-3">リクエスト別詳細</h2>
        {loading && data.length === 0 ? (
          <p className="text-sm text-muted-foreground">読み込み中...</p>
        ) : (
          <>
            <CostTable items={data} />

            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                >
                  Previous
                </Button>
                <span className="text-sm text-muted-foreground">
                  {page} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                >
                  Next
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
