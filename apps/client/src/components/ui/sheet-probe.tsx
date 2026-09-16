'use client';

// verify-exempt: 実機の値を読むためだけの計器。URL に `?sheetprobe=1` を付けたときだけ出る。

import { useEffect, useState } from 'react';

/**
 * シートの実測値を画面に出す計器（実機の調査用）。
 *
 * 実機でだけ「シートが出てこない」が起きていて、手元（Chromium / WebKit / 本番ビルド）では再現しない。
 * 実機の値を読む手が無いので、URL に `?sheetprobe=1` を付けたときだけ小さな読み取りを出す。
 * 原因が分かったら消す。
 */
export function SheetProbe() {
  const [lines, setLines] = useState<string[]>([]);

  useEffect(() => {
    if (!new URLSearchParams(window.location.search).has('sheetprobe')) return;
    const read = () => {
      const roots = [...document.querySelectorAll<HTMLElement>('[data-sheet-phase]')];
      const next = [`sheets=${roots.length}`];
      for (const root of roots) {
        const scroller = root.querySelector<HTMLElement>('.oz-sheet-scroller');
        const section = root.querySelector<HTMLElement>('section[role="dialog"]');
        if (!scroller || !section) continue;
        const box = section.getBoundingClientRect();
        const contentVar = getComputedStyle(section).getPropertyValue('--oz-sheet-content').trim();
        next.push(
          [
            section.getAttribute('aria-label')?.slice(0, 6),
            root.getAttribute('data-sheet-phase'),
            `d=${root.getAttribute('data-verify-detent') ?? '-'}`,
            `st=${Math.round(scroller.scrollTop)}`,
            `ch=${Math.round(scroller.clientHeight)}`,
            `sh=${Math.round(scroller.scrollHeight)}`,
            `top=${Math.round(box.top)}`,
            `h=${Math.round(box.height)}`,
            `cv=${contentVar || 'none'}`,
            `tr=${getComputedStyle(scroller).translate}`,
          ].join(' '),
        );
      }
      setLines(next);
    };
    read();
    const timer = setInterval(read, 400);
    return () => clearInterval(timer);
  }, []);

  if (lines.length === 0) return null;
  return (
    <div
      data-sheet-probe
      className="pointer-events-none fixed inset-x-0 top-0 z-[60] px-2 py-1 font-mono text-[9px] leading-tight"
      style={{ background: 'rgba(0,0,0,0.75)', color: '#fff' }}
    >
      {lines.map((line) => (
        <div key={line}>{line}</div>
      ))}
    </div>
  );
}
