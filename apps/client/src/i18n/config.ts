const LOCALES = ['ja', 'en', 'zh', 'ko'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'ja';
export const LOCALE_COOKIE = 'NEXT_LOCALE';

export function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}

/**
 * 言語切替 UI 用の (locale, label) 一覧。LP / アカウント設定の両方で参照する。
 */
export const LOCALE_OPTIONS: ReadonlyArray<{ locale: Locale; label: string }> = [
  { locale: 'ja', label: '日本語' },
  { locale: 'en', label: 'English' },
  { locale: 'zh', label: '中文' },
  { locale: 'ko', label: '한국어' },
];
