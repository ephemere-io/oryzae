'use client';

import { RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
        <div>
          <h1 className="text-2xl font-bold tracking-tight">AI Gateway Spend</h1>
          <p className="text-sm text-muted-foreground">過去30日間の LLM コスト</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          更新
        </Button>
      </div>

      {loading && !data ? (
        <p className="text-sm text-muted-foreground">読み込み中...</p>
      ) : data ? (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  30日間コスト
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{formatCost(totalCost)}</div>
                <p className="text-xs text-muted-foreground">{totalRequests} リクエスト</p>
              </CardContent>
            </Card>
            {data.credits && (
              <>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      クレジット残高
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      ${Number(data.credits.balance).toFixed(2)}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-muted-foreground">
                      累計使用額
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      ${Number(data.credits.totalUsed).toFixed(2)}
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </div>

          <div>
            <h2 className="text-lg font-semibold mb-3">日別コスト</h2>
            <Card>
              <CardContent className="pt-6">
                <div className="space-y-1">
                  {data.daily.map((d) => (
                    <div key={d.date} className="flex items-center gap-3 text-sm">
                      <span className="w-12 text-right text-muted-foreground shrink-0">
                        {formatDate(d.date)}
                      </span>
                      <div className="flex-1 h-5 bg-muted rounded-sm overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-sm"
                          style={{ width: `${(d.totalCost / maxCost) * 100}%` }}
                        />
                      </div>
                      <span className="w-20 text-right font-mono shrink-0">
                        {formatCost(d.totalCost)}
                      </span>
                      <span className="w-8 text-right text-muted-foreground shrink-0">
                        {d.requestCount}
                      </span>
                    </div>
                  ))}
                  {data.daily.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      データがありません
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {data.byUser.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold mb-3">ユーザー別コスト</h2>
              <Card>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>User</TableHead>
                      <TableHead className="text-right">リクエスト</TableHead>
                      <TableHead className="text-right">Input</TableHead>
                      <TableHead className="text-right">Output</TableHead>
                      <TableHead className="text-right">コスト</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.byUser.map((u) => (
                      <TableRow key={u.userId}>
                        <TableCell className="font-mono text-xs">
                          {u.userId.slice(0, 12)}...
                        </TableCell>
                        <TableCell className="text-right font-mono">{u.requestCount}</TableCell>
                        <TableCell className="text-right font-mono">
                          {u.inputTokens.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {u.outputTokens.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-right font-mono font-medium">
                          {formatCost(u.totalCost)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            </div>
          )}
        </>
      ) : null}
    </div>
  );
}
