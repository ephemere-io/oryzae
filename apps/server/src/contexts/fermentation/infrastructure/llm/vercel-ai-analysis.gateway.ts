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
  letterBody: z
    .string()
    .describe(
      '500字程度の観察メモ。乳酸菌が日記に取り付き第三者視点で淡々と解釈した記録。要約ではなく言い換えで書く',
    ),
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

### ステップ2「乳酸菌」：観察メモの生成
- 体裁: 日記にたまたま取り付いた乳酸菌が、勝手に解釈を書き留めた観察メモ
- 書き手に宛てた手紙ではない。呼びかけず、寄り添わず、第三者として淡々と観察・解釈する
- 500字程度。要約ではなく言い換え・パラフレーズで、人間の営みに対する乳酸菌視点の解釈を記述
- トーン: 淡々とした観察口調。感情に寄り添わず、発見したパターン・構造を記録する
- 読んだ書き手が、第三者的な存在による読み解きを経験できること

#### 禁止表現（使わない。追記する場合はこのリストに追加すること）
- 「共感する」
- 「可能性を感じる」
- 「私たち」
- 「わたしたちの」
- 二人称での呼びかけ（「あなた」「きみ」等、書き手を宛先にしない）

#### 推奨の言い換え
- 「わたしたちの○○」→「人間の○○」（客観的な総称に置換）

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
    const meta = providerMetadata as { gateway?: { generationId?: string } } | undefined;

    return {
      output: object,
      usage: {
        inputTokens: usage.inputTokens ?? 0,
        outputTokens: usage.outputTokens ?? 0,
      },
      generationId: meta?.gateway?.generationId,
    };
  }
}
