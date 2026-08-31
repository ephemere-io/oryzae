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

/** 見出しは本文の1行目。編集中も同じ作り方で出して、カードの顔を消さない。 */
function firstLine(text: string): string {
  return text.split('\n').find((line) => line.trim().length > 0) ?? '';
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

  // 編集中は打っている内容から見出しを作る。表示中はサーバーが作ったものを使う。
  const heading = editing && !editLoading ? firstLine(editValue) : content.title;

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
      <div className="mb-2 flex shrink-0 items-center justify-between pb-2">
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

      {/* 見出しは編集中も出す。消えるとカードがどれだか分からなくなる。
          編集中は打っている1行目に追従するので、直したそばから反映される。 */}
      {heading && (
        <h3
          className="mb-2 line-clamp-2 shrink-0 text-sm font-medium leading-snug"
          style={{ color: 'var(--fg)' }}
        >
          {heading}
        </h3>
      )}

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
          onPointerDown={(e) => e.stopPropagation()}
          className="min-h-0 w-full flex-1 resize-none border-none bg-transparent leading-loose outline-none"
          style={{ color: 'var(--fg)', fontSize: 13 }}
        />
      ) : (
        <>
          {/* 本文は読ませるものなので、地の文と同じ濃さで出す。以前は日付と同じ
              薄い色に opacity まで掛けており、カードの上では読み取れなかった。
              長い日記はここで送れる（掴んで広げれば、そのぶん見える）。 */}
          <p
            className="min-h-0 flex-1 overflow-auto whitespace-pre-wrap leading-loose"
            style={{ color: 'var(--fg)', fontSize: 13, opacity: 0.92 }}
          >
            {content.preview}
          </p>
        </>
      )}
    </div>
  );
}
