import { MAX_OCR_TEXT_LENGTH } from '@oryzae/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// AI SDK (ai / @ai-sdk/anthropic) に対する characterization。
// 実 LLM は呼ばず generateText/anthropic をモックし、extractText() の
// リクエスト構築とレスポンス整形の「契約」を固定する。
// （vercel-ai-analysis.gateway.test.ts と同じ二段構え：型表面は typecheck、
//   マッピングロジックはこのテスト。）
const { generateTextMock, anthropicMock } = vi.hoisted(() => ({
  generateTextMock: vi.fn(),
  anthropicMock: vi.fn((modelId: string) => ({ __mockModel: modelId })),
}));
vi.mock('ai', () => ({ generateText: generateTextMock }));
vi.mock('@ai-sdk/anthropic', () => ({ anthropic: anthropicMock }));

import {
  __INTERNAL,
  AnthropicOcrGateway,
} from '@/contexts/board/infrastructure/ocr/anthropic-ocr.gateway.js';

function mockReply(text: string) {
  generateTextMock.mockResolvedValue({
    text,
    usage: { inputTokens: 1200, outputTokens: 24 },
  });
}

const image = new ArrayBuffer(64);

beforeEach(() => {
  vi.clearAllMocks();
  mockReply('読み取れた文字');
});

describe('AnthropicOcrGateway.extractText', () => {
  it('画像を mediaType 付きの file パートで渡す（image パートは v6 で deprecated）', async () => {
    await new AnthropicOcrGateway().extractText({ image, mediaType: 'image/png' });

    expect(generateTextMock).toHaveBeenCalledTimes(1);
    const call = generateTextMock.mock.calls[0][0];
    expect(call.messages).toEqual([
      {
        role: 'user',
        content: [
          { type: 'text', text: __INTERNAL.PROMPT },
          { type: 'file', data: image, mediaType: 'image/png' },
        ],
      },
    ]);
  });

  it('installed な @ai-sdk/anthropic が受け付けるモデル ID を使う', async () => {
    await new AnthropicOcrGateway().extractText({ image, mediaType: 'image/jpeg' });

    expect(anthropicMock).toHaveBeenCalledWith(__INTERNAL.MODEL);
    // typecheck が AnthropicModelId との一致を守る。ここでは「発酵分析とは別枠で
    // 明示的に選んだモデルである」ことを固定し、うっかり書き換えを検出する。
    expect(__INTERNAL.MODEL).toBe('claude-opus-5');
  });

  it('トークン使用量をそのまま返す（将来コストを記録するときの取り出し口）', async () => {
    const result = await new AnthropicOcrGateway().extractText({ image, mediaType: 'image/png' });

    expect(result.usage).toEqual({ inputTokens: 1200, outputTokens: 24 });
  });

  it('usage が欠けていても 0 に倒す', async () => {
    generateTextMock.mockResolvedValue({ text: 'x', usage: {} });

    const result = await new AnthropicOcrGateway().extractText({ image, mediaType: 'image/png' });

    expect(result.usage).toEqual({ inputTokens: 0, outputTokens: 0 });
  });
});

describe('cleanup', () => {
  it('前後の空白を落とす', () => {
    expect(__INTERNAL.cleanup('  発酵は待つことでしか起こらない \n')).toBe(
      '発酵は待つことでしか起こらない',
    );
  });

  it('モデルが付けがちなコードフェンスを剥がす', () => {
    expect(__INTERNAL.cleanup('```\n発酵は待つ\n```')).toBe('発酵は待つ');
    expect(__INTERNAL.cleanup('```text\n発酵は待つ\n```')).toBe('発酵は待つ');
  });

  it('本文中の改行は残す（読み取り順を壊さない）', () => {
    expect(__INTERNAL.cleanup('一行目\n二行目')).toBe('一行目\n二行目');
  });

  it('読み取れなかった（空）ときは空文字のまま', () => {
    expect(__INTERNAL.cleanup('   \n  ')).toBe('');
  });

  it('上限を超える長文は MAX_OCR_TEXT_LENGTH で打ち切る', () => {
    const long = 'あ'.repeat(MAX_OCR_TEXT_LENGTH + 500);

    expect(__INTERNAL.cleanup(long)).toHaveLength(MAX_OCR_TEXT_LENGTH);
  });
});
