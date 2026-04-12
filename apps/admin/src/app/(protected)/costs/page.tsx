'use client';

import { RefreshCw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { CostTable } from '@/features/cost-tracking/components/cost-table';
import { UserCostTable } from '@/features/cost-tracking/components/user-cost-table';
import { useCostData } from '@/features/cost-tracking/hooks/use-cost-data';
import { useUserCostSummary } from '@/features/cost-tracking/hooks/use-user-cost-summary';

function formatCost(cost: number): string {
  return `$${cost.toFixed(4)}`;
}

export default function CostsPage() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const { data, pagination, loading, error, refresh } = useCostData({ page });
  const {
    data: userCosts,
    loading: userCostsLoading,
    error: userCostsError,
    refresh: refreshUserCosts,
  } = useUserCostSummary();

  const totalPages = Math.ceil(pagination.total / pagination.limit);
  const grandTotal = userCosts.reduce((sum, item) => sum + item.totalCostUsd, 0);

  function handleRefresh() {
    refresh();
    refreshUserCosts();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-medium">Cost Tracking</h1>
          <span className="text-sm text-muted-foreground">
            Total: <span className="font-mono text-foreground">{formatCost(grandTotal)}</span>
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={handleRefresh}
          disabled={loading || userCostsLoading}
        >
          <RefreshCw className={`h-3 w-3 ${loading || userCostsLoading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {(error || userCostsError) && (
        <div className="rounded-md bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error || userCostsError}
        </div>
      )}

      <div>
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">
          Per User
        </h2>
        {userCostsLoading && userCosts.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">Loading...</p>
        ) : (
          <UserCostTable items={userCosts} onUserClick={(id) => router.push(`/users/${id}`)} />
        )}
      </div>

      <div>
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-3">
          Request Log
        </h2>
        {loading && data.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">Loading...</p>
        ) : (
          <>
            <CostTable items={data} onRowClick={(id) => router.push(`/fermentations/${id}`)} />

            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 pt-2">
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                >
                  Previous
                </Button>
                <span className="text-xs text-muted-foreground font-mono">
                  {page} / {totalPages}
                </span>
                <Button
                  variant="ghost"
                  size="xs"
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
