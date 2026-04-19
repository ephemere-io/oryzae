import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '@/features/entries/components/settings-drawer';
import { useEditorSettings } from '@/features/entries/hooks/use-editor-settings';

const STORAGE_KEY = 'oryzae-editor-font-size';

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
    window.localStorage.setItem(STORAGE_KEY, '16');
    const { result } = renderHook(() => useEditorSettings());
    expect(result.current[0].fontSize).toBe(16);
    // Other settings remain at defaults
    expect(result.current[0].writingMode).toBe(DEFAULT_SETTINGS.writingMode);
  });

  it('ignores invalid stored values (non-numeric)', () => {
    window.localStorage.setItem(STORAGE_KEY, 'abc');
    const { result } = renderHook(() => useEditorSettings());
    expect(result.current[0].fontSize).toBe(DEFAULT_SETTINGS.fontSize);
  });

  it('ignores stored values outside the allowed range', () => {
    window.localStorage.setItem(STORAGE_KEY, '200');
    const { result } = renderHook(() => useEditorSettings());
    expect(result.current[0].fontSize).toBe(DEFAULT_SETTINGS.fontSize);
  });

  it('persists fontSize to localStorage when updated', () => {
    const { result } = renderHook(() => useEditorSettings());
    act(() => {
      result.current[1]({ fontSize: 20 });
    });
    expect(result.current[0].fontSize).toBe(20);
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe('20');
  });

  it('restores the last fontSize across hook remounts (cross-document persistence)', () => {
    const first = renderHook(() => useEditorSettings());
    act(() => {
      first.result.current[1]({ fontSize: 18 });
    });
    first.unmount();

    const second = renderHook(() => useEditorSettings());
    expect(second.result.current[0].fontSize).toBe(18);
  });

  it('does not persist non-fontSize updates to localStorage', () => {
    const { result } = renderHook(() => useEditorSettings());
    act(() => {
      result.current[1]({ writingMode: 'horizontal' });
    });
    expect(result.current[0].writingMode).toBe('horizontal');
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('applies multi-field patches and persists only fontSize', () => {
    const { result } = renderHook(() => useEditorSettings());
    act(() => {
      result.current[1]({ fontSize: 24, writingMode: 'horizontal' });
    });
    expect(result.current[0].fontSize).toBe(24);
    expect(result.current[0].writingMode).toBe('horizontal');
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe('24');
  });
});
