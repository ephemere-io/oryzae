import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * 「いま扉から入ってきた」という印。画面をまたぐ 1 回きりの合図なので、
 * **立てた人と読む人が別のページに居る**ことを前提に確かめる。
 *
 * モジュールに「渡し終えた」憶えがあるので、テストごとに読み込み直す。
 */
async function loadArrival() {
  vi.resetModules();
  return await import('@/features/shared/study/arrival');
}

const KEY = 'oryzae_study_arrival';

beforeEach(() => sessionStorage.clear());
afterEach(() => sessionStorage.clear());

describe('markStudyArrivalFor', () => {
  it('書斎（/）へ向かうときだけ印を立てる', async () => {
    const { markStudyArrivalFor } = await loadArrival();

    markStudyArrivalFor('/');
    expect(sessionStorage.getItem(KEY)).not.toBeNull();
  });

  it('書斎以外（従来の入口・サブ画面）では立てない', async () => {
    const { markStudyArrivalFor } = await loadArrival();

    for (const destination of ['/entries', '/entries/new', '/account']) {
      markStudyArrivalFor(destination);
      expect(sessionStorage.getItem(KEY)).toBeNull();
    }
  });
});

describe('takeStudyArrival', () => {
  it('立てた印を受け取り、置き場からは消す', async () => {
    const { markStudyArrivalFor, takeStudyArrival } = await loadArrival();
    markStudyArrivalFor('/');

    expect(takeStudyArrival()).toBe(true);
    expect(sessionStorage.getItem(KEY)).toBeNull();
  });

  it('印が無ければ false（ふつうに書斎を開いたときは定置しない）', async () => {
    const { takeStudyArrival } = await loadArrival();

    expect(takeStudyArrival()).toBe(false);
  });

  it('続けて読んでも同じ答えを返す（React の二重呼び出しで合図を落とさない）', async () => {
    const { markStudyArrivalFor, takeStudyArrival } = await loadArrival();
    markStudyArrivalFor('/');

    expect(takeStudyArrival()).toBe(true);
    expect(takeStudyArrival()).toBe(true);
  });

  it('別の訪問（読み込み直し）では持ち越さない', async () => {
    const first = await loadArrival();
    first.markStudyArrivalFor('/');
    expect(first.takeStudyArrival()).toBe(true);

    const next = await loadArrival();
    expect(next.takeStudyArrival()).toBe(false);
  });
});
