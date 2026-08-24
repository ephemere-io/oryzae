import { beforeEach, describe, expect, it, vi } from 'vitest';

// 実 LLM は呼ばず、generateText/anthropic をモックしてリクエスト構築と
// レスポンス解析の「契約」を固定する（fermentation の gateway テストと同じ流儀）。
const { generateTextMock, anthropicMock } = vi.hoisted(() => ({
  generateTextMock: vi.fn(),
  anthropicMock: vi.fn((modelId: string) => ({ __mockModel: modelId })),
}));
vi.mock('ai', () => ({ generateText: generateTextMock }));
vi.mock('@ai-sdk/anthropic', () => ({ anthropic: anthropicMock }));

import {
  __INTERNAL,
  AnthropicPhotoTranscriptionGateway,
} from '@/contexts/entry/infrastructure/llm/anthropic-photo-transcription.gateway.js';

describe('buildPrompt', () => {
  it('ja では日本語・縦書きの前提を伝える', () => {
    const prompt = __INTERNAL.buildPrompt('ja');
    expect(prompt).toContain('日本語が中心です');
    expect(prompt).toContain('縦書き');
  });

  it('ja 以外ではロケールを埋め込む', () => {
    const prompt = __INTERNAL.buildPrompt('en');
    expect(prompt).toContain('primarily in "en"');
    expect(prompt).not.toContain('日本語が中心です');
  });

  it('推測での補完と前置きを禁じる指示を必ず含む', () => {
    for (const language of ['ja', 'en']) {
      const prompt = __INTERNAL.buildPrompt(language);
      // OCR 結果をそのまま本文に流し込むため、勝手な補完・要約は事故になる。
      expect(prompt).toContain('[?]');
      expect(prompt).toContain('要約は一切書かない');
    }
  });
});

describe('AnthropicPhotoTranscriptionGateway', () => {
  let gateway: AnthropicPhotoTranscriptionGateway;

  beforeEach(() => {
    generateTextMock.mockReset();
    anthropicMock.mockClear();
    generateTextMock.mockResolvedValue({
      text: '今日は雨だった。',
      usage: { inputTokens: 1800, outputTokens: 40 },
    });
    gateway = new AnthropicPhotoTranscriptionGateway();
  });

  it('画像と指示を1つの user メッセージで送り、結果とトークン数を返す', async () => {
    const bytes = new Uint8Array([1, 2, 3, 4]);

    const result = await gateway.transcribe(bytes.buffer, 'image/jpeg', 'ja');

    expect(result).toEqual({
      text: '今日は雨だった。',
      // 使用量をモデル別の単価で記録するため、どのモデルで起こしたかを返す。
      model: __INTERNAL.OCR_MODEL,
      inputTokens: 1800,
      outputTokens: 40,
    });
    expect(anthropicMock).toHaveBeenCalledWith(__INTERNAL.OCR_MODEL);

    const request = generateTextMock.mock.calls[0][0];
    expect(request.messages).toHaveLength(1);
    expect(request.messages[0].role).toBe('user');
    const [textPart, imagePart] = request.messages[0].content;
    expect(textPart.type).toBe('text');
    expect(imagePart.type).toBe('image');
    expect(imagePart.mediaType).toBe('image/jpeg');
    expect(imagePart.image).toEqual(bytes);
  });

  it('contentType をそのまま mediaType に載せる', async () => {
    await gateway.transcribe(new Uint8Array([1]).buffer, 'image/webp', 'ja');

    const request = generateTextMock.mock.calls[0][0];
    expect(request.messages[0].content[1].mediaType).toBe('image/webp');
  });

  it('前後の空白を落として返す（本文に挿入するため）', async () => {
    generateTextMock.mockResolvedValue({
      text: '\n\n  書き起こし本文  \n',
      usage: { inputTokens: 10, outputTokens: 5 },
    });

    const result = await gateway.transcribe(new Uint8Array([1]).buffer, 'image/jpeg', 'ja');

    expect(result.text).toBe('書き起こし本文');
  });

  it('usage が欠けていてもトークン数は 0 で埋める', async () => {
    generateTextMock.mockResolvedValue({ text: 'x', usage: {} });

    const result = await gateway.transcribe(new Uint8Array([1]).buffer, 'image/jpeg', 'ja');

    expect(result).toEqual({
      text: 'x',
      model: __INTERNAL.OCR_MODEL,
      inputTokens: 0,
      outputTokens: 0,
    });
  });
});
