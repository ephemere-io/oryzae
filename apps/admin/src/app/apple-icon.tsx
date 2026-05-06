import { ImageResponse } from 'next/og';
import { APP_ICON_SVG, BRAND_COLORS, svgDataUri } from '@/lib/brand';

// Apple iOS のホーム画面用アイコンは PNG 必須なので、Satori 経由でラスタライズする。

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: BRAND_COLORS.cream,
      }}
    >
      {/* biome-ignore lint/performance/noImgElement: ImageResponse uses raw <img> for Satori */}
      {/* biome-ignore lint/a11y/useAltText: decorative icon rendered via ImageResponse */}
      <img src={svgDataUri(APP_ICON_SVG)} width={180} height={180} />
    </div>,
    size,
  );
}
