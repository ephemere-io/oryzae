import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Oryzae Admin',
  description: 'Oryzae 管理画面',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" className="h-full antialiased">
      <body className="min-h-full bg-background text-foreground">{children}</body>
    </html>
  );
}
