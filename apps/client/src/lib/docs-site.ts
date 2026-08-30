/**
 * 公開サイト（別リポジトリ ephemere-io/oryzae-docs）への導線。
 *
 * ランディング・使い方（/support）・プライバシーポリシー（/privacy）はこのアプリではなく
 * 別ドメインにある。相対パスで書くとアプリ内で 404 になるため、外に出るリンクは必ず
 * ここを通して絶対 URL にする。
 */
export const DOCS_SITE_URL =
  process.env.NEXT_PUBLIC_DOCS_SITE_URL ?? 'https://docs.oryzae.ephemere.io';

/** 公開サイトのパスを絶対 URL にする（`docsHref('/support')` → `https://.../support`）。 */
export function docsHref(path: string): string {
  return `${DOCS_SITE_URL}${path}`;
}
