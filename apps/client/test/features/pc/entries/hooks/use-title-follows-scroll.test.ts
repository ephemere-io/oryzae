import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useTitleFollowsScroll } from '@/features/pc/entries/hooks/use-title-follows-scroll';

/**
 * 縦書きの題は紙の右肩に絶対配置してあるため、放っておくと本文だけが流れて題が残る。
 * **題と本文が同じ紙に書かれている**ように見せたいので、紙の進んだ分を題にも掛ける。
 *
 * 書いている最中に題がふらつかないのは、紙自体が1文字ごとには動かないから
 * （use-typewriter-scroll が端に着くまで紙を止める）。ここではその前提の上で
 * 「紙が動いたら題も同じだけ動く」「横書きへ戻せば跡を残さない」を見張る。
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

  it('紙が動いた分だけ題も、本文と同じ向きへ動く', () => {
    const { title, editor } = makeElements();
    setup(true, title, editor);

    // vertical-rl は先頭（右端）で 0、左へ読み進むと負。
    scrollTo(editor, -240);

    // 中身は右へ送られるので、題も右へ。scrollLeft をそのまま足すと逆走する。
    expect(title.style.transform).toBe('translateX(240px)');
  });

  it('紙が止まっていれば題も動かない（書いている最中にふらつかない）', () => {
    const { title, editor } = makeElements();
    setup(true, title, editor);

    scrollTo(editor, 0);

    expect(title.style.transform).toBe('translateX(0px)');
  });

  it('マウント直後に現在の位置へ合わせる（途中から開いても題がずれない）', () => {
    const { title, editor } = makeElements();
    Object.defineProperty(editor, 'scrollLeft', { value: -120, configurable: true });

    setup(true, title, editor);

    expect(title.style.transform).toBe('translateX(120px)');
  });

  it('戻れば題も戻ってくる', () => {
    const { title, editor } = makeElements();
    setup(true, title, editor);
    scrollTo(editor, -400);

    scrollTo(editor, 0);

    expect(title.style.transform).toBe('translateX(0px)');
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
    expect(title.style.transform).toBe('translateX(300px)');

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
