import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAutosaveEntry } from '@/features/shared/entries/hooks/use-autosave-entry';

/**
 * オフラインの保険（片割れ）: 保存に失敗したら間隔を空けて再送し、`online` が来たら待たずに送る。
 * もう片方の端末の写しは `use-entry-local-copy.test.ts`。
 */
describe('useAutosaveEntry（失敗したら再送する）', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  async function tick(ms: number) {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(ms);
    });
  }

  function setup(save: ReturnType<typeof vi.fn>) {
    return renderHook(
      ({ body }) => useAutosaveEntry({ title: '', body, entryId: 'e1', save, enabled: true }),
      { initialProps: { body: '' } },
    );
  }

  it('失敗すると retrying になり、10 秒後にもう一度送る', async () => {
    const save = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue('e1');
    const { result, rerender } = setup(save);
    rerender({ body: '電波の無い場所で書いた' });
    await tick(2000);
    expect(save).toHaveBeenCalledTimes(1);
    expect(result.current.retrying).toBe(true);

    await tick(9_999);
    expect(save).toHaveBeenCalledTimes(1);
    await tick(1);
    expect(save).toHaveBeenCalledTimes(2);
    await tick(0);
    expect(result.current.retrying).toBe(false);
  });

  it('続けて失敗すると 10s → 30s → 60s と間隔が伸びる', async () => {
    const save = vi.fn().mockRejectedValue(new Error('offline'));
    const { rerender } = setup(save);
    rerender({ body: '書いた' });
    await tick(2000);
    expect(save).toHaveBeenCalledTimes(1);
    await tick(10_000);
    expect(save).toHaveBeenCalledTimes(2);
    await tick(30_000);
    expect(save).toHaveBeenCalledTimes(3);
    await tick(60_000);
    expect(save).toHaveBeenCalledTimes(4);
  });

  it('online の合図が来たら待たずに送る', async () => {
    const save = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue('e1');
    const { result, rerender } = setup(save);
    rerender({ body: '書いた' });
    await tick(2000);
    expect(result.current.retrying).toBe(true);

    await act(async () => {
      window.dispatchEvent(new Event('online'));
      await Promise.resolve();
    });
    expect(save).toHaveBeenCalledTimes(2);
    await tick(0);
    expect(result.current.retrying).toBe(false);
  });

  it('新しい入力が来たら再送の予約は捨てて、いつもの debounce で送る', async () => {
    const save = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue('e1');
    const { rerender } = setup(save);
    rerender({ body: '一' });
    await tick(2000);
    expect(save).toHaveBeenCalledTimes(1);
    rerender({ body: '一二' });
    await tick(2000);
    expect(save).toHaveBeenCalledTimes(2);
    // 再送の予約（10s）は消えているので、それ以上は送らない
    await tick(10_000);
    expect(save).toHaveBeenCalledTimes(2);
  });

  it('5 回続けて失敗したら次の入力まで止める', async () => {
    const save = vi.fn().mockRejectedValue(new Error('400'));
    const { rerender } = setup(save);
    rerender({ body: '書いた' });
    await tick(2000);
    await tick(10_000 + 30_000 + 60_000 + 60_000 + 60_000);
    const calls = save.mock.calls.length;
    expect(calls).toBe(6);
    await tick(600_000);
    expect(save).toHaveBeenCalledTimes(calls);
  });
});
