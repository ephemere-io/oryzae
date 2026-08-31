import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useTitleFollowsScroll } from '@/features/pc/entries/hooks/use-title-follows-scroll';

/**
 * 縦書きの題は紙の右肩に絶対配置してあるため、放っておくと本文だけが流れて題が残り、
 * 「いま自分が文章のどこにいるのか」が分からなくなる（PR #525 のレビュー指摘）。
 * ここで見張るのは「題が本文のスクロールに追いて、横書きへ戻せば跡を残さない」こと。
 */
describe('useTitleFollowsScroll', () => {
  const created: HTMLElement[] = [];

  function makeElements() {
    const title = document.createElement('input');
    const editor = document.createElement('div');
    document.body.append(title, editor);
    created.push(title, editor);
    return { title, editor };
  }

  /** jsdom はレイアウトを持たないので scrollLeft を直接置く。 */
  function scrollTo(editor: HTMLElement, left: number) {
    Object.defineProperty(editor, 'scrollLeft', { value: left, configurable: true });
    editor.dispatchEvent(new Event('scroll'));
  }

  afterEach(() => {
    for (const el of created.splice(0)) el.remove();
  });

  function setup(enabled: boolean, title: HTMLElement, editor: HTMLElement) {
    return renderHook(() =>
      useTitleFollowsScroll({
        titleRef: { current: title },
        editorRef: { current: editor },
        enabled,
      }),
    );
  }

  it('縦書きでは本文のスクロール量ぶん題を横へ動かす', () => {
    const { title, editor } = makeElements();
    setup(true, title, editor);

    // vertical-rl は先頭（右端）で 0、左へ読み進むと負になる。
    scrollTo(editor, -240);

    expect(title.style.transform).toBe('translateX(-240px)');
  });

  it('マウント直後に現在のスクロール位置へ合わせる（途中から開いても題がずれない）', () => {
    const { title, editor } = makeElements();
    Object.defineProperty(editor, 'scrollLeft', { value: -120, configurable: true });

    setup(true, title, editor);

    expect(title.style.transform).toBe('translateX(-120px)');
  });

  it('横書き（enabled=false）では何も付けない', () => {
    const { title, editor } = makeElements();
    setup(false, title, editor);

    scrollTo(editor, -240);

    expect(title.style.transform).toBe('');
  });

  it('縦書きから横書きへ切り替えたら、付けたずれを消す', () => {
    const { title, editor } = makeElements();
    const { rerender } = renderHook(
      ({ enabled }) =>
        useTitleFollowsScroll({
          titleRef: { current: title },
          editorRef: { current: editor },
          enabled,
        }),
      { initialProps: { enabled: true } },
    );
    scrollTo(editor, -300);
    expect(title.style.transform).toBe('translateX(-300px)');

    rerender({ enabled: false });

    expect(title.style.transform).toBe('');
  });

  it('外した後はスクロールしても動かさない（listener が残らない）', () => {
    const { title, editor } = makeElements();
    const { unmount } = setup(true, title, editor);
    unmount();

    scrollTo(editor, -400);

    expect(title.style.transform).toBe('');
  });
});
