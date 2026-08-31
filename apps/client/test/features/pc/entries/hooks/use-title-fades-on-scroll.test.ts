import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useTitleFadesOnScroll } from '@/features/pc/entries/hooks/use-title-fades-on-scroll';

/**
 * 縦書きの題には相反する2つの要求がある（PR #525 のやりとり）:
 * 常に出ていると「いまどこにいるか」が分からず、かといって紙と一緒に動くと
 * 書いている最中に落ち着かない。**位置は動かさず濃さだけ紙の進みに結ぶ**のがここの答え。
 *
 * 見張るのは「書き始め（進み 0）では濃いまま動かない」「進めば薄れて消える」
 * 「横書きへ戻せば跡を残さない」。
 */
describe('useTitleFadesOnScroll', () => {
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
      useTitleFadesOnScroll({
        titleRef: { current: title },
        editorRef: { current: editor },
        enabled,
      }),
    );
  }

  it('書き始め（進み 0）では濃いまま', () => {
    const { title, editor } = makeElements();
    setup(true, title, editor);

    expect(title.style.opacity).toBe('1');
  });

  it('位置は動かさない（題は最後まで同じ場所にいる）', () => {
    const { title, editor } = makeElements();
    setup(true, title, editor);

    scrollTo(editor, -120);

    expect(title.style.transform).toBe('');
  });

  it('紙が進むほど薄くなる', () => {
    const { title, editor } = makeElements();
    setup(true, title, editor);

    // vertical-rl は左へ読み進むと負。240px で消えるので、半分で 0.5。
    scrollTo(editor, -120);

    expect(title.style.opacity).toBe('0.5');
  });

  it('十分に進めば消え、本文のクリックを奪わない', () => {
    const { title, editor } = makeElements();
    setup(true, title, editor);

    scrollTo(editor, -400);

    expect(title.style.opacity).toBe('0');
    expect(title.style.pointerEvents).toBe('none');
  });

  it('戻れば題も戻ってくる', () => {
    const { title, editor } = makeElements();
    setup(true, title, editor);
    scrollTo(editor, -400);

    scrollTo(editor, 0);

    expect(title.style.opacity).toBe('1');
    expect(title.style.pointerEvents).toBe('');
  });

  it('横書き（enabled=false）では何も付けない', () => {
    const { title, editor } = makeElements();
    setup(false, title, editor);

    scrollTo(editor, -240);

    expect(title.style.opacity).toBe('');
  });

  it('縦書きから横書きへ切り替えたら、付けた薄さを消す', () => {
    const { title, editor } = makeElements();
    const { rerender } = renderHook(
      ({ enabled }) =>
        useTitleFadesOnScroll({
          titleRef: { current: title },
          editorRef: { current: editor },
          enabled,
        }),
      { initialProps: { enabled: true } },
    );
    scrollTo(editor, -400);
    expect(title.style.opacity).toBe('0');

    rerender({ enabled: false });

    expect(title.style.opacity).toBe('');
  });

  it('外した後はスクロールしても変わらない（listener が残らない）', () => {
    const { title, editor } = makeElements();
    const { unmount } = setup(true, title, editor);
    unmount();

    scrollTo(editor, -400);

    expect(title.style.opacity).toBe('');
  });
});
