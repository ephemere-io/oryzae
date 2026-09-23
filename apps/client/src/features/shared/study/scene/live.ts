'use client';

/**
 * ページをまたいで**同じシーンを生かしておく**ための受け渡し。
 *
 * 認証画面（`/login` `/callback`）と書斎（`/`）は別のページだが、見えているのは**1 つの部屋**。
 * 扉の前から中へカメラが動いている最中にページが入れ替わるので、シーンごと引き継ぐ
 * （`docs/oryzae-study/70-entrance.md`）。
 *
 * - 認証画面が、入り始める直前に `keepLiveScene()` で預ける
 * - 書斎の canvas が mount したら `takeLiveScene()` で引き取り、自分の入れ物へ canvas を移す
 * - 引き取り手が現れなければ（別の画面へ行った・読み込みに失敗した）置き去りとして捨てる
 *
 * **誰が捨てるかは名乗りで決める**（`claimScene` / `releaseScene`）。持ち主を「いま預かって
 * いるか」から推すと外れる — React はページを入れ替えるとき**次の画面を組んでから前の画面を
 * 畳む**ので、引き取られた後に前の入れ物の後始末が走る（実測で adopt の 5ms 後に dispose）。
 *
 * React の外に置くのは、**ページの寿命より長く生きる必要がある**ため。ここで持つのは
 * 受け渡しの一瞬だけで、引き取られたら手放す。
 */

import type { StudySceneHandle } from './scene';

export interface LiveScene {
  canvas: HTMLCanvasElement;
  handle: StudySceneHandle;
}

/** 引き取り手が現れないまま置き去りになったときに捨てるまで（ms）。 */
const ABANDON_MS = 8000;

let live: LiveScene | null = null;
let abandonTimer: number | null = null;
/** 引き取られるまで canvas を置いておく、React の外の入れ物。 */
let parking: HTMLElement | null = null;
/** その handle をいま描いている入れ物。作った側と引き取った側が名乗る。 */
const owners = new WeakMap<StudySceneHandle, object>();

/** この入れ物がこのシーンを描くと名乗る。作ったときと、引き取ったときに呼ぶ。 */
export function claimScene(handle: StudySceneHandle, by: object): void {
  owners.set(handle, by);
}

/**
 * 描くのをやめる。**捨ててよいかどうかを返す。**
 *
 * 捨ててよいのは、名乗ったままの入れ物だけ。すでに次の入れ物が名乗っていれば false —
 * そこで捨てると、いま描いているシーンが死ぬ。
 */
export function releaseScene(handle: StudySceneHandle, by: object): boolean {
  if (owners.get(handle) !== by) return false;
  owners.delete(handle);
  return true;
}

/**
 * 入り始める直前に預ける。canvas は**画面いっぱいの仮の置き場**へ移す。
 *
 * ページが入れ替わるあいだ、canvas が DOM から外れると描画が止まる（そこが「切り替わり」に
 * なる）。React のツリーの外（`document.body` 直下）に置けば、どの画面が mount / unmount しても
 * 影響を受けない。触れない（`pointer-events: none`）。
 */
export function keepLiveScene(scene: LiveScene): void {
  dropLiveScene();
  live = scene;
  // 預かっているあいだの持ち主はこの受け渡し役。前の画面の後始末はもう捨てられない。
  claimScene(scene.handle, LIVE_OWNER);
  if (typeof document !== 'undefined') {
    const host = document.createElement('div');
    host.dataset.studyLive = '';
    host.style.cssText = 'position:fixed;inset:0;z-index:50;pointer-events:none';
    host.appendChild(scene.canvas);
    document.body.appendChild(host);
    parking = host;
  }
  if (typeof window !== 'undefined') {
    abandonTimer = window.setTimeout(() => {
      // 誰も引き取らなかった。WebGL のコンテキストを抱えたままにしない。
      dropLiveScene();
    }, ABANDON_MS);
  }
}

/** 引き取る。**一度きり** — 受け取った側が以後の後始末を持つ。 */
export function takeLiveScene(): LiveScene | null {
  const taken = live;
  live = null;
  clearAbandonTimer();
  clearParking();
  return taken;
}

/** 預かっているあいだの持ち主（`claimScene` の名乗り主）。 */
const LIVE_OWNER = {};

/**
 * いま預かっているシーンがあるか。**引き取る前に、描く側が同期で知るために使う。**
 *
 * 書斎は「入りの溶暗」を持っているが、扉から続いて入ってきたなら部屋はもう見えている。
 * 溶暗を掛けると、そこで一度薄くなって戻る — それが「一回切り替わる」正体だった。
 * 最初のレンダーで判るよう、effect ではなくこの同期の問い合わせで決める。
 */
export function hasLiveScene(): boolean {
  return live !== null;
}

/** 預かっているものを捨てる。引き取られた後は何もしない。 */
function dropLiveScene(): void {
  clearAbandonTimer();
  clearParking();
  if (live === null) return;
  const abandoned = live;
  live = null;
  if (releaseScene(abandoned.handle, LIVE_OWNER)) abandoned.handle.dispose();
}

/** 仮の置き場を外す（中の canvas は、引き取った側が自分の入れ物へ移す）。 */
function clearParking(): void {
  parking?.remove();
  parking = null;
}

function clearAbandonTimer(): void {
  if (abandonTimer === null || typeof window === 'undefined') return;
  window.clearTimeout(abandonTimer);
  abandonTimer = null;
}
