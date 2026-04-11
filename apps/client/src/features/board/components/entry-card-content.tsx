'use client';

interface EntryContent {
  title: string;
  preview: string;
  createdAt: string;
}

interface EntryCardContentProps {
  content: EntryContent;
}

function formatEntryDate(dateStr: string): string {
  const d = new Date(dateStr);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function EntryCardContent({ content }: EntryCardContentProps) {
  return (
    <div className="flex h-full flex-col overflow-hidden p-6">
      {/* Header with border separator */}
      <div
        className="mb-2 flex items-center justify-between pb-2"
        style={{ borderBottom: '1px solid var(--border-subtle)' }}
      >
        <span
          className="text-[9px] uppercase tracking-[0.2em]"
          style={{ color: 'var(--date-color)', fontFamily: 'Inter, sans-serif' }}
        >
          Entry {formatEntryDate(content.createdAt)}
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
