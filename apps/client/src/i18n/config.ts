export const LOCALES = ['ja', 'en'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'ja';
export const LOCALE_COOKIE = 'NEXT_LOCALE';

export function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}
