'use client';

import { ExternalLink, RefreshCw } from 'lucide-react';
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

function LevelDot({ level }: { level: string }) {
  const color =
    level === 'fatal'
      ? 'bg-red-500'
      : level === 'error'
        ? 'bg-red-400'
        : level === 'warning'
          ? 'bg-yellow-500'
          : 'bg-muted-foreground';
  return <span className={`inline-block size-1.5 rounded-full ${color}`} />;
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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/observability"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Observability
          </Link>
          <span className="text-muted-foreground">/</span>
          <h1 className="text-xl font-medium">Sentry Errors</h1>
          <span className="text-sm text-muted-foreground">{issues.length} unresolved</span>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon-xs" onClick={fetchData} disabled={loading}>
            <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <a href="https://oryzae.sentry.io" target="_blank" rel="noopener noreferrer">
            <Button variant="ghost" size="icon-xs">
              <ExternalLink className="h-3 w-3" />
            </Button>
          </a>
        </div>
      </div>

      {!configured && (
        <p className="text-sm text-muted-foreground py-8 text-center">
          SENTRY_AUTH_TOKEN is not configured
        </p>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground py-8 text-center">Loading...</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-6" />
              <TableHead>Error</TableHead>
              <TableHead className="text-right">Events</TableHead>
              <TableHead className="text-right">Users</TableHead>
              <TableHead>Last seen</TableHead>
              <TableHead className="w-6" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {issues.map((issue) => (
              <TableRow key={issue.shortId}>
                <TableCell>
                  <LevelDot level={issue.level} />
                </TableCell>
                <TableCell className="max-w-md truncate text-sm font-medium">
                  {issue.title}
                </TableCell>
                <TableCell className="text-right font-mono text-sm">
                  {issue.count.toLocaleString()}
                </TableCell>
                <TableCell className="text-right font-mono text-sm">{issue.userCount}</TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {formatDate(issue.lastSeen)}
                </TableCell>
                <TableCell>
                  <a
                    href={issue.permalink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </TableCell>
              </TableRow>
            ))}
            {issues.length === 0 && configured && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  No unresolved errors
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
