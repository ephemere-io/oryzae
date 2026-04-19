'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { EntryKebabMenu } from './entry-kebab-menu';

interface EntryCardProps {
  id: string;
  content: string;
  createdAt: string;
  searchQuery?: string;
  onDeleteClick?: (id: string) => void;
}

function highlightText(text: string, query: string): ReactNode {
  if (!query) return text;

  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escaped})`, 'gi');
  const parts = text.split(regex);

  if (parts.length === 1) return text;

  return parts.map((part, i) => {
    const key = `${part}-${i}`;
    return regex.test(part) ? (
      <mark key={key} className="bg-[rgba(200,180,100,0.3)] text-[var(--fg)]">
        {part}
      </mark>
    ) : (
      <span key={key}>{part}</span>
    );
  });
}

export function EntryCard({ id, content, createdAt, searchQuery, onDeleteClick }: EntryCardProps) {
  const lines = content.split('\n').filter((l) => l.trim().length > 0);
  const title = lines[0]?.substring(0, 100) ?? '';
  const preview =
    lines.length > 1 ? lines.slice(1).join('\n').substring(0, 200) : content.substring(0, 200);
  const charCount = content.length;

  const date = new Date(createdAt);
  const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

  return (
    <div
      className="group relative border-b border-[var(--border-subtle)] transition-colors hover:rounded hover:bg-[rgba(200,180,140,0.04)]"
      style={{ margin: '0 -12px' }}
    >
      <Link href={`/entries/${id}`} className="block" style={{ padding: '16px 44px 16px 12px' }}>
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
          {searchQuery ? highlightText(title, searchQuery) : title}
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
            {searchQuery ? highlightText(preview, searchQuery) : preview}
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
      {onDeleteClick && (
        <div className="absolute right-2 top-3">
          <EntryKebabMenu onDeleteClick={() => onDeleteClick(id)} />
        </div>
      )}
    </div>
  );
}
