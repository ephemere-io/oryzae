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
  /**
   * 入るとき。壁に当たる手前まで。
   *
   * **奥の書斎が扉板に隠れない角度まで開く。** 98° では、開いた扉板が開口の左側に
   * 立ちはだかり、その向こうにある瓶を半分隠していた（PR #624 のレビューのスクリーン
   * ショット）。112° まで開くと扉板は左奥へ倒れ、開口がそのまま見える。
   */
  open: 1.96,
} as const;

/** 待っている間の開きへ寄せる速さ（1 フレームあたり）。 */
export const DOOR_SETTLE_LERP = 0.07;

/** 中へ入る段取りの長さ（ms）。 */
export const ENTER_TIMING = {
  /** 扉が開き切るまで。 */
  doorMs: 700,
  /** 扉が開き始めてから歩き出すまで。開くのを待ち切らずに重ねる。 */
  walkDelayMs: 140,
  /**
   * 歩き出してから、**行き先へ移ってよくなる**まで。
   *
   * 歩きはここで終わらない（`glideView` の注釈）。ここは「もう扉の正面まで来ているので、
   * 下で画面を入れ替えてよい」という時刻。入れ替えは canvas ごと上に持ち上げて行うので
   * （`study/handover.ts`）、見えている動きはそのまま続く。
   */
  walkMs: 980,
  /**
   * 歩き終わりの溶暗（ms）。**扉があるときは 0。**
   *
   * 以前は歩きの後半（約 0.4 秒）をかけて地の色へ溶かしていて、「ホワイトアウトして
   * ブツ切れになる」と報告された（PR #624 のレビュー）。短くしても、溶けるぶんは白い。
   * いまは歩いている canvas をそのまま画面の上に持ち上げてから移るので、隠すための
   * 溶暗そのものが要らない。扉が無いとき（WebGL 非対応）だけ、`enterPlan` が
   * `REDUCED_FADE_MS` で溶かす。
   */
  handoverMs: 0,
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
 * 歩いて入る動き。**止まらない — 近づくほど遅くなるだけ。**
 *
 * 以前は「敷居の手前まで 0.98 秒で歩いて止まり、撮った 1 枚を敷いて、その絵を別の動きで
 * 寄せる」だった。止まった瞬間と、別の動きが始まる瞬間で速度が途切れ、「扉を開き終わった
 * 後にカクッとする」と報告された（PR #624 の実機レビュー）。継ぎ目のあるものは、どう
 * 合わせても継ぎ目が残る。
 *
 * いまは 1 本の動きにする。目指す先（`GLIDE.target`、扉の開口の中）へ、**残りの距離に
 * 比例した速さで近づき続ける**（指数的な接近）。速度は常に連続で、着く前に書斎が
 * 現れる。読み込みが遅ければゆっくり近づき続けるだけで、止まる瞬間は無い。
 * 歩き出しだけは助走を付ける（静止から急に動き出さない）。
 */
export const GLIDE = {
  /** 歩き出しの助走（ms）。この間に速さを 0 から立ち上げる。 */
  rampMs: 360,
  /**
   * 近づく速さ（1 秒あたりに詰める残りの距離の指数）。
   *
   * 1.7 では行き先へ移る時点で 7 割を詰めていて、そのあと書斎が描かれるまでの 0.4〜0.7 秒に
   * 残る動きがほとんど無かった（本番ビルドの録画で 6 コマ ≒ 240ms がほぼ静止）。
   * 書斎が出るまで**見えて分かる速さで**近づき続けるように、減衰を緩める。
   */
  rate: 1.05,
  /**
   * 目指す先。扉の開口の中、敷居のすぐ手前。
   *
   * ここへは着かない（近づくだけ）。以前は敷居をまたいで奥まで歩かせていて、枠や扉板が
   * カメラのすぐ脇を通り、縦線だけの絵になった（「柱みたいなものが見える」）。開口の中を
   * 目指せば、近づくほど枠は画面の外へ滑り出ていき、残るのは奥の書斎になる。
   */
  target: {
    position: { x: 0, y: DOOR.height * 0.44, z: 1.4 },
    target: { x: 0, y: DOOR.height * 0.4, z: -8 },
  } satisfies CameraView,
} as const;

/** 待っているときの view（配置表どおり）。 */
export function homeEntranceView(layout: EntranceLayout): CameraView {
  return {
    position: { ...layout.camera.position },
    target: { ...layout.camera.target },
  };
}

/**
 * いまの view を、`dtMs` ぶん目指す先へ近づける。
 *
 * `elapsedMs` は歩き出してからの経過（助走に使う）。フレームの長さに依らない —
 * 同じ経過時間なら、コマ落ちしても同じところにいる。
 */
export function glideView(current: CameraView, elapsedMs: number, dtMs: number): CameraView {
  const ramp = EASING.easeInOutCubic(progress(elapsedMs, GLIDE.rampMs));
  const k = 1 - Math.exp(-GLIDE.rate * ramp * (Math.max(0, dtMs) / 1000));
  return lerpView(current, GLIDE.target, clamp01(k));
}

/**
 * その view が、壁ではなく扉の開口を覗いているか。
 *
 * 確かめるのは**位置**ではなく**視線**。壁の面（z = 0）をどこで通るかを出して、開口の
 * 内側かを見る。構図を変えたときに、壁を見つめて終わっていないかをテストで押さえるために
 * 置いている。
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
