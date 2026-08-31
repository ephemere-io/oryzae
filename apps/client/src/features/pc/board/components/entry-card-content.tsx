'use client';

import { verifyAttrs } from '@oryzae/verify';
import { useTranslations } from 'next-intl';
import { useEffect, useRef } from 'react';
import type { EntryContent } from '@/features/shared/board/types';
import { formatIsoDate } from '@/lib/format-date';

interface EntryCardContentProps {
  content: EntryContent;
  /** カード上で本文を編集中か。 */
  editing?: boolean;
  /** 編集中に表示する本文（**全文**。カードが持つ抜粋ではない）。 */
  editValue?: string;
  onEditChange?: (next: string) => void;
  editLoading?: boolean;
}

export function EntryCardContent({
  content,
  editing = false,
  editValue = '',
  onEditChange,
  editLoading = false,
}: EntryCardContentProps) {
  const t = useTranslations('board.entry_card');
  const formattedDate = formatIsoDate(content.createdAt);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // 編集に入ったらそのまま打てるようにする。全文が届くまでは disabled なので、
  // 読み込みが終わってから当てる。
  useEffect(() => {
    if (editing && !editLoading) inputRef.current?.focus();
  }, [editing, editLoading]);

  return (
    <div
      className="flex h-full flex-col overflow-hidden p-6"
      {...verifyAttrs({
        unit: 'EntryCardContent',
        hasTitle: Boolean(content.title),
        editing,
        editLoading,
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

      {editing ? (
        <textarea
          ref={inputRef}
          value={editLoading ? '' : editValue}
          onChange={(e) => onEditChange?.(e.target.value)}
          disabled={editLoading}
          aria-label={t('edit_aria')}
          placeholder={editLoading ? t('loading') : undefined}
          data-verify-entry-editor="true"
          // 掴んで動かす操作と喧嘩しないよう、ここで pointer 系を止める。
          // 親（BoardCard）は編集中はドラッグを始めないが、選択の開始点が
          // カード側に伝わると選択が途切れることがある。
          onPointerDown={(e) => e.stopPropagation()}
          className="min-h-0 w-full flex-1 resize-none border-none bg-transparent leading-loose outline-none"
          style={{ color: 'var(--fg)', fontSize: 13 }}
        />
      ) : (
        <>
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
          {/* 読み終わりをぼかす帯。編集中は文字が隠れると困るので出さない。 */}
          <div
            className="pointer-events-none absolute bottom-0 left-0 right-0 h-12"
            style={{
              background: 'linear-gradient(transparent, var(--card-bg, var(--bg)))',
            }}
          />
        </>
      )}
    </div>
  );
}
