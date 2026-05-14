'use client';

import { useTranslations } from 'next-intl';

interface PickleConfirmModalProps {
  open: boolean;
  saving: boolean;
  title: string;
  /** Linked question texts to show in the confirmation copy. */
  linkedQuestionTexts: string[];
  onConfirm: () => void;
  onClose: () => void;
}

/**
 * Issue #316: タイトルあり × 問いあり のエントリを「漬け込む」とき、
 * 既存の SaveTitleModal (タイトル編集付き) ではなく、瓶に漬け込むことの
 * 確認だけを行う軽いモーダル。タイトル編集は別途 EntryEditor の
 * インライン編集で行う想定。
 */
export function PickleConfirmModal({
  open,
  saving,
  title,
  linkedQuestionTexts,
  onConfirm,
  onClose,
}: PickleConfirmModalProps) {
  const t = useTranslations('editor.pickle_confirm_modal');

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('aria_label')}
      className="fixed inset-0 z-[2000] flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.3)' }}
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === 'Escape') onClose();
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
        className="w-[90%] max-w-[400px] rounded-xl shadow-lg"
        style={{ backgroundColor: 'var(--bg)', padding: '28px 32px' }}
      >
        <h3 className="mb-3 text-sm font-semibold" style={{ color: 'var(--fg)' }}>
          {t('heading')}
        </h3>
        <p className="mb-4 text-xs leading-relaxed" style={{ color: 'var(--fg)' }}>
          {t('body', { title })}
        </p>
        {linkedQuestionTexts.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-1">
            {linkedQuestionTexts.map((text) => (
              <span
                key={text}
                className="inline-flex max-w-full items-center rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
              >
                <span className="truncate">{text}</span>
              </span>
            ))}
          </div>
        )}
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
            type="button"
            onClick={onConfirm}
            disabled={saving}
            className="rounded-md border px-4 py-2 text-xs text-white disabled:opacity-40"
            style={{ backgroundColor: 'var(--accent)', borderColor: 'var(--accent)' }}
          >
            {saving ? t('saving') : t('confirm')}
          </button>
        </div>
      </div>
    </div>
  );
}
