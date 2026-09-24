import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { createAnthropicMock } = vi.hoisted(() => ({
  createAnthropicMock: vi.fn((options: { apiKey: string }) => ({ __mockProvider: options.apiKey })),
}));
vi.mock('@ai-sdk/anthropic', () => ({ createAnthropic: createAnthropicMock }));

import {
  ANTHROPIC_FEATURE_ENV_VARS,
  type AnthropicFeature,
  anthropicFor,
} from '@/contexts/shared/infrastructure/anthropic-provider.js';

const FEATURES: AnthropicFeature[] = ['fermentation', 'ocrBoard', 'ocrEntry'];

beforeEach(() => {
  vi.clearAllMocks();
});
afterEach(() => {
  vi.unstubAllEnvs();
});

describe('anthropicFor', () => {
  it.each(FEATURES)('%s は自分の環境変数のキーで provider を作る', (feature) => {
    vi.stubEnv(ANTHROPIC_FEATURE_ENV_VARS[feature], `key-for-${feature}`);

    anthropicFor(feature);

    expect(createAnthropicMock).toHaveBeenCalledWith({ apiKey: `key-for-${feature}` });
  });

  // フォールバックがあると、キーを1本消しただけで実額が静かに混ざり、しかも画面に出ない。
  // 2026-09 の課金増で用途を切り分けられなかったのがまさにこの状態だった。
  it('共通の ANTHROPIC_API_KEY にフォールバックしない', () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'shared-legacy-key');
    vi.stubEnv(ANTHROPIC_FEATURE_ENV_VARS.ocrBoard, '');

    expect(() => anthropicFor('ocrBoard')).toThrow(/ANTHROPIC_API_KEY_OCR_BOARD/);
    expect(createAnthropicMock).not.toHaveBeenCalled();
  });

  it.each(FEATURES)('%s のキーが無ければ、その変数名を名指しして落ちる', (feature) => {
    vi.stubEnv(ANTHROPIC_FEATURE_ENV_VARS[feature], '');

    expect(() => anthropicFor(feature)).toThrow(ANTHROPIC_FEATURE_ENV_VARS[feature]);
  });

  // 同じキーを2機能が共有すると Workspace が一致し、cost_report の group_by[]=workspace_id が
  // 1行に潰れる。用途別の実額はこの「全部違う」が成り立っている間だけ読める。
  it('機能ごとに違う環境変数を読む', () => {
    const envVars = FEATURES.map((f) => ANTHROPIC_FEATURE_ENV_VARS[f]);

    expect(new Set(envVars).size).toBe(FEATURES.length);
  });

  it('provider はモジュール読み込み時ではなく呼び出しのたびに作る', () => {
    vi.stubEnv(ANTHROPIC_FEATURE_ENV_VARS.fermentation, 'first-key');
    anthropicFor('fermentation');

    // デプロイ直後に env が差し替わっても次の呼び出しから追随する。読み込み時に
    // 1度だけ作る実装だと、古いキーを掴んだまま動き続ける。
    vi.stubEnv(ANTHROPIC_FEATURE_ENV_VARS.fermentation, 'second-key');
    anthropicFor('fermentation');

    expect(createAnthropicMock).toHaveBeenNthCalledWith(1, { apiKey: 'first-key' });
    expect(createAnthropicMock).toHaveBeenNthCalledWith(2, { apiKey: 'second-key' });
  });
});
