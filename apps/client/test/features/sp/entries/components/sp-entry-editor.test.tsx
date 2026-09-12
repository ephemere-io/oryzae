import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SpEntryEditor } from '@/features/sp/entries/components/sp-entry-editor';
import jaMessages from '@/i18n/messages/ja.json';
import type { ApiClient } from '@/lib/api';

// 削除後の一覧遷移で useRouter を使う（#363 SP 削除フロー）。jsdom には Next ランタイムが
// 無いので no-op の router をモックする。
const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

function createMockApi(fetchImpl: ReturnType<typeof vi.fn>): ApiClient {
  return { baseUrl: '', headers: {}, fetch: fetchImpl };
}

function jsonResponse(body: unknown, ok = true): Response {
  // @type-assertion-allowed: テスト用の最小限 Response スタブ
  return { ok, status: ok ? 200 : 400, json: () => Promise.resolve(body) } as Response;
}

function renderEditor(api: ApiClient) {
  return render(
    <NextIntlClientProvider locale="ja" messages={jaMessages}>
      <SpEntryEditor api={api} />
    </NextIntlClientProvider>,
  );
}

describe('SpEntryEditor', () => {
  let apiFetch: ReturnType<typeof vi.fn>;

  afterEach(cleanup);

  beforeEach(() => {
    vi.clearAllMocks();
    apiFetch = vi.fn().mockResolvedValue(jsonResponse([]));
  });

  it('タイトルと本文のプレースホルダを表示する', () => {
    renderEditor(createMockApi(apiFetch));
    expect(screen.getByPlaceholderText('タイトル（任意）')).toBeTruthy();
    expect(screen.getByPlaceholderText('いま感じていることを、そのまま。')).toBeTruthy();
  });

  it('保存前は発酵 CTA（納める）を出さない（entryId 未確定）', () => {
    renderEditor(createMockApi(apiFetch));
    expect(screen.queryByRole('button', { name: '納める' })).toBeNull();
  });

  it('問いが結ばれていなければ「納める」は問い選択を開く（Issue #450）', async () => {
    // 問いに紐づかないエントリは発酵ループに入らない（active な問いに紐づいたものだけを
    // 走査する）。そのまま漬けられると「漬けたのに何も届かない」になる。
    const fetchImpl = vi.fn((url: string) => {
      if (url === '/api/v1/questions')
        return Promise.resolve(jsonResponse([{ id: 'q1', currentText: 'なぜ続けるのか' }]));
      return Promise.resolve(jsonResponse([]));
    });

    render(
      <NextIntlClientProvider locale="ja" messages={jaMessages}>
        <SpEntryEditor api={createMockApi(fetchImpl)} initialEntryId="e1" initialContent="本文" />
      </NextIntlClientProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: jaMessages.sp.editor.ferment_title }));

    // 発酵フラグ付きの保存は投げず、問い選択シートを開く。
    await waitFor(() => expect(screen.getByText('なぜ続けるのか')).toBeTruthy());
    expect(fetchImpl).not.toHaveBeenCalledWith(
      '/api/v1/entries/e1',
      expect.objectContaining({ method: 'PATCH' }),
    );
  });

  it('一覧から既存エントリを開くと、紐づいている問いをチップに復元する（Issue #448）', async () => {
    // 旧実装は URL の questionId と復元ドラフトしか見ておらず、サーバの紐付けを無視して
    // いたため「+ 問いを結ぶ」のまま出ていた。
    const fetchImpl = vi.fn((url: string) => {
      if (url === '/api/v1/entries/e1/questions')
        return Promise.resolve(jsonResponse([{ id: 'q1', currentText: 'なぜ続けるのか' }]));
      return Promise.resolve(jsonResponse([]));
    });

    render(
      <NextIntlClientProvider locale="ja" messages={jaMessages}>
        <SpEntryEditor
          api={createMockApi(fetchImpl)}
          initialEntryId="e1"
          initialContent={'既存タイトル\n既存の本文'}
        />
      </NextIntlClientProvider>,
    );

    expect(await screen.findByText('◦ なぜ続けるのか')).toBeTruthy();
    // 既に紐づいているので、復元だけで POST は投げ直さない。
    expect(fetchImpl).not.toHaveBeenCalledWith(
      '/api/v1/entries/e1/questions/q1',
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('紐づいた問いが終了（アーカイブ）済みでもチップに出る', async () => {
    // activeQuestions（/questions）には載らないので、紐付け側から引けないと消えてしまう。
    const fetchImpl = vi.fn((url: string) => {
      if (url === '/api/v1/entries/e1/questions')
        return Promise.resolve(jsonResponse([{ id: 'archived', currentText: '終えた問い' }]));
      return Promise.resolve(jsonResponse([]));
    });

    render(
      <NextIntlClientProvider locale="ja" messages={jaMessages}>
        <SpEntryEditor api={createMockApi(fetchImpl)} initialEntryId="e1" initialContent={'本文'} />
      </NextIntlClientProvider>,
    );

    expect(await screen.findByText('◦ 終えた問い')).toBeTruthy();
  });

  it('URL の questionId が優先され、サーバの紐付けで上書きされない', async () => {
    const fetchImpl = vi.fn((url: string) => {
      if (url === '/api/v1/questions')
        return Promise.resolve(jsonResponse([{ id: 'fromUrl', currentText: 'URL の問い' }]));
      if (url === '/api/v1/entries/e1/questions')
        return Promise.resolve(jsonResponse([{ id: 'q1', currentText: 'サーバの問い' }]));
      return Promise.resolve(jsonResponse([]));
    });

    render(
      <NextIntlClientProvider locale="ja" messages={jaMessages}>
        <SpEntryEditor
          api={createMockApi(fetchImpl)}
          initialEntryId="e1"
          initialQuestionId="fromUrl"
          initialContent={'本文'}
        />
      </NextIntlClientProvider>,
    );

    expect(await screen.findByText('◦ URL の問い')).toBeTruthy();
    expect(screen.queryByText('◦ サーバの問い')).toBeNull();
  });

  it('既存エントリを開くとタイトル・本文が埋まる（編集）', () => {
    render(
      <NextIntlClientProvider locale="ja" messages={jaMessages}>
        <SpEntryEditor
          api={createMockApi(apiFetch)}
          initialEntryId="e1"
          initialContent={'既存タイトル\n既存の本文'}
        />
      </NextIntlClientProvider>,
    );
    expect(screen.getByDisplayValue('既存タイトル')).toBeTruthy();
    expect(screen.getByDisplayValue('既存の本文')).toBeTruthy();
  });

  it('問いシートに active questions を表示し、選ぶとチップに反映する', async () => {
    apiFetch.mockImplementation((url: string) =>
      Promise.resolve(
        jsonResponse(
          url === '/api/v1/questions' ? [{ id: 'q1', currentText: 'なぜ書くのか' }] : [],
        ),
      ),
    );
    renderEditor(createMockApi(apiFetch));

    fireEvent.click(screen.getByRole('button', { name: /問い/ }));
    const questionItem = await screen.findByRole('button', { name: 'なぜ書くのか' });
    fireEvent.click(questionItem);

    // 選択後、チップに「◦ なぜ書くのか」と反映される（シートは閉じる）
    await waitFor(() => expect(screen.getByRole('button', { name: /なぜ書くのか/ })).toBeTruthy());
  });

  /** 紐づけ済みの問いが 1 つ（q1）、選べる問いが 2 つ（q1 / q2）ある既存エントリ。 */
  function linkedApi(): ReturnType<typeof vi.fn> {
    return vi.fn((url: string) => {
      if (url === '/api/v1/questions')
        return Promise.resolve(
          jsonResponse([
            { id: 'q1', currentText: 'なぜ続けるのか' },
            { id: 'q2', currentText: '手放せないものは何か' },
          ]),
        );
      if (url === '/api/v1/entries/e1/questions')
        return Promise.resolve(jsonResponse([{ id: 'q1', currentText: 'なぜ続けるのか' }]));
      return Promise.resolve(jsonResponse([]));
    });
  }

  it('問いを付け替えると、前の紐づけを外してから次を結ぶ', async () => {
    // 旧実装は選択を差し替えるだけで DELETE を投げず、サーバーには両方が紐づいたまま
    // チップには 1 つしか出なかった（PC は unlink を持っている）。
    const fetchImpl = linkedApi();
    render(
      <NextIntlClientProvider locale="ja" messages={jaMessages}>
        <SpEntryEditor api={createMockApi(fetchImpl)} initialEntryId="e1" initialContent="本文" />
      </NextIntlClientProvider>,
    );
    fireEvent.click(await screen.findByRole('button', { name: '◦ なぜ続けるのか' }));
    fireEvent.click(await screen.findByRole('button', { name: '手放せないものは何か' }));

    await waitFor(() =>
      expect(fetchImpl).toHaveBeenCalledWith(
        '/api/v1/entries/e1/questions/q1',
        expect.objectContaining({ method: 'DELETE' }),
      ),
    );
    await waitFor(() =>
      expect(fetchImpl).toHaveBeenCalledWith(
        '/api/v1/entries/e1/questions/q2',
        expect.objectContaining({ method: 'POST' }),
      ),
    );
    expect(await screen.findByText('◦ 手放せないものは何か')).toBeTruthy();
  });

  it('選んでいる問いをもう一度押すと外れ、紐づけも解除される', async () => {
    const fetchImpl = linkedApi();
    render(
      <NextIntlClientProvider locale="ja" messages={jaMessages}>
        <SpEntryEditor api={createMockApi(fetchImpl)} initialEntryId="e1" initialContent="本文" />
      </NextIntlClientProvider>,
    );
    fireEvent.click(await screen.findByRole('button', { name: '◦ なぜ続けるのか' }));
    // シートの中の「選んでいる」行（チップと同じ文言なので pressed で見分ける）。
    fireEvent.click(await screen.findByRole('button', { name: /なぜ続けるのか/, pressed: true }));

    await waitFor(() =>
      expect(fetchImpl).toHaveBeenCalledWith(
        '/api/v1/entries/e1/questions/q1',
        expect.objectContaining({ method: 'DELETE' }),
      ),
    );
    expect(await screen.findByText(`+ ${jaMessages.sp.editor.question_link}`)).toBeTruthy();
  });

  it('問いが無いときは空状態を表示する', async () => {
    renderEditor(createMockApi(apiFetch));
    fireEvent.click(screen.getByRole('button', { name: /問い/ }));
    expect(await screen.findByText(/立てている問いがありません/)).toBeTruthy();
  });
  it('問いがゼロでも「納める」から問いをその場で立てられる（Issue #314）', async () => {
    // 旧実装は空のとき「立てている問いがありません」を出すだけで、問いを作る導線が
    // 無かった。問いを全て終了したユーザーは、書いても漬けられない状態に陥っていた。
    const fetchImpl = vi.fn((url: string, init?: RequestInit) => {
      if (url === '/api/v1/questions' && init?.method === 'POST')
        return Promise.resolve(jsonResponse({ id: 'new-q' }));
      return Promise.resolve(jsonResponse([]));
    });

    render(
      <NextIntlClientProvider locale="ja" messages={jaMessages}>
        <SpEntryEditor api={createMockApi(fetchImpl)} initialEntryId="e1" initialContent="本文" />
      </NextIntlClientProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: jaMessages.sp.editor.ferment_title }));

    // 行き止まりではなく、その場で書く入力欄が出る。
    const input = await screen.findByPlaceholderText(jaMessages.sp.editor.question_new_placeholder);
    fireEvent.change(input, { target: { value: '今日は何に驚いたか' } });
    fireEvent.click(screen.getByRole('button', { name: jaMessages.sp.editor.question_create }));

    // 作った問いが即チップに出る（作りたては /questions にも紐付けにも載らないため、
    // ローカルに覚えていないと「+ 問いを結ぶ」に戻って見える）。
    expect(await screen.findByText('◦ 今日は何に驚いたか')).toBeTruthy();
    expect(fetchImpl).toHaveBeenCalledWith(
      '/api/v1/questions',
      expect.objectContaining({ method: 'POST' }),
    );
    // 作った問いはエントリにも紐づく（紐づかないと発酵ループに入らない）。
    await waitFor(() =>
      expect(fetchImpl).toHaveBeenCalledWith(
        '/api/v1/entries/e1/questions/new-q',
        expect.objectContaining({ method: 'POST' }),
      ),
    );
  });

  it('問いの作成に失敗したらエラーを出し、シートを閉じない（Issue #314）', async () => {
    const fetchImpl = vi.fn((url: string, init?: RequestInit) => {
      if (url === '/api/v1/questions' && init?.method === 'POST')
        return Promise.resolve(jsonResponse({}, false));
      return Promise.resolve(jsonResponse([]));
    });

    render(
      <NextIntlClientProvider locale="ja" messages={jaMessages}>
        <SpEntryEditor api={createMockApi(fetchImpl)} initialEntryId="e1" initialContent="本文" />
      </NextIntlClientProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: jaMessages.sp.editor.ferment_title }));
    const input = await screen.findByPlaceholderText(jaMessages.sp.editor.question_new_placeholder);
    fireEvent.change(input, { target: { value: '通らない問い' } });
    fireEvent.click(screen.getByRole('button', { name: jaMessages.sp.editor.question_create }));

    expect(await screen.findByText(jaMessages.sp.editor.question_create_failed)).toBeTruthy();
    // 書いた内容を失わないよう入力欄は残す。
    expect(screen.getByPlaceholderText(jaMessages.sp.editor.question_new_placeholder)).toBeTruthy();
  });

  it('問いの取得が遅れてシートを先に開いても、届いたら一覧に切り替わる（Issue #314）', async () => {
    // モードを「開いた時点の件数」で固定すると、選べる問いがあるのに入力欄のままになる。
    let resolveQuestions: ((res: Response) => void) | undefined;
    const fetchImpl = vi.fn((url: string) => {
      if (url === '/api/v1/questions')
        return new Promise<Response>((resolve) => {
          resolveQuestions = resolve;
        });
      return Promise.resolve(jsonResponse([]));
    });

    render(
      <NextIntlClientProvider locale="ja" messages={jaMessages}>
        <SpEntryEditor api={createMockApi(fetchImpl)} initialEntryId="e1" initialContent="本文" />
      </NextIntlClientProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: jaMessages.sp.editor.ferment_title }));
    expect(
      await screen.findByPlaceholderText(jaMessages.sp.editor.question_new_placeholder),
    ).toBeTruthy();

    resolveQuestions?.(jsonResponse([{ id: 'q1', currentText: '後から届いた問い' }]));

    expect(await screen.findByText('後から届いた問い')).toBeTruthy();
    expect(screen.queryByPlaceholderText(jaMessages.sp.editor.question_new_placeholder)).toBeNull();
  });
});
