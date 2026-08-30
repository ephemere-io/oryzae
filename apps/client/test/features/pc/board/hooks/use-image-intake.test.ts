import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useImageIntake } from '@/features/pc/board/hooks/use-image-intake';

function imageFile(name = 'memo.png', type = 'image/png'): File {
  return new File(['binary'], name, { type });
}

/** paste イベントを本物として組み立てる（clipboardData は jsdom が持たないので足す）。 */
function firePaste(files: File[], target: EventTarget = document.body) {
  const event = new Event('paste', { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'clipboardData', { value: { files } });
  Object.defineProperty(event, 'target', { value: target, configurable: true });
  target.dispatchEvent(event);
  return event;
}

/** React の DragEvent を、hook が触る範囲だけ組み立てる。 */
function dragEvent(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    preventDefault: vi.fn(),
    dataTransfer: { types: ['Files'], files: [] },
    currentTarget: { contains: () => false },
    relatedTarget: null,
    ...overrides,
  };
}

describe('useImageIntake', () => {
  beforeEach(() => vi.clearAllMocks());

  it('盤面での貼り付けから画像を拾う', () => {
    const onImage = vi.fn();
    renderHook(() => useImageIntake(true, onImage));

    const file = imageFile();
    act(() => {
      firePaste([file]);
    });

    expect(onImage).toHaveBeenCalledWith(file);
  });

  it('入力欄への貼り付けは横取りしない（文字を貼る操作を奪わない）', () => {
    const onImage = vi.fn();
    renderHook(() => useImageIntake(true, onImage));

    const textarea = document.createElement('textarea');
    document.body.appendChild(textarea);
    act(() => {
      firePaste([imageFile()], textarea);
    });

    expect(onImage).not.toHaveBeenCalled();
    textarea.remove();
  });

  it('画像以外のファイルは拾わない', () => {
    const onImage = vi.fn();
    renderHook(() => useImageIntake(true, onImage));

    act(() => {
      firePaste([new File(['x'], 'memo.txt', { type: 'text/plain' })]);
    });

    expect(onImage).not.toHaveBeenCalled();
  });

  it('無効のときは何も拾わない', () => {
    const onImage = vi.fn();
    renderHook(() => useImageIntake(false, onImage));

    act(() => {
      firePaste([imageFile()]);
    });

    expect(onImage).not.toHaveBeenCalled();
  });

  it('ドロップで画像を拾い、目印を消す', () => {
    const onImage = vi.fn();
    const { result } = renderHook(() => useImageIntake(true, onImage));

    act(() => {
      // @ts-expect-error React.DragEvent の全プロパティは不要（hook が触る範囲だけ渡す）
      result.current.onDragOver(dragEvent());
    });
    expect(result.current.dragActive).toBe(true);

    const file = imageFile();
    act(() => {
      // @ts-expect-error 同上
      result.current.onDrop(dragEvent({ dataTransfer: { types: ['Files'], files: [file] } }));
    });

    expect(onImage).toHaveBeenCalledWith(file);
    expect(result.current.dragActive).toBe(false);
  });

  it('ファイルを持たないドラッグには反応しない（カード移動を邪魔しない）', () => {
    const onImage = vi.fn();
    const { result } = renderHook(() => useImageIntake(true, onImage));

    act(() => {
      // @ts-expect-error 同上
      result.current.onDragOver(dragEvent({ dataTransfer: { types: ['text/plain'], files: [] } }));
    });

    expect(result.current.dragActive).toBe(false);
  });
});
