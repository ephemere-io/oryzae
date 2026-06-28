import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { HomeGate } from '@/features/landing/components/home-gate';
import { LandingPage } from '@/features/landing/components/landing-page';
import { LandingStructuredData } from '@/features/landing/components/landing-structured-data';
import { BRAND_NAME } from '@/lib/brand';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('landing');
  const title = `${BRAND_NAME} — ${t('hero.title.l1')}${t('hero.title.l2')}`;
  const description = t('hero.lead');
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: '/' },
    openGraph: { title, description, url: '/' },
    twitter: { title, description },
  };
}

/**
 * ルート（/）= ランディング。本文は SSR で常に描画する（SEO/AEO のため）。
 * メール確認リダイレクトと既ログイン者の振り分けはクライアントの HomeGate が担い、
 * 構造化データ（JSON-LD）は LandingStructuredData が SSR で埋め込む。
 */
export default function HomePage() {
  return (
    <>
      <HomeGate />
      <LandingStructuredData />
      <LandingPage />
    </>
  );
}
