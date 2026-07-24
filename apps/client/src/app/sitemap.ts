import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/brand';

/**
 * sitemap.xml（Next の app/ 規約で `/sitemap.xml` を生成）。
 * インデックス対象は公開ページのみ（保護下・認証は noindex のため載せない）。
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return [
    { url: `${SITE_URL}/`, lastModified, changeFrequency: 'weekly', priority: 1 },
    { url: `${SITE_URL}/support`, lastModified, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${SITE_URL}/privacy`, lastModified, changeFrequency: 'yearly', priority: 0.3 },
  ];
}
