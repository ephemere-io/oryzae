/**
 * 遷移の段取り（`docs/oryzae-study/21-3d-parameters.md`「遷移のタイミングとイージング」）。
 *
 * 時刻を引数で受ける純関数の集まり。rAF も three.js も知らないので、偽の時計で
 * 段取りそのものをテストできる。
 */

import { DELAY, DURATION, EASING, JOURNAL_OVERLAP, PAGE_FOLLOW, progress } from '../constants';
import type { StudyTarget } from '../types';

type EasingFn = (p: number) => number;

/** 遷移の 1 段。`delayMs` だけ待ってから `durationMs` かけて 0 → 1 へ進む。 */
export interface TransitionStep {
  /** 何を動かす段か（デバッグとテストの識別用）。 */
  name: string;
  delayMs: number;
  durationMs: number;
  easing: EasingFn;
}

/** 段取り全体。 */
export interface TransitionPlan {
  steps: TransitionStep[];
  /** 全部終わるまでの時間。 */
  totalMs: number;
}

function plan(steps: TransitionStep[]): TransitionPlan {
  const totalMs = steps.reduce((max, step) => Math.max(max, step.delayMs + step.durationMs), 0);
  return { steps, totalMs };
}

/**
 * `prefers-reduced-motion` の段取り。
 *
 * カメラ移動と開くアニメーションを飛ばし、クロスフェードだけにする。段を消すのではなく
 * **長さを 0 にする**のがポイントで、こうすると呼び出し側の分岐が増えない
 * （`progress()` は duration 0 で必ず 1 を返す）。
 */
function stilled(steps: TransitionStep[]): TransitionStep[] {
  return steps.map((step) => ({ ...step, delayMs: 0, durationMs: 0 }));
}

export interface PlanOptions {
  reducedMotion: boolean;
  /** SP のボードだけ 2 段構えになる。 */
  twoStageBoard: boolean;
}

/**
 * 対象ごとの段取りを組む。
 *
 * 手帳は「真上へ寄る」→「表紙が開く」→「見開きへ寄る」の 3 段。**開き終わってから**
 * 画面を切り替えるので、`totalMs` は最後の段の終わりになる。3 段は順序を保ったまま
 * 少しずつ重ねてある（`JOURNAL_OVERLAP`）。
 */
export function planFor(target: StudyTarget, options: PlanOptions): TransitionPlan {
  const steps = rawSteps(target, options);
  return plan(options.reducedMotion ? stilled(steps) : steps);
}

function rawSteps(target: StudyTarget, options: PlanOptions): TransitionStep[] {
  switch (target.kind) {
    case 'jar':
      // 突っ込まず左へパンする 1 段だけ。
      return [
        { name: 'jar-pan', delayMs: 0, durationMs: DURATION.jarPan, easing: EASING.easeInOutCubic },
      ];

    case 'journal-new':
    case 'journal-month':
      return journalSteps();

    case 'archive':
      return [
        {
          name: 'spine-lift',
          delayMs: 0,
          durationMs: DURATION.spineLift,
          easing: EASING.easeOutCubic,
        },
        {
          name: 'shelf-pan',
          delayMs: 0,
          durationMs: DURATION.shelfPan,
          easing: EASING.easeInOutCubic,
        },
      ];

    case 'board':
      return boardSteps(options.twoStageBoard);
  }
}

function journalSteps(): TransitionStep[] {
  const top: TransitionStep = {
    name: 'journal-top',
    delayMs: 0,
    durationMs: DURATION.journalTop,
    easing: EASING.easeOutCubic,
  };
  // 手帳の傾きを 0 に戻すのは真上へ寄るのと並走（同じ長さ・同じ開始）。
  const flatten: TransitionStep = {
    name: 'journal-flatten',
    delayMs: 0,
    durationMs: DURATION.journalTop,
    easing: EASING.easeOutCubic,
  };
  // 段は順に始まるが、前の段の終わりを待たない（JOURNAL_OVERLAP）。直列だと 2.3 秒かかり、
  // 「開くのを待たされる」状態になっていた。
  const coverDelay = DURATION.journalTop * JOURNAL_OVERLAP.coverStartsAt;
  const cover: TransitionStep = {
    name: 'cover-open',
    delayMs: coverDelay,
    durationMs: DURATION.coverOpen,
    easing: EASING.easeInOutCubic,
  };
  const spread: TransitionStep = {
    name: 'spread-in',
    delayMs: coverDelay + DURATION.coverOpen * JOURNAL_OVERLAP.spreadStartsAt,
    durationMs: DURATION.spreadIn,
    easing: EASING.easeOutCubic,
  };
  return [top, flatten, cover, spread];
}

function boardSteps(twoStage: boolean): TransitionStep[] {
  const front: TransitionStep = {
    name: 'board-front',
    delayMs: 0,
    durationMs: DURATION.boardFront,
    easing: EASING.easeOutCubic,
  };
  if (!twoStage) return [front];

  // SP だけ: 正対しただけでは視線の手前に瓶が残って主役を食う。寄りと瓶のフェードを並走させる。
  const close: TransitionStep = {
    name: 'board-close',
    delayMs: DURATION.boardFront + DELAY.boardCloseSp,
    durationMs: DURATION.boardCloseSp,
    easing: EASING.easeInOutCubic,
  };
  const jarFade: TransitionStep = {
    name: 'jar-fade',
    delayMs: DURATION.boardFront + DELAY.boardCloseSp,
    durationMs: DURATION.jarFadeSp,
    easing: EASING.linear,
  };
  return [front, close, jarFade];
}

/**
 * ある時刻におけるその段の進み（0..1、イージング適用済み）。
 *
 * 待ちの間は 0、終わったあとは 1 で張り付く。呼び出し側が「まだか / もう終わったか」を
 * 判定しなくて済むようにするため。
 */
export function stepProgress(step: TransitionStep, elapsedMs: number): number {
  const local = elapsedMs - step.delayMs;
  // 長さ 0 の段は、待ちが明けた瞬間にもう終わっている（reduced-motion がここを通る）。
  // `local <= 0` で一律 0 を返すと、時刻 0 の長さ 0 の段が「まだ始まっていない」に
  // なり、動きを消した利用者には手帳が永久に開かないまま見える。
  if (step.durationMs <= 0) return local >= 0 ? 1 : 0;
  if (local <= 0) return 0;
  return step.easing(progress(local, step.durationMs));
}

/** 段取り全体が終わったか。 */
export function isPlanDone(plan: TransitionPlan, elapsedMs: number): boolean {
  return elapsedMs >= plan.totalMs;
}

/** 名前で段を引く。無ければ「まだ始まっていない」扱いの 0。 */
export function progressOf(plan: TransitionPlan, name: string, elapsedMs: number): number {
  const step = plan.steps.find((candidate) => candidate.name === name);
  return step ? stepProgress(step, elapsedMs) : 0;
}

/**
 * ページ束が表紙に遅れて開くときの、i 枚目の進み。
 *
 * 表紙の段を基準に、遅れと長さを比率で決める（21-3d-parameters.md「ページの追従」）。
 */
export function pageProgress(cover: TransitionStep, index: number, elapsedMs: number): number {
  const lead = cover.durationMs * PAGE_FOLLOW.leadDelayRatio;
  const perPage = cover.durationMs * PAGE_FOLLOW.perPageDelayRatio;
  const pageStep: TransitionStep = {
    name: `${cover.name}-page-${index}`,
    delayMs: cover.delayMs + lead + perPage * index,
    durationMs: cover.durationMs * PAGE_FOLLOW.durationRatio,
    easing: cover.easing,
  };
  return stepProgress(pageStep, elapsedMs);
}

/**
 * 書斎から出ていくときに、書斎そのものを薄くする時間。
 *
 * **遷移の後半に重ねる。** カメラが着いてから薄くし始めると、その分だけ待ち時間が伸びる。
 * 逆に最初から薄くすると、カメラが動いているのが見えなくなる。短い遷移（ボードの 900ms）
 * では遷移の半分までに抑える。
 */
export function leaveFadeDuration(totalMs: number): number {
  if (!Number.isFinite(totalMs) || totalMs <= 0) return 0;
  return Math.min(DURATION.canvasFade, totalMs / 2);
}

/** 薄くし始める時刻。ここから `leaveFadeDuration` かけて 0 になり、着いた瞬間に切り替わる。 */
export function leaveFadeStart(totalMs: number): number {
  const duration = leaveFadeDuration(totalMs);
  // 長さが決まらない段取り（reduced-motion の 0 など）は「最初から薄い」に倒す。
  if (duration <= 0) return 0;
  return Math.max(0, totalMs - duration);
}
