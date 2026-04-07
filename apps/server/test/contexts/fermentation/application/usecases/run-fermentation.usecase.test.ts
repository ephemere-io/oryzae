import { describe, expect, it, vi } from 'vitest';
import { RunFermentationUsecase } from '@/contexts/fermentation/application/usecases/run-fermentation.usecase.js';
import type { FermentationRepositoryGateway } from '@/contexts/fermentation/domain/gateways/fermentation-repository.gateway.js';
import type { LlmAnalysisGateway } from '@/contexts/fermentation/domain/gateways/llm-analysis.gateway.js';

const generateId = () => 'test-id';

function mockRepo(): FermentationRepositoryGateway {
  return {
    save: vi.fn(),
    update: vi.fn(),
    findById: vi.fn(),
    findByIdWithDetails: vi.fn(),
    listByQuestionId: vi.fn(),
    saveWorksheet: vi.fn(),
    saveSnippets: vi.fn(),
    saveLetter: vi.fn(),
    saveKeywords: vi.fn(),
  };
}

function mockLlm(): LlmAnalysisGateway {
  return {
    analyze: vi.fn().mockResolvedValue({
      worksheetMarkdown: '### Worksheet',
      resultDiagramMarkdown: '### Diagram',
      snippets: [{ type: 'core', text: 'test text', sourceDate: '12/1', reason: 'test reason' }],
      letterBody: 'Dear user...',
      keywords: [{ keyword: 'test', description: 'a test keyword' }],
    }),
  };
}

describe('RunFermentationUsecase', () => {
  it('creates fermentation result and saves all outputs', async () => {
    const repo = mockRepo();
    const llm = mockLlm();
    const usecase = new RunFermentationUsecase(repo, llm, generateId);

    const result = await usecase.execute({
      userId: 'u1',
      questionId: 'q1',
      questionText: 'What is love?',
      entryId: 'e1',
      entryContent: 'Today I thought about love.',
    });

    expect(result.id).toBe('test-id');
    expect(repo.save).toHaveBeenCalledOnce();
    expect(repo.update).toHaveBeenCalledTimes(2); // processing + completed
    expect(llm.analyze).toHaveBeenCalledOnce();
    expect(repo.saveWorksheet).toHaveBeenCalledOnce();
    expect(repo.saveSnippets).toHaveBeenCalledOnce();
    expect(repo.saveLetter).toHaveBeenCalledOnce();
    expect(repo.saveKeywords).toHaveBeenCalledOnce();
  });

  it('marks result as failed when LLM throws', async () => {
    const repo = mockRepo();
    const llm: LlmAnalysisGateway = {
      analyze: vi.fn().mockRejectedValue(new Error('LLM timeout')),
    };
    const usecase = new RunFermentationUsecase(repo, llm, generateId);

    await expect(
      usecase.execute({
        userId: 'u1',
        questionId: 'q1',
        questionText: 'test',
        entryId: 'e1',
        entryContent: 'test',
      }),
    ).rejects.toThrow('LLM analysis failed');

    // save (pending) + update (processing) + update (failed)
    expect(repo.update).toHaveBeenCalledTimes(2);
  });
});
