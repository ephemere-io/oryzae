import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages, getTranslations } from 'next-intl/server';
import { PostHogProvider } from '@/components/posthog-provider';
import { BRAND_NAME, SITE_URL } from '@/lib/brand';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

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
          <PostHogProvider>{children}</PostHogProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
