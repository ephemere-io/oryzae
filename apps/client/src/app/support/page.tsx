import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Metadata } from 'next';
import { getLocale, getTranslations } from 'next-intl/server';
import { MarkdownPage } from '@/components/ui/markdown-page';
import { parseMarkdown } from '@/lib/markdown';

async function loadSupportMarkdown(locale: string): Promise<string> {
  // Resolve from the project root so the file is reachable both in dev
  // (running from apps/client) and in the standalone Next build output.
  const file = locale === 'en' ? 'support.en.md' : 'support.ja.md';
  const path = join(process.cwd(), 'src/content/support', file);
  return readFile(path, 'utf8');
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('support');
  return {
    title: t('title'),
  };
}

export default async function SupportPage() {
  const locale = await getLocale();
  const t = await getTranslations('support');
  const source = await loadSupportMarkdown(locale);
  const nodes = parseMarkdown(source);
  return <MarkdownPage nodes={nodes} homeLabel={t('back_home')} />;
}
