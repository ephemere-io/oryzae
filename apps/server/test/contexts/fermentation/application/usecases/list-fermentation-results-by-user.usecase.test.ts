import { describe, expect, it, vi } from 'vitest';
import { ListFermentationResultsByUserUsecase } from '@/contexts/fermentation/application/usecases/list-fermentation-results-by-user.usecase.js';
import type { FermentationRepositoryGateway } from '@/contexts/fermentation/domain/gateways/fermentation-repository.gateway.js';
import {
  FermentationResult,
  type FermentationResultProps,
} from '@/contexts/fermentation/domain/models/fermentation-result.js';

function buildResult(overrides: Partial<FermentationResultProps>): FermentationResult {
  return FermentationResult.fromProps({
    id: 'ferm-1',
    userId: 'user-1',
    questionId: 'q-1',
    targetPeriod: '2026-W22',
    status: 'completed',
    generationId: null,
    inputTokens: null,
    outputTokens: null,
    errorMessage: null,
    createdAt: '2026-06-01T00:00:00.000Z',
    updatedAt: '2026-06-01T00:00:00.000Z',
    ...overrides,
  });
}

// listByUserId だけ振る舞いを差し替え、他は呼ばれない前提で素の vi.fn() スタブにする。
function buildRepo(results: FermentationResult[]): FermentationRepositoryGateway {
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

describe('ListFermentationResultsByUserUsecase', () => {
  it('ユーザーの全発酵結果を props 配列で返す（問い横断）', async () => {
    const repo = buildRepo([
      buildResult({ id: 'ferm-a', questionId: 'q-1', status: 'completed' }),
      buildResult({ id: 'ferm-b', questionId: 'q-2', status: 'failed' }),
    ]);
    const usecase = new ListFermentationResultsByUserUsecase(repo);

    const results = await usecase.execute('user-1');

    expect(repo.listByUserId).toHaveBeenCalledWith('user-1');
    expect(repo.listByQuestionId).not.toHaveBeenCalled();
    expect(results).toHaveLength(2);
    expect(results.map((r) => r.id)).toEqual(['ferm-a', 'ferm-b']);
    expect(results.map((r) => r.questionId)).toEqual(['q-1', 'q-2']);
  });

  it('結果が無ければ空配列を返す', async () => {
    const repo = buildRepo([]);
    const usecase = new ListFermentationResultsByUserUsecase(repo);

    const results = await usecase.execute('user-1');

    expect(repo.listByUserId).toHaveBeenCalledWith('user-1');
    expect(results).toEqual([]);
  });
});
