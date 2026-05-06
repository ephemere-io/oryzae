import type { Metadata } from 'next';
import { BRAND_NAME } from '@/lib/brand';
import './globals.css';

export const metadata: Metadata = {
  // icons / apple-icon は app/ 配下のファイル規約で自動付与される。
  // admin は社内向けなので OGP は設定しない（クロール対象外）。
  title: {
    default: BRAND_NAME,
    template: `%s — ${BRAND_NAME}`,
  },
  description: 'Oryzae 管理画面',
  applicationName: BRAND_NAME,
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" className="h-full antialiased" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <script src="/theme-init.js" />
      </head>
      <body className="min-h-full bg-background text-foreground">{children}</body>
    </html>
  );
}
