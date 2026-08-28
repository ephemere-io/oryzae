import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EntryRepositoryGateway } from '@/contexts/entry/domain/gateways/entry-repository.gateway';
import { Entry } from '@/contexts/entry/domain/models/entry';
import { FermentationNotFoundError } from '@/contexts/fermentation/application/errors/fermentation.errors';
import { GetFermentationResultUsecase } from '@/contexts/fermentation/application/usecases/get-fermentation-result.usecase';
import type { FermentationRepositoryGateway } from '@/contexts/fermentation/domain/gateways/fermentation-repository.gateway';
import { FermentationResult } from '@/contexts/fermentation/domain/models/fermentation-result';

let fermentationRepo: FermentationRepositoryGateway;
let entryRepo: EntryRepositoryGateway;
let usecase: GetFermentationResultUsecase;

function entry(id: string, content: string): Entry {
  return Entry.fromProps({
    id,
    userId: 'user-1',
    content,
    mediaUrls: [],
    fermentationEnabled: true,
    createdAt: '2026-06-01T10:00:00Z',
    updatedAt: '2026-06-01T10:00:00Z',
  });
}

function detailsWith(scannedEntryIds: string[]) {
  return {
    result: FermentationResult.fromProps({
      id: 'f1',
      userId: 'user-1',
      questionId: 'q1',
      targetPeriod: '2026-06',
      status: 'completed',
      generationId: null,
      errorMessage: null,
      inputTokens: null,
      outputTokens: null,
      createdAt: '2026-06-02T00:00:00Z',
      updatedAt: '2026-06-02T00:00:00Z',
    }),
    worksheet: null,
    snippets: [],
    letter: null,
    keywords: [],
    scannedEntryIds,
  };
}

beforeEach(() => {
  fermentationRepo = {
    save: vi.fn().mockResolvedValue(undefined),
    update: vi.fn().mockResolvedValue(undefined),
    findById: vi.fn().mockResolvedValue(null),
    findByIdWithDetails: vi.fn().mockResolvedValue(null),
    listByQuestionId: vi.fn().mockResolvedValue([]),
    listByUserId: vi.fn().mockResolvedValue([]),
    listRetryable: vi.fn().mockResolvedValue([]),
    clearOutputs: vi.fn().mockResolvedValue(undefined),
    saveWorksheet: vi.fn().mockResolvedValue(undefined),
    saveSnippets: vi.fn().mockResolvedValue(undefined),
    saveLetter: vi.fn().mockResolvedValue(undefined),
    saveKeywords: vi.fn().mockResolvedValue(undefined),
    saveScannedEntries: vi.fn().mockResolvedValue(undefined),
    updateJarPositions: vi.fn().mockResolvedValue(undefined),
  };
  entryRepo = {
    findById: vi.fn().mockResolvedValue(null),
    findByIds: vi.fn().mockResolvedValue([]),
    listByUserId: vi.fn().mockResolvedValue([]),
    listByUserIdAndDate: vi.fn().mockResolvedValue([]),
    listFermentationEnabledByUserIdAndDate: vi.fn().mockResolvedValue([]),
    listFermentationEnabledByUserIdSince: vi.fn().mockResolvedValue([]),
    countCharsByUserIdSince: vi.fn().mockResolvedValue(0),
    listByUserIdAndWeek: vi.fn().mockResolvedValue([]),
    save: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
  };
  usecase = new GetFermentationResultUsecase(fermentationRepo, entryRepo);
});

describe('GetFermentationResultUsecase', () => {
  it('見つからなければ FermentationNotFoundError を投げる', async () => {
    await expect(usecase.execute('missing')).rejects.toThrow(FermentationNotFoundError);
  });

  it('走査したエントリを見出し（本文の先頭行）付きで返す（Issue #453）', async () => {
    vi.mocked(fermentationRepo.findByIdWithDetails).mockResolvedValue(detailsWith(['e1', 'e2']));
    vi.mocked(entryRepo.findByIds).mockResolvedValue([
      entry('e1', '朝の光\n窓を開けたら'),
      entry('e2', '\n\n見出しの無い記録'),
    ]);

    const view = await usecase.execute('f1');

    expect(entryRepo.findByIds).toHaveBeenCalledWith(['e1', 'e2']);
    expect(view.scannedEntries).toEqual([
      { id: 'e1', title: '朝の光', createdAt: '2026-06-01T10:00:00Z' },
      { id: 'e2', title: '見出しの無い記録', createdAt: '2026-06-01T10:00:00Z' },
    ]);
  });

  it('走査したエントリが無ければエントリ取得に行かない', async () => {
    vi.mocked(fermentationRepo.findByIdWithDetails).mockResolvedValue(detailsWith([]));

    const view = await usecase.execute('f1');

    expect(view.scannedEntries).toEqual([]);
    expect(entryRepo.findByIds).not.toHaveBeenCalled();
  });

  it('見出しは 100 文字で切る（一覧の見た目を壊さない）', async () => {
    vi.mocked(fermentationRepo.findByIdWithDetails).mockResolvedValue(detailsWith(['e1']));
    vi.mocked(entryRepo.findByIds).mockResolvedValue([entry('e1', 'あ'.repeat(150))]);

    const view = await usecase.execute('f1');

    expect(view.scannedEntries[0].title).toHaveLength(100);
  });
});
