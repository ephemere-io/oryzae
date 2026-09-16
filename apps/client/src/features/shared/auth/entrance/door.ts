/**
 * 扉の寸法・開き方・中へ歩いて入る段取り。
 *
 * 時刻を引数で受ける純関数だけを置く。rAF も three.js も知らないので、偽の時計で
 * 段取りそのものをテストできる（書斎の `scene/transitions.ts` と同じ分け方）。
 */

import { clamp01, EASING, progress } from '@/features/shared/study/constants';
import { type CameraView, lerpView } from '@/features/shared/study/scene/camera';
import type { EntranceLayout } from './layout';

/** 扉板。蝶番は左端（x = -width / 2）。 */
export const DOOR = {
  width: 2.2,
  height: 4.6,
  thickness: 0.12,
} as const;

/** 枠（額縁）。壁から少し手前へ出す。 */
export const FRAME = {
  /** 枠材の見付け幅。 */
  width: 0.2,
  /** 枠材の奥行き。壁の厚みを兼ねる。 */
  depth: 0.34,
} as const;

/**
 * 扉の開き（rad）。正の回転で**奥（書斎の側）へ**押し開く。
 *
 * 閉じ切りにはしない。ほんの少し開いていて、隙間から奥の地が覗いている — 「入って
 * よい部屋」だと、扉そのものに言わせるため。
 */
export const DOOR_ANGLE = {
  /** 待っている間。隙間が線 1 本ぶんではなく、奥が覗く幅に見えるところ。 */
  rest: 0.24,
  /** 送信中・認証中。取っ手に手を掛けて押しかけたくらい。 */
  waiting: 0.52,
  /** 入るとき。壁に当たる手前まで。 */
  open: 1.72,
} as const;

/** 待っている間の開きへ寄せる速さ（1 フレームあたり）。 */
export const DOOR_SETTLE_LERP = 0.07;

/** 中へ入る段取りの長さ（ms）。 */
export const ENTER_TIMING = {
  /** 扉が開き切るまで。 */
  doorMs: 700,
  /** 扉が開き始めてから歩き出すまで。開くのを待ち切らずに重ねる。 */
  walkDelayMs: 140,
  /** 敷居をまたいで奥へ抜けるまで。 */
  walkMs: 980,
  /**
   * 歩き終わりに、書斎へ受け渡すためだけの短い溶暗（ms）。
   *
   * **白く飛ばさない。** 以前は歩きの後半（約 0.4 秒）をかけて地の色へ溶かしていて、
   * 「せっかく空間性を表現しているのに、ここでホワイトアウトしてブツ切れになる」と
   * 報告された（PR #624 のレビュー）。いまは歩いたまま書斎へ渡し、向こうでカメラが
   * 入り口から寄って止まる（`study/constants.ts` の `ARRIVAL`）。ここに残すのは、
   * 画面が入れ替わる 1 瞬を隠すぶんだけ。
   */
  handoverMs: 180,
  /**
   * 歩き終わりの何 ms 前に、書斎へ渡す 1 枚を撮るか。
   *
   * 撮った絵は書斎が読み込まれるまでの地になる（`study/backdrop.ts`）。**早めに撮る** —
   * PNG の符号化と保存に少しかかるので、間に合わないと書斎が地の色から始まってしまう。
   */
  captureLeadMs: 420,
} as const;

export interface EnterPlan {
  doorMs: number;
  walkDelayMs: number;
  walkMs: number;
  /** 書斎へ受け渡すための短い溶暗を始める時刻。 */
  fadeStartMs: number;
  fadeMs: number;
  /** ここで行き先へ移ってよい。 */
  totalMs: number;
}

/**
 * `prefers-reduced-motion` のときは扉もカメラも動かさず、溶かすだけにする。
 *
 * 段を消すのではなく長さを 0 にする（`progress()` は duration 0 で必ず 1 を返す）。
 * 溶かす長さだけは残す — 0 にすると画面が切り替わるだけになり、何が起きたか分からない。
 */
const REDUCED_FADE_MS = 320;

export function enterPlan(reducedMotion: boolean): EnterPlan {
  if (reducedMotion) {
    return {
      doorMs: 0,
      walkDelayMs: 0,
      walkMs: 0,
      fadeStartMs: 0,
      fadeMs: REDUCED_FADE_MS,
      totalMs: REDUCED_FADE_MS,
    };
  }
  const walkEnd = ENTER_TIMING.walkDelayMs + ENTER_TIMING.walkMs;
  const totalMs = Math.max(ENTER_TIMING.doorMs, walkEnd);
  const fadeStartMs = Math.max(0, totalMs - ENTER_TIMING.handoverMs);
  return {
    doorMs: ENTER_TIMING.doorMs,
    walkDelayMs: ENTER_TIMING.walkDelayMs,
    walkMs: ENTER_TIMING.walkMs,
    fadeStartMs,
    fadeMs: totalMs - fadeStartMs,
    totalMs,
  };
}

/** 入っている最中の扉の開き。`from` は押し始めた時点の開き。 */
export function doorAngleWhileEntering(plan: EnterPlan, from: number, elapsedMs: number): number {
  const p = EASING.easeInOutCubic(progress(elapsedMs, plan.doorMs));
  return from + (DOOR_ANGLE.open - from) * p;
}

/**
 * 歩いて入る道のりの進み（0..1、イージング済み）。
 *
 * 出だしはゆっくり、敷居の手前で速くなって奥へ抜ける。**着地で減速させない** —
 * 奥はもう溶けているので、止まる場所を見せる必要が無い。
 */
export function walkProgress(plan: EnterPlan, elapsedMs: number): number {
  const p = progress(elapsedMs - plan.walkDelayMs, plan.walkMs);
  return EASING.easeInOutCubic(p) * 0.35 + p ** 2 * 0.65;
}

/**
 * 奥へ抜けた先の view。扉の中心線（x = 0）の上を、目の高さのまま奥へ。
 *
 * 目の高さは扉の中ほどより少し下。高いままだと枠の上辺に頭をぶつける軌道になる。
 */
export const THROUGH_VIEW: CameraView = {
  position: { x: 0, y: DOOR.height * 0.44, z: -2.2 },
  target: { x: 0, y: DOOR.height * 0.42, z: -12 },
};

/** 待っているときの view（配置表どおり）。 */
export function homeEntranceView(layout: EntranceLayout): CameraView {
  return {
    position: { ...layout.camera.position },
    target: { ...layout.camera.target },
  };
}

/** 歩いて入る途中の view。`from` は歩き出した時点の view（揺れを含む）。 */
export function walkView(from: CameraView, t: number): CameraView {
  return lerpView(from, THROUGH_VIEW, clamp01(t));
}

/**
 * カメラが扉の開口の内側を通るか。
 *
 * 壁の面（z = 0）をまたぐ瞬間に、開口（枠の内側）の中にいなければ壁を突き抜けている。
 * 構図を変えたときに軌道が壁に当たっていないかを、テストで確かめるために置いている。
 */
export function crossesThroughDoorway(from: CameraView, samples = 200): boolean {
  let previous = walkView(from, 0).position;
  for (let i = 1; i <= samples; i++) {
    const current = walkView(from, i / samples).position;
    if (previous.z >= 0 && current.z < 0) {
      const ratio = previous.z / (previous.z - current.z);
      const x = previous.x + (current.x - previous.x) * ratio;
      const y = previous.y + (current.y - previous.y) * ratio;
      const insideX = Math.abs(x) < DOOR.width / 2 - 0.05;
      const insideY = y > 0.05 && y < DOOR.height - 0.05;
      return insideX && insideY;
    }
    previous = current;
  }
  // 壁をまたがない軌道は「通っていない」。
  return false;
}
