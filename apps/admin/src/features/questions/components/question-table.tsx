'use client';

import { Archive, ArrowDown, ArrowUp, ArrowUpDown, Sparkles } from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { QuestionItem } from '../hooks/use-questions';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatReadiness(score: number): string {
  // 表示桁: 0.00-1.00 (Jar アニメーションと同じ精度)
  return score.toFixed(2);
}

function readinessBarColor(score: number): string {
  if (score >= 1) return 'bg-green-500';
  if (score >= 0.66) return 'bg-yellow-500';
  if (score >= 0.33) return 'bg-orange-500';
  return 'bg-muted-foreground/40';
}

function userLabel(item: QuestionItem): string {
  if (item.user_nickname) return item.user_nickname;
  return item.user_email || item.user_id.slice(0, 8);
}

type SortKey = 'user' | 'text' | 'created_at' | 'updated_at' | 'readiness';
type SortDir = 'asc' | 'desc';

function SortIcon({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return <ArrowUpDown className="ml-1 inline h-3 w-3 opacity-30" />;
  return dir === 'asc' ? (
    <ArrowUp className="ml-1 inline h-3 w-3" />
  ) : (
    <ArrowDown className="ml-1 inline h-3 w-3" />
  );
}

interface QuestionTableProps {
  items: QuestionItem[];
}

export function QuestionTable({ items }: QuestionTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('readiness');
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
        case 'user':
          return mul * userLabel(a).localeCompare(userLabel(b));
        case 'text':
          return mul * (a.text || '').localeCompare(b.text || '');
        case 'created_at':
          return mul * (new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        case 'updated_at':
          return mul * (new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime());
        case 'readiness':
          return mul * (a.readiness.score - b.readiness.score);
        default:
          return 0;
      }
    });
  }, [items, sortKey, sortDir]);

  function SortableHead({
    label,
    sortKeyName,
    className,
  }: {
    label: string;
    sortKeyName: SortKey;
    className?: string;
  }) {
    return (
      <TableHead
        className={`cursor-pointer select-none hover:bg-muted/60 transition-colors ${className ?? ''}`}
        onClick={() => handleSort(sortKeyName)}
      >
        {label}
        <SortIcon active={sortKey === sortKeyName} dir={sortDir} />
      </TableHead>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <SortableHead label="User" sortKeyName="user" className="w-[180px]" />
          <SortableHead label="問い" sortKeyName="text" />
          <SortableHead label="Created" sortKeyName="created_at" className="w-[140px]" />
          <SortableHead label="Updated" sortKeyName="updated_at" className="w-[140px]" />
          <SortableHead label="Readiness" sortKeyName="readiness" className="w-[180px]" />
          <TableHead className="w-[60px]">Flags</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sorted.map((item) => (
          <TableRow key={item.id}>
            <TableCell className="text-xs">
              <div className="flex flex-col">
                <span className="truncate font-medium" title={item.user_nickname || undefined}>
                  {item.user_nickname || <span className="text-muted-foreground">—</span>}
                </span>
                <span
                  className="truncate text-[10px] text-muted-foreground"
                  title={item.user_email}
                >
                  {item.user_email}
                </span>
              </div>
            </TableCell>
            <TableCell className="max-w-[480px] text-sm">
              <span className="block truncate" title={item.text}>
                {item.text || <span className="text-muted-foreground italic">(no text)</span>}
              </span>
            </TableCell>
            <TableCell className="whitespace-nowrap font-mono text-xs">
              {formatDate(item.created_at)}
            </TableCell>
            <TableCell className="whitespace-nowrap font-mono text-xs">
              {formatDate(item.updated_at)}
            </TableCell>
            <TableCell>
              <div
                className="flex items-center gap-2"
                title={
                  `score=${formatReadiness(item.readiness.score)} ` +
                  `chars=${item.readiness.charsCurrent}/${item.readiness.threshold} ` +
                  `(${formatReadiness(item.readiness.charScore)}) ` +
                  (item.readiness.hoursElapsed != null && item.readiness.hoursRequired != null
                    ? `time=${item.readiness.hoursElapsed.toFixed(1)}h/${item.readiness.hoursRequired}h ` +
                      `(${formatReadiness(item.readiness.timeScore)})`
                    : 'never fermented')
                }
              >
                <div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted">
                  <div
                    className={`h-full ${readinessBarColor(item.readiness.score)}`}
                    style={{ width: `${Math.round(item.readiness.score * 100)}%` }}
                  />
                </div>
                <span className="font-mono text-xs">{formatReadiness(item.readiness.score)}</span>
                {item.readiness.eligible && (
                  <span title="eligible for fermentation">
                    <Sparkles className="h-3 w-3 text-green-600" />
                  </span>
                )}
              </div>
            </TableCell>
            <TableCell className="text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                {item.is_archived && (
                  <span title="archived">
                    <Archive className="h-3 w-3" />
                  </span>
                )}
                {item.is_proposed_by_oryzae && (
                  <span title="proposed by oryzae" className="text-[10px]">
                    AI
                  </span>
                )}
                {!item.is_validated_by_user && !item.is_archived && (
                  <span title="pending validation" className="text-[10px] text-yellow-600">
                    pending
                  </span>
                )}
              </div>
            </TableCell>
          </TableRow>
        ))}
        {items.length === 0 && (
          <TableRow>
            <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
              No questions
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}
