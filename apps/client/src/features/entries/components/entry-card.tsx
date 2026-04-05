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
      className="block rounded-lg border border-zinc-200 p-4 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
    >
      <p className="text-sm text-zinc-900 dark:text-zinc-100 whitespace-pre-wrap">{preview}</p>
      <time className="mt-2 block text-xs text-zinc-500">{date}</time>
    </Link>
  );
}
