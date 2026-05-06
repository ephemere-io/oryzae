import { describe, expect, it, vi } from 'vitest';
import type { EntryRepositoryGateway } from '@/contexts/entry/domain/gateways/entry-repository.gateway.js';
import { Entry } from '@/contexts/entry/domain/models/entry.js';
import { ScheduledFermentationUsecase } from '@/contexts/fermentation/application/usecases/scheduled-fermentation.usecase.js';
import type { FermentationRepositoryGateway } from '@/contexts/fermentation/domain/gateways/fermentation-repository.gateway.js';
import type { LlmAnalysisGateway } from '@/contexts/fermentation/domain/gateways/llm-analysis.gateway.js';
import type { UserFermentationStateRepositoryGateway } from '@/contexts/fermentation/domain/gateways/user-fermentation-state-repository.gateway.js';
import type { UserLocaleResolverGateway } from '@/contexts/fermentation/domain/gateways/user-locale-resolver.gateway.js';
import { UserFermentationState } from '@/contexts/fermentation/domain/models/user-fermentation-state.js';
import type { EntryQuestionLinkRepositoryGateway } from '@/contexts/question/domain/gateways/entry-question-link-repository.gateway.js';
import type { QuestionRepositoryGateway } from '@/contexts/question/domain/gateways/question-repository.gateway.js';
import type { QuestionTransactionRepositoryGateway } from '@/contexts/question/domain/gateways/question-transaction-repository.gateway.js';
import { Question } from '@/contexts/question/domain/models/question.js';
import { QuestionTransaction } from '@/contexts/question/domain/models/question-transaction.js';

const generateId = () => 'test-id';
const NOW = new Date('2026-05-06T03:00:00.000Z');

function makeEntry(userId: string, id: string, content = `Entry content for ${id}`): Entry {
  return Entry.fromProps({
    id,
    userId,
    content,
    mediaUrls: [],
    fermentationEnabled: true,
    createdAt: '2026-05-04T10:00:00.000Z',
    updatedAt: '2026-05-04T10:00:00.000Z',
  });
}

function makeQuestion(userId: string, id: string): Question {
  return Question.fromProps({
    id,
    userId,
    isArchived: false,
    isValidatedByUser: true,
    isProposedByOryzae: false,
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
  });
}

function makeQuestionTransaction(questionId: string, text: string): QuestionTransaction {
  return QuestionTransaction.fromProps({
    id: 'qt-1',
    questionId,
    string: text,
    questionVersion: 1,
    isValidatedByUser: true,
    isProposedByOryzae: false,
    createdAt: '2026-04-01T00:00:00.000Z',
    updatedAt: '2026-04-01T00:00:00.000Z',
  });
}

function mockEntryRepo(): EntryRepositoryGateway {
  return {
    findById: vi.fn(),
    findByIds: vi.fn(),
    listByUserId: vi.fn(),
    listByUserIdAndDate: vi.fn().mockResolvedValue([]),
    listFermentationEnabledByUserIdAndDate: vi.fn().mockResolvedValue([]),
    listFermentationEnabledByUserIdSince: vi.fn().mockResolvedValue([]),
    countCharsByUserIdSince: vi.fn().mockResolvedValue(0),
    listByUserIdAndWeek: vi.fn(),
    searchByUserId: vi.fn(),
    save: vi.fn(),
    delete: vi.fn(),
  };
}

function mockQuestionRepo(): QuestionRepositoryGateway {
  return {
    findById: vi.fn(),
    listActiveByUserId: vi.fn().mockResolvedValue([]),
    listAllByUserId: vi.fn(),
    listPendingByUserId: vi.fn(),
    countActiveByUserId: vi.fn(),
    save: vi.fn(),
    delete: vi.fn(),
  };
}

function mockQuestionTransactionRepo(): QuestionTransactionRepositoryGateway {
  return {
    listByQuestionId: vi.fn(),
    findLatestByQuestionId: vi.fn(),
    findLatestValidatedByQuestionId: vi.fn().mockResolvedValue(null),
    findLatestUnvalidatedByQuestionId: vi.fn(),
    append: vi.fn(),
    save: vi.fn(),
    delete: vi.fn(),
  };
}

function mockLinkRepo(): EntryQuestionLinkRepositoryGateway {
  return {
    link: vi.fn(),
    unlink: vi.fn(),
    listQuestionIdsByEntryId: vi.fn(),
    listEntryIdsByQuestionId: vi.fn().mockResolvedValue([]),
  };
}

function mockFermentationRepo(): FermentationRepositoryGateway {
  return {
    save: vi.fn(),
    update: vi.fn(),
    findById: vi.fn(),
    findByIdWithDetails: vi.fn(),
    listByQuestionId: vi.fn(),
    saveScannedEntries: vi.fn(),
    listScannedEntryIds: vi.fn().mockResolvedValue([]),
    saveWorksheet: vi.fn(),
    saveSnippets: vi.fn(),
    saveLetter: vi.fn(),
    saveKeywords: vi.fn(),
  };
}

function mockUserStateRepo(): UserFermentationStateRepositoryGateway {
  return {
    findByUserId: vi.fn().mockResolvedValue(null),
    upsert: vi.fn().mockResolvedValue(undefined),
  };
}

function mockLocaleResolver(language: 'ja' | 'en' = 'ja'): UserLocaleResolverGateway {
  return { resolve: vi.fn().mockResolvedValue(language) };
}

function mockLlm(): LlmAnalysisGateway {
  return {
    analyze: vi.fn().mockResolvedValue({
      output: {
        worksheetMarkdown: '### Worksheet',
        resultDiagramMarkdown: '### Diagram',
        snippets: [{ type: 'core', text: 'snippet', sourceDate: '5/4', reason: 'reason' }],
        letterBody: 'Dear user...',
        keywords: [{ keyword: 'test', description: 'a keyword' }],
      },
      usage: { inputTokens: 100, outputTokens: 200 },
      generationId: 'gen_test',
    }),
  };
}

interface BuildArgs {
  entryRepo?: EntryRepositoryGateway;
  questionRepo?: QuestionRepositoryGateway;
  qtRepo?: QuestionTransactionRepositoryGateway;
  linkRepo?: EntryQuestionLinkRepositoryGateway;
  fermentationRepo?: FermentationRepositoryGateway;
  userStateRepo?: UserFermentationStateRepositoryGateway;
  localeResolver?: UserLocaleResolverGateway;
  llm?: LlmAnalysisGateway;
  userIds?: string[];
  sendDigest?: ReturnType<typeof vi.fn>;
  rollHours?: () => number;
}

function buildUsecase(args: BuildArgs = {}) {
  return new ScheduledFermentationUsecase(
    args.entryRepo ?? mockEntryRepo(),
    args.questionRepo ?? mockQuestionRepo(),
    args.qtRepo ?? mockQuestionTransactionRepo(),
    args.linkRepo ?? mockLinkRepo(),
    args.fermentationRepo ?? mockFermentationRepo(),
    args.userStateRepo ?? mockUserStateRepo(),
    args.localeResolver ?? mockLocaleResolver(),
    args.llm ?? mockLlm(),
    generateId,
    vi.fn().mockResolvedValue(args.userIds ?? []),
    args.sendDigest ?? vi.fn().mockResolvedValue(undefined),
    args.rollHours ?? (() => 48),
  );
}

describe('ScheduledFermentationUsecase (issue #268: 自動発火条件)', () => {
  it('文字数閾値未満のユーザーには発火せず、readiness のみ DB に書く', async () => {
    const entryRepo = mockEntryRepo();
    vi.mocked(entryRepo.countCharsByUserIdSince).mockResolvedValue(500); // ja 閾値の半分

    const userStateRepo = mockUserStateRepo();
    const llm = mockLlm();

    const usecase = buildUsecase({
      entryRepo,
      userStateRepo,
      llm,
      userIds: ['user-1'],
    });

    const result = await usecase.execute(NOW);

    expect(result.totalUsers).toBe(1);
    expect(result.totalFermentations).toBe(0);
    expect(result.eligibleUsers).toBe(0);
    expect(llm.analyze).not.toHaveBeenCalled();
    // readiness は upsert される
    expect(userStateRepo.upsert).toHaveBeenCalledTimes(1);
    const persisted = vi.mocked(userStateRepo.upsert).mock.calls[0][0];
    expect(persisted.readinessScore).toBe(0.5);
    expect(persisted.charsSinceLast).toBe(500);
    expect(persisted.lastRunAt).toBeNull();
  });

  it('英語ロケールは閾値 500 で評価される', async () => {
    const entryRepo = mockEntryRepo();
    vi.mocked(entryRepo.countCharsByUserIdSince).mockResolvedValue(500);
    const localeResolver = mockLocaleResolver('en');

    const userStateRepo = mockUserStateRepo();

    const entry = makeEntry('user-1', 'e1');
    const question = makeQuestion('user-1', 'q1');
    const transaction = makeQuestionTransaction('q1', 'Q?');
    vi.mocked(entryRepo.listFermentationEnabledByUserIdSince).mockResolvedValue([entry]);

    const questionRepo = mockQuestionRepo();
    vi.mocked(questionRepo.listActiveByUserId).mockResolvedValue([question]);

    const qtRepo = mockQuestionTransactionRepo();
    vi.mocked(qtRepo.findLatestValidatedByQuestionId).mockResolvedValue(transaction);

    const linkRepo = mockLinkRepo();
    vi.mocked(linkRepo.listEntryIdsByQuestionId).mockResolvedValue(['e1']);

    const llm = mockLlm();

    const usecase = buildUsecase({
      entryRepo,
      questionRepo,
      qtRepo,
      linkRepo,
      userStateRepo,
      localeResolver,
      llm,
      userIds: ['user-1'],
    });

    const result = await usecase.execute(NOW);

    expect(result.eligibleUsers).toBe(1);
    expect(llm.analyze).toHaveBeenCalledOnce();
  });

  it('新規使用者で閾値超過なら発火する (時間ゲートなし)', async () => {
    const entryRepo = mockEntryRepo();
    vi.mocked(entryRepo.countCharsByUserIdSince).mockResolvedValue(1500);

    const entry = makeEntry('user-1', 'e1');
    vi.mocked(entryRepo.listFermentationEnabledByUserIdSince).mockResolvedValue([entry]);

    const questionRepo = mockQuestionRepo();
    vi.mocked(questionRepo.listActiveByUserId).mockResolvedValue([makeQuestion('user-1', 'q1')]);

    const qtRepo = mockQuestionTransactionRepo();
    vi.mocked(qtRepo.findLatestValidatedByQuestionId).mockResolvedValue(
      makeQuestionTransaction('q1', 'Q?'),
    );

    const linkRepo = mockLinkRepo();
    vi.mocked(linkRepo.listEntryIdsByQuestionId).mockResolvedValue(['e1']);

    const userStateRepo = mockUserStateRepo();
    const llm = mockLlm();

    const usecase = buildUsecase({
      entryRepo,
      questionRepo,
      qtRepo,
      linkRepo,
      userStateRepo,
      llm,
      userIds: ['user-1'],
      rollHours: () => 72,
    });

    const result = await usecase.execute(NOW);

    expect(result.eligibleUsers).toBe(1);
    expect(result.totalFermentations).toBe(1);
    expect(result.succeeded).toBe(1);
    expect(llm.analyze).toHaveBeenCalledOnce();
    // upsert は 2 回: 1 回目 readiness、2 回目 fired (lastRunAt 更新)
    expect(userStateRepo.upsert).toHaveBeenCalledTimes(2);
    const finalState = vi.mocked(userStateRepo.upsert).mock.calls[1][0];
    expect(finalState.lastRunAt).toBe(NOW.toISOString());
    expect(finalState.nextRandomHours).toBe(72);
    expect(finalState.charsSinceLast).toBe(0);
    expect(finalState.readinessScore).toBe(0);
  });

  it('継続使用者で時間ゲート未達なら発火しない', async () => {
    // lastRun = 12 時間前、必要 X = 48h → timeScore = 0.25
    const lastRunAt = new Date(NOW.getTime() - 12 * 60 * 60 * 1000);
    const existingState = UserFermentationState.fromProps({
      userId: 'user-1',
      lastRunAt: lastRunAt.toISOString(),
      nextEligibleAt: new Date(lastRunAt.getTime() + 48 * 3600_000).toISOString(),
      nextRandomHours: 48,
      charsSinceLast: 0,
      readinessScore: 0,
      updatedAt: lastRunAt.toISOString(),
    });

    const entryRepo = mockEntryRepo();
    vi.mocked(entryRepo.countCharsByUserIdSince).mockResolvedValue(2000); // 文字数は十分

    const userStateRepo = mockUserStateRepo();
    vi.mocked(userStateRepo.findByUserId).mockResolvedValue(existingState);

    const llm = mockLlm();

    const usecase = buildUsecase({
      entryRepo,
      userStateRepo,
      llm,
      userIds: ['user-1'],
    });

    const result = await usecase.execute(NOW);

    expect(result.eligibleUsers).toBe(0);
    expect(llm.analyze).not.toHaveBeenCalled();
    // 継続使用者でも readiness は更新される (charScore=1, timeScore=0.25 → min=0.25)
    expect(userStateRepo.upsert).toHaveBeenCalledTimes(1);
    const persisted = vi.mocked(userStateRepo.upsert).mock.calls[0][0];
    expect(persisted.readinessScore).toBeCloseTo(0.25);
    expect(persisted.lastRunAt).toBe(lastRunAt.toISOString()); // 据え置き
  });

  it('継続使用者で文字数も時間も満たすなら発火する', async () => {
    const lastRunAt = new Date(NOW.getTime() - 100 * 60 * 60 * 1000);
    const existingState = UserFermentationState.fromProps({
      userId: 'user-1',
      lastRunAt: lastRunAt.toISOString(),
      nextEligibleAt: new Date(lastRunAt.getTime() + 48 * 3600_000).toISOString(),
      nextRandomHours: 48,
      charsSinceLast: 0,
      readinessScore: 0,
      updatedAt: lastRunAt.toISOString(),
    });

    const entryRepo = mockEntryRepo();
    vi.mocked(entryRepo.countCharsByUserIdSince).mockResolvedValue(2000);
    const entry = makeEntry('user-1', 'e1');
    vi.mocked(entryRepo.listFermentationEnabledByUserIdSince).mockResolvedValue([entry]);

    const questionRepo = mockQuestionRepo();
    vi.mocked(questionRepo.listActiveByUserId).mockResolvedValue([makeQuestion('user-1', 'q1')]);
    const qtRepo = mockQuestionTransactionRepo();
    vi.mocked(qtRepo.findLatestValidatedByQuestionId).mockResolvedValue(
      makeQuestionTransaction('q1', 'Q?'),
    );
    const linkRepo = mockLinkRepo();
    vi.mocked(linkRepo.listEntryIdsByQuestionId).mockResolvedValue(['e1']);

    const userStateRepo = mockUserStateRepo();
    vi.mocked(userStateRepo.findByUserId).mockResolvedValue(existingState);

    const llm = mockLlm();

    const usecase = buildUsecase({
      entryRepo,
      questionRepo,
      qtRepo,
      linkRepo,
      userStateRepo,
      llm,
      userIds: ['user-1'],
      rollHours: () => 96,
    });

    const result = await usecase.execute(NOW);

    expect(result.eligibleUsers).toBe(1);
    expect(result.succeeded).toBe(1);
    const fired = vi.mocked(userStateRepo.upsert).mock.calls.at(-1)?.[0];
    expect(fired?.nextRandomHours).toBe(96);
  });

  it('eligible だが fermentation_enabled エントリが無いと発火せず、lastRunAt も進めない', async () => {
    const entryRepo = mockEntryRepo();
    vi.mocked(entryRepo.countCharsByUserIdSince).mockResolvedValue(2000);
    vi.mocked(entryRepo.listFermentationEnabledByUserIdSince).mockResolvedValue([]); // 全部 opt-out

    const userStateRepo = mockUserStateRepo();
    const llm = mockLlm();

    const usecase = buildUsecase({
      entryRepo,
      userStateRepo,
      llm,
      userIds: ['user-1'],
    });

    const result = await usecase.execute(NOW);

    expect(result.eligibleUsers).toBe(0);
    expect(llm.analyze).not.toHaveBeenCalled();
    // readiness のみ更新、lastRunAt は据え置き (null のまま)
    expect(userStateRepo.upsert).toHaveBeenCalledTimes(1);
    const persisted = vi.mocked(userStateRepo.upsert).mock.calls[0][0];
    expect(persisted.lastRunAt).toBeNull();
  });

  it('eligible だが紐付く問いが無いと発火せず、lastRunAt も進めない', async () => {
    const entryRepo = mockEntryRepo();
    vi.mocked(entryRepo.countCharsByUserIdSince).mockResolvedValue(2000);
    vi.mocked(entryRepo.listFermentationEnabledByUserIdSince).mockResolvedValue([
      makeEntry('user-1', 'e1'),
    ]);

    const questionRepo = mockQuestionRepo();
    vi.mocked(questionRepo.listActiveByUserId).mockResolvedValue([]); // 問いが無い

    const userStateRepo = mockUserStateRepo();

    const usecase = buildUsecase({
      entryRepo,
      questionRepo,
      userStateRepo,
      userIds: ['user-1'],
    });

    const result = await usecase.execute(NOW);

    expect(result.eligibleUsers).toBe(0);
    expect(userStateRepo.upsert).toHaveBeenCalledTimes(1);
  });

  it('複数問いの一部が失敗しても残りは実行される (lastRunAt は更新)', async () => {
    const e1 = makeEntry('user-1', 'e1');
    const q1 = makeQuestion('user-1', 'q1');
    const q2 = makeQuestion('user-1', 'q2');
    const t1 = makeQuestionTransaction('q1', 'Q1');
    const t2 = makeQuestionTransaction('q2', 'Q2');

    const entryRepo = mockEntryRepo();
    vi.mocked(entryRepo.countCharsByUserIdSince).mockResolvedValue(2000);
    vi.mocked(entryRepo.listFermentationEnabledByUserIdSince).mockResolvedValue([e1]);

    const questionRepo = mockQuestionRepo();
    vi.mocked(questionRepo.listActiveByUserId).mockResolvedValue([q1, q2]);

    const qtRepo = mockQuestionTransactionRepo();
    vi.mocked(qtRepo.findLatestValidatedByQuestionId).mockImplementation(async (id) =>
      id === 'q1' ? t1 : t2,
    );

    const linkRepo = mockLinkRepo();
    vi.mocked(linkRepo.listEntryIdsByQuestionId).mockResolvedValue(['e1']);

    const fermentationRepo = mockFermentationRepo();
    let saveCalls = 0;
    vi.mocked(fermentationRepo.save).mockImplementation(async () => {
      saveCalls++;
      if (saveCalls === 1) throw new Error('DB connection error');
    });

    const userStateRepo = mockUserStateRepo();

    const usecase = buildUsecase({
      entryRepo,
      questionRepo,
      qtRepo,
      linkRepo,
      fermentationRepo,
      userStateRepo,
      userIds: ['user-1'],
    });

    const result = await usecase.execute(NOW);

    expect(result.totalFermentations).toBe(2);
    expect(result.failed).toBe(1);
    expect(result.succeeded).toBe(1);
    // 1つでも実行されたので fired upsert が走る
    expect(userStateRepo.upsert).toHaveBeenCalledTimes(2);
  });

  it('digest は成功した問いタイトルだけを 1 ユーザー 1 回送る', async () => {
    const entry = makeEntry('user-1', 'e1');
    const q1 = makeQuestion('user-1', 'q1');
    const q2 = makeQuestion('user-1', 'q2');
    const t1 = makeQuestionTransaction('q1', 'Q1 title');
    const t2 = makeQuestionTransaction('q2', 'Q2 title');

    const entryRepo = mockEntryRepo();
    vi.mocked(entryRepo.countCharsByUserIdSince).mockResolvedValue(2000);
    vi.mocked(entryRepo.listFermentationEnabledByUserIdSince).mockResolvedValue([entry]);

    const questionRepo = mockQuestionRepo();
    vi.mocked(questionRepo.listActiveByUserId).mockResolvedValue([q1, q2]);

    const qtRepo = mockQuestionTransactionRepo();
    vi.mocked(qtRepo.findLatestValidatedByQuestionId).mockImplementation(async (id) =>
      id === 'q1' ? t1 : t2,
    );

    const linkRepo = mockLinkRepo();
    vi.mocked(linkRepo.listEntryIdsByQuestionId).mockResolvedValue(['e1']);

    const sendDigest = vi.fn().mockResolvedValue(undefined);

    const usecase = buildUsecase({
      entryRepo,
      questionRepo,
      qtRepo,
      linkRepo,
      sendDigest,
      userIds: ['user-1'],
    });

    await usecase.execute(NOW);

    expect(sendDigest).toHaveBeenCalledOnce();
    expect(sendDigest).toHaveBeenCalledWith('user-1', ['Q1 title', 'Q2 title'], 'ja');
  });

  it('issue #279: 解決した language が LLM gateway と digest 双方に伝播する', async () => {
    const entry = makeEntry('user-1', 'e1');
    const question = makeQuestion('user-1', 'q1');
    const transaction = makeQuestionTransaction('q1', 'Q en');

    const entryRepo = mockEntryRepo();
    vi.mocked(entryRepo.countCharsByUserIdSince).mockResolvedValue(2000);
    vi.mocked(entryRepo.listFermentationEnabledByUserIdSince).mockResolvedValue([entry]);

    const questionRepo = mockQuestionRepo();
    vi.mocked(questionRepo.listActiveByUserId).mockResolvedValue([question]);

    const qtRepo = mockQuestionTransactionRepo();
    vi.mocked(qtRepo.findLatestValidatedByQuestionId).mockResolvedValue(transaction);

    const linkRepo = mockLinkRepo();
    vi.mocked(linkRepo.listEntryIdsByQuestionId).mockResolvedValue(['e1']);

    const llm = mockLlm();
    const sendDigest = vi.fn().mockResolvedValue(undefined);
    const localeResolver = mockLocaleResolver('en');

    const usecase = buildUsecase({
      entryRepo,
      questionRepo,
      qtRepo,
      linkRepo,
      llm,
      sendDigest,
      localeResolver,
      userIds: ['user-1'],
    });

    await usecase.execute(NOW);

    expect(llm.analyze).toHaveBeenCalledWith(expect.objectContaining({ language: 'en' }));
    expect(sendDigest).toHaveBeenCalledWith('user-1', ['Q en'], 'en');
  });

  it('issue #279: ja ロケールはデフォルトとして LLM gateway に伝播する', async () => {
    const entry = makeEntry('user-1', 'e1');
    const question = makeQuestion('user-1', 'q1');
    const transaction = makeQuestionTransaction('q1', 'Q ja');

    const entryRepo = mockEntryRepo();
    vi.mocked(entryRepo.countCharsByUserIdSince).mockResolvedValue(2000);
    vi.mocked(entryRepo.listFermentationEnabledByUserIdSince).mockResolvedValue([entry]);

    const questionRepo = mockQuestionRepo();
    vi.mocked(questionRepo.listActiveByUserId).mockResolvedValue([question]);

    const qtRepo = mockQuestionTransactionRepo();
    vi.mocked(qtRepo.findLatestValidatedByQuestionId).mockResolvedValue(transaction);

    const linkRepo = mockLinkRepo();
    vi.mocked(linkRepo.listEntryIdsByQuestionId).mockResolvedValue(['e1']);

    const llm = mockLlm();

    const usecase = buildUsecase({
      entryRepo,
      questionRepo,
      qtRepo,
      linkRepo,
      llm,
      userIds: ['user-1'],
    });

    await usecase.execute(NOW);

    expect(llm.analyze).toHaveBeenCalledWith(expect.objectContaining({ language: 'ja' }));
  });

  it('digest 失敗が cron 全体を壊さない', async () => {
    const entry = makeEntry('user-1', 'e1');
    const question = makeQuestion('user-1', 'q1');
    const transaction = makeQuestionTransaction('q1', 'Q');

    const entryRepo = mockEntryRepo();
    vi.mocked(entryRepo.countCharsByUserIdSince).mockResolvedValue(2000);
    vi.mocked(entryRepo.listFermentationEnabledByUserIdSince).mockResolvedValue([entry]);

    const questionRepo = mockQuestionRepo();
    vi.mocked(questionRepo.listActiveByUserId).mockResolvedValue([question]);

    const qtRepo = mockQuestionTransactionRepo();
    vi.mocked(qtRepo.findLatestValidatedByQuestionId).mockResolvedValue(transaction);

    const linkRepo = mockLinkRepo();
    vi.mocked(linkRepo.listEntryIdsByQuestionId).mockResolvedValue(['e1']);

    const sendDigest = vi.fn().mockRejectedValue(new Error('email down'));

    const usecase = buildUsecase({
      entryRepo,
      questionRepo,
      qtRepo,
      linkRepo,
      sendDigest,
      userIds: ['user-1'],
    });

    const result = await usecase.execute(NOW);

    expect(result.succeeded).toBe(1);
    expect(sendDigest).toHaveBeenCalledOnce();
  });

  it('アクティブユーザーがいない場合、副作用なし', async () => {
    const userStateRepo = mockUserStateRepo();
    const usecase = buildUsecase({ userStateRepo, userIds: [] });

    const result = await usecase.execute(NOW);

    expect(result.totalUsers).toBe(0);
    expect(result.totalFermentations).toBe(0);
    expect(userStateRepo.upsert).not.toHaveBeenCalled();
  });
});
