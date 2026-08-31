'use client';

import { useEffect } from 'react';

interface UseTitleFollowsScrollOptions {
  /** 題の入力欄。本文のスクロールに合わせて動かす対象。 */
  titleRef: React.RefObject<HTMLElement | null>;
  /** 縦書きのスクローラ（＝本文の contentEditable 自身）。 */
  editorRef: React.RefObject<HTMLElement | null>;
  /** 縦書きのときだけ働く。横書きの題は本文の流れの中にあるので、勝手にスクロールする。 */
  enabled: boolean;
}

/**
 * 縦書きのとき、題を本文と一緒にスクロールさせる。
 *
 * 縦書きの題は紙の右肩に絶対配置してあるため、本文を左へ読み進めても題だけが右端に
 * 貼りついたままだった。**いま自分が文章のどこにいるのかが分からなくなる**——
 * 横書きでは題が上へ流れて消えるのに、縦書きだけ消えない、という食い違い。
 *
 * 題を紙の一部として扱う: 本文のスクロール量そのままを題に足して、一緒に流れて
 * 画面の外へ出るようにする。vertical-rl のスクローラは先頭（右端）で scrollLeft が 0、
 * 左へ進むと負になるので、その値をそのまま横移動に使えばよい。
 *
 * transform だけを触るのでレイアウトは動かない（スクロール中に再計算が走らない）。
 */
export function useTitleFollowsScroll({
  titleRef,
  editorRef,
  enabled,
}: UseTitleFollowsScrollOptions): void {
  useEffect(() => {
    const title = titleRef.current;
    const editor = editorRef.current;
    if (!title) return;
    if (!enabled || !editor) {
      // 横書きへ戻したときに、縦書きで付けたずれを残さない。
      title.style.transform = '';
      return;
    }

    function sync() {
      const el = titleRef.current;
      const scroller = editorRef.current;
      if (!el || !scroller) return;
      el.style.transform = `translateX(${scroller.scrollLeft}px)`;
    }

    sync();
    editor.addEventListener('scroll', sync, { passive: true });
    return () => {
      editor.removeEventListener('scroll', sync);
      title.style.transform = '';
    };
  }, [titleRef, editorRef, enabled]);
}
