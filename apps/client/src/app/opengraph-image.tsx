import { ImageResponse } from 'next/og';
import { BRAND_COLORS, BRAND_MARK_SVG, BRAND_NAME, BRAND_TAGLINE, svgDataUri } from '@/lib/brand';

// OGP 画像は SNS シェアで使われるため 1200x630。
// Twitter/X も summary_large_image カードで同じ画像を使うので twitter-image は別ファイル不要
// （Next.js が opengraph-image を fallback として採用する）。

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const alt = `${BRAND_NAME} — ${BRAND_TAGLINE}`;

export default function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: BRAND_COLORS.cream,
        padding: 80,
      }}
    >
      {/* biome-ignore lint/performance/noImgElement: ImageResponse uses raw <img> for Satori */}
      {/* biome-ignore lint/a11y/useAltText: decorative mark rendered via ImageResponse */}
      <img src={svgDataUri(BRAND_MARK_SVG)} width={260} height={260} />
      <div
        style={{
          marginTop: 32,
          fontSize: 112,
          fontWeight: 600,
          color: BRAND_COLORS.ink,
          letterSpacing: -2,
          lineHeight: 1,
        }}
      >
        {BRAND_NAME}
      </div>
      <div
        style={{
          marginTop: 24,
          fontSize: 32,
          color: BRAND_COLORS.outline,
          fontStyle: 'italic',
          letterSpacing: 0.5,
        }}
      >
        {BRAND_TAGLINE}
      </div>
    </div>,
    size,
  );
}
