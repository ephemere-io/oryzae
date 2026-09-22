'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useCallback } from 'react';
import { HelpPanel } from '@/features/shared/help/components/help-panel';
import { useHelpMode } from '@/features/shared/help/help-context';
import { useHelpResolver } from '@/features/shared/help/hooks/use-help-resolver';
import { useHelpTexts } from '@/features/shared/help/hooks/use-help-texts';
import { topicForScreen } from '@/features/shared/help/topics';
import { useAuth } from '@/lib/auth-context';
import { docsHref } from '@/lib/docs-site';

/**
 * SP のヘルプ。下から出るシート（他の SP のシートと同じ作法）。
 *
 * SP にはホバーが無いので、頭の 1 枚は「いま開いている画面」を映す。行き先を開いたら
 * シートは閉じる（画面が変わったのにシートが被ったままだと、移ったことが見えない）。
 */
// verify-exempt: ヘルプの context・router・API 依存の配線。面の中身は HelpPanel が孤立検証に乗る
export function SpHelpSheet() {
  const help = useHelpMode();
  const t = useTranslations('help');
  const pathname = usePathname();
  const locale = useLocale();
  const router = useRouter();
  const { api } = useAuth();
  const texts = useHelpTexts();
  const resolution = useHelpResolver(api, {
    locale,
    screen: pathname,
    texts,
    query: help.query,
    label: null,
    labelFallback: null,
  });

  const handleOpenHref = useCallback(
    (href: string, external: boolean) => {
      if (external) {
        window.open(docsHref(href, locale), '_blank', 'noopener,noreferrer');
        return;
      }
      help.closeHelp();
      router.push(href);
    },
    [router, locale, help],
  );

  if (!help.enabled || !help.open) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <button
        type="button"
        aria-label={t('close')}
        onClick={help.closeHelp}
        className="sp-fade flex-1 bg-black/30"
      />
      <div
        className="sp-sheet flex flex-col rounded-t-2xl pt-4 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_rgba(0,0,0,0.15)]"
        style={{ background: 'var(--bg)', height: '82dvh' }}
      >
        <HelpPanel
          texts={texts}
          hovered={null}
          screenTopic={topicForScreen(pathname)}
          focused={help.focused}
          onFocus={help.setFocused}
          query={help.query}
          onQueryChange={help.setQuery}
          matches={resolution.matches}
          remote={resolution.remote}
          onClose={help.closeHelp}
          onOpenHref={handleOpenHref}
        />
      </div>
    </div>
  );
}
