import { anthropic } from '@ai-sdk/anthropic';
import { MAX_OCR_TEXT_LENGTH } from '@oryzae/shared';
import { generateText } from 'ai';
import { OCR_MODEL_ID } from '../../../shared/infrastructure/claude-pricing.js';
import type { OcrGateway, OcrResult } from '../../domain/gateways/ocr.gateway.js';

// provider は発酵分析 (vercel-ai-analysis.gateway.ts) と同じだが、**モデルは別**。
// あちらは claude-sonnet-4-6、こちらは claude-opus-5。手書きの読み取りは誤読が
// そのままスニペットの中身になるので、精度を優先している。
//
// モデル ID は claude-pricing.ts から取る。ベタ書きしないのは、コストのモデル別内訳が
// 「どのモデルが OCR か」を知っている必要があるため（実額を用途別に読むのに使う）。
// 型では守れない——AnthropicModelId は末尾が `(string & {})` なので任意の文字列が通る。
//
// OCR は「見えている文字をそのまま書き起こす」だけの単発呼び出しなので、
// generateObject ではなく generateText で足りる。
const MODEL = OCR_MODEL_ID;

const PROMPT = `この画像に写っている文字をそのまま書き起こしてください。

- 手書き・印刷どちらも対象。読める文字だけを、原文の言語のまま書き起こす
- 翻訳・要約・補完・誤字修正はしない
- 改行やレイアウトは無理に再現せず、読める順に自然な1〜数行にまとめる
- 説明文・前置き・引用符・マークダウン記法は付けない。書き起こした本文だけを返す
- 文字が写っていない、または判読できないほど不鮮明なら、何も書かず空のまま返す`;

/** 前後の空白と、モデルが付けがちな囲み記号を落とす。 */
function cleanup(raw: string): string {
  const trimmed = raw.trim();
  const unfenced = trimmed.replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/, '');
  return unfenced.trim().slice(0, MAX_OCR_TEXT_LENGTH);
}

// テストから参照するため export（vercel-ai-analysis.gateway.ts と同じ方式）。
export const __INTERNAL = { cleanup, MODEL, PROMPT };

export class AnthropicOcrGateway implements OcrGateway {
  async extractText(params: { image: ArrayBuffer; mediaType: string }): Promise<OcrResult> {
    const { text, usage } = await generateText({
      model: anthropic(MODEL),
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: PROMPT },
            // 'image' パートは AI SDK v6 で deprecated（実行時に警告が出る）。
            // 画像も mediaType 付きの 'file' パートで渡すのが現行の形。
            { type: 'file', data: params.image, mediaType: params.mediaType },
          ],
        },
      ],
      maxOutputTokens: 1024,
    });

    return {
      text: cleanup(text),
      usage: {
        inputTokens: usage.inputTokens ?? 0,
        outputTokens: usage.outputTokens ?? 0,
      },
    };
  }
}
