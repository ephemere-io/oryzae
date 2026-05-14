import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useLinkQuestionSync } from '@/features/entries/hooks/use-link-question-sync';

describe('useLinkQuestionSync', () => {
  it('flushPending は現在の linkedIds 全てに対して link を呼ぶ', async () => {
    const link = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() =>
      useLinkQuestionSync({
        linkedIds: new Set(['q1', 'q2']),
        link,
      }),
    );

    await result.current.flushPending('e1');

    expect(link).toHaveBeenCalledTimes(2);
    expect(link).toHaveBeenCalledWith('e1', 'q1');
    expect(link).toHaveBeenCalledWith('e1', 'q2');
  });

  it('link が undefined のときは何もしない (no-op)', async () => {
    const { result } = renderHook(() =>
      useLinkQuestionSync({
        linkedIds: new Set(['q1']),
      }),
    );

    await expect(result.current.flushPending('e1')).resolves.toBeUndefined();
  });

  it('linkedIds が空のときは link を呼ばない', async () => {
    const link = vi.fn();
    const { result } = renderHook(() =>
      useLinkQuestionSync({
        linkedIds: new Set(),
        link,
      }),
    );

    await result.current.flushPending('e1');

    expect(link).not.toHaveBeenCalled();
  });

  it('rerender 後の最新 linkedIds が flushPending に反映される (ref パターン)', async () => {
    const link = vi.fn().mockResolvedValue(undefined);
    const { result, rerender } = renderHook(
      ({ ids }: { ids: Set<string> }) => useLinkQuestionSync({ linkedIds: ids, link }),
      { initialProps: { ids: new Set(['a']) } },
    );

    rerender({ ids: new Set(['a', 'b', 'c']) });

    await result.current.flushPending('e1');

    expect(link).toHaveBeenCalledTimes(3);
    expect(link).toHaveBeenCalledWith('e1', 'a');
    expect(link).toHaveBeenCalledWith('e1', 'b');
    expect(link).toHaveBeenCalledWith('e1', 'c');
  });

  it('link が reject したら flushPending も reject する (後続は試さない)', async () => {
    const link = vi.fn().mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('boom'));
    const { result } = renderHook(() =>
      useLinkQuestionSync({
        linkedIds: new Set(['q1', 'q2', 'q3']),
        link,
      }),
    );

    await expect(result.current.flushPending('e1')).rejects.toThrow('boom');
    // q1 成功 → q2 失敗で停止 → q3 は呼ばれない
    expect(link).toHaveBeenCalledTimes(2);
  });
});
