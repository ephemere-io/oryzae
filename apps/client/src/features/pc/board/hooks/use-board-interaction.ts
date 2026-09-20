'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import {
  type CardGeometry,
  MIN_CARD_SIZE,
  type ResizeCorner,
  scaleSelection,
  selectionBounds,
  toggleSelection,
} from '@/features/shared/board/selection';
import type { BoardCardData } from '@/features/shared/board/types';
import { frontZIndex } from '@/features/shared/board/z-order';
import type { Bounds } from '@/lib/canvas/viewport';

type InteractionType = 'drag' | 'rotate' | 'resize';

interface DragState {
  type: 'drag';
  /** 掴んでいるカード（複数選んでいれば群ごと動く）。 */
  ids: string[];
  startX: number;
  startY: number;
  starts: CardGeometry[];
}

interface RotateState {
  type: 'rotate';
  cardId: string;
  centerX: number;
  centerY: number;
  startAngle: number;
  cardStartRotation: number;
}

interface ResizeState {
  type: 'resize';
  ids: string[];
  corner: ResizeCorner;
  startX: number;
  startY: number;
  starts: CardGeometry[];
  /** 掴んだ時点の囲み。群のときだけ使う（1 枚のときは starts[0] と同じ）。 */
  box: Bounds;
}

type InteractionState = DragState | RotateState | ResizeState | null;

/** ドラッグとみなす移動量（**画面 px**）。world 換算は scale で割って求める。 */
const DRAG_THRESHOLD_PX = 4;

const geometryOf = (card: BoardCardData): CardGeometry => ({
  id: card.id,
  x: card.x,
  y: card.y,
  width: card.width,
  height: card.height,
});

/**
 * ボード上のカードのドラッグ・回転・リサイズと、**選択（1 枚 / 複数）**。
 *
 * **座標はすべて world 単位で受け取る**（`clientX/Y` ではない）。呼び出し側が
 * `CanvasSurface.toWorld()` で変換してから渡すこと。こうしておくとズーム倍率が
 * この hook に一切漏れず、位置計算は「world の差分を world の値に足す」だけで済む。
 *
 * 唯一 scale を知る必要があるのは「どれだけ動いたらドラッグ開始か」の閾値で、これは
 * ユーザーの指の移動量＝画面 px で決まるべきものなので、world 換算に scale を使う。
 *
 * 複数選択は Shift クリックで作る。**選択の中のカードを掴んだら群ごと動く**
 * （掴んだ 1 枚だけが抜けていくと、並べ直した関係がその場で壊れる）。
 * 群の拡大縮小は `features/shared/board/selection` の算数に委ねる。
 *
 * @param scale 現在の表示倍率。ドラッグ開始閾値の換算にのみ使う。
 */
export function useBoardInteraction(
  cards: BoardCardData[],
  onCardsChange: (cards: BoardCardData[]) => void,
  /** 操作を終えた時点の配列。**これをそのまま保存する**（呼び出し側の state は古い）。 */
  onInteractionEnd: (cards: BoardCardData[]) => void,
  scale = 1,
) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const stateRef = useRef<InteractionState>(null);
  const didDragRef = useRef(false);
  const zCounterRef = useRef(cards.length > 0 ? Math.max(...cards.map((c) => c.zIndex)) + 1 : 100);

  /** ちょうど 1 枚のときだけ id。「開く」「回す」はこれが無いと始まらない。 */
  const selectedId = selectedIds.length === 1 ? selectedIds[0] : null;

  const updateCard = useCallback(
    (cardId: string, update: Partial<BoardCardData>) => {
      onCardsChange(cards.map((c) => (c.id === cardId ? { ...c, ...update } : c)));
    },
    [cards, onCardsChange],
  );

  /** 複数枚の位置・大きさをまとめて差し替える。 */
  const applyGeometry = useCallback(
    (next: readonly CardGeometry[]) => {
      const byId = new Map(next.map((g) => [g.id, g]));
      onCardsChange(
        cards.map((card) => {
          const g = byId.get(card.id);
          return g === undefined
            ? card
            : { ...card, x: g.x, y: g.y, width: g.width, height: g.height };
        }),
      );
    },
    [cards, onCardsChange],
  );

  const startDrag = useCallback(
    (cardId: string, pointerX: number, pointerY: number, additive = false) => {
      const card = cards.find((c) => c.id === cardId);
      if (!card) return;

      // Shift は選択を足す／外す。外したときは掴まない（外した直後に動き出すと、
      // 「選択から抜いたつもりのカードが動く」ことになる）。
      // Shift 無しで選択の中を掴んだときは、選択を保ったまま群ごと動かす。
      const ids = additive
        ? toggleSelection(selectedIds, cardId)
        : selectedIds.includes(cardId)
          ? selectedIds
          : [cardId];

      setSelectedIds(ids);
      didDragRef.current = false;

      if (!ids.includes(cardId)) {
        stateRef.current = null;
        return;
      }

      stateRef.current = {
        type: 'drag',
        ids,
        startX: pointerX,
        startY: pointerY,
        starts: cards.filter((c) => ids.includes(c.id)).map(geometryOf),
      };
    },
    [cards, selectedIds],
  );

  const startRotate = useCallback(
    (cardId: string, centerX: number, centerY: number, pointerX: number, pointerY: number) => {
      const card = cards.find((c) => c.id === cardId);
      if (!card) return;
      const startAngle = Math.atan2(pointerY - centerY, pointerX - centerX) * (180 / Math.PI);
      stateRef.current = {
        type: 'rotate',
        cardId,
        centerX,
        centerY,
        startAngle,
        cardStartRotation: card.rotation,
      };
    },
    [cards],
  );

  /**
   * 大きさを変え始める。`cardId` を省くと**選択している群**を対象にする
   * （群の枠の角を掴んだとき）。
   */
  const startResize = useCallback(
    (cardId: string | null, corner: ResizeCorner, pointerX: number, pointerY: number) => {
      const ids = cardId === null ? selectedIds : [cardId];
      const starts = cards.filter((c) => ids.includes(c.id)).map(geometryOf);
      if (starts.length === 0) return;
      const box = selectionBounds(cards, ids);
      if (box === null) return;

      stateRef.current = {
        type: 'resize',
        ids,
        corner,
        startX: pointerX,
        startY: pointerY,
        starts,
        box,
      };
    },
    [cards, selectedIds],
  );

  const onPointerMove = useCallback(
    (pointerX: number, pointerY: number) => {
      const state = stateRef.current;
      if (!state) return;

      if (state.type === 'drag') {
        const dx = pointerX - state.startX;
        const dy = pointerY - state.startY;
        // 閾値は画面 px 基準。引いた状態（scale<1）で過敏に、寄った状態（scale>1）で
        // 鈍くならないよう world 単位に換算してから比べる。
        const thresholdWorld = DRAG_THRESHOLD_PX / scale;
        if (!didDragRef.current && Math.abs(dx) + Math.abs(dy) < thresholdWorld) return;
        didDragRef.current = true;
        setDraggingId(state.ids.length === 1 ? state.ids[0] : null);
        // 掴んだ時点の位置に差分を足す（前フレームからの差ではないので、取りこぼしても
        // ずれが積み上がらない）。
        applyGeometry(state.starts.map((g) => ({ ...g, x: g.x + dx, y: g.y + dy })));
      } else if (state.type === 'rotate') {
        const currentAngle =
          Math.atan2(pointerY - state.centerY, pointerX - state.centerX) * (180 / Math.PI);
        const delta = currentAngle - state.startAngle;
        const rotation = Math.round((state.cardStartRotation + delta) * 10) / 10;
        updateCard(state.cardId, { rotation });
      } else if (state.type === 'resize') {
        const dx = pointerX - state.startX;
        const dy = pointerY - state.startY;

        if (state.starts.length > 1) {
          // 群は等方に。縦横ばらばらに伸ばすと、傾いたカードが矩形では表せない形になる。
          applyGeometry(scaleSelection(state.starts, state.box, state.corner, dx, dy));
          return;
        }

        // 1 枚のときは縦横を別々に変えられる（従来どおり）。
        const start = state.starts[0];
        let newW = start.width;
        let newH = start.height;
        let newX = start.x;
        let newY = start.y;

        if (state.corner === 'se') {
          newW = Math.max(MIN_CARD_SIZE, start.width + dx);
          newH = Math.max(MIN_CARD_SIZE, start.height + dy);
        } else if (state.corner === 'sw') {
          newW = Math.max(MIN_CARD_SIZE, start.width - dx);
          newH = Math.max(MIN_CARD_SIZE, start.height + dy);
          newX = start.x + (start.width - newW);
        } else if (state.corner === 'ne') {
          newW = Math.max(MIN_CARD_SIZE, start.width + dx);
          newH = Math.max(MIN_CARD_SIZE, start.height - dy);
          newY = start.y + (start.height - newH);
        } else if (state.corner === 'nw') {
          newW = Math.max(MIN_CARD_SIZE, start.width - dx);
          newH = Math.max(MIN_CARD_SIZE, start.height - dy);
          newX = start.x + (start.width - newW);
          newY = start.y + (start.height - newH);
        }

        updateCard(start.id, { x: newX, y: newY, width: newW, height: newH });
      }
    },
    [updateCard, applyGeometry, scale],
  );

  const onPointerUp = useCallback(() => {
    const state = stateRef.current;
    stateRef.current = null;
    setDraggingId(null);
    if (state === null) return;

    // 保存には**いま作った配列をそのまま渡す**。`onInteractionEnd()` を引数なしで呼んで
    // 呼び出し側の state を読ませていたころは、直前の `onCardsChange` がまだ再レンダー
    // されておらず、**前面へ出した z が保存に乗らなかった**（画面では前に出るのに、
    // 次に開くと埋もれ直す）。何を保存するかは、それを作った側が渡す。
    const commit = (next: BoardCardData[]) => {
      onCardsChange(next);
      onInteractionEnd(next);
    };

    /** 触ったカードに「利用者が自分で置いた」印を付ける（自動整列の対象から外す）。 */
    const marked = (ids: readonly string[], zIndex: number | null, zTarget: string | null) =>
      cards.map((card) =>
        ids.includes(card.id)
          ? {
              ...card,
              ...(zIndex !== null && card.id === zTarget ? { zIndex } : {}),
              userPositioned: true,
            }
          : card,
      );

    if (state.type === 'drag') {
      // **押しただけでも前面に出す。** 以前は「実際に動かしたときだけ」にしていたが、
      // カードが重なっていると、下のカードを押しても埋もれたままで読めなかった
      // （レビュー: 「クリックしたら前面に出るようにしてほしい」）。掘り出す操作が
      // 掴んで動かすことしか無いのは、重ねて貼る板として使いにくい。
      //
      // ただし**既に最前面のカードを押しただけ**のときは何もしない。盤面に変化が
      // 無いのに保存要求を出すと、選ぶたびに PUT が飛ぶ。
      // 採番の規則は `features/shared/board/z-order` に 1 つだけ置いてある
      // （SP の盤面も同じものを呼ぶ。別々に持っていたころ、PC だけが古い採番のまま
      // 「クリックしても埋もれたまま」になっていた）。
      //
      // 複数選んでいるときは前面へ出さない。まとめて掴んだだけで重なり順が変わると、
      // 並べた関係が意図せず動く（前面へ出したいときは道具箱から明示的に呼ぶ）。
      const single = state.ids.length === 1 ? state.ids[0] : null;
      const zIndex = single === null ? null : frontZIndex(cards, single, zCounterRef.current);
      if (zIndex !== null) zCounterRef.current = zIndex;

      // 盤面に何も変化が無いなら保存要求も出さない（選ぶたびに PUT を飛ばさない）。
      if (zIndex === null && !didDragRef.current) return;

      // 動かした分は onPointerMove が既に反映している。ここでは z と印を足すだけ。
      commit(marked(state.ids, zIndex, single));
      return;
    }

    // 回転・リサイズは動いた分がそのまま結果。印だけ付けて保存する。
    const ids = state.type === 'rotate' ? [state.cardId] : state.ids;
    commit(marked(ids, null, null));
  }, [cards, onCardsChange, onInteractionEnd]);

  const deselect = useCallback(() => {
    setSelectedIds([]);
  }, []);

  const getInteractionType = (): InteractionType | null => {
    return stateRef.current?.type ?? null;
  };

  const didDrag = () => didDragRef.current;

  /** 選んでいるカードを囲む world 矩形（2 枚以上のときだけ）。 */
  const groupBounds = useMemo(
    () => (selectedIds.length > 1 ? selectionBounds(cards, selectedIds) : null),
    [cards, selectedIds],
  );

  return {
    selectedIds,
    selectedId,
    setSelectedIds,
    groupBounds,
    draggingId,
    startDrag,
    startRotate,
    startResize,
    onPointerMove,
    onPointerUp,
    deselect,
    getInteractionType,
    didDrag,
  };
}
