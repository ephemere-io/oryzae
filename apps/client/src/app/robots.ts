import type { MetadataRoute } from 'next';

/**
 * robots.txt（Next の app/ 規約で `/robots.txt` を生成）。
 *
 * このアプリは全ページが認証・保護下（`/` すら公開サイトへ送るだけのゲート）なので、
 * クロールを全面的に拒否する。インデックスさせたい公開ページは別リポジトリの
 * 公開サイト（ephemere-io/oryzae-docs）が持ち、sitemap もそちらが出す。
 * 実際の noindex は middleware の X-Robots-Tag でも二重に担保する。
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      disallow: '/',
    },
  };
}
