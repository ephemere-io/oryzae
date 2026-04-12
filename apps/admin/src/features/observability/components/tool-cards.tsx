'use client';

import { ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { ToolSummary } from '../hooks/use-observability';

function ToolCard({ tool }: { tool: ToolSummary }) {
  const content = (
    <Card className="cursor-pointer transition-colors hover:bg-muted/50">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-base">{tool.name}</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">{tool.tagline}</p>
          </div>
          {!tool.href && <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0" />}
        </div>
      </CardHeader>
      {tool.metric && (
        <CardContent className="pt-0">
          <div className="rounded-md bg-muted px-3 py-2 inline-block">
            <div className="text-xs text-muted-foreground">{tool.metric.label}</div>
            <div className="text-lg font-bold">{tool.metric.value}</div>
          </div>
        </CardContent>
      )}
    </Card>
  );

  if (tool.href) {
    return <Link href={tool.href}>{content}</Link>;
  }

  return (
    <a href={tool.externalUrl} target="_blank" rel="noopener noreferrer">
      {content}
    </a>
  );
}

export function ToolCards({ tools }: { tools: ToolSummary[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {tools.map((tool) => (
        <ToolCard key={tool.id} tool={tool} />
      ))}
    </div>
  );
}
