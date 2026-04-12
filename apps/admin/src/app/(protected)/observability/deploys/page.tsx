'use client';

import { ExternalLink, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
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

interface Deploy {
  id: string;
  state: string;
  target: string;
  createdAt: string;
  buildDurationMs: number | null;
  url: string;
  inspectorUrl: string;
  commitMessage: string;
  commitRef: string;
  creatorEmail: string;
}

function formatDate(iso: string): string {
  if (!iso) return '-';
  return new Date(iso).toLocaleString('ja-JP', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDuration(ms: number | null): string {
  if (ms === null) return '-';
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

function stateVariant(state: string): 'default' | 'destructive' | 'secondary' {
  if (state === 'READY') return 'default';
  if (state === 'ERROR') return 'destructive';
  return 'secondary';
}

export default function DeploysPage() {
  const [deploys, setDeploys] = useState<Deploy[]>([]);
  const [configured, setConfigured] = useState(true);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    const token = getAccessToken();
    if (!token) return;
    setLoading(true);
    const api = createApiClient(token);
    const res = await api.fetch('/api/v1/admin/observability/deploys');
    if (res.ok) {
      const body = (await res.json()) as { deploys: Deploy[]; configured: boolean };
      setDeploys(body.deploys);
      setConfigured(body.configured);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Vercel Deploys</h1>
          <p className="text-sm text-muted-foreground">直近のデプロイ一覧</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            更新
          </Button>
          <a href="https://vercel.com" target="_blank" rel="noopener noreferrer">
            <Button variant="outline" size="sm">
              Vercel <ExternalLink className="ml-1 h-3 w-3" />
            </Button>
          </a>
        </div>
      </div>

      {!configured && (
        <div className="rounded-md bg-muted px-4 py-3 text-sm text-muted-foreground">
          VERCEL_TOKEN が未設定です。サーバーの環境変数を設定してください。
        </div>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">読み込み中...</p>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>日時</TableHead>
                <TableHead>状態</TableHead>
                <TableHead>Target</TableHead>
                <TableHead>コミット</TableHead>
                <TableHead className="text-right">ビルド時間</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {deploys.map((d) => (
                <TableRow key={d.id}>
                  <TableCell className="whitespace-nowrap">{formatDate(d.createdAt)}</TableCell>
                  <TableCell>
                    <Badge variant={stateVariant(d.state)}>{d.state}</Badge>
                  </TableCell>
                  <TableCell className="text-xs">{d.target || '-'}</TableCell>
                  <TableCell className="max-w-xs truncate text-sm">
                    {d.commitMessage || '-'}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatDuration(d.buildDurationMs)}
                  </TableCell>
                  <TableCell>
                    {d.inspectorUrl && (
                      <a
                        href={d.inspectorUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {deploys.length === 0 && configured && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    デプロイデータがありません
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
