import { describe, expect, it, vi } from 'vitest';
import type { EntryRepositoryGateway } from '@/contexts/entry/domain/gateways/entry-repository.gateway.js';
import { Entry } from '@/contexts/entry/domain/models/entry.js';
import { GetUserAggregatedReadinessUsecase } from '@/contexts/fermentation/application/usecases/get-user-aggregated-readiness.usecase.js';
import type { FermentationRepositoryGateway } from '@/contexts/fermentation/domain/gateways/fermentation-repository.gateway.js';
import type { UserFermentationStateRepositoryGateway } from '@/contexts/fermentation/domain/gateways/user-fermentation-state-repository.gateway.js';
import type { UserLocaleResolverGateway } from '@/contexts/fermentation/domain/gateways/user-locale-resolver.gateway.js';
import { FermentationResult } from '@/contexts/fermentation/domain/models/fermentation-result.js';
import { UserFermentationState } from '@/contexts/fermentation/domain/models/user-fermentation-state.js';
import type { EntryQuestionLinkRepositoryGateway } from '@/contexts/question/domain/gateways/entry-question-link-repository.gateway.js';
import type { QuestionRepositoryGateway } from '@/contexts/question/domain/gateways/question-repository.gateway.js';
import { Question } from '@/contexts/question/domain/models/question.js';

const NOW = new Date('2026-05-06T03:00:00.000Z');

function makeEntry(id: string, content: string, createdAt: string): Entry {
  return Entry.fromProps({
    id,
    userId: 'user-1',
    content,
    mediaUrls: [],
    fermentationEnabled: true,
    createdAt,
    updatedAt: createdAt,
  });
}

function makeQuestion(id: string): Question {
  return Question.fromProps({
    id,
    userId: 'user-1',
    isArchived: false,
    isValidatedByUser: true,
    isProposedByOryzae: false,
    jarX: null,
    jarY: null,
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
  });
}

function makeFermentation(
  id: string,
  questionId: string,
  status: 'completed' | 'failed' | 'processing' | 'pending',
  createdAt: string,
): FermentationResult {
  return FermentationResult.fromProps({
    id,
    userId: 'user-1',
    questionId,
    targetPeriod: 'all',
    status,
    generationId: null,
    errorMessage: null,
    createdAt,
    updatedAt: createdAt,
  });
}

function buildEntryRepo(byId: Map<string, Entry>): EntryRepositoryGateway {
  return {
    findById: vi.fn(),
    findByIds: vi
      .fn()
      .mockImplementation(async (ids: string[]) =>
        ids.map((id) => byId.get(id)).filter((e): e is Entry => e !== undefined),
      ),
    listByUserId: vi.fn(),
    listByUserIdAndDate: vi.fn(),
    listFermentationEnabledByUserIdAndDate: vi.fn(),
    listFermentationEnabledByUserIdSince: vi.fn(),
    countCharsByUserIdSince: vi.fn(),
    listByUserIdAndWeek: vi.fn(),
    searchByUserId: vi.fn(),
    save: vi.fn(),
    delete: vi.fn(),
  };
}

function buildLinkRepo(byQuestion: Map<string, string[]>): EntryQuestionLinkRepositoryGateway {
  return {
    link: vi.fn(),
    unlink: vi.fn(),
    listQuestionIdsByEntryId: vi.fn(),
    listEntryIdsByQuestionId: vi
      .fn()
      .mockImplementation(async (questionId: string) => byQuestion.get(questionId) ?? []),
  };
}

function buildQuestionRepo(questions: Question[]): QuestionRepositoryGateway {
  return {
    findById: vi.fn(),
    listActiveByUserId: vi.fn().mockResolvedValue(questions),
    listAllByUserId: vi.fn(),
    listPendingByUserId: vi.fn(),
    countActiveByUserId: vi.fn(),
    save: vi.fn(),
    delete: vi.fn(),
    updateJarPositions: vi.fn(),
  };
}

function buildFermentationRepo(
  byQuestion: Map<string, FermentationResult[]>,
): FermentationRepositoryGateway {
  return {
    save: vi.fn(),
    update: vi.fn(),
    findById: vi.fn(),
    findByIdWithDetails: vi.fn(),
    listByQuestionId: vi
      .fn()
      .mockImplementation(async (questionId: string) => byQuestion.get(questionId) ?? []),
    saveScannedEntries: vi.fn(),
    listScannedEntryIds: vi.fn(),
    saveWorksheet: vi.fn(),
    saveSnippets: vi.fn(),
    saveLetter: vi.fn(),
    saveKeywords: vi.fn(),
    updateKeywordJarPositions: vi.fn(),
    updateSnippetJarPositions: vi.fn(),
    updateLetterJarPositions: vi.fn(),
  };
}

function buildStateRepo(
  state: UserFermentationState | null,
): UserFermentationStateRepositoryGateway {
  return {
    findByUserId: vi.fn().mockResolvedValue(state),
    upsert: vi.fn(),
  };
}

function buildLocaleResolver(language: 'ja' | 'en'): UserLocaleResolverGateway {
  return { resolve: vi.fn().mockResolvedValue(language) };
}

describe('GetUserAggregatedReadinessUsecase', () => {
  it('問いが 0 件なら totalReadiness は 0', async () => {
    const usecase = new GetUserAggregatedReadinessUsecase(
      buildQuestionRepo([]),
      buildLinkRepo(new Map()),
      buildEntryRepo(new Map()),
      buildFermentationRepo(new Map()),
      buildStateRepo(null),
      buildLocaleResolver('ja'),
    );

    const result = await usecase.execute('user-1', NOW);

    expect(result).toEqual({ totalReadiness: 0, questionCount: 0, language: 'ja' });
  });

  it('未発酵の問い 1 件: charScore がそのまま readiness になる', async () => {
    // ja 閾値 1000 字、エントリ合計 500 字 → charScore = 0.5
    const q = makeQuestion('q1');
    const entry = makeEntry('e1', 'あ'.repeat(500), '2026-04-10T00:00:00.000Z');

    const usecase = new GetUserAggregatedReadinessUsecase(
      buildQuestionRepo([q]),
      buildLinkRepo(new Map([['q1', ['e1']]])),
      buildEntryRepo(new Map([['e1', entry]])),
      buildFermentationRepo(new Map()),
      buildStateRepo(null),
      buildLocaleResolver('ja'),
    );

    const result = await usecase.execute('user-1', NOW);

    expect(result.questionCount).toBe(1);
    expect(result.totalReadiness).toBeCloseTo(0.5);
    expect(result.language).toBe('ja');
  });

  it('発酵済みの問い: cutoff 後のエントリのみ charsSinceLastRun に算入される', async () => {
    // 24h 前に発酵成功 → cutoff
    // cutoff 前のエントリ (500 字) は無視、cutoff 後のエントリ (500 字) のみカウント
    // ja 閾値 1000 字 → charScore = 0.5
    // nextRandomHours = 48 → timeScore = 24/48 = 0.5
    // readiness = min(0.5, 0.5) = 0.5
    const lastRunAt = new Date(NOW.getTime() - 24 * 3600_000);
    const q = makeQuestion('q1');
    const oldEntry = makeEntry(
      'e-old',
      'a'.repeat(500),
      new Date(lastRunAt.getTime() - 3600_000).toISOString(),
    );
    const newEntry = makeEntry(
      'e-new',
      'a'.repeat(500),
      new Date(lastRunAt.getTime() + 3600_000).toISOString(),
    );
    const successfulRun = makeFermentation('f1', 'q1', 'completed', lastRunAt.toISOString());

    const state = UserFermentationState.fromProps({
      userId: 'user-1',
      lastRunAt: lastRunAt.toISOString(),
      nextEligibleAt: new Date(lastRunAt.getTime() + 48 * 3600_000).toISOString(),
      nextRandomHours: 48,
      charsSinceLast: 0,
      readinessScore: 0,
      updatedAt: lastRunAt.toISOString(),
    });

    const usecase = new GetUserAggregatedReadinessUsecase(
      buildQuestionRepo([q]),
      buildLinkRepo(new Map([['q1', ['e-old', 'e-new']]])),
      buildEntryRepo(
        new Map([
          ['e-old', oldEntry],
          ['e-new', newEntry],
        ]),
      ),
      buildFermentationRepo(new Map([['q1', [successfulRun]]])),
      buildStateRepo(state),
      buildLocaleResolver('en'),
    );

    const result = await usecase.execute('user-1', NOW);

    expect(result.questionCount).toBe(1);
    expect(result.language).toBe('en');
    // en 閾値 500 字: charScore = 500/500 = 1.0, timeScore = 0.5 → readiness = 0.5
    expect(result.totalReadiness).toBeCloseTo(0.5);
  });

  it('問い 3 件で readiness を合計する (発酵瓶全体 readiness > 1.0)', async () => {
    // 3 問とも未発酵、ja 閾値 1000 字
    // q1: 1000 字 → 1.0, q2: 500 字 → 0.5, q3: 1500 字 → clamp 1.0
    // 合計 = 2.5
    const q1 = makeQuestion('q1');
    const q2 = makeQuestion('q2');
    const q3 = makeQuestion('q3');

    const e1 = makeEntry('e1', 'あ'.repeat(1000), '2026-04-10T00:00:00.000Z');
    const e2 = makeEntry('e2', 'あ'.repeat(500), '2026-04-10T00:00:00.000Z');
    const e3 = makeEntry('e3', 'あ'.repeat(1500), '2026-04-10T00:00:00.000Z');

    const usecase = new GetUserAggregatedReadinessUsecase(
      buildQuestionRepo([q1, q2, q3]),
      buildLinkRepo(
        new Map([
          ['q1', ['e1']],
          ['q2', ['e2']],
          ['q3', ['e3']],
        ]),
      ),
      buildEntryRepo(
        new Map([
          ['e1', e1],
          ['e2', e2],
          ['e3', e3],
        ]),
      ),
      buildFermentationRepo(new Map()),
      buildStateRepo(null),
      buildLocaleResolver('ja'),
    );

    const result = await usecase.execute('user-1', NOW);

    expect(result.questionCount).toBe(3);
    expect(result.totalReadiness).toBeCloseTo(2.5);
  });

  it('failed の発酵は cutoff として無視され、completed の最新だけが反映される', async () => {
    // q1 に completed (24h前) と failed (1h前)。failed は無視され cutoff は24h前。
    const lastRunAt = new Date(NOW.getTime() - 24 * 3600_000);
    const failedAt = new Date(NOW.getTime() - 1 * 3600_000);
    const q = makeQuestion('q1');
    const e = makeEntry(
      'e1',
      'a'.repeat(500),
      new Date(lastRunAt.getTime() + 3600_000).toISOString(),
    );

    const usecase = new GetUserAggregatedReadinessUsecase(
      buildQuestionRepo([q]),
      buildLinkRepo(new Map([['q1', ['e1']]])),
      buildEntryRepo(new Map([['e1', e]])),
      buildFermentationRepo(
        new Map([
          [
            'q1',
            [
              makeFermentation('f-old', 'q1', 'completed', lastRunAt.toISOString()),
              makeFermentation('f-failed', 'q1', 'failed', failedAt.toISOString()),
            ],
          ],
        ]),
      ),
      buildStateRepo(null),
      buildLocaleResolver('en'),
    );

    const result = await usecase.execute('user-1', NOW);

    // en 閾値 500 字、cutoff 後のエントリ 500 字 → charScore 1.0
    // nextRandomHours が null → MIN(24h)、hoursElapsed 24h → timeScore 1.0
    // readiness = 1.0
    expect(result.totalReadiness).toBeCloseTo(1.0);
  });
});
