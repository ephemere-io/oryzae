'use client';

import Link from 'next/link';

interface EntryCardProps {
  id: string;
  content: string;
  createdAt: string;
}

export function EntryCard({ id, content, createdAt }: EntryCardProps) {
  const lines = content.split('\n').filter((l) => l.trim().length > 0);
  const title = lines[0]?.substring(0, 100) ?? '';
  const preview =
    lines.length > 1 ? lines.slice(1).join('\n').substring(0, 200) : content.substring(0, 200);
  const charCount = content.length;

  const date = new Date(createdAt);
  const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

  return (
    <Link
      href={`/entries/${id}`}
      className="group block border-b border-[var(--border-subtle)] py-4 transition-colors hover:rounded hover:bg-[rgba(200,180,140,0.04)]"
      style={{ margin: '0 -12px', padding: '16px 12px' }}
    >
      {/* Date */}
      <div
        className="mb-1 text-[10px] tracking-[0.1em] text-[var(--date-color)]"
        style={{ fontFamily: 'Inter, sans-serif' }}
      >
        {dateStr}
      </div>

      {/* Title */}
      <h3
        className="mb-1.5 text-[15px] font-medium text-[var(--fg)]"
        style={{ fontFamily: "'Noto Serif JP', serif" }}
      >
        {title}
      </h3>

      {/* Preview */}
      {preview && title !== preview && (
        <p
          className="mb-2 text-[13px] leading-relaxed text-[var(--fg)] opacity-70"
          style={{
            display: '-webkit-box',
            WebkitLineClamp: 3,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {preview}
        </p>
      )}

      {/* Meta */}
      <div
        className="text-[10px] tracking-[0.05em] text-[var(--date-color)]"
        style={{ fontFamily: 'Inter, sans-serif' }}
      >
        文字数: {charCount}
      </div>
    </Link>
  );
}
