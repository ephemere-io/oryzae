/**
 * 遷移先のカメラ（`docs/oryzae-study/21-3d-parameters.md`「遷移先のカメラ」）。
 *
 * 行き先はすべて配置表から導く。PC / SP で式は同じで、距離だけ差し替える。
 * 純関数のみ。
 */

import {
  BREATH,
  HOME_ZOOM,
  SP_BOARD_CLOSE_RATIO,
  SPREAD_VIEW_Z_NUDGE,
  TOP_VIEW_Z_NUDGE,
} from '../constants';
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
  return Math.sin((elapsedMs / 1000) * BREATH.radiansPerSecond) * BREATH.amplitude;
}

/** 寄り引きの倍率を上下限に丸める。壊れた値は等倍に倒す。 */
export function clampZoom(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.min(HOME_ZOOM.max, Math.max(HOME_ZOOM.min, value));
}

/**
 * 注視点からの距離を `zoom` 倍にし、注視点を `targetRise` だけ持ち上げた view。
 *
 * **注視点を自由には動かさない。** 動かせるようにすると寄り引きが平行移動を兼ね、
 * 部屋の外へ出られてしまう。動かしてよいのは**縦だけ**で、量は倍率から決まる
 * （`zoomTargetRise`）— 利用者が手で決める余地は無く、構図は保たれたままになる。
 *
 * 持ち上げるのは、注視点を据えたまま近づくと**絵の上端（ボードの上辺）が
 * まっさきに画面から出る**ため。カメラも同じだけ上がるので、視線の向きは変わらない。
 */
export function zoomedView(view: CameraView, zoom: number, targetRise = 0): CameraView {
  const factor = clampZoom(zoom);
  const rise = Number.isFinite(targetRise) ? targetRise : 0;
  const { position, target } = view;
  return {
    position: {
      x: target.x + (position.x - target.x) * factor,
      y: target.y + rise + (position.y - target.y) * factor,
      z: target.z + (position.z - target.z) * factor,
    },
    target: { x: target.x, y: target.y + rise, z: target.z },
  };
}

/**
 * 寄ったときに注視点を持ち上げる量。
 *
 * **`layout.camera.frameTop` の画面上の高さが変わらない量**を解く。等倍のときこの点は
 * 画面の上のほうぎりぎりに写っているので、注視点を据えたまま近づくと真っ先に外へ出る
 * （「ズームインしていくとボードの上が見切れる」— PR #570 の実機レビュー）。
 *
 * カメラ位置は `P(f) = T + rise + D·f`（`D` はホームの注視点からの差、`f` は倍率）。
 * カメラの上方向 `up` は `D` と直交するので、`frameTop` までのベクトル `V` の
 * 上成分と前成分の比は
 *
 *     r(f) = (up·W − rise·up_y) / (fwd·W − rise·fwd_y + f·|D|)      （W = frameTop − T）
 *
 * になる。これを等倍のときの比 `r(1)` と等しく置いて `rise` について解く。
 * 結果は `f` の一次式なので、寄り引きに滑らかに追従する。
 *
 * **引く側（f > 1）では持ち上げない。** 引けば上端はさらに内側へ入るので、
 * ここで下げると今度は絵が上に寄って下端に余白が残る。
 */
export function zoomTargetRise(layout: StudyLayout, zoom: number): number {
  const factor = clampZoom(zoom);
  if (factor >= 1) return 0;

  const target = layout.camera.target;
  const offset = {
    x: layout.camera.position.x - target.x,
    y: layout.camera.position.y - target.y,
    z: layout.camera.position.z - target.z,
  };
  const distance = Math.hypot(offset.x, offset.y, offset.z);
  if (distance <= 1e-6) return 0;

  // 前方向は注視点へ向かう単位ベクトル。上方向はそれと直交し、world の上に近いほう。
  const forward = { x: -offset.x / distance, y: -offset.y / distance, z: -offset.z / distance };
  const up = orthonormalUp(forward);
  if (up === null) return 0;

  const w = {
    x: layout.camera.frameTop.x - target.x,
    y: layout.camera.frameTop.y - target.y,
    z: layout.camera.frameTop.z - target.z,
  };
  const upW = up.x * w.x + up.y * w.y + up.z * w.z;
  const forwardW = forward.x * w.x + forward.y * w.y + forward.z * w.z;

  const restRatio = forwardW + distance;
  if (Math.abs(restRatio) <= 1e-6) return 0;
  const ratio = upW / restRatio;

  const denominator = ratio * forward.y - up.y;
  if (Math.abs(denominator) <= 1e-6) return 0;

  const rise = (ratio * (forwardW + factor * distance) - upW) / denominator;
  // 数値誤差で下がる向きに出ることがある。持ち上げる以外はしない。
  return rise > 0 ? rise : 0;
}

/**
 * world の上（0,1,0）から `forward` 成分を抜いた単位ベクトル。
 *
 * `lookAt` が組む上方向と同じもの。真上・真下を向いていて作れないときは null。
 */
function orthonormalUp(forward: {
  x: number;
  y: number;
  z: number;
}): { x: number; y: number; z: number } | null {
  const dot = forward.y;
  const up = { x: -forward.x * dot, y: 1 - forward.y * dot, z: -forward.z * dot };
  const length = Math.hypot(up.x, up.y, up.z);
  if (length <= 1e-6) return null;
  return { x: up.x / length, y: up.y / length, z: up.z / length };
}

/**
 * ホイールの delta を寄り引きに畳む。
 *
 * 下へ回す（`deltaY > 0`）と離れる。ブラウザのページ送りと同じ向きにしておく。
 */
export function zoomByWheel(current: number, deltaY: number): number {
  if (!Number.isFinite(deltaY)) return clampZoom(current);
  return clampZoom(current + deltaY * HOME_ZOOM.wheelStep);
}

/**
 * 2 本指の間隔の比を寄り引きに畳む。`base` は指を置いた時点の倍率。
 *
 * 指を広げる（`ratio > 1`）と近づく。距離は比の**逆数**で効く。
 */
export function zoomByPinch(base: number, ratio: number): number {
  if (!Number.isFinite(ratio) || ratio <= 0) return clampZoom(base);
  return clampZoom(base / ratio);
}

/**
 * マウス位置に応じたパララックス。`pointer` は -1..1 に正規化した画面座標。
 *
 * オービットは与えない。寄り引き（`zoomedView`）だけは利用者に渡すが、構図
 * （物の位置関係）は壊せない。
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
