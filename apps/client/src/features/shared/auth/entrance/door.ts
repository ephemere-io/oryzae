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
  /** 扉の正面（敷居の手前）へ寄り着くまで。 */
  walkMs: 980,
  /**
   * 歩き終わりの溶暗（ms）。**扉があるときは 0。**
   *
   * 以前は歩きの後半（約 0.4 秒）をかけて地の色へ溶かしていて、「ホワイトアウトして
   * ブツ切れになる」と報告された（PR #624 のレビュー）。短くしても、溶けるぶんは白い。
   * いまは歩き切った 1 枚を**画面の上に敷いて**から移るので（`study/handover.ts`）、
   * 隠すための溶暗そのものが要らない。扉が無いとき（WebGL 非対応）だけ、`enterPlan` が
   * `REDUCED_FADE_MS` で溶かす。
   */
  handoverMs: 0,
  /**
   * 歩き終わりの何 ms 前に、書斎へ渡す 1 枚を撮るか。
   *
   * 撮った絵は書斎が読み込まれるまでの地になる（`study/backdrop.ts`）。画素はその場で
   * 掴むので、この前倒しは **PNG の符号化と保存が navigation に間に合う**ためのもの。
   * 長く取りすぎると、まだ扉から遠い絵を渡してしまう（`walkProgress` は着きで減速する
   * ので、この長さなら扉の正面まで来ている）。
   */
  captureLeadMs: 300,
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
 * 出だしも着きもゆるやか。**着きで減速する**のが肝で、止まった絵がそのまま書斎へ渡す 1 枚に
 * なる（`captureLeadMs`）。最後まで加速していると、渡す 1 枚と最後のフレームがずれる。
 */
export function walkProgress(plan: EnterPlan, elapsedMs: number): number {
  return EASING.easeInOutCubic(progress(elapsedMs - plan.walkDelayMs, plan.walkMs));
}

/**
 * 歩き着く先。**扉の正面、枠がまだ絵に収まっているところで止まる。**
 *
 * 抜けるところまで歩かせていた頃は、開いた扉板と枠がカメラのすぐ脇まで来て、画面を縦に
 * 横切る線だけが残った — 「書斎に入る直前に柱みたいなのが見える」と報告された（PR #624）。
 * 寄りすぎると扉は扉に見えない。扉が扉として読めるところで止め、続きは書斎の側の寄り
 * （`study/constants.ts` の `ARRIVAL`）に渡す。
 */
export const THRESHOLD_VIEW: CameraView = {
  position: { x: 0, y: DOOR.height * 0.44, z: 5 },
  target: { x: 0, y: DOOR.height * 0.4, z: -8 },
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
  return lerpView(from, THRESHOLD_VIEW, clamp01(t));
}

/**
 * その view が、壁ではなく扉の開口を覗いているか。
 *
 * カメラは敷居の手前で止まるので、確かめるのは**位置**ではなく**視線**。壁の面（z = 0）を
 * どこで通るかを出して、開口の内側かを見る。構図を変えたときに、壁を見つめて終わって
 * いないかをテストで押さえるために置いている。
 */
export function looksThroughDoorway(view: CameraView): boolean {
  const { position, target } = view;
  // 壁の手前にいて、奥を見ている。
  if (position.z <= 0 || target.z >= position.z) return false;
  const ratio = position.z / (position.z - target.z);
  const x = position.x + (target.x - position.x) * ratio;
  const y = position.y + (target.y - position.y) * ratio;
  return Math.abs(x) < DOOR.width / 2 - 0.05 && y > 0.05 && y < DOOR.height - 0.05;
}
