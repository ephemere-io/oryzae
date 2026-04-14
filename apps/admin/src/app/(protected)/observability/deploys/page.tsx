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

function StateDot({ state }: { state: string }) {
  const color =
    state === 'READY'
      ? 'bg-green-500'
      : state === 'ERROR'
        ? 'bg-red-500'
        : state === 'BUILDING'
          ? 'bg-yellow-500'
          : 'bg-muted-foreground';
  return <span className={`inline-block size-1.5 rounded-full ${color}`} />;
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
          <h1 className="text-xl font-medium">Vercel Deploys</h1>
          <span className="text-sm text-muted-foreground">{deploys.length} recent</span>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon-xs" onClick={fetchData} disabled={loading}>
            <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
          </Button>
          <a href="https://vercel.com" target="_blank" rel="noopener noreferrer">
            <Button variant="ghost" size="icon-xs">
              <ExternalLink className="h-3 w-3" />
            </Button>
          </a>
        </div>
      </div>

      {!configured && (
        <p className="text-sm text-muted-foreground py-8 text-center">
          VERCEL_TOKEN is not configured
        </p>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground py-8 text-center">Loading...</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-6" />
              <TableHead>Date</TableHead>
              <TableHead>Target</TableHead>
              <TableHead>Commit</TableHead>
              <TableHead className="text-right">Build</TableHead>
              <TableHead className="w-6" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {deploys.map((d) => (
              <TableRow key={d.id}>
                <TableCell>
                  <StateDot state={d.state} />
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {formatDate(d.createdAt)}
                </TableCell>
                <TableCell className="text-xs">
                  {d.target === 'production' ? (
                    <span className="text-green-400">prod</span>
                  ) : (
                    <span className="text-muted-foreground">preview</span>
                  )}
                </TableCell>
                <TableCell className="max-w-xs truncate text-sm">
                  {d.commitMessage || '-'}
                </TableCell>
                <TableCell className="text-right font-mono text-xs tabular-nums">
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
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {deploys.length === 0 && configured && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  No deployments
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
