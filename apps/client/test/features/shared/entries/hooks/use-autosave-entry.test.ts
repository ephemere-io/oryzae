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

  it('debounce 経過後に save を呼ぶ', async () => {
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

  it('短い記録でも保存する（Issue #510: 10 文字未満が一度も保存されなかった）', async () => {
    const save = vi.fn().mockResolvedValue('e1');

    const { rerender } = renderHook(
      ({ body }) => useAutosaveEntry({ title: '', body, entryId: 'e1', save, enabled: true }),
      { initialProps: { body: '' } },
    );

    rerender({ body: '疲れた' });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });

    expect(save).toHaveBeenCalledWith('疲れた', 'e1', undefined);
  });

  it('同じ文字数の書き換えも保存する（Issue #510: 長さ差 0 で素通りしていた）', async () => {
    const save = vi.fn().mockResolvedValue('e1');

    const { rerender } = renderHook(
      ({ body }) => useAutosaveEntry({ title: '', body, entryId: 'e1', save, enabled: true }),
      { initialProps: { body: 'あいうえおかきくけこ' } },
    );

    rerender({ body: 'さしすせそたちつてと' });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });

    expect(save).toHaveBeenCalledWith('さしすせそたちつてと', 'e1', undefined);
  });

  it('タイトルだけの変更も保存する（Issue #510: 本文しか見ていなかった）', async () => {
    const save = vi.fn().mockResolvedValue('e1');

    const { rerender } = renderHook(
      ({ title }) => useAutosaveEntry({ title, body: '本文', entryId: 'e1', save, enabled: true }),
      { initialProps: { title: '' } },
    );

    rerender({ title: '朝の光' });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });

    expect(save).toHaveBeenCalledWith('朝の光\n本文', 'e1', undefined);
  });

  it('内容が変わっていなければ保存しない', async () => {
    const save = vi.fn().mockResolvedValue('e1');

    const { rerender } = renderHook(
      ({ body }) => useAutosaveEntry({ title: '', body, entryId: 'e1', save, enabled: true }),
      { initialProps: { body: '本文' } },
    );

    rerender({ body: '本文' });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });

    expect(save).not.toHaveBeenCalled();
  });

  it('空の内容では保存しない（何も書いていない状態でエントリを作らない）', async () => {
    const save = vi.fn().mockResolvedValue('id');

    renderHook(() =>
      useAutosaveEntry({ title: '   ', body: '   ', entryId: undefined, save, enabled: true }),
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });

    expect(save).not.toHaveBeenCalled();
  });

  it('enabled=false なら保存しない', async () => {
    const save = vi.fn().mockResolvedValue('id');

    const { rerender } = renderHook(
      ({ body }) => useAutosaveEntry({ title: '', body, entryId: 'e1', save, enabled: false }),
      { initialProps: { body: '' } },
    );

    rerender({ body: 'これは十分な長さの本文です' });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });

    expect(save).not.toHaveBeenCalled();
  });

  it('保存に成功したら onSaved に id と本文を渡す', async () => {
    const save = vi.fn().mockResolvedValue('created-id');
    const onSaved = vi.fn();

    const { rerender } = renderHook(
      ({ body }) =>
        useAutosaveEntry({ title: '', body, entryId: undefined, save, onSaved, enabled: true }),
      { initialProps: { body: '' } },
    );

    rerender({ body: 'これは十分な長さの本文です' });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });

    expect(onSaved).toHaveBeenCalledWith('created-id', 'これは十分な長さの本文です');
  });

  it('背景に回ったら debounce を待たずに書き出す（Issue #510: 離脱で消えていた）', async () => {
    const save = vi.fn().mockResolvedValue('e1');

    const { rerender } = renderHook(
      ({ body }) => useAutosaveEntry({ title: '', body, entryId: 'e1', save, enabled: true }),
      { initialProps: { body: '' } },
    );

    rerender({ body: '書きかけ' });

    // debounce の途中でアプリを背景に回す（モバイルでは日常的に起きる）。
    await act(async () => {
      Object.defineProperty(document, 'visibilityState', {
        value: 'hidden',
        configurable: true,
      });
      document.dispatchEvent(new Event('visibilitychange'));
      await Promise.resolve();
    });

    expect(save).toHaveBeenCalledWith('書きかけ', 'e1', undefined);

    Object.defineProperty(document, 'visibilityState', {
      value: 'visible',
      configurable: true,
    });
  });

  it('画面を離れるときに保留中の入力を書き出す', async () => {
    const save = vi.fn().mockResolvedValue('e1');

    const { rerender, unmount } = renderHook(
      ({ body }) => useAutosaveEntry({ title: '', body, entryId: 'e1', save, enabled: true }),
      { initialProps: { body: '' } },
    );

    rerender({ body: '書きかけ' });

    await act(async () => {
      unmount();
      await Promise.resolve();
    });

    expect(save).toHaveBeenCalledWith('書きかけ', 'e1', undefined);
  });

  it('同じ内容を二重に書かない（保存中の再入を防ぐ）', async () => {
    let resolveSave: ((id: string) => void) | null = null;
    const save = vi.fn(
      () =>
        new Promise<string>((resolve) => {
          resolveSave = resolve;
        }),
    );

    const { rerender } = renderHook(
      ({ body }) => useAutosaveEntry({ title: '', body, entryId: 'e1', save, enabled: true }),
      { initialProps: { body: '' } },
    );

    rerender({ body: '書きかけ' });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(save).toHaveBeenCalledTimes(1);

    // 保存が返る前に背景化しても、同じ内容をもう一度は投げない。
    await act(async () => {
      Object.defineProperty(document, 'visibilityState', {
        value: 'hidden',
        configurable: true,
      });
      document.dispatchEvent(new Event('visibilitychange'));
      await Promise.resolve();
    });
    expect(save).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveSave?.('e1');
      await Promise.resolve();
    });

    Object.defineProperty(document, 'visibilityState', {
      value: 'visible',
      configurable: true,
    });
  });
});
