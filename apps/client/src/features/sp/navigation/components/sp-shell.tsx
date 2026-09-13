'use client';

// verify-exempt: 殻。router とビジュアルビューポートに依存し、孤立描画では中身が無い。

import type { ReactNode } from 'react';
import { useSpChrome } from '@/lib/sp-chrome-context';
import { SpBottomNav } from './sp-bottom-nav';
import { SpTopBar } from './sp-top-bar';

interface SpShellProps {
  /** 上段（戻る・状態・設定）を出すか。書斎ホームでは出さない。 */
  topBar: boolean;
  showSettings: boolean;
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
export function SpShell({ topBar, showSettings, bottomNav, children }: SpShellProps) {
  const { viewport, setPaletteSlot } = useSpChrome();

  return (
    <div
      className={`flex flex-col overflow-hidden bg-[var(--bg)] ${viewport ? 'fixed inset-x-0' : 'h-[100dvh]'}`}
      style={viewport ? { top: viewport.top, height: viewport.height } : undefined}
    >
      {topBar && <SpTopBar showSettings={showSettings} />}
      <main
        className="relative min-h-0 flex-1 overflow-auto"
        // 本文の端まで引いても殻の外（ブラウザの引っ張り更新）へ伝えない。
        style={{ overscrollBehavior: 'contain' }}
      >
        {children}
      </main>
      <div ref={setPaletteSlot} className="shrink-0" data-sp-palette-slot />
      {bottomNav && <SpBottomNav />}
    </div>
  );
}
