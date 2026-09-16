'use client';

/**
 * **見えていない下端**（ブラウザのツールバーが重なっているぶん）を実測する。
 *
 * ### なぜ CSS だけでは足りないか
 *
 * 下のツールバーを持つブラウザは 2 通りある。
 *
 * 1. 自分でよけるもの（Safari など）: ツールバーぶんを引いた高さを `100svh` で教えてくれる
 * 2. 重ねて描くもの（アプリ内ブラウザ。実機の Dia で確認）: Web ビューを画面いっぱいに置き、
 *    ツールバーをその上に重ねる。**`100svh` を無視して常に大きい方の高さ**を返すブラウザが
 *    あり（iOS の Firefox・Brave・DuckDuckGo などで知られた挙動）、
 *    `env(safe-area-inset-bottom)` にもツールバーは現れない
 *
 * 2 で頼れるのは `visualViewport`（いま実際に見えている領域）だけ。レイアウトの高さ
 * （`window.innerHeight`）との差が、**下に隠れている高さ**そのものになる。
 *
 * **値を決め打ちしない。** ブラウザが何も教えてくれない環境では 0 になり、画面は
 * 今までどおりに出る（隠れる可能性は残るが、当てずっぽうの余白を全員に配るよりよい）。
 */

/**
 * いま下に隠れている高さ（px）。重なりが無ければ 0。
 *
 * `visualViewport.offsetTop` を足すのは、拡大などで表示領域が上へずれているとき、
 * 下に隠れる量がその分だけ増えるため。
 */
export function hiddenBottomHeight(): number {
  if (typeof window === 'undefined') return 0;
  const viewport = window.visualViewport;
  if (!viewport) return 0;
  const hidden = window.innerHeight - (viewport.height + viewport.offsetTop);
  // 1px 以下は丸め誤差。
  return hidden > 1 ? Math.round(hidden) : 0;
}

/**
 * 隠れている高さを見張る。返り値を呼ぶと止まる。
 *
 * **キーボードが出ている間は更新しない。** キーボードも `visualViewport` を縮めるので、
 * そのまま追うと紙がキーボードの上へ跳ね上がり、ブラウザ自身のスクロールと二重に動く。
 * 入力欄から離れたときの値で足りる。
 */
export function watchHiddenBottomHeight(onChange: (height: number) => void): () => void {
  if (typeof window === 'undefined') return () => {};
  const viewport = window.visualViewport;

  const report = () => {
    if (isEditing()) return;
    onChange(hiddenBottomHeight());
  };

  report();
  viewport?.addEventListener('resize', report);
  viewport?.addEventListener('scroll', report);
  window.addEventListener('orientationchange', report);
  return () => {
    viewport?.removeEventListener('resize', report);
    viewport?.removeEventListener('scroll', report);
    window.removeEventListener('orientationchange', report);
  };
}

/** いま文字を入力しているか（キーボードが出ている可能性がある）。 */
function isEditing(): boolean {
  const active = document.activeElement;
  return (
    active instanceof HTMLInputElement ||
    active instanceof HTMLTextAreaElement ||
    (active instanceof HTMLElement && active.isContentEditable)
  );
}
