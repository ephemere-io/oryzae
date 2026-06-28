import { ImageResponse } from 'next/og';
import { APP_ICON_SVG, BRAND_COLORS, svgDataUri } from '@/lib/brand';

/**
 * PWA マニフェスト用のアイコンを Satori でラスタライズする（Android は PNG を好む）。
 * SVG は brand.ts に集約。`_pwa` は `_` 始まりの private フォルダなのでルートにはならず、
 * icon-192 / icon-512 / icon-maskable の各 Route Handler から共有して使う。
 *
 * maskable は OS のマスクで四隅・周縁が削られるため、安全領域（中央 ~80%）に収まるよう
 * 内側に余白を取り、フルブリードのクリーム背景に重ねる。
 */
export function renderPwaIcon(size: number, maskable: boolean): ImageResponse {
  const inner = maskable ? Math.round(size * 0.78) : size;
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
      <img src={svgDataUri(APP_ICON_SVG)} width={inner} height={inner} />
    </div>,
    { width: size, height: size },
  );
}
