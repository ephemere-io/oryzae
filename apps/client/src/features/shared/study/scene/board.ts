/**
 * 壁のボードに貼るカードの座標変換（`docs/oryzae-study/21-3d-parameters.md`「ボードの座標変換」）。
 *
 * board 画面と**同じ位置・回転・サイズ・重なり順**に見えることが要件なので、DOM 側の
 * world 座標をそのまま比率を保って板の面へ写す。純関数のみ。
 */

import { RENDER_LIMITS } from '../constants';
import type { StudyBoardCard } from '../types';

/** 板の面の寸法。 */
export const BOARD_FACE = { width: 8, height: 5, depth: 0.2 } as const;

/** 板の格子の間隔。 */
export const BOARD_GRID_SPACING = 1.0;

/** 面の縁に残す余白（カードが板の端で切れないように）。 */
const MARGIN_X = 1.1;
const MARGIN_Y = 0.9;

/** 1 枚ごとに手前へ持ち上げる量。重なり順を深度で表す。 */
const Z_STEP = 0.006;

/** カードを貼る面の z（板の表面からわずかに浮かせる）。 */
const Z_BASE = 0.13;

export interface PlacedBoardCard {
  card: StudyBoardCard;
  /** ボードローカルの座標。 */
  x: number;
  y: number;
  z: number;
  /** ボードローカルの回転（rad）。 */
  rotationZ: number;
  /** ボードローカルの寸法。 */
  width: number;
  height: number;
  /** 抽象カードに引く罫線の本数。 */
  lines: number;
}

interface Bbox {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

/** カード群を囲む矩形。回転は無視する（board 画面の bbox と揃えるため）。 */
function boundingBox(cards: readonly StudyBoardCard[]): Bbox {
  let minX = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (const card of cards) {
    minX = Math.min(minX, card.x);
    maxX = Math.max(maxX, card.x + card.width);
    minY = Math.min(minY, card.y);
    maxY = Math.max(maxY, card.y + card.height);
  }
  return { minX, maxX, minY, maxY };
}

/**
 * カード群を板の面に収める倍率。
 *
 * 幅と高さの両方が入る側に合わせる。カードが 1 枚だけ・すべて同じ位置など、bbox が
 * 潰れる場合に Infinity を返さないこと（1 枚のボードは実際に起きる）。
 */
function fitScale(bbox: Bbox): number {
  const spanX = bbox.maxX - bbox.minX;
  const spanY = bbox.maxY - bbox.minY;
  const scaleX = spanX > 1e-6 ? (BOARD_FACE.width - MARGIN_X) / spanX : Number.POSITIVE_INFINITY;
  const scaleY = spanY > 1e-6 ? (BOARD_FACE.height - MARGIN_Y) / spanY : Number.POSITIVE_INFINITY;
  const scale = Math.min(scaleX, scaleY);
  // 両方潰れている（＝実質 1 点）なら等倍で置く。
  return Number.isFinite(scale) ? scale : 1;
}

/**
 * カードを板の面に貼る。
 *
 * DOM の y は下向き、3D の y は上向きなので**符号が反転する**。回転も同じ理由で反転。
 * `zIndex` 昇順に並べ、奥から手前へ持ち上げる。
 *
 * 描画コストはカード数に比例するので、`zIndex` の大きい順に最大 30 枚で打ち切る
 * （切るなら手前ではなく奥から。奥のカードは他に隠れて見えないため）。
 */
export function placeBoardCards(cards: readonly StudyBoardCard[]): PlacedBoardCard[] {
  if (cards.length === 0) return [];

  // 打ち切りは zIndex の大きい（手前の）ものを残す。
  const kept =
    cards.length <= RENDER_LIMITS.maxBoardCards
      ? [...cards]
      : [...cards].sort((a, b) => b.zIndex - a.zIndex).slice(0, RENDER_LIMITS.maxBoardCards);

  // 貼る順は zIndex 昇順（奥から手前へ）。
  const ordered = kept.sort((a, b) => a.zIndex - b.zIndex);

  // bbox は**実際に貼る枚数**から取る。全カードから取ると、打ち切られた遠くの 1 枚に
  // 引きずられて残りが中央へ潰れる。
  const bbox = boundingBox(ordered);
  const scale = fitScale(bbox);
  const centerX = (bbox.minX + bbox.maxX) / 2;
  const centerY = (bbox.minY + bbox.maxY) / 2;

  return ordered.map((card, index) => ({
    card,
    x: (card.x + card.width / 2 - centerX) * scale,
    // DOM の y は下向き。
    y: -(card.y + card.height / 2 - centerY) * scale,
    z: Z_BASE + index * Z_STEP,
    // 回転も DOM と逆向き。
    rotationZ: (-card.rotation * Math.PI) / 180,
    width: card.width * scale,
    height: card.height * scale,
    lines: card.lines,
  }));
}

/**
 * スニペットの本文から抽象カードの罫線数を出す。
 *
 * 本文そのものは書斎に出さない（日記の中身を 3D の壁に貼らない）。長さだけを線の数に写す。
 */
export function snippetLineCount(text: string, cardHeight: number): number {
  // カードの高さで引ける本数の上限を決め、その中で本文長に比例させる。
  const maxLines = Math.max(2, Math.floor(cardHeight / 26));
  const byLength = Math.ceil(text.trim().length / 18);
  return Math.max(1, Math.min(maxLines, byLength));
}

/** 写真カードは内枠 1 本だけ（罫線は引かない）。 */
export const PHOTO_INNER_INSET = 0.06;
