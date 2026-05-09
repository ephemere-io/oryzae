import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { SupportPage } from '@/features/support/components/support-page';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('support.metadata');
  return {
    title: t('title'),
    description: t('description'),
  };
}

export default function Page() {
  return <SupportPage />;
}
