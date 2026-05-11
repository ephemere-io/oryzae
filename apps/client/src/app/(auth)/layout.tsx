import { DesktopOnlyOverlay } from '@/components/desktop-only-overlay';
import { LocaleSwitcher } from '@/components/ui/locale-switcher';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-2 flex justify-end">
          <LocaleSwitcher />
        </div>
        {children}
      </div>
      {/* スマホ専用画面が用意できるまでの暫定処置 (Issue #299) — 認証フローはスマホ非対応 */}
      <DesktopOnlyOverlay />
    </div>
  );
}
