import { beforeEach, describe, expect, it, vi } from 'vitest';

// AI SDK (ai / @ai-sdk/anthropic) のメジャー更新に対する characterization。
// 実 LLM は呼ばず、generateObject/anthropic をモックして analyze() の
// リクエスト構築とレスポンス解析の「契約」を固定する。SDK の型表面は typecheck が、
// マッピングロジックはこのテストが守る二段構え。
const { generateObjectMock, anthropicMock } = vi.hoisted(() => ({
  generateObjectMock: vi.fn(),
  anthropicMock: vi.fn((modelId: string) => ({ __mockModel: modelId })),
}));
vi.mock('ai', () => ({ generateObject: generateObjectMock }));
vi.mock('@ai-sdk/anthropic', () => ({ anthropic: anthropicMock }));

import {
  __INTERNAL,
  VercelAiAnalysisGateway,
} from '@/contexts/fermentation/infrastructure/llm/vercel-ai-analysis.gateway.js';

// issue #279: ja/en でプロンプトと schema description が切り替わることを担保する。
// 実 LLM 呼び出しはモックされた application 層からは見えないので、
// infrastructure 内部の buildPrompt/buildSchema を直接検証する。
describe('VercelAiAnalysisGateway prompts (issue #279)', () => {
  const sampleInput = {
    question: 'Why do I write?',
    entryContent: 'Today I wrote because I felt restless.',
    targetPeriod: '2026-05-06',
  };

  describe('buildPrompt', () => {
    it('emits a Japanese prompt when language="ja"', () => {
      const prompt = __INTERNAL.buildPrompt(sampleInput, 'ja');
      expect(prompt).toContain('Oryzae の発酵分析エンジン');
      expect(prompt).toContain('日本語で生成');
      expect(prompt).toContain('M-GTA');
      expect(prompt).toContain('「コウジカビ」');
      expect(prompt).toContain('「乳酸菌」');
      expect(prompt).toContain('「酵母」');
      // English-only sentinel must not appear in the ja branch.
      expect(prompt).not.toContain("Oryzae's fermentation analysis engine");
    });

    it('emits an English prompt when language="en"', () => {
      const prompt = __INTERNAL.buildPrompt(sampleInput, 'en');
      expect(prompt).toContain("Oryzae's fermentation analysis engine");
      expect(prompt).toContain('Generate every output field');
      expect(prompt).toContain('Modified Grounded Theory Approach');
      expect(prompt).toContain('Koji mold');
      expect(prompt).toContain('Lactic acid bacteria');
      expect(prompt).toContain('Yeast');
      // ja-only sentinels must not bleed into the en prompt.
      expect(prompt).not.toContain('日本語で生成');
      expect(prompt).not.toContain('「コウジカビ」');
    });

    it('embeds the question, entry content, and target period in both languages', () => {
      for (const lang of ['ja', 'en'] as const) {
        const prompt = __INTERNAL.buildPrompt(sampleInput, lang);
        expect(prompt).toContain(sampleInput.question);
        expect(prompt).toContain(sampleInput.entryContent);
        expect(prompt).toContain(sampleInput.targetPeriod);
      }
    });

    it('keeps verbatim-quote instruction in both branches (snippet text must stay in source language)', () => {
      expect(__INTERNAL.buildPrompt(sampleInput, 'ja')).toContain('原文');
      expect(__INTERNAL.buildPrompt(sampleInput, 'en')).toContain('verbatim');
    });
  });

  describe('buildSchema descriptions', () => {
    it('localizes the worksheet description per language', () => {
      const ja = __INTERNAL.SCHEMA_LABELS.ja.worksheet;
      const en = __INTERNAL.SCHEMA_LABELS.en.worksheet;
      expect(ja).toContain('M-GTA分析ワークシート');
      expect(en).toContain('M-GTA analysis worksheet');
      expect(ja).not.toEqual(en);
    });

    it('localizes the letter description per language', () => {
      const ja = __INTERNAL.SCHEMA_LABELS.ja.letter;
      const en = __INTERNAL.SCHEMA_LABELS.en.letter;
      expect(ja).toContain('観察メモ');
      expect(en.toLowerCase()).toContain('observation note');
    });

    it('produces a valid Zod schema for both languages', () => {
      const validOutput = {
        worksheetMarkdown: '# Worksheet',
        resultDiagramMarkdown: '# Diagram',
        snippets: [{ type: 'core', text: 't', sourceDate: '2026-05-06', reason: 'r' }],
        letterBody: 'observation',
        keywords: [{ keyword: 'k', description: 'd' }],
      };
      expect(__INTERNAL.buildSchema('ja').safeParse(validOutput).success).toBe(true);
      expect(__INTERNAL.buildSchema('en').safeParse(validOutput).success).toBe(true);
    });
  });
});

// AI SDK メジャー更新 (ai 6→7 / @ai-sdk/anthropic 3→4) の前後で挙動を固定する
// characterization。generateObject への渡し方と戻り値の解釈が変わらないことを担保。
describe('VercelAiAnalysisGateway.analyze — AI SDK contract characterization', () => {
  const sampleOutput = {
    worksheetMarkdown: '# WS',
    resultDiagramMarkdown: '# RD',
    snippets: [{ type: 'core', text: 't', sourceDate: '2026-05-06', reason: 'r' }],
    letterBody: 'observation note',
    keywords: [{ keyword: 'k', description: 'd' }],
  };
  const params = {
    question: 'Why do I write?',
    entryContent: 'Today I wrote because I felt restless.',
    targetPeriod: '2026-05-06',
    userId: 'user-1',
    language: 'ja' as const,
  };

  beforeEach(() => {
    generateObjectMock.mockReset();
    anthropicMock.mockClear();
    generateObjectMock.mockResolvedValue({
      object: sampleOutput,
      usage: { inputTokens: 1234, outputTokens: 567 },
    });
  });

  it('calls generateObject with the anthropic claude-sonnet-4-6 model and maxOutputTokens=16000', async () => {
    await new VercelAiAnalysisGateway().analyze(params);

    expect(generateObjectMock).toHaveBeenCalledTimes(1);
    expect(anthropicMock).toHaveBeenCalledWith('claude-sonnet-4-6');

    const callArg = generateObjectMock.mock.calls[0]?.[0];
    expect(callArg.model).toEqual({ __mockModel: 'claude-sonnet-4-6' });
    expect(callArg.maxOutputTokens).toBe(16000);
  });

  it('passes the language-specific prompt and a schema that validates the expected shape', async () => {
    await new VercelAiAnalysisGateway().analyze(params);

    const callArg = generateObjectMock.mock.calls[0]?.[0];
    // ja プロンプトの sentinel。言語分岐が analyze 経由でも効いていること。
    expect(callArg.prompt).toContain('Oryzae の発酵分析エンジン');
    expect(callArg.prompt).toContain(params.question);
    expect(callArg.prompt).toContain(params.entryContent);
    // schema は Zod。generateObject に渡る schema が期待形を受理する。
    expect(callArg.schema.safeParse(sampleOutput).success).toBe(true);
  });

  it('maps the SDK response object and usage onto LlmAnalysisResult', async () => {
    const result = await new VercelAiAnalysisGateway().analyze(params);

    expect(result.output).toEqual(sampleOutput);
    expect(result.usage).toEqual({ inputTokens: 1234, outputTokens: 567 });
    // issue #352: Anthropic 直叩きのため generation_id は発行されない。
    expect(result.generationId).toBeUndefined();
  });

  it('falls back to 0 when the SDK omits token counts', async () => {
    generateObjectMock.mockResolvedValue({ object: sampleOutput, usage: {} });

    const result = await new VercelAiAnalysisGateway().analyze(params);

    expect(result.usage).toEqual({ inputTokens: 0, outputTokens: 0 });
  });
});
