'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { useCallback } from 'react';
import { SHELL_INSET, SIDE_PANEL_WIDTH } from '@/components/ui/surface';
import { HelpPanel } from '@/features/shared/help/components/help-panel';
import { useHelpMode } from '@/features/shared/help/help-context';
import { useHelpResolver } from '@/features/shared/help/hooks/use-help-resolver';
import { useHelpTexts } from '@/features/shared/help/hooks/use-help-texts';
import { topicForScreen } from '@/features/shared/help/topics';
import { useAuth } from '@/lib/auth-context';
import { docsHref } from '@/lib/docs-site';

/**
 * PC のヘルプの面。画面の右から出る（`docs/help-mode-guide.md`）。
 *
 * 発酵の面と同じ幅（`SIDE_PANEL_WIDTH`）・同じ地（沈んだ面）・同じ縁 1 本。シェルの
 * `<main>` の**隣**に置くので、開くと本文が右から詰まり、面が本文に被らない。
 * 中身（`HelpPanel`）は SP のシートと共有し、ここは枠と配線だけ。
 */
// verify-exempt: ヘルプの context・router・API 依存の配線。面の中身は HelpPanel が孤立検証に乗る
export function HelpSidebar() {
  const help = useHelpMode();
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
    label: help.hoverTarget?.label ?? null,
    labelFallback: help.hoverTarget?.topic ?? null,
  });

  const handleOpenHref = useCallback(
    (href: string, external: boolean) => {
      if (external) {
        window.open(docsHref(href, locale), '_blank', 'noopener,noreferrer');
        return;
      }
      router.push(href);
    },
    [router, locale],
  );

  if (!help.open) return null;

  return (
    <aside
      aria-label="help"
      className="relative flex h-full shrink-0 flex-col overflow-hidden border-l"
      style={{
        width: SIDE_PANEL_WIDTH,
        paddingTop: SHELL_INSET,
        borderColor: 'var(--surface-sunken-border)',
        background: 'var(--surface-sunken)',
      }}
    >
      <HelpPanel
        texts={texts}
        hovered={resolution.labelTopic ?? help.hoverTarget?.topic ?? null}
        screenTopic={topicForScreen(pathname)}
        focused={help.focused}
        onFocus={help.setFocused}
        query={help.query}
        onQueryChange={help.setQuery}
        matches={resolution.matches}
        remote={resolution.remote}
        firstVisit={help.firstVisit}
        shortcutHint
        onClose={help.closeHelp}
        onOpenHref={handleOpenHref}
      />
    </aside>
  );
}
