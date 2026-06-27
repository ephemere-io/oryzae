'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';

interface SnippetDialogProps {
  open: boolean;
  initialText?: string;
  onSubmit: (text: string) => void;
  onClose: () => void;
}

export function SnippetDialog({ open, initialText = '', onSubmit, onClose }: SnippetDialogProps) {
  const t = useTranslations('board.snippet_dialog');
  const [text, setText] = useState(initialText);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) {
      setText(initialText);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open, initialText]);

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = text.trim();
    if (trimmed.length > 0 && trimmed.length <= 50) {
      onSubmit(trimmed);
      onClose();
    }
  };

  return (
    <div
      role="dialog"
      aria-label={t('aria_label')}
      className="fixed inset-0 z-[2000] flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.3)' }}
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose();
      }}
    >
      <form
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
        className="w-[90%] max-w-[400px] rounded-xl shadow-lg"
        style={{ backgroundColor: 'var(--bg)', padding: '28px 32px' }}
      >
        <h3 className="mb-4 text-sm font-semibold" style={{ color: 'var(--fg)' }}>
          {initialText ? t('heading_edit') : t('heading_create')}
        </h3>
        <textarea
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          maxLength={50}
          rows={3}
          placeholder={t('placeholder')}
          className="mb-2 w-full resize-none rounded-md border px-3 py-2.5 text-sm outline-none"
          style={{
            height: 80,
            backgroundColor: 'var(--bg)',
            borderColor: 'var(--border-subtle)',
            color: 'var(--fg)',
          }}
        />
        <div className="mb-4 text-right text-[11px]" style={{ color: 'var(--date-color)' }}>
          {text.length}/50
        </div>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border px-4 py-2 text-xs"
            style={{
              borderColor: 'var(--border-subtle)',
              color: 'var(--fg)',
              backgroundColor: 'var(--bg)',
            }}
          >
            {t('cancel')}
          </button>
          <button
            type="submit"
            disabled={text.trim().length === 0}
            className="rounded-md border px-4 py-2 text-xs text-white disabled:opacity-40"
            style={{ backgroundColor: 'var(--accent)', borderColor: 'var(--accent)' }}
          >
            {initialText ? t('update') : t('create')}
          </button>
        </div>
      </form>
    </div>
  );
}
