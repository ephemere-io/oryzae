import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/brand';

/**
 * robots.txt（Next の app/ 規約で `/robots.txt` を生成）。
 * 公開ページ（/・/privacy・/support）はクロール許可、認証/保護下・API・計測系は不許可。
 * 実際の noindex は middleware の X-Robots-Tag でも二重に担保する。
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/login',
        '/signup',
        '/forgot-password',
        '/reset-password',
        '/callback',
        '/auth/',
        '/account',
        '/board',
        '/entries',
        '/jar',
        '/questions',
        '/verify',
        '/api/',
        '/ingest/',
        '/monitoring',
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
