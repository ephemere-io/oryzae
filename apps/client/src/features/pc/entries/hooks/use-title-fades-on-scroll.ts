'use client';

import { useEffect } from 'react';

interface UseTitleFadesOnScrollOptions {
  /** 題の入力欄。 */
  titleRef: React.RefObject<HTMLElement | null>;
  /** 縦書きのスクローラ（＝本文の contentEditable 自身）。 */
  editorRef: React.RefObject<HTMLElement | null>;
  /** 縦書きのときだけ働く。横書きの題は本文の流れの中にあるので、勝手に流れて消える。 */
  enabled: boolean;
}

/** これだけ紙が進んだら、題は完全に消える（px）。 */
const FADE_DISTANCE = 240;

/**
 * 縦書きのとき、紙が進むにつれて題を薄くする。
 *
 * ここには相反する2つの要求がある:
 *
 *  - **題が常に出ていると、いま文章のどこにいるのか分からない**（横書きでは題が上へ流れて
 *    消えるのに、縦書きだけ紙の右肩に貼りついたまま）
 *  - **書いている最中に題が動くと落ち着かない**（紙と一緒に横へ滑っていくのが目に入る）
 *
 * 「題を紙と一緒に動かす」と前者は解けるが後者が壊れる。動かさずに**濃さだけ**を紙の
 * 進みに結ぶと、両方が立つ: 題は最後まで同じ場所にいて動かないが、読み進めた分だけ薄れ、
 * やがて消える。戻れば戻ってくる。
 *
 * opacity だけを触るのでレイアウトは動かない（スクロール中に再計算が走らない）。
 */
export function useTitleFadesOnScroll({
  titleRef,
  editorRef,
  enabled,
}: UseTitleFadesOnScrollOptions): void {
  useEffect(() => {
    const title = titleRef.current;
    const editor = editorRef.current;
    if (!title) return;
    if (!enabled || !editor) {
      // 横書きへ戻したときに、縦書きで付けた薄さを残さない。
      title.style.opacity = '';
      title.style.pointerEvents = '';
      return;
    }

    function sync() {
      const el = titleRef.current;
      const scroller = editorRef.current;
      if (!el || !scroller) return;
      // vertical-rl は先頭（右端）で 0、左へ読み進むと負。進んだ距離は絶対値で見る。
      const progressed = Math.abs(scroller.scrollLeft);
      const opacity = Math.max(0, 1 - progressed / FADE_DISTANCE);
      el.style.opacity = String(opacity);
      // 消えた題が本文のクリックを奪わないようにする。
      el.style.pointerEvents = opacity === 0 ? 'none' : '';
    }

    sync();
    editor.addEventListener('scroll', sync, { passive: true });
    return () => {
      editor.removeEventListener('scroll', sync);
      title.style.opacity = '';
      title.style.pointerEvents = '';
    };
  }, [titleRef, editorRef, enabled]);
}
