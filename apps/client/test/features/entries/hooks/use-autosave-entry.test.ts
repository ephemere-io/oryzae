import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAutosaveEntry } from '@/features/entries/hooks/use-autosave-entry';

describe('useAutosaveEntry', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('debounce 経過後に delta が 10 文字以上なら save を呼ぶ', async () => {
    const save = vi.fn().mockResolvedValue('new-id');

    const { rerender } = renderHook(
      ({ body }) =>
        useAutosaveEntry({
          title: '',
          body,
          entryId: undefined,
          save,
          enabled: true,
        }),
      { initialProps: { body: '' } },
    );

    rerender({ body: 'これは十分な長さの本文です' });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });

    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith('これは十分な長さの本文です', undefined);
  });

  it('delta が 10 文字未満なら save を呼ばない', async () => {
    const save = vi.fn().mockResolvedValue('id');

    const { rerender } = renderHook(
      ({ body }) =>
        useAutosaveEntry({
          title: '',
          body,
          entryId: 'e1',
          save,
          enabled: true,
        }),
      { initialProps: { body: 'original content' } },
    );

    rerender({ body: 'original contentX' }); // +1 char

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });

    expect(save).not.toHaveBeenCalled();
  });

  it('body が空白のみなら save を呼ばない', async () => {
    const save = vi.fn();

    const { rerender } = renderHook(
      ({ body }) =>
        useAutosaveEntry({
          title: '',
          body,
          entryId: undefined,
          save,
          enabled: true,
        }),
      { initialProps: { body: '' } },
    );

    rerender({ body: '          ' });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });

    expect(save).not.toHaveBeenCalled();
  });

  it('title がある場合は title\\nbody 形式で保存する', async () => {
    const save = vi.fn().mockResolvedValue('id');

    const { rerender } = renderHook(
      ({ body }) =>
        useAutosaveEntry({
          title: 'マイタイトル',
          body,
          entryId: 'e1',
          save,
          enabled: true,
        }),
      { initialProps: { body: '' } },
    );

    rerender({ body: '本文は十分長いテキストである' });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });

    expect(save).toHaveBeenCalledWith('マイタイトル\n本文は十分長いテキストである', 'e1');
  });

  it('enabled=false なら save を呼ばない', async () => {
    const save = vi.fn();

    const { rerender } = renderHook(
      ({ body }) =>
        useAutosaveEntry({
          title: '',
          body,
          entryId: undefined,
          save,
          enabled: false,
        }),
      { initialProps: { body: '' } },
    );

    rerender({ body: '十分な長さのテキストです' });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(3000);
    });

    expect(save).not.toHaveBeenCalled();
  });

  it('連続編集時はデバウンスで最後の1回だけ save する', async () => {
    const save = vi.fn().mockResolvedValue('id');

    const { rerender } = renderHook(
      ({ body }) =>
        useAutosaveEntry({
          title: '',
          body,
          entryId: undefined,
          save,
          enabled: true,
        }),
      { initialProps: { body: '' } },
    );

    rerender({ body: '十分な長さの1つ目' });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    rerender({ body: '十分な長さの1つ目と2つ目' });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    rerender({ body: '十分な長さの1つ目と2つ目と3つ目' });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });

    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith('十分な長さの1つ目と2つ目と3つ目', undefined);
  });
});
