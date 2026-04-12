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

interface SentryIssue {
  title: string;
  shortId: string;
  level: string;
  count: number;
  userCount: number;
  firstSeen: string;
  lastSeen: string;
  permalink: string;
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

function levelVariant(level: string): 'default' | 'destructive' | 'secondary' {
  if (level === 'error' || level === 'fatal') return 'destructive';
  if (level === 'warning') return 'default';
  return 'secondary';
}

export default function ErrorsPage() {
  const [issues, setIssues] = useState<SentryIssue[]>([]);
  const [configured, setConfigured] = useState(true);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    const token = getAccessToken();
    if (!token) return;
    setLoading(true);
    const api = createApiClient(token);
    const res = await api.fetch('/api/v1/admin/observability/errors');
    if (res.ok) {
      const body = (await res.json()) as { issues: SentryIssue[]; configured: boolean };
      setIssues(body.issues);
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
          <h1 className="text-2xl font-bold tracking-tight">Sentry Errors</h1>
          <p className="text-sm text-muted-foreground">未解決エラー一覧</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            更新
          </Button>
          <a href="https://oryzae.sentry.io" target="_blank" rel="noopener noreferrer">
            <Button variant="outline" size="sm">
              Sentry <ExternalLink className="ml-1 h-3 w-3" />
            </Button>
          </a>
        </div>
      </div>

      {!configured && (
        <div className="rounded-md bg-muted px-4 py-3 text-sm text-muted-foreground">
          SENTRY_AUTH_TOKEN が未設定です。サーバーの環境変数を設定してください。
        </div>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground">読み込み中...</p>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Error</TableHead>
                <TableHead>Level</TableHead>
                <TableHead className="text-right">発生回数</TableHead>
                <TableHead className="text-right">影響ユーザー</TableHead>
                <TableHead>最終発生</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {issues.map((issue) => (
                <TableRow key={issue.shortId}>
                  <TableCell className="max-w-xs truncate font-medium">{issue.title}</TableCell>
                  <TableCell>
                    <Badge variant={levelVariant(issue.level)}>{issue.level}</Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {issue.count.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right font-mono">{issue.userCount}</TableCell>
                  <TableCell className="whitespace-nowrap">{formatDate(issue.lastSeen)}</TableCell>
                  <TableCell>
                    <a
                      href={issue.permalink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </TableCell>
                </TableRow>
              ))}
              {issues.length === 0 && configured && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    未解決エラーはありません
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
