'use client';

import { ArrowDown, ArrowUp, ArrowUpDown, Info } from 'lucide-react';
import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tooltip } from '@/components/ui/tooltip';
import type { CostItem } from '../hooks/use-cost-data';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('ja-JP', {
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

function statusDotColor(status: string): string {
  if (status === 'completed') return 'bg-green-500';
  if (status === 'failed') return 'bg-red-500';
  return 'bg-muted-foreground/40';
}

type SortKey =
  | 'created_at'
  | 'user_email'
  | 'status'
  | 'promptTokens'
  | 'completionTokens'
  | 'totalCost';
type SortDir = 'asc' | 'desc';

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <ArrowUpDown className="ml-1 inline h-3 w-3 opacity-30" />;
  return dir === 'asc' ? (
    <ArrowUp className="ml-1 inline h-3 w-3" />
  ) : (
    <ArrowDown className="ml-1 inline h-3 w-3" />
  );
}

interface CostTableProps {
  items: CostItem[];
  onRowClick?: (id: string) => void;
}

export function CostTable({ items, onRowClick }: CostTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('created_at');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  }

  const sorted = useMemo(() => {
    return [...items].sort((a, b) => {
      const mul = sortDir === 'asc' ? 1 : -1;
      switch (sortKey) {
        case 'created_at':
          return mul * (new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        case 'user_email':
          return mul * (a.user_email || '').localeCompare(b.user_email || '');
        case 'status':
          return mul * a.status.localeCompare(b.status);
        case 'promptTokens':
          return mul * ((a.cost?.promptTokens ?? 0) - (b.cost?.promptTokens ?? 0));
        case 'completionTokens':
          return mul * ((a.cost?.completionTokens ?? 0) - (b.cost?.completionTokens ?? 0));
        case 'totalCost':
          return mul * ((a.cost?.totalCost ?? 0) - (b.cost?.totalCost ?? 0));
        default:
          return 0;
      }
    });
  }, [items, sortKey, sortDir]);

  const totalCost = items.reduce((sum, item) => sum + (item.cost?.totalCost ?? 0), 0);
  const totalInput = items.reduce((sum, item) => sum + (item.cost?.promptTokens ?? 0), 0);
  const totalOutput = items.reduce((sum, item) => sum + (item.cost?.completionTokens ?? 0), 0);

  function SortableHead({
    label,
    sortKeyName,
    className,
    tooltip,
  }: {
    label: string;
    sortKeyName: SortKey;
    className?: string;
    /** 渡すと列名に点線が付き、hover で説明が出る。 */
    tooltip?: ReactNode;
  }) {
    return (
      <TableHead
        className={`cursor-pointer select-none hover:bg-muted/60 transition-colors ${className ?? ''}`}
        onClick={() => handleSort(sortKeyName)}
      >
        {label}
        {tooltip ? (
          <Tooltip content={tooltip}>
            {/* 並び替えヘッダの中なので、説明を読むクリックで並び替わらないよう伝播を止める。 */}
            <span
              className="ml-1 inline-flex cursor-help align-middle text-muted-foreground"
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => e.stopPropagation()}
            >
              <Info className="h-3 w-3" />
            </span>
          </Tooltip>
        ) : null}
        <SortIcon active={sortKey === sortKeyName} dir={sortDir} />
      </TableHead>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <SortableHead label="日時" sortKeyName="created_at" />
          <SortableHead label="ユーザー" sortKeyName="user_email" />
          <SortableHead label="状態" sortKeyName="status" />
          <SortableHead label="入力トークン" sortKeyName="promptTokens" className="text-right" />
          <SortableHead
            label="出力トークン"
            sortKeyName="completionTokens"
            className="text-right"
          />
          <SortableHead
            label="推定コスト"
            sortKeyName="totalCost"
            className="text-right"
            tooltip={
              <span>
                <strong>実請求額ではありません。</strong>
                保存済みトークン数 × 価格表（claude-sonnet-4-6: 入力 $3 / 出力 $15 per 1M）で
                その場で計算した推定です。
                <br />
                キャッシュ割引・コンテキスト窓別単価・tier 割引・期間限定価格は反映されません
                （実測で 40% 前後ずれます）。
                <br />
                <span className="text-muted-foreground">
                  1 件ごとの金額は Anthropic 側が出せない（user_id を持たない）ため、ここは
                  推定でしか出せません。実請求額は Observability → AI Spend を見てください
                </span>
              </span>
            }
          />
        </TableRow>
      </TableHeader>
      <TableBody>
        {sorted.map((item) => (
          <TableRow
            key={item.id}
            className={onRowClick ? 'cursor-pointer hover:bg-muted/50' : undefined}
            onClick={onRowClick ? () => onRowClick(item.id) : undefined}
          >
            <TableCell className="whitespace-nowrap font-mono text-xs">
              {formatDate(item.created_at)}
            </TableCell>
            <TableCell className="text-xs text-muted-foreground">
              {item.user_email || item.user_id.slice(0, 8)}
            </TableCell>
            <TableCell>
              <span className="inline-flex items-center gap-1.5 text-sm">
                <span
                  className={`inline-block h-1.5 w-1.5 rounded-full ${statusDotColor(item.status)}`}
                />
                {item.status}
              </span>
            </TableCell>
            <TableCell className="text-right font-mono text-xs">
              {item.cost?.promptTokens?.toLocaleString() ?? '-'}
            </TableCell>
            <TableCell className="text-right font-mono text-xs">
              {item.cost?.completionTokens?.toLocaleString() ?? '-'}
            </TableCell>
            <TableCell className="text-right font-mono text-sm">
              {formatCost(item.cost?.totalCost)}
            </TableCell>
          </TableRow>
        ))}
        {items.length === 0 && (
          <TableRow>
            <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
              No cost data
            </TableCell>
          </TableRow>
        )}
      </TableBody>
      {items.length > 0 && (
        <TableFooter>
          <TableRow>
            <TableCell colSpan={3} className="text-xs font-medium">
              Page Total ({items.length} requests)
            </TableCell>
            <TableCell className="text-right font-mono text-xs font-medium">
              {totalInput.toLocaleString()}
            </TableCell>
            <TableCell className="text-right font-mono text-xs font-medium">
              {totalOutput.toLocaleString()}
            </TableCell>
            <TableCell className="text-right font-mono text-sm font-medium">
              {formatCost(totalCost)}
            </TableCell>
          </TableRow>
        </TableFooter>
      )}
    </Table>
  );
}
