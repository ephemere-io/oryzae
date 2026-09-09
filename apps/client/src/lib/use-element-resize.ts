'use client';

import { useEffect, useRef } from 'react';

/**
 * 要素そのものの大きさが変わったら知らせる。
 *
 * `window` の resize では足りない場面のためにある。列の開閉やサイドバーの出し入れでは
 * **要素だけが縮み、ウィンドウの大きさは変わらない**ので resize は飛んでこない。
 *
 * jsdom には `ResizeObserver` が無い（検証ハーネスはそこで動く）。無い環境では window の
 * resize に落とす ── 要素だけが変わる場合は拾えないが、少なくとも壊れない。素で
 * `new ResizeObserver()` を書くと、その場で ReferenceError になってユニットごと落ちる。
 *
 * `element` は ref ではなく **state で持った実体**を渡すこと。ref だと「後から現れた」
 * ことに気づけず、監視が張られないままになる。
 */
export function useElementResize(element: Element | null, onResize: () => void): void {
  // 毎レンダー張り直さずに最新のコールバックを呼ぶための鏡。
  const handler = useRef(onResize);
  handler.current = onResize;

  useEffect(() => {
    if (!element) return;
    const fire = () => handler.current();

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', fire);
      return () => window.removeEventListener('resize', fire);
    }

    const observer = new ResizeObserver(fire);
    observer.observe(element);
    return () => observer.disconnect();
  }, [element]);
}
