import { INLINE_IMAGE_PLACEHOLDER, type InlineImage } from '@oryzae/shared';

/**
 * 本文中に置いた写真の DOM ↔ 保存形式の変換。
 *
 * **`content` の作り方が innerText から変わる。** これまで本文は `editor.innerText` を
 * そのまま保存していたが、`<img>` は innerText に 1 文字も残さないため、それでは
 * 「本文のどこに写真があるか」が保存できない。ここでは同じ規則で DOM を歩きつつ、
 * 写真を `INLINE_IMAGE_PLACEHOLDER`（U+FFFC）1 文字として書き出す。
 *
 * 文字オフセットの規則は `editor-effects-codec.ts` と**同一でなければならない**
 * （両者がずれると、装飾と写真が別の位置を指す）:
 *   - text node はそのままの文字数
 *   - `<br>` は 1 文字（`\n`）
 *   - block element は、前にコンテンツがあれば content の前に 1 文字（`\n`）
 *   - effect span (`eblock` / `v-block`) は子テキストの長さ。子には潜らない
 *   - 本文中の写真は 1 文字（U+FFFC）
 * この一致は `inline-image-codec.test.ts` の「codec と同じオフセットを返す」で固定してある。
 */

/** 本文中に置いた写真の `<img>` に付ける印。装飾用の span と区別するために使う。 */
export const INLINE_IMAGE_CLASS = 'inline-photo';

const EBLOCK_CLASS = 'eblock';
const VBLOCK_CLASS = 'v-block';

const DEFAULT_WIDTH_RATIO = 0.4;

export function isInlineImage(node: Node): node is HTMLImageElement {
  return node instanceof HTMLImageElement && node.classList.contains(INLINE_IMAGE_CLASS);
}

function isBlock(el: HTMLElement): boolean {
  const tag = el.tagName;
  return tag === 'DIV' || tag === 'P' || tag === 'LI' || tag === 'BLOCKQUOTE' || tag === 'PRE';
}

function isEffectSpan(el: HTMLElement): boolean {
  return el.classList.contains(EBLOCK_CLASS) || el.classList.contains(VBLOCK_CLASS);
}

interface WalkState {
  text: string;
  images: InlineImage[];
}

/**
 * editor DOM を本文テキストに落とす。写真は U+FFFC 1 文字になる。
 * 写真が 1 枚も無ければ、結果は従来の `innerText` と一致する。
 */
export function serializeEditorText(editor: HTMLElement): string {
  return walk(editor, { text: '', images: [] }).text;
}

/** 本文テキストと、そこに埋まった写真の一覧を同時に取り出す。 */
export function extractInlineImages(editor: HTMLElement): InlineImage[] {
  return walk(editor, { text: '', images: [] }).images;
}

function walk(node: Node, state: WalkState): WalkState {
  const children = node.childNodes;
  for (let i = 0; i < children.length; i++) {
    visit(children[i], state);
  }
  return state;
}

function visit(node: Node, state: WalkState): void {
  if (node.nodeType === Node.TEXT_NODE) {
    state.text += node.textContent ?? '';
    return;
  }
  if (isInlineImage(node)) {
    state.images.push(readInlineImage(node, state.text.length));
    state.text += INLINE_IMAGE_PLACEHOLDER;
    return;
  }
  if (!(node instanceof HTMLElement)) return;
  const el = node;
  if (el.tagName === 'BR') {
    state.text += '\n';
    return;
  }
  if (isBlock(el) && state.text.length > 0) {
    state.text += '\n';
  }
  if (isEffectSpan(el)) {
    // 装飾 span は不透明な 1 つの文字列として扱う（子には潜らない）。
    // codec 側の走査と揃えるためで、ここを変えると両者のオフセットがずれる。
    state.text += el.textContent ?? '';
    return;
  }
  walk(el, state);
}

/** `<img>` の data 属性から保存形式を読む。壊れた値は既定に丸めて写真を失わない。 */
function readInlineImage(el: HTMLImageElement, offset: number): InlineImage {
  const aspect = Number.parseFloat(el.dataset.aspect ?? '');
  return {
    offset,
    storagePath: el.dataset.storagePath ?? '',
    widthRatio: readRatio(el.dataset.widthRatio),
    layout: readLayout(el.dataset.layout),
    align: readAlign(el.dataset.align),
    // 自由変形していないときは書かない（写真本来の比率を使う）。
    ...(Number.isFinite(aspect) && aspect > 0 ? { aspect } : {}),
  };
}

function readRatio(raw: string | undefined): number {
  const n = Number.parseFloat(raw ?? '');
  if (!Number.isFinite(n)) return DEFAULT_WIDTH_RATIO;
  return Math.min(1, Math.max(0.05, n));
}

function readLayout(raw: string | undefined): InlineImage['layout'] {
  return raw === 'block' || raw === 'wrap' ? raw : 'inline';
}

function readAlign(raw: string | undefined): InlineImage['align'] {
  return raw === 'center' || raw === 'end' ? raw : 'start';
}

/**
 * 保存形式を `<img>` の見た目に反映する。
 *
 * **論理プロパティ（inline-size / block-size）を使うのが要点。** 縦書き（vertical-rl）では
 * inline 軸が上下、block 軸が左右になる。`width: 40%` と書くと縦書きでは
 * 「横スクロール方向の 40%」という無意味な値になるが、`inline-size: 40%` なら
 * 横書きでは行幅の 40%、縦書きでは行の高さの 40% と、どちらでも「1 行に対する割合」になる。
 */
export function applyInlineImageStyle(el: HTMLImageElement, image: InlineImage): void {
  el.dataset.storagePath = image.storagePath;
  el.dataset.widthRatio = String(image.widthRatio);
  el.dataset.layout = image.layout;
  el.dataset.align = image.align;
  if (image.aspect) {
    el.dataset.aspect = String(image.aspect);
  } else {
    el.removeAttribute('data-aspect');
  }

  el.style.inlineSize = `${image.widthRatio * 100}%`;
  // 自由変形したときだけ比率を固定する。既定は写真本来の比率に任せる。
  el.style.blockSize = 'auto';
  el.style.aspectRatio = image.aspect ? `1 / ${image.aspect}` : '';

  applyLayoutStyle(el, image);
}

function applyLayoutStyle(el: HTMLImageElement, image: InlineImage): void {
  // 一旦すべて解除してから当てる。モードを切り替えたとき前の指定が残らないように。
  el.style.display = '';
  el.style.float = '';
  el.style.marginInline = '';
  el.style.marginBlock = '';
  el.style.verticalAlign = '';

  if (image.layout === 'inline') {
    // 文字と同じ流れに置く。大きな 1 文字として振る舞う。
    el.style.display = 'inline-block';
    el.style.verticalAlign = 'middle';
    return;
  }

  if (image.layout === 'block') {
    // 独立した行を占める。寄せは inline 軸のマージンで作る
    // （横書きなら左右、縦書きなら上下に効く）。
    el.style.display = 'block';
    el.style.marginInline =
      image.align === 'center' ? 'auto' : image.align === 'end' ? 'auto 0' : '0 auto';
    return;
  }

  // wrap: 本文が写真を避けて流れる。物理方向ではなく論理方向で寄せる
  // （縦書きでは inline-start が上、inline-end が下になる）。
  el.style.float = image.align === 'end' ? 'inline-end' : 'inline-start';
  el.style.marginBlock = '0.25em';
  el.style.marginInline = '0 0.5em';
}

/** 本文中に置く `<img>` を作る。`src` は署名付き URL（失効するので保存はしない）。 */
export function createInlineImageElement(image: InlineImage, signedUrl: string): HTMLImageElement {
  const el = document.createElement('img');
  el.className = INLINE_IMAGE_CLASS;
  el.src = signedUrl;
  el.alt = '';
  // contentEditable の中で画像自身が編集対象にならないようにする
  // （これが無いと Chrome が画像内にキャレットを置こうとする）。
  el.contentEditable = 'false';
  el.draggable = false;
  applyInlineImageStyle(el, image);
  return el;
}
