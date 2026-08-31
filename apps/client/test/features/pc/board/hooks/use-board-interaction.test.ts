import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useBoardInteraction } from '@/features/pc/board/hooks/use-board-interaction';
import type { BoardCardData } from '@/features/shared/board/types';

function card(id: string, zIndex: number): BoardCardData {
  return {
    id,
    cardType: 'entry',
    refId: `e-${id}`,
    x: 100,
    y: 100,
    rotation: 0,
    width: 340,
    height: 280,
    zIndex,
    userPositioned: false,
    createdAt: '2026-04-11T10:00:00Z',
    content: { title: 'タイトル', preview: '本文', createdAt: '2026-04-11T10:00:00Z' },
  };
}

/** onCardsChange に渡された最新の cards から、対象カードを取り出す。 */
function latest(onCardsChange: ReturnType<typeof vi.fn>, id: string): BoardCardData | undefined {
  const lastCall = onCardsChange.mock.calls.at(-1);
  return lastCall?.[0]?.find((c: BoardCardData) => c.id === id);
}

describe('useBoardInteraction', () => {
  let cards: BoardCardData[];
  let onCardsChange: ReturnType<typeof vi.fn>;
  let onInteractionEnd: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    cards = [card('a', 0), card('b', 1)];
    onCardsChange = vi.fn();
    onInteractionEnd = vi.fn();
  });

  const setup = () => renderHook(() => useBoardInteraction(cards, onCardsChange, onInteractionEnd));

  it('掴んだ時点でそのカードを選択する', () => {
    const { result } = setup();

    act(() => result.current.startDrag('a', 10, 10));

    expect(result.current.selectedId).toBe('a');
  });

  it('動かさずに離しただけでは前面に出さない（選択のつもりが並び順を変えない）', () => {
    // startDrag は pointerdown の時点で type='drag' を立てる。didDrag を見ずに
    // z を上げていたため、選ぶために1回押しただけでカードが最前面へ飛び、
    // userPositioned まで立って自動整列からも外れていた。
    const { result } = setup();

    act(() => result.current.startDrag('a', 10, 10));
    act(() => result.current.onPointerUp());

    expect(onCardsChange).not.toHaveBeenCalled();
    expect(result.current.didDrag()).toBe(false);
  });

  it('動かさずに離しただけでは保存要求も出さない（盤面に変化が無いため）', () => {
    const { result } = setup();

    act(() => result.current.startDrag('a', 10, 10));
    act(() => result.current.onPointerUp());

    expect(onInteractionEnd).not.toHaveBeenCalled();
  });

  it('閾値未満のわずかな揺れは、動かしたことにしない', () => {
    const { result } = setup();

    act(() => result.current.startDrag('a', 10, 10));
    act(() => result.current.onPointerMove(12, 11));
    act(() => result.current.onPointerUp());

    expect(result.current.didDrag()).toBe(false);
    expect(onInteractionEnd).not.toHaveBeenCalled();
  });

  it('実際に動かしたら前面に出し、利用者が置いたものとして印を付ける', () => {
    const { result } = setup();

    act(() => result.current.startDrag('a', 10, 10));
    act(() => result.current.onPointerMove(80, 70));
    act(() => result.current.onPointerUp());

    const moved = latest(onCardsChange, 'a');
    expect(result.current.didDrag()).toBe(true);
    expect(moved?.userPositioned).toBe(true);
    // 既存の最大 z(1) より手前へ
    expect(moved?.zIndex).toBeGreaterThan(1);
    expect(onInteractionEnd).toHaveBeenCalled();
  });

  it('動かしている間は位置が追従する', () => {
    const { result } = setup();

    act(() => result.current.startDrag('a', 10, 10));
    act(() => result.current.onPointerMove(60, 40));

    const moved = latest(onCardsChange, 'a');
    expect(moved?.x).toBe(150);
    expect(moved?.y).toBe(130);
  });

  it('回転は動かした量がそのまま結果なので、離したら保存要求を出す', () => {
    const { result } = setup();

    act(() => result.current.startRotate('a', 200, 200, 210, 200));
    act(() => result.current.onPointerMove(200, 260));
    act(() => result.current.onPointerUp());

    expect(onInteractionEnd).toHaveBeenCalled();
  });

  it('リサイズも同様に保存要求を出す', () => {
    const { result } = setup();

    act(() => result.current.startResize('a', 'se', 10, 10));
    act(() => result.current.onPointerMove(90, 90));
    act(() => result.current.onPointerUp());

    expect(onInteractionEnd).toHaveBeenCalled();
  });

  it('deselect で選択が外れる', () => {
    const { result } = setup();

    act(() => result.current.startDrag('a', 10, 10));
    act(() => result.current.deselect());

    expect(result.current.selectedId).toBeNull();
  });

  it('次に掴んだときは didDrag が戻る（前の操作を引きずらない）', () => {
    const { result } = setup();

    act(() => result.current.startDrag('a', 10, 10));
    act(() => result.current.onPointerMove(80, 70));
    act(() => result.current.onPointerUp());
    expect(result.current.didDrag()).toBe(true);

    act(() => result.current.startDrag('b', 10, 10));

    expect(result.current.didDrag()).toBe(false);
  });
});
