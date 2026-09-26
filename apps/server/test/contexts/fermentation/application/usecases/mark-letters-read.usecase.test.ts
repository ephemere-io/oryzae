import { describe, expect, it, vi } from 'vitest';
import { MarkLettersReadUsecase } from '@/contexts/fermentation/application/usecases/mark-letters-read.usecase.js';
import type { FermentationRepositoryGateway } from '@/contexts/fermentation/domain/gateways/fermentation-repository.gateway.js';

// markReadByQuestionId だけ振る舞いを差し替え、他は呼ばれない前提で素の vi.fn() スタブにする。
function buildRepo(marked: number): FermentationRepositoryGateway {
  return {
    save: vi.fn(),
    update: vi.fn(),
    findById: vi.fn(),
    findByIdWithDetails: vi.fn(),
    listByQuestionId: vi.fn(),
    listByUserId: vi.fn(),
    listRetryable: vi.fn(),
    markReadByQuestionId: vi.fn().mockResolvedValue(marked),
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

const NOW = new Date('2026-09-20T12:00:00.000Z');

describe('MarkLettersReadUsecase', () => {
  it('問い単位で read_at を「今」で埋め、埋めた行数を返す', async () => {
    const repo = buildRepo(2);
    const usecase = new MarkLettersReadUsecase(repo, () => NOW);

    const result = await usecase.execute({ userId: 'user-1', questionId: 'q-1' });

    expect(repo.markReadByQuestionId).toHaveBeenCalledWith('user-1', 'q-1', NOW.toISOString());
    expect(result).toEqual({ marked: 2 });
  });

  it('既読済みばかり（書く行が無い）なら marked=0 で正常終了する（冪等）', async () => {
    const repo = buildRepo(0);
    const usecase = new MarkLettersReadUsecase(repo, () => NOW);

    await expect(usecase.execute({ userId: 'user-1', questionId: 'q-1' })).resolves.toEqual({
      marked: 0,
    });
  });

  it('repository の失敗はそのまま伝える（握りつぶさない）', async () => {
    const repo = buildRepo(0);
    vi.mocked(repo.markReadByQuestionId).mockRejectedValue(new Error('db down'));
    const usecase = new MarkLettersReadUsecase(repo, () => NOW);

    await expect(usecase.execute({ userId: 'user-1', questionId: 'q-1' })).rejects.toThrow(
      'db down',
    );
  });
});
