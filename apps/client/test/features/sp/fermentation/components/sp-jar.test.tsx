import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SpJar } from '@/features/sp/fermentation/components/sp-jar';
import jaMessages from '@/i18n/messages/ja.json';
import type { ApiClient } from '@/lib/api';
import { UnreadProvider, type UnreadState } from '@/lib/unread-context';

// 「もとになった記録」のタップ遷移（#453）と「返事を書く」で useRouter を使う。
// push を module スコープで共有して呼び出しを検証できるようにする。
const push = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}));

function createMockApi(fetchImpl: ReturnType<typeof vi.fn>): ApiClient {
  return { baseUrl: '', headers: {}, fetch: fetchImpl };
}

function jsonResponse(body: unknown, ok = true): Response {
  // @type-assertion-allowed: テスト用の最小限 Response スタブ
  return { ok, status: ok ? 200 : 400, json: () => Promise.resolve(body) } as Response;
}

function makeUnread(overrides: Partial<UnreadState> = {}): UnreadState {
  return {
    ready: false,
    unreadCount: 0,
    unreadQuestionIds: new Set(),
    markQuestionRead: vi.fn(),
    markAllSeen: vi.fn(),
    ...overrides,
  };
}

function renderJar(api: ApiClient, unread: UnreadState = makeUnread()) {
  return render(
    <NextIntlClientProvider locale="ja" messages={jaMessages}>
      <UnreadProvider value={unread}>
        <SpJar api={api} />
      </UnreadProvider>
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

  it('手紙を開くと「もとになった記録」が出て、タップでそのエントリへ行く（Issue #453）', async () => {
    const fetchImpl = vi.fn((url: string) => {
      if (url === '/api/v1/questions')
        return Promise.resolve(jsonResponse([{ id: 'q1', currentText: 'なぜ続けるのか' }]));
      if (url === '/api/v1/fermentations')
        return Promise.resolve(jsonResponse(completedFermentation));
      if (url === '/api/v1/fermentations/f1')
        return Promise.resolve(
          jsonResponse(
            detailJson({
              scannedEntries: [
                { id: 'e1', title: '朝の光', createdAt: '2024-01-30T00:00:00Z' },
                { id: 'e2', title: '', createdAt: '2024-01-31T00:00:00Z' },
              ],
            }),
          ),
        );
      return Promise.resolve(jsonResponse({}));
    });
    renderJar(createMockApi(fetchImpl));

    fireEvent.click(await screen.findByText('なぜ続けるのか'));

    // 手紙だけでは「何に対する返事か」が分からなかった。
    expect(await screen.findByText('朝の光')).toBeTruthy();
    // 見出しが無い記録もフォールバックで出す（開けなくならないように）。
    expect(screen.getByText(jaMessages.sp.jar.source_untitled)).toBeTruthy();

    fireEvent.click(screen.getByText('朝の光'));
    expect(push).toHaveBeenCalledWith('/entries/e1');
  });

  it('もとになった記録が無ければセクションごと出さない', async () => {
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
    expect(screen.queryByText(jaMessages.sp.jar.section_sources)).toBeNull();
  });

  it('未読の手紙には「未読」を出し、開くとその問いを既読にする（Issue #447）', async () => {
    const fetchImpl = vi.fn((url: string) => {
      if (url === '/api/v1/questions')
        return Promise.resolve(jsonResponse([{ id: 'q1', currentText: 'なぜ続けるのか' }]));
      if (url === '/api/v1/fermentations')
        return Promise.resolve(jsonResponse(completedFermentation));
      if (url === '/api/v1/fermentations/f1') return Promise.resolve(jsonResponse(detailJson({})));
      return Promise.resolve(jsonResponse({}));
    });
    const unread = makeUnread({ ready: true, unreadQuestionIds: new Set(['q1']) });
    renderJar(createMockApi(fetchImpl), unread);

    // 旧実装は瓶を開いた時刻で一括既読にしていたため、開いた手紙が未読のまま残っていた。
    expect(await screen.findByText(/未読/)).toBeTruthy();

    fireEvent.click(screen.getByText('なぜ続けるのか'));

    expect(unread.markQuestionRead).toHaveBeenCalledWith('q1');
  });

  it('未読状態が未取得（ready=false）の間は未読/既読ラベルを出さない', async () => {
    const fetchImpl = vi.fn((url: string) => {
      if (url === '/api/v1/questions')
        return Promise.resolve(jsonResponse([{ id: 'q1', currentText: 'なぜ続けるのか' }]));
      if (url === '/api/v1/fermentations')
        return Promise.resolve(jsonResponse(completedFermentation));
      return Promise.resolve(jsonResponse({}));
    });
    renderJar(createMockApi(fetchImpl));

    await screen.findByText('なぜ続けるのか');
    expect(screen.queryByText(/未読/)).toBeNull();
    expect(screen.queryByText(/既読/)).toBeNull();
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
