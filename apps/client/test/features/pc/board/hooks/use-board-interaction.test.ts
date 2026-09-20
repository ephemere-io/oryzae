import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
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

// 以下は同じ hook を別の角度から見る。上は「world 座標と倍率」、
// ここは「選択と並び順、保存要求を出す条件」。
function card(id: string, zIndex: number): BoardCardData {
  return {
    id,
    cardType: 'snippet',
    refId: `e-${id}`,
    x: 100,
    y: 100,
    rotation: 0,
    width: 340,
    height: 280,
    zIndex,
    userPositioned: false,
    createdAt: '2026-04-11T10:00:00Z',
    content: { text: 'メモ' },
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

  it('押しただけでも前面に出す（重なった下のカードを掘り出せる）', () => {
    // 以前は「実際に動かしたときだけ」前面に出していた。重なっている板では、下の
    // カードを押しても埋もれたままで読めない（レビュー指摘）ため、押した時点で出す。
    const { result } = setup();

    act(() => result.current.startDrag('a', 10, 10));
    act(() => result.current.onPointerUp());

    const raised = latest(onCardsChange, 'a');
    expect(result.current.didDrag()).toBe(false);
    // 既存の最大 z(1) より手前へ。動かしていないので位置は変わらない。
    expect(raised?.zIndex).toBeGreaterThan(1);
    expect(raised?.x).toBe(100);
    expect(raised?.userPositioned).toBe(true);
    expect(onInteractionEnd).toHaveBeenCalled();
  });

  it('前のセッションで手前に置いたカード（z が大きい）より上に出す', () => {
    // 採番をマウント時の値からしか進めていなかったころは、保存済みの大きな z より
    // 下に潜り、PC で「クリックしても埋もれたまま」に見えていた（実機レビュー指摘）。
    cards = [card('a', 0), { ...card('b', 500), userPositioned: true }];
    const { result } = setup();

    act(() => result.current.startDrag('a', 10, 10));
    act(() => result.current.onPointerUp());

    expect(latest(onCardsChange, 'a')?.zIndex).toBeGreaterThan(500);
  });

  it('既に最前面のカードを押しただけなら、並びも保存も動かさない', () => {
    // 盤面に変化が無いのに保存要求を出すと、選ぶたびに PUT が飛ぶ。
    const { result } = setup();

    act(() => result.current.startDrag('b', 10, 10));
    act(() => result.current.onPointerUp());

    expect(onCardsChange).not.toHaveBeenCalled();
    expect(onInteractionEnd).not.toHaveBeenCalled();
  });

  it('閾値未満のわずかな揺れは、動かしたことにしない', () => {
    const { result } = setup();

    act(() => result.current.startDrag('a', 10, 10));
    act(() => result.current.onPointerMove(12, 11));
    act(() => result.current.onPointerUp());

    expect(result.current.didDrag()).toBe(false);
    // 前面へは出るが、位置は押したときのまま。
    expect(latest(onCardsChange, 'a')?.x).toBe(100);
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

/**
 * 複数選択。**Shift で足す／外す、選択の中を掴んだら群ごと動く**が要点。
 *
 * 目で見ると「なんとなく動いた」までしか分からない（どのカードがどれだけずれたのかを
 * 追えない）ので、関係を数で固定する。
 */
describe('useBoardInteraction（複数選択）', () => {
  const two = () => [
    makeCard({ id: 'a', x: 0, y: 0, width: 200, height: 100, zIndex: 1 }),
    makeCard({ id: 'b', x: 300, y: 200, width: 200, height: 100, zIndex: 2 }),
  ];

  it('Shift で押すと選択に足される', () => {
    const s = setup(two());

    act(() => s.view.result.current.startDrag('a', 0, 0));
    act(() => s.view.result.current.startDrag('b', 0, 0, true));

    expect(s.view.result.current.selectedIds).toEqual(['a', 'b']);
  });

  it('複数選んでいる間は selectedId が null（「開く」を出さないための唯一の根拠）', () => {
    const s = setup(two());

    act(() => s.view.result.current.startDrag('a', 0, 0));
    act(() => s.view.result.current.startDrag('b', 0, 0, true));

    expect(s.view.result.current.selectedId).toBeNull();
  });

  it('Shift で既に選んでいるカードを押すと外れ、そのまま動き出さない', () => {
    const s = setup(two());

    act(() => s.view.result.current.startDrag('a', 0, 0));
    act(() => s.view.result.current.startDrag('b', 0, 0, true));
    act(() => s.view.result.current.startDrag('b', 0, 0, true));
    expect(s.view.result.current.selectedIds).toEqual(['a']);

    // 外した直後に指を動かしても、外したカードは動かない
    act(() => s.view.result.current.onPointerMove(100, 100));
    expect(s.cards.find((c) => c.id === 'b')?.x).toBe(300);
  });

  it('選択の中を（Shift 無しで）掴むと、選択を保ったまま群ごと動く', () => {
    const s = setup(two());

    act(() => s.view.result.current.startDrag('a', 0, 0));
    act(() => s.view.result.current.startDrag('b', 0, 0, true));
    s.sync();
    act(() => s.view.result.current.startDrag('a', 0, 0));
    act(() => s.view.result.current.onPointerMove(50, 30));

    expect(s.view.result.current.selectedIds).toEqual(['a', 'b']);
    expect(s.cards.find((c) => c.id === 'a')).toMatchObject({ x: 50, y: 30 });
    expect(s.cards.find((c) => c.id === 'b')).toMatchObject({ x: 350, y: 230 });
  });

  it('選択の外を（Shift 無しで）掴むと、その 1 枚だけの選択に戻る', () => {
    const s = setup([...two(), makeCard({ id: 'c', x: 900, y: 900 })]);

    act(() => s.view.result.current.startDrag('a', 0, 0));
    act(() => s.view.result.current.startDrag('b', 0, 0, true));
    s.sync();
    act(() => s.view.result.current.startDrag('c', 0, 0));

    expect(s.view.result.current.selectedIds).toEqual(['c']);
  });

  it('群の枠の角を引くと、反対の角を固定したまま等方に伸びる', () => {
    const s = setup(two());

    act(() => s.view.result.current.startDrag('a', 0, 0));
    act(() => s.view.result.current.startDrag('b', 0, 0, true));
    s.sync();
    // 囲みは 0,0 - 500,300。右下を掴んで縦横とも 2 倍の位置まで引く
    act(() => s.view.result.current.startResize(null, 'se', 500, 300));
    act(() => s.view.result.current.onPointerMove(1000, 600));

    const a = s.cards.find((c) => c.id === 'a');
    const b = s.cards.find((c) => c.id === 'b');
    // 左上（固定点）は動かない
    expect(a).toMatchObject({ x: 0, y: 0, width: 400, height: 200 });
    // 間隔も一緒に伸びる
    expect(b).toMatchObject({ x: 600, y: 400 });
  });

  it('まとめて掴んで離しても重なり順は変わらない（並べた関係を勝手に動かさない）', () => {
    const s = setup(two());

    act(() => s.view.result.current.startDrag('a', 0, 0));
    act(() => s.view.result.current.startDrag('b', 0, 0, true));
    s.sync();
    act(() => s.view.result.current.startDrag('a', 0, 0));
    act(() => s.view.result.current.onPointerMove(50, 50));
    act(() => s.view.result.current.onPointerUp());

    expect(s.cards.find((c) => c.id === 'a')?.zIndex).toBe(1);
    expect(s.cards.find((c) => c.id === 'b')?.zIndex).toBe(2);
    // 動かしたことは保存に乗せる（次の取得で自動整列に巻き込まれないように）
    expect(s.cards.every((c) => c.userPositioned)).toBe(true);
  });

  it('群の枠は 2 枚以上選んでいるときだけ出る', () => {
    const s = setup(two());

    act(() => s.view.result.current.startDrag('a', 0, 0));
    expect(s.view.result.current.groupBounds).toBeNull();

    act(() => s.view.result.current.startDrag('b', 0, 0, true));
    s.sync();
    expect(s.view.result.current.groupBounds).toEqual({
      x: 0,
      y: 0,
      width: 500,
      height: 300,
    });
  });
});
