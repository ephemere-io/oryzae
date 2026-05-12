'use client';

import * as Sentry from '@sentry/nextjs';
import { NextIntlClientProvider, useTranslations } from 'next-intl';
import { useEffect } from 'react';
import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE, type Locale } from '@/i18n/config';
import enMessages from '@/i18n/messages/en.json';
import jaMessages from '@/i18n/messages/ja.json';
import koMessages from '@/i18n/messages/ko.json';
import zhMessages from '@/i18n/messages/zh.json';

const MESSAGES: Record<Locale, typeof jaMessages> = {
  ja: jaMessages,
  en: enMessages,
  zh: zhMessages,
  ko: koMessages,
};

function readLocaleFromCookie(): Locale {
  if (typeof document === 'undefined') return DEFAULT_LOCALE;
  const match = document.cookie.split('; ').find((row) => row.startsWith(`${LOCALE_COOKIE}=`));
  if (!match) return DEFAULT_LOCALE;
  const value = decodeURIComponent(match.split('=')[1] ?? '');
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

function GlobalErrorContent({ reset }: { reset: () => void }) {
  const t = useTranslations('app.global_error');
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        gap: '1rem',
      }}
    >
      <h2>{t('heading')}</h2>
      <button type="button" onClick={() => reset()}>
        {t('retry')}
      </button>
    </div>
  );
}

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  const locale = readLocaleFromCookie();
  const messages = MESSAGES[locale];

  return (
    <html lang={locale}>
      <body>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <GlobalErrorContent reset={reset} />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
