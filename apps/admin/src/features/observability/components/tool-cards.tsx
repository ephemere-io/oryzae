'use client';

import { CheckCircle, ExternalLink, XCircle } from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { ToolSummary } from '../hooks/use-observability';

function ToolCard({ tool }: { tool: ToolSummary }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold">{tool.name}</CardTitle>
          {tool.configured ? (
            <Badge variant="default" className="gap-1 shrink-0">
              <CheckCircle className="h-3 w-3" />
              接続済み
            </Badge>
          ) : (
            <Badge variant="secondary" className="gap-1 shrink-0">
              <XCircle className="h-3 w-3" />
              未設定
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground leading-relaxed">{tool.purpose}</p>

        {tool.metrics.length > 0 && (
          <div className="flex flex-wrap gap-3">
            {tool.metrics.map((m) => (
              <div key={m.label} className="rounded-md bg-muted px-3 py-2">
                <div className="text-xs text-muted-foreground">{m.label}</div>
                <div className="text-sm font-semibold">{m.value}</div>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-3 pt-1">
          {tool.adminPath && (
            <Link
              href={tool.adminPath}
              className="text-sm text-primary hover:underline font-medium"
            >
              詳細を見る →
            </Link>
          )}
          <a
            href={tool.externalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            {tool.externalLabel}
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </CardContent>
    </Card>
  );
}

export function ToolCards({ tools }: { tools: ToolSummary[] }) {
  const configuredCount = tools.filter((t) => t.configured).length;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {tools.length} ツール中 {configuredCount} 件が接続済み
      </p>
      <div className="grid gap-4 lg:grid-cols-2">
        {tools.map((tool) => (
          <ToolCard key={tool.id} tool={tool} />
        ))}
      </div>
    </div>
  );
}
