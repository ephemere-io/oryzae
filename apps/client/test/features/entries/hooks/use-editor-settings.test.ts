import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '@/features/entries/components/settings-drawer';
import { useEditorSettings } from '@/features/entries/hooks/use-editor-settings';

const STORAGE_KEY = 'oryzae-editor-settings';

describe('useEditorSettings', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('returns default settings when localStorage is empty', () => {
    const { result } = renderHook(() => useEditorSettings());
    expect(result.current[0]).toEqual(DEFAULT_SETTINGS);
  });

  it('loads stored settings from localStorage on mount', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...DEFAULT_SETTINGS, lineHeight: 2.0, fontSize: 24 }),
    );
    const { result } = renderHook(() => useEditorSettings());
    expect(result.current[0].lineHeight).toBe(2.0);
    expect(result.current[0].fontSize).toBe(24);
  });

  it('persists updates to localStorage', () => {
    const { result } = renderHook(() => useEditorSettings());
    act(() => {
      result.current[1]({ lineHeight: 1.9 });
    });
    expect(result.current[0].lineHeight).toBe(1.9);
    const raw = localStorage.getItem(STORAGE_KEY);
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(raw ?? '{}');
    expect(parsed.lineHeight).toBe(1.9);
  });

  it('merges partial patches into existing settings', () => {
    const { result } = renderHook(() => useEditorSettings());
    act(() => {
      result.current[1]({ lineHeight: 1.4 });
    });
    act(() => {
      result.current[1]({ fontSize: 40 });
    });
    expect(result.current[0].lineHeight).toBe(1.4);
    expect(result.current[0].fontSize).toBe(40);
  });

  it('falls back to defaults when stored JSON is malformed', () => {
    localStorage.setItem(STORAGE_KEY, 'not-json{{');
    const { result } = renderHook(() => useEditorSettings());
    expect(result.current[0]).toEqual(DEFAULT_SETTINGS);
  });

  it('ignores unknown fields and keeps defaults for missing fields', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ lineHeight: 1.8, unknownField: 'garbage' }));
    const { result } = renderHook(() => useEditorSettings());
    expect(result.current[0].lineHeight).toBe(1.8);
    expect(result.current[0].fontSize).toBe(DEFAULT_SETTINGS.fontSize);
    expect(result.current[0].writingMode).toBe(DEFAULT_SETTINGS.writingMode);
  });

  it('rejects fields of wrong type and falls back to default', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ lineHeight: 'big', fontSize: true, writingMode: 'sideways' }),
    );
    const { result } = renderHook(() => useEditorSettings());
    expect(result.current[0].lineHeight).toBe(DEFAULT_SETTINGS.lineHeight);
    expect(result.current[0].fontSize).toBe(DEFAULT_SETTINGS.fontSize);
    expect(result.current[0].writingMode).toBe(DEFAULT_SETTINGS.writingMode);
  });
});
