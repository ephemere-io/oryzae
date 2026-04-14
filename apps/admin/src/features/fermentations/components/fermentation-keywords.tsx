'use client';

import type { KeywordData } from '../hooks/use-fermentation-detail';

interface FermentationKeywordsProps {
  keywords: KeywordData[];
}

export function FermentationKeywords({ keywords }: FermentationKeywordsProps) {
  if (keywords.length === 0) return null;

  return (
    <section className="space-y-3">
      <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        Keywords
      </h3>
      <div className="flex flex-wrap gap-2">
        {keywords.map((kw) => (
          <span
            key={kw.id}
            className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/50 px-3 py-1 text-xs"
            title={kw.description}
          >
            <span className="font-medium text-foreground">{kw.keyword}</span>
            {kw.description && (
              <span className="text-muted-foreground ml-0.5">{kw.description}</span>
            )}
          </span>
        ))}
      </div>
    </section>
  );
}
