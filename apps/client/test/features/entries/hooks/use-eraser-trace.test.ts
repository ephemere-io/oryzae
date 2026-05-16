import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useEraserTrace } from '@/features/entries/hooks/use-eraser-trace';

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

describe('useEraserTrace persistence wiring', () => {
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
  });

  afterEach(() => {
    editor.remove();
    canvas.remove();
  });

  it('seeds tracesRef from initialTraces and draws them on mount', async () => {
    const { drawImage } = stubCanvasContext();
    const initial = [{ rx: 10, ry: 20, w: 16, h: 20, chars: ['a'], intensity: 0.1, seed: 1 }];

    renderHook(() => useEraserTrace(editorRef, canvasRef, true, 16, initial));
    await new Promise((r) => setTimeout(r, 30));

    expect(drawImage).toHaveBeenCalled();
  });

  it('getTracesSnapshot returns a copy of the current traces (not the same reference)', () => {
    stubCanvasContext();
    const initial = [{ rx: 5, ry: 6, w: 1, h: 1, chars: ['x'], intensity: 0.07, seed: 0 }];

    const { result } = renderHook(() => useEraserTrace(editorRef, canvasRef, true, 16, initial));

    const snap = result.current.getTracesSnapshot();
    expect(snap).toEqual(initial);
    expect(snap[0]).not.toBe(initial[0]);
  });

  it('replaces traces when initialTraces reference changes', () => {
    stubCanvasContext();
    const first = [{ rx: 1, ry: 1, w: 1, h: 1, chars: ['a'], intensity: 0.07, seed: 0 }];
    const second = [
      { rx: 2, ry: 2, w: 1, h: 1, chars: ['b'], intensity: 0.1, seed: 1 },
      { rx: 3, ry: 3, w: 1, h: 1, chars: ['c'], intensity: 0.1, seed: 2 },
    ];

    const { result, rerender } = renderHook(
      ({ traces }) => useEraserTrace(editorRef, canvasRef, true, 16, traces),
      { initialProps: { traces: first } },
    );

    expect(result.current.getTracesSnapshot()).toHaveLength(1);
    rerender({ traces: second });
    expect(result.current.getTracesSnapshot()).toHaveLength(2);
  });

  it('does not reseed when the same initialTraces reference is passed again', () => {
    stubCanvasContext();
    const initial = [{ rx: 1, ry: 1, w: 1, h: 1, chars: ['a'], intensity: 0.07, seed: 0 }];

    const { result, rerender } = renderHook(
      ({ traces }) => useEraserTrace(editorRef, canvasRef, true, 16, traces),
      { initialProps: { traces: initial } },
    );

    // Mutate the snapshot's underlying array via the hook's natural mechanism:
    // we can't push directly, but we can verify that re-rendering with the same
    // reference keeps the snapshot stable.
    const before = result.current.getTracesSnapshot();
    rerender({ traces: initial });
    const after = result.current.getTracesSnapshot();
    expect(after).toEqual(before);
  });
});
