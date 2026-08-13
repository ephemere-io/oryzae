'use client';

import { verifyAttrs } from '@oryzae/verify';
import type { EntryContent } from '@/features/shared/board/types';
import { formatIsoDate } from '@/lib/format-date';

interface EntryCardContentProps {
  content: EntryContent;
}

export function EntryCardContent({ content }: EntryCardContentProps) {
  const formattedDate = formatIsoDate(content.createdAt);
  return (
    <div
      className="flex h-full flex-col overflow-hidden p-6"
      {...verifyAttrs({
        unit: 'EntryCardContent',
        hasTitle: Boolean(content.title),
        createdAt: content.createdAt,
        formattedDate,
      })}
    >
      {/* Header with border separator */}
      <div className="mb-2 flex items-center justify-between pb-2">
        <span
          className="text-[9px] uppercase tracking-[0.2em]"
          style={{ color: 'var(--date-color)', fontFamily: 'Inter, sans-serif' }}
        >
          Entry {formattedDate}
        </span>
        <span
          className="inline-block h-1 w-1 rounded-full"
          style={{ backgroundColor: 'var(--accent)' }}
        />
      </div>
      {content.title && (
        <h3
          className="mb-2 line-clamp-2 text-sm font-medium leading-snug"
          style={{ color: 'var(--fg)' }}
        >
          {content.title}
        </h3>
      )}
      <p
        className="flex-1 leading-loose"
        style={{ color: 'var(--date-color)', fontSize: 13, opacity: 0.85 }}
      >
        {content.preview}
      </p>
      <div
        className="pointer-events-none absolute bottom-0 left-0 right-0 h-12"
        style={{
          background: 'linear-gradient(transparent, var(--card-bg, var(--bg)))',
        }}
      />
    </div>
  );
}
