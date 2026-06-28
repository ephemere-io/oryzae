// verify-exempt: SSR 専用の JSON-LD <script> 出力で、対話的な DOM 契約・可変状態を持たない。

import { getLocale, getTranslations } from 'next-intl/server';
import { BRAND_NAME, SITE_URL } from '@/lib/brand';

interface FaqItem {
  question: string;
  answer: string;
}

interface LandingJsonLdInput {
  url: string;
  locale: string;
  description: string;
  faq: FaqItem[];
}

/**
 * ランディングの構造化データ（schema.org JSON-LD）を組み立てる純関数。
 * AEO/リッチリザルト向けに Organization / WebSite / WebApplication / FAQPage を出す。
 * React 非依存なので単体テストできる。
 */
export function buildLandingJsonLd(input: LandingJsonLdInput): Record<string, unknown> {
  const { url, locale, description, faq } = input;
  const orgId = 'https://ephemere.io/#org';
  const siteId = `${url}/#website`;

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': orgId,
        name: 'Ephemere',
        url: 'https://ephemere.io',
        sameAs: ['https://ephemere.io', 'https://github.com/ephemere-io'],
      },
      {
        '@type': 'WebSite',
        '@id': siteId,
        name: BRAND_NAME,
        url,
        inLanguage: locale,
        description,
        publisher: { '@id': orgId },
      },
      {
        '@type': 'WebApplication',
        name: BRAND_NAME,
        url,
        applicationCategory: 'LifestyleApplication',
        operatingSystem: 'Web',
        browserRequirements: 'Requires JavaScript.',
        inLanguage: ['ja', 'en', 'zh', 'ko'],
        description,
        publisher: { '@id': orgId },
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'JPY' },
      },
      {
        '@type': 'FAQPage',
        mainEntity: faq.map((item) => ({
          '@type': 'Question',
          name: item.question,
          acceptedAnswer: { '@type': 'Answer', text: item.answer },
        })),
      },
    ],
  };
}

/** ランディングに JSON-LD を SSR で埋め込むサーバーコンポーネント。 */
export async function LandingStructuredData() {
  const locale = await getLocale();
  const t = await getTranslations('landing');
  const faq: FaqItem[] = ['1', '2', '3', '4', '5'].map((n) => ({
    question: t(`faq.${n}.q`),
    answer: t(`faq.${n}.a`),
  }));
  const json = buildLandingJsonLd({
    url: SITE_URL,
    locale,
    description: t('hero.lead'),
    faq,
  });

  return (
    <script
      type="application/ld+json"
      // biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD 構造化データの標準的な埋め込み方法
      dangerouslySetInnerHTML={{ __html: JSON.stringify(json) }}
    />
  );
}
