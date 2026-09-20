import { afterEach, describe, expect, it, vi } from 'vitest';
import { saveStudyBackdrop } from '@/features/shared/study/backdrop';
import {
  beginStudyHandoverFor,
  endStudyHandover,
  studyHandoverImage,
  subscribeStudyHandover,
} from '@/features/shared/study/handover';

const KEY = 'oryzae_study_handover';
const PIXEL = 'data:image/png;base64,iVBORw0KGgo=';

afterEach(() => {
  endStudyHandover();
  sessionStorage.clear();
});

describe('書斎への受け渡し', () => {
  it('書斎へ向かうときだけ敷く', () => {
    beginStudyHandoverFor('/entries/new', PIXEL);
    expect(studyHandoverImage()).toBeNull();

    beginStudyHandoverFor('/', PIXEL);
    expect(studyHandoverImage()).toBe(PIXEL);
  });

  it('撮れていなければ敷かない（地が無くても遷移は成立する）', () => {
    beginStudyHandoverFor('/', null);
    expect(studyHandoverImage()).toBeNull();
    expect(sessionStorage.getItem(KEY)).toBeNull();
  });

  it('敷いた・引いたが購読側に届く', () => {
    const listener = vi.fn();
    const stop = subscribeStudyHandover(listener);
    beginStudyHandoverFor('/', PIXEL);
    expect(listener).toHaveBeenCalledTimes(1);
    endStudyHandover();
    expect(listener).toHaveBeenCalledTimes(2);
    expect(studyHandoverImage()).toBeNull();
    stop();
    beginStudyHandoverFor('/', PIXEL);
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('フルページ遷移をまたいでも受け取れる（OAuth・メール確認）', async () => {
    saveStudyBackdrop(PIXEL);
    beginStudyHandoverFor('/', PIXEL);
    expect(sessionStorage.getItem(KEY)).not.toBeNull();

    // 読み込み直し = モジュールの持ち物が消える。印だけが sessionStorage に残る。
    vi.resetModules();
    const reloaded = await import('@/features/shared/study/handover');
    expect(reloaded.takePendingStudyHandover()).toBe(PIXEL);
    // 読んだら印は消す（次に書斎を開いたときに敷き直さない）。
    expect(sessionStorage.getItem(KEY)).toBeNull();
  });

  it('古い印では敷かない', async () => {
    saveStudyBackdrop(PIXEL);
    sessionStorage.setItem(KEY, String(Date.now() - 60_000));
    vi.resetModules();
    const reloaded = await import('@/features/shared/study/handover');
    expect(reloaded.takePendingStudyHandover()).toBeNull();
  });

  it('保存できない環境でも落ちない（プライベートウィンドウ）', () => {
    const setItem = sessionStorage.setItem;
    sessionStorage.setItem = () => {
      throw new Error('QuotaExceededError');
    };
    try {
      expect(() => beginStudyHandoverFor('/', PIXEL)).not.toThrow();
      // アプリ内遷移なら、手元に持っているぶんで足りる。
      expect(studyHandoverImage()).toBe(PIXEL);
    } finally {
      sessionStorage.setItem = setItem;
    }
  });
});
