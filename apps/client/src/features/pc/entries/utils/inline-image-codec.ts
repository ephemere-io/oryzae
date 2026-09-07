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
const INLINE_IMAGE_CLASS = 'inline-photo';

const EBLOCK_CLASS = 'eblock';
const VBLOCK_CLASS = 'v-block';

/** 長辺が行方向に沿うときの幅（本文 1 行に対する割合）。 */
const INLINE_IMAGE_WIDE_RATIO = 0.8;
/** 長辺が行と直交するときの幅。 */
const INLINE_IMAGE_NARROW_RATIO = 0.5;
// 向きが読めないときは INLINE_IMAGE_NARROW_RATIO に倒す（本文を潰さない側）。

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
export function readInlineImageFromElement(el: HTMLImageElement): InlineImage {
  return readInlineImage(el, 0);
}

function readInlineImage(el: HTMLImageElement, offset: number): InlineImage {
  const aspect = Number.parseFloat(el.dataset.aspect ?? '');
  const rotation = Number.parseFloat(el.dataset.rotation ?? '');
  return {
    offset,
    storagePath: el.dataset.storagePath ?? '',
    widthRatio: readRatio(el.dataset.widthRatio),
    // 自由変形していないときは書かない（写真本来の比率を使う）。
    ...(Number.isFinite(aspect) && aspect > 0 ? { aspect } : {}),
    ...(Number.isFinite(rotation) && rotation !== 0 ? { rotation } : {}),
  };
}

function readRatio(raw: string | undefined): number {
  const n = Number.parseFloat(raw ?? '');
  if (!Number.isFinite(n)) return INLINE_IMAGE_NARROW_RATIO;
  return Math.min(1, Math.max(0.05, n));
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
  if (image.aspect) {
    el.dataset.aspect = String(image.aspect);
  } else {
    el.removeAttribute('data-aspect');
  }
  if (image.rotation) {
    el.dataset.rotation = String(image.rotation);
  } else {
    el.removeAttribute('data-rotation');
  }

  el.style.inlineSize = `${image.widthRatio * 100}%`;
  // 自由変形したときだけ比率を固定する。既定は写真本来の比率に任せる。
  el.style.blockSize = 'auto';
  el.style.aspectRatio = image.aspect ? `1 / ${image.aspect}` : '';
  el.style.transform = image.rotation ? `rotate(${image.rotation}deg)` : '';

  // 配置は常に「独立した行の中央」。inline 軸のマージンで寄せるので、
  // 横書きなら左右中央、縦書きなら上下中央になる（物理方向を書かないのが要点）。
  el.style.display = 'block';
  el.style.marginInline = 'auto';
  el.style.marginBlock = '0.5em';
  // 掴んで動かせることを見せる。実際の移動は use-inline-image-selection が扱う。
  el.style.cursor = 'grab';
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

/**
 * 保存された本文（プレースホルダ入り）と `inlineImages` から、editor DOM を復元する。
 *
 * **`applyTextSpansToEditor` より先に呼ぶこと。** 装飾のオフセットは写真を 1 文字として
 * 数えているので、先に写真を実体化しておけば両者の数え方が一致する。順番を逆にすると、
 * 装飾で包んだテキストノードの内側にプレースホルダが残り、置換に失敗する。
 *
 * @param editor `textContent` に保存済み本文がセット済みの editor 要素
 * @param images 保存された写真（`offset` 昇順でなくてよい）
 * @param signedUrlByPath storagePath → 表示用 URL。署名に失敗したものは空文字で入る
 */
export function applyInlineImagesToEditor(
  editor: HTMLElement,
  images: InlineImage[],
  signedUrlByPath: Map<string, string>,
): void {
  if (images.length === 0) return;

  // 後ろから置換する。前から置くと、置換のたびに以降のオフセットがずれる。
  const ordered = [...images].sort((a, b) => b.offset - a.offset);
  for (const image of ordered) {
    const found = locatePlaceholder(editor, image.offset);
    if (!found) continue; // 本文と effects が食い違っている。写真を落として本文を守る。
    const node = createInlineImageElement(image, signedUrlByPath.get(image.storagePath) ?? '');
    replaceCharWithNode(found.node, found.offset, node);
  }
}

interface FoundChar {
  node: Text;
  offset: number;
}

/** 指定オフセットにあるプレースホルダのテキストノードと、その中での位置を返す。 */
function locatePlaceholder(editor: HTMLElement, offset: number): FoundChar | null {
  const walker = document.createTreeWalker(editor, NodeFilter.SHOW_TEXT);
  let cursor = 0;
  let current = walker.nextNode();
  while (current) {
    const text = current.textContent ?? '';
    if (offset < cursor + text.length) {
      const local = offset - cursor;
      if (text[local] !== INLINE_IMAGE_PLACEHOLDER) return null;
      // SHOW_TEXT なので Text のはずだが、キャストせず型ガードで確かめる。
      return current instanceof Text ? { node: current, offset: local } : null;
    }
    cursor += text.length;
    current = walker.nextNode();
  }
  return null;
}

/** テキストノードの 1 文字を要素に差し替える。 */
function replaceCharWithNode(node: Text, offset: number, replacement: Node): void {
  const after = node.splitText(offset);
  after.deleteData(0, 1); // プレースホルダ 1 文字を取り除く
  after.parentNode?.insertBefore(replacement, after);
}

/**
 * 差し込んだ直後の表示幅を、写真の向きと書字方向から決める。
 *
 * 一律 40% だと、縦書きに縦長の写真を入れたときだけ極端に小さく見える。行の方向と
 * 写真の長辺が揃っているかで決めると、どの組み合わせでも同じくらいの存在感になる:
 *
 * | 書字方向 | 写真   | 長辺の向き | 行に対する幅 |
 * |----------|--------|------------|--------------|
 * | 縦書き   | 縦長   | 行と同じ   | 80%          |
 * | 縦書き   | 横長   | 行と直交   | 50%          |
 * | 横書き   | 縦長   | 行と直交   | 50%          |
 * | 横書き   | 横長   | 行と同じ   | 80%          |
 *
 * つまり「**長辺が行方向に沿うなら 80%、そうでなければ 50%**」の 1 本の規則になる。
 */
export function defaultWidthRatioFor(
  naturalWidth: number,
  naturalHeight: number,
  isVertical: boolean,
): number {
  // 向きが読めない（読み込み前など）ときは、狭いほうに倒して本文を潰さない。
  if (!naturalWidth || !naturalHeight) return INLINE_IMAGE_NARROW_RATIO;
  const isPortrait = naturalHeight > naturalWidth;
  // 縦書きは行が縦に伸びるので、縦長の写真が「行に沿う」側になる。
  const longEdgeFollowsLine = isVertical ? isPortrait : !isPortrait;
  return longEdgeFollowsLine ? INLINE_IMAGE_WIDE_RATIO : INLINE_IMAGE_NARROW_RATIO;
}

/**
 * 写真の実寸を先に読む。差し込むときの既定幅を向きから決めるために要る。
 *
 * 読めなかった場合は 0 を返す。呼び出し側は既定幅にフォールバックして写真自体は差し込む
 * （寸法が分からないことを、写真を入れられない理由にしない）。
 */
export function loadNaturalSize(src: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    if (!src) {
      resolve({ width: 0, height: 0 });
      return;
    }
    const probe = new Image();
    probe.onload = () => resolve({ width: probe.naturalWidth, height: probe.naturalHeight });
    probe.onerror = () => resolve({ width: 0, height: 0 });
    probe.src = src;
  });
}
