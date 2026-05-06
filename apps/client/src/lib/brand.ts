/**
 * Oryzae ブランド定数。LP（ランディングページ）と同じ正式ロゴ・配色を共有する。
 * - SVG ロゴ: `apps/client/public/landing/logo/` の P3_appicon_cream / P3_mark_color に対応
 * - 用途: ファビコン、Apple touch icon、OGP 画像、メタデータ
 */

export const BRAND_NAME = 'Oryzae';
export const BRAND_TAGLINE = 'Aspergillus oryzae for words.';

export const BRAND_COLORS = {
  cream: '#F2EDE0',
  ink: '#5C4F3F',
  outline: '#7A7440',
  microbe: '#9C9658',
} as const;

/**
 * 公開ドメイン。OGP の絶対 URL 解決に使う。
 * 環境変数で上書きできるが、未設定時は本番ドメインにフォールバックする。
 */
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://oryzae.ephemere.io';

/**
 * appicon SVG の文字列表現。Satori（next/og）に <img src="data:..."> で渡して使う。
 * cream 背景 + 米麹を醸す壺のシンボル。LP の P3_appicon_cream.svg と同一。
 */
export const APP_ICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
<rect width="200" height="200" rx="44" fill="#F2EDE0"/>
<path d="M 86 36 L 86 78 C 86 88, 50 100, 42 138 C 36 172, 64 196, 100 196 C 136 196, 164 172, 158 138 C 150 100, 114 88, 114 78 L 114 36 Z" fill="#F2EDE0"/>
<path d="M 86 36 L 86 78 C 86 88, 50 100, 42 138 C 36 172, 64 196, 100 196 C 136 196, 164 172, 158 138 C 150 100, 114 88, 114 78 L 114 36 Z" fill="none" stroke="#7A7440" stroke-width="3.5"/>
<ellipse cx="100" cy="36" rx="14" ry="3.5" fill="none" stroke="#7A7440" stroke-width="3.5"/>
<g fill="#9C9658">
<circle cx="100" cy="96" r="9.5"/>
<circle cx="100" cy="118" r="7.5"/>
<circle cx="100" cy="138" r="5.5"/>
<circle cx="78" cy="108" r="7.5"/>
<circle cx="78" cy="128" r="6"/>
<circle cx="122" cy="108" r="7.5"/>
<circle cx="122" cy="128" r="6"/>
</g>
<g fill="#7A7440">
<ellipse cx="86" cy="160" rx="3.5" ry="9"/>
<ellipse cx="100" cy="162" rx="3.5" ry="10"/>
<ellipse cx="114" cy="160" rx="3.5" ry="9"/>
</g>
</svg>`;

/**
 * mark_color SVG: 背景なしのシンボル単体。OGP 画像など独自背景の上に重ねる場面で使う。
 */
export const BRAND_MARK_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
<path d="M 86 36 L 86 78 C 86 88, 50 100, 42 138 C 36 172, 64 196, 100 196 C 136 196, 164 172, 158 138 C 150 100, 114 88, 114 78 L 114 36 Z" fill="#F2EDE0"/>
<path d="M 86 36 L 86 78 C 86 88, 50 100, 42 138 C 36 172, 64 196, 100 196 C 136 196, 164 172, 158 138 C 150 100, 114 88, 114 78 L 114 36 Z" fill="none" stroke="#7A7440" stroke-width="3.5"/>
<ellipse cx="100" cy="36" rx="14" ry="3.5" fill="none" stroke="#7A7440" stroke-width="3.5"/>
<g fill="#9C9658">
<circle cx="100" cy="96" r="9.5"/>
<circle cx="100" cy="118" r="7.5"/>
<circle cx="100" cy="138" r="5.5"/>
<circle cx="78" cy="108" r="7.5"/>
<circle cx="78" cy="128" r="6"/>
<circle cx="122" cy="108" r="7.5"/>
<circle cx="122" cy="128" r="6"/>
</g>
<g fill="#7A7440">
<ellipse cx="86" cy="160" rx="3.5" ry="9"/>
<ellipse cx="100" cy="162" rx="3.5" ry="10"/>
<ellipse cx="114" cy="160" rx="3.5" ry="9"/>
</g>
</svg>`;

/** SVG を data URI にエンコードする。next/og の <img src> に渡せる形式。 */
export function svgDataUri(svg: string): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
