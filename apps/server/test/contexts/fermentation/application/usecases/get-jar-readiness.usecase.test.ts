import { describe, expect, it, vi } from 'vitest';
import type { EntryRepositoryGateway } from '@/contexts/entry/domain/gateways/entry-repository.gateway.js';
import { GetJarReadinessUsecase } from '@/contexts/fermentation/application/usecases/get-jar-readiness.usecase.js';
import type { FermentationRepositoryGateway } from '@/contexts/fermentation/domain/gateways/fermentation-repository.gateway.js';
import type { UserFermentationStateRepositoryGateway } from '@/contexts/fermentation/domain/gateways/user-fermentation-state-repository.gateway.js';
import type { UserLocaleResolverGateway } from '@/contexts/fermentation/domain/gateways/user-locale-resolver.gateway.js';
import { FermentationResult } from '@/contexts/fermentation/domain/models/fermentation-result.js';
import { UserFermentationState } from '@/contexts/fermentation/domain/models/user-fermentation-state.js';
import type { QuestionRepositoryGateway } from '@/contexts/question/domain/gateways/question-repository.gateway.js';
import { Question } from '@/contexts/question/domain/models/question.js';

const NOW = new Date('2026-09-02T03:00:00.000Z');
const USER_ID = 'user-1';

function buildQuestion(id: string): Question {
  return Question.fromProps({
    id,
    userId: USER_ID,
    isArchived: false,
    isValidatedByUser: true,
    isProposedByOryzae: false,
    jarX: null,
    jarY: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  });
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

/** 問いごとの文字数。未登録の問いは 0 文字扱い。 */
function buildEntryRepo(charsByQuestionId: Record<string, number>): EntryRepositoryGateway {
  return {
    findById: vi.fn(),
    findByIds: vi.fn(),
    listByUserId: vi.fn(),
    listByUserIdAndDate: vi.fn().mockResolvedValue([]),
    listFermentationEnabledByUserIdAndDate: vi.fn().mockResolvedValue([]),
    listFermentationEnabledByUserIdSince: vi.fn().mockResolvedValue([]),
    countCharsByUserIdSince: vi.fn().mockResolvedValue(0),
    countCharsByQuestionIdSince: vi
      .fn()
      .mockImplementation(async (_userId: string, questionId: string) =>
        Math.max(0, charsByQuestionId[questionId] ?? 0),
      ),
    listByUserIdAndWeek: vi.fn(),
    searchByUserId: vi.fn(),
    save: vi.fn(),
    delete: vi.fn(),
  };
}

function buildResult(questionId: string, status: 'completed' | 'failed', createdAt: string) {
  return FermentationResult.fromProps({
    id: `f-${questionId}-${createdAt}`,
    userId: USER_ID,
    questionId,
    targetPeriod: '2026-09-01',
    status,
    generationId: null,
    inputTokens: null,
    outputTokens: null,
    errorMessage: null,
    createdAt,
    updatedAt: createdAt,
  });
}

function buildFermentationRepo(results: FermentationResult[]): FermentationRepositoryGateway {
  return {
    save: vi.fn(),
    update: vi.fn(),
    findById: vi.fn(),
    findByIdWithDetails: vi.fn(),
    listByQuestionId: vi.fn(),
    listByUserId: vi.fn().mockResolvedValue(results),
    listRetryable: vi.fn(),
    clearOutputs: vi.fn(),
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

function buildStateRepo(nextRandomHours: number | null): UserFermentationStateRepositoryGateway {
  const state = UserFermentationState.fromProps({
    userId: USER_ID,
    lastRunAt: null,
    nextEligibleAt: null,
    nextRandomHours,
    charsSinceLast: 0,
    readinessScore: 0,
    updatedAt: NOW.toISOString(),
  });
  return { findByUserId: vi.fn().mockResolvedValue(state), upsert: vi.fn() };
}

function buildLocaleResolver(language: 'ja' | 'en'): UserLocaleResolverGateway {
  return { resolve: vi.fn().mockResolvedValue(language) };
}

describe('GetJarReadinessUsecase', () => {
  it('問いがゼロなら score も questionCount も 0（他のリポジトリは引かない）', async () => {
    const fermentationRepo = buildFermentationRepo([]);
    const usecase = new GetJarReadinessUsecase(
      buildQuestionRepo([]),
      buildEntryRepo({}),
      fermentationRepo,
      buildStateRepo(null),
      buildLocaleResolver('ja'),
    );

    expect(await usecase.execute(USER_ID, NOW)).toEqual({ top: 0, total: 0, questionCount: 0 });
    expect(fermentationRepo.listByUserId).not.toHaveBeenCalled();
  });

  it('未発酵の問いは時間ゲート免除で charScore がそのまま readiness になる', async () => {
    const usecase = new GetJarReadinessUsecase(
      buildQuestionRepo([buildQuestion('q-1')]),
      buildEntryRepo({ 'q-1': 500 }),
      buildFermentationRepo([]),
      buildStateRepo(null),
      buildLocaleResolver('ja'),
    );

    // ja 閾値 1000 → 500/1000 = 0.5
    expect(await usecase.execute(USER_ID, NOW)).toEqual({ top: 0.5, total: 0.5, questionCount: 1 });
  });

  it('問いごとの readiness を足し合わせる（3問い満タンで 3.0）', async () => {
    const usecase = new GetJarReadinessUsecase(
      buildQuestionRepo([buildQuestion('q-1'), buildQuestion('q-2'), buildQuestion('q-3')]),
      buildEntryRepo({ 'q-1': 1000, 'q-2': 2000, 'q-3': 1000 }),
      buildFermentationRepo([]),
      buildStateRepo(null),
      buildLocaleResolver('ja'),
    );

    // 1問いあたり 1.0 で頭打ち。q-2 が 2000 字でも 1.0 のまま。
    expect(await usecase.execute(USER_ID, NOW)).toEqual({ top: 1, total: 3, questionCount: 3 });
  });

  it('top はいちばん進んだ問い、total は総和（問い1つでも段階が進むための素材）', async () => {
    // 問いごとに進み具合が違うケース。ja 閾値 1000 → 0.2 / 0.9 / 0.3。
    const usecase = new GetJarReadinessUsecase(
      buildQuestionRepo([buildQuestion('q-1'), buildQuestion('q-2'), buildQuestion('q-3')]),
      buildEntryRepo({ 'q-1': 200, 'q-2': 900, 'q-3': 300 }),
      buildFermentationRepo([]),
      buildStateRepo(null),
      buildLocaleResolver('ja'),
    );

    // top が総和や平均になっていたら 1.4 や 0.47 になる。最大でなければ、
    // 問い1つの人が泡立てるようにした狙い (PR #559) が崩れる。
    expect(await usecase.execute(USER_ID, NOW)).toEqual({
      top: 0.9,
      total: 1.4,
      questionCount: 3,
    });
  });

  it('浮動小数の端数を残さない（0.1 + 0.2 が 0.30000000000000004 にならない）', async () => {
    const usecase = new GetJarReadinessUsecase(
      buildQuestionRepo([buildQuestion('q-1'), buildQuestion('q-2')]),
      buildEntryRepo({ 'q-1': 100, 'q-2': 200 }),
      buildFermentationRepo([]),
      buildStateRepo(null),
      buildLocaleResolver('ja'),
    );

    expect(await usecase.execute(USER_ID, NOW)).toEqual({ top: 0.2, total: 0.3, questionCount: 2 });
  });

  it('発酵済みの問いは直近成功発酵からの経過時間で頭打ちになる', async () => {
    const lastRunAt = new Date(NOW.getTime() - 12 * 3600_000).toISOString();
    const usecase = new GetJarReadinessUsecase(
      buildQuestionRepo([buildQuestion('q-1')]),
      buildEntryRepo({ 'q-1': 5000 }),
      buildFermentationRepo([buildResult('q-1', 'completed', lastRunAt)]),
      buildStateRepo(48),
      buildLocaleResolver('ja'),
    );

    // charScore=1.0 / timeScore=12h÷48h=0.25 → min は 0.25
    expect(await usecase.execute(USER_ID, NOW)).toEqual({
      top: 0.25,
      total: 0.25,
      questionCount: 1,
    });
  });

  it('失敗した発酵は「直近の成功」に数えない（時間ゲートを開始させない）', async () => {
    const failedAt = new Date(NOW.getTime() - 12 * 3600_000).toISOString();
    const usecase = new GetJarReadinessUsecase(
      buildQuestionRepo([buildQuestion('q-1')]),
      buildEntryRepo({ 'q-1': 1000 }),
      buildFermentationRepo([buildResult('q-1', 'failed', failedAt)]),
      buildStateRepo(48),
      buildLocaleResolver('ja'),
    );

    // 未発酵扱い → 時間ゲート免除で charScore(=1.0) がそのまま出る
    expect(await usecase.execute(USER_ID, NOW)).toEqual({ top: 1, total: 1, questionCount: 1 });
  });

  it('同じ問いに複数の成功発酵があれば最新を基準にする', async () => {
    const older = new Date(NOW.getTime() - 96 * 3600_000).toISOString();
    const newer = new Date(NOW.getTime() - 24 * 3600_000).toISOString();
    const entryRepo = buildEntryRepo({ 'q-1': 5000 });
    const usecase = new GetJarReadinessUsecase(
      buildQuestionRepo([buildQuestion('q-1')]),
      entryRepo,
      buildFermentationRepo([
        buildResult('q-1', 'completed', older),
        buildResult('q-1', 'completed', newer),
      ]),
      buildStateRepo(48),
      buildLocaleResolver('ja'),
    );

    // 古い方を基準にすると timeScore=1.0 になってしまう。新しい方なら 24÷48=0.5。
    expect(await usecase.execute(USER_ID, NOW)).toEqual({ top: 0.5, total: 0.5, questionCount: 1 });
    expect(entryRepo.countCharsByQuestionIdSince).toHaveBeenCalledWith(USER_ID, 'q-1', newer);
  });

  it('英語ユーザーは閾値 500 で評価する', async () => {
    const usecase = new GetJarReadinessUsecase(
      buildQuestionRepo([buildQuestion('q-1')]),
      buildEntryRepo({ 'q-1': 250 }),
      buildFermentationRepo([]),
      buildStateRepo(null),
      buildLocaleResolver('en'),
    );

    expect(await usecase.execute(USER_ID, NOW)).toEqual({ top: 0.5, total: 0.5, questionCount: 1 });
  });

  it('lastRunAt / nextEligibleAt など逆算の材料を返さない（issue #278）', async () => {
    const lastRunAt = new Date(NOW.getTime() - 12 * 3600_000).toISOString();
    const usecase = new GetJarReadinessUsecase(
      buildQuestionRepo([buildQuestion('q-1')]),
      buildEntryRepo({ 'q-1': 5000 }),
      buildFermentationRepo([buildResult('q-1', 'completed', lastRunAt)]),
      buildStateRepo(48),
      buildLocaleResolver('ja'),
    );

    expect(Object.keys(await usecase.execute(USER_ID, NOW)).sort()).toEqual([
      'questionCount',
      'top',
      'total',
    ]);
  });
});
