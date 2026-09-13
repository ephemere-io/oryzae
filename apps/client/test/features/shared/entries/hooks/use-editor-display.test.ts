import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import {
  DEFAULT_EDITOR_DISPLAY,
  EDITOR_DISPLAY_STORAGE_KEY,
  parseEditorDisplay,
  useEditorDisplay,
} from '@/features/shared/entries/hooks/use-editor-display';

describe('parseEditorDisplay', () => {
  it('無ければ既定', () => {
    expect(parseEditorDisplay(null)).toEqual(DEFAULT_EDITOR_DISPLAY);
  });

  it('壊れた JSON でも既定に落ちる', () => {
    expect(parseEditorDisplay('{oops')).toEqual(DEFAULT_EDITOR_DISPLAY);
    expect(parseEditorDisplay('42')).toEqual(DEFAULT_EDITOR_DISPLAY);
  });

  it('知らない値は項目ごとに既定へ（他の項目は残す）', () => {
    expect(
      parseEditorDisplay(
        JSON.stringify({ fontFamily: 'sans', fontSize: 'huge', lineHeight: 'wide' }),
      ),
    ).toEqual({
      fontFamily: 'sans',
      fontSize: 'medium',
      lineHeight: 'wide',
      letterSpacing: 'normal',
    });
  });
});

describe('useEditorDisplay', () => {
  afterEach(() => {
    window.localStorage.removeItem(EDITOR_DISPLAY_STORAGE_KEY);
  });

  it('保存値を読み、更新すると保存する', () => {
    window.localStorage.setItem(
      EDITOR_DISPLAY_STORAGE_KEY,
      JSON.stringify({ fontFamily: 'sans', fontSize: 'large' }),
    );
    const { result } = renderHook(() => useEditorDisplay());
    expect(result.current[0].fontFamily).toBe('sans');
    expect(result.current[0].fontSize).toBe('large');

    act(() => result.current[1]({ letterSpacing: 'wide' }));
    expect(result.current[0].letterSpacing).toBe('wide');
    expect(parseEditorDisplay(window.localStorage.getItem(EDITOR_DISPLAY_STORAGE_KEY))).toEqual({
      fontFamily: 'sans',
      fontSize: 'large',
      lineHeight: 'normal',
      letterSpacing: 'wide',
    });
  });
});
