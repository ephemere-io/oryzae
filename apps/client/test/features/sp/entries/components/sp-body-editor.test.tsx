import { INLINE_IMAGE_PLACEHOLDER } from '@oryzae/shared';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { createRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { InlinePhoto } from '@/features/shared/entries/types';
import {
  SpBodyEditor,
  type SpBodyEditorHandle,
} from '@/features/sp/entries/components/sp-body-editor';
import jaMessages from '@/i18n/messages/ja.json';

const P = INLINE_IMAGE_PLACEHOLDER;

/** 本文の中の 1 枚（SP の既定の見た目）。 */
function photo(storagePath: string, signedUrl: string): InlinePhoto {
  return { storagePath, signedUrl, widthRatio: 1, layout: 'block', align: 'start' };
}

function setup(body: string, images: InlinePhoto[], selectedImage: number | null = null) {
  const onChange = vi.fn();
  const onSelectImage = vi.fn();
  const ref = createRef<SpBodyEditorHandle>();
  render(
    <NextIntlClientProvider locale="ja" messages={jaMessages}>
      <SpBodyEditor
        ref={ref}
        initialBody={body}
        initialImages={images}
        onChange={onChange}
        selectedImage={selectedImage}
        onSelectImage={onSelectImage}
        placeholder="本文"
        ariaLabel="本文"
        style={{ fontFamily: 'serif' }}
      />
    </NextIntlClientProvider>,
  );
  const editor = screen.getByRole('textbox', { name: '本文' });
  return { onChange, onSelectImage, ref, editor };
}

function photos(editor: HTMLElement): HTMLImageElement[] {
  return [...editor.querySelectorAll<HTMLImageElement>('img.inline-photo')];
}

describe('SpBodyEditor（contentEditable の本文。写真は本文の中）', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('本文の文字と、プレースホルダの位置の写真を描く', () => {
    const { editor } = setup(`前${P}後`, [photo('p/1.jpg', 'https://signed/1')]);
    expect(editor.textContent).toBe('前後');
    const [img] = photos(editor);
    expect(img?.getAttribute('src')).toBe('https://signed/1');
    expect(img?.previousSibling?.textContent).toBe('前');
    expect(img?.nextSibling?.textContent).toBe('後');
  });

  it('空の本文には案内の印を付け、書けば外す', () => {
    const { editor, onChange } = setup('', []);
    expect(editor.dataset.empty).toBe('true');
    editor.textContent = '書いた';
    fireEvent.input(editor);
    expect(onChange).toHaveBeenLastCalledWith({ body: '書いた', images: [] });
    expect(editor.dataset.empty).toBe('false');
  });

  it('書き足すと、写真の位置（U+FFFC）を保った本文と写真を知らせる', () => {
    const { editor, onChange } = setup(`前${P}後`, [photo('p/1.jpg', 'x')]);
    const tail = photos(editor)[0]?.nextSibling;
    if (!tail) throw new Error('写真の後ろの文字が無い');
    tail.textContent = '後ろに足した';
    fireEvent.input(editor);
    expect(onChange).toHaveBeenLastCalledWith({
      body: `前${P}後ろに足した`,
      images: [photo('p/1.jpg', 'x')],
    });
  });

  it('写真の見た目を変えると、回り込みは float になる', () => {
    const { editor, ref } = setup(`前${P}後`, [photo('p/1.jpg', 'x')]);
    let snapshot: ReturnType<SpBodyEditorHandle['updateImage']> | undefined;
    act(() => {
      snapshot = ref.current?.updateImage(0, { layout: 'wrap', widthRatio: 0.4, align: 'end' });
    });
    expect(snapshot?.images[0]).toMatchObject({ layout: 'wrap', widthRatio: 0.4, align: 'end' });
    expect(photos(editor)[0]?.dataset.layout).toBe('wrap');
    expect(photos(editor)[0]?.style.float).not.toBe('');
  });

  it('写真を抜くと、本文からプレースホルダが消える', () => {
    const { editor, ref } = setup(`前${P}後`, [photo('p/1.jpg', 'x')]);
    let snapshot: ReturnType<SpBodyEditorHandle['removeImage']> | undefined;
    act(() => {
      snapshot = ref.current?.removeImage(0);
    });
    expect(snapshot).toEqual({ body: '前後', images: [] });
    expect(photos(editor)).toHaveLength(0);
  });

  it('カーソルが無ければ、写真は末尾に入る', () => {
    const { ref } = setup('本文', []);
    let snapshot: ReturnType<SpBodyEditorHandle['insertPhoto']> | undefined;
    act(() => {
      snapshot = ref.current?.insertPhoto(photo('p/2.jpg', 'https://signed/2'));
    });
    expect(snapshot?.body).toBe(`本文${P}`);
    expect(snapshot?.images).toEqual([photo('p/2.jpg', 'https://signed/2')]);
  });

  it('起こした文字は、直前が改行でなければ改行を挟んで入る', () => {
    const { ref } = setup('本文', []);
    let snapshot: ReturnType<SpBodyEditorHandle['insertText']> | undefined;
    act(() => {
      snapshot = ref.current?.insertText('起こした文');
    });
    expect(snapshot?.body).toBe('本文\n起こした文');
  });

  it('端末の写しで中身を丸ごと入れ替えられる', () => {
    const { editor, ref } = setup('古い', []);
    act(() => {
      ref.current?.setContent(`新しい${P}`, [photo('p/3.jpg', 'y')]);
    });
    expect(editor.textContent).toBe('新しい');
    expect(photos(editor)).toHaveLength(1);
  });

  it('写真を押すと選ぶ。選んでいる写真を押すと外す', () => {
    const first = setup(`前${P}後`, [photo('p/1.jpg', 'x')]);
    const img = photos(first.editor)[0];
    if (!img) throw new Error('写真が無い');
    fireEvent.click(img);
    expect(first.onSelectImage).toHaveBeenLastCalledWith(0);
    cleanup();

    const second = setup(`前${P}後`, [photo('p/1.jpg', 'x')], 0);
    const selected = photos(second.editor)[0];
    if (!selected) throw new Error('写真が無い');
    expect(selected.hasAttribute('data-selected')).toBe(true);
    fireEvent.click(selected);
    expect(second.onSelectImage).toHaveBeenLastCalledWith(null);
  });

  it('選んだ写真を掴んで離すと、離した点の文字の位置へ動く', () => {
    const { editor, onChange, onSelectImage } = setup(`一二三${P}四五`, [photo('p/1.jpg', 'x')], 0);
    const img = photos(editor)[0];
    const head = editor.firstChild;
    if (!img || !(head instanceof Text)) throw new Error('前提の DOM が無い');
    // 配置を計算しない環境なので、箱と「点の文字の位置」を与える。
    vi.spyOn(img, 'getBoundingClientRect').mockReturnValue(new DOMRect(100, 100, 50, 50));
    vi.spyOn(editor, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 390, 800));
    const drop = document.createRange();
    drop.setStart(head, 1);
    drop.collapse(true);
    Object.defineProperty(document, 'caretRangeFromPoint', {
      configurable: true,
      value: () => drop,
    });
    try {
      fireEvent.pointerDown(img, { pointerId: 1, isPrimary: true, clientX: 120, clientY: 120 });
      fireEvent.pointerMove(window, { pointerId: 1, clientX: 20, clientY: 10 });
      fireEvent.pointerUp(window, { pointerId: 1, clientX: 20, clientY: 10 });
    } finally {
      Reflect.deleteProperty(document, 'caretRangeFromPoint');
    }
    expect(onChange).toHaveBeenLastCalledWith({
      body: `一${P}二三四五`,
      images: [photo('p/1.jpg', 'x')],
    });
    expect(onSelectImage).toHaveBeenLastCalledWith(0);
    expect(img.hasAttribute('data-dragging')).toBe(false);
  });

  it('写真の箱の中で離したら動かさない', () => {
    const { editor, onChange } = setup(`一二三${P}四五`, [photo('p/1.jpg', 'x')], 0);
    const img = photos(editor)[0];
    if (!img) throw new Error('写真が無い');
    vi.spyOn(img, 'getBoundingClientRect').mockReturnValue(new DOMRect(100, 100, 50, 50));
    fireEvent.pointerDown(img, { pointerId: 1, isPrimary: true, clientX: 120, clientY: 120 });
    fireEvent.pointerUp(window, { pointerId: 1, clientX: 125, clientY: 125 });
    expect(onChange).not.toHaveBeenCalled();
  });
});
