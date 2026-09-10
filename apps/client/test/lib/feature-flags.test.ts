import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { isEnvFlagOff, isEnvFlagOn, useFeatureFlag } from '@/lib/feature-flags';

// PostHog は provider を張らないと undefined を返す。既定はそれにしておき
// （「まだ分からない」を off に倒さない、という既定の挙動そのもの）、
// false を返す場合だけテストの中で差し替える。
const posthog = vi.hoisted(() => {
  const holder: { value: boolean | undefined } = { value: undefined };
  return holder;
});
vi.mock('posthog-js/react', () => ({ useFeatureFlagEnabled: () => posthog.value }));

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
  posthog.value = undefined;
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

  it('?flag=auto は憶えた切替を捨てて配信に戻す', async () => {
    // 入る道だけあって出る道が無いと、レビューで触った端末が段階配信から永久に外れる。
    localStorage.setItem(OPTIONS.storageKey, 'on');

    setSearch('?study=auto');
    const { result } = renderHook(() => useFeatureFlag(OPTIONS));
    await waitFor(() => expect(result.current.resolved).toBe(true));

    expect(result.current.enabled).toBe(false); // env=off の配信どおり
    expect(localStorage.getItem(OPTIONS.storageKey)).toBeNull(); // 鍵ごと消える
  });

  it('?flag=auto の後は env の配信に素直に従う', async () => {
    localStorage.setItem(OPTIONS.storageKey, 'off');

    setSearch('?study=auto');
    const cleared = renderHook(() => useFeatureFlag({ ...OPTIONS, envEnabled: true }));
    await waitFor(() => expect(cleared.result.current.resolved).toBe(true));
    expect(cleared.result.current.enabled).toBe(true);
    cleared.unmount();

    // URL を外しても、憶えた「off 固定」は戻ってこない。
    setSearch('');
    const after = renderHook(() => useFeatureFlag({ ...OPTIONS, envEnabled: true }));
    await waitFor(() => expect(after.result.current.resolved).toBe(true));
    expect(after.result.current.enabled).toBe(true);
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

describe('PostHog の扱い', () => {
  it('既定では PostHog が false を返すと落とす（段階配信）', () => {
    posthog.value = false;
    const { result } = renderHook(() => useFeatureFlag({ ...OPTIONS, envEnabled: true }));
    expect(result.current.enabled).toBe(false);
  });

  it('respectPosthog: false なら PostHog の false で落とさない（全員に配るフラグ）', () => {
    // PostHog はフラグが無いときや配信の対象外のときも false を返す。既定 on のフラグで
    // これを見ると、PostHog 側の設定しだいで全員が黙って off に戻る。
    posthog.value = false;
    const { result } = renderHook(() =>
      useFeatureFlag({ ...OPTIONS, envEnabled: true, respectPosthog: false }),
    );
    expect(result.current.enabled).toBe(true);
  });

  it('respectPosthog: false でも手動切替は効く', async () => {
    setSearch('?study=off');
    const { result } = renderHook(() =>
      useFeatureFlag({ ...OPTIONS, envEnabled: true, respectPosthog: false }),
    );
    await waitFor(() => expect(result.current.resolved).toBe(true));
    expect(result.current.enabled).toBe(false);
  });
});

describe('isEnvFlagOff', () => {
  it('off / false / 0 だけを「明示的に切っている」とみなす', () => {
    expect(isEnvFlagOff('off')).toBe(true);
    expect(isEnvFlagOff('false')).toBe(true);
    expect(isEnvFlagOff('0')).toBe(true);
  });

  it('未設定・on・その他は切っていない（既定 on のフラグは出る）', () => {
    expect(isEnvFlagOff(undefined)).toBe(false);
    expect(isEnvFlagOff('')).toBe(false);
    expect(isEnvFlagOff('on')).toBe(false);
    expect(isEnvFlagOff('yes')).toBe(false);
  });
});
