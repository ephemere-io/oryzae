import { anthropic } from '@ai-sdk/anthropic';
import { MAX_OCR_TEXT_LENGTH } from '@oryzae/shared';
import { generateText } from 'ai';
import type { OcrGateway, OcrResult } from '../../domain/gateways/ocr.gateway.js';

// 発酵分析 (vercel-ai-analysis.gateway.ts) と同じ provider を使う。
// OCR は「見えている文字をそのまま書き起こす」だけの単発呼び出しなので、
// generateObject ではなく generateText で足りる。
const MODEL = 'claude-opus-5';

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
