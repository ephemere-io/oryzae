import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS } from '@/features/pc/entries/components/settings-drawer';
import { useEditorSettings } from '@/features/pc/entries/hooks/use-editor-settings';

const FONT_SIZE_KEY = 'oryzae-editor-font-size';
const LINE_HEIGHT_KEY = 'oryzae-editor-line-height';
const FOCUS_MODE_KEY = 'oryzae-editor-focus-mode';
const PALETTE_AUTO_HIDE_KEY = 'oryzae-editor-palette-auto-hide';
const PALETTE_SIZE_KEY = 'oryzae-editor-palette-size';

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

  it('defaults writingMode to vertical for ja locale', () => {
    const { result } = renderHook(() => useEditorSettings('ja'));
    expect(result.current[0].writingMode).toBe('vertical');
  });

  it('defaults writingMode to horizontal for en locale (issue #269)', () => {
    const { result } = renderHook(() => useEditorSettings('en'));
    expect(result.current[0].writingMode).toBe('horizontal');
    // 他のフィールドは DEFAULT_SETTINGS のまま
    expect(result.current[0].fontSize).toBe(DEFAULT_SETTINGS.fontSize);
    expect(result.current[0].lineHeight).toBe(DEFAULT_SETTINGS.lineHeight);
  });

  it('falls back to DEFAULT_SETTINGS.writingMode when locale is undefined', () => {
    const { result } = renderHook(() => useEditorSettings(undefined));
    expect(result.current[0].writingMode).toBe(DEFAULT_SETTINGS.writingMode);
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
    expect(window.localStorage.getItem(FOCUS_MODE_KEY)).toBeNull();
  });

  it('initializes focusModeEnabled from localStorage when stored (false)', () => {
    window.localStorage.setItem(FOCUS_MODE_KEY, 'false');
    const { result } = renderHook(() => useEditorSettings());
    expect(result.current[0].focusModeEnabled).toBe(false);
  });

  it('initializes focusModeEnabled from localStorage when stored (true)', () => {
    window.localStorage.setItem(FOCUS_MODE_KEY, 'true');
    const { result } = renderHook(() => useEditorSettings());
    expect(result.current[0].focusModeEnabled).toBe(true);
  });

  it('defaults focusModeEnabled to true when storage value is invalid', () => {
    window.localStorage.setItem(FOCUS_MODE_KEY, 'maybe');
    const { result } = renderHook(() => useEditorSettings());
    expect(result.current[0].focusModeEnabled).toBe(DEFAULT_SETTINGS.focusModeEnabled);
  });

  it('persists focusModeEnabled to localStorage when updated', () => {
    const { result } = renderHook(() => useEditorSettings());
    act(() => {
      result.current[1]({ focusModeEnabled: false });
    });
    expect(result.current[0].focusModeEnabled).toBe(false);
    expect(window.localStorage.getItem(FOCUS_MODE_KEY)).toBe('false');
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

  // アクションパレットを書いている間は隠すか。既定は隠す（原則1: 文字に道具を被せない）。
  it('paletteAutoHide の既定は true（書き始めたら道具は引く）', () => {
    const { result } = renderHook(() => useEditorSettings());
    expect(result.current[0].paletteAutoHide).toBe(true);
  });

  it('paletteAutoHide を切ると localStorage に永続化される', () => {
    const { result } = renderHook(() => useEditorSettings());
    act(() => {
      result.current[1]({ paletteAutoHide: false });
    });
    expect(result.current[0].paletteAutoHide).toBe(false);
    expect(window.localStorage.getItem(PALETTE_AUTO_HIDE_KEY)).toBe('false');
  });

  it('paletteAutoHide は再マウント越しに保持される', () => {
    const first = renderHook(() => useEditorSettings());
    act(() => {
      first.result.current[1]({ paletteAutoHide: false });
    });
    first.unmount();

    const second = renderHook(() => useEditorSettings());
    expect(second.result.current[0].paletteAutoHide).toBe(false);
  });

  // 道具の大きさ。既定は medium（以前の実寸は small にあたり、道具として小さすぎた）。
  it('paletteSize の既定は medium', () => {
    const { result } = renderHook(() => useEditorSettings());
    expect(result.current[0].paletteSize).toBe('medium');
  });

  it('paletteSize を変えると localStorage に永続化され、再マウント越しに残る', () => {
    const first = renderHook(() => useEditorSettings());
    act(() => {
      first.result.current[1]({ paletteSize: 'large' });
    });
    expect(window.localStorage.getItem(PALETTE_SIZE_KEY)).toBe('large');
    first.unmount();

    const second = renderHook(() => useEditorSettings());
    expect(second.result.current[0].paletteSize).toBe('large');
  });

  it('壊れた paletteSize は無視して既定に戻す', () => {
    window.localStorage.setItem(PALETTE_SIZE_KEY, 'enormous');
    const { result } = renderHook(() => useEditorSettings());
    expect(result.current[0].paletteSize).toBe('medium');
  });

  it('壊れた paletteAutoHide は無視して既定に戻す', () => {
    window.localStorage.setItem(PALETTE_AUTO_HIDE_KEY, 'sometimes');
    const { result } = renderHook(() => useEditorSettings());
    expect(result.current[0].paletteAutoHide).toBe(true);
  });
});
