import { INLINE_IMAGE_PLACEHOLDER, type InlineImage } from '@oryzae/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { extractEditorEffects } from '@/features/pc/entries/utils/editor-effects-codec';
import {
  applyInlineImagesToEditor,
  defaultWidthRatioFor,
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
      'data-rotation': '12',
    })}cd`;

    expect(extractInlineImages(editor)).toEqual([
      { offset: 2, storagePath: 'u1/1-a.jpg', widthRatio: 0.6, rotation: 12 },
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
    editor.innerHTML = img({ 'data-width-ratio': 'NaN', 'data-rotation': 'bogus' });

    expect(extractInlineImages(editor)).toEqual([{ offset: 0, storagePath: '', widthRatio: 0.5 }]);
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

/**
 * 保存 → 読み込みの往復。ここが壊れると「書いたのに開いたら写真が消えている」になる。
 * 実際の編集画面は content（プレースホルダ入りテキスト）と effects を別々に保存し、
 * 読み込み時に textContent へ戻してから写真を実体化する。その順序を再現している。
 */
describe('保存と復元の往復', () => {
  let editor: HTMLDivElement;

  beforeEach(() => {
    editor = document.createElement('div');
    document.body.appendChild(editor);
  });

  afterEach(() => {
    editor.remove();
  });

  function roundTrip(html: string): { text: string; images: InlineImage[] } {
    editor.innerHTML = html;
    const text = serializeEditorText(editor);
    const images = extractInlineImages(editor);

    // 保存されたものだけから作り直す。
    const restored = document.createElement('div');
    document.body.appendChild(restored);
    restored.textContent = text;
    applyInlineImagesToEditor(
      restored,
      images,
      new Map(images.map((i) => [i.storagePath, `signed:${i.storagePath}`])),
    );

    const result = {
      text: serializeEditorText(restored),
      images: extractInlineImages(restored),
    };
    restored.remove();
    return result;
  }

  it('本文と写真の位置がそのまま戻る', () => {
    const before = editorHtmlWithImages();
    editor.innerHTML = before;
    const expectedText = serializeEditorText(editor);
    const expectedImages = extractInlineImages(editor);

    const after = roundTrip(before);

    expect(after.text).toBe(expectedText);
    expect(after.images).toEqual(expectedImages);
  });

  it('写真が本文の先頭にあっても戻る', () => {
    const after = roundTrip(`${img({ 'data-storage-path': 'p1' })}あとの文`);
    expect(after.images.map((i) => i.offset)).toEqual([0]);
    expect(after.text.slice(1)).toBe('あとの文');
  });

  it('写真が連続していても戻る', () => {
    const after = roundTrip(
      img({ 'data-storage-path': 'p1' }) + img({ 'data-storage-path': 'p2' }),
    );
    expect(after.images.map((i) => i.storagePath)).toEqual(['p1', 'p2']);
    expect(after.images.map((i) => i.offset)).toEqual([0, 1]);
  });

  it('表示設定（幅・比率・傾き）が保たれる', () => {
    const after = roundTrip(
      img({
        'data-storage-path': 'p1',
        'data-width-ratio': '0.75',
        'data-aspect': '1.5',
        'data-rotation': '-8',
      }),
    );

    expect(after.images[0]).toEqual({
      offset: 0,
      storagePath: 'p1',
      widthRatio: 0.75,
      aspect: 1.5,
      rotation: -8,
    });
  });

  // effects だけ古い（本文から写真を消したのに effects が残っている）ケース。
  // ここで例外を投げると本文まで開けなくなる。
  it('本文にプレースホルダが無い写真は捨てて、本文は守る', () => {
    const restored = document.createElement('div');
    document.body.appendChild(restored);
    restored.textContent = 'プレースホルダの無い本文';

    applyInlineImagesToEditor(
      restored,
      [{ offset: 3, storagePath: 'p1', widthRatio: 0.4 }],
      new Map(),
    );

    expect(serializeEditorText(restored)).toBe('プレースホルダの無い本文');
    expect(extractInlineImages(restored)).toEqual([]);
    restored.remove();
  });

  // 署名切れは空文字で来る。ここで写真ごと消すと、次の保存で位置が失われる。
  it('署名 URL が無くても写真の位置は保つ', () => {
    const restored = document.createElement('div');
    document.body.appendChild(restored);
    restored.textContent = `あ${INLINE_IMAGE_PLACEHOLDER}い`;

    applyInlineImagesToEditor(
      restored,
      [{ offset: 1, storagePath: 'p1', widthRatio: 0.4 }],
      new Map(),
    );

    expect(extractInlineImages(restored)).toHaveLength(1);
    expect(serializeEditorText(restored)).toBe(`あ${INLINE_IMAGE_PLACEHOLDER}い`);
    restored.remove();
  });
});

function editorHtmlWithImages(): string {
  return (
    `冒頭の文${img({ 'data-storage-path': 'p1', 'data-width-ratio': '0.5' })}` +
    `つづき<br>改行のあと${img({ 'data-storage-path': 'p2', 'data-rotation': '5' })}おわり`
  );
}

/**
 * 差し込んだ直後の大きさ。一律だと、縦書きに縦長の写真を入れたときだけ極端に小さく見える。
 * 「長辺が行方向に沿うなら 80%、そうでなければ 50%」という 1 本の規則で 4 通りを満たす。
 */
describe('defaultWidthRatioFor', () => {
  const PORTRAIT = { w: 800, h: 1200 };
  const LANDSCAPE = { w: 1200, h: 800 };

  it('縦書き × 縦長 → 行に沿うので 80%', () => {
    expect(defaultWidthRatioFor(PORTRAIT.w, PORTRAIT.h, true)).toBe(0.8);
  });

  it('縦書き × 横長 → 行と直交するので 50%', () => {
    expect(defaultWidthRatioFor(LANDSCAPE.w, LANDSCAPE.h, true)).toBe(0.5);
  });

  it('横書き × 縦長 → 行と直交するので 50%', () => {
    expect(defaultWidthRatioFor(PORTRAIT.w, PORTRAIT.h, false)).toBe(0.5);
  });

  it('横書き × 横長 → 行に沿うので 80%', () => {
    expect(defaultWidthRatioFor(LANDSCAPE.w, LANDSCAPE.h, false)).toBe(0.8);
  });

  it('正方形は行と直交する側（狭いほう）に倒す', () => {
    expect(defaultWidthRatioFor(1000, 1000, true)).toBe(0.5);
    expect(defaultWidthRatioFor(1000, 1000, false)).toBe(0.8);
  });

  // 読み込み前などで実寸が取れないことがある。ここで 0 や NaN を返すと写真が潰れる。
  it('実寸が取れなくても狭いほうの既定に落ちる', () => {
    expect(defaultWidthRatioFor(0, 0, true)).toBe(0.5);
    expect(defaultWidthRatioFor(Number.NaN, 100, false)).toBe(0.5);
  });
});
