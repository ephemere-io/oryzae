'use client';

import { useLocale } from 'next-intl';
import { useTransition } from 'react';
import { setLocaleAction } from '@/lib/i18n-actions';

export function LocaleSwitcher() {
  const locale = useLocale();
  const [isPending, startTransition] = useTransition();

  function toggle() {
    const next = locale === 'ja' ? 'en' : 'ja';
    startTransition(() => {
      setLocaleAction(next);
    });
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={isPending}
      className="text-xs text-zinc-500 hover:text-zinc-800 disabled:opacity-50 dark:hover:text-zinc-200"
      aria-label="Toggle language"
    >
      {locale === 'ja' ? 'EN' : 'JA'}
    </button>
  );
}
