import { describe, expect, it } from 'vitest';
import { DURATION } from '@/features/shared/study/constants';
import {
  crossfadeOpacity,
  isPlanDone,
  pageProgress,
  planBackToStudy,
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
  { kind: 'letter', fermentationId: 'f', questionId: 'q' },
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

  it('封は瓶と同じパン', () => {
    const letter = planFor({ kind: 'letter', fermentationId: 'f', questionId: 'q' }, PC);
    expect(letter).toEqual(planFor({ kind: 'jar' }, PC));
  });

  it('手帳は 真上へ → 表紙が開く → 見開きへ の順に重ならず並ぶ', () => {
    const plan = planFor({ kind: 'journal-new' }, PC);
    const top = plan.steps.find((s) => s.name === 'journal-top');
    const cover = plan.steps.find((s) => s.name === 'cover-open');
    const spread = plan.steps.find((s) => s.name === 'spread-in');
    if (!top || !cover || !spread) throw new Error('missing step');

    // 着いてから開く。開き終わってから寄る。
    expect(cover.delayMs).toBeGreaterThanOrEqual(top.delayMs + top.durationMs);
    expect(spread.delayMs).toBeGreaterThanOrEqual(cover.delayMs + cover.durationMs);
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

  it('クロスフェードだけは残る', () => {
    // 動きを消しても、切り替わったことは伝える必要がある。
    expect(crossfadeOpacity(0).screen).toBe(0);
    expect(crossfadeOpacity(DURATION.screenFade).screen).toBe(1);
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

describe('planBackToStudy', () => {
  it('画面を伏せてからカメラが動き出す', () => {
    const plan = planBackToStudy(false);
    const step = plan.steps[0];
    expect(step.delayMs).toBeGreaterThan(0);
    // 待ちの間はカメラが動かない＝層が消えてから中身が戻る。
    expect(stepProgress(step, step.delayMs - 1)).toBe(0);
  });

  it('reduced-motion では待たずに終わる', () => {
    expect(planBackToStudy(true).totalMs).toBe(0);
  });
});

describe('crossfadeOpacity', () => {
  it('canvas が消えながら画面が出る', () => {
    expect(crossfadeOpacity(0)).toEqual({ canvas: 1, screen: 0 });
    const mid = crossfadeOpacity(DURATION.canvasFade / 2);
    expect(mid.canvas).toBeLessThan(1);
    expect(mid.screen).toBeGreaterThan(0);
  });

  it('0..1 を外れない', () => {
    for (const ms of [-100, 0, 500, 100000]) {
      const { canvas, screen } = crossfadeOpacity(ms);
      expect(canvas).toBeGreaterThanOrEqual(0);
      expect(canvas).toBeLessThanOrEqual(1);
      expect(screen).toBeGreaterThanOrEqual(0);
      expect(screen).toBeLessThanOrEqual(1);
    }
  });
});
