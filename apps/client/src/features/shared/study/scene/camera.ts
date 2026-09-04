/**
 * 遷移先のカメラ（`docs/oryzae-study/21-3d-parameters.md`「遷移先のカメラ」）。
 *
 * 行き先はすべて配置表から導く。PC / SP で式は同じで、距離だけ差し替える。
 * 純関数のみ。
 */

import { BREATH, SP_BOARD_CLOSE_RATIO, SPREAD_VIEW_Z_NUDGE, TOP_VIEW_Z_NUDGE } from '../constants';
import type { StudyLayout } from '../layout';

export interface CameraView {
  position: { x: number; y: number; z: number };
  target: { x: number; y: number; z: number };
}

/** 書斎のホーム位置。 */
export function homeView(layout: StudyLayout): CameraView {
  return {
    position: { ...layout.camera.position },
    target: { ...layout.camera.target },
  };
}

/** 瓶・封へ。**左方向へパンする**のであって、突っ込むズームではない。 */
export function jarView(layout: StudyLayout): CameraView {
  const distance = layout.viewDistance.jar;
  return {
    position: { x: layout.jar.x, y: layout.jar.y + 3.2, z: layout.jar.z + distance },
    target: { x: layout.jar.x, y: layout.jar.y + 1.5, z: layout.jar.z },
  };
}

/**
 * 手帳の真上へ。
 *
 * `topY` は積みの一番上の冊の上面（机の y を足した world 値）。完全な真上は up ベクトルと
 * 平行になって `lookAt` が破綻するので、z を注視点からわずかにずらす。
 */
export function journalTopView(layout: StudyLayout, topY: number): CameraView {
  const distance = layout.viewDistance.journal;
  return {
    position: { x: layout.desk.x, y: topY + distance, z: layout.desk.z + TOP_VIEW_Z_NUDGE },
    target: { x: layout.desk.x, y: topY, z: layout.desk.z },
  };
}

/** 開いた見開きの中心へ寄る。蝶番のぶん左へずれる。 */
export function journalSpreadView(layout: StudyLayout, topY: number): CameraView {
  const distance = layout.viewDistance.journal;
  const x = layout.desk.x - 1.3;
  return {
    position: { x, y: topY + distance - 1, z: layout.desk.z + SPREAD_VIEW_Z_NUDGE },
    target: { x, y: topY, z: layout.desk.z },
  };
}

/** ボードへ正対する。 */
export function boardView(layout: StudyLayout): CameraView {
  const board = layout.board.position;
  return {
    position: { x: board.x, y: board.y, z: board.z + layout.viewDistance.board },
    target: { x: board.x, y: board.y, z: board.z },
  };
}

/**
 * ボードへさらに寄る（SP の第 2 段）。
 *
 * クオータートップから正対しただけでは、視線の手前に瓶が残って主役を食う。正対後に
 * ここまで寄せ、並走で瓶を消す。PC は俯瞰から正対するだけで瓶が視界に入らないので使わない。
 */
export function boardCloseView(layout: StudyLayout): CameraView {
  const board = layout.board.position;
  return {
    position: {
      x: board.x,
      y: board.y,
      z: board.z + layout.viewDistance.board * SP_BOARD_CLOSE_RATIO,
    },
    target: { x: board.x, y: board.y, z: board.z },
  };
}

/** 棚へ。背表紙を斜めから見る。 */
export function shelfView(layout: StudyLayout): CameraView {
  const shelf = layout.shelf.position;
  return {
    position: { x: shelf.x - 0.7, y: shelf.y + 2.6, z: shelf.z + 3.6 },
    target: { x: shelf.x, y: shelf.y + 1, z: shelf.z },
  };
}

/**
 * ホームで乗る「呼吸」の y オフセット。
 *
 * **tween 中と遷移待ちの間は呼ばないこと。** tween 完了直後に揺らぎが復帰すると y が
 * 一段跳ぶ（着地でカクッと見える原因がこれだった）。
 */
export function breathOffset(elapsedMs: number): number {
  return Math.sin((elapsedMs / BREATH.periodMs) * Math.PI * 2) * BREATH.amplitude;
}

/**
 * マウス位置に応じたパララックス。`pointer` は -1..1 に正規化した画面座標。
 *
 * オービットもズームも与えない。視点は「軽く動く」だけで、利用者が構図を壊せない。
 */
export function parallaxOffset(
  layout: StudyLayout,
  pointer: { x: number; y: number },
): { x: number; y: number } {
  if (layout.parallax === null) return { x: 0, y: 0 };
  return {
    x: clampSigned(pointer.x) * layout.parallax.x,
    y: clampSigned(pointer.y) * layout.parallax.y,
  };
}

/** 現在値を目標へ寄せる。lerp 係数は配置表が持つ。 */
export function approach(current: number, target: number, factor: number): number {
  return current + (target - current) * factor;
}

/** 2 つの view の間を補間する。 */
export function lerpView(from: CameraView, to: CameraView, t: number): CameraView {
  return {
    position: {
      x: from.position.x + (to.position.x - from.position.x) * t,
      y: from.position.y + (to.position.y - from.position.y) * t,
      z: from.position.z + (to.position.z - from.position.z) * t,
    },
    target: {
      x: from.target.x + (to.target.x - from.target.x) * t,
      y: from.target.y + (to.target.y - from.target.y) * t,
      z: from.target.z + (to.target.z - from.target.z) * t,
    },
  };
}

function clampSigned(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value < -1) return -1;
  if (value > 1) return 1;
  return value;
}
