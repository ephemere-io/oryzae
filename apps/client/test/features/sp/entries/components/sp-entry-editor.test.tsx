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

  it('問いが無いときは空状態を表示する', async () => {
    renderEditor(createMockApi(apiFetch));
    fireEvent.click(screen.getByRole('button', { name: /問い/ }));
    expect(await screen.findByText(/立てている問いがありません/)).toBeTruthy();
  });
});
