'use client';

import { verifyAttrs } from '@oryzae/verify';
import { useTranslations } from 'next-intl';
import { useEffect, useRef } from 'react';
import type { EntryContent } from '@/features/shared/board/types';
import { formatIsoDate } from '@/lib/format-date';

interface EntryCardContentProps {
  content: EntryContent;
  /** カード上で編集中か。 */
  editing?: boolean;
  /** 編集中の見出し・本文。表示中と同じものが入る（取り直しはしない）。 */
  editTitle?: string;
  editBody?: string;
  onEditTitleChange?: (next: string) => void;
  onEditBodyChange?: (next: string) => void;
}

/**
 * ボードカードのエントリ表示・編集。
 *
 * 表示と編集で**同じ配置・同じ中身**にしてある。見出しは h3 と同じ見た目の入力欄に、
 * 本文は同じ体裁の textarea に置き換わるだけ。以前は編集のたびに全文を取り直して
 * いたため「読み込み中」が挟まり、しかも表示（抜粋）と編集（全文）で中身が違った。
 */
export function EntryCardContent({
  content,
  editing = false,
  editTitle = '',
  editBody = '',
  onEditTitleChange,
  onEditBodyChange,
}: EntryCardContentProps) {
  const t = useTranslations('board.entry_card');
  const formattedDate = formatIsoDate(content.createdAt);
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing) bodyRef.current?.focus();
  }, [editing]);

  return (
    <div
      className="flex h-full flex-col overflow-hidden p-6"
      {...verifyAttrs({
        unit: 'EntryCardContent',
        hasTitle: Boolean(content.title),
        editing,
        createdAt: content.createdAt,
        formattedDate,
      })}
    >
      <div className="mb-2 flex shrink-0 items-center pb-2">
        <span
          className="text-[9px] uppercase tracking-[0.2em]"
          style={{ color: 'var(--date-color)', fontFamily: 'Inter, sans-serif' }}
        >
          Entry {formattedDate}
        </span>
      </div>

      {editing ? (
        <input
          type="text"
          value={editTitle}
          onChange={(e) => onEditTitleChange?.(e.target.value)}
          aria-label={t('title_aria')}
          data-verify-entry-title-editor="true"
          onPointerDown={(e) => e.stopPropagation()}
          className="mb-2 w-full shrink-0 border-none bg-transparent text-sm font-medium leading-snug outline-none"
          style={{ color: 'var(--fg)' }}
        />
      ) : (
        content.title && (
          <h3
            className="mb-2 line-clamp-2 shrink-0 text-sm font-medium leading-snug"
            style={{ color: 'var(--fg)' }}
          >
            {content.title}
          </h3>
        )
      )}

      {editing ? (
        <textarea
          ref={bodyRef}
          value={editBody}
          onChange={(e) => onEditBodyChange?.(e.target.value)}
          aria-label={t('edit_aria')}
          data-verify-entry-editor="true"
          // 掴んで動かす操作と喧嘩しないよう、ここで pointer 系を止める。
          onPointerDown={(e) => e.stopPropagation()}
          className="board-scroll min-h-0 w-full flex-1 resize-none border-none bg-transparent leading-loose outline-none"
          style={{ color: 'var(--fg)', fontSize: 13 }}
        />
      ) : (
        <p
          className="board-scroll min-h-0 flex-1 overflow-auto whitespace-pre-wrap leading-loose"
          style={{ color: 'var(--fg)', fontSize: 13, opacity: 0.92 }}
        >
          {content.body}
        </p>
      )}
    </div>
  );
}
