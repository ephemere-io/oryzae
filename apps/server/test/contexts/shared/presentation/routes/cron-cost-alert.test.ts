import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockNotifyDiscord = vi.fn();

vi.mock('@/contexts/shared/infrastructure/discord-notify.js', () => ({
  COLORS: { SUCCESS: 1, WARNING: 2, ERROR: 3, INFO: 4 },
  notifyDiscord: (...args: unknown[]) => mockNotifyDiscord(...args),
}));

import { COLORS } from '@/contexts/shared/infrastructure/discord-notify.js';

// Supabase クエリ結果をテストごとに差し替える。
const mockSupabaseResult: {
  data: { generation_id: string }[] | null;
  error: { message: string } | null;
} = {
  data: [],
  error: null,
};

// getSupabaseClient が throw する系のテスト用フラグ。
const supabaseClientState = { shouldThrow: false };

vi.mock('@/contexts/shared/infrastructure/supabase-client.js', () => ({
  getSupabaseClient: () => {
    if (supabaseClientState.shouldThrow) {
      throw new Error('supabase init failed');
    }
    return {
      from: () => ({
        select: () => ({
          not: () => ({
            gte: () => ({
              lte: () => Promise.resolve(mockSupabaseResult),
            }),
          }),
        }),
      }),
    };
  },
}));

// ai gateway.getGenerationInfo は LLM コスト取得。テストごとに振る舞いを差し替える。
const mockGetGenerationInfo = vi.fn();
vi.mock('ai', () => ({
  gateway: {
    getGenerationInfo: (...args: unknown[]) => mockGetGenerationInfo(...args),
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
    mockGetGenerationInfo.mockReset();
    mockSupabaseResult.data = [];
    mockSupabaseResult.error = null;
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
    expect(errorSpy).toHaveBeenCalledWith('[cron-cost-alert] Unauthorized request', {
      hasAuthHeader: true,
    });
    expect(mockNotifyDiscord).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'コスト cron: 認証失敗', color: COLORS.ERROR }),
    );

    errorSpy.mockRestore();
  });

  it('returns 500 and notifies Discord when Supabase query fails', async () => {
    mockSupabaseResult.error = { message: 'permission denied' };
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const res = await createApp().request('/cron', { method: 'POST', headers: validHeaders });

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'permission denied' });
    expect(errorSpy).toHaveBeenCalledWith('[cron-cost-alert] Supabase query failed', {
      error: 'permission denied',
    });
    expect(mockNotifyDiscord).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'コスト cron: Supabase クエリ失敗',
        description: 'permission denied',
        color: COLORS.ERROR,
      }),
    );

    errorSpy.mockRestore();
  });

  it('sends INFO Discord notification when total cost is below threshold', async () => {
    mockSupabaseResult.data = [{ generation_id: 'g1' }, { generation_id: 'g2' }];
    mockGetGenerationInfo
      .mockResolvedValueOnce({ totalCost: 0.1 })
      .mockResolvedValueOnce({ totalCost: 0.2 });

    const res = await createApp().request('/cron', { method: 'POST', headers: validHeaders });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.thresholdExceeded).toBe(false);
    expect(body.trackedCount).toBe(2);
    expect(mockNotifyDiscord).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'AI コスト日次レポート', color: COLORS.INFO }),
    );
  });

  it('sends ERROR Discord notification when total cost exceeds threshold', async () => {
    mockSupabaseResult.data = [{ generation_id: 'g1' }];
    mockGetGenerationInfo.mockResolvedValueOnce({ totalCost: 2.5 });

    const res = await createApp().request('/cron', { method: 'POST', headers: validHeaders });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.thresholdExceeded).toBe(true);
    expect(mockNotifyDiscord).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'AI コスト警告 — 閾値超過',
        color: COLORS.ERROR,
      }),
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
    expect(errorSpy).toHaveBeenCalledWith('[cron-cost-alert] execution failed', {
      error: 'supabase init failed',
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
