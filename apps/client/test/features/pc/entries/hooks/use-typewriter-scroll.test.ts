import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useTypewriterScroll } from '@/features/pc/entries/hooks/use-typewriter-scroll';

/**
 * jsdom はレイアウトを持たないので、キャレット矩形とスクローラの寸法は明示的に注入する。
 * ここで見たいのは「どう測るか」ではなく「どういうときに紙を動かし、どういうときに触らないか」。
 */

interface RectInit {
  top?: number;
  bottom?: number;
  left?: number;
  right?: number;
  width?: number;
  height?: number;
}

function makeRect({
  top = 0,
  bottom = 0,
  left = 0,
  right = 0,
  width = 0,
  height = 0,
}: RectInit): DOMRect {
  return {
    top,
    bottom,
    left,
    right,
    width,
    height,
    x: left,
    y: top,
    toJSON: () => ({}),
  };
}

/** スクローラの clientWidth/Height と scrollWidth/Height は jsdom では常に 0 なので上書きする。 */
function setScrollMetrics(
  el: HTMLElement,
  metrics: {
    clientWidth?: number;
    clientHeight?: number;
    scrollWidth?: number;
    scrollHeight?: number;
  },
): void {
  for (const [key, value] of Object.entries(metrics)) {
    Object.defineProperty(el, key, { value, configurable: true });
  }
}

/** window.getSelection をスタブして、editor 内の指定矩形にキャレットがある状態にする。 */
function stubCaret(editor: HTMLElement, rect: DOMRect | null): void {
  if (rect === null) {
    vi.spyOn(window, 'getSelection').mockReturnValue(null);
    return;
  }
  const range = {
    startContainer: editor,
    getClientRects: () => [rect],
    getBoundingClientRect: () => rect,
  };
  vi.spyOn(window, 'getSelection').mockReturnValue({
    rangeCount: 1,
    getRangeAt: () => range,
    // @type-assertion-allowed: Selection の全メンバーは不要で、hook が触る3つだけをスタブする
  } as unknown as Selection);
}

describe('useTypewriterScroll', () => {
  let editor: HTMLDivElement;
  let scroller: HTMLDivElement;
  let editorRef: { current: HTMLDivElement | null };
  let scrollContainerRef: { current: HTMLDivElement | null };

  beforeEach(() => {
    editor = document.createElement('div');
    scroller = document.createElement('div');
    scroller.appendChild(editor);
    document.body.appendChild(scroller);
    editorRef = { current: editor };
    scrollContainerRef = { current: scroller };
    // requestAnimationFrame を同期実行にして、input → 測定 を1 act で完結させる。
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      cb(0);
      return 0;
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    scroller.remove();
  });

  function render(writingMode: 'vertical' | 'horizontal', enabled = true) {
    return renderHook(() =>
      useTypewriterScroll({ editorRef, scrollContainerRef, writingMode, enabled }),
    );
  }

  function type() {
    act(() => {
      editor.dispatchEvent(new Event('input', { bubbles: true }));
    });
  }

  it('横書き: 中央を越えても、端(85%)に届くまでは紙を動かさない', () => {
    // 1文字ごとに紙が動くと「文字は動かないのに背景だけ流れる」ように見える。
    // 書いているあいだは止めておく。
    scroller.getBoundingClientRect = () => makeRect({ top: 0, height: 600, width: 800 });
    setScrollMetrics(scroller, { clientHeight: 600, scrollHeight: 2000 });
    scroller.scrollTop = 100;
    // 下端 500 は中央(300) より下だが、送り出しの線(510) にはまだ届いていない。
    stubCaret(editor, makeRect({ top: 480, bottom: 500, height: 20, width: 1 }));

    render('horizontal');
    type();

    expect(scroller.scrollTop).toBe(100);
  });

  it('横書き: 端(85%)に届いたら、キャレットが中央に来るまで送る', () => {
    scroller.getBoundingClientRect = () => makeRect({ top: 0, height: 600, width: 800 });
    setScrollMetrics(scroller, { clientHeight: 600, scrollHeight: 2000 });
    scroller.scrollTop = 100;
    // 下端 560 が送り出しの線(510) を越えた → 中央(300) まで 260 送る。
    stubCaret(editor, makeRect({ top: 540, bottom: 560, height: 20, width: 1 }));

    render('horizontal');
    type();

    expect(scroller.scrollTop).toBe(360);
  });

  it('横書き: キャレットが中央より上なら紙を動かさない（読み返しの位置を奪わない）', () => {
    scroller.getBoundingClientRect = () => makeRect({ top: 0, height: 600, width: 800 });
    setScrollMetrics(scroller, { clientHeight: 600, scrollHeight: 2000 });
    scroller.scrollTop = 100;
    stubCaret(editor, makeRect({ top: 100, bottom: 120, height: 20, width: 1 }));

    render('horizontal');
    type();

    expect(scroller.scrollTop).toBe(100);
  });

  it('本文がスクローラに収まっている間は動かさない（短い文章で画面が跳ねない）', () => {
    scroller.getBoundingClientRect = () => makeRect({ top: 0, height: 600, width: 800 });
    setScrollMetrics(scroller, { clientHeight: 600, scrollHeight: 600 });
    scroller.scrollTop = 0;
    stubCaret(editor, makeRect({ top: 580, bottom: 595, height: 15, width: 1 }));

    render('horizontal');
    type();

    expect(scroller.scrollTop).toBe(0);
  });

  it('縦書き: 中央を越えても、端(左から15%)に届くまでは動かさない', () => {
    // 縦書きでは editor 自身が overflowX:auto のスクローラ。
    editor.getBoundingClientRect = () => makeRect({ left: 0, width: 800, height: 600 });
    setScrollMetrics(editor, { clientWidth: 800, scrollWidth: 3000 });
    editor.scrollLeft = 0;
    // 左端 300 は中央(400) より左だが、送り出しの線(120) にはまだ届いていない。
    stubCaret(editor, makeRect({ left: 300, right: 301, width: 1, height: 20 }));

    render('vertical');
    type();

    expect(editor.scrollLeft).toBe(0);
  });

  it('縦書き: 端に届いたら、キャレットが中央に来るまで負方向へ送る', () => {
    editor.getBoundingClientRect = () => makeRect({ left: 0, width: 800, height: 600 });
    setScrollMetrics(editor, { clientWidth: 800, scrollWidth: 3000 });
    editor.scrollLeft = 0;
    // 左端 100 が送り出しの線(120) を越えた → 中央(400) まで 300 送る（左向きなので負）。
    stubCaret(editor, makeRect({ left: 100, right: 101, width: 1, height: 20 }));

    render('vertical');
    type();

    expect(editor.scrollLeft).toBe(-300);
  });

  it('縦書き: キャレットがアンカーより右（＝書き始め側）なら動かさない', () => {
    editor.getBoundingClientRect = () => makeRect({ left: 0, width: 800, height: 600 });
    setScrollMetrics(editor, { clientWidth: 800, scrollWidth: 3000 });
    editor.scrollLeft = 0;
    stubCaret(editor, makeRect({ left: 600, right: 601, width: 1, height: 20 }));

    render('vertical');
    type();

    expect(editor.scrollLeft).toBe(0);
  });

  it('enabled=false のときは input を購読しない', () => {
    scroller.getBoundingClientRect = () => makeRect({ top: 0, height: 600, width: 800 });
    setScrollMetrics(scroller, { clientHeight: 600, scrollHeight: 2000 });
    scroller.scrollTop = 0;
    stubCaret(editor, makeRect({ top: 480, bottom: 500, height: 20, width: 1 }));

    render('horizontal', false);
    type();

    expect(scroller.scrollTop).toBe(0);
  });

  it('レイアウトを測れない環境（全て0の矩形）では何もしない', () => {
    scroller.getBoundingClientRect = () => makeRect({ top: 0, height: 600, width: 800 });
    setScrollMetrics(scroller, { clientHeight: 600, scrollHeight: 2000 });
    scroller.scrollTop = 42;
    stubCaret(editor, makeRect({}));

    render('horizontal');
    type();

    expect(scroller.scrollTop).toBe(42);
  });

  it('選択が無いときは何もしない', () => {
    scroller.getBoundingClientRect = () => makeRect({ top: 0, height: 600, width: 800 });
    setScrollMetrics(scroller, { clientHeight: 600, scrollHeight: 2000 });
    scroller.scrollTop = 42;
    stubCaret(editor, null);

    render('horizontal');
    type();

    expect(scroller.scrollTop).toBe(42);
  });

  it('アンマウントで input リスナを外す', () => {
    scroller.getBoundingClientRect = () => makeRect({ top: 0, height: 600, width: 800 });
    setScrollMetrics(scroller, { clientHeight: 600, scrollHeight: 2000 });
    scroller.scrollTop = 0;
    stubCaret(editor, makeRect({ top: 480, bottom: 500, height: 20, width: 1 }));

    const { unmount } = render('horizontal');
    unmount();
    type();

    expect(scroller.scrollTop).toBe(0);
  });
});
