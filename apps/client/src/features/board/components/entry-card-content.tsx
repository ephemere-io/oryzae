'use client';

interface EntryContent {
  title: string;
  preview: string;
  createdAt: string;
}

interface EntryCardContentProps {
  content: EntryContent;
}

export function EntryCardContent({ content }: EntryCardContentProps) {
  const dateStr = new Date(content.createdAt).toLocaleDateString('ja-JP', {
    month: 'short',
    day: 'numeric',
  });

  return (
    <div className="flex h-full flex-col overflow-hidden p-6">
      <div className="mb-2 flex items-center gap-2">
        <span
          className="inline-block h-2 w-2 rounded-full"
          style={{ backgroundColor: 'var(--accent)' }}
        />
        <span
          className="text-[10px] uppercase tracking-wider"
          style={{ color: 'var(--date-color)', fontFamily: 'Inter, sans-serif' }}
        >
          {dateStr}
        </span>
      </div>
      {content.title && (
        <h3
          className="mb-2 line-clamp-2 text-sm font-medium leading-snug"
          style={{ color: 'var(--fg)' }}
        >
          {content.title}
        </h3>
      )}
      <p className="flex-1 text-xs leading-relaxed" style={{ color: 'var(--date-color)' }}>
        {content.preview}
      </p>
      <div
        className="pointer-events-none absolute bottom-0 left-0 right-0 h-16"
        style={{
          background: 'linear-gradient(transparent, var(--card-bg, var(--bg)))',
        }}
      />
    </div>
  );
}
