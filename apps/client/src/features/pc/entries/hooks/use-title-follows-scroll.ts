'use client';

import { useEffect } from 'react';

interface UseTitleFollowsScrollOptions {
  /** 題の入力欄。 */
  titleRef: React.RefObject<HTMLElement | null>;
  /** 縦書きのスクローラ（＝本文の contentEditable 自身）。 */
  editorRef: React.RefObject<HTMLElement | null>;
  /** 縦書きのときだけ働く。横書きの題は本文の流れの中にあるので、放っておいても一緒に動く。 */
  enabled: boolean;
}

/**
 * 縦書きのとき、題を紙の一部として本文と一緒に動かす。
 *
 * 題は紙の右肩に絶対配置してあるので、放っておくと本文だけが流れて題だけが残る。
 * **題と本文が同じ紙に書かれている**ように見せたいので、紙の進んだ分をそのまま題にも
 * 掛ける。読み進めれば題も一緒に画面の外へ出て、戻れば戻ってくる。
 *
 * 濃さを落として消す案も試したが、位置が動かないぶん「別の紙に印刷されている」ように
 * 見えた。動かすほうが素直。**書いている最中に題がふらつかないのは、紙自体が
 * 1文字ごとには動かないから**（`use-typewriter-scroll`: 端に着くまで紙を止める）。
 *
 * vertical-rl のスクローラは先頭（右端）で scrollLeft が 0、左へ進むと負になる。
 * 中身はそのぶん**右へ**送られるので、題に掛けるのは `-scrollLeft`。
 * ここを符号のまま足すと、本文が右へ流れるのに題だけ左へ動く（実際にそうなっていた）。
 * transform だけを触るのでレイアウトは動かない。
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
      // **符号に注意。** vertical-rl では scrollLeft が 0 → 負に進み、そのぶん中身は
      // 右へ送られる。scrollLeft をそのまま足すと題だけが本文と逆（左）へ動く。
      el.style.transform = `translateX(${-scroller.scrollLeft}px)`;
    }

    sync();
    editor.addEventListener('scroll', sync, { passive: true });
    return () => {
      editor.removeEventListener('scroll', sync);
      title.style.transform = '';
    };
  }, [titleRef, editorRef, enabled]);
}
