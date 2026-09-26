import { MAX_OCR_TEXT_LENGTH } from '@oryzae/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// AI SDK (ai / @ai-sdk/anthropic) に対する characterization。
// 実 LLM は呼ばず generateText/anthropic をモックし、extractText() の
// リクエスト構築とレスポンス整形の「契約」を固定する。
// （vercel-ai-analysis.gateway.test.ts と同じ二段構え：型表面は typecheck、
//   マッピングロジックはこのテスト。）
const { generateTextMock, anthropicMock, createAnthropicMock } = vi.hoisted(() => {
  // anthropicMock は provider 本体（= createAnthropic の戻り値）。モデル ID で呼ばれる。
  const anthropicMock = vi.fn((modelId: string) => ({ __mockModel: modelId }));
  return {
    generateTextMock: vi.fn(),
    anthropicMock,
    createAnthropicMock: vi.fn(() => anthropicMock),
  };
});
vi.mock('ai', () => ({ generateText: generateTextMock }));
// 機能別キーで provider を作るようになったため、モックするのは createAnthropic。
// 素の `anthropic` を生やしてしまうと、共通キーに戻す実装が通ってしまう。
vi.mock('@ai-sdk/anthropic', () => ({ createAnthropic: createAnthropicMock }));

import {
  __INTERNAL,
  AnthropicOcrGateway,
} from '@/contexts/board/infrastructure/ocr/anthropic-ocr.gateway.js';

// 機能別キーは実行時に process.env から読む。未設定なら anthropicFor が throw するので、
// ここで明示的に積む（テストが落ちる形で「キーを読んでいる」ことも担保される）。
beforeEach(() => {
  vi.stubEnv('ANTHROPIC_API_KEY_OCR_BOARD', 'test-key-ocr-board');
});
afterEach(() => {
  vi.unstubAllEnvs();
});

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

  it('選んだモデル ID をそのまま SDK へ渡す', async () => {
    await new AnthropicOcrGateway().extractText({ image, mediaType: 'image/jpeg' });

    expect(anthropicMock).toHaveBeenCalledWith(__INTERNAL.MODEL);
    // 写真の文字起こしと同じ claude-sonnet-5 なので、モデルでは用途を区別できない。
    // 実額を分けて読める根拠はキー（＝Workspace）が別であること。
    expect(createAnthropicMock).toHaveBeenCalledWith({ apiKey: 'test-key-ocr-board' });
    // ここが守れるのは「発酵分析とは別枠で明示的に選んだモデルを、加工せず渡している」
    // ことだけ。ID そのものの正しさは型では守れない（AnthropicModelId は末尾が
    // `(string & {})` なので任意の文字列が通る）。綴りの誤りは実行時にしか出ない。
    expect(__INTERNAL.MODEL).toBe('claude-sonnet-5');
  });

  it('トークン使用量をそのまま返す（将来コストを記録するときの取り出し口）', async () => {
    const result = await new AnthropicOcrGateway().extractText({ image, mediaType: 'image/png' });

    expect(result.usage).toEqual({ inputTokens: 1200, outputTokens: 24 });
    // 利用記録（ocr_usage_events）に残すモデル名。gateway が実際に呼んだものを返す
    expect(result.model).toBe(__INTERNAL.MODEL);
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
