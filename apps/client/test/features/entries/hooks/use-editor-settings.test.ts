import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '@/features/entries/components/settings-drawer';
import { useEditorSettings } from '@/features/entries/hooks/use-editor-settings';

const FONT_SIZE_KEY = 'oryzae-editor-font-size';
const LINE_HEIGHT_KEY = 'oryzae-editor-line-height';

describe('useEditorSettings', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it('initializes with DEFAULT_SETTINGS when localStorage is empty', () => {
    const { result } = renderHook(() => useEditorSettings());
    expect(result.current[0]).toEqual(DEFAULT_SETTINGS);
  });

  it('initializes fontSize from localStorage when stored', () => {
    window.localStorage.setItem(FONT_SIZE_KEY, '16');
    const { result } = renderHook(() => useEditorSettings());
    expect(result.current[0].fontSize).toBe(16);
    expect(result.current[0].writingMode).toBe(DEFAULT_SETTINGS.writingMode);
  });

  it('initializes lineHeight from localStorage when stored', () => {
    window.localStorage.setItem(LINE_HEIGHT_KEY, '1.9');
    const { result } = renderHook(() => useEditorSettings());
    expect(result.current[0].lineHeight).toBe(1.9);
    expect(result.current[0].fontSize).toBe(DEFAULT_SETTINGS.fontSize);
  });

  it('ignores invalid stored fontSize values (non-numeric)', () => {
    window.localStorage.setItem(FONT_SIZE_KEY, 'abc');
    const { result } = renderHook(() => useEditorSettings());
    expect(result.current[0].fontSize).toBe(DEFAULT_SETTINGS.fontSize);
  });

  it('ignores stored fontSize outside the allowed range', () => {
    window.localStorage.setItem(FONT_SIZE_KEY, '200');
    const { result } = renderHook(() => useEditorSettings());
    expect(result.current[0].fontSize).toBe(DEFAULT_SETTINGS.fontSize);
  });

  it('ignores invalid stored lineHeight values (non-numeric)', () => {
    window.localStorage.setItem(LINE_HEIGHT_KEY, 'big');
    const { result } = renderHook(() => useEditorSettings());
    expect(result.current[0].lineHeight).toBe(DEFAULT_SETTINGS.lineHeight);
  });

  it('ignores stored lineHeight outside the allowed range', () => {
    window.localStorage.setItem(LINE_HEIGHT_KEY, '5');
    const { result } = renderHook(() => useEditorSettings());
    expect(result.current[0].lineHeight).toBe(DEFAULT_SETTINGS.lineHeight);
  });

  it('persists fontSize to localStorage when updated', () => {
    const { result } = renderHook(() => useEditorSettings());
    act(() => {
      result.current[1]({ fontSize: 20 });
    });
    expect(result.current[0].fontSize).toBe(20);
    expect(window.localStorage.getItem(FONT_SIZE_KEY)).toBe('20');
  });

  it('persists lineHeight to localStorage when updated', () => {
    const { result } = renderHook(() => useEditorSettings());
    act(() => {
      result.current[1]({ lineHeight: 1.4 });
    });
    expect(result.current[0].lineHeight).toBe(1.4);
    expect(window.localStorage.getItem(LINE_HEIGHT_KEY)).toBe('1.4');
  });

  it('restores the last lineHeight across hook remounts (cross-document persistence)', () => {
    const first = renderHook(() => useEditorSettings());
    act(() => {
      first.result.current[1]({ lineHeight: 2.0 });
    });
    first.unmount();

    const second = renderHook(() => useEditorSettings());
    expect(second.result.current[0].lineHeight).toBe(2.0);
  });

  it('does not persist non-persistent updates to localStorage', () => {
    const { result } = renderHook(() => useEditorSettings());
    act(() => {
      result.current[1]({ writingMode: 'horizontal' });
    });
    expect(result.current[0].writingMode).toBe('horizontal');
    expect(window.localStorage.getItem(FONT_SIZE_KEY)).toBeNull();
    expect(window.localStorage.getItem(LINE_HEIGHT_KEY)).toBeNull();
  });

  it('applies multi-field patches and persists fontSize + lineHeight', () => {
    const { result } = renderHook(() => useEditorSettings());
    act(() => {
      result.current[1]({ fontSize: 24, lineHeight: 1.8, writingMode: 'horizontal' });
    });
    expect(result.current[0].fontSize).toBe(24);
    expect(result.current[0].lineHeight).toBe(1.8);
    expect(result.current[0].writingMode).toBe('horizontal');
    expect(window.localStorage.getItem(FONT_SIZE_KEY)).toBe('24');
    expect(window.localStorage.getItem(LINE_HEIGHT_KEY)).toBe('1.8');
  });
});
