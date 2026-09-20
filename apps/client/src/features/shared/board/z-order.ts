import type { BoardCardData } from '@/features/shared/board/types';

/**
 * カードを前面へ出すときの、新しい重なり順（端末非依存）。
 *
 * **PC と SP で同じ規則を使う。** 以前は PC（`use-board-interaction`）と
 * SP（`sp-board`）がそれぞれ自前で採番しており、PC 側だけが「マウント時に決めた値」から
 * しか進めていなかった。そのため前のセッションで手前に置いたカード（保存された z が
 * 大きい）より下に潜り、「クリックしても埋もれたまま」になっていた。片方を直しても
 * もう片方が緑のままになるので、規則そのものをここに 1 つだけ置く。
 *
 * @param floor 呼び出し側が持っている採番の下限（同じ操作を続けたときに戻らないように）。
 * @returns 新しい z。**既に最前面なら `null`**（動かす必要が無い＝保存要求も出さない）。
 */
export function frontZIndex(
  cards: readonly BoardCardData[],
  cardId: string,
  floor = 0,
): number | null {
  const target = cards.find((card) => card.id === cardId);
  if (target === undefined) return null;

  // 他の全部より**厳密に**上にいるときだけ動かさない。同じ z が並んでいるときは
  // 描画順（DOM の並び）で勝ち負けが決まってしまうので、押したほうを前へ出す。
  // **floor は「前面かどうか」の判定には使わない**（採番が先に進んでいるだけで、
  // 盤面の見た目は変わらない）。
  const isFront = cards.every((card) => card.id === cardId || card.zIndex < target.zIndex);
  if (isFront) return null;

  const top = cards.reduce((max, card) => Math.max(max, card.zIndex), 0);
  return Math.max(top, floor) + 1;
}

/** 1 枚を前面へ出した配列を返す。既に最前面なら `null`（呼び出し側は何もしない）。 */
export function raiseToFront(
  cards: readonly BoardCardData[],
  cardId: string,
): BoardCardData[] | null {
  const zIndex = frontZIndex(cards, cardId);
  if (zIndex === null) return null;

  return cards.map((card) =>
    // 前面へ出すのは利用者の意思。自動整列（applyDefaultZOrder）の対象から外す。
    card.id === cardId ? { ...card, zIndex, userPositioned: true } : card,
  );
}
