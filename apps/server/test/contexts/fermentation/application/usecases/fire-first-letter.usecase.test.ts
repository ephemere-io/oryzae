import { describe, expect, it, vi } from 'vitest';
import type { EntryRepositoryGateway } from '@/contexts/entry/domain/gateways/entry-repository.gateway.js';
import { Entry } from '@/contexts/entry/domain/models/entry.js';
import type { FireFermentationUsecase } from '@/contexts/fermentation/application/usecases/fire-fermentation.usecase.js';
import { FireFirstLetterUsecase } from '@/contexts/fermentation/application/usecases/fire-first-letter.usecase.js';
import type { FermentationRepositoryGateway } from '@/contexts/fermentation/domain/gateways/fermentation-repository.gateway.js';
import { FermentationResult } from '@/contexts/fermentation/domain/models/fermentation-result.js';
import type { EntryQuestionLinkRepositoryGateway } from '@/contexts/question/domain/gateways/entry-question-link-repository.gateway.js';
import type { QuestionRepositoryGateway } from '@/contexts/question/domain/gateways/question-repository.gateway.js';
import { Question } from '@/contexts/question/domain/models/question.js';

const USER_ID = 'user-1';

function makeEntry(id: string, updatedAt: string): Entry {
  return Entry.fromProps({
    id,
    userId: USER_ID,
    content: `Entry ${id}`,
    mediaUrls: [],
    fermentationEnabled: true,
    effects: null,
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt,
  });
}

function makeQuestion(id: string): Question {
  return Question.fromProps({
    id,
    userId: USER_ID,
    isArchived: false,
    isValidatedByUser: true,
    isProposedByOryzae: false,
    jarX: null,
    jarY: null,
    createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z',
  });
}

function makeResult(id: string, status: 'completed' | 'failed' | 'pending'): FermentationResult {
  return FermentationResult.fromProps({
    id,
    userId: USER_ID,
    questionId: 'q-1',
    targetPeriod: '2026-09-01',
    status,
    generationId: null,
    inputTokens: null,
    outputTokens: null,
    errorMessage: null,
    createdAt: '2026-09-01T00:00:00.000Z',
    updatedAt: '2026-09-01T00:00:00.000Z',
  });
}

function mockEntryRepo(pickled: Entry[]): EntryRepositoryGateway {
  return {
    findById: vi.fn(),
    findByIds: vi.fn(),
    listByUserId: vi.fn(),
    listByUserIdAndDate: vi.fn(),
    listFermentationEnabledByUserIdAndDate: vi.fn(),
    listFermentationEnabledByUserIdSince: vi.fn().mockResolvedValue(pickled),
    countCharsByUserIdSince: vi.fn(),
    countByMonth: vi.fn(),
    countCharsByQuestionIdSince: vi.fn(),
    listByUserIdAndWeek: vi.fn(),
    searchByUserId: vi.fn(),
    save: vi.fn(),
    delete: vi.fn(),
  };
}

function mockQuestionRepo(active: Question[]): QuestionRepositoryGateway {
  return {
    findById: vi.fn(),
    listActiveByUserId: vi.fn().mockResolvedValue(active),
    listAllByUserId: vi.fn(),
    listPendingByUserId: vi.fn(),
    countActiveByUserId: vi.fn(),
    save: vi.fn(),
    delete: vi.fn(),
    updateJarPositions: vi.fn(),
  };
}

function mockLinkRepo(linkedByEntry: Record<string, string[]>): EntryQuestionLinkRepositoryGateway {
  return {
    link: vi.fn(),
    unlink: vi.fn(),
    listQuestionIdsByEntryId: vi
      .fn()
      .mockImplementation(async (entryId: string) => linkedByEntry[entryId] ?? []),
    listEntryIdsByQuestionId: vi.fn(),
  };
}

function mockFermentationRepo(existing: FermentationResult[]): FermentationRepositoryGateway {
  return {
    save: vi.fn(),
    update: vi.fn(),
    findById: vi.fn(),
    findByIdWithDetails: vi.fn(),
    listByQuestionId: vi.fn(),
    listByUserId: vi.fn().mockResolvedValue(existing),
    listRetryable: vi.fn(),
    markReadByQuestionId: vi.fn(),
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

function mockFire(): Pick<FireFermentationUsecase, 'execute'> {
  return {
    execute: vi.fn().mockImplementation(async (params: { questionId?: string }) => ({
      fired: [
        {
          fermentationResultId: 'ferm-new',
          questionId: params.questionId ?? 'q-?',
          questionText: 'Q text',
        },
      ],
    })),
  };
}

interface BuildArgs {
  existing?: FermentationResult[];
  pickled?: Entry[];
  active?: Question[];
  linkedByEntry?: Record<string, string[]>;
  fire?: Pick<FireFermentationUsecase, 'execute'>;
}

function build(args: BuildArgs = {}) {
  const fire = args.fire ?? mockFire();
  const fermentationRepo = mockFermentationRepo(args.existing ?? []);
  const usecase = new FireFirstLetterUsecase(
    mockEntryRepo(args.pickled ?? []),
    mockQuestionRepo(args.active ?? []),
    mockLinkRepo(args.linkedByEntry ?? {}),
    fermentationRepo,
    fire,
  );
  return { usecase, fire, fermentationRepo };
}

describe('FireFirstLetterUsecase（初めての漬け込みにその場で手紙を返す）', () => {
  it('発酵の行が無く、漬けたエントリが active な問いに結ばれていれば 1 通発火する', async () => {
    const { usecase, fire } = build({
      pickled: [makeEntry('e-1', '2026-09-10T00:00:00.000Z')],
      active: [makeQuestion('q-1')],
      linkedByEntry: { 'e-1': ['q-1'] },
    });

    const result = await usecase.execute({ userId: USER_ID, language: 'en' });

    expect(result).toEqual({ fired: true, fermentationResultId: 'ferm-new', questionId: 'q-1' });
    // ゲートを飛ばす強制発火に、問いを 1 つに絞って委ねる。language もそのまま渡す。
    expect(fire.execute).toHaveBeenCalledWith({
      userId: USER_ID,
      questionId: 'q-1',
      language: 'en',
    });
    expect(fire.execute).toHaveBeenCalledOnce();
  });

  it('既に発酵の行があれば（状態を問わず）何もしない — not-first', async () => {
    for (const status of ['completed', 'failed', 'pending'] as const) {
      const { usecase, fire } = build({
        existing: [makeResult('ferm-old', status)],
        pickled: [makeEntry('e-1', '2026-09-10T00:00:00.000Z')],
        active: [makeQuestion('q-1')],
        linkedByEntry: { 'e-1': ['q-1'] },
      });

      const result = await usecase.execute({ userId: USER_ID });

      expect(result).toEqual({ fired: false, reason: 'not-first' });
      expect(fire.execute).not.toHaveBeenCalled();
    }
  });

  it('漬けたエントリが 1 つも無ければ nothing-to-ferment', async () => {
    const { usecase, fire } = build({ active: [makeQuestion('q-1')] });

    const result = await usecase.execute({ userId: USER_ID });

    expect(result).toEqual({ fired: false, reason: 'nothing-to-ferment' });
    expect(fire.execute).not.toHaveBeenCalled();
  });

  it('漬けたエントリが active な問いに結ばれていなければ nothing-to-ferment', async () => {
    const { usecase, fire } = build({
      pickled: [makeEntry('e-1', '2026-09-10T00:00:00.000Z')],
      active: [makeQuestion('q-1')],
      // 結ばれているのはアーカイブ済み等で active 一覧に居ない問い
      linkedByEntry: { 'e-1': ['q-archived'] },
    });

    const result = await usecase.execute({ userId: USER_ID });

    expect(result).toEqual({ fired: false, reason: 'nothing-to-ferment' });
    expect(fire.execute).not.toHaveBeenCalled();
  });

  it('いちばん最近漬けた（updatedAt が新しい）エントリの問いを選ぶ', async () => {
    const { usecase, fire } = build({
      // 一覧は created_at 昇順で返る想定。updatedAt は e-old の方が新しい（後から漬けた）。
      pickled: [
        makeEntry('e-old', '2026-09-15T00:00:00.000Z'),
        makeEntry('e-new', '2026-09-12T00:00:00.000Z'),
      ],
      active: [makeQuestion('q-a'), makeQuestion('q-b')],
      linkedByEntry: { 'e-old': ['q-b'], 'e-new': ['q-a'] },
    });

    const result = await usecase.execute({ userId: USER_ID });

    expect(result).toMatchObject({ fired: true, questionId: 'q-b' });
    expect(fire.execute).toHaveBeenCalledWith(expect.objectContaining({ questionId: 'q-b' }));
  });

  it('複数の active な問いに結ばれていれば active 一覧の先頭（作成順）を選ぶ', async () => {
    const { usecase, fire } = build({
      pickled: [makeEntry('e-1', '2026-09-10T00:00:00.000Z')],
      active: [makeQuestion('q-first'), makeQuestion('q-second')],
      linkedByEntry: { 'e-1': ['q-second', 'q-first'] },
    });

    await usecase.execute({ userId: USER_ID });

    expect(fire.execute).toHaveBeenCalledWith(expect.objectContaining({ questionId: 'q-first' }));
  });

  it('強制発火が何も返さなければ nothing-to-ferment に倒す', async () => {
    const fire: Pick<FireFermentationUsecase, 'execute'> = {
      execute: vi.fn().mockResolvedValue({ fired: [] }),
    };
    const { usecase } = build({
      pickled: [makeEntry('e-1', '2026-09-10T00:00:00.000Z')],
      active: [makeQuestion('q-1')],
      linkedByEntry: { 'e-1': ['q-1'] },
      fire,
    });

    await expect(usecase.execute({ userId: USER_ID })).resolves.toEqual({
      fired: false,
      reason: 'nothing-to-ferment',
    });
  });

  it('強制発火の失敗（LLM 等）はそのまま伝える', async () => {
    const fire: Pick<FireFermentationUsecase, 'execute'> = {
      execute: vi.fn().mockRejectedValue(new Error('LLM analysis failed: boom')),
    };
    const { usecase } = build({
      pickled: [makeEntry('e-1', '2026-09-10T00:00:00.000Z')],
      active: [makeQuestion('q-1')],
      linkedByEntry: { 'e-1': ['q-1'] },
      fire,
    });

    await expect(usecase.execute({ userId: USER_ID })).rejects.toThrow(/LLM analysis failed/);
  });
});
