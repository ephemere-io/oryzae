'use client';

// verify-exempt: WebGL(three.js) の renderer と rAF を持つため孤立描画できない。
// 扉の段取りは entrance/door.ts の純関数テストで、見え方は実機のブラウザ確認で担保する。

import { useEffect, useRef } from 'react';
import type { EntranceLayout } from '../entrance/layout';
import { type EntranceSceneHandle, initEntranceScene } from '../entrance/scene';

export interface EntranceCanvasProps {
  layout: EntranceLayout;
  reducedMotion: boolean;
  /** シーンを作れた（または捨てた）とき。作れなかったときは呼ばれない。 */
  onHandle: (handle: EntranceSceneHandle | null) => void;
  /** 最初の 1 フレームを描き終えたとき。 */
  onReady: () => void;
}

export function EntranceCanvas({ layout, reducedMotion, onHandle, onReady }: EntranceCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  // コールバックは ref で読む。親が再描画しただけでシーンを作り直さない。
  const callbacks = useRef({ onHandle, onReady });
  callbacks.current = { onHandle, onReady };

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let handle: EntranceSceneHandle;
    try {
      handle = initEntranceScene({
        container,
        layout,
        reducedMotion,
        onReady: () => callbacks.current.onReady(),
      });
    } catch {
      // WebGL が無い。扉は出ないが、紙（フォーム）は地の色の上でそのまま使える。
      return;
    }
    callbacks.current.onHandle(handle);

    // 紙がポインタを覆っていても視点は揺らしたいので、canvas ではなく window で受ける。
    function handlePointerMove(event: PointerEvent) {
      if (event.pointerType !== 'mouse') return;
      handle.setPointer(
        (event.clientX / window.innerWidth) * 2 - 1,
        -((event.clientY / window.innerHeight) * 2 - 1),
      );
    }
    function handlePointerLeave() {
      handle.clearPointer();
    }
    window.addEventListener('pointermove', handlePointerMove);
    document.documentElement.addEventListener('pointerleave', handlePointerLeave);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      document.documentElement.removeEventListener('pointerleave', handlePointerLeave);
      callbacks.current.onHandle(null);
      handle.dispose();
    };
  }, [layout, reducedMotion]);

  return <div ref={containerRef} className="absolute inset-0" />;
}
