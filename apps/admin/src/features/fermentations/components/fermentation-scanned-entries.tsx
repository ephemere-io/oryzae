'use client';

import type { ScannedEntryData } from '../hooks/use-fermentation-detail';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

interface FermentationScannedEntriesProps {
  entries: ScannedEntryData[];
}

export function FermentationScannedEntries({ entries }: FermentationScannedEntriesProps) {
  if (entries.length === 0) {
    return (
      <section className="space-y-2">
        <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Scanned Entries
        </h3>
        <p className="text-sm text-muted-foreground">走査されたエントリーはありません</p>
      </section>
    );
  }

  return (
    <section className="space-y-3">
      <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        Scanned Entries ({entries.length})
      </h3>
      <ul className="space-y-2">
        {entries.map((entry) => (
          <li
            key={entry.id}
            className="rounded-md border border-border bg-muted/30 p-3 space-y-1.5"
          >
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
              <span>
                ID <span className="font-mono text-foreground">{entry.id.slice(0, 8)}</span>
              </span>
              <span>
                Created{' '}
                <span className="font-mono text-foreground">{formatDate(entry.createdAt)}</span>
              </span>
              {entry.updatedAt !== entry.createdAt && (
                <span>
                  Updated{' '}
                  <span className="font-mono text-foreground">{formatDate(entry.updatedAt)}</span>
                </span>
              )}
            </div>
            <p className="text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap">
              {entry.content}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
