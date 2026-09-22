'use client';

/**
 * 画面が入れ替わるあいだ、**歩いている部屋そのもの**をルーターの上に載せておくための合図。
 *
 * 扉から書斎へ渡すとき、間に挟まるものが多い — 認証レイアウトが外れ、保護レイアウトが
 * mount し、そのレイアウトは mount 前にロード表示を出し、書斎の canvas は読み込みと
 * 最初の 1 フレームを待つ。**そのどれか 1 つでも地の色を描けば、そこが白く飛ぶ。**
 *
 * 最初は撮った 1 枚（静止画）を敷いていた。白は消えたが、歩きが止まって静止画に変わる
 * 瞬間と、静止画が別の動きで寄り始める瞬間で速度が途切れ、「扉を開き終わった後に
 * カクッとする」と報告された（PR #624 の実機レビュー）。継ぎ目のあるものは、どう合わせても
 * 継ぎ目が残る。
 *
 * いまは **canvas を持ち出す**。扉のシーンは歩き続けたまま（`glideView`）、その canvas を
 * ルーターの外（root layout の `StudyHandover`）に載せ替える。下でどの画面が
 * mount / unmount しても、見えている動きは同じ 1 本のまま。書斎の canvas が最初の
 * 1 フレームを描いたら、上の canvas を溶かして捨てる。
 *
 * - 扉の側が、行き先へ移る直前に載せる（`beginStudyHandoverFor`）
 * - 書斎の canvas が最初の 1 フレームを描いたら引く（`endStudyHandover`）
 * - 合図が来なくても、載せっぱなしにはならない（`StudyHandover` の保険）
 */

/** 持ち出された canvas と、その後始末。形は扉の側の `EntranceBridge` と同じ。 */
export interface StudyBridge {
  canvas: HTMLCanvasElement;
  dispose(): void;
}

/** 書斎のパス。ここへ向かうときだけ載せる。 */
const STUDY_PATH = '/';

let laid: StudyBridge | null = null;
const listeners = new Set<() => void>();

/**
 * 行き先が書斎なら、歩いている canvas をルーターの上に載せる。
 *
 * 呼ぶのは**行き先へ移る前**。ここで載せておけば、このあと何が mount / unmount しても、
 * 見えているのは同じ部屋のままになる。書斎以外へ向かうなら、持ち出したものはここで捨てる。
 */
export function beginStudyHandoverFor(destination: string, bridge: StudyBridge | null): void {
  if (bridge === null) return;
  if (destination !== STUDY_PATH) {
    bridge.dispose();
    return;
  }
  if (laid !== null && laid !== bridge) laid.dispose();
  laid = bridge;
  notify();
}

/**
 * 書斎が描けた。引いてよい。
 *
 * ここでは捨てない — 溶けているあいだも描いていてほしい。捨てるのは `StudyHandover` が
 * 溶かし終えてから。
 */
export function endStudyHandover(): void {
  laid = null;
  notify();
}

/** いま載せている canvas。無ければ null。 */
export function studyHandoverBridge(): StudyBridge | null {
  return laid;
}

/** 載せた・引いたの変化を受け取る。 */
export function subscribeStudyHandover(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notify(): void {
  for (const listener of listeners) listener();
}
