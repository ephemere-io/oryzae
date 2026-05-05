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
    </div>
  );
}
