'use client';

import { useState } from 'react';
import { CostTable } from '@/features/cost-tracking/components/cost-table';
import { useCostData } from '@/features/cost-tracking/hooks/use-cost-data';

export default function CostsPage() {
  const [page, setPage] = useState(1);
  const { data, pagination, loading, error, refresh } = useCostData(page);

  const totalPages = Math.ceil(pagination.total / pagination.limit);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Cost Tracking</h1>
        <button
          type="button"
          onClick={refresh}
          disabled={loading}
          className="rounded border border-[var(--border)] px-3 py-1.5 text-sm text-[var(--muted)] hover:bg-gray-50 disabled:opacity-50"
        >
          {loading ? '更新中...' : '更新'}
        </button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {loading && data.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">読み込み中...</p>
      ) : (
        <>
          <CostTable items={data} />

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="rounded border border-[var(--border)] px-3 py-1.5 text-sm disabled:opacity-50"
              >
                Previous
              </button>
              <span className="text-sm text-[var(--muted)]">
                {page} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="rounded border border-[var(--border)] px-3 py-1.5 text-sm disabled:opacity-50"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
