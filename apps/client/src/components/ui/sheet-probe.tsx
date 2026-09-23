'use client';

// verify-exempt: 実機の値を読むためだけの計器。`?sheetprobe=1` のときだけ出る。
// iOS でしか起きない症状を当て推量で直すのをやめるために置いた。原因が分かったら消す。

import { useEffect, useState } from 'react';

/** 計器を出すか（`?sheetprobe=1`）。 */
export function sheetProbeOn(): boolean {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get('sheetprobe') === '1';
}

interface SheetProbeProps {
  /** 段を担う外側のスクロール容器。 */
  scroller: HTMLElement | null;
  /** 中身を読む内側の箱。 */
  inner: HTMLElement | null;
}

/**
 * シートの 2 つの容器の状態を、画面の下端に小さく出す。
 *
 * 見るのは 4 つだけ:
 * - `外` 段を担う容器の「いまの位置 / いちばん下」と `overflow-y`
 * - `内` 中身の箱の「いまの位置 / いちばん下」と `overflow-y`
 *
 * 「スクロールできない」ときに、**どちらが止まっているのか**（`hidden` なのか、
 * 端に着いているのか）が 1 枚のスクリーンショットで分かる。
 */
export function SheetProbe({ scroller, inner }: SheetProbeProps) {
  const [line, setLine] = useState('—');

  useEffect(() => {
    if (!scroller || !inner) return;
    let frame = 0;
    const read = (el: HTMLElement) => {
      const max = Math.round(el.scrollHeight - el.clientHeight);
      return `${Math.round(el.scrollTop)}/${max} ${getComputedStyle(el).overflowY}`;
    };
    const tick = () => {
      setLine(`外 ${read(scroller)}　内 ${read(inner)}`);
      frame = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(frame);
  }, [scroller, inner]);

  return (
    <div
      aria-hidden="true"
      style={{
        position: 'fixed',
        left: 8,
        bottom: 8,
        zIndex: 9999,
        pointerEvents: 'none',
        padding: '4px 8px',
        borderRadius: 6,
        background: 'rgba(0,0,0,0.72)',
        color: '#fff',
        font: '500 11px/1.4 ui-monospace, monospace',
        whiteSpace: 'nowrap',
      }}
    >
      {line}
    </div>
  );
}
