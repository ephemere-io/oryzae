'use client';

import { useLocale } from 'next-intl';
import { useTransition } from 'react';
import { isLocale, LOCALE_OPTIONS } from '@/i18n/config';
import { setLocaleAction } from '@/lib/i18n-actions';

export function LocaleSwitcher() {
  const locale = useLocale();
  const [isPending, startTransition] = useTransition();

  function handleChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const next = event.target.value;
    if (!isLocale(next) || next === locale) return;
    startTransition(() => {
      setLocaleAction(next);
    });
  }

  return (
    <select
      value={locale}
      onChange={handleChange}
      disabled={isPending}
      aria-label="Language"
      className="bg-transparent text-xs text-zinc-500 hover:text-zinc-800 disabled:opacity-50 dark:hover:text-zinc-200"
    >
      {LOCALE_OPTIONS.map((option) => (
        <option key={option.locale} value={option.locale}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
