'use client';

// verify-exempt: 実機の値を読むためだけの計器。preview と `?sheetprobe=1` のときだけ出る。

import { useEffect, useState } from 'react';

/**
 * シートの実測値を画面に出す計器（実機の調査用）。
 *
 * 実機でだけ「一覧のアイテムを押しても何も出てこない」が起きていて、手元では再現しない
 * （開発ビルド・本番ビルド・配信中の preview ビルドを Chromium / WebKit の iPhone で確認済み）。
 * 見当で直すのをやめ、実機の値を 1 枚のスクショで読むためのもの。**原因が分かったら消す。**
 *
 * 読み方:
 * - `mode=none` … 押しても画面の状態が変わっていない（押せていない／押す手が届いていない）
 * - `mode=edit sheets=0` … 状態は変わったのにシートが描かれていない
 * - `sheets=1` で `st`（位置）が 0 … 描かれているが容器の下（閉の位置）に居る
 * - `err=` … 途中で例外が出ている
 */
export function SheetProbe() {
  const [lines, setLines] = useState<string[]>([]);

  useEffect(() => {
    const search = new URLSearchParams(window.location.search);
    const on = search.has('sheetprobe') || window.location.hostname.endsWith('.vercel.app');
    if (!on) return;

    let error = '';
    const onError = (event: ErrorEvent) => {
      error = String(event.message).slice(0, 70);
    };
    const onRejection = (event: PromiseRejectionEvent) => {
      error = String(event.reason).slice(0, 70);
    };
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);

    const read = () => {
      const next: string[] = [];
      const questions = document.querySelector('[data-verify-unit="SpQuestions"]');
      const roots = [...document.querySelectorAll<HTMLElement>('[data-sheet-phase]')];
      next.push(
        [
          `mode=${questions?.getAttribute('data-verify-sheet-mode') ?? '-'}`,
          `sheets=${roots.length}`,
          `vv=${Math.round(window.visualViewport?.height ?? -1)}/${Math.round(
            window.visualViewport?.offsetTop ?? -1,
          )}`,
          `inner=${window.innerHeight}`,
          `err=${error || '-'}`,
        ].join(' '),
      );
      for (const root of roots) {
        const scroller = root.querySelector<HTMLElement>('.oz-sheet-scroller');
        const section = root.querySelector<HTMLElement>('section[role="dialog"]');
        if (!scroller || !section) continue;
        const box = section.getBoundingClientRect();
        next.push(
          [
            section.getAttribute('aria-label')?.slice(0, 5),
            root.getAttribute('data-sheet-phase'),
            `d=${root.getAttribute('data-verify-detent') ?? '-'}`,
            `shown=${scroller.getAttribute('data-shown')}`,
            `st=${Math.round(scroller.scrollTop)}`,
            `ch=${Math.round(scroller.clientHeight)}`,
            `sh=${Math.round(scroller.scrollHeight)}`,
            `top=${Math.round(box.top)}`,
            `h=${Math.round(box.height)}`,
            `cv=${getComputedStyle(section).getPropertyValue('--oz-sheet-content').trim() || 'none'}`,
            `tr=${getComputedStyle(scroller).translate}`,
          ].join(' '),
        );
      }
      setLines(next);
    };
    read();
    const timer = setInterval(read, 400);
    return () => {
      clearInterval(timer);
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
    };
  }, []);

  if (lines.length === 0) return null;
  return (
    <div
      data-sheet-probe
      className="pointer-events-none fixed inset-x-0 top-0 z-[60] px-2 py-1 font-mono text-[9px] leading-tight"
      style={{ background: 'rgba(0,0,0,0.8)', color: '#fff' }}
    >
      {lines.map((line) => (
        <div key={line}>{line}</div>
      ))}
    </div>
  );
}
