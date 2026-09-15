import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PullBackToStudy } from '@/features/shared/study/components/pull-back-to-study';
import { PULL_BACK } from '@/features/shared/study/constants';
import { OVERZOOM_OUT_EVENT } from '@/lib/canvas/viewport';

const push = vi.fn();
// Next の useRouter は描画をまたいで同じものを返す。毎回作り直すと effect が張り直される。
const router = { push };
vi.mock('next/navigation', () => ({ useRouter: () => router }));

function overzoom(excess: number, input?: 'wheel' | 'pinch') {
  act(() => {
    window.dispatchEvent(new CustomEvent(OVERZOOM_OUT_EVENT, { detail: { excess, input } }));
  });
}

function release() {
  act(() => {
    window.dispatchEvent(new Event('pointerup'));
  });
}

describe('PullBackToStudy（引いて書斎へ）', () => {
  beforeEach(() => push.mockClear());
  afterEach(cleanup);

  it('指のつまみはホイールより大きく進み、はっきり 1 回つまんで離せば着ける', () => {
    render(<PullBackToStudy />);
    // ln(2.2) ≈ 0.79 ぶんのつまみを細かく送る。つまんでいる途中では着かず（軽いつまみで戻らない）、離すと着く。
    for (let i = 0; i < 20; i++) overzoom(0.04, 'pinch');
    expect(push).not.toHaveBeenCalled();
    release();
    expect(push).toHaveBeenCalledWith('/');
  });

  it('同じ量のホイールでは着かない（トラックパッドを弾いただけで部屋が変わらないように）', () => {
    render(<PullBackToStudy />);
    for (let i = 0; i < 20; i++) overzoom(0.04, 'wheel');
    expect(push).not.toHaveBeenCalled();
  });

  it('つまみを離した時点で commitOnRelease 以上なら着く（戻れそうで戻れない、をやめる）', () => {
    render(<PullBackToStudy />);
    const steps = Math.ceil(PULL_BACK.commitOnRelease / (0.05 * PULL_BACK.pinchGain));
    for (let i = 0; i < steps; i++) overzoom(0.05, 'pinch');
    expect(push).not.toHaveBeenCalled();
    release();
    expect(push).toHaveBeenCalledWith('/');
  });

  it('commitOnRelease に届かず離したら着かない（戻したくない軽いつまみで戻らない）', () => {
    render(<PullBackToStudy />);
    overzoom(0.05, 'pinch');
    release();
    expect(push).not.toHaveBeenCalled();
  });
});
