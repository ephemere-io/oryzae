import { cookies, headers } from 'next/headers';
import { getRequestConfig } from 'next-intl/server';
import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE, type Locale } from './config';

function detectFromAcceptLanguage(header: string | null): Locale | null {
  if (!header) return null;
  // Parse "en-US,en;q=0.9,ja;q=0.8" — first matching locale wins
  for (const part of header.split(',')) {
    const code = part.trim().toLowerCase().split(/[-;]/)[0];
    if (isLocale(code)) return code;
  }
  return null;
}

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const cookieValue = cookieStore.get(LOCALE_COOKIE)?.value;

  let locale: Locale;
  if (cookieValue && isLocale(cookieValue)) {
    locale = cookieValue;
  } else {
    const headerList = await headers();
    locale = detectFromAcceptLanguage(headerList.get('accept-language')) ?? DEFAULT_LOCALE;
  }

  return {
    locale,
    messages: (await import(`./messages/${locale}.json`)).default,
  };
});
