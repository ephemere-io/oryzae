/**
 * 公開サイト（別リポジトリ ephemere-io/oryzae-docs）への導線。
 *
 * ランディング・使い方（/support）・プライバシーポリシー（/privacy）はこのアプリではなく
 * 別ドメインにある。相対パスで書くとアプリ内で 404 になるため、外に出るリンクは必ず
 * ここを通して絶対 URL にする。
 */
export const DOCS_SITE_URL =
  process.env.NEXT_PUBLIC_DOCS_SITE_URL ?? 'https://docs.oryzae.ephemere.io';

/**
 * 公開サイトのパスを絶対 URL にする（`docsHref('/support')` → `https://.../support`）。
 *
 * `locale` を渡すと `?lang=` で言語を添える。公開サイトは別ドメインなのでアプリの言語
 * 設定（cookie）が届かず、ブラウザの `Accept-Language` の先頭で決まる — 英語の OS で
 * 日本語のアプリを使っている人が、ヘルプだけ英語で開く（実際にそう報告された）。
 * `?lang=` は公開サイト側で cookie に固定されるので、以後そのドメインでも同じ言語になる。
 * `#fragment` は query の後ろに置く。
 */
export function docsHref(path: string, locale?: string): string {
  if (!locale) return `${DOCS_SITE_URL}${path}`;
  const hash = path.indexOf('#');
  const base = hash === -1 ? path : path.slice(0, hash);
  const fragment = hash === -1 ? '' : path.slice(hash);
  const joiner = base.includes('?') ? '&' : '?';
  return `${DOCS_SITE_URL}${base}${joiner}lang=${encodeURIComponent(locale)}${fragment}`;
}
