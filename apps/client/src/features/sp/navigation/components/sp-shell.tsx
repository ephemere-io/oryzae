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
      <main
        // 画面が入れ替わったら短く現れる（220ms・ease-out、reduce 設定では無効）。押してから
        // 次の画面が「置かれた」ことを目で追えるようにする。鍵は path（同じ画面の再描画では動かない）。
        key={pathname}
        className="sp-rise relative min-h-0 flex-1 overflow-auto"
        // 本文の端まで引いても殻の外（ブラウザの引っ張り更新）へ伝えない。
        style={{ overscrollBehavior: 'contain' }}
      >
        {children}
      </main>
      {/* 本文の下に居座る非モーダルのシート（発酵の結果など）の席。本文と列の間で、高さは中身が持つ。 */}
      <div ref={setDockSlot} className="relative z-20 flex shrink-0 flex-col" data-sp-dock-slot />
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
