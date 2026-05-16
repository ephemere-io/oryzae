import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useEraserTrace } from '@/features/entries/hooks/use-eraser-trace';

/**
 * jsdom doesn't render layout, so we override geometry on a per-test basis.
 * The fixture stubs Range/Element bounding rects + editor.offsetLeft/Top/Width/Height
 * so the hook's content-coordinate math can be exercised end-to-end.
 */

interface EditorGeom {
  left: number;
  top: number;
  width: number;
  height: number;
  offsetLeft: number;
  offsetTop: number;
  scrollLeft: number;
  scrollTop: number;
}

function stubEditorGeom(editor: HTMLDivElement, g: EditorGeom) {
  Object.defineProperty(editor, 'offsetLeft', { value: g.offsetLeft, configurable: true });
  Object.defineProperty(editor, 'offsetTop', { value: g.offsetTop, configurable: true });
  Object.defineProperty(editor, 'offsetWidth', { value: g.width, configurable: true });
  Object.defineProperty(editor, 'offsetHeight', { value: g.height, configurable: true });
  Object.defineProperty(editor, 'scrollLeft', {
    value: g.scrollLeft,
    writable: true,
    configurable: true,
  });
  Object.defineProperty(editor, 'scrollTop', {
    value: g.scrollTop,
    writable: true,
    configurable: true,
  });
  editor.getBoundingClientRect = () =>
    ({
      x: g.left,
      y: g.top,
      left: g.left,
      top: g.top,
      right: g.left + g.width,
      bottom: g.top + g.height,
      width: g.width,
      height: g.height,
      toJSON: () => ({}),
    }) as DOMRect;
}

function stubCharRange(viewportLeft: number, viewportTop: number, w = 16, h = 20) {
  const rect: DOMRect = {
    x: viewportLeft,
    y: viewportTop,
    left: viewportLeft,
    top: viewportTop,
    right: viewportLeft + w,
    bottom: viewportTop + h,
    width: w,
    height: h,
    toJSON: () => ({}),
  };
  Range.prototype.getBoundingClientRect = () => rect;
}

function dispatchBackspaceDelete(editor: HTMLElement) {
  const before = new Event('beforeinput', { bubbles: true, cancelable: true });
  Object.defineProperty(before, 'inputType', { value: 'deleteContentBackward' });
  editor.dispatchEvent(before);
  const input = new Event('input', { bubbles: true });
  editor.dispatchEvent(input);
}

describe('useEraserTrace', () => {
  let editor: HTMLDivElement;
  let canvas: HTMLCanvasElement;
  let editorRef: { current: HTMLDivElement | null };
  let canvasRef: { current: HTMLCanvasElement | null };
  let drawImageSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    editor = document.createElement('div');
    editor.contentEditable = 'true';
    canvas = document.createElement('canvas');
    document.body.append(editor, canvas);
    editorRef = { current: editor };
    canvasRef = { current: canvas };

    // Stub canvas 2d context so we can observe drawImage calls.
    drawImageSpy = vi.fn();
    const ctxStub = {
      clearRect: vi.fn(),
      setTransform: vi.fn(),
      drawImage: drawImageSpy,
      fillText: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      quadraticCurveTo: vi.fn(),
      stroke: vi.fn(),
      filter: '',
      font: '',
      fillStyle: '',
      strokeStyle: '',
      textBaseline: '',
      textAlign: '',
      lineWidth: 0,
      globalAlpha: 1,
    };
    HTMLCanvasElement.prototype.getContext = vi.fn(
      () => ctxStub,
    ) as unknown as typeof HTMLCanvasElement.prototype.getContext;

    // Seed text + caret at end so charRangeBefore returns a valid range.
    editor.textContent = 'abc';
    const range = document.createRange();
    range.selectNodeContents(editor);
    range.collapse(false);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
  });

  afterEach(() => {
    editor.remove();
    canvas.remove();
    drawImageSpy.mockReset();
  });

  it('overlays canvas exactly on the editor box (offsetLeft/Top + offsetWidth/Height)', () => {
    stubEditorGeom(editor, {
      left: 200,
      top: 50,
      width: 600,
      height: 400,
      offsetLeft: 42,
      offsetTop: 16,
      scrollLeft: 0,
      scrollTop: 0,
    });

    renderHook(() => useEraserTrace(editorRef, canvasRef, true, 16));

    expect(canvas.style.left).toBe('42px');
    expect(canvas.style.top).toBe('16px');
    expect(canvas.style.width).toBe('600px');
    expect(canvas.style.height).toBe('400px');
  });

  it('stores trace in editor content coords and shifts draw by current scroll', async () => {
    stubEditorGeom(editor, {
      left: 200,
      top: 50,
      width: 600,
      height: 400,
      offsetLeft: 0,
      offsetTop: 0,
      scrollLeft: 100, // editor is currently scrolled 100px right
      scrollTop: 0,
    });
    // Char is at viewport x=400, y=80 → content x = 400 - 200 + 100 = 300
    stubCharRange(400, 80);

    renderHook(() => useEraserTrace(editorRef, canvasRef, true, 16));

    dispatchBackspaceDelete(editor);
    // requestAnimationFrame is used internally; jsdom executes it synchronously
    // via setTimeout(0). Wait a microtask + macrotask tick.
    await new Promise((r) => setTimeout(r, 30));

    expect(drawImageSpy).toHaveBeenCalled();
    const firstCall = drawImageSpy.mock.calls[0];
    // drawImage(image, dx, dy, dw, dh). The smudge is centered on (drawX + w/2),
    // so dx = drawX + w/2 - sz/2 where drawX = rx - scrollLeft = 300 - 100 = 200.
    // sz = ceil(16 * 1.4) + 12 = 35. w = 16. → dx = 200 + 8 - 17.5 = 190.5
    const expectedDx = 200 + 16 / 2 - 35 / 2;
    expect(firstCall[1]).toBeCloseTo(expectedDx, 1);
  });

  it('redraws on editor scroll so trace follows the text', async () => {
    stubEditorGeom(editor, {
      left: 200,
      top: 50,
      width: 600,
      height: 400,
      offsetLeft: 0,
      offsetTop: 0,
      scrollLeft: 0,
      scrollTop: 0,
    });
    stubCharRange(400, 80); // content x = 200

    renderHook(() => useEraserTrace(editorRef, canvasRef, true, 16));

    dispatchBackspaceDelete(editor);
    await new Promise((r) => setTimeout(r, 30));
    const initialDx = drawImageSpy.mock.calls[0]?.[1];
    drawImageSpy.mockClear();

    // Scroll the editor right by 50px; trace should redraw 50px to the left.
    Object.defineProperty(editor, 'scrollLeft', { value: 50, configurable: true });
    editor.dispatchEvent(new Event('scroll'));
    await new Promise((r) => setTimeout(r, 30));

    expect(drawImageSpy).toHaveBeenCalled();
    const scrolledDx = drawImageSpy.mock.calls[0][1];
    expect(scrolledDx).toBeCloseTo(initialDx - 50, 1);
  });

  it('attaches a scroll listener on the editor and removes it on cleanup', () => {
    stubEditorGeom(editor, {
      left: 0,
      top: 0,
      width: 100,
      height: 100,
      offsetLeft: 0,
      offsetTop: 0,
      scrollLeft: 0,
      scrollTop: 0,
    });
    const addSpy = vi.spyOn(editor, 'addEventListener');
    const removeSpy = vi.spyOn(editor, 'removeEventListener');

    const { unmount } = renderHook(() => useEraserTrace(editorRef, canvasRef, true, 16));

    expect(addSpy.mock.calls.map((c) => c[0])).toContain('scroll');
    unmount();
    expect(removeSpy.mock.calls.map((c) => c[0])).toContain('scroll');
  });

  it('clears canvas and skips listeners when disabled', () => {
    stubEditorGeom(editor, {
      left: 0,
      top: 0,
      width: 100,
      height: 100,
      offsetLeft: 0,
      offsetTop: 0,
      scrollLeft: 0,
      scrollTop: 0,
    });
    const addSpy = vi.spyOn(editor, 'addEventListener');

    renderHook(() => useEraserTrace(editorRef, canvasRef, false, 16));

    expect(addSpy.mock.calls.map((c) => c[0])).not.toContain('beforeinput');
  });
});
