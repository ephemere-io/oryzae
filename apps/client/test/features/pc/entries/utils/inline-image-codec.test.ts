import { INLINE_IMAGE_PLACEHOLDER, type InlineImage } from '@oryzae/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { extractEditorEffects } from '@/features/pc/entries/utils/editor-effects-codec';
import {
  applyInlineImagesToEditor,
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
      {
        offset: 2,
        storagePath: 'u1/1-a.jpg',
        widthRatio: 0.6,
        layout: 'block',
        align: 'center',
        rotation: 12,
      },
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

    // 壊れた値は捨てず、既定（幅 0.5・独立した行の中央）へ丸めて写真を残す。
    expect(extractInlineImages(editor)).toEqual([
      { offset: 0, storagePath: '', widthRatio: 0.5, layout: 'block', align: 'center' },
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
      layout: 'block',
      align: 'center',
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
      [{ offset: 3, storagePath: 'p1', widthRatio: 0.4, layout: 'block', align: 'center' }],
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
      [{ offset: 1, storagePath: 'p1', widthRatio: 0.4, layout: 'block', align: 'center' }],
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
 * 署名 URL が届かなかった写真の扱い。
 *
 * 「保存したのに写真が復活しない」という report の切り分けに要る。src を空にすると
 * `<img>` は**何も描かない**ので、位置は保っているのに消えたようにしか見えない。
 * 読み込めていないことが分かる状態で残す。
 */
describe('署名 URL が無いとき', () => {
  let editor: HTMLDivElement;

  beforeEach(() => {
    editor = document.createElement('div');
    document.body.appendChild(editor);
  });

  afterEach(() => {
    editor.remove();
  });

  it('本文から消さず、読み込めない印を付けて残す', () => {
    editor.textContent = `あ${INLINE_IMAGE_PLACEHOLDER}い`;

    applyInlineImagesToEditor(
      editor,
      [{ offset: 1, storagePath: 'p1', widthRatio: 0.5, layout: 'block', align: 'center' }],
      new Map(), // 署名できなかった
    );

    const img = editor.querySelector('img');
    expect(img).not.toBeNull();
    expect(img?.dataset.unavailable).toBe('true');
    // src を空文字で持たせると「壊れた画像」を読みに行って余計なリクエストが出る。
    expect(img?.hasAttribute('src')).toBe(false);
    // 位置は保つ。次の保存で写真の場所が失われないため。
    expect(serializeEditorText(editor)).toBe(`あ${INLINE_IMAGE_PLACEHOLDER}い`);
  });

  it('署名 URL があれば印は付かない', () => {
    editor.textContent = INLINE_IMAGE_PLACEHOLDER;

    applyInlineImagesToEditor(
      editor,
      [{ offset: 0, storagePath: 'p1', widthRatio: 0.5, layout: 'block', align: 'center' }],
      new Map([['p1', 'https://example.test/signed.jpg']]),
    );

    const img = editor.querySelector('img');
    expect(img?.getAttribute('src')).toBe('https://example.test/signed.jpg');
    expect(img?.dataset.unavailable).toBeUndefined();
  });

  // 復元 → そのまま保存、で写真の情報が落ちないこと。
  it('読み込めない写真も、保存し直したときに残る', () => {
    editor.textContent = `${INLINE_IMAGE_PLACEHOLDER}本文`;

    applyInlineImagesToEditor(
      editor,
      [
        {
          offset: 0,
          storagePath: 'p1',
          widthRatio: 0.75,
          layout: 'block',
          align: 'center',
          rotation: 5,
        },
      ],
      new Map(),
    );

    expect(extractInlineImages(editor)).toEqual([
      {
        offset: 0,
        storagePath: 'p1',
        widthRatio: 0.75,
        layout: 'block',
        align: 'center',
        rotation: 5,
      },
    ]);
  });
});
