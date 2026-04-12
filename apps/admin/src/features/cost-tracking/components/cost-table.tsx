'use client';

import type { CostItem } from '../hooks/use-cost-data';

interface CostTableProps {
  items: CostItem[];
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatCost(cost: number | undefined): string {
  if (cost === undefined) return '-';
  return `$${cost.toFixed(4)}`;
}

export function CostTable({ items }: CostTableProps) {
  const totalCost = items.reduce((sum, item) => sum + (item.cost?.totalCost ?? 0), 0);

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-[var(--border)] bg-white p-4">
        <p className="text-sm text-[var(--muted)]">Page Total Cost</p>
        <p className="text-2xl font-semibold">{formatCost(totalCost)}</p>
      </div>

      <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-[var(--border)]">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-[var(--muted)]">Date</th>
              <th className="px-4 py-3 text-left font-medium text-[var(--muted)]">User ID</th>
              <th className="px-4 py-3 text-left font-medium text-[var(--muted)]">Status</th>
              <th className="px-4 py-3 text-right font-medium text-[var(--muted)]">Input Tokens</th>
              <th className="px-4 py-3 text-right font-medium text-[var(--muted)]">
                Output Tokens
              </th>
              <th className="px-4 py-3 text-right font-medium text-[var(--muted)]">Cost</th>
              <th className="px-4 py-3 text-right font-medium text-[var(--muted)]">Latency</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-[var(--border)]">
            {items.map((item) => (
              <tr key={item.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 whitespace-nowrap">{formatDate(item.created_at)}</td>
                <td className="px-4 py-3 font-mono text-xs">{item.user_id.slice(0, 8)}...</td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${
                      item.status === 'completed'
                        ? 'bg-green-50 text-green-700'
                        : item.status === 'failed'
                          ? 'bg-red-50 text-red-700'
                          : 'bg-yellow-50 text-yellow-700'
                    }`}
                  >
                    {item.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-right font-mono">
                  {item.cost?.promptTokens?.toLocaleString() ?? '-'}
                </td>
                <td className="px-4 py-3 text-right font-mono">
                  {item.cost?.completionTokens?.toLocaleString() ?? '-'}
                </td>
                <td className="px-4 py-3 text-right font-mono font-medium">
                  {formatCost(item.cost?.totalCost)}
                </td>
                <td className="px-4 py-3 text-right font-mono">
                  {item.cost?.latency ? `${item.cost.latency}ms` : '-'}
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-[var(--muted)]">
                  コスト追跡データがありません
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
