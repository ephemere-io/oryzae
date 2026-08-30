import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAutosaveEntry } from '@/features/shared/entries/hooks/use-autosave-entry';

/**
 * Issue #510: 保存ボタンが無い（SP には元から無く、PC も原則2で廃した）ので、
 * 「書いたものが必ず残る」ことはこの hook だけが保証する。
 *
 * 旧実装は「本文の**文字数の増減**が10文字以上」を保存条件にしていたため、
 * タイトルのみの変更・短い追記・同じ長さの書き換えが保存されなかった。
 * ここではその取りこぼしが再発しないことを主に見張る。
 */
describe('useAutosaveEntry', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function setup(
    save: ReturnType<typeof vi.fn>,
    initial: { title?: string; body: string },
    entryId?: string,
  ) {
    return renderHook(
      ({ title, body }) => useAutosaveEntry({ title, body, entryId, save, enabled: true }),
      { initialProps: { title: initial.title ?? '', body: initial.body } },
    );
  }

  async function tick(ms = 2000) {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(ms);
    });
  }

  it('debounce 経過後に本文の変更を保存する', async () => {
    const save = vi.fn().mockResolvedValue('new-id');
    const { rerender } = setup(save, { body: '' });

    rerender({ title: '', body: 'これは十分な長さの本文です' });
    await tick();

    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith('これは十分な長さの本文です', undefined);
  });

  // regression #510-1
  it('既存エントリならタイトルだけの変更も保存する（本文しか見ていなかった）', async () => {
    const save = vi.fn().mockResolvedValue('e1');
    const { rerender } = setup(save, { title: '', body: '本文はそのまま' }, 'e1');

    rerender({ title: 'あとから付けた題', body: '本文はそのまま' });
    await tick();

    expect(save).toHaveBeenCalledWith('あとから付けた題\n本文はそのまま', 'e1');
  });

  // regression #510-2
  it('既存エントリなら10文字未満の追記も保存する（末尾の数文字が消えない）', async () => {
    const save = vi.fn().mockResolvedValue('e1');
    const { rerender } = setup(save, { body: 'original content' }, 'e1');

    rerender({ title: '', body: 'original contentX' }); // +1 文字
    await tick(3000);

    expect(save).toHaveBeenCalledWith('original contentX', 'e1');
  });

  // regression #510-2b: 短い記録そのもの（既存エントリの更新として）
  it('既存エントリなら短い記録も保存する（「今日は疲れた」で終えても残る）', async () => {
    const save = vi.fn().mockResolvedValue('e1');
    const { rerender } = setup(save, { body: 'x' }, 'e1');

    rerender({ title: '', body: '今日は疲れた' });
    await tick();

    expect(save).toHaveBeenCalledWith('今日は疲れた', 'e1');
  });

  // regression #510-3
  it('既存エントリなら長さが変わらない書き換えも保存する（差が0で素通りしていた）', async () => {
    const save = vi.fn().mockResolvedValue('e1');
    const { rerender } = setup(save, { body: 'あいうえお' }, 'e1');

    rerender({ title: '', body: 'あいうえを' }); // 長さは同じ
    await tick(3000);

    expect(save).toHaveBeenCalledWith('あいうえを', 'e1');
  });

  it('内容が変わっていなければ保存しない（開いただけで PUT しない）', async () => {
    const save = vi.fn().mockResolvedValue('e1');
    const { rerender } = setup(save, { title: '題', body: '本文' }, 'e1');

    rerender({ title: '題', body: '本文' });
    await tick(5000);

    expect(save).not.toHaveBeenCalled();
  });

  it('新規はしきい値未満だとエントリを作らない（打ち間違いでエントリが生えない）', async () => {
    const save = vi.fn().mockResolvedValue('id');
    const { rerender } = setup(save, { body: '' });

    rerender({ title: '', body: 'あ' });
    await tick(5000);

    expect(save).not.toHaveBeenCalled();
  });

  it('body が空白のみなら save を呼ばない', async () => {
    const save = vi.fn();
    const { rerender } = setup(save, { body: '' });

    rerender({ title: '', body: '          ' });
    await tick(3000);

    expect(save).not.toHaveBeenCalled();
  });

  it('title がある場合は title\\nbody 形式で保存する', async () => {
    const save = vi.fn().mockResolvedValue('id');
    const { rerender } = setup(save, { title: 'マイタイトル', body: '' }, 'e1');

    rerender({ title: 'マイタイトル', body: '本文は十分長いテキストである' });
    await tick();

    expect(save).toHaveBeenCalledWith('マイタイトル\n本文は十分長いテキストである', 'e1');
  });

  it('enabled=false なら save を呼ばない', async () => {
    const save = vi.fn();
    const { rerender } = renderHook(
      ({ body }) => useAutosaveEntry({ title: '', body, entryId: undefined, save, enabled: false }),
      { initialProps: { body: '' } },
    );

    rerender({ body: '十分な長さのテキストです' });
    await tick(3000);

    expect(save).not.toHaveBeenCalled();
  });

  it('連続編集時はデバウンスで最後の1回だけ save する', async () => {
    const save = vi.fn().mockResolvedValue('id');
    const { rerender } = setup(save, { body: '' });

    rerender({ title: '', body: '十分な長さの1つ目' });
    await tick(1000);
    rerender({ title: '', body: '十分な長さの1つ目と2つ目' });
    await tick(1000);
    rerender({ title: '', body: '十分な長さの1つ目と2つ目と3つ目' });
    await tick(2000);

    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith('十分な長さの1つ目と2つ目と3つ目', undefined);
  });

  it('onSaved には entryId・本文・trim 済みタイトルが渡る', async () => {
    const save = vi.fn().mockResolvedValue('created-id');
    const onSaved = vi.fn();
    const { rerender } = renderHook(
      ({ title, body }) =>
        useAutosaveEntry({ title, body, entryId: undefined, save, onSaved, enabled: true }),
      { initialProps: { title: '', body: '' } },
    );

    rerender({ title: '  題  ', body: '十分な長さの本文です' });
    await tick();

    expect(onSaved).toHaveBeenCalledWith('created-id', '十分な長さの本文です', '題');
  });

  // regression #510-4: デバウンス待ちのまま画面を離れる経路
  it('タブが隠れたら、デバウンス待ちの内容を即座に保存する', async () => {
    const save = vi.fn().mockResolvedValue('e1');
    const { rerender } = setup(save, { body: 'original' }, 'e1');

    rerender({ title: '', body: 'original+追記' });
    // デバウンスが切れる前にバックグラウンドへ
    vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
      await Promise.resolve();
    });

    expect(save).toHaveBeenCalledWith('original+追記', 'e1');
  });

  it('ページを離れるとき（pagehide）も保留中の入力を書き出す', async () => {
    const save = vi.fn().mockResolvedValue('e1');
    const { rerender } = setup(save, { body: 'original' }, 'e1');

    rerender({ title: '', body: 'original+離脱直前' });
    await act(async () => {
      window.dispatchEvent(new Event('pagehide'));
      await Promise.resolve();
    });

    expect(save).toHaveBeenCalledWith('original+離脱直前', 'e1');
  });

  it('アンマウント時も、デバウンス待ちの内容を保存する', async () => {
    const save = vi.fn().mockResolvedValue('e1');
    const { rerender, unmount } = setup(save, { body: 'original' }, 'e1');

    rerender({ title: '', body: 'original+離脱直前の追記' });
    await act(async () => {
      unmount();
      await Promise.resolve();
    });

    expect(save).toHaveBeenCalledWith('original+離脱直前の追記', 'e1');
  });

  it('保存中に届いた変更は、保存完了後に追いかけて保存する（同じ内容は二重に書かない）', async () => {
    let resolveFirst: (v: string) => void = () => {};
    const save = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<string>((resolve) => {
            resolveFirst = resolve;
          }),
      )
      .mockResolvedValue('e1');
    const { rerender } = setup(save, { body: 'original' }, 'e1');

    rerender({ title: '', body: 'original+1回目の追記' });
    await tick(); // 1回目の save が始まり、pending のまま
    expect(save).toHaveBeenCalledTimes(1);

    rerender({ title: '', body: 'original+1回目の追記+2回目' });
    await act(async () => {
      resolveFirst('e1');
      await Promise.resolve();
    });
    await tick();

    expect(save).toHaveBeenCalledTimes(2);
    expect(save).toHaveBeenLastCalledWith('original+1回目の追記+2回目', 'e1');
  });
});
