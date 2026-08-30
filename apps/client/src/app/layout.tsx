import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { headers } from 'next/headers';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages, getTranslations } from 'next-intl/server';
import { PostHogProvider } from '@/components/posthog-provider';
import { ServiceWorkerRegister } from '@/components/service-worker-register';
import { AuthProvider } from '@/lib/auth-context';
import { BRAND_NAME, SITE_URL } from '@/lib/brand';
import { type Device, isDevice } from '@/lib/device';
import { DeviceProvider } from '@/lib/use-device';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

// viewport-fit=cover を有効化し、env(safe-area-inset-*) を効かせる（iPhone の
// ホームインジケータ上にボトムナビを正しく載せるため）。SP シェルは 100dvh を使い、
// モバイルブラウザのツールバー出現でボトムナビが画面外に押し出されるのを防ぐ。
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  // スタンドアロン（PWA）時のステータスバー色をアプリの背景に合わせる。
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f9f8f4' },
    { media: '(prefers-color-scheme: dark)', color: '#1a1a1a' },
  ],
};

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('app.metadata');
  const locale = await getLocale();
  const description = t('description');
  return {
    metadataBase: new URL(SITE_URL),
    title: {
      default: BRAND_NAME,
      template: `%s — ${BRAND_NAME}`,
    },
    description,
    applicationName: BRAND_NAME,
    keywords: [
      'ジャーナリング',
      '日記',
      '問い',
      '内省',
      '振り返り',
      '発酵',
      'AI',
      'journaling',
      'reflection',
      'journal app',
    ],
    authors: [{ name: 'Ephemere', url: 'https://ephemere.io' }],
    creator: 'Ephemere',
    publisher: 'Ephemere',
    category: 'productivity',
    formatDetection: { telephone: false, email: false, address: false },
    // このアプリは全ページ noindex（middleware の X-Robots-Tag と robots.txt で二重担保）。
    // canonical は PWA / OGP プレビュー用に自ドメインを指すだけで、インデックス目的ではない。
    alternates: { canonical: '/' },
    // PWA: manifest（app/manifest.ts）と iOS スタンドアロン設定。
    manifest: '/manifest.webmanifest',
    appleWebApp: {
      capable: true,
      title: BRAND_NAME,
      statusBarStyle: 'default',
    },
    other: {
      // Android Chrome の全画面スタンドアロン用（apple-* は appleWebApp が付与する）。
      'mobile-web-app-capable': 'yes',
    },
    // icons / opengraph-image / apple-icon は app/ 配下のファイル規約で自動付与される。
    openGraph: {
      type: 'website',
      siteName: BRAND_NAME,
      title: BRAND_NAME,
      description,
      url: '/',
      locale,
    },
    twitter: {
      card: 'summary_large_image',
      title: BRAND_NAME,
      description,
    },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const messages = await getMessages();
  // middleware が解決した端末（device-pref ?? UA）。初回訪問でも SSR で端末別に描画できる。
  const xDevice = (await headers()).get('x-device');
  const device: Device = isDevice(xDevice) ? xDevice : 'pc';

  return (
    <html
      lang={locale}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Noto+Serif+JP:wght@200..900&family=Noto+Sans+JP:wght@200..900&family=Inter:wght@300;400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-full flex flex-col bg-[var(--bg)] text-[var(--fg)]">
        <NextIntlClientProvider locale={locale} messages={messages}>
          <PostHogProvider>
            <AuthProvider>
              <DeviceProvider initialDevice={device}>{children}</DeviceProvider>
            </AuthProvider>
          </PostHogProvider>
        </NextIntlClientProvider>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
