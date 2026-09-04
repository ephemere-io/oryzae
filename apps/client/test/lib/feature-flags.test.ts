import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isEnvFlagOn, useFeatureFlag } from '@/lib/feature-flags';

// PostHog は provider を張らないと undefined を返す。ここではそれで十分
// （「まだ分からない」を off に倒さない、という既定の挙動そのもの）。
vi.mock('posthog-js/react', () => ({ useFeatureFlagEnabled: () => undefined }));

const OPTIONS = {
  key: 'study-home',
  envEnabled: false,
  queryParam: 'study',
  storageKey: 'oryzae_study_home',
};

function setSearch(search: string): void {
  window.history.replaceState({}, '', `/study${search}`);
}

beforeEach(() => {
  localStorage.clear();
  setSearch('');
});

afterEach(cleanup);

describe('useFeatureFlag', () => {
  it('初回レンダーは resolved=false / enabled=false（手動切替をまだ読めていない）', () => {
    // ここが本題。プレビュー（env=off）で ?study=on を付けても、**最初の1レンダーは
    // enabled=false** になる。resolved を見ずにこの値でリダイレクトすると、
    // 切替を付けているのに必ず従来の入口へ弾かれる（実際にそうなっていた）。
    setSearch('?study=on');
    const seen: { enabled: boolean; resolved: boolean }[] = [];
    renderHook(() => {
      const state = useFeatureFlag(OPTIONS);
      seen.push(state);
      return state;
    });

    expect(seen[0]).toEqual({ enabled: false, resolved: false });
    // 解決後は enabled になる（＝false は「まだ分からない」でしかなかった）。
    expect(seen[seen.length - 1]).toEqual({ enabled: true, resolved: true });
  });

  it('?flag=on は env が off でもフラグを立てる', async () => {
    setSearch('?study=on');
    const { result } = renderHook(() => useFeatureFlag(OPTIONS));

    await waitFor(() => expect(result.current.resolved).toBe(true));
    expect(result.current.enabled).toBe(true);
  });

  it('?flag=off は env が on でもフラグを落とす', async () => {
    setSearch('?study=off');
    const { result } = renderHook(() => useFeatureFlag({ ...OPTIONS, envEnabled: true }));

    await waitFor(() => expect(result.current.resolved).toBe(true));
    expect(result.current.enabled).toBe(false);
  });

  it('URL の切替を憶える（次からは付け直さなくてよい）', async () => {
    setSearch('?study=on');
    const first = renderHook(() => useFeatureFlag(OPTIONS));
    await waitFor(() => expect(first.result.current.resolved).toBe(true));
    first.unmount();

    setSearch('');
    const second = renderHook(() => useFeatureFlag(OPTIONS));
    await waitFor(() => expect(second.result.current.resolved).toBe(true));
    expect(second.result.current.enabled).toBe(true);
  });

  it('切替が無ければ env に従う', async () => {
    const off = renderHook(() => useFeatureFlag(OPTIONS));
    await waitFor(() => expect(off.result.current.resolved).toBe(true));
    expect(off.result.current.enabled).toBe(false);
    off.unmount();

    const on = renderHook(() => useFeatureFlag({ ...OPTIONS, envEnabled: true }));
    await waitFor(() => expect(on.result.current.resolved).toBe(true));
    expect(on.result.current.enabled).toBe(true);
  });

  it('env が on なら初回レンダーから enabled（切替待ちで一瞬 off にならない）', () => {
    // 本番の配信経路。ここが false だと、フラグ ON の環境で一瞬だけ従来画面が出る。
    const { result } = renderHook(() => useFeatureFlag({ ...OPTIONS, envEnabled: true }));
    expect(result.current.enabled).toBe(true);
  });

  it('localStorage が読めなくても落ちない', async () => {
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('private mode');
    });

    const { result } = renderHook(() => useFeatureFlag(OPTIONS));
    await waitFor(() => expect(result.current.resolved).toBe(true));
    expect(result.current.enabled).toBe(false);

    getItem.mockRestore();
  });

  it('localStorage に書けなくてもその場の切替は効く', async () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });

    setSearch('?study=on');
    const { result } = renderHook(() => useFeatureFlag(OPTIONS));
    await waitFor(() => expect(result.current.resolved).toBe(true));
    expect(result.current.enabled).toBe(true);

    setItem.mockRestore();
  });

  it('知らない値の切替は無視して env に従う', async () => {
    setSearch('?study=maybe');
    const { result } = renderHook(() => useFeatureFlag(OPTIONS));
    await waitFor(() => expect(result.current.resolved).toBe(true));
    expect(result.current.enabled).toBe(false);
  });
});

describe('isEnvFlagOn', () => {
  it('on / true / 1 を有効とみなす', () => {
    expect(isEnvFlagOn('on')).toBe(true);
    expect(isEnvFlagOn('true')).toBe(true);
    expect(isEnvFlagOn('1')).toBe(true);
  });

  it('未設定・off・その他は無効（既定は off）', () => {
    expect(isEnvFlagOn(undefined)).toBe(false);
    expect(isEnvFlagOn('')).toBe(false);
    expect(isEnvFlagOn('off')).toBe(false);
    expect(isEnvFlagOn('yes')).toBe(false);
  });
});
