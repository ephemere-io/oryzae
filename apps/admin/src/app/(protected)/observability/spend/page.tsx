'use client';

import { RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { createApiClient } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';

interface DailySpend {
  date: string;
  totalCost: number;
  inputTokens: number;
  outputTokens: number;
  requestCount: number;
}

interface UserSpend {
  userId: string;
  totalCost: number;
  inputTokens: number;
  outputTokens: number;
  requestCount: number;
}

interface SpendData {
  daily: DailySpend[];
  byUser: UserSpend[];
  credits: { balance: string; totalUsed: string } | null;
}

function formatCost(cost: number): string {
  return `$${cost.toFixed(4)}`;
}

function formatDate(iso: string): string {
  if (!iso) return '-';
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export default function SpendPage() {
  const [data, setData] = useState<SpendData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    const token = getAccessToken();
    if (!token) return;
    setLoading(true);
    const api = createApiClient(token);
    const res = await api.fetch('/api/v1/admin/observability/spend?date_from=30');
    if (res.ok) {
      setData((await res.json()) as SpendData);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const totalCost = data?.daily.reduce((s, d) => s + d.totalCost, 0) ?? 0;
  const totalRequests = data?.daily.reduce((s, d) => s + d.requestCount, 0) ?? 0;
  const maxCost = Math.max(...(data?.daily.map((d) => d.totalCost) ?? [0]), 0.001);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/observability"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Observability
          </Link>
          <span className="text-muted-foreground">/</span>
          <h1 className="text-xl font-medium">AI Gateway Spend</h1>
          <span className="text-sm text-muted-foreground">Past 30 days</span>
        </div>
        <Button variant="ghost" size="icon-xs" onClick={fetchData} disabled={loading}>
          <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {loading && !data ? (
        <p className="text-sm text-muted-foreground py-8 text-center">Loading...</p>
      ) : data ? (
        <>
          <div className="grid gap-4 grid-cols-3">
            <div className="rounded-lg border border-border/50 bg-card p-4">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">30d cost</p>
              <p className="text-3xl font-semibold tracking-tight mt-0.5 tabular-nums">
                {formatCost(totalCost)}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">{totalRequests} requests</p>
            </div>
            {data.credits && (
              <>
                <div className="rounded-lg border border-border/50 bg-card p-4">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">Balance</p>
                  <p className="text-3xl font-semibold tracking-tight mt-0.5 tabular-nums">
                    ${Number(data.credits.balance).toFixed(2)}
                  </p>
                </div>
                <div className="rounded-lg border border-border/50 bg-card p-4">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">
                    Total used
                  </p>
                  <p className="text-3xl font-semibold tracking-tight mt-0.5 tabular-nums">
                    ${Number(data.credits.totalUsed).toFixed(2)}
                  </p>
                </div>
              </>
            )}
          </div>

          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3">
              Daily cost
            </p>
            {data.daily.length > 0 ? (
              <div className="space-y-1">
                {data.daily.map((d) => (
                  <div key={d.date} className="flex items-center gap-3 text-sm">
                    <span className="w-10 text-right text-xs text-muted-foreground shrink-0">
                      {formatDate(d.date)}
                    </span>
                    <div className="flex-1 h-4 bg-muted/30 rounded-sm overflow-hidden">
                      <div
                        className="h-full bg-primary/60 rounded-sm"
                        style={{ width: `${(d.totalCost / maxCost) * 100}%` }}
                      />
                    </div>
                    <span className="w-16 text-right font-mono text-xs tabular-nums shrink-0">
                      {formatCost(d.totalCost)}
                    </span>
                    <span className="w-6 text-right text-xs text-muted-foreground shrink-0">
                      {d.requestCount}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">No data</p>
            )}
          </div>

          {data.byUser.length > 0 && (
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3">By user</p>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead className="text-right">Requests</TableHead>
                    <TableHead className="text-right">Input</TableHead>
                    <TableHead className="text-right">Output</TableHead>
                    <TableHead className="text-right">Cost</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.byUser.map((u) => (
                    <TableRow key={u.userId}>
                      <TableCell className="font-mono text-xs">
                        {u.userId.slice(0, 12)}...
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {u.requestCount}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs text-muted-foreground">
                        {u.inputTokens.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs text-muted-foreground">
                        {u.outputTokens.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">
                        {formatCost(u.totalCost)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
