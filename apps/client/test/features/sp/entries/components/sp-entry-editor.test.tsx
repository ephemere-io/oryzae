import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SpEntryEditor } from '@/features/sp/entries/components/sp-entry-editor';
import jaMessages from '@/i18n/messages/ja.json';
import type { ApiClient } from '@/lib/api';

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

  it('保存前は「瓶に漬ける」を出さない（entryId 未確定）', () => {
    renderEditor(createMockApi(apiFetch));
    expect(screen.queryByRole('button', { name: '瓶に漬ける' })).toBeNull();
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

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /問い: なぜ書くのか/ })).toBeTruthy(),
    );
  });

  it('問いが無いときは空状態を表示する', async () => {
    renderEditor(createMockApi(apiFetch));
    fireEvent.click(screen.getByRole('button', { name: /問い/ }));
    expect(await screen.findByText(/立てている問いがありません/)).toBeTruthy();
  });
});
