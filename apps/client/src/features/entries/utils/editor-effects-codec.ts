import type { EditorEffectsState, TextSpanMark } from '@oryzae/shared';

/**
 * editor の DOM ↔ `EditorEffectsState` のシリアライズ/デシリアライズ。
 * Issue #332 — 視覚エフェクトをエントリに紐づけて永続化する。
 *
 * 文字オフセットの基準は `editor.innerText`（既存の保存ロジックと一致）:
 *   - text node はそのままの文字数を消費
 *   - `<br>` は 1 文字 (`\n`)
 *   - block element (`<div>` 等) は、前にコンテンツがあれば content の前に 1 文字 (`\n`)
 *
 * span (eblock / v-block) はその子テキストの長さ分を消費する。子要素には潜らない。
 */

const EBLOCK_CLASS = 'eblock';
const VBLOCK_CLASS = 'v-block';

interface TraceLike {
  rx: number;
  ry: number;
  w: number;
  h: number;
  chars: string[];
  intensity: number;
  seed: number;
}

/** editor DOM を走査して `EditorEffectsState` を組み立てる。 */
export function extractEditorEffects(
  editor: HTMLElement,
  eraserTraces: TraceLike[] | undefined,
): EditorEffectsState | null {
  const textSpans = scanTextSpans(editor);
  const tracesSnapshot = eraserTraces && eraserTraces.length > 0 ? eraserTraces : undefined;

  if (textSpans.length === 0 && !tracesSnapshot) return null;

  return {
    version: 1,
    ...(textSpans.length > 0 ? { textSpans } : {}),
    ...(tracesSnapshot ? { eraserTraces: tracesSnapshot.map((t) => ({ ...t })) } : {}),
  };
}

/**
 * 保存された effects を editor DOM に再適用する。
 * - editor.textContent はすでに plain text がセットされている前提。
 * - textSpans を `start` 昇順で走査し、対応する text node 区間を `<span>` で wrap。
 * - eraserTraces の再描画は呼び出し側（useEraserTrace に initial state として渡す）。
 */
export function applyTextSpansToEditor(editor: HTMLElement, spans: TextSpanMark[]): void {
  if (spans.length === 0) return;
  const sorted = [...spans].sort((a, b) => a.start - b.start);
  for (const span of sorted) {
    if (span.start >= span.end) continue;
    wrapRange(editor, span);
  }
}

// -- internals -------------------------------------------------------------

function isBlock(el: HTMLElement): boolean {
  const tag = el.tagName;
  return tag === 'DIV' || tag === 'P' || tag === 'LI' || tag === 'BLOCKQUOTE' || tag === 'PRE';
}

function isEffectSpan(el: HTMLElement): boolean {
  return el.classList.contains(EBLOCK_CLASS) || el.classList.contains(VBLOCK_CLASS);
}

interface ScanState {
  cursor: number;
  marks: TextSpanMark[];
}

function scanTextSpans(editor: HTMLElement): TextSpanMark[] {
  const state: ScanState = { cursor: 0, marks: [] };
  walkScan(editor, null, state);
  return state.marks;
}

/**
 * `ancestor` は「現在の text node に対する effective eblock/v-block 祖先」。
 * CSS の inline style は最も内側が勝つので、ネストした eblock がある場合は
 * 一番内側 (最後に walkScan で更新された) の祖先の属性が描画上有効。
 * use-time-inscription が連続入力時に新しい span をカーソル位置の親 (= 既存の
 * eblock) の中に挿入してしまい、深い nest が生まれることがある (既存の挙動)
 * — 永続化側はこの構造をそのままシリアライズする必要がある。
 */
function walkScan(node: Node, ancestor: HTMLElement | null, state: ScanState): void {
  const children = node.childNodes;
  for (let i = 0; i < children.length; i++) {
    visitScan(children[i], ancestor, state);
  }
}

function visitScan(node: Node, ancestor: HTMLElement | null, state: ScanState): void {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.textContent ?? '';
    if (ancestor && text.length > 0) {
      const start = state.cursor;
      const end = start + text.length;
      const mark = markFromElement(ancestor, start, end);
      if (mark) state.marks.push(mark);
    }
    state.cursor += text.length;
    return;
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return;
  const el = node as HTMLElement;
  if (el.tagName === 'BR') {
    state.cursor += 1;
    return;
  }
  if (isBlock(el) && state.cursor > 0) {
    state.cursor += 1;
  }
  if (isEffectSpan(el)) {
    // Recurse with `el` as the new effective ancestor — its inline style wins
    // for any direct text descendants (until a further-nested eblock overrides).
    walkScan(el, el, state);
    return;
  }
  walkScan(el, ancestor, state);
}

function markFromElement(el: HTMLElement, start: number, end: number): TextSpanMark | null {
  if (el.classList.contains(VBLOCK_CLASS)) {
    const em = parseEm(el.style.fontSize);
    if (em == null) return null;
    return { kind: 'voice', start, end, fontSizeEm: em };
  }
  const mode = el.dataset.mode;
  if (mode === 'pressureBleed') {
    const intensity = Number.parseFloat(el.dataset.intensity ?? '');
    const seed = Number.parseInt(el.dataset.seed ?? '', 10);
    if (!Number.isFinite(intensity) || !Number.isFinite(seed)) return null;
    return { kind: 'pressure', start, end, intensity, seed };
  }
  if (mode === 'fontSize') {
    // Read the *resolved* font size that the time-inscription hook wrote, so
    // restoration is independent of the editor's current `settings.fontSize`.
    const fontSize = parsePx(el.style.fontSize);
    if (fontSize == null) return null;
    return { kind: 'time', start, end, mode: 'fontSize', fontSize };
  }
  if (mode === 'fontWeight') {
    const fontWeight = Number.parseInt(el.style.fontWeight, 10);
    if (!Number.isFinite(fontWeight)) return null;
    return { kind: 'time', start, end, mode: 'fontWeight', fontWeight };
  }
  return null;
}

function parsePx(input: string): number | null {
  if (!input.endsWith('px')) return null;
  const n = Number.parseFloat(input.slice(0, -2));
  return Number.isFinite(n) && n > 0 ? n : null;
}

function parseEm(input: string): number | null {
  if (!input.endsWith('em')) return null;
  const n = Number.parseFloat(input.slice(0, -2));
  return Number.isFinite(n) ? n : null;
}

interface LocatedRange {
  startNode: Node;
  startOffset: number;
  endNode: Node;
  endOffset: number;
}

interface LocateState {
  cursor: number;
  startNode: Node | null;
  startOffset: number;
  endNode: Node | null;
  endOffset: number;
  start: number;
  end: number;
}

function locateRange(editor: HTMLElement, start: number, end: number): LocatedRange | null {
  const state: LocateState = {
    cursor: 0,
    startNode: null,
    startOffset: 0,
    endNode: null,
    endOffset: 0,
    start,
    end,
  };
  walkLocate(editor, state);
  if (!state.startNode || !state.endNode) return null;
  return {
    startNode: state.startNode,
    startOffset: state.startOffset,
    endNode: state.endNode,
    endOffset: state.endOffset,
  };
}

function walkLocate(node: Node, state: LocateState): void {
  const children = node.childNodes;
  for (let i = 0; i < children.length; i++) {
    if (state.startNode && state.endNode) return;
    visitLocate(children[i], state);
  }
}

function visitLocate(node: Node, state: LocateState): void {
  if (node.nodeType === Node.TEXT_NODE) {
    const len = (node.textContent ?? '').length;
    const segStart = state.cursor;
    const segEnd = segStart + len;
    if (!state.startNode && state.start >= segStart && state.start <= segEnd) {
      state.startNode = node;
      state.startOffset = state.start - segStart;
    }
    if (!state.endNode && state.end >= segStart && state.end <= segEnd) {
      state.endNode = node;
      state.endOffset = state.end - segStart;
    }
    state.cursor = segEnd;
    return;
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return;
  const el = node as HTMLElement;
  if (el.tagName === 'BR') {
    state.cursor += 1;
    return;
  }
  if (isBlock(el) && state.cursor > 0) state.cursor += 1;
  if (isEffectSpan(el)) {
    // Treat the whole span as one opaque text run — we don't allow wrapping
    // ranges that overlap an existing effect span, so skip recursion.
    state.cursor += (el.textContent ?? '').length;
    return;
  }
  walkLocate(el, state);
}

function wrapRange(editor: HTMLElement, mark: TextSpanMark): void {
  const located = locateRange(editor, mark.start, mark.end);
  if (!located) return;
  const { startNode, startOffset, endNode, endOffset } = located;
  try {
    const range = document.createRange();
    range.setStart(startNode, startOffset);
    range.setEnd(endNode, endOffset);
    const span = document.createElement('span');
    decorateSpan(span, mark);
    range.surroundContents(span);
  } catch {
    // surroundContents throws if the range crosses non-text boundaries.
    // Effects spanning block boundaries aren't supported on restore — skip silently.
  }
}

function decorateSpan(span: HTMLSpanElement, mark: TextSpanMark): void {
  if (mark.kind === 'voice') {
    span.className = VBLOCK_CLASS;
    span.style.fontSize = `${mark.fontSizeEm.toFixed(2)}em`;
    return;
  }
  span.className = EBLOCK_CLASS;
  if (mark.kind === 'time') {
    span.dataset.mode = mark.mode;
    // Defensive: only write the inline style if the resolved value is a
    // valid positive number. Prevents `style.fontSize = "undefinedpx"`
    // (invalid CSS → silently dropped → span inherits parent's font size,
    // appearing smaller than at composition time) if a malformed mark
    // somehow slipped past the schema.
    if (mark.mode === 'fontWeight') {
      if (typeof mark.fontWeight === 'number' && mark.fontWeight > 0) {
        span.style.fontWeight = String(mark.fontWeight);
      }
    } else {
      if (typeof mark.fontSize === 'number' && mark.fontSize > 0) {
        span.style.fontSize = `${mark.fontSize}px`;
      }
    }
    return;
  }
  span.dataset.intensity = mark.intensity.toFixed(4);
  span.dataset.seed = String(mark.seed);
  span.dataset.mode = 'pressureBleed';
  span.style.textShadow = buildBleedShadow(mark.intensity, mark.seed);
  const filterBlur = mark.intensity * 0.18;
  span.style.filter = filterBlur > 0.05 ? `blur(${filterBlur.toFixed(2)}px)` : 'none';
  const ls = mark.intensity * 0.02;
  span.style.letterSpacing = ls > 0.005 ? `${ls.toFixed(3)}em` : 'normal';
}

function buildBleedShadow(intensity: number, seed: number): string {
  if (intensity < 0.01) return 'none';
  let s = seed | 0;
  const rng = () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
  const numLayers = Math.floor(4 + intensity * 10);
  const shadows: string[] = [];
  for (let i = 0; i < numLayers; i++) {
    const angle = rng() * Math.PI * 2;
    const dist = rng() * intensity;
    const ox = dist * Math.cos(angle);
    const oy = dist * Math.sin(angle);
    const blur = 0.2 + rng() * rng() * intensity * 2.5;
    const r = 40 + Math.floor(rng() * 30);
    const g = 30 + Math.floor(rng() * 25);
    const b = 20 + Math.floor(rng() * 20);
    const alpha = (0.02 + rng() * intensity * 0.15).toFixed(3);
    shadows.push(
      `${ox.toFixed(2)}px ${oy.toFixed(2)}px ${blur.toFixed(1)}px rgba(${r},${g},${b},${alpha})`,
    );
  }
  return shadows.join(', ');
}
