import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { JarQuestion } from '@/features/shared/questions/types';
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
    unreadFermentationIds: new Set(),
    markQuestionRead: vi.fn(),
    markAllSeen: vi.fn(),
    ...overrides,
  };
}

const questions: JarQuestion[] = [
  { id: 'q1', currentText: 'なぜ続けるのか', jarX: null, jarY: null },
];

interface RenderOptions {
  unread?: UnreadState;
  jarQuestions?: JarQuestion[];
  loading?: boolean;
  onManageQuestions?: () => void;
}

function renderJar(api: ApiClient, options: RenderOptions = {}) {
  return render(
    <NextIntlClientProvider locale="ja" messages={jaMessages}>
      <UnreadProvider value={options.unread ?? makeUnread()}>
        <SpJar
          api={api}
          questions={options.jarQuestions ?? questions}
          loading={options.loading ?? false}
          onManageQuestions={options.onManageQuestions ?? vi.fn()}
        />
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

/** 一覧・詳細ともに満たす既定のスタブ。 */
function filledApi(detail: Record<string, unknown> = detailJson({})): ApiClient {
  return createMockApi(
    vi.fn((url: string) => {
      // 詳細(/fermentations/:id) を先に判定 → 一覧(?questionId= 付きもここ) → questions。
      if (url.startsWith('/api/v1/fermentations/')) return Promise.resolve(jsonResponse(detail));
      if (url.startsWith('/api/v1/fermentations'))
        return Promise.resolve(jsonResponse(completedFermentation));
      if (url.startsWith('/api/v1/questions'))
        return Promise.resolve(jsonResponse([{ id: 'q1', currentText: 'なぜ続けるのか' }]));
      return Promise.resolve(jsonResponse({}));
    }),
  );
}

/** 円を開く（軌道の円はアクセシブル名に問い文を持つ）。 */
function openCircle(name: string) {
  fireEvent.click(screen.getByRole('button', { name }));
}

describe('SpJar', () => {
  afterEach(cleanup);
  beforeEach(() => vi.clearAllMocks());

  it('問いの数だけ円を軌道に置く', () => {
    renderJar(filledApi());
    expect(screen.getByRole('button', { name: 'なぜ続けるのか' })).toBeTruthy();
  });

  it('取得中は「問いがまだありません」を出さない（消したように見える）', () => {
    renderJar(filledApi(), { jarQuestions: [], loading: true });
    expect(screen.queryByText(/問いがまだありません/)).toBeNull();
  });

  it('問いが0件なら案内を出す', () => {
    renderJar(filledApi(), { jarQuestions: [], loading: false });
    expect(screen.getByText(/問いがまだありません/)).toBeTruthy();
  });

  it('「問いを追加・編集」を押すと問いの管理を開く（SP はボトムナビを持たない）', () => {
    const onManageQuestions = vi.fn();
    renderJar(filledApi(), { onManageQuestions });

    fireEvent.click(screen.getByRole('button', { name: jaMessages.sp.jar.manage_questions }));
    expect(onManageQuestions).toHaveBeenCalled();
  });

  it('円をタップすると開き、中の言葉・抜粋・手紙が並ぶ', async () => {
    const api = filledApi(
      detailJson({
        keywords: [{ id: 'k1', keyword: '余白', description: '...' }],
        snippets: [{ id: 's1', originalText: 'うまく言えない', sourceDate: '2024-02-01' }],
      }),
    );
    renderJar(api);

    openCircle('なぜ続けるのか');

    // 円の中は「在ること」だけを示す（本文は開いてから）。
    expect(await screen.findByText('余白')).toBeTruthy();
    expect(screen.getByText(/うまく言えない/)).toBeTruthy();
  });

  it('キーワードとスニペットは押すとその場で開き、説明と理由が読める（重なるシートを開かない）', async () => {
    const api = filledApi(
      detailJson({
        keywords: [{ id: 'k1', keyword: '余白', description: '埋めない時間。' }],
        snippets: [
          {
            id: 's1',
            originalText: 'うまく言えない',
            sourceDate: '2024-02-01',
            selectionReason: '言いよどみが続く。',
          },
        ],
      }),
    );
    renderJar(api);

    openCircle('なぜ続けるのか');

    const keyword = (await screen.findByText('余白')).closest('button');
    if (!keyword) throw new Error('キーワードの行がボタンでない');
    // 押す前は閉じている（窓を開ける楽しみ。全部出ていると文字量に圧倒される、とレビュー）。
    expect(keyword.getAttribute('aria-expanded')).toBe('false');
    expect(screen.getByText('埋めない時間。').closest('[inert]')).not.toBeNull();
    fireEvent.click(keyword);
    expect(keyword.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByText('埋めない時間。').closest('[inert]')).toBeNull();

    const snippet = screen.getByText(/うまく言えない/).closest('button');
    if (!snippet) throw new Error('スニペットの行がボタンでない');
    fireEvent.click(snippet);
    expect(screen.getByText('言いよどみが続く。').closest('[inert]')).toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('手紙は最初から本文が出ていて、「返事を書く」で新規エントリーへ', async () => {
    renderJar(filledApi());

    openCircle('なぜ続けるのか');
    // 手紙はもう一度押さなくても読める（実機レビュー）。
    await screen.findByTestId('reading-letter');
    expect(await screen.findByText('過去のあなたより。')).toBeTruthy();
    // 足元の返事は、何への返事かを言う（手紙の書き出しを引く）。
    fireEvent.click(screen.getByRole('button', { name: jaMessages.fermentation.reading.reply }));
    expect(push).toHaveBeenCalledWith('/entries/new?questionId=q1');
  });

  it('手紙の下に「もとになった記録」が出て、タップでそのエントリへ行く（Issue #453）', async () => {
    const api = filledApi(
      detailJson({
        scannedEntries: [
          { id: 'e1', title: '朝の光', createdAt: '2024-01-30T00:00:00Z' },
          { id: 'e2', title: '', createdAt: '2024-01-31T00:00:00Z' },
        ],
      }),
    );
    renderJar(api);

    openCircle('なぜ続けるのか');
    await screen.findByTestId('reading-letter');

    // 手紙だけでは「何に対する返事か」が分からなかった。
    expect(await screen.findByText('朝の光')).toBeTruthy();
    // 見出しが無い記録もフォールバックで出す（開けなくならないように）。
    expect(screen.getByText(jaMessages.fermentation.reading.source_untitled)).toBeTruthy();

    fireEvent.click(screen.getByText('朝の光'));
    expect(push).toHaveBeenCalledWith('/entries/e1');
  });

  it('もとになった記録が無ければセクションごと出さない', async () => {
    renderJar(filledApi());

    openCircle('なぜ続けるのか');
    await screen.findByTestId('reading-letter');

    expect(await screen.findByText('過去のあなたより。')).toBeTruthy();
    expect(screen.queryByText(jaMessages.fermentation.reading.sources)).toBeNull();
  });

  it('手紙が画面に出た時点でその問いを既読にする（Issue #447）', async () => {
    const unread = makeUnread({ ready: true, unreadQuestionIds: new Set(['q1']) });
    renderJar(filledApi(), { unread });

    // 旧実装は瓶を開いた時刻で一括既読にしていた。いまは手紙が最初から出るので、
    // 「その手紙が画面に出た」ことを読んだ印にする。
    expect(unread.markQuestionRead).not.toHaveBeenCalled();
    openCircle('なぜ続けるのか');
    await screen.findByTestId('reading-letter');
    await waitFor(() => expect(unread.markQuestionRead).toHaveBeenCalledWith('q1'));
  });

  it('発酵がまだなら円の中でそう伝える', async () => {
    const api = createMockApi(vi.fn(() => Promise.resolve(jsonResponse([]))));
    renderJar(api);

    openCircle('なぜ続けるのか');

    expect(await screen.findByText(jaMessages.sp.jar.not_fermented)).toBeTruthy();
  });

  it('戻ると地図に戻る', async () => {
    renderJar(filledApi());

    openCircle('なぜ続けるのか');
    await screen.findByTestId('reading-letter');

    // 上段（SpTopBar）の外なので、問いの画面が自前の戻るを出す。
    fireEvent.click(screen.getByRole('button', { name: jaMessages.sp.nav.back }));
    expect(screen.queryByTestId('reading-letter')).toBeNull();
    expect(screen.getByRole('button', { name: 'なぜ続けるのか' })).toBeTruthy();
  });
});
