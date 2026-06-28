'use client';

import { useTranslations } from 'next-intl';

interface PickleNudgeModalProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Issue #316: 問いを紐付けて保存したが、まだ一度も「漬け込む」を押した
 * ことがない使用者に、漬け込みボタンを試してみるよう案内する。
 * 強制ではなく可能性の提示。
 */
export function PickleNudgeModal({ open, onClose }: PickleNudgeModalProps) {
  const t = useTranslations('editor.pickle_nudge_modal');

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
        className="w-[90%] max-w-[440px] rounded-xl shadow-lg"
        style={{ backgroundColor: 'var(--bg)', padding: '28px 32px' }}
      >
        <h3 className="mb-3 text-sm font-semibold" style={{ color: 'var(--fg)' }}>
          {t('heading')}
        </h3>
        <p className="mb-5 text-xs leading-relaxed" style={{ color: 'var(--fg)' }}>
          {t('body')}
        </p>
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-md border px-4 py-2 text-xs"
            style={{
              borderColor: 'var(--accent)',
              color: 'var(--accent)',
              backgroundColor: 'var(--bg)',
            }}
          >
            {t('dismiss')}
          </button>
        </div>
      </div>
    </div>
  );
}
