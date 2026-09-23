import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// supabase-client は import された時点で env チェックが走るので mock で塞ぐ。
vi.mock('@/contexts/shared/infrastructure/supabase-client.js', () => ({
  getSupabaseClient: () => ({}),
}));

// repository / locale resolver は Supabase を触るだけなので空実装で差し替える。
vi.mock('@/contexts/question/infrastructure/repositories/supabase-question.repository.js', () => ({
  SupabaseQuestionRepository: vi.fn(),
}));
vi.mock('@/contexts/entry/infrastructure/repositories/supabase-entry.repository.js', () => ({
  SupabaseEntryRepository: vi.fn(),
}));
vi.mock(
  '@/contexts/fermentation/infrastructure/repositories/supabase-fermentation.repository.js',
  () => ({ SupabaseFermentationRepository: vi.fn() }),
);
vi.mock(
  '@/contexts/fermentation/infrastructure/repositories/supabase-user-fermentation-state.repository.js',
  () => ({ SupabaseUserFermentationStateRepository: vi.fn() }),
);
// `/first-letter` はロケールを解決してから usecase に渡すので、resolve だけ持たせる。
vi.mock('@/contexts/fermentation/infrastructure/auth/supabase-user-locale-resolver.js', () => ({
  SupabaseUserLocaleResolver: vi.fn().mockImplementation(() => ({
    resolve: vi.fn().mockResolvedValue('en'),
  })),
}));
vi.mock(
  '@/contexts/question/infrastructure/repositories/supabase-question-transaction.repository.js',
  () => ({ SupabaseQuestionTransactionRepository: vi.fn() }),
);
vi.mock(
  '@/contexts/question/infrastructure/repositories/supabase-entry-question-link.repository.js',
  () => ({ SupabaseEntryQuestionLinkRepository: vi.fn() }),
);
vi.mock('@/contexts/fermentation/infrastructure/llm/vercel-ai-analysis.gateway.js', () => ({
  VercelAiAnalysisGateway: vi.fn(),
}));
vi.mock('@/contexts/fermentation/application/usecases/fire-fermentation.usecase.js', () => ({
  FireFermentationUsecase: vi.fn(),
}));

const mockFirstLetterExecute = vi.fn();
vi.mock('@/contexts/fermentation/application/usecases/fire-first-letter.usecase.js', () => ({
  FireFirstLetterUsecase: vi.fn().mockImplementation(() => ({
    execute: (params: unknown) => mockFirstLetterExecute(params),
  })),
}));

const mockMarkReadExecute = vi.fn();
vi.mock('@/contexts/fermentation/application/usecases/mark-letters-read.usecase.js', () => ({
  MarkLettersReadUsecase: vi.fn().mockImplementation(() => ({
    execute: (params: unknown) => mockMarkReadExecute(params),
  })),
}));

const mockJarReadinessExecute = vi.fn();
vi.mock('@/contexts/fermentation/application/usecases/get-jar-readiness.usecase.js', () => ({
  GetJarReadinessUsecase: vi.fn().mockImplementation(() => ({
    execute: (userId: string) => mockJarReadinessExecute(userId),
  })),
}));

// `/:id` に落ちてしまったことを検出するための番兵。ここが呼ばれたら route 順が壊れている。
const mockGetResultExecute = vi.fn();
vi.mock('@/contexts/fermentation/application/usecases/get-fermentation-result.usecase.js', () => ({
  GetFermentationResultUsecase: vi.fn().mockImplementation(() => ({
    execute: (id: string) => mockGetResultExecute(id),
  })),
}));

import { fermentations } from '@/contexts/fermentation/presentation/routes/fermentations.js';

/** authMiddleware の代わりに userId / supabase を注いだテスト用アプリ。 */
function buildApp() {
  return new Hono()
    .use('*', async (c, next) => {
      c.set('userId', 'user-1');
      c.set('supabase', {});
      await next();
    })
    .route('/api/v1/fermentations', fermentations);
}

describe('POST /api/v1/fermentations/read（手紙の既読をサーバに残す）', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('認証ユーザーと問いの id で usecase を呼び、埋めた行数を返す', async () => {
    mockMarkReadExecute.mockResolvedValue({ marked: 1 });

    const res = await buildApp().request('/api/v1/fermentations/read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questionId: 'q-1' }),
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ marked: 1 });
    // userId は body ではなく認証から取る（他人の手紙を既読にできない）。
    expect(mockMarkReadExecute).toHaveBeenCalledWith({ userId: 'user-1', questionId: 'q-1' });
  });

  it('questionId が無い・形が違う body は usecase に届かない', async () => {
    const app = buildApp().onError((_err, c) => c.json({ error: 'bad request' }, 400));

    const missing = await app.request('/api/v1/fermentations/read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const tooLong = await app.request('/api/v1/fermentations/read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ questionId: 'x'.repeat(65) }),
    });

    expect(missing.status).toBe(400);
    expect(tooLong.status).toBe(400);
    expect(mockMarkReadExecute).not.toHaveBeenCalled();
  });
});

describe('POST /api/v1/fermentations/first-letter（初めての漬け込みにその場で手紙）', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('発火したら 201 で usecase の結果をそのまま返す（ロケールは解決して渡す）', async () => {
    mockFirstLetterExecute.mockResolvedValue({
      fired: true,
      fermentationResultId: 'ferm-1',
      questionId: 'q-1',
    });

    const res = await buildApp().request('/api/v1/fermentations/first-letter', {
      method: 'POST',
    });

    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({
      fired: true,
      fermentationResultId: 'ferm-1',
      questionId: 'q-1',
    });
    expect(mockFirstLetterExecute).toHaveBeenCalledWith({ userId: 'user-1', language: 'en' });
  });

  it('初回でなければ 200 で fired=false（何もしない。漬けるたびに呼んでよい）', async () => {
    mockFirstLetterExecute.mockResolvedValue({ fired: false, reason: 'not-first' });

    const res = await buildApp().request('/api/v1/fermentations/first-letter', {
      method: 'POST',
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ fired: false, reason: 'not-first' });
  });

  it('usecase の失敗はそのまま上へ投げる（アプリのエラーハンドラに委ねる）', async () => {
    mockFirstLetterExecute.mockRejectedValue(new Error('LLM analysis failed: boom'));
    const app = buildApp().onError((err, c) => c.json({ error: err.message }, 502));

    const res = await app.request('/api/v1/fermentations/first-letter', { method: 'POST' });

    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({ error: 'LLM analysis failed: boom' });
  });
});

describe('GET /api/v1/fermentations/readiness', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Hono は登録順に照合するので、`/readiness` が `/:id` より後ろに移ると
  // id="readiness" として詳細取得へ吸われる。順序が壊れたらここで落ちる。
  it('`/:id` に吸われず readiness usecase が呼ばれる（route 順の回帰ガード）', async () => {
    mockJarReadinessExecute.mockResolvedValue({ top: 0.9, total: 1.5, questionCount: 3 });

    const res = await buildApp().request('/api/v1/fermentations/readiness');

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ top: 0.9, total: 1.5, questionCount: 3 });
    expect(mockJarReadinessExecute).toHaveBeenCalledWith('user-1');
    expect(mockGetResultExecute).not.toHaveBeenCalled();
  });

  it('逆算の材料（lastRunAt / nextEligibleAt）を返さない（issue #278）', async () => {
    mockJarReadinessExecute.mockResolvedValue({ top: 0.25, total: 0.25, questionCount: 1 });

    const res = await buildApp().request('/api/v1/fermentations/readiness');
    const body = await res.json();

    expect(Object.keys(body).sort()).toEqual(['questionCount', 'top', 'total']);
  });
});
