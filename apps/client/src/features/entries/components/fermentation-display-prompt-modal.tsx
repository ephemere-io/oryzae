'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';

interface FermentationDisplayPromptModalProps {
  open: boolean;
  /** Called when the user picks display/hide. `remember` tells the caller to persist the choice. */
  onChoose: (display: boolean, remember: boolean) => void;
  onClose: () => void;
}

/**
 * Issue #329: 新規エントリで問いを紐付けたとき、その問いの発酵結果をエディタ上に
 * フローティング表示するかを確認するモーダル。「次回からは確認しない」を ON にすると
 * 選んだ挙動が設定に保存され、以降はモーダルなしで自動適用される。
 */
export function FermentationDisplayPromptModal({
  open,
  onChoose,
  onClose,
}: FermentationDisplayPromptModalProps) {
  const t = useTranslations('editor.fermentation_overlay.prompt');
  const [remember, setRemember] = useState(false);

  if (!open) return null;

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-[70] bg-black/30"
        onClick={onClose}
        aria-label={t('close_aria')}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t('aria_label')}
        className="-translate-x-1/2 -translate-y-1/2 fixed top-1/2 left-1/2 z-[71] w-[min(440px,92vw)] rounded-xl border border-[var(--border-subtle)] bg-[var(--bg)] p-6 shadow-2xl"
      >
        <h2 className="mb-2 text-lg font-bold text-[var(--fg)]">{t('heading')}</h2>
        <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-300">{t('body')}</p>

        <label className="mb-5 flex cursor-pointer items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
            className="h-3.5 w-3.5 cursor-pointer accent-emerald-600"
          />
          {t('remember_label')}
        </label>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={() => onChoose(false, remember)}
            className="rounded-md border border-[var(--border-subtle)] px-4 py-2 text-sm text-zinc-600 transition-colors hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            {t('hide')}
          </button>
          <button
            type="button"
            onClick={() => onChoose(true, remember)}
            className="rounded-md bg-emerald-600 px-4 py-2 text-sm text-white transition-colors hover:bg-emerald-700"
          >
            {t('show')}
          </button>
        </div>
      </div>
    </>
  );
}
