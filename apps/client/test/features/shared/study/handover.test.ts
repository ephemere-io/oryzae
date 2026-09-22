import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  beginStudyHandoverFor,
  endStudyHandover,
  type StudyBridge,
  studyHandoverBridge,
  subscribeStudyHandover,
} from '@/features/shared/study/handover';

function bridge(): StudyBridge & { dispose: ReturnType<typeof vi.fn> } {
  return { canvas: document.createElement('canvas'), dispose: vi.fn() };
}

afterEach(() => endStudyHandover());

describe('書斎への受け渡し（歩いている canvas）', () => {
  it('書斎へ向かうときだけ載せる', () => {
    const b = bridge();
    beginStudyHandoverFor('/', b);
    expect(studyHandoverBridge()).toBe(b);
  });

  it('書斎以外へ向かうなら載せず、持ち出したものはその場で捨てる', () => {
    // 載せたまま別の画面へ行くと、扉の canvas がその画面を塞ぐ。
    const b = bridge();
    beginStudyHandoverFor('/entries/new', b);
    expect(studyHandoverBridge()).toBeNull();
    expect(b.dispose).toHaveBeenCalledTimes(1);
  });

  it('持ち出せていなければ何もしない（扉が無い環境）', () => {
    beginStudyHandoverFor('/', null);
    expect(studyHandoverBridge()).toBeNull();
  });

  it('載せた・引いたが購読側に届く', () => {
    const listener = vi.fn();
    const stop = subscribeStudyHandover(listener);
    beginStudyHandoverFor('/', bridge());
    expect(listener).toHaveBeenCalledTimes(1);
    endStudyHandover();
    expect(listener).toHaveBeenCalledTimes(2);
    expect(studyHandoverBridge()).toBeNull();
    stop();
    beginStudyHandoverFor('/', bridge());
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('引いても捨てない（溶けているあいだは描いていてほしい）', () => {
    // 捨てるのは受け皿（StudyHandover）が溶かし終えてから。
    const b = bridge();
    beginStudyHandoverFor('/', b);
    endStudyHandover();
    expect(b.dispose).not.toHaveBeenCalled();
  });

  it('前のものが残っていれば、新しく載せるときに捨てる', () => {
    const first = bridge();
    const second = bridge();
    beginStudyHandoverFor('/', first);
    beginStudyHandoverFor('/', second);
    expect(first.dispose).toHaveBeenCalledTimes(1);
    expect(studyHandoverBridge()).toBe(second);
  });
});
