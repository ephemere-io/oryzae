import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import { LegalPage } from '@/features/legal/components/legal-page';
import { parseMarkdown } from '@/features/legal/lib/markdown';

async function loadPrivacyMarkdown(locale: string): Promise<string> {
  // Resolve from the project root so the file is reachable both in dev
  // (running from apps/client) and in the standalone Next build output.
  const file = locale === 'en' ? 'privacy.en.md' : 'privacy.ja.md';
  const path = join(process.cwd(), 'src/content/legal', file);
  return readFile(path, 'utf8');
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('legal.privacy');
  return {
    title: t('title'),
  };
}

export default async function PrivacyPolicyPage() {
  const locale = await getLocale();
  const t = await getTranslations('legal.privacy');
  const source = await loadPrivacyMarkdown(locale);
  const nodes = parseMarkdown(source);
  return <LegalPage nodes={nodes} homeLabel={t('back_home')} />;
}
