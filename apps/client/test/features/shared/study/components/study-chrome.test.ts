import { describe, expect, it } from 'vitest';
import { resolveStatusKey } from '@/features/shared/study/components/study-chrome';

/**
 * 状態語の選び方（00-overview.md「コピー」）。
 *
 * 「もうすぐ発酵します」だけが readiness の閾値で言い換わる。それ以外は状態で決まる。
 */
describe('resolveStatusKey', () => {
  it('記録が無ければ「まだ何もありません」', () => {
    expect(resolveStatusKey('idle', 0)).toBe('status_idle');
  });

  it('発酵中は「発酵中」', () => {
    expect(resolveStatusKey('fermenting', 0.4)).toBe('status_fermenting');
  });

  it('readiness 0.9 以上で「もうすぐ」に言い換わる', () => {
    expect(resolveStatusKey('fermenting', 0.89)).toBe('status_fermenting');
    expect(resolveStatusKey('fermenting', 0.9)).toBe('status_almost');
    expect(resolveStatusKey('fermenting', 1)).toBe('status_almost');
  });

  it('手紙が届いていれば readiness に関わらず「手紙が届いています」', () => {
    expect(resolveStatusKey('completed', 1)).toBe('status_completed');
    expect(resolveStatusKey('completed', 0)).toBe('status_completed');
  });

  it('idle は readiness が高くても言い換えない', () => {
    // idle は「完了発酵も進みも無い」状態。閾値の言い換えは発酵中にだけ効く。
    expect(resolveStatusKey('idle', 0.95)).toBe('status_idle');
  });
});
