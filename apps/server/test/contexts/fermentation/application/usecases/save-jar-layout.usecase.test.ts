import { describe, expect, it, vi } from 'vitest';
import { SaveJarLayoutUsecase } from '@/contexts/fermentation/application/usecases/save-jar-layout.usecase';
import type { FermentationRepositoryGateway } from '@/contexts/fermentation/domain/gateways/fermentation-repository.gateway';
import type { QuestionRepositoryGateway } from '@/contexts/question/domain/gateways/question-repository.gateway';

function buildQuestionRepo(): QuestionRepositoryGateway {
  return {
    findById: vi.fn(),
    listActiveByUserId: vi.fn(),
    listAllByUserId: vi.fn(),
    listPendingByUserId: vi.fn(),
    countActiveByUserId: vi.fn(),
    save: vi.fn(),
    delete: vi.fn(),
    updateJarPositions: vi.fn().mockResolvedValue(undefined),
  };
}

function buildFermentationRepo(): FermentationRepositoryGateway {
  return {
    save: vi.fn(),
    update: vi.fn(),
    findById: vi.fn(),
    findByIdWithDetails: vi.fn(),
    listByQuestionId: vi.fn(),
    saveScannedEntries: vi.fn(),
    listScannedEntryIds: vi.fn(),
    saveWorksheet: vi.fn(),
    saveSnippets: vi.fn(),
    saveLetter: vi.fn(),
    saveKeywords: vi.fn(),
    updateKeywordJarPositions: vi.fn().mockResolvedValue(undefined),
    updateSnippetJarPositions: vi.fn().mockResolvedValue(undefined),
    updateLetterJarPositions: vi.fn().mockResolvedValue(undefined),
  };
}

describe('SaveJarLayoutUsecase', () => {
  it('全 4 種を対応する repo メソッドにそのまま渡す', async () => {
    const qRepo = buildQuestionRepo();
    const fRepo = buildFermentationRepo();
    const usecase = new SaveJarLayoutUsecase(qRepo, fRepo);

    const input = {
      questions: [{ id: 'q-1', jarX: 10, jarY: 20 }],
      keywords: [
        { id: 'k-1', jarX: 30, jarY: 40 },
        { id: 'k-2', jarX: 50, jarY: 60 },
      ],
      snippets: [{ id: 's-1', jarX: 70, jarY: 80 }],
      letters: [{ id: 'l-1', jarX: 90, jarY: 95 }],
    };

    await usecase.execute(input);

    expect(qRepo.updateJarPositions).toHaveBeenCalledWith(input.questions);
    expect(fRepo.updateKeywordJarPositions).toHaveBeenCalledWith(input.keywords);
    expect(fRepo.updateSnippetJarPositions).toHaveBeenCalledWith(input.snippets);
    expect(fRepo.updateLetterJarPositions).toHaveBeenCalledWith(input.letters);
  });

  it('空配列でも 4 メソッドすべて呼ばれる（リポジトリ側で no-op）', async () => {
    const qRepo = buildQuestionRepo();
    const fRepo = buildFermentationRepo();
    const usecase = new SaveJarLayoutUsecase(qRepo, fRepo);

    await usecase.execute({ questions: [], keywords: [], snippets: [], letters: [] });

    expect(qRepo.updateJarPositions).toHaveBeenCalledWith([]);
    expect(fRepo.updateKeywordJarPositions).toHaveBeenCalledWith([]);
    expect(fRepo.updateSnippetJarPositions).toHaveBeenCalledWith([]);
    expect(fRepo.updateLetterJarPositions).toHaveBeenCalledWith([]);
  });

  it('いずれかの repo が reject すれば throw する', async () => {
    const qRepo = buildQuestionRepo();
    const fRepo = buildFermentationRepo();
    fRepo.updateKeywordJarPositions = vi.fn().mockRejectedValue(new Error('db down'));
    const usecase = new SaveJarLayoutUsecase(qRepo, fRepo);

    await expect(
      usecase.execute({
        questions: [],
        keywords: [{ id: 'k-1', jarX: 0, jarY: 0 }],
        snippets: [],
        letters: [],
      }),
    ).rejects.toThrow('db down');
  });
});
