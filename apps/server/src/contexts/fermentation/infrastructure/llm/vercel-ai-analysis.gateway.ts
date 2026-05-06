import { gateway, generateObject } from 'ai';
import { z } from 'zod';
import type {
  LlmAnalysisGateway,
  LlmAnalysisResult,
} from '../../domain/gateways/llm-analysis.gateway.js';
import type { FermentationLanguage } from '../../domain/services/fermentation-eligibility.service.js';

// issue #279: 出力言語ごとの schema description / prompt 文言。
// snippet type のラベル (new_perspective/deepen/core) はキーは固定、語訳のみ言語別。
const SCHEMA_LABELS = {
  ja: {
    worksheet: 'M-GTA分析ワークシート（Markdown形式）。概念名・定義・具体例・理論的メモを含む',
    resultDiagram: '結果図とストーリーライン（Markdown形式）',
    snippets: '日記から抽出した3つの切片',
    snippetType: '切片の種類',
    snippetText: '原文からの引用テキスト',
    snippetSourceDate: '出典日付',
    snippetReason: 'この切片を選んだ理由',
    letter:
      '500字程度の観察メモ。乳酸菌が日記に取り付き第三者視点で淡々と解釈した記録。要約ではなく言い換えで書く',
    keyword: '短い詩的キーワード',
    keywordDescription: 'キーワードの説明',
    keywords: '3〜5個の詩的キーワード',
  },
  en: {
    worksheet:
      'M-GTA analysis worksheet (Markdown). Includes concept names, definitions, concrete examples, and theoretical memos.',
    resultDiagram: 'Result diagram and storyline (Markdown).',
    snippets: 'Three snippets extracted from the journal entries.',
    snippetType: 'Snippet category.',
    snippetText: 'Verbatim quote from the source text.',
    snippetSourceDate: 'Date of the source entry.',
    snippetReason: 'Why this snippet was selected.',
    letter:
      'About 100 words. Observation note written by lactic-acid bacteria clinging to the journal, interpreting it from a third-person perspective. Paraphrase, do not summarize.',
    keyword: 'A short, poetic keyword or phrase.',
    keywordDescription: 'Brief description of the keyword.',
    keywords: 'Three to five poetic keywords or phrases.',
  },
} as const satisfies Record<FermentationLanguage, Record<string, string>>;

function buildSchema(language: FermentationLanguage) {
  const L = SCHEMA_LABELS[language];
  return z.object({
    worksheetMarkdown: z.string().describe(L.worksheet),
    resultDiagramMarkdown: z.string().describe(L.resultDiagram),
    snippets: z
      .array(
        z.object({
          type: z.enum(['new_perspective', 'deepen', 'core']).describe(L.snippetType),
          text: z.string().describe(L.snippetText),
          sourceDate: z.string().describe(L.snippetSourceDate),
          reason: z.string().describe(L.snippetReason),
        }),
      )
      .describe(L.snippets),
    letterBody: z.string().describe(L.letter),
    keywords: z
      .array(
        z.object({
          keyword: z.string().describe(L.keyword),
          description: z.string().describe(L.keywordDescription),
        }),
      )
      .describe(L.keywords),
  });
}

interface PromptParams {
  question: string;
  entryContent: string;
  targetPeriod: string;
}

function buildPromptJa(params: PromptParams): string {
  return `あなたは Oryzae の発酵分析エンジンです。
ユーザーの日記エントリを、修正版グラウンデッド・セオリー・アプローチ（M-GTA）で分析してください。

## 言語

すべての出力 (worksheetMarkdown / resultDiagramMarkdown / snippets / letterBody / keywords) を日本語で生成すること。

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
- 切片の引用テキストは原文（日本語）のまま用いる。要約や翻訳はしない

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

function buildPromptEn(params: PromptParams): string {
  return `You are Oryzae's fermentation analysis engine.
Analyze the user's journal entries using Modified Grounded Theory Approach (M-GTA).

## Language

Generate every output field (worksheetMarkdown, resultDiagramMarkdown, snippets, letterBody, keywords) in natural English suited to a self-reflective journaler. Do not produce machine-translated Japanese.

## Input

**Question:** ${params.question}
**Target period:** ${params.targetPeriod}

**Journal entries:**
---
${params.entryContent}
---

## Three analysis steps

### Step 1 "Koji mold": decomposing the journal
- Following M-GTA, extract 2–3 concepts that relate to the question.
- For each concept, attach a definition, concrete examples, and a theoretical memo.
- Group the relationships between concepts into categories and write a storyline.
- Extract three snippets, one of each type: new_perspective, deepen, core.
- Quote snippet text verbatim from the entries (in the original language). Do not summarize or translate the quoted text.

### Step 2 "Lactic acid bacteria": the observation note
- Frame: a colony of lactic-acid bacteria that happened to settle on the journal and jotted down its own interpretation as an observation note.
- This is NOT a letter to the writer. Do not address them, do not console them. Observe and interpret as a detached third party.
- About 100 words (≈500 Japanese characters worth of substance). Do not summarize — paraphrase the human's activity from the bacteria's vantage point.
- Tone: calm, observational. No emotional empathy. Record the patterns and structures you notice.
- The writer should experience being read by an outside, non-human observer.

#### Forbidden phrasing (do not use; if you add to this list, follow the same spirit)
- "I empathize" / "I feel for you" / similar empathetic statements
- "I sense potential" / "promising" framings
- "we" / "our" used to include the writer
- Second-person address ("you", "your") that targets the writer as recipient

#### Preferred rephrasings
- "our X" → "the human's X" (use detached third-person collectives)

### Step 3 "Yeast": keyword generation
- Generate 3–5 short, poetic keywords or phrases.
- Evoke a broader perspective rather than fixating on the question itself.`;
}

function buildPrompt(params: PromptParams, language: FermentationLanguage): string {
  return language === 'en' ? buildPromptEn(params) : buildPromptJa(params);
}

// テストから参照するため export。
export const __INTERNAL = { buildPrompt, buildSchema, SCHEMA_LABELS };

export class VercelAiAnalysisGateway implements LlmAnalysisGateway {
  async analyze(params: {
    question: string;
    entryContent: string;
    targetPeriod: string;
    userId: string;
    language: FermentationLanguage;
  }): Promise<LlmAnalysisResult> {
    const { object, usage, providerMetadata } = await generateObject({
      model: gateway('anthropic/claude-sonnet-4-20250514'),
      prompt: buildPrompt(
        {
          question: params.question,
          entryContent: params.entryContent,
          targetPeriod: params.targetPeriod,
        },
        params.language,
      ),
      schema: buildSchema(params.language),
      maxOutputTokens: 16000,
      providerOptions: {
        gateway: {
          user: params.userId,
          tags: ['fermentation', `lang:${params.language}`],
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
