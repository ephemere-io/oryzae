import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockNotifyDiscord = vi.fn();

vi.mock('@/contexts/shared/infrastructure/discord-notify.js', () => ({
  COLORS: { SUCCESS: 1, WARNING: 2, ERROR: 3, INFO: 4 },
  notifyDiscord: (...args: unknown[]) => mockNotifyDiscord(...args),
}));

import { COLORS } from '@/contexts/shared/infrastructure/discord-notify.js';

/**
 * 前日のコストは 2 つのテーブルのトークン数から出す。
 * （以前は fermentation_results の generation_id を辿っていたが、issue #352 で
 *  generation_id が出なくなり、この cron は毎日 $0 を報告していた。）
 */
interface TokenRow {
  input_tokens: number | null;
  output_tokens: number | null;
  model?: string | null;
}

const tableResults: {
  fermentation_results: { data: TokenRow[] | null; error: { message: string } | null };
  photo_transcription_usages: { data: TokenRow[] | null; error: { message: string } | null };
} = {
  fermentation_results: { data: [], error: null },
  photo_transcription_usages: { data: [], error: null },
};

const supabaseClientState = { shouldThrow: false };

vi.mock('@/contexts/shared/infrastructure/supabase-client.js', () => ({
  getSupabaseClient: () => {
    if (supabaseClientState.shouldThrow) {
      throw new Error('supabase init failed');
    }
    return {
      from: (table: 'fermentation_results' | 'photo_transcription_usages') => ({
        select: () => ({
          gte: () => ({
            lte: () => Promise.resolve(tableResults[table]),
          }),
        }),
      }),
    };
  },
}));

import { cronCostAlert } from '@/contexts/shared/presentation/routes/cron-cost-alert.js';

function createApp() {
  return new Hono().route('/cron', cronCostAlert);
}

const SECRET = 'test-cron-secret';
const validHeaders = { Authorization: `Bearer ${SECRET}` };

describe('cronCostAlert', () => {
  beforeEach(() => {
    mockNotifyDiscord.mockClear();
    tableResults.fermentation_results = { data: [], error: null };
    tableResults.photo_transcription_usages = { data: [], error: null };
    supabaseClientState.shouldThrow = false;
    vi.stubEnv('CRON_SECRET', SECRET);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns 500 and notifies Discord when CRON_SECRET is missing', async () => {
    vi.stubEnv('CRON_SECRET', '');
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const res = await createApp().request('/cron', { method: 'POST' });

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'CRON_SECRET not configured' });
    expect(errorSpy).toHaveBeenCalledWith('[cron-cost-alert] CRON_SECRET not configured');
    expect(mockNotifyDiscord).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'コスト cron: CRON_SECRET 未設定',
        color: COLORS.ERROR,
      }),
    );

    errorSpy.mockRestore();
  });

  it('returns 401 and notifies Discord when Authorization mismatches', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const res = await createApp().request('/cron', {
      method: 'POST',
      headers: { Authorization: 'Bearer wrong' },
    });

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'Unauthorized' });
    expect(mockNotifyDiscord).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'コスト cron: 認証失敗', color: COLORS.ERROR }),
    );

    errorSpy.mockRestore();
  });

  it('returns 500 and notifies Discord when Supabase query fails', async () => {
    tableResults.fermentation_results = { data: null, error: { message: 'permission denied' } };
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const res = await createApp().request('/cron', { method: 'POST', headers: validHeaders });

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'permission denied' });
    expect(mockNotifyDiscord).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'コスト cron: Supabase クエリ失敗',
        description: 'permission denied',
        color: COLORS.ERROR,
      }),
    );

    errorSpy.mockRestore();
  });

  // 発酵だけ数えていると、写真の文字起こし分が丸ごと抜ける。
  it('発酵と文字起こしのコストを合算する', async () => {
    // sonnet-4-6: 1000 in / 1000 out = 0.003 + 0.015 = 0.018
    tableResults.fermentation_results = {
      data: [{ input_tokens: 1000, output_tokens: 1000 }],
      error: null,
    };
    // haiku-4-5: 1000 in / 1000 out = 0.001 + 0.005 = 0.006
    tableResults.photo_transcription_usages = {
      data: [{ model: 'claude-haiku-4-5', input_tokens: 1000, output_tokens: 1000 }],
      error: null,
    };

    const res = await createApp().request('/cron', { method: 'POST', headers: validHeaders });

    const body = await res.json();
    expect(body.totalCost).toBeCloseTo(0.024, 6);
    expect(body.recordCount).toBe(2);
  });

  it('文字起こしはモデル別の単価で計算する', async () => {
    tableResults.photo_transcription_usages = {
      data: [{ model: 'claude-opus-5', input_tokens: 1000, output_tokens: 1000 }],
      error: null,
    };

    const res = await createApp().request('/cron', { method: 'POST', headers: validHeaders });

    // opus-5: 1000 * 5/1e6 + 1000 * 25/1e6 = 0.03
    expect((await res.json()).totalCost).toBeCloseTo(0.03, 6);
  });

  it('sends INFO Discord notification when total cost is below threshold', async () => {
    tableResults.fermentation_results = {
      data: [{ input_tokens: 1000, output_tokens: 1000 }],
      error: null,
    };

    const res = await createApp().request('/cron', { method: 'POST', headers: validHeaders });

    expect(res.status).toBe(200);
    expect((await res.json()).thresholdExceeded).toBe(false);
    expect(mockNotifyDiscord).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'AI コスト日次レポート', color: COLORS.INFO }),
    );
  });

  it('sends ERROR Discord notification when total cost exceeds threshold', async () => {
    // 1M in / 1M out = 3 + 15 = $18
    tableResults.fermentation_results = {
      data: [{ input_tokens: 1_000_000, output_tokens: 1_000_000 }],
      error: null,
    };

    const res = await createApp().request('/cron', { method: 'POST', headers: validHeaders });

    expect(res.status).toBe(200);
    expect((await res.json()).thresholdExceeded).toBe(true);
    expect(mockNotifyDiscord).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'AI コスト警告 — 閾値超過',
        color: COLORS.ERROR,
      }),
    );
  });

  it('使用が無い日は $0 で INFO 報告する', async () => {
    const res = await createApp().request('/cron', { method: 'POST', headers: validHeaders });

    const body = await res.json();
    expect(body.totalCost).toBe(0);
    expect(body.recordCount).toBe(0);
    expect(mockNotifyDiscord).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'AI コスト日次レポート' }),
    );
  });

  it('returns 500 and notifies Discord ERROR when an unexpected error is thrown', async () => {
    supabaseClientState.shouldThrow = true;
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const res = await createApp().request('/cron', { method: 'POST', headers: validHeaders });

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({
      error: 'Internal Server Error',
      message: 'supabase init failed',
    });
    expect(mockNotifyDiscord).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'コスト cron: 実行中にエラー',
        description: 'supabase init failed',
        color: COLORS.ERROR,
      }),
    );

    errorSpy.mockRestore();
  });
});
