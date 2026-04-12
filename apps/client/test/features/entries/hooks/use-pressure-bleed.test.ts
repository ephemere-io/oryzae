import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { usePressureBleed } from '@/features/entries/hooks/use-pressure-bleed';

describe('usePressureBleed', () => {
  let editorEl: HTMLDivElement;
  let editorRef: { current: HTMLDivElement | null };

  beforeEach(() => {
    editorEl = document.createElement('div');
    editorEl.contentEditable = 'true';
    document.body.appendChild(editorEl);
    editorRef = { current: editorEl };
  });

  afterEach(() => {
    editorEl.remove();
  });

  it('attaches event listeners when enabled', () => {
    const addSpy = vi.spyOn(window, 'addEventListener');
    const editorAddSpy = vi.spyOn(editorEl, 'addEventListener');

    renderHook(() => usePressureBleed(editorRef, true));

    const windowEvents = addSpy.mock.calls.map((c) => c[0]);
    expect(windowEvents).toContain('keydown');
    expect(windowEvents).toContain('keyup');

    const editorEvents = editorAddSpy.mock.calls.map((c) => c[0]);
    expect(editorEvents).toContain('input');
    expect(editorEvents).toContain('beforeinput');
    expect(editorEvents).toContain('compositionstart');
    expect(editorEvents).toContain('compositionend');

    addSpy.mockRestore();
    editorAddSpy.mockRestore();
  });

  it('does not attach listeners when disabled', () => {
    const addSpy = vi.spyOn(window, 'addEventListener');
    const editorAddSpy = vi.spyOn(editorEl, 'addEventListener');

    renderHook(() => usePressureBleed(editorRef, false));

    const windowEvents = addSpy.mock.calls.map((c) => c[0]);
    expect(windowEvents).not.toContain('keydown');
    expect(windowEvents).not.toContain('keyup');

    const editorEvents = editorAddSpy.mock.calls.map((c) => c[0]);
    expect(editorEvents).not.toContain('input');
    expect(editorEvents).not.toContain('beforeinput');

    addSpy.mockRestore();
    editorAddSpy.mockRestore();
  });

  it('removes listeners on cleanup', () => {
    const removeSpy = vi.spyOn(window, 'removeEventListener');
    const editorRemoveSpy = vi.spyOn(editorEl, 'removeEventListener');

    const { unmount } = renderHook(() => usePressureBleed(editorRef, true));
    unmount();

    const windowEvents = removeSpy.mock.calls.map((c) => c[0]);
    expect(windowEvents).toContain('keydown');
    expect(windowEvents).toContain('keyup');

    const editorEvents = editorRemoveSpy.mock.calls.map((c) => c[0]);
    expect(editorEvents).toContain('input');
    expect(editorEvents).toContain('beforeinput');
    expect(editorEvents).toContain('compositionstart');
    expect(editorEvents).toContain('compositionend');

    removeSpy.mockRestore();
    editorRemoveSpy.mockRestore();
  });

  it('does not attach listeners when ref is null', () => {
    const addSpy = vi.spyOn(window, 'addEventListener');
    const nullRef = { current: null };

    renderHook(() => usePressureBleed(nullRef, true));

    const windowEvents = addSpy.mock.calls.map((c) => c[0]);
    expect(windowEvents).not.toContain('keydown');

    addSpy.mockRestore();
  });
});
