import { INLINE_IMAGE_PLACEHOLDER } from '@oryzae/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { extractEditorEffects } from '@/features/pc/entries/utils/editor-effects-codec';
import {
  extractInlineImages,
  serializeEditorText,
} from '@/features/pc/entries/utils/inline-image-codec';

function img(attrs: Record<string, string> = {}): string {
  const data = Object.entries(attrs)
    .map(([k, v]) => `${k}="${v}"`)
    .join(' ');
  return `<img class="inline-photo" src="blob:x" ${data}>`;
}

describe('serializeEditorText', () => {
  let editor: HTMLDivElement;

  beforeEach(() => {
    editor = document.createElement('div');
    editor.contentEditable = 'true';
    document.body.appendChild(editor);
  });

  afterEach(() => {
    editor.remove();
  });

  it('写真が無ければ従来どおりの本文になる', () => {
    editor.innerHTML = 'ab<br>cd';
    expect(serializeEditorText(editor)).toBe('ab\ncd');
  });

  it('block 要素は前に改行を入れる（先頭は入れない）', () => {
    editor.innerHTML = '<div>one</div><div>two</div>';
    expect(serializeEditorText(editor)).toBe('one\ntwo');
  });

  // ここが本題。innerText では <img> が 1 文字も残らず、位置が保存できない。
  it('写真をプレースホルダ 1 文字として書き出す', () => {
    editor.innerHTML = `ab${img()}cd`;
    expect(serializeEditorText(editor)).toBe(`ab${INLINE_IMAGE_PLACEHOLDER}cd`);
    expect(serializeEditorText(editor)).toHaveLength(5);
  });

  it('装飾 span の中身は 1 つの文字列として数える（子に潜らない）', () => {
    editor.innerHTML =
      'x<span class="eblock" data-mode="fontSize" data-t="0.5" data-duration="200">abc</span>y';
    expect(serializeEditorText(editor)).toBe('xabcy');
  });
});

describe('extractInlineImages', () => {
  let editor: HTMLDivElement;

  beforeEach(() => {
    editor = document.createElement('div');
    document.body.appendChild(editor);
  });

  afterEach(() => {
    editor.remove();
  });

  it('位置と表示設定を読み出す', () => {
    editor.innerHTML = `ab${img({
      'data-storage-path': 'u1/1-a.jpg',
      'data-width-ratio': '0.6',
      'data-layout': 'wrap',
      'data-align': 'end',
    })}cd`;

    expect(extractInlineImages(editor)).toEqual([
      { offset: 2, storagePath: 'u1/1-a.jpg', widthRatio: 0.6, layout: 'wrap', align: 'end' },
    ]);
  });

  it('複数枚のオフセットがプレースホルダの位置と一致する', () => {
    editor.innerHTML = `a${img({ 'data-storage-path': 'p1' })}bc${img({ 'data-storage-path': 'p2' })}`;

    const text = serializeEditorText(editor);
    const images = extractInlineImages(editor);

    expect(images.map((i) => i.offset)).toEqual([1, 4]);
    // 保存した本文を実際に読み直しても、同じ位置にプレースホルダがある。
    for (const image of images) {
      expect(text[image.offset]).toBe(INLINE_IMAGE_PLACEHOLDER);
    }
  });

  // 壊れた属性で写真ごと落とすと、本文にプレースホルダだけが残って復元不能になる。
  it('属性が壊れていても既定値に丸めて拾う', () => {
    editor.innerHTML = img({ 'data-width-ratio': 'NaN', 'data-layout': 'bogus', 'data-align': '' });

    expect(extractInlineImages(editor)).toEqual([
      { offset: 0, storagePath: '', widthRatio: 0.4, layout: 'inline', align: 'start' },
    ]);
  });

  it('範囲外の幅は 0.05〜1.0 に収める', () => {
    editor.innerHTML = img({ 'data-width-ratio': '5' }) + img({ 'data-width-ratio': '0.001' });
    expect(extractInlineImages(editor).map((i) => i.widthRatio)).toEqual([1, 0.05]);
  });

  it('印の無い <img> は本文中の写真として扱わない', () => {
    editor.innerHTML = 'a<img src="blob:x">b';
    expect(extractInlineImages(editor)).toEqual([]);
    expect(serializeEditorText(editor)).toBe('ab');
  });
});

/**
 * 装飾（textSpans）と写真は別々の walker がオフセットを数えている。ここがずれると
 * 「文字を装飾したのに、保存して開くと別の場所が装飾されている」という壊れ方をする。
 * 両者が同じ DOM に対して同じ数え方をしていることを固定する。
 */
describe('editor-effects-codec とオフセットの数え方が一致する', () => {
  let editor: HTMLDivElement;

  beforeEach(() => {
    editor = document.createElement('div');
    document.body.appendChild(editor);
  });

  afterEach(() => {
    editor.remove();
  });

  it('写真をまたいだ装飾が、本文テキスト上の同じ位置を指す', () => {
    // ab [写真] cd<装飾>ef</装飾>
    editor.innerHTML =
      `ab${img({ 'data-storage-path': 'p1' })}cd` +
      '<span class="eblock" data-mode="fontSize" data-t="0.5" data-duration="200">ef</span>';

    const text = serializeEditorText(editor);
    const span = extractEditorEffects(editor, undefined)?.textSpans?.[0];

    expect(span).toBeDefined();
    // 写真が 1 文字を占めるので 'ef' は 5 文字目から。
    expect(text.slice(span?.start, span?.end)).toBe('ef');
  });

  it('写真が複数あっても装飾の位置がずれない', () => {
    editor.innerHTML =
      `${img({ 'data-storage-path': 'p1' })}x${img({ 'data-storage-path': 'p2' })}` +
      '<span class="v-block" style="font-size: 1.5em">yz</span>';

    const text = serializeEditorText(editor);
    const span = extractEditorEffects(editor, undefined)?.textSpans?.[0];

    expect(text.slice(span?.start, span?.end)).toBe('yz');
  });
});
