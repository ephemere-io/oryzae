import { anthropic } from '@ai-sdk/anthropic';
import { generateText } from 'ai';
import type {
  FermentationOutput,
  LlmAnalysisGateway,
} from '../../domain/gateways/llm-analysis.gateway.js';

function buildPrompt(params: {
  question: string;
  entryContent: string;
  targetPeriod: string;
}): string {
  return `あなたは Oryzae の発酵分析エンジンです。
ユーザーの日記エントリを、修正版グラウンデッド・セオリー・アプローチ（M-GTA）で分析し、
3つのステップで処理してください。

## 入力情報

**問い:** ${params.question}
**対象期間:** ${params.targetPeriod}

**日記エントリ:**
---
${params.entryContent}
---

## 出力形式

以下の JSON 形式で結果を返してください。JSON のみを出力し、他のテキストは含めないでください。

\`\`\`json
{
  "worksheetMarkdown": "### 分析ワークシート\\n\\n#### 概念1：[概念名]\\n\\n| 項目 | 内容 |\\n|------|------|\\n| **概念名** | ... |\\n| **定義** | ... |\\n| **具体例（ヴァリエーション）** | ... |\\n| **理論的メモ** | ... |\\n\\n(概念を必要な数だけ生成)\\n\\n---\\n\\n### 概念間の関係とカテゴリー\\n\\n#### カテゴリーA：[名前]\\n\\n[説明]\\n\\n#### カテゴリーB：[名前]\\n\\n[説明]",
  "resultDiagramMarkdown": "### 結果図\\n\\n\`\`\`\\n[ASCII図]\\n\`\`\`\\n\\n**ストーリーライン:** [概要テキスト]",
  "snippets": [
    {
      "type": "new_perspective",
      "text": "原文からの引用",
      "sourceDate": "日付",
      "reason": "この切片を選んだ理由"
    },
    {
      "type": "deepen",
      "text": "原文からの引用",
      "sourceDate": "日付",
      "reason": "この切片を選んだ理由"
    },
    {
      "type": "core",
      "text": "原文からの引用",
      "sourceDate": "日付",
      "reason": "この切片を選んだ理由"
    }
  ],
  "letterBody": "500字程度の詩的な手紙。要約ではなく、言い換え・別の角度からの光を当てる。ジャーナリングを続けたくなるようなインスピレーションを与える。",
  "keywords": [
    {
      "keyword": "短い詩的キーワード",
      "description": "キーワードの説明。問いに固着しない、より広い視座を喚起するもの。"
    }
  ]
}
\`\`\`

## 分析の指針

### ステップ1「コウジカビ」：日記の分解
- M-GTAに基づき、問いに関連する概念を抽出
- 各概念に定義・具体例・理論的メモを付与
- 概念間の関係をカテゴリーにまとめ、ストーリーラインを記述
- 切片を3種類（新視点・深化・核心）抽出

### ステップ2「乳酸菌」：プロセスの整理
- 分析ワークシートを元に、500字程度の手紙を生成
- 要約ではなく、言い換え・パラフレーズで書く
- ジャーナリングを続けたくなるインスピレーションを与える

### ステップ3「酵母」：キーワードの生成
- 3〜5個のキーワード/フレーズを生成
- 問いに固着しない、より広い視座を喚起するもの
- 詩的で、日常の言葉で表現されたもの`;
}

function parseOutput(text: string): FermentationOutput {
  // Extract JSON from possible markdown code block
  let jsonStr = text;
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    jsonStr = codeBlockMatch[1];
  }

  const parsed = JSON.parse(jsonStr.trim()) as FermentationOutput;

  // Validate structure
  if (!parsed.worksheetMarkdown || !parsed.resultDiagramMarkdown) {
    throw new Error('Missing worksheet or diagram markdown');
  }
  if (!Array.isArray(parsed.snippets) || parsed.snippets.length === 0) {
    throw new Error('Missing snippets');
  }
  if (!parsed.letterBody) {
    throw new Error('Missing letter body');
  }
  if (!Array.isArray(parsed.keywords) || parsed.keywords.length === 0) {
    throw new Error('Missing keywords');
  }

  return parsed;
}

export class VercelAiAnalysisGateway implements LlmAnalysisGateway {
  async analyze(params: {
    question: string;
    entryContent: string;
    targetPeriod: string;
  }): Promise<FermentationOutput> {
    const { text } = await generateText({
      model: anthropic('claude-sonnet-4-20250514'),
      prompt: buildPrompt(params),
      maxOutputTokens: 8000,
    });

    return parseOutput(text);
  }
}
