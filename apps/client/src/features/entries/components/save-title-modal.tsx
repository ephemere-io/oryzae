'use client';

import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';

interface SaveTitleModalProps {
  open: boolean;
  initialTitle: string;
  saving: boolean;
  onSave: (title: string) => void;
  onClose: () => void;
  heading?: string;
  submitLabel?: string;
}

export function SaveTitleModal({
  open,
  initialTitle,
  saving,
  onSave,
  onClose,
  heading,
  submitLabel,
}: SaveTitleModalProps) {
  const t = useTranslations('editor.save_modal');
  const resolvedHeading = heading ?? t('default_heading');
  const resolvedSubmitLabel = submitLabel ?? t('default_submit');
  const [title, setTitle] = useState(initialTitle);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setTitle(initialTitle);
      setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 50);
    }
  }, [open, initialTitle]);

  if (!open) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(title.trim() || initialTitle);
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
          {resolvedHeading}
        </h3>
        <label
          className="mb-1.5 block text-xs"
          style={{ color: 'var(--date-color)' }}
          htmlFor="entry-title"
        >
          {t('title_label')}
        </label>
        <input
          ref={inputRef}
          id="entry-title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            // IME 変換確定の Enter で保存されないようにする
            if (e.key === 'Enter' && e.nativeEvent.isComposing) {
              e.preventDefault();
            }
          }}
          maxLength={100}
          placeholder={t('title_placeholder')}
          className="mb-4 w-full rounded-md border px-3 py-2.5 text-sm outline-none"
          style={{
            backgroundColor: 'var(--bg)',
            borderColor: 'var(--border-subtle)',
            color: 'var(--fg)',
          }}
        />
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
            disabled={saving}
            className="rounded-md border px-4 py-2 text-xs text-white disabled:opacity-40"
            style={{ backgroundColor: 'var(--accent)', borderColor: 'var(--accent)' }}
          >
            {saving ? t('saving') : resolvedSubmitLabel}
          </button>
        </div>
      </form>
    </div>
  );
}
