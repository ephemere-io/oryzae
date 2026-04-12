'use client';

import type { SnippetData } from '../hooks/use-fermentation-detail';

function snippetTypeLabel(type: string): string {
  if (type === 'new_perspective') return 'New Perspective';
  if (type === 'deepen') return 'Deepen';
  if (type === 'core') return 'Core';
  return type;
}

function snippetTypeBadgeClass(type: string): string {
  if (type === 'new_perspective') return 'bg-blue-500/10 text-blue-700 dark:text-blue-400';
  if (type === 'deepen') return 'bg-amber-500/10 text-amber-700 dark:text-amber-400';
  if (type === 'core') return 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400';
  return 'bg-muted text-muted-foreground';
}

interface FermentationSnippetsProps {
  snippets: SnippetData[];
}

export function FermentationSnippets({ snippets }: FermentationSnippetsProps) {
  if (snippets.length === 0) return null;

  return (
    <section className="space-y-3">
      <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        Extracted Snippets
      </h3>
      <div className="space-y-3">
        {snippets.map((snippet) => (
          <div
            key={snippet.id}
            className="rounded-md border border-border bg-muted/30 p-4 space-y-2"
          >
            <div className="flex items-center gap-2">
              <span
                className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${snippetTypeBadgeClass(snippet.snippetType)}`}
              >
                {snippetTypeLabel(snippet.snippetType)}
              </span>
              <span className="text-[11px] font-mono text-muted-foreground">
                {snippet.sourceDate}
              </span>
            </div>
            <p className="text-sm leading-relaxed text-foreground/90">{snippet.originalText}</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {snippet.selectionReason}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
