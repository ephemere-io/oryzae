import { INLINE_IMAGE_PLACEHOLDER, type InlineImage } from '@oryzae/shared';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { extractEditorEffects } from '@/features/pc/entries/utils/editor-effects-codec';
import {
  applyInlineImageStyle,
  applyInlineImagesToEditor,
  extractInlineImages,
  inlineImageSizeStepIndex,
  inlineImageSizeSteps,
  inlineImageWidthRatio,
  serializeEditorText,
} from '@/features/shared/entries/utils/inline-image-codec';

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
      { offset: 0, storagePath: '', widthRatio: 0.3, layout: 'inline', align: 'start' },
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

  it('表示設定（幅・回り込み・寄せ・比率）が保たれる', () => {
    const after = roundTrip(
      img({
        'data-storage-path': 'p1',
        'data-width-ratio': '0.75',
        'data-layout': 'wrap',
        'data-align': 'end',
        'data-aspect': '1.5',
      }),
    );

    expect(after.images[0]).toEqual({
      offset: 0,
      storagePath: 'p1',
      widthRatio: 0.75,
      layout: 'wrap',
      align: 'end',
      aspect: 1.5,
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
      [{ offset: 3, storagePath: 'p1', widthRatio: 0.4, layout: 'inline', align: 'start' }],
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
      [{ offset: 1, storagePath: 'p1', widthRatio: 0.4, layout: 'inline', align: 'start' }],
      new Map(),
    );

    expect(extractInlineImages(restored)).toHaveLength(1);
    expect(serializeEditorText(restored)).toBe(`あ${INLINE_IMAGE_PLACEHOLDER}い`);
    restored.remove();
  });
});

/**
 * 差し込む大きさは写真の向きで決まる。**縦書きに横長を広く置くと紙をまたぐ**ので、
 * 長辺が行と直交するときだけ狭くする（レビュー #626）。
 *
 * 値は実機レビューで 0.8 / 0.5 から 0.6 / 0.3 へ下げた（縦書きに縦長を置くと
 * 「小」でも中〜大に見えていた）。直交するときは行に沿うときの半分。
 */
describe('inlineImageWidthRatio', () => {
  const portrait = { naturalWidth: 600, naturalHeight: 900 };
  const landscape = { naturalWidth: 900, naturalHeight: 600 };

  it('縦書き × 縦長 — 長辺が行と同じ向きなので広く', () => {
    expect(inlineImageWidthRatio({ ...portrait, isVertical: true })).toBe(0.6);
  });

  it('縦書き × 横長 — 長辺が行と直交するので狭く', () => {
    expect(inlineImageWidthRatio({ ...landscape, isVertical: true })).toBe(0.3);
  });

  it('横書き × 縦長 — 長辺が行と直交するので狭く', () => {
    expect(inlineImageWidthRatio({ ...portrait, isVertical: false })).toBe(0.3);
  });

  it('横書き × 横長 — 長辺が行と同じ向きなので広く', () => {
    expect(inlineImageWidthRatio({ ...landscape, isVertical: false })).toBe(0.6);
  });

  it('正方形は行に沿うものとして扱う', () => {
    const square = { naturalWidth: 800, naturalHeight: 800 };
    expect(inlineImageWidthRatio({ ...square, isVertical: true })).toBe(0.6);
    expect(inlineImageWidthRatio({ ...square, isVertical: false })).toBe(0.6);
  });

  // 署名切れなどで実寸が測れないことがある。そこで広いほうに倒すと、縦長が画面を覆う。
  it('実寸が測れないときは狭いほうに倒す', () => {
    expect(inlineImageWidthRatio({ naturalWidth: 0, naturalHeight: 0, isVertical: false })).toBe(
      0.3,
    );
    expect(
      inlineImageWidthRatio({ naturalWidth: Number.NaN, naturalHeight: 900, isVertical: true }),
    ).toBe(0.3);
  });
});

/**
 * 大きさの 3 段。**差し込んだ大きさが必ず「中」になる**のが要点。
 * 以前は 0.5 / 0.8 / 1.0 の固定 3 段で、同じ既定値が縦長なら「中」・横長なら「小」に化けていた。
 */
describe('inlineImageSizeSteps', () => {
  it('行に沿う写真は 0.4 / 0.6 / 1.0', () => {
    expect(inlineImageSizeSteps(true)).toEqual([0.4, 0.6, 1]);
  });

  it('行と直交する写真はその半分', () => {
    expect(inlineImageSizeSteps(false)).toEqual([0.2, 0.3, 0.5]);
  });

  it('中は差し込んだときの大きさと一致する', () => {
    const portrait = { naturalWidth: 600, naturalHeight: 900 };
    expect(inlineImageSizeSteps(true)[1]).toBe(
      inlineImageWidthRatio({ ...portrait, isVertical: true }),
    );
    expect(inlineImageSizeSteps(false)[1]).toBe(
      inlineImageWidthRatio({ ...portrait, isVertical: false }),
    );
  });

  // 自由変形した後は段の値からずれる。いちばん近い段の名前で呼ぶ。
  it('段から外れた割合はいちばん近い段として数える', () => {
    const steps = inlineImageSizeSteps(true);
    expect(inlineImageSizeStepIndex(0.42, steps)).toBe(0);
    expect(inlineImageSizeStepIndex(0.58, steps)).toBe(1);
    expect(inlineImageSizeStepIndex(0.95, steps)).toBe(2);
  });
});

/**
 * 写真のまわりの余白。**文字が来る側だけ空ける**（#626 のレビュー）。
 *
 * 隣の行との間（block 軸）は両側とも 1em。寄せの軸（inline 軸）は、寄せた側＝行の端に
 * 着くべき側を 0 にする。ここに余白を入れると、写真だけが隣の行の頭より 1 文字ぶん
 * 内側に落ちて行がそろわない。
 */
describe('写真のまわりの余白', () => {
  function styled(over: Partial<InlineImage>): HTMLImageElement {
    const el = document.createElement('img');
    applyInlineImageStyle(el, {
      offset: 0,
      storagePath: 'p1',
      widthRatio: 0.6,
      layout: 'block',
      align: 'center',
      ...over,
    });
    return el;
  }

  it('block は文字の側（block 軸）に余白を置く', () => {
    expect(styled({ layout: 'block' }).style.marginBlock).toBe('1em');
  });

  // 寄せた側は行の端。ここに余白を足すと、写真だけが隣の行の頭より内側に落ちる。
  it('寄せた側は 0 のまま（行の端にそろえる）', () => {
    expect(styled({ layout: 'block', align: 'start' }).style.marginInline).toBe('0 auto');
    expect(styled({ layout: 'block', align: 'end' }).style.marginInline).toBe('auto 0');
    expect(styled({ layout: 'block', align: 'center' }).style.marginInline).toBe('auto');
  });

  it('回り込みは寄せた側 0・文字が流れ込む側だけ空ける', () => {
    const start = styled({ layout: 'wrap', align: 'start' });
    expect(start.style.marginBlock).toBe('1em');
    expect(start.style.marginInline).toBe('0 1em');
    // 終わり寄せなら逆側に付く（`0 1em` のままだと寄せた側にだけ余白が残る）。
    expect(styled({ layout: 'wrap', align: 'end' }).style.marginInline).toBe('1em 0');
  });

  // 行いっぱいに余白を足すと、そのぶんだけ行からはみ出す。
  it('余白がある軸だけ天井を下げる', () => {
    // ふつうの配置は寄せた側が 0 なので、行いっぱいがそのまま入る。
    expect(styled({ widthRatio: 1, layout: 'block' }).style.maxInlineSize).toBe('');
    expect(styled({ widthRatio: 1, layout: 'wrap' }).style.maxInlineSize).toBe('calc(100% - 1em)');
    // CSS 側は `calc(100% - 2 * 1em)` と書くが、ブラウザが掛け算を畳んでから返す。
    expect(styled({ widthRatio: 1, layout: 'inline' }).style.maxInlineSize).toBe(
      'calc(100% - 2em)',
    );
  });
});

function editorHtmlWithImages(): string {
  return (
    `冒頭の文${img({ 'data-storage-path': 'p1', 'data-width-ratio': '0.5' })}` +
    `つづき<br>改行のあと${img({ 'data-storage-path': 'p2', 'data-layout': 'block' })}おわり`
  );
}
