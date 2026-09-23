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
import { type CameraView, lerpView } from './camera';

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
} as const;

/**
 * 入っていく動き。**止まらない — 近づくほど遅くなるだけ。**
 *
 * 残りの距離に比例した速さでホームへ近づき続ける（指数的な接近）。速度は常に連続で、
 * 着く手前で切っても跳ねない。歩き出しだけは助走を付ける（静止から急に動き出さない）。
 */
const ENTER_GLIDE = {
  /** 歩き出しの助走（ms）。この間に速さを 0 から立ち上げる。 */
  rampMs: 360,
  /** 近づく速さ。1 秒あたり、残りの距離のどれだけを詰めるか（の指数）。 */
  rate: 1.15,
} as const;

/** 入っている最中の扉の開き。`from` は押し始めた時点の開き。 */
export function doorAngleWhileEntering(from: number, elapsedMs: number): number {
  const p = EASING.easeInOutCubic(progress(elapsedMs, ENTER_TIMING.doorMs));
  return from + (DOOR_ANGLE.open - from) * p;
}

/**
 * いまの view を、`dtMs` ぶん行き先へ近づける。
 *
 * `elapsedMs` は歩き出してからの経過（助走に使う）。フレームの長さに依らない — 同じ経過時間なら、
 * コマ落ちしても同じところにいる。
 */
export function glideTowards(
  current: CameraView,
  destination: CameraView,
  elapsedMs: number,
  dtMs: number,
): CameraView {
  const ramp = EASING.easeInOutCubic(progress(elapsedMs, ENTER_GLIDE.rampMs));
  const k = 1 - Math.exp(-ENTER_GLIDE.rate * ramp * (Math.max(0, dtMs) / 1000));
  return lerpView(current, destination, Math.min(1, Math.max(0, k)));
}

/** 行き先まで、目に見えるほどの隔たりが残っているか。 */
export function isFarFrom(view: CameraView, destination: CameraView, epsilon = 0.02): boolean {
  const dx = view.position.x - destination.position.x;
  const dy = view.position.y - destination.position.y;
  const dz = view.position.z - destination.position.z;
  return Math.hypot(dx, dy, dz) > epsilon;
}
