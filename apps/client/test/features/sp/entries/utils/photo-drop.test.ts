import { afterEach, describe, expect, it, vi } from 'vitest';
import { dropRangeAt, movePhotoTo } from '@/features/sp/entries/utils/photo-drop';

/** `一二三<img>四五` の本文を作る。 */
function body(): { editor: HTMLDivElement; photo: HTMLImageElement; head: Text; tail: Text } {
  const editor = document.createElement('div');
  const head = document.createTextNode('一二三');
  const photo = document.createElement('img');
  const tail = document.createTextNode('四五');
  editor.append(head, photo, tail);
  document.body.appendChild(editor);
  return { editor, photo, head, tail };
}

function caretAt(node: Node, offset: number): Range {
  const range = document.createRange();
  range.setStart(node, offset);
  range.collapse(true);
  return range;
}

/** 本文を、写真を □ にして読む。 */
function read(editor: HTMLElement): string {
  return [...editor.childNodes]
    .map((node) => (node instanceof HTMLImageElement ? '□' : (node.textContent ?? '')))
    .join('');
}

describe('photo-drop（写真を掴んで文字の位置へ動かす）', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
    Reflect.deleteProperty(document, 'caretRangeFromPoint');
  });

  it('文字の途中へ入れ直すと、前後の文字の節は繋ぎ直される', () => {
    const { editor, photo, head } = body();
    expect(movePhotoTo(photo, caretAt(head, 1))).toBe(true);
    expect(read(editor)).toBe('一□二三四五');
    expect(editor.childNodes).toHaveLength(3);
  });

  it('写真のすぐ前・すぐ後に落としても動かさない', () => {
    const { editor, photo, head, tail } = body();
    expect(movePhotoTo(photo, caretAt(head, 3))).toBe(false);
    expect(movePhotoTo(photo, caretAt(tail, 0))).toBe(false);
    expect(movePhotoTo(photo, caretAt(editor, 1))).toBe(false);
    expect(movePhotoTo(photo, caretAt(editor, 2))).toBe(false);
    expect(read(editor)).toBe('一二三□四五');
  });

  it('本文の先頭と末尾へも動かせる', () => {
    const { editor, photo } = body();
    expect(movePhotoTo(photo, caretAt(editor, 0))).toBe(true);
    expect(read(editor)).toBe('□一二三四五');
    expect(movePhotoTo(photo, caretAt(editor, editor.childNodes.length))).toBe(true);
    expect(read(editor)).toBe('一二三四五□');
  });

  it('本文の上端より上は先頭、下端より下は末尾', () => {
    const { editor } = body();
    vi.spyOn(editor, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 100, 390, 300));
    const above = dropRangeAt(editor, 10, 50);
    const below = dropRangeAt(editor, 10, 900);
    expect([above?.startContainer, above?.startOffset]).toEqual([editor, 0]);
    expect([below?.startContainer, below?.startOffset]).toEqual([editor, 3]);
  });

  it('本文の中の点は、その点の文字の位置。本文の外を指す位置は使わない', () => {
    const { editor, tail } = body();
    vi.spyOn(editor, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 100, 390, 300));
    const inside = caretAt(tail, 1);
    const outside = caretAt(document.body, 0);
    let next = inside;
    Object.defineProperty(document, 'caretRangeFromPoint', {
      configurable: true,
      value: () => next,
    });
    expect(dropRangeAt(editor, 10, 200)).toBe(inside);
    next = outside;
    expect(dropRangeAt(editor, 10, 200)).toBeNull();
  });
});
