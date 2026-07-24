import { renderPwaIcon } from '@/app/_pwa/render-icon';

// ImageResponse が content-type: image/png を自動付与する。
export function GET() {
  return renderPwaIcon(512, false);
}
