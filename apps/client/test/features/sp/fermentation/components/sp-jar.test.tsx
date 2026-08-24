import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SpJar } from '@/features/sp/fermentation/components/sp-jar';
import jaMessages from '@/i18n/messages/ja.json';
import type { ApiClient } from '@/lib/api';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

function createMockApi(fetchImpl: ReturnType<typeof vi.fn>): ApiClient {
  return { baseUrl: '', headers: {}, fetch: fetchImpl };
}

function jsonResponse(body: unknown, ok = true): Response {
  // @type-assertion-allowed: テスト用の最小限 Response スタブ
  return { ok, status: ok ? 200 : 400, json: () => Promise.resolve(body) } as Response;
}

function renderJar(api: ApiClient) {
  return render(
    <NextIntlClientProvider locale="ja" messages={jaMessages}>
      <SpJar api={api} />
    </NextIntlClientProvider>,
  );
}

const completedFermentation = [
  { id: 'f1', questionId: 'q1', status: 'completed', createdAt: '2024-02-01T00:00:00Z' },
];

/**
 * GET /api/v1/fermentations/:id の実レスポンス形（apps/server の fermentations ルート）。
 * Issue #490 で共有 hook が正規化するようになり、id / questionId を欠くレスポンスは
 * null に落ちる。スタブも実形に合わせる。
 */
function detailJson(overrides: Record<string, unknown>): Record<string, unknown> {
  return {
    id: 'f1',
    questionId: 'q1',
    targetPeriod: '2024-02',
    status: 'completed',
    worksheet: null,
    letter: { id: 'l1', bodyText: '過去のあなたより。', jarX: null, jarY: null },
    keywords: [],
    snippets: [],
    ...overrides,
  };
}

describe('SpJar', () => {
  afterEach(cleanup);
  beforeEach(() => vi.clearAllMocks());

  it('受信箱に届いた手紙（問い）を表示する', async () => {
    const fetchImpl = vi.fn((url: string) => {
      if (url === '/api/v1/questions')
        return Promise.resolve(jsonResponse([{ id: 'q1', currentText: 'なぜ続けるのか' }]));
      if (url === '/api/v1/fermentations')
        return Promise.resolve(jsonResponse(completedFermentation));
      return Promise.resolve(jsonResponse({}));
    });
    renderJar(createMockApi(fetchImpl));
    expect(await screen.findByText('なぜ続けるのか')).toBeTruthy();
  });

  it('手紙が無ければ空状態を表示する', async () => {
    const fetchImpl = vi.fn(() => Promise.resolve(jsonResponse([])));
    renderJar(createMockApi(fetchImpl));
    expect(await screen.findByText('まだ手紙は届いていません')).toBeTruthy();
  });

  it('手紙を開くと本文と「返事を書く」を表示する', async () => {
    const fetchImpl = vi.fn((url: string) => {
      if (url === '/api/v1/questions')
        return Promise.resolve(jsonResponse([{ id: 'q1', currentText: 'なぜ続けるのか' }]));
      if (url === '/api/v1/fermentations')
        return Promise.resolve(jsonResponse(completedFermentation));
      if (url === '/api/v1/fermentations/f1') return Promise.resolve(jsonResponse(detailJson({})));
      return Promise.resolve(jsonResponse({}));
    });
    renderJar(createMockApi(fetchImpl));

    fireEvent.click(await screen.findByText('なぜ続けるのか'));

    expect(await screen.findByText('過去のあなたより。')).toBeTruthy();
    expect(screen.getByRole('button', { name: '返事を書く' })).toBeTruthy();
  });

  it('手紙を開くと言葉(keywords)と抜粋(snippets)も表示する', async () => {
    const fetchImpl = vi.fn((url: string) => {
      if (url === '/api/v1/questions')
        return Promise.resolve(jsonResponse([{ id: 'q1', currentText: 'なぜ続けるのか' }]));
      if (url === '/api/v1/fermentations')
        return Promise.resolve(jsonResponse(completedFermentation));
      if (url === '/api/v1/fermentations/f1')
        return Promise.resolve(
          jsonResponse(
            detailJson({
              keywords: [{ id: 'k1', keyword: '余白', description: '...' }],
              snippets: [{ id: 's1', originalText: 'うまく言えない', sourceDate: '2024-02-01' }],
            }),
          ),
        );
      return Promise.resolve(jsonResponse({}));
    });
    renderJar(createMockApi(fetchImpl));

    fireEvent.click(await screen.findByText('なぜ続けるのか'));

    expect(await screen.findByText('余白')).toBeTruthy();
    expect(screen.getByText('「うまく言えない」')).toBeTruthy();
  });
});
