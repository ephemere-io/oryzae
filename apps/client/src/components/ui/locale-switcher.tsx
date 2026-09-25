'use client';

import { useLocale } from 'next-intl';
import { useTransition } from 'react';
import { isLocale, LOCALE_OPTIONS } from '@/i18n/config';
import { setLocaleAction } from '@/lib/i18n-actions';
import { CONTROL_FONT, ICON_STROKE_WIDTH } from './surface';

/**
 * 言語の切り替え。書斎に浮かぶアバターと同じ擦りガラスの小さなピル。
 *
 * **中身はブラウザの `<select>` のまま。** SP では OS の選択シートが開くほうが
 * 自前のメニューより確実に押せる。見た目だけをピルに包み、矢印は外に描く。
 */
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
    <div
      className="relative flex h-9 items-center rounded-full text-[#5c4f3f] transition-opacity hover:opacity-80"
      style={{ ...GLASS, ...CONTROL_FONT }}
    >
      <svg
        aria-hidden="true"
        className="pointer-events-none absolute left-3"
        width={14}
        height={14}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={ICON_STROKE_WIDTH}
        strokeLinecap="round"
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z" />
      </svg>
      <select
        value={locale}
        onChange={handleChange}
        disabled={isPending}
        aria-label="Language"
        className="h-full cursor-pointer appearance-none rounded-full bg-transparent pr-8 pl-8 text-[12px] outline-none focus-visible:ring-2 focus-visible:ring-[rgba(122,116,64,0.3)] disabled:opacity-50"
      >
        {LOCALE_OPTIONS.map((option) => (
          <option key={option.locale} value={option.locale}>
            {option.label}
          </option>
        ))}
      </select>
      <svg
        aria-hidden="true"
        className="pointer-events-none absolute right-3"
        width={10}
        height={10}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M6 9l6 6 6-6" />
      </svg>
    </div>
  );
}

/** 書斎のアバター（`study-chrome.tsx`）と同じ擦りガラス。 */
const GLASS: React.CSSProperties = {
  background: 'rgba(253, 251, 247, 0.72)',
  backdropFilter: 'blur(10px)',
  WebkitBackdropFilter: 'blur(10px)',
  border: '1px solid rgba(122, 116, 64, 0.18)',
  boxShadow: '0 2px 12px rgba(140, 133, 126, 0.14)',
};
