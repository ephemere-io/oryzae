'use client';

// verify-exempt: WebGL(three.js) の renderer と rAF を持つため孤立描画できない。
// 扉の段取りは entrance/door.ts の純関数テストで、見え方は実機のブラウザ確認で担保する。

import { useEffect, useMemo, useRef } from 'react';
import type { EntranceLayout } from '../entrance/layout';
import { type EntranceSceneHandle, initEntranceScene } from '../entrance/scene';
import { entranceSprig, microSeasonIndex } from '../entrance/season';

export interface EntranceCanvasProps {
  layout: EntranceLayout;
  reducedMotion: boolean;
  /** シーンを作れた（または捨てた）とき。作れなかったときは呼ばれない。 */
  onHandle: (handle: EntranceSceneHandle | null) => void;
  /** 最初の 1 フレームを描き終えたとき。 */
  onReady: () => void;
  /** 最初から扉に手を掛けた状態で始めるか（通り道の画面）。作るときにしか使わない。 */
  initialWaiting: boolean;
}

export function EntranceCanvas({
  layout,
  reducedMotion,
  onHandle,
  onReady,
  initialWaiting,
}: EntranceCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  /**
   * 一輪挿しに挿さる枝の姿。いまの候（七十二候）で決まる（`season.ts`）。
   * 開いている間は変えない — 画面を見ている最中に枝が変わる意味は無い。
   */
  const sprig = useMemo(() => entranceSprig(microSeasonIndex(new Date())), []);
  // 初期の開きは作るときにしか使わない。値が変わってもシーンは作り直さない。
  const initialWaitingRef = useRef(initialWaiting);
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
        sprig,
        waiting: initialWaitingRef.current,
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
      // 持ち出された canvas は、受け取った側（`StudyHandover`）が捨てる。ここで捨てると、
      // 画面が入れ替わった瞬間に動きが消える。
      if (!handle.isDetached()) handle.dispose();
    };
  }, [layout, reducedMotion, sprig]);

  return <div ref={containerRef} className="absolute inset-0" />;
}
