import { gateway, generateObject } from 'ai';
import { z } from 'zod';
import type {
  LlmAnalysisGateway,
  LlmAnalysisResult,
} from '../../domain/gateways/llm-analysis.gateway.js';

const fermentationSchema = z.object({
  worksheetMarkdown: z
    .string()
    .describe('M-GTA分析ワークシート（Markdown形式）。概念名・定義・具体例・理論的メモを含む'),
  resultDiagramMarkdown: z.string().describe('結果図とストーリーライン（Markdown形式）'),
  snippets: z
    .array(
      z.object({
        type: z.enum(['new_perspective', 'deepen', 'core']).describe('切片の種類'),
        text: z.string().describe('原文からの引用テキスト'),
        sourceDate: z.string().describe('出典日付'),
        reason: z.string().describe('この切片を選んだ理由'),
      }),
    )
    .describe('日記から抽出した3つの切片'),
  letterBody: z.string().describe('500字程度の詩的な手紙。要約ではなく言い換えで書く'),
  keywords: z
    .array(
      z.object({
        keyword: z.string().describe('短い詩的キーワード'),
        description: z.string().describe('キーワードの説明'),
      }),
    )
    .describe('3〜5個の詩的キーワード'),
});

function buildPrompt(params: {
  question: string;
  entryContent: string;
  targetPeriod: string;
}): string {
  return `あなたは Oryzae の発酵分析エンジンです。
ユーザーの日記エントリを、修正版グラウンデッド・セオリー・アプローチ（M-GTA）で分析してください。

## 入力情報

**問い:** ${params.question}
**対象期間:** ${params.targetPeriod}

**日記エントリ:**
---
${params.entryContent}
---

## 分析の3ステップ

### ステップ1「コウジカビ」：日記の分解
- M-GTAに基づき、問いに関連する概念を2〜3個抽出
- 各概念に定義・具体例・理論的メモを付与
- 概念間の関係をカテゴリーにまとめ、ストーリーラインを記述
- 切片を3種類（new_perspective=新視点・deepen=深化・core=核心）抽出

### ステップ2「乳酸菌」：手紙の生成
- 分析を元に、500字程度の詩的な手紙を生成
- 要約ではなく、言い換え・パラフレーズで書く
- ジャーナリングを続けたくなるインスピレーションを与える

### ステップ3「酵母」：キーワードの生成
- 3〜5個の詩的キーワード/フレーズを生成
- 問いに固着しない、より広い視座を喚起するもの`;
}

export class VercelAiAnalysisGateway implements LlmAnalysisGateway {
  async analyze(params: {
    question: string;
    entryContent: string;
    targetPeriod: string;
    userId: string;
  }): Promise<LlmAnalysisResult> {
    const { object, usage, providerMetadata } = await generateObject({
      model: gateway('anthropic/claude-sonnet-4-20250514'),
      prompt: buildPrompt(params),
      schema: fermentationSchema,
      maxOutputTokens: 16000,
      providerOptions: {
        gateway: {
          user: params.userId,
          tags: ['fermentation'],
        },
      },
    });

    // @type-assertion-allowed: providerMetadata の gateway 型は AI SDK の型定義に含まれない
    const meta = providerMetadata as
      | { gateway?: { generationId?: string; cost?: number } }
      | undefined;

    return {
      output: object,
      usage: {
        inputTokens: usage.inputTokens ?? 0,
        outputTokens: usage.outputTokens ?? 0,
      },
      generationId: meta?.gateway?.generationId,
      estimatedCostUsd: meta?.gateway?.cost,
    };
  }
}
