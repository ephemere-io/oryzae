import type { MetadataRoute } from 'next';
import { BRAND_NAME } from '@/lib/brand';

/**
 * Web App Manifest（Next の app/ ファイル規約。`/manifest.webmanifest` として配信される）。
 * ホーム追加で全画面スタンドアロン表示にし、Android Chrome でもインストール可能にする。
 * アイコンは next/og で生成する PNG（icon-192 / icon-512 / icon-maskable）＋ファビコン SVG。
 * background_color はアイコン背景と同じクリームにし、起動スプラッシュを継ぎ目なく見せる。
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: BRAND_NAME,
    short_name: BRAND_NAME,
    description: 'ジャーナリング支援アプリ',
    lang: 'ja',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#F2EDE0',
    theme_color: '#F2EDE0',
    icons: [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' },
      { src: '/icon-192', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon-maskable', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
