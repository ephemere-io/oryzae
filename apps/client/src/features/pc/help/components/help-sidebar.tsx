'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useLocale } from 'next-intl';
import { useCallback, useEffect } from 'react';
import { SHELL_INSET, SIDE_PANEL_WIDTH } from '@/components/ui/surface';
import { HelpPanel } from '@/features/shared/help/components/help-panel';
import { useHelpMode } from '@/features/shared/help/help-context';
import { useHelpResolver } from '@/features/shared/help/hooks/use-help-resolver';
import { useHelpTexts } from '@/features/shared/help/hooks/use-help-texts';
import { topicForScreen } from '@/features/shared/help/topics';
import { useAuth } from '@/lib/auth-context';
import { docsHref } from '@/lib/docs-site';

/** 面が占めている幅を配る CSS 変数（`globals.css` に既定 0 がある）。 */
const HELP_WIDTH_VAR = '--help-width';

/**
 * PC のヘルプの面。画面の右から出る（`docs/help-mode-guide.md`）。
 *
 * 発酵の面と同じ幅（`SIDE_PANEL_WIDTH`）・同じ地（沈んだ面）・同じ縁 1 本。シェルの
 * `<main>` の**隣**に置くので、開くと本文が右から詰まり、面が本文に被らない。
 * 中身（`HelpPanel`）は SP のシートと共有し、ここは枠と配線だけ。
 *
 * **画面の右端に貼りつく fixed の層は流れを見ない**（エディタ・「書斎へ戻る」のタブ・
 * 問いの変遷）。それらには `--help-width` で幅を伝える（`.sidebar-anchored` が右端に、
 * `CONTENT_CENTERED_STYLE` が中央の補正に使う）。左のサイドバーが `--sidebar-width` を
 * 配るのと同じ作り。
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

  // 開閉を :root へ。SP にはこの面が無いので、SP では常に 0 のまま。
  useEffect(() => {
    document.documentElement.style.setProperty(
      HELP_WIDTH_VAR,
      help.open ? `${SIDE_PANEL_WIDTH}px` : '0px',
    );
    return () => {
      document.documentElement.style.setProperty(HELP_WIDTH_VAR, '0px');
    };
  }, [help.open]);

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
