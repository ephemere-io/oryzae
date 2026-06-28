import type { Metadata } from 'next';
import { LocaleSwitcher } from '@/components/ui/locale-switcher';

// 認証系ページはインデックスさせない（middleware の X-Robots-Tag と二重担保）。
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-2 flex justify-end">
          <LocaleSwitcher />
        </div>
        {children}
      </div>
      {/* SP 対応により認証フローはスマホでもアクセス可能（DesktopOnlyOverlay を撤去, Issue #363） */}
    </div>
  );
}
