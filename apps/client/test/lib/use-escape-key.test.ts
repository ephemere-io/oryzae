import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useEscapeKey } from '@/lib/use-escape-key';

function pressEscape(init: KeyboardEventInit = {}) {
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', ...init }));
}

describe('useEscapeKey', () => {
  beforeEach(() => vi.clearAllMocks());

  it('enabled のとき Escape で呼ばれる', () => {
    const onEscape = vi.fn();
    renderHook(() => useEscapeKey(true, onEscape));

    pressEscape();

    expect(onEscape).toHaveBeenCalledTimes(1);
  });

  it('enabled=false なら呼ばれない（閉じているモーダルが Escape を奪わない）', () => {
    const onEscape = vi.fn();
    renderHook(() => useEscapeKey(false, onEscape));

    pressEscape();

    expect(onEscape).not.toHaveBeenCalled();
  });

  it('Escape 以外のキーでは呼ばれない', () => {
    const onEscape = vi.fn();
    renderHook(() => useEscapeKey(true, onEscape));

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 's' }));

    expect(onEscape).not.toHaveBeenCalled();
  });

  it('IME 変換中（isComposing）の Escape は無視する', () => {
    // 日本語入力では変換候補の取り消しに Escape を使う。ここで閉じると入力ごと消える。
    const onEscape = vi.fn();
    renderHook(() => useEscapeKey(true, onEscape));

    pressEscape({ isComposing: true });

    expect(onEscape).not.toHaveBeenCalled();
  });

  it('入れ子の入力欄で起きた Escape も拾う', () => {
    const onEscape = vi.fn();
    renderHook(() => useEscapeKey(true, onEscape));

    const inner = document.createElement('textarea');
    document.body.appendChild(inner);
    inner.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

    expect(onEscape).toHaveBeenCalledTimes(1);
    inner.remove();
  });

  it('途中で stopPropagation されても拾う（この hook の存在理由）', () => {
    // ボードのダイアログは form で onKeyDown={(e) => e.stopPropagation()} している。
    // React の SyntheticEvent.stopPropagation() はネイティブ側の stopPropagation も
    // 呼ぶため、bubble フェーズで window に登録していると **届かない**。
    // capture で拾っていることを、ここで機械的に固定する。
    const onEscape = vi.fn();
    renderHook(() => useEscapeKey(true, onEscape));

    const form = document.createElement('form');
    const inner = document.createElement('textarea');
    form.appendChild(inner);
    document.body.appendChild(form);
    form.addEventListener('keydown', (e) => e.stopPropagation());

    inner.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

    expect(onEscape).toHaveBeenCalledTimes(1);
    form.remove();
  });

  it('アンマウントでリスナーを外す', () => {
    const onEscape = vi.fn();
    const { unmount } = renderHook(() => useEscapeKey(true, onEscape));

    unmount();
    pressEscape();

    expect(onEscape).not.toHaveBeenCalled();
  });

  it('enabled が false に変わったらリスナーを外す', () => {
    const onEscape = vi.fn();
    const { rerender } = renderHook(({ enabled }) => useEscapeKey(enabled, onEscape), {
      initialProps: { enabled: true },
    });

    rerender({ enabled: false });
    pressEscape();

    expect(onEscape).not.toHaveBeenCalled();
  });
});
