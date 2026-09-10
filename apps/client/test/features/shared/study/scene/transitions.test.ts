import { describe, expect, it } from 'vitest';
import { DURATION, OPEN_BUDGET_MS } from '@/features/shared/study/constants';
import { SPREAD_PAGES } from '@/features/shared/study/scene/books';
import {
  isPlanDone,
  leaveFadeDuration,
  leaveFadeStart,
  pageProgress,
  planFor,
  progressOf,
  stepProgress,
  type TransitionStep,
} from '@/features/shared/study/scene/transitions';
import type { StudyTarget } from '@/features/shared/study/types';

const PC = { reducedMotion: false, twoStageBoard: false };
const SP = { reducedMotion: false, twoStageBoard: true };
const REDUCED = { reducedMotion: true, twoStageBoard: false };

const ALL_TARGETS: StudyTarget[] = [
  { kind: 'jar' },
  { kind: 'journal-new' },
  { kind: 'journal-month', month: '2026-08' },
  { kind: 'archive' },
  { kind: 'board' },
];

describe('planFor', () => {
  it.each(ALL_TARGETS)('$kind: 段が 1 つ以上ある', (target) => {
    expect(planFor(target, PC).steps.length).toBeGreaterThan(0);
  });

  it.each(ALL_TARGETS)('$kind: totalMs が最後の段の終わりと一致する', (target) => {
    const plan = planFor(target, PC);
    const last = Math.max(...plan.steps.map((step) => step.delayMs + step.durationMs));
    expect(plan.totalMs).toBe(last);
  });

  it('瓶はパン 1 段（突っ込むズームにしない）', () => {
    const plan = planFor({ kind: 'jar' }, PC);
    expect(plan.steps.map((s) => s.name)).toEqual(['jar-pan']);
    expect(plan.totalMs).toBe(DURATION.jarPan);
  });

  it('手帳は 真上へ → 表紙が開く → 見開きへ の順に始まる', () => {
    const plan = planFor({ kind: 'journal-new' }, PC);
    const top = plan.steps.find((s) => s.name === 'journal-top');
    const cover = plan.steps.find((s) => s.name === 'cover-open');
    const spread = plan.steps.find((s) => s.name === 'spread-in');
    if (!top || !cover || !spread) throw new Error('missing step');

    // 順序は保つ。寄る前に開いたり、開く前に覗き込んだりしない。
    expect(cover.delayMs).toBeGreaterThan(top.delayMs);
    expect(spread.delayMs).toBeGreaterThan(cover.delayMs);
  });

  it('3 段は重ねる（前の段の終わりを待たない）', () => {
    // 直列に並べると 2.3 秒かかり、「エントリーが開くのを待たされる」と報告された。
    // 人は表紙が開き始めるのを、カメラが止まり切る前から読み取れる。
    const plan = planFor({ kind: 'journal-new' }, PC);
    const top = plan.steps.find((s) => s.name === 'journal-top');
    const cover = plan.steps.find((s) => s.name === 'cover-open');
    const spread = plan.steps.find((s) => s.name === 'spread-in');
    if (!top || !cover || !spread) throw new Error('missing step');

    expect(cover.delayMs).toBeLessThan(top.delayMs + top.durationMs);
    expect(spread.delayMs).toBeLessThan(cover.delayMs + cover.durationMs);
  });

  it('手帳は 1 秒以内に開き切る（開くのを待たせない）', () => {
    // これを超えたら「待たされている」。段を足すときはここが先に落ちる。
    expect(planFor({ kind: 'journal-new' }, PC).totalMs).toBeLessThanOrEqual(OPEN_BUDGET_MS);
  });

  it('紙は画面が切り替わるまでにめくり終わる', () => {
    // 表紙より遅れてめくれる紙が、切り替わりに間に合わないと「途中で消えた」ように見える。
    // 段の長さを詰めるとここが最初に破れるので、実際の段取りで見る。
    const plan = planFor({ kind: 'journal-new' }, PC);
    const cover = plan.steps.find((s) => s.name === 'cover-open');
    if (!cover) throw new Error('missing step');
    for (let i = 0; i < SPREAD_PAGES.count; i += 1) {
      expect(pageProgress(cover, i, plan.totalMs)).toBe(1);
    }
  });

  it('手帳の傾き戻しは真上へ寄るのと並走する', () => {
    const plan = planFor({ kind: 'journal-new' }, PC);
    const top = plan.steps.find((s) => s.name === 'journal-top');
    const flatten = plan.steps.find((s) => s.name === 'journal-flatten');
    expect(flatten?.delayMs).toBe(top?.delayMs);
    expect(flatten?.durationMs).toBe(top?.durationMs);
  });

  it('過去月も当月と同じ段取り（中身が違うだけ）', () => {
    expect(planFor({ kind: 'journal-month', month: '2026-08' }, PC)).toEqual(
      planFor({ kind: 'journal-new' }, PC),
    );
  });

  it('棚は背表紙の持ち上げがパンより先に終わる', () => {
    const plan = planFor({ kind: 'archive' }, PC);
    const lift = plan.steps.find((s) => s.name === 'spine-lift');
    const pan = plan.steps.find((s) => s.name === 'shelf-pan');
    expect(lift?.durationMs).toBeLessThan(pan?.durationMs ?? 0);
  });

  it('PC のボードは正対の 1 段だけ（俯瞰から正対するので瓶が視界に入らない）', () => {
    expect(planFor({ kind: 'board' }, PC).steps.map((s) => s.name)).toEqual(['board-front']);
  });

  it('SP のボードは 2 段構えで、寄りと瓶のフェードが並走する', () => {
    const plan = planFor({ kind: 'board' }, SP);
    const names = plan.steps.map((s) => s.name);
    expect(names).toContain('board-close');
    expect(names).toContain('jar-fade');

    const close = plan.steps.find((s) => s.name === 'board-close');
    const fade = plan.steps.find((s) => s.name === 'jar-fade');
    expect(close?.delayMs).toBe(fade?.delayMs);
  });

  it('SP のボードは正対してから待って寄る', () => {
    const plan = planFor({ kind: 'board' }, SP);
    const front = plan.steps.find((s) => s.name === 'board-front');
    const close = plan.steps.find((s) => s.name === 'board-close');
    expect(close?.delayMs).toBeGreaterThan((front?.delayMs ?? 0) + (front?.durationMs ?? 0));
  });

  it('SP のボードは PC より長くかかる（2 段ぶん）', () => {
    expect(planFor({ kind: 'board' }, SP).totalMs).toBeGreaterThan(
      planFor({ kind: 'board' }, PC).totalMs,
    );
  });
});

describe('prefers-reduced-motion', () => {
  it.each(ALL_TARGETS)('$kind: 全段の長さと待ちが 0 になる', (target) => {
    const plan = planFor(target, REDUCED);
    expect(plan.totalMs).toBe(0);
    for (const step of plan.steps) {
      expect(step.durationMs).toBe(0);
      expect(step.delayMs).toBe(0);
    }
  });

  it.each(ALL_TARGETS)('$kind: 段そのものは消さない（呼び出し側の分岐を増やさない）', (target) => {
    expect(planFor(target, REDUCED).steps.map((s) => s.name)).toEqual(
      planFor(target, PC).steps.map((s) => s.name),
    );
  });

  it('時刻 0 でもう終わっている', () => {
    const plan = planFor({ kind: 'journal-new' }, REDUCED);
    expect(isPlanDone(plan, 0)).toBe(true);
    for (const step of plan.steps) expect(stepProgress(step, 0)).toBe(1);
  });

  it('段取りが 0 でも溶暗の計算が壊れない', () => {
    // 動きを消しても「切り替わった」ことは伝える必要がある。長さ 0 の段取りでは
    // 薄くする時間も 0 で、呼び出し側は即座に消す。
    expect(leaveFadeDuration(0)).toBe(0);
    expect(leaveFadeStart(0)).toBe(0);
  });
});

describe('stepProgress', () => {
  const step: TransitionStep = {
    name: 's',
    delayMs: 100,
    durationMs: 200,
    easing: (p) => p,
  };

  it('待ちの間は 0', () => {
    expect(stepProgress(step, 0)).toBe(0);
    expect(stepProgress(step, 100)).toBe(0);
  });

  it('待ち明けから進む', () => {
    expect(stepProgress(step, 200)).toBeCloseTo(0.5, 10);
    expect(stepProgress(step, 300)).toBe(1);
  });

  it('終わったあとは 1 で張り付く（戻らない）', () => {
    expect(stepProgress(step, 5000)).toBe(1);
  });

  it('負の時刻でも 0', () => {
    expect(stepProgress(step, -50)).toBe(0);
  });
});

describe('progressOf / isPlanDone', () => {
  it('名前で段を引ける', () => {
    const plan = planFor({ kind: 'jar' }, PC);
    expect(progressOf(plan, 'jar-pan', DURATION.jarPan)).toBe(1);
  });

  it('知らない段は 0（まだ始まっていない扱い）', () => {
    const plan = planFor({ kind: 'jar' }, PC);
    expect(progressOf(plan, 'nope', 99999)).toBe(0);
  });

  it('全段が終わるまで done にならない', () => {
    const plan = planFor({ kind: 'journal-new' }, PC);
    expect(isPlanDone(plan, plan.totalMs - 1)).toBe(false);
    expect(isPlanDone(plan, plan.totalMs)).toBe(true);
  });

  it('手帳は開き終わるまで done にならない（開く途中で画面が切り替わらない）', () => {
    const plan = planFor({ kind: 'journal-new' }, PC);
    const cover = plan.steps.find((s) => s.name === 'cover-open');
    if (!cover) throw new Error('missing step');
    expect(isPlanDone(plan, cover.delayMs + cover.durationMs)).toBe(false);
  });
});

describe('pageProgress', () => {
  const cover: TransitionStep = {
    name: 'cover-open',
    delayMs: 1000,
    durationMs: 800,
    easing: (p) => p,
  };

  it('表紙より遅れて始まる', () => {
    expect(pageProgress(cover, 0, cover.delayMs)).toBe(0);
    expect(stepProgress(cover, cover.delayMs + 1)).toBeGreaterThan(0);
  });

  it('奥のページほど遅れる', () => {
    const at = cover.delayMs + 400;
    expect(pageProgress(cover, 0, at)).toBeGreaterThan(pageProgress(cover, 1, at));
    expect(pageProgress(cover, 1, at)).toBeGreaterThan(pageProgress(cover, 2, at));
  });

  it('最後のページも表紙の段取りの中で開き終わる', () => {
    // 表紙が閉じ切ったあとにページだけが動くと、紙が浮いて見える。
    const end = cover.delayMs + cover.durationMs * 1.5;
    expect(pageProgress(cover, 2, end)).toBe(1);
  });
});

describe('出ていくときの溶暗', () => {
  it('遷移の後半に重ねる（待ち時間を増やさない）', () => {
    // 薄くし終わるのは、カメラが着くのとちょうど同時。
    for (const total of [900, 1250, 2330]) {
      expect(leaveFadeStart(total) + leaveFadeDuration(total)).toBeCloseTo(total, 10);
    }
  });

  it('長い遷移では canvasFade ぶんだけ薄くする', () => {
    expect(leaveFadeDuration(2330)).toBe(DURATION.canvasFade);
    expect(leaveFadeStart(2330)).toBe(2330 - DURATION.canvasFade);
  });

  it('短い遷移では半分までに抑える（最初から薄いとカメラが見えない）', () => {
    // ボードは 900ms。600ms 薄くすると 2/3 が溶暗になってしまう。
    expect(leaveFadeDuration(900)).toBe(450);
    expect(leaveFadeStart(900)).toBe(450);
  });

  it('薄くし始めるのは必ず遷移の途中から（0 から始めない）', () => {
    for (const total of [1, 100, 900, 1250, 2330]) {
      expect(leaveFadeStart(total)).toBeGreaterThan(0);
      expect(leaveFadeStart(total)).toBeLessThan(total);
    }
  });

  it('壊れた長さでも落ちない', () => {
    for (const total of [0, -100, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(leaveFadeDuration(total)).toBe(0);
      expect(leaveFadeStart(total)).toBeGreaterThanOrEqual(0);
    }
  });

  it('実際の段取りすべてで成立する', () => {
    for (const target of ALL_TARGETS) {
      const total = planFor(target, PC).totalMs;
      expect(leaveFadeDuration(total)).toBeGreaterThan(0);
      expect(leaveFadeStart(total)).toBeLessThan(total);
    }
  });
});
