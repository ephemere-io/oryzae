'use client';

// verify-exempt: 殻。router とビジュアルビューポートに依存し、孤立描画では中身が無い。

import { usePathname } from 'next/navigation';
import { type ReactNode, useEffect } from 'react';
import { useSpChrome } from '@/lib/sp-chrome-context';
import { SpBottomNav } from './sp-bottom-nav';
import { SpTopBar } from './sp-top-bar';

interface SpShellProps {
  /** 上段（戻る・状態・設定）を出すか。書斎ホームでは出さない。 */
  topBar: boolean;
  /** 旧ボトムナビ（書斎が無効な間だけ）。 */
  bottomNav: boolean;
  children: ReactNode;
}

/**
 * SP の殻。上段・本文・下端の操作の列（パレット）を縦に並べる。
 *
 * **殻はビジュアルビューポートに追従する**（`useVisualViewport`）。iOS でキーボードが出ると
 * 殻の高さがその分縮み、下端の列がキーボードの真上に来る。`fixed` も `bottom: keyboard` も
 * 使わない。測れるまで（SSR・初回）は `100dvh`。
 *
 * 下端の列は画面の側が `paletteSlot` へ portal で差し込む（`useSpChrome().paletteSlot`）。
 * 殻は席を用意するだけで、中身は知らない。
 */
export function SpShell({ topBar, bottomNav, children }: SpShellProps) {
  const { viewport, setPaletteSlot, setOverlaySlot, setDockSlot } = useSpChrome();
  const pathname = usePathname();

  // iOS Safari は touchstart の listener が 1 つも無いと `:active` を出さない。
  // 押した印（globals.css の `@media (hover: none)`）を起こすためだけの空の listener。
  useEffect(() => {
    const noop = () => {};
    document.addEventListener('touchstart', noop, { passive: true });
    return () => document.removeEventListener('touchstart', noop);
  }, []);

  return (
    <div
      className={`flex flex-col overflow-hidden bg-[var(--bg)] ${viewport ? 'fixed inset-x-0' : 'h-[100dvh]'}`}
      style={viewport ? { top: viewport.top, height: viewport.height } : undefined}
    >
      {topBar && <SpTopBar />}
      {/* 本文と、本文の上に重なる非モーダルのシート（発酵の結果・設定）の層。同じ箱なので、シートは
          下端の操作の列を覆わない。シートが止まった段の高さは `--sp-dock-inset` で本文の余白になる。 */}
      <div className="relative flex min-h-0 flex-1 flex-col">
        <main
          // 画面が入れ替わったら短く現れる（220ms・ease-out、reduce 設定では無効）。押してから
          // 次の画面が「置かれた」ことを目で追えるようにする。鍵は path（同じ画面の再描画では動かない）。
          key={pathname}
          // isolate: 本文の重なりをここで閉じる。**画面が重ねる層（瓶の上の問いの一覧など）が、殻のドック・
          // シート・下端の列より上に来ないように。** 以前は `sp-rise` の動きがたまたま重なりの文脈を作っていて、
          // 動きを止める設定や動き終わりの扱いが違うブラウザでは、重ねた画面がシートを覆った（実機レビュー:
          // 問いの一覧からセミモーダルが出てこない）。
          className="sp-rise relative isolate min-h-0 flex-1 overflow-auto"
          style={{
            // 本文の端まで引いても殻の外（ブラウザの引っ張り更新）へ伝えない。
            overscrollBehavior: 'contain',
            paddingBottom: 'var(--sp-dock-inset, 0px)',
            scrollPaddingBottom: 'var(--sp-dock-inset, 0px)',
          }}
        >
          {children}
        </main>
        <div
          ref={setDockSlot}
          className="pointer-events-none absolute inset-0 z-20"
          data-sp-dock-slot
        />
      </div>
      <div ref={setPaletteSlot} className="shrink-0" data-sp-palette-slot />
      {bottomNav && <SpBottomNav />}
      {/* 画面全体に重ねるもの（シート・確認）の席。空のときは指を通す。 */}
      <div
        ref={setOverlaySlot}
        data-sp-overlay-slot
        className="pointer-events-none absolute inset-0 z-30"
      />
    </div>
  );
}
