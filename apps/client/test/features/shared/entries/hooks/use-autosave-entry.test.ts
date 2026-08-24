import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAutosaveEntry } from '@/features/shared/entries/hooks/use-autosave-entry';

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
    expect(save).toHaveBeenCalledWith('これは十分な長さの本文です', undefined, undefined);
  });

  // 写真を添えた直後の自動保存で media_urls が巻き添えで消えないこと。
  it('mediaUrls を渡すと save に同梱される', async () => {
    const save = vi.fn().mockResolvedValue('new-id');
    const mediaUrls = ['https://cdn.example/a.jpg'];

    const { rerender } = renderHook(
      ({ body }) =>
        useAutosaveEntry({
          title: '',
          body,
          entryId: undefined,
          save,
          enabled: true,
          mediaUrls,
        }),
      { initialProps: { body: '' } },
    );

    rerender({ body: 'これは十分な長さの本文です' });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });

    expect(save).toHaveBeenCalledWith('これは十分な長さの本文です', undefined, { mediaUrls });
  });

  // 保存の起動条件は本文の変化のまま。写真を足しただけでは保存を走らせない
  // （呼び出し側が明示的に保存するため。二重保存を避ける）。
  it('mediaUrls が変わっただけでは save を呼ばない', async () => {
    const save = vi.fn().mockResolvedValue('new-id');

    const { rerender } = renderHook(
      ({ mediaUrls }) =>
        useAutosaveEntry({
          title: '',
          body: '本文はずっと同じままにしておく',
          entryId: 'e1',
          save,
          enabled: true,
          mediaUrls,
        }),
      { initialProps: { mediaUrls: [] as string[] } },
    );

    rerender({ mediaUrls: ['https://cdn.example/a.jpg'] });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });

    expect(save).not.toHaveBeenCalled();
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

    expect(save).toHaveBeenCalledWith(
      'マイタイトル\n本文は十分長いテキストである',
      'e1',
      undefined,
    );
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
    expect(save).toHaveBeenCalledWith('十分な長さの1つ目と2つ目と3つ目', undefined, undefined);
  });
});
