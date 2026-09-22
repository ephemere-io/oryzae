'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useCallback, useEffect, useRef } from 'react';
import { SHELL_INSET } from '@/components/ui/surface';
import { HelpPanel } from '@/features/shared/help/components/help-panel';
import { clampHelpWidth, HELP_WIDTH, useHelpMode } from '@/features/shared/help/help-context';
import { useHelpResolver } from '@/features/shared/help/hooks/use-help-resolver';
import { useHelpTexts } from '@/features/shared/help/hooks/use-help-texts';
import { topicForScreen } from '@/features/shared/help/topics';
import { useAuth } from '@/lib/auth-context';
import { docsHref } from '@/lib/docs-site';

/** 面が占めている幅を配る CSS 変数（`globals.css` に既定 0 がある）。 */
const HELP_WIDTH_VAR = '--help-width';

function applyHelpWidth(width: number): void {
  document.documentElement.style.setProperty(HELP_WIDTH_VAR, `${width}px`);
}

/**
 * PC のヘルプの面。画面の右から出る（`docs/help-mode-guide.md`）。
 *
 * 既定の幅は発酵の面と同じ（`SIDE_PANEL_WIDTH`）、縁 1 本も同じ。地は沈んだ面ではなく
 * **紙（`--bg`）**。読む面なので紙にし、生きている 1 枚と三歩の番号にだけ色を持たせる
 * （沈んだ灰の地は「まぁいいけど」と言われた）。
 * シェルの `<main>` の**隣**に置くので、開くと本文が右から詰まり、面が本文に被らない。
 * 中身（`HelpPanel`）は SP のシートと共有し、ここは枠・幅・配線だけ。
 *
 * ## 幅は掴んで変えられる
 *
 * 左の縁を掴んで引く（shadcn の Sidebar に rail を足したのと同じ形）。範囲は
 * `HELP_WIDTH`（280–560）。掴んでいる間は `--help-width` を直接書き、右端に貼りつく
 * fixed の層（エディタ等）が追従する遅れ（160ms の transition）も切る
 * （`html[data-help-resizing]`）— 左のサイドバーで「本文が指に遅れて付いてくる」と
 * 言われたのはこの遅れのせいだった。離したら憶える。2 度押しで既定の幅に戻る。
 *
 * ## 出入り
 *
 * 面は有効な間ずっと DOM に居て、**幅が 0 ⇄ 面の幅** で遷移する（`help-aside`、左の
 * サイドバーと同じ 160ms の曲線）。本文はそのぶん詰まり、fixed の層は `--help-width` の
 * 遷移で同じ速さで付いてくる。閉じている間は `inert`（読み上げにも Tab にも掛からない）。
 * 中身は面の幅で固定しておき、幅が動いている最中に字が折り返し直さないようにする。
 *
 * **画面の右端に貼りつく fixed の層は流れを見ない**（エディタ・「書斎へ戻る」のタブ・
 * 問いの変遷・「?」）。それらには `--help-width` で幅を伝える。左のサイドバーが
 * `--sidebar-width` を配るのと同じ作り。
 */
// verify-exempt: ヘルプの context・router・API 依存の配線。面の中身は HelpPanel が孤立検証に乗る
export function HelpSidebar() {
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
    label: help.hoverTarget?.label ?? null,
    labelFallback: help.hoverTarget?.topic ?? null,
  });

  const visible = help.enabled && help.open;

  // 開閉と幅を :root へ。SP にはこの面が無いので、SP では常に 0 のまま。
  useEffect(() => {
    applyHelpWidth(visible ? help.width : 0);
    return () => applyHelpWidth(0);
  }, [visible, help.width]);

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

  // 掴んで引く。離すまでの幅は ref に持ち、離したときだけ state（と localStorage）へ。
  const dragWidth = useRef<number | null>(null);
  const asideRef = useRef<HTMLElement | null>(null);
  const handlePointerDown = useCallback((event: React.PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    document.documentElement.setAttribute('data-help-resizing', '');
    dragWidth.current = null;
  }, []);
  const handlePointerMove = useCallback((event: React.PointerEvent<HTMLButtonElement>) => {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
    const next = clampHelpWidth(window.innerWidth - event.clientX);
    dragWidth.current = next;
    applyHelpWidth(next);
    // 面の幅は state を待たずに直接書く（指に遅れない）。
    asideRef.current?.style.setProperty('width', `${next}px`);
  }, []);
  const handlePointerUp = useCallback(
    (event: React.PointerEvent<HTMLButtonElement>) => {
      if (!event.currentTarget.hasPointerCapture(event.pointerId)) return;
      event.currentTarget.releasePointerCapture(event.pointerId);
      document.documentElement.removeAttribute('data-help-resizing');
      if (dragWidth.current !== null) help.setWidth(dragWidth.current);
      dragWidth.current = null;
    },
    [help],
  );

  if (!help.enabled) return null;

  return (
    <aside
      ref={asideRef}
      aria-label={t('toggle')}
      aria-hidden={!visible}
      inert={!visible}
      className="help-aside relative flex h-full shrink-0 flex-col overflow-hidden"
      style={{
        width: visible ? help.width : 0,
        paddingTop: SHELL_INSET,
        borderLeft: `${visible ? 1 : 0}px solid var(--surface-sunken-border)`,
        // 紙の上に紙が重なる。縁の線 1 本に、左へ落ちるごく薄い影を添える（左のサイドバーと対）。
        boxShadow: visible ? '-1px 0 6px rgba(0, 0, 0, 0.03)' : 'none',
        background: 'var(--bg)',
      }}
    >
      {/* 縁の掴み手。面は overflow-hidden なので、縁をまたいで置くには fixed で面の外へ出す
          （DOM 上は面の子のまま）。当たりは縁の左右 7px ずつ（合わせて 14px）。掴み手そのものは見えず、触れたとき・
          掴んでいる間だけ縁に細い線が乗る（地を沈める版は 6px の太い線に見えた）。 */}
      {visible && (
        <button
          type="button"
          aria-label={t('resize')}
          title={t('resize')}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onDoubleClick={() => help.setWidth(HELP_WIDTH.default)}
          className="group fixed inset-y-0 z-[56] w-[14px] cursor-col-resize"
          style={{ right: 'calc(var(--help-width, 0px) - 7px)' }}
        >
          <span
            aria-hidden="true"
            className="help-resize-line absolute inset-y-0 left-[6px] w-[2px] opacity-0 transition-opacity duration-150 group-hover:opacity-100"
            style={{ background: 'color-mix(in srgb, var(--accent) 55%, transparent)' }}
          />
        </button>
      )}
      {/* 中身は面の幅で固定。幅が動いている最中に字が折り返し直さない。 */}
      <div className="flex min-h-0 flex-1 flex-col" style={{ width: help.width }}>
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
          onClose={help.closeHelp}
          onOpenHref={handleOpenHref}
          spotlight={help.welcome}
        />
      </div>
    </aside>
  );
}
