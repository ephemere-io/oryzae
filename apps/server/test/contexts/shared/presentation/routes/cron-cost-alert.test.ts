import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockNotifyDiscord = vi.fn();

vi.mock('@/contexts/shared/infrastructure/discord-notify.js', () => ({
  COLORS: { SUCCESS: 1, WARNING: 2, ERROR: 3, INFO: 4 },
  notifyDiscord: (...args: unknown[]) => mockNotifyDiscord(...args),
}));

import { COLORS } from '@/contexts/shared/infrastructure/discord-notify.js';

// 前日のコストは Anthropic の Cost Report から引く。
// （以前は fermentation_results の generation_id を辿っていたが、issue #352 で
//  generation_id が出なくなり、この cron は毎日 $0 を報告していた。）
const mockFetchDailyCosts = vi.fn();
const costReportState = { shouldThrow: false };

vi.mock('@/contexts/shared/infrastructure/anthropic-cost-report.js', () => ({
  fetchDailyCosts: (...args: unknown[]) => {
    if (costReportState.shouldThrow) throw new Error('cost report init failed');
    return mockFetchDailyCosts(...args);
  },
  sumDailyCosts: (costs: { amountUsd: number }[]) =>
    costs.reduce((total, day) => total + day.amountUsd, 0),
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
    mockFetchDailyCosts.mockReset().mockResolvedValue([]);
    costReportState.shouldThrow = false;
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

  it('前日1日分を Cost Report に問い合わせる', async () => {
    await createApp().request('/cron', { method: 'POST', headers: validHeaders });

    const [startingAt, endingAt] = mockFetchDailyCosts.mock.calls[0];
    expect(startingAt).toMatch(/^\d{4}-\d{2}-\d{2}T00:00:00\.000Z$/);
    expect(endingAt).toMatch(/^\d{4}-\d{2}-\d{2}T23:59:59\.999Z$/);
    expect(startingAt.slice(0, 10)).toBe(endingAt.slice(0, 10));
  });

  // Cost Report が引けないなら黙って $0 と報告してはいけない（それが以前のバグ）。
  it('Cost Report を取得できないときは 500 にして Discord に知らせる', async () => {
    mockFetchDailyCosts.mockResolvedValue(null);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const res = await createApp().request('/cron', { method: 'POST', headers: validHeaders });

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'Cost report unavailable' });
    expect(mockNotifyDiscord).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'コスト cron: Cost Report を取得できません',
        color: COLORS.ERROR,
      }),
    );

    errorSpy.mockRestore();
  });

  it('sends INFO Discord notification when total cost is below threshold', async () => {
    mockFetchDailyCosts.mockResolvedValue([{ date: '2026-08-24', amountUsd: 0.3 }]);

    const res = await createApp().request('/cron', { method: 'POST', headers: validHeaders });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.thresholdExceeded).toBe(false);
    expect(body.totalCost).toBeCloseTo(0.3, 6);
    expect(mockNotifyDiscord).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'AI コスト日次レポート', color: COLORS.INFO }),
    );
  });

  it('sends ERROR Discord notification when total cost exceeds threshold', async () => {
    mockFetchDailyCosts.mockResolvedValue([{ date: '2026-08-24', amountUsd: 2.5 }]);

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
    costReportState.shouldThrow = true;
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const res = await createApp().request('/cron', { method: 'POST', headers: validHeaders });

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({
      error: 'Internal Server Error',
      message: 'cost report init failed',
    });
    expect(errorSpy).toHaveBeenCalledWith('[cron-cost-alert] execution failed', {
      error: 'cost report init failed',
    });
    expect(mockNotifyDiscord).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'コスト cron: 実行中にエラー',
        description: 'cost report init failed',
        color: COLORS.ERROR,
      }),
    );

    errorSpy.mockRestore();
  });
});
