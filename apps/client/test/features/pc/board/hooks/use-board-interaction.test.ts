import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useBoardInteraction } from '@/features/pc/board/hooks/use-board-interaction';
import type { BoardCardData } from '@/features/shared/board/types';

// この hook は **world 座標** を受け取る契約（呼び出し側が toWorld で変換する）。
// ズームを入れたときに壊れやすいのは「移動量が倍率の分だけ速く/遅くなる」ことと
// 「ドラッグ開始の閾値が倍率で過敏/鈍感になる」ことなので、その2点を軸に固める。

function makeCard(overrides: Partial<BoardCardData> = {}): BoardCardData {
  return {
    id: 'card-1',
    cardType: 'snippet',
    refId: 'snippet-1',
    x: 100,
    y: 200,
    rotation: 0,
    width: 260,
    height: 200,
    zIndex: 1,
    // main で必須化（利用者が自分で動かしたか）。既定は「まだ動かしていない」。
    userPositioned: false,
    createdAt: '2026-06-20T10:00:00.000Z',
    content: { text: 'メモ' },
    ...overrides,
  };
}

/** onCardsChange で更新されたカード配列を追いながら hook を回す。 */
function setup(initial: BoardCardData[], scale?: number) {
  let cards = initial;
  const onInteractionEnd = vi.fn();
  const view = renderHook(
    ({ current }: { current: BoardCardData[] }) =>
      useBoardInteraction(
        current,
        (next) => {
          cards = next;
        },
        onInteractionEnd,
        scale,
      ),
    { initialProps: { current: cards } },
  );
  return {
    view,
    onInteractionEnd,
    get cards() {
      return cards;
    },
    /** onCardsChange の結果を hook に反映する（実アプリの setCards 相当）。 */
    sync() {
      view.rerender({ current: cards });
    },
  };
}

describe('useBoardInteraction', () => {
  describe('ドラッグ', () => {
    it('world 座標の差分がそのままカード座標に乗る（倍率で速度が変わらない）', () => {
      const s = setup([makeCard({ x: 100, y: 200 })]);

      act(() => {
        s.view.result.current.startDrag('card-1', 500, 500);
      });
      act(() => {
        s.view.result.current.onPointerMove(560, 470);
      });

      expect(s.cards[0].x).toBe(160);
      expect(s.cards[0].y).toBe(170);
    });

    it('閾値未満の微小な移動ではドラッグが始まらない（クリックとして扱える）', () => {
      const s = setup([makeCard()]);

      act(() => {
        s.view.result.current.startDrag('card-1', 500, 500);
      });
      act(() => {
        s.view.result.current.onPointerMove(501, 501);
      });

      expect(s.view.result.current.didDrag()).toBe(false);
      expect(s.view.result.current.draggingId).toBeNull();
      expect(s.cards[0].x).toBe(100);
    });

    it('引いた状態（scale<1）では world 換算の閾値が広がり、同じ画面移動量で始まる', () => {
      // scale=0.5 → 閾値は world で 8。world 差分 6（画面 3px 相当）では始まらない。
      const zoomedOut = setup([makeCard()], 0.5);
      act(() => {
        zoomedOut.view.result.current.startDrag('card-1', 0, 0);
      });
      act(() => {
        zoomedOut.view.result.current.onPointerMove(6, 0);
      });
      expect(zoomedOut.view.result.current.didDrag()).toBe(false);

      // 等倍なら world 差分 6（画面 6px）は閾値 4 を超えるので始まる。
      const identity = setup([makeCard()], 1);
      act(() => {
        identity.view.result.current.startDrag('card-1', 0, 0);
      });
      act(() => {
        identity.view.result.current.onPointerMove(6, 0);
      });
      expect(identity.view.result.current.didDrag()).toBe(true);
    });

    it('寄った状態（scale>1）では小さな world 差分でもドラッグが始まる', () => {
      // scale=4 → 閾値は world で 1。world 差分 2 は画面 8px なので始まってよい。
      const s = setup([makeCard()], 4);
      act(() => {
        s.view.result.current.startDrag('card-1', 0, 0);
      });
      act(() => {
        s.view.result.current.onPointerMove(2, 0);
      });
      expect(s.view.result.current.didDrag()).toBe(true);
    });

    it('ドラッグ終了で最前面に上がり、保存コールバックが呼ばれる', () => {
      const s = setup([makeCard({ zIndex: 3 }), makeCard({ id: 'card-2', zIndex: 9 })]);

      act(() => {
        s.view.result.current.startDrag('card-1', 0, 0);
      });
      act(() => {
        s.view.result.current.onPointerMove(100, 100);
      });
      s.sync();
      act(() => {
        s.view.result.current.onPointerUp();
      });

      expect(s.cards[0].zIndex).toBeGreaterThan(9);
      expect(s.onInteractionEnd).toHaveBeenCalledTimes(1);
    });
  });

  describe('リサイズ', () => {
    it('se ハンドルは world 差分の分だけ幅・高さを増やし、原点は動かさない', () => {
      const s = setup([makeCard({ x: 100, y: 200, width: 260, height: 200 })]);

      act(() => {
        s.view.result.current.startResize('card-1', 'se', 0, 0);
      });
      act(() => {
        s.view.result.current.onPointerMove(40, 30);
      });

      expect(s.cards[0]).toMatchObject({ x: 100, y: 200, width: 300, height: 230 });
    });

    it('nw ハンドルは原点を動かしつつ縮める', () => {
      const s = setup([makeCard({ x: 100, y: 200, width: 260, height: 200 })]);

      act(() => {
        s.view.result.current.startResize('card-1', 'nw', 0, 0);
      });
      act(() => {
        s.view.result.current.onPointerMove(20, 10);
      });

      expect(s.cards[0]).toMatchObject({ x: 120, y: 210, width: 240, height: 190 });
    });

    it('下限（world 120）より小さくならない — Zod の width/height 下限と揃っている', () => {
      const s = setup([makeCard({ x: 100, y: 200, width: 260, height: 200 })]);

      act(() => {
        s.view.result.current.startResize('card-1', 'se', 0, 0);
      });
      act(() => {
        s.view.result.current.onPointerMove(-9999, -9999);
      });

      expect(s.cards[0].width).toBe(120);
      expect(s.cards[0].height).toBe(120);
    });
  });

  describe('回転', () => {
    it('world 座標で渡した中心とポインタから角度差を出す（等方スケールで角度は不変）', () => {
      const s = setup([makeCard({ rotation: 0 })]);

      // 中心 (0,0)、開始ポインタは右（0°）、移動後は下（+90°）。
      act(() => {
        s.view.result.current.startRotate('card-1', 0, 0, 100, 0);
      });
      act(() => {
        s.view.result.current.onPointerMove(0, 100);
      });

      expect(s.cards[0].rotation).toBeCloseTo(90, 5);
    });
  });

  describe('選択', () => {
    it('押下で選択され、deselect で解除される', () => {
      const s = setup([makeCard()]);

      act(() => {
        s.view.result.current.startDrag('card-1', 0, 0);
      });
      expect(s.view.result.current.selectedId).toBe('card-1');

      act(() => {
        s.view.result.current.deselect();
      });
      expect(s.view.result.current.selectedId).toBeNull();
    });

    it('存在しないカードの操作は無視する', () => {
      const s = setup([makeCard()]);

      act(() => {
        s.view.result.current.startDrag('missing', 0, 0);
      });
      act(() => {
        s.view.result.current.onPointerMove(500, 500);
      });

      expect(s.cards[0].x).toBe(100);
    });
  });
});
