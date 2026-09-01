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
vi.mock('@/contexts/fermentation/infrastructure/auth/supabase-user-locale-resolver.js', () => ({
  SupabaseUserLocaleResolver: vi.fn(),
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

describe('GET /api/v1/fermentations/readiness', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Hono は登録順に照合するので、`/readiness` が `/:id` より後ろに移ると
  // id="readiness" として詳細取得へ吸われる。順序が壊れたらここで落ちる。
  it('`/:id` に吸われず readiness usecase が呼ばれる（route 順の回帰ガード）', async () => {
    mockJarReadinessExecute.mockResolvedValue({ score: 1.5, questionCount: 3 });

    const res = await buildApp().request('/api/v1/fermentations/readiness');

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ score: 1.5, questionCount: 3 });
    expect(mockJarReadinessExecute).toHaveBeenCalledWith('user-1');
    expect(mockGetResultExecute).not.toHaveBeenCalled();
  });

  it('逆算の材料（lastRunAt / nextEligibleAt）を返さない（issue #278）', async () => {
    mockJarReadinessExecute.mockResolvedValue({ score: 0.25, questionCount: 1 });

    const res = await buildApp().request('/api/v1/fermentations/readiness');
    const body = await res.json();

    expect(Object.keys(body).sort()).toEqual(['questionCount', 'score']);
  });
});
