'use client';

import Link from 'next/link';

interface EntryCardProps {
  id: string;
  content: string;
  createdAt: string;
}

export function EntryCard({ id, content, createdAt }: EntryCardProps) {
  const preview = content.length > 120 ? `${content.slice(0, 120)}...` : content;
  const date = new Date(createdAt).toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <Link
      href={`/entries/${id}`}
      className="block rounded-lg border border-[var(--border-subtle)] p-4 transition-colors hover:bg-[rgba(200,180,140,0.06)]"
    >
      <p className="text-sm text-[var(--fg)] whitespace-pre-wrap">{preview}</p>
      <time className="mt-2 block text-xs text-[var(--date-color)]">{date}</time>
    </Link>
  );
}
