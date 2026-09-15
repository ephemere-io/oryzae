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

interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/**
 * ホームで利用者が動かせる分（`docs/oryzae-study/00-overview.md`「ホームのカメラ操作」）。
 *
 * カメラは**注視点からホームの向きに `zoom` 倍の距離**に置く。向きは配置表のまま
 * （オービットはしない — 構図は設計の一部）。利用者に渡すのは 2 つだけ:
 *
 * - **寄り引き**（`zoom`）。ホイール／つまみ。**カーソルの下の点へ向かって**寄る
 *   （`zoomTowardPointer`）。以前は注視点を据えたまま近づき、絵の上端が出ないよう注視点を
 *   持ち上げていたが、「寄ると変な軌道で動く」と報告された。地図と同じ「指した所へ寄る」に
 *   すれば、どこを見たいかは利用者が決められる
 * - **パン**（`focus`）。空いている所をつかんで動かす（`panByPixels`）
 *
 * 注視点は `clampFocus` で部屋の中に留める。部屋の外へは出られない。
 */
export interface HomeControl {
  focus: Vec3;
  zoom: number;
}

/** 配置表どおりのホーム。 */
export function homeControl(layout: StudyLayout): HomeControl {
  return { focus: { ...layout.camera.target }, zoom: 1 };
}

/** ホームのカメラが注視点から見てどこにあるか（向きと距離）。 */
function homeOffset(layout: StudyLayout): Vec3 {
  return {
    x: layout.camera.position.x - layout.camera.target.x,
    y: layout.camera.position.y - layout.camera.target.y,
    z: layout.camera.position.z - layout.camera.target.z,
  };
}

/**
 * 操作を view に組む。注視点は `focus`、カメラはそこからホームの向きに `zoom` 倍の距離。
 * 向きが変わらないので、寄り引きは常に注視点へ真っ直ぐ進む。
 */
export function controlledView(layout: StudyLayout, control: HomeControl): CameraView {
  const offset = homeOffset(layout);
  const factor = clampZoom(control.zoom);
  const focus = clampFocus(layout, control.focus);
  return {
    position: {
      x: focus.x + offset.x * factor,
      y: focus.y + offset.y * factor,
      z: focus.z + offset.z * factor,
    },
    target: focus,
  };
}

/**
 * 画面の基底。カメラから見た右・上の単位ベクトルと、注視点の奥行きでの半画面の大きさ。
 *
 * `up` は `lookAt` が組むのと同じ（world の上から前方向の成分を抜いたもの）なので、
 * ここで求めた右・上に沿って注視点を動かせば、画面上では真横・真上に動く。
 */
export function screenFrame(
  layout: StudyLayout,
  control: HomeControl,
  aspect: number,
): { right: Vec3; up: Vec3; halfWidth: number; halfHeight: number } {
  const view = controlledView(layout, control);
  const forward = normalize({
    x: view.target.x - view.position.x,
    y: view.target.y - view.position.y,
    z: view.target.z - view.position.z,
  });
  const up = orthonormalUp(forward) ?? { x: 0, y: 1, z: 0 };
  const right = cross(forward, up);
  const distance = Math.hypot(
    view.position.x - view.target.x,
    view.position.y - view.target.y,
    view.position.z - view.target.z,
  );
  const halfHeight = distance * Math.tan(((layout.camera.fov / 2) * Math.PI) / 180);
  const safeAspect = Number.isFinite(aspect) && aspect > 0 ? aspect : 1;
  return { right, up, halfWidth: halfHeight * safeAspect, halfHeight };
}

/**
 * ポインタ（-1..1 の画面座標）の下にある、**注視点と同じ奥行き**の点。
 * 寄り引きの支点にする。中央なら注視点そのもの。
 */
export function pointUnderPointer(
  layout: StudyLayout,
  control: HomeControl,
  pointer: { x: number; y: number },
  aspect: number,
): Vec3 {
  const frame = screenFrame(layout, control, aspect);
  const focus = clampFocus(layout, control.focus);
  const px = clampSigned(pointer.x) * frame.halfWidth;
  const py = clampSigned(pointer.y) * frame.halfHeight;
  return {
    x: focus.x + frame.right.x * px + frame.up.x * py,
    y: focus.y + frame.right.y * px + frame.up.y * py,
    z: focus.z + frame.right.z * px + frame.up.z * py,
  };
}

/**
 * カーソルの下の点へ向かって寄り引きする。
 *
 * カーソルの下の点 Q が**画面上で動かない**ように注視点を Q へ寄せる（倍率の比で）。
 * 寄るとき（比 < 1）は Q に近づき、引くとき（比 > 1）は Q から遠ざかる。
 * 中央で回せばただの寄り引き。
 */
export function zoomTowardPointer(
  layout: StudyLayout,
  control: HomeControl,
  nextZoom: number,
  pointer: { x: number; y: number },
  aspect: number,
): HomeControl {
  const before = clampZoom(control.zoom);
  const after = clampZoom(nextZoom);
  if (before === after) return { focus: clampFocus(layout, control.focus), zoom: after };

  const anchor = pointUnderPointer(layout, control, pointer, aspect);
  const focus = clampFocus(layout, control.focus);
  const ratio = after / before;
  return {
    focus: clampFocus(layout, {
      x: anchor.x + (focus.x - anchor.x) * ratio,
      y: anchor.y + (focus.y - anchor.y) * ratio,
      z: anchor.z + (focus.z - anchor.z) * ratio,
    }),
    zoom: after,
  };
}

/**
 * ドラッグ（画面の px）で注視点を平行移動する。
 *
 * 右へ引けば絵が右へ付いてくる（カメラは左へ動く）。量は注視点の奥行きでの
 * 1px あたりの world 長さから決めるので、寄っているほど細かく動く。
 */
export function panByPixels(
  layout: StudyLayout,
  control: HomeControl,
  delta: { x: number; y: number },
  viewport: { width: number; height: number },
): HomeControl {
  if (!Number.isFinite(delta.x) || !Number.isFinite(delta.y)) return control;
  if (!(viewport.height > 0) || !(viewport.width > 0)) return control;

  const frame = screenFrame(layout, control, viewport.width / viewport.height);
  const worldPerPx = (2 * frame.halfHeight) / viewport.height;
  const dx = delta.x * worldPerPx;
  const dy = delta.y * worldPerPx;
  const focus = clampFocus(layout, control.focus);
  return {
    focus: clampFocus(layout, {
      x: focus.x - frame.right.x * dx + frame.up.x * dy,
      y: focus.y - frame.right.y * dx + frame.up.y * dy,
      z: focus.z - frame.right.z * dx + frame.up.z * dy,
    }),
    zoom: clampZoom(control.zoom),
  };
}

/** 注視点を部屋の中に留める。壊れた値はホームの注視点に倒す。 */
export function clampFocus(layout: StudyLayout, focus: Vec3): Vec3 {
  const bounds = layout.focusBounds;
  const home = layout.camera.target;
  return {
    x: clampOr(focus.x, bounds.x[0], bounds.x[1], home.x),
    y: clampOr(focus.y, bounds.y[0], bounds.y[1], home.y),
    z: clampOr(focus.z, bounds.z[0], bounds.z[1], home.z),
  };
}

function clampOr(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

function normalize(v: Vec3): Vec3 {
  const length = Math.hypot(v.x, v.y, v.z);
  if (length <= 1e-9) return { x: 0, y: 0, z: -1 };
  return { x: v.x / length, y: v.y / length, z: v.z / length };
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return { x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x };
}

/**
 * world の上（0,1,0）から `forward` 成分を抜いた単位ベクトル。
 *
 * `lookAt` が組む上方向と同じもの。真上・真下を向いていて作れないときは null。
 */
function orthonormalUp(forward: Vec3): Vec3 | null {
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
 * オービットは与えない。利用者に渡すのは寄り引きとパン（`HomeControl`）で、
 * 構図（物の位置関係と見る向き）は壊せない。
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
