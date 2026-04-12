'use client';

import { CheckCircle, ExternalLink, XCircle } from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { ToolStatus } from '../hooks/use-observability';

function ToolCard({ tool }: { tool: ToolStatus }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <div>
          <CardTitle className="text-base font-semibold">{tool.name}</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">{tool.concern}</p>
        </div>
        {tool.configured ? (
          <Badge variant="default" className="gap-1">
            <CheckCircle className="h-3 w-3" />
            設定済み
          </Badge>
        ) : (
          <Badge variant="secondary" className="gap-1">
            <XCircle className="h-3 w-3" />
            未設定
          </Badge>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">{tool.description}</p>
        <div className="flex gap-2">
          {tool.adminPath && (
            <Link
              href={tool.adminPath}
              className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
            >
              Admin で見る
            </Link>
          )}
          <a
            href={tool.externalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            ダッシュボード
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </CardContent>
    </Card>
  );
}

export function ToolCards({ tools }: { tools: ToolStatus[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {tools.map((tool) => (
        <ToolCard key={tool.id} tool={tool} />
      ))}
    </div>
  );
}
