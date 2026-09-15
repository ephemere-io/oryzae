import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useInlineImageSelection } from '@/features/pc/entries/hooks/use-inline-image-selection';

// 落とし先は「指した場所の文字」。ブラウザ API なので jsdom には無い。
// ここでは「どこに落ちたか」を差し替えられるようにして、移動の筋だけを見る。
const caretRange: { current: Range | null } = vi.hoisted(() => ({ current: null }));
vi.mock('@/features/pc/entries/utils/caret-from-point', () => ({
  caretRangeFromPoint: () => caretRange.current,
}));

/** jsdom には PointerEvent が無い。型名だけ合わせた MouseEvent で代用する。 */
function pointer(type: string, x: number, y: number): MouseEvent {
  return new MouseEvent(type, { bubbles: true, clientX: x, clientY: y });
}

describe('useInlineImageSelection', () => {
  let editor: HTMLDivElement;
  let photo: HTMLImageElement;
  let onCommit: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    editor = document.createElement('div');
    editor.contentEditable = 'true';
    editor.append('あいうえおかきくけこ');
    photo = document.createElement('img');
    photo.className = 'inline-photo';
    photo.dataset.storagePath = 'p1';
    photo.dataset.widthRatio = '0.4';
    photo.dataset.layout = 'block';
    photo.dataset.align = 'center';
    editor.appendChild(photo);
    document.body.appendChild(editor);
    onCommit = vi.fn();
    caretRange.current = null;
  });

  afterEach(() => {
    editor.remove();
    vi.clearAllMocks();
  });

  function setup() {
    const editorRef = { current: editor };
    return renderHook(() => useInlineImageSelection({ editorRef, isVertical: false, onCommit }));
  }

  it('写真を押すと選ばれる', () => {
    const { result } = setup();

    act(() => {
      photo.dispatchEvent(pointer('pointerdown', 10, 10));
    });

    expect(result.current.selection.element).toBe(photo);
    expect(result.current.selection.image?.storagePath).toBe('p1');
  });

  it('本文の他の場所を押すと選択が外れる', () => {
    const { result } = setup();

    act(() => {
      photo.dispatchEvent(pointer('pointerdown', 10, 10));
    });
    act(() => {
      editor.dispatchEvent(pointer('pointerdown', 10, 10));
    });

    expect(result.current.selection.element).toBeNull();
  });

  // 掴んで動かす。**同じ要素を入れ直す**ので、写真は作り直されない（src の読み直しが起きない）。
  it('掴んで動かすと、落とした文字の位置へ移る', () => {
    setup();
    const text = editor.firstChild;
    if (!(text instanceof Text)) throw new Error('本文のテキストが無い');
    const range = document.createRange();
    range.setStart(text, 3);
    range.collapse(true);
    caretRange.current = range;

    act(() => {
      photo.dispatchEvent(pointer('pointerdown', 100, 100));
      window.dispatchEvent(pointer('pointermove', 160, 100));
      window.dispatchEvent(pointer('pointerup', 160, 100));
    });

    // 「あいう」の後ろに入り、残りは写真の後ろへ回る。
    expect(editor.childNodes[0]?.textContent).toBe('あいう');
    expect(editor.childNodes[1]).toBe(photo);
    expect(onCommit).toHaveBeenCalledTimes(1);
  });

  it('掴んだまま動かさなければ移らない（ただ選んだだけ）', () => {
    setup();
    const text = editor.firstChild;
    if (!(text instanceof Text)) throw new Error('本文のテキストが無い');
    const range = document.createRange();
    range.setStart(text, 3);
    range.collapse(true);
    caretRange.current = range;

    act(() => {
      photo.dispatchEvent(pointer('pointerdown', 100, 100));
      // しきい値（6px）未満。
      window.dispatchEvent(pointer('pointermove', 103, 102));
      window.dispatchEvent(pointer('pointerup', 103, 102));
    });

    expect(editor.lastChild).toBe(photo);
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('掴んでいるあいだは印が付き、離すと消える', () => {
    setup();

    act(() => {
      photo.dispatchEvent(pointer('pointerdown', 100, 100));
      window.dispatchEvent(pointer('pointermove', 160, 100));
    });
    expect(photo.dataset.dragging).toBe('true');

    act(() => {
      window.dispatchEvent(pointer('pointerup', 160, 100));
    });
    expect(photo.dataset.dragging).toBeUndefined();
  });

  it('写真を外すと本文から消え、保存が走る', () => {
    const { result } = setup();

    act(() => {
      photo.dispatchEvent(pointer('pointerdown', 10, 10));
    });
    act(() => {
      result.current.removeSelected();
    });

    expect(editor.querySelector('img.inline-photo')).toBeNull();
    expect(result.current.selection.element).toBeNull();
    expect(onCommit).toHaveBeenCalledTimes(1);
  });
});
