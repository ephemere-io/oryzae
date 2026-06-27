import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SpEntryList } from '@/features/sp/entries/components/sp-entry-list';
import jaMessages from '@/i18n/messages/ja.json';
import type { ApiClient } from '@/lib/api';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));

function createMockApi(fetchImpl: ReturnType<typeof vi.fn>): ApiClient {
  return { baseUrl: '', headers: {}, fetch: fetchImpl };
}

function jsonResponse(body: unknown, ok = true): Response {
  // @type-assertion-allowed: テスト用の最小限 Response スタブ
  return { ok, status: ok ? 200 : 400, json: () => Promise.resolve(body) } as Response;
}

function entry(id: string, content: string) {
  return {
    id,
    userId: 'u',
    content,
    mediaUrls: [],
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
    linkedQuestions: [],
  };
}

function renderList(api: ApiClient) {
  return render(
    <NextIntlClientProvider locale="ja" messages={jaMessages}>
      <SpEntryList api={api} />
    </NextIntlClientProvider>,
  );
}

describe('SpEntryList', () => {
  afterEach(cleanup);
  beforeEach(() => vi.clearAllMocks());

  it('エントリ一覧を表示する（先頭行をタイトルに）', async () => {
    const fetchImpl = vi.fn(() =>
      Promise.resolve(jsonResponse([entry('e1', '今日のタイトル\n本文')])),
    );
    renderList(createMockApi(fetchImpl));
    expect(await screen.findByText('今日のタイトル')).toBeTruthy();
  });

  it('エントリが無ければ空表示', async () => {
    const fetchImpl = vi.fn(() => Promise.resolve(jsonResponse([])));
    renderList(createMockApi(fetchImpl));
    expect(await screen.findByText('まだエントリがありません')).toBeTruthy();
  });

  it('タップで詳細(/entries/[id])へ遷移する', async () => {
    const fetchImpl = vi.fn(() => Promise.resolve(jsonResponse([entry('e1', 'タイトル\n本文')])));
    renderList(createMockApi(fetchImpl));
    fireEvent.click(await screen.findByText('タイトル'));
    expect(push).toHaveBeenCalledWith('/entries/e1');
  });
});
