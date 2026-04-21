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
    saveScannedEntries: vi.fn(),
    listScannedEntryIds: vi.fn().mockResolvedValue([]),
    saveWorksheet: vi.fn(),
    saveSnippets: vi.fn(),
    saveLetter: vi.fn(),
    saveKeywords: vi.fn(),
  };
}

function mockLlm(): LlmAnalysisGateway {
  return {
    analyze: vi.fn().mockResolvedValue({
      output: {
        worksheetMarkdown: '### Worksheet',
        resultDiagramMarkdown: '### Diagram',
        snippets: [{ type: 'core', text: 'test text', sourceDate: '12/1', reason: 'test reason' }],
        letterBody: 'Dear user...',
        keywords: [{ keyword: 'test', description: 'a test keyword' }],
      },
      usage: { inputTokens: 100, outputTokens: 200 },
      generationId: 'gen_test123',
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
      entries: [{ id: 'e1', content: 'Today I thought about love.' }],
    });

    expect(result.id).toBe('test-id');
    expect(repo.save).toHaveBeenCalledOnce();
    expect(repo.saveScannedEntries).toHaveBeenCalledWith('test-id', ['e1']);
    expect(repo.update).toHaveBeenCalledTimes(3); // processing + generationId + completed
    expect(llm.analyze).toHaveBeenCalledOnce();
    expect(repo.saveWorksheet).toHaveBeenCalledOnce();
    expect(repo.saveSnippets).toHaveBeenCalledOnce();
    expect(repo.saveLetter).toHaveBeenCalledOnce();
    expect(repo.saveKeywords).toHaveBeenCalledOnce();
  });

  it('saves all scanned entry ids when multiple entries are provided', async () => {
    const repo = mockRepo();
    const llm = mockLlm();
    const usecase = new RunFermentationUsecase(repo, llm, generateId);

    await usecase.execute({
      userId: 'u1',
      questionId: 'q1',
      questionText: 'Q',
      entries: [
        { id: 'e1', content: 'content 1' },
        { id: 'e2', content: 'content 2' },
      ],
    });

    expect(repo.saveScannedEntries).toHaveBeenCalledWith('test-id', ['e1', 'e2']);
    expect(llm.analyze).toHaveBeenCalledWith(
      expect.objectContaining({
        entryContent: 'content 1\n\n---\n\ncontent 2',
      }),
    );
  });

  it('rejects execution when no entries are provided', async () => {
    const repo = mockRepo();
    const usecase = new RunFermentationUsecase(repo, mockLlm(), generateId);

    await expect(
      usecase.execute({ userId: 'u1', questionId: 'q1', questionText: 'Q', entries: [] }),
    ).rejects.toThrow('LLM analysis failed');
    expect(repo.save).not.toHaveBeenCalled();
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
        entries: [{ id: 'e1', content: 'test' }],
      }),
    ).rejects.toThrow('LLM analysis failed');

    // save (pending) + update (processing) + update (failed)
    expect(repo.update).toHaveBeenCalledTimes(2);
    // scanned entries are recorded before LLM runs, so they persist on failure
    expect(repo.saveScannedEntries).toHaveBeenCalledWith('test-id', ['e1']);
  });
});
