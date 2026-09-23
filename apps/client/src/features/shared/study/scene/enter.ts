/**
 * 書斎の入口から中へ入る段取り（純関数）。
 *
 * **シーンは 1 つ、カメラは 1 本**。扉の前に立った view（`entranceView`）から、扉を押し開けて
 * ホーム（`homeView`）まで、同じカメラが動いていく。以前は扉だけの別シーンがあり、入るときに
 * 2 つのシーンをクロスフェードしていた — それが「一回切り替わる」正体だった
 * （`docs/oryzae-study/70-entrance.md`）。
 *
 * 時刻を引数で受ける純関数だけを置く。rAF も three.js も知らないので、偽の時計でテストできる。
 */

import { EASING, progress } from '../constants';
import type { StudyLayout } from '../layout';
import { type CameraView, entranceView, homeView } from './camera';
import { DOOR } from './entrance-room';

/** 空間の一点。カメラの位置と注視点に使うものと同じ形。 */
type Point = CameraView['position'];

/**
 * 扉の開き（rad）。正の回転で**奥（書斎の側）へ**押し開く。
 *
 * 閉じ切りにはしない。ほんの少し開いていて、隙間から奥が覗いている — 「入ってよい部屋」だと、
 * 扉そのものに言わせるため。
 */
export const DOOR_ANGLE = {
  /** 待っている間。隙間が線 1 本ぶんではなく、奥が覗く幅に見えるところ。 */
  rest: 0.24,
  /** 送信中・認証中。取っ手に手を掛けて押しかけたくらい。 */
  waiting: 0.52,
  /**
   * 入るとき。**奥が扉板に隠れない角度まで開く。**
   *
   * 98° では、開いた扉板が開口の左に立ちはだかり、その向こうを半分隠していた（実機レビュー）。
   * 112° まで開くと扉板は左奥へ倒れ、開口がそのまま見える。
   */
  open: 1.96,
} as const;

/** 待っている間の開きへ寄せる速さ（1 フレームあたり）。 */
export const DOOR_SETTLE_LERP = 0.07;

/** 入る段取りの長さ（ms）。 */
export const ENTER_TIMING = {
  /** 扉が開き切るまで。 */
  doorMs: 700,
  /** 扉が開き始めてから歩き出すまで。開くのを待ち切らずに重ねる。 */
  walkDelayMs: 140,
  /** 歩き出してからホームに着くまで。 */
  walkMs: 1400,
} as const;

/**
 * 見えている窓の高さが変わったとき（SP で紙が伸び縮みしたとき）に構図を寄せる速さ
 * （1 フレームあたり）。切り替えずに寄せるのは、扉が一瞬で縮むと別の場面に飛んだように
 * 見えるため。
 */
export const FRAME_SETTLE_LERP = 0.14;

/** 入っている最中の扉の開き。`from` は押し始めた時点の開き。 */
export function doorAngleWhileEntering(from: number, elapsedMs: number): number {
  const p = EASING.easeInOutCubic(progress(elapsedMs, ENTER_TIMING.doorMs));
  return from + (DOOR_ANGLE.open - from) * p;
}

/**
 * 開口を通るときの目の高さ（前室の床から）。扉の上寄り。
 *
 * 低く取ると、開口を抜けた直後に枠の上辺が画面を横切る。高く取ると鴨居にぶつかる。
 */
const DOORWAY_EYE = DOOR.height * 0.57;

/**
 * 開口の手前と奥に置く制御点の距離。
 *
 * ここが「扉に正対して入る」を作る。**壁に対して真っ直ぐ入り、真っ直ぐ抜ける**ので、
 * 枠や扉板がカメラの脇をかすめない。
 */
const DOORWAY_REACH = 2;

/** 開口の中心（世界座標）。前室は回転させずに置くので、部屋の位置がそのまま開口の中心。 */
function doorwayPoint(layout: StudyLayout): Point {
  const room = layout.entrance.room;
  return { x: room.x, y: room.y + DOORWAY_EYE, z: room.z };
}

/**
 * 入っていく道のりの、その時刻の view。
 *
 * **直線では入れない。** 扉の前に立つ位置とホームを直線で結ぶと、その線は壁の——開口ではない
 * ところを貫く（PC なら開口の 2.7 ユニット右、しかも鴨居より上）。壁を突き抜けるあいだ、
 * 壁の線が画面を縦に横切る — 以前「書斎に入る直前に柱みたいなのが見える」と報告された
 * のと同じ見え方になる。
 *
 * そこで**開口を必ず通る**曲線にする。制御点は開口の前後、扉の正面軸の上に置く
 * （`DOORWAY_REACH`）。人が扉をくぐるのと同じで、正対して入り、抜けてから部屋を見渡す形になる。
 * 速さは両端で 0 に収束するので、歩き出しにも着地にも継ぎ目が無い。
 */
export function enterView(layout: StudyLayout, elapsedMs: number): CameraView {
  const from = entranceView(layout);
  const home = homeView(layout);
  const doorway = doorwayPoint(layout);
  const u = EASING.easeInOutCubic(progress(elapsedMs, ENTER_TIMING.walkMs));
  return {
    position: cubicBezier(
      from.position,
      { ...doorway, z: doorway.z + DOORWAY_REACH },
      { ...doorway, z: doorway.z - DOORWAY_REACH },
      home.position,
      u,
    ),
    // 注視点に開口の縛りは要らない（通り抜けるのは体であって視線ではない）。
    target: lerpPoint(from.target, home.target, u),
  };
}

/** 入り終わったか。 */
export function isInside(elapsedMs: number): boolean {
  return elapsedMs >= ENTER_TIMING.walkMs;
}

function lerpPoint(from: Point, to: Point, t: number): Point {
  return {
    x: from.x + (to.x - from.x) * t,
    y: from.y + (to.y - from.y) * t,
    z: from.z + (to.z - from.z) * t,
  };
}

/** 3 次ベジエ。両端で速さが 0 に収束する（＝止まるときも動き出すときも継ぎ目が無い）。 */
function cubicBezier(p0: Point, c1: Point, c2: Point, p3: Point, t: number): Point {
  const s = 1 - t;
  const w0 = s * s * s;
  const w1 = 3 * s * s * t;
  const w2 = 3 * s * t * t;
  const w3 = t * t * t;
  return {
    x: w0 * p0.x + w1 * c1.x + w2 * c2.x + w3 * p3.x,
    y: w0 * p0.y + w1 * c1.y + w2 * c2.y + w3 * p3.y,
    z: w0 * p0.z + w1 * c1.z + w2 * c2.z + w3 * p3.z,
  };
}

/**
 * その位置が、壁ではなく**開口の中**にあるか（世界座標）。
 *
 * 構図を変えたときに、カメラが壁を突き抜けていないかをテストで押さえるために置いている。
 */
export function isInDoorway(layout: StudyLayout, position: Point): boolean {
  const room = layout.entrance.room;
  const x = position.x - room.x;
  const y = position.y - room.y;
  return Math.abs(x) < DOOR.width / 2 && y > 0 && y < DOOR.height;
}
