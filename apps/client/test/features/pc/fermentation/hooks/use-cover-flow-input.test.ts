import { act, renderHook } from '@testing-library/react';
import type { PointerEvent } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useCoverFlowInput } from '@/features/pc/fermentation/hooks/use-cover-flow-input';

/** ドラッグは clientX と button しか見ない。 */
function pointer(clientX: number, button = 0): PointerEvent<HTMLElement> {
  // @type-assertion-allowed: hook が読むのは clientX / button だけの最小 PointerEvent スタブ
  return { clientX, button } as PointerEvent<HTMLElement>;
}

function key(k: string): void {
  document.dispatchEvent(new KeyboardEvent('keydown', { key: k, cancelable: true }));
}

describe('useCoverFlowInput', () => {
  let onStep: ReturnType<typeof vi.fn>;
  let onClose: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    onStep = vi.fn();
    onClose = vi.fn();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function setup(active = true) {
    return renderHook(
      ({ isActive }: { isActive: boolean }) =>
        useCoverFlowInput({ active: isActive, onStep, onClose }),
      { initialProps: { isActive: active } },
    );
  }

  describe('キーボード', () => {
    it('← → でめくり、ESC で閉じる', () => {
      setup();
      act(() => key('ArrowLeft'));
      expect(onStep).toHaveBeenCalledWith(-1);
      act(() => key('ArrowRight'));
      expect(onStep).toHaveBeenCalledWith(1);
      act(() => key('Escape'));
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('矢印キーは既定動作を止める（ページが横スクロールしない）', () => {
      setup();
      const event = new KeyboardEvent('keydown', { key: 'ArrowRight', cancelable: true });
      act(() => {
        document.dispatchEvent(event);
      });
      expect(event.defaultPrevented).toBe(true);
    });

    it('関係ないキーは無視する', () => {
      setup();
      act(() => key('a'));
      act(() => key('Enter'));
      expect(onStep).not.toHaveBeenCalled();
      expect(onClose).not.toHaveBeenCalled();
    });

    it('閉じている間はリスナを張らない（瓶のキャンバスと競合しない）', () => {
      setup(false);
      act(() => key('ArrowRight'));
      act(() => key('Escape'));
      expect(onStep).not.toHaveBeenCalled();
      expect(onClose).not.toHaveBeenCalled();
    });

    it('アンマウントで外れる', () => {
      const { unmount } = setup();
      unmount();
      act(() => key('ArrowRight'));
      expect(onStep).not.toHaveBeenCalled();
    });
  });

  describe('ホイール', () => {
    it('累積 60 に達して初めて 1 段めくる', () => {
      const { result } = setup();
      act(() => result.current.onWheel({ deltaX: 0, deltaY: 30 }));
      expect(onStep).not.toHaveBeenCalled();
      act(() => result.current.onWheel({ deltaX: 0, deltaY: 30 }));
      expect(onStep).toHaveBeenCalledWith(1);
    });

    it('めくった後は累積がリセットされる', () => {
      const { result } = setup();
      act(() => result.current.onWheel({ deltaX: 0, deltaY: 60 }));
      expect(onStep).toHaveBeenCalledTimes(1);
      act(() => result.current.onWheel({ deltaX: 0, deltaY: 30 }));
      expect(onStep).toHaveBeenCalledTimes(1);
    });

    it('逆向きにも回せる', () => {
      const { result } = setup();
      act(() => result.current.onWheel({ deltaX: 0, deltaY: -70 }));
      expect(onStep).toHaveBeenCalledWith(-1);
    });

    it('動きの大きい軸を採る（トラックパッドの横スワイプ）', () => {
      const { result } = setup();
      act(() => result.current.onWheel({ deltaX: -80, deltaY: 10 }));
      expect(onStep).toHaveBeenCalledWith(-1);
    });

    it('260ms 無操作で累積が切れる（惰性スクロールの残りで勝手に動かない）', () => {
      const { result } = setup();
      act(() => result.current.onWheel({ deltaX: 0, deltaY: 50 }));
      act(() => {
        vi.advanceTimersByTime(300);
      });
      act(() => result.current.onWheel({ deltaX: 0, deltaY: 50 }));
      expect(onStep).not.toHaveBeenCalled();
    });
  });

  describe('ドラッグ', () => {
    it('90px 引くごとに 1 段めくる', () => {
      const { result } = setup();
      act(() => result.current.onPointerDown(pointer(500)));
      expect(result.current.dragging).toBe(true);

      // 右へ 90px = 過去へ 1 段。
      act(() => result.current.onPointerMove(pointer(590)));
      expect(onStep).toHaveBeenCalledWith(-1);

      // さらに 90px でもう 1 段。差分だけ送る。
      act(() => result.current.onPointerMove(pointer(680)));
      expect(onStep).toHaveBeenLastCalledWith(-1);
      expect(onStep).toHaveBeenCalledTimes(2);
    });

    it('しきい値未満では動かない', () => {
      const { result } = setup();
      act(() => result.current.onPointerDown(pointer(500)));
      act(() => result.current.onPointerMove(pointer(560)));
      expect(onStep).not.toHaveBeenCalled();
    });

    it('引き戻すと逆向きの差分が出る（行き過ぎても数が合う）', () => {
      const { result } = setup();
      act(() => result.current.onPointerDown(pointer(500)));
      act(() => result.current.onPointerMove(pointer(680))); // -2 段ぶん、差分 -2
      expect(onStep).toHaveBeenLastCalledWith(-2);
      act(() => result.current.onPointerMove(pointer(590))); // -1 段ぶんに戻す、差分 +1
      expect(onStep).toHaveBeenLastCalledWith(1);
    });

    it('離すと dragging が下りる', () => {
      const { result } = setup();
      act(() => result.current.onPointerDown(pointer(500)));
      act(() => result.current.onPointerUp());
      expect(result.current.dragging).toBe(false);
    });

    it('掴んでいなければ move は無反応', () => {
      const { result } = setup();
      act(() => result.current.onPointerMove(pointer(900)));
      expect(onStep).not.toHaveBeenCalled();
    });

    it('主ボタン以外では掴まない', () => {
      const { result } = setup();
      act(() => result.current.onPointerDown(pointer(500, 2)));
      expect(result.current.dragging).toBe(false);
      act(() => result.current.onPointerMove(pointer(900)));
      expect(onStep).not.toHaveBeenCalled();
    });
  });

  it('閉じたら途中の累積とドラッグを持ち越さない', () => {
    const { result, rerender } = setup();
    act(() => result.current.onWheel({ deltaX: 0, deltaY: 50 }));
    act(() => result.current.onPointerDown(pointer(500)));

    rerender({ isActive: false });
    rerender({ isActive: true });

    expect(result.current.dragging).toBe(false);
    // 開き直した直後のわずかな回転で 1 段飛ばない。
    act(() => result.current.onWheel({ deltaX: 0, deltaY: 20 }));
    expect(onStep).not.toHaveBeenCalled();
    // 掴み直していないので move も効かない。
    act(() => result.current.onPointerMove(pointer(900)));
    expect(onStep).not.toHaveBeenCalled();
  });
});
