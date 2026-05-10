import type { Metadata } from 'next';
import { getLocale } from 'next-intl/server';
import { SupportPage } from '@/features/support/components/support-page';
import { loadSupportContent } from '@/features/support/lib/load-content';
import type { Locale } from '@/i18n/config';

export async function generateMetadata(): Promise<Metadata> {
  const locale = (await getLocale()) as Locale;
  const content = loadSupportContent(locale);
  return {
    title: content['metadata.title'],
    description: content['metadata.description'],
  };
}

export default async function Page() {
  const locale = (await getLocale()) as Locale;
  const content = loadSupportContent(locale);
  return <SupportPage content={content} />;
}
