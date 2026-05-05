import { NextIntlClientProvider } from 'next-intl';
import jaMessages from '@/i18n/messages/ja.json';

export function I18nWrapper({ children }: { children: React.ReactNode }) {
  return (
    <NextIntlClientProvider locale="ja" messages={jaMessages}>
      {children}
    </NextIntlClientProvider>
  );
}
