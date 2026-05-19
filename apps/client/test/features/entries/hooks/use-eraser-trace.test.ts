import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useEraserTrace } from '@/features/entries/hooks/use-eraser-trace';

/**
 * jsdom doesn't render layout, so geometry is stubbed per-test.
 * Combines coverage for:
 *   - PR #333 (Issue #313): scroll-aware canvas overlay + content-space coords
 *   - PR #337 (Issue #332): trace hydration from saved state + snapshot extraction
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

function stubCanvasContext() {
  const drawImage = vi.fn();
  const ctxStub = {
    clearRect: vi.fn(),
    setTransform: vi.fn(),
    drawImage,
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
  return { drawImage };
}

describe('useEraserTrace', () => {
  let editor: HTMLDivElement;
  let canvas: HTMLCanvasElement;
  let editorRef: { current: HTMLDivElement | null };
  let canvasRef: { current: HTMLCanvasElement | null };

  beforeEach(() => {
    editor = document.createElement('div');
    editor.contentEditable = 'true';
    canvas = document.createElement('canvas');
    document.body.append(editor, canvas);
    editorRef = { current: editor };
    canvasRef = { current: canvas };

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
  });

  describe('scroll behavior (PR #333 / Issue #313)', () => {
    it('overlays canvas exactly on the editor box (offsetLeft/Top + offsetWidth/Height)', () => {
      stubCanvasContext();
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

      renderHook(() => useEraserTrace(editorRef, canvasRef, true, 16, 'sans-serif'));

      expect(canvas.style.left).toBe('42px');
      expect(canvas.style.top).toBe('16px');
      expect(canvas.style.width).toBe('600px');
      expect(canvas.style.height).toBe('400px');
    });

    it('stores trace in editor content coords and shifts draw by current scroll', async () => {
      const { drawImage } = stubCanvasContext();
      stubEditorGeom(editor, {
        left: 200,
        top: 50,
        width: 600,
        height: 400,
        offsetLeft: 0,
        offsetTop: 0,
        scrollLeft: 100,
        scrollTop: 0,
      });
      stubCharRange(400, 80);

      renderHook(() => useEraserTrace(editorRef, canvasRef, true, 16, 'sans-serif'));

      dispatchBackspaceDelete(editor);
      await new Promise((r) => setTimeout(r, 30));

      expect(drawImage).toHaveBeenCalled();
      const firstCall = drawImage.mock.calls[0];
      const expectedDx = 200 + 16 / 2 - 35 / 2;
      expect(firstCall[1]).toBeCloseTo(expectedDx, 1);
    });

    it('redraws on editor scroll so trace follows the text', async () => {
      const { drawImage } = stubCanvasContext();
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
      stubCharRange(400, 80);

      renderHook(() => useEraserTrace(editorRef, canvasRef, true, 16, 'sans-serif'));

      dispatchBackspaceDelete(editor);
      await new Promise((r) => setTimeout(r, 30));
      const initialDx = drawImage.mock.calls[0]?.[1];
      drawImage.mockClear();

      Object.defineProperty(editor, 'scrollLeft', { value: 50, configurable: true });
      editor.dispatchEvent(new Event('scroll'));
      await new Promise((r) => setTimeout(r, 30));

      expect(drawImage).toHaveBeenCalled();
      const scrolledDx = drawImage.mock.calls[0][1];
      expect(scrolledDx).toBeCloseTo(initialDx - 50, 1);
    });

    it('attaches a scroll listener on the editor and removes it on cleanup', () => {
      stubCanvasContext();
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

      const { unmount } = renderHook(() =>
        useEraserTrace(editorRef, canvasRef, true, 16, 'sans-serif'),
      );

      expect(addSpy.mock.calls.map((c) => c[0])).toContain('scroll');
      unmount();
      expect(removeSpy.mock.calls.map((c) => c[0])).toContain('scroll');
    });

    it('clears canvas and skips listeners when disabled', () => {
      stubCanvasContext();
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

      renderHook(() => useEraserTrace(editorRef, canvasRef, false, 16, 'sans-serif'));

      expect(addSpy.mock.calls.map((c) => c[0])).not.toContain('beforeinput');
    });
  });

  describe('persistence wiring (PR #337 / Issue #332)', () => {
    it('seeds tracesRef from initialTraces and draws them on mount', async () => {
      const { drawImage } = stubCanvasContext();
      stubEditorGeom(editor, {
        left: 0,
        top: 0,
        width: 200,
        height: 200,
        offsetLeft: 0,
        offsetTop: 0,
        scrollLeft: 0,
        scrollTop: 0,
      });
      const initial = [{ rx: 10, ry: 20, w: 16, h: 20, chars: ['a'], intensity: 0.1, seed: 1 }];

      renderHook(() => useEraserTrace(editorRef, canvasRef, true, 16, 'sans-serif', initial));
      await new Promise((r) => setTimeout(r, 30));

      expect(drawImage).toHaveBeenCalled();
    });

    it('getTracesSnapshot returns a copy of the current traces (not the same reference)', () => {
      stubCanvasContext();
      stubEditorGeom(editor, {
        left: 0,
        top: 0,
        width: 200,
        height: 200,
        offsetLeft: 0,
        offsetTop: 0,
        scrollLeft: 0,
        scrollTop: 0,
      });
      const initial = [{ rx: 5, ry: 6, w: 1, h: 1, chars: ['x'], intensity: 0.07, seed: 0 }];

      const { result } = renderHook(() =>
        useEraserTrace(editorRef, canvasRef, true, 16, 'sans-serif', initial),
      );

      const snap = result.current.getTracesSnapshot();
      expect(snap).toEqual(initial);
      expect(snap[0]).not.toBe(initial[0]);
    });

    it('replaces traces when initialTraces reference changes', () => {
      stubCanvasContext();
      stubEditorGeom(editor, {
        left: 0,
        top: 0,
        width: 200,
        height: 200,
        offsetLeft: 0,
        offsetTop: 0,
        scrollLeft: 0,
        scrollTop: 0,
      });
      const first = [{ rx: 1, ry: 1, w: 1, h: 1, chars: ['a'], intensity: 0.07, seed: 0 }];
      const second = [
        { rx: 2, ry: 2, w: 1, h: 1, chars: ['b'], intensity: 0.1, seed: 1 },
        { rx: 3, ry: 3, w: 1, h: 1, chars: ['c'], intensity: 0.1, seed: 2 },
      ];

      const { result, rerender } = renderHook(
        ({ traces }) => useEraserTrace(editorRef, canvasRef, true, 16, 'sans-serif', traces),
        { initialProps: { traces: first } },
      );

      expect(result.current.getTracesSnapshot()).toHaveLength(1);
      rerender({ traces: second });
      expect(result.current.getTracesSnapshot()).toHaveLength(2);
    });

    it('does not reseed when the same initialTraces reference is passed again', () => {
      stubCanvasContext();
      stubEditorGeom(editor, {
        left: 0,
        top: 0,
        width: 200,
        height: 200,
        offsetLeft: 0,
        offsetTop: 0,
        scrollLeft: 0,
        scrollTop: 0,
      });
      const initial = [{ rx: 1, ry: 1, w: 1, h: 1, chars: ['a'], intensity: 0.07, seed: 0 }];

      const { result, rerender } = renderHook(
        ({ traces }) => useEraserTrace(editorRef, canvasRef, true, 16, 'sans-serif', traces),
        { initialProps: { traces: initial } },
      );

      const before = result.current.getTracesSnapshot();
      rerender({ traces: initial });
      const after = result.current.getTracesSnapshot();
      expect(after).toEqual(before);
    });
  });
});
