'use client';

import { cn } from '@/lib/utils';
import type { Newsletter, NewsletterStatus } from '../types';

// 送信済みは「いつ・何名に送ったか」が一覧で読めることが要件 (issue #614)。
const STATUS_LABEL: Record<NewsletterStatus, string> = {
  draft: '下書き',
  sending: '送信中',
  sent: '送信済み',
};

const STATUS_CLASS: Record<NewsletterStatus, string> = {
  draft: 'bg-muted text-muted-foreground',
  sending: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  sent: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
};

function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('ja-JP', {
    dateStyle: 'short',
    timeStyle: 'short',
    timeZone: 'Asia/Tokyo',
  }).format(date);
}

interface Props {
  items: Newsletter[];
  selectedId: string | null;
  onSelect: (newsletter: Newsletter) => void;
}

export function NewsletterList({ items, selectedId, onSelect }: Props) {
  if (items.length === 0) {
    return (
      <p className="px-3 py-8 text-center text-xs text-muted-foreground">まだ配信はありません。</p>
    );
  }

  return (
    <ul className="space-y-0.5">
      {items.map((item) => (
        <li key={item.id}>
          <button
            type="button"
            onClick={() => onSelect(item)}
            className={cn(
              'w-full rounded-md px-2.5 py-2 text-left transition-colors',
              item.id === selectedId ? 'bg-accent' : 'hover:bg-accent/50',
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <span className="line-clamp-2 text-[13px] leading-snug">{item.subject}</span>
              <span
                className={cn(
                  'shrink-0 rounded px-1.5 py-0.5 text-[10px]',
                  STATUS_CLASS[item.status],
                )}
              >
                {STATUS_LABEL[item.status]}
              </span>
            </div>
            <div className="mt-1 font-mono text-[10px] text-muted-foreground">
              {item.sentAt ? (
                <>
                  {formatDateTime(item.sentAt)} 送信 · {item.sentCount}/{item.recipientCount} 名
                  {item.failedCount > 0 && (
                    <span className="text-destructive"> · 失敗 {item.failedCount}</span>
                  )}
                </>
              ) : (
                <>{formatDateTime(item.updatedAt)} 更新</>
              )}
            </div>
          </button>
        </li>
      ))}
    </ul>
  );
}
