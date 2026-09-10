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

  /** entryId が変化する再レンダーを書くための props 型（`as` を使わずに undefined を許す）。 */
  interface SwitchableProps {
    entryId: string | undefined;
    body: string;
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
    expect(save).toHaveBeenCalledWith('これは十分な長さの本文です', undefined, undefined);
  });

  // regression #510-1
  it('既存エントリならタイトルだけの変更も保存する（本文しか見ていなかった）', async () => {
    const save = vi.fn().mockResolvedValue('e1');
    const { rerender } = setup(save, { title: '', body: '本文はそのまま' }, 'e1');

    rerender({ title: 'あとから付けた題', body: '本文はそのまま' });
    await tick();

    expect(save).toHaveBeenCalledWith('あとから付けた題\n本文はそのまま', 'e1', undefined);
  });

  // regression #510-2
  it('既存エントリなら10文字未満の追記も保存する（末尾の数文字が消えない）', async () => {
    const save = vi.fn().mockResolvedValue('e1');
    const { rerender } = setup(save, { body: 'original content' }, 'e1');

    rerender({ title: '', body: 'original contentX' }); // +1 文字
    await tick(3000);

    expect(save).toHaveBeenCalledWith('original contentX', 'e1', undefined);
  });

  // regression #510-2b: 短い記録そのもの（既存エントリの更新として）
  it('既存エントリなら短い記録も保存する（「今日は疲れた」で終えても残る）', async () => {
    const save = vi.fn().mockResolvedValue('e1');
    const { rerender } = setup(save, { body: 'x' }, 'e1');

    rerender({ title: '', body: '今日は疲れた' });
    await tick();

    expect(save).toHaveBeenCalledWith('今日は疲れた', 'e1', undefined);
  });

  // regression #510-3
  it('既存エントリなら長さが変わらない書き換えも保存する（差が0で素通りしていた）', async () => {
    const save = vi.fn().mockResolvedValue('e1');
    const { rerender } = setup(save, { body: 'あいうえお' }, 'e1');

    rerender({ title: '', body: 'あいうえを' }); // 長さは同じ
    await tick(3000);

    expect(save).toHaveBeenCalledWith('あいうえを', 'e1', undefined);
  });

  /** rerender の initialProps に型を与えるための空配列（`as` を使わずに string[] にする）。 */
  const EMPTY_MEDIA_URLS: string[] = [];

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
    await tick(3000);

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
      { initialProps: { mediaUrls: EMPTY_MEDIA_URLS } },
    );

    rerender({ mediaUrls: ['https://cdn.example/a.jpg'] });
    await tick(3000);

    expect(save).not.toHaveBeenCalled();
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

  it('本文が空でもタイトルだけの新規は保存する（題を付けただけの状態を捨てない）', async () => {
    const save = vi.fn().mockResolvedValue('new-id');
    const { rerender } = setup(save, { body: '' });

    rerender({ title: '会えなかった日', body: '' });
    await tick();

    expect(save).toHaveBeenCalledWith('会えなかった日\n', undefined, undefined);
  });

  it('新規でも短い記録は保存する（「今日は疲れた」で終える人が消えない）', async () => {
    const save = vi.fn().mockResolvedValue('new-id');
    const { rerender } = setup(save, { body: '' });

    rerender({ title: '', body: '今日は疲れた' });
    await tick();

    expect(save).toHaveBeenCalledWith('今日は疲れた', undefined, undefined);
  });

  it('api の解決（enabled false→true）では強制保存が走らない', async () => {
    // enabled=false の回は effect が cleanup を返さないので、有効化しても離脱扱いにならない。
    // ここが崩れると「打ちかけの1文字で新規エントリが生える」ことになるので固定しておく。
    const save = vi.fn().mockResolvedValue('id');
    const { rerender } = renderHook(
      ({ enabled, body }) =>
        useAutosaveEntry({ title: '', body, entryId: undefined, save, enabled }),
      { initialProps: { enabled: false, body: 'あ' } },
    );

    await act(async () => {
      rerender({ enabled: true, body: 'あ' });
      await Promise.resolve();
    });

    expect(save).not.toHaveBeenCalled();
  });

  it('離脱時はしきい値を無視して書き出す（未確定でも書いたものは残す）', async () => {
    const save = vi.fn().mockResolvedValue('new-id');
    const { rerender } = setup(save, { body: '' });

    // しきい値未満のまま画面を離れる。捨てるのは「書いたものを失う」のと同じ。
    rerender({ title: '', body: 'あ' });
    await act(async () => {
      window.dispatchEvent(new Event('pagehide'));
      await Promise.resolve();
    });

    expect(save).toHaveBeenCalledWith('あ', undefined, undefined);
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

    expect(save).toHaveBeenCalledWith(
      'マイタイトル\n本文は十分長いテキストである',
      'e1',
      undefined,
    );
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
    expect(save).toHaveBeenCalledWith('十分な長さの1つ目と2つ目と3つ目', undefined, undefined);
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

    expect(save).toHaveBeenCalledWith('original+追記', 'e1', undefined);
  });

  it('ページを離れるとき（pagehide）も保留中の入力を書き出す', async () => {
    const save = vi.fn().mockResolvedValue('e1');
    const { rerender } = setup(save, { body: 'original' }, 'e1');

    rerender({ title: '', body: 'original+離脱直前' });
    await act(async () => {
      window.dispatchEvent(new Event('pagehide'));
      await Promise.resolve();
    });

    expect(save).toHaveBeenCalledWith('original+離脱直前', 'e1', undefined);
  });

  it('アンマウント時も、デバウンス待ちの内容を保存する', async () => {
    const save = vi.fn().mockResolvedValue('e1');
    const { rerender, unmount } = setup(save, { body: 'original' }, 'e1');

    rerender({ title: '', body: 'original+離脱直前の追記' });
    await act(async () => {
      unmount();
      await Promise.resolve();
    });

    expect(save).toHaveBeenCalledWith('original+離脱直前の追記', 'e1', undefined);
  });

  // entryId は「呼び出し側が保存結果を返してくる」前提で動く。hook は自分が作った id を
  // 覚えるが、次の保存の宛先は props の entryId なので、返ってこないと二重に作られる。
  // 逆に別のエントリへ切り替わったときは、前の本文を新しい id に書いてはいけない。
  it('自分が作った id が返ってきたら、次は作り直さずその id を更新する', async () => {
    const save = vi.fn().mockResolvedValue('A');
    const initialProps: SwitchableProps = { entryId: undefined, body: '' };
    const { rerender } = renderHook(
      ({ entryId, body }: SwitchableProps) =>
        useAutosaveEntry({ title: '', body, entryId, save, enabled: true }),
      { initialProps },
    );

    rerender({ entryId: undefined, body: '最初の本文' });
    await tick();
    expect(save).toHaveBeenLastCalledWith('最初の本文', undefined, undefined);

    // 呼び出し側が onSaved で受け取った id を返してくる。
    rerender({ entryId: 'A', body: '最初の本文' });
    rerender({ entryId: 'A', body: '最初の本文と続き' });
    await tick();

    expect(save).toHaveBeenLastCalledWith('最初の本文と続き', 'A', undefined);
    expect(save).toHaveBeenCalledTimes(2);
  });

  it('別のエントリに切り替わったら、前の本文を新しい id に書かない', async () => {
    const save = vi.fn().mockResolvedValue('B');
    const initialProps: SwitchableProps = { entryId: 'A', body: 'Aの本文' };
    const { rerender } = renderHook(
      ({ entryId, body }: SwitchableProps) =>
        useAutosaveEntry({ title: '', body, entryId, save, enabled: true }),
      { initialProps },
    );

    // 切り替え: id も本文も同時に差し替わる（一覧から別のエントリを開いた状況）。
    rerender({ entryId: 'B', body: 'Bの本文' });
    await tick(5000);

    expect(save).not.toHaveBeenCalled();
  });

  // 保存が失敗しても lastSavedContent は前のままなので、「まだ差がある」判定が真に居座る。
  // 離脱時はその場で呼び直す作りなので、抜け道が無いと同じ内容を無限に送り続ける。
  it('保存が失敗しても、同じ内容を送り続けない（離脱時）', async () => {
    const save = vi.fn().mockResolvedValue(null);
    const { rerender } = setup(save, { body: 'original' }, 'e1');

    rerender({ title: '', body: 'original+書いた分' });
    await act(async () => {
      window.dispatchEvent(new Event('pagehide'));
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(save).toHaveBeenCalledTimes(1);
  });

  it('保存が例外で落ちても、そこで止まる（未処理の rejection にしない）', async () => {
    const save = vi.fn().mockRejectedValue(new Error('network down'));
    const { rerender } = setup(save, { body: 'original' }, 'e1');

    rerender({ title: '', body: 'original+書いた分' });
    await act(async () => {
      window.dispatchEvent(new Event('pagehide'));
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(save).toHaveBeenCalledTimes(1);
  });

  it('保存中に離脱しても、保存中に打った分を書き出す（追いかけ保存は離脱後に発火しない）', async () => {
    let resolveFirst: (v: string) => void = () => {};
    const save = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<string>((r) => {
            resolveFirst = r;
          }),
      )
      .mockResolvedValue('e1');
    const { rerender } = setup(save, { body: 'original' }, 'e1');

    // 1回目の保存を走らせる（まだ解決しない＝通信中）。
    rerender({ title: '', body: 'original+1回目' });
    await tick();
    expect(save).toHaveBeenCalledTimes(1);

    // 通信中にさらに書き、そのまま画面を離れる。
    rerender({ title: '', body: 'original+1回目+通信中に打った分' });
    await act(async () => {
      window.dispatchEvent(new Event('pagehide'));
      resolveFirst('e1');
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(save).toHaveBeenCalledTimes(2);
    expect(save).toHaveBeenLastCalledWith('original+1回目+通信中に打った分', 'e1', undefined);
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
    expect(save).toHaveBeenLastCalledWith('original+1回目の追記+2回目', 'e1', undefined);
  });
});
