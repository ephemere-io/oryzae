import { describe, expect, it } from 'vitest';
import { __INTERNAL } from '@/contexts/fermentation/infrastructure/llm/vercel-ai-analysis.gateway.js';

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
