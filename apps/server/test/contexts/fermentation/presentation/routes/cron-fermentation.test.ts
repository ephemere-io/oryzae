import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockNotifyDiscord = vi.fn();

vi.mock('@/contexts/shared/infrastructure/discord-notify.js', () => ({
  COLORS: { SUCCESS: 1, WARNING: 2, ERROR: 3, INFO: 4 },
  notifyDiscord: (...args: unknown[]) => mockNotifyDiscord(...args),
}));

import { COLORS } from '@/contexts/shared/infrastructure/discord-notify.js';

// supabase-client は使われた瞬間に env チェックで throw するので mock。
vi.mock('@/contexts/shared/infrastructure/supabase-client.js', () => ({
  getSupabaseClient: () => ({
    from: () => ({
      select: () => ({
        limit: () => Promise.resolve({ data: [], error: null }),
      }),
    }),
  }),
}));

// 発酵 usecase は execute をテストごとに差し替える。
const mockExecute = vi.fn();
vi.mock('@/contexts/fermentation/application/usecases/scheduled-fermentation.usecase.js', () => ({
  ScheduledFermentationUsecase: vi.fn().mockImplementation(() => ({
    execute: (now: Date) => mockExecute(now),
  })),
}));

import { cronFermentation } from '@/contexts/fermentation/presentation/routes/cron-fermentation.js';

function createApp() {
  return new Hono().route('/cron', cronFermentation);
}

const SECRET = 'test-cron-secret';
const validHeaders = { Authorization: `Bearer ${SECRET}` };

const successResult = {
  totalUsers: 5,
  eligibleUsers: 2,
  totalFermentations: 3,
  succeeded: 3,
  failed: 0,
  errors: [],
  emailFailures: [],
};

describe('cronFermentation', () => {
  beforeEach(() => {
    mockNotifyDiscord.mockClear();
    mockExecute.mockReset();
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
    expect(errorSpy).toHaveBeenCalledWith('[cron-fermentation] CRON_SECRET not configured');
    expect(mockNotifyDiscord).toHaveBeenCalledTimes(1);
    expect(mockNotifyDiscord).toHaveBeenCalledWith(
      expect.objectContaining({
        title: '発酵 cron: CRON_SECRET 未設定',
        color: COLORS.ERROR,
      }),
    );
    expect(mockExecute).not.toHaveBeenCalled();

    errorSpy.mockRestore();
  });

  it('returns 401 and notifies Discord when Authorization mismatches', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await createApp().request('/cron', {
      method: 'POST',
      headers: { Authorization: 'Bearer wrong-secret' },
    });

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'Unauthorized' });
    expect(errorSpy).toHaveBeenCalledWith('[cron-fermentation] Unauthorized request', {
      hasAuthHeader: true,
    });
    expect(mockNotifyDiscord).toHaveBeenCalledWith(
      expect.objectContaining({ title: '発酵 cron: 認証失敗', color: COLORS.ERROR }),
    );
    expect(mockExecute).not.toHaveBeenCalled();

    errorSpy.mockRestore();
  });

  it('returns 200 and notifies Discord SUCCESS on clean run', async () => {
    mockExecute.mockResolvedValue(successResult);

    const res = await createApp().request('/cron', {
      method: 'POST',
      headers: validHeaders,
    });

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({ message: 'Scheduled fermentation completed', succeeded: 3 });
    expect(mockNotifyDiscord).toHaveBeenCalledTimes(1);
    expect(mockNotifyDiscord).toHaveBeenCalledWith(
      expect.objectContaining({ title: '発酵 cron: 完了', color: COLORS.SUCCESS }),
    );
  });

  it('notifies Discord WARNING when there are failures', async () => {
    mockExecute.mockResolvedValue({
      ...successResult,
      succeeded: 2,
      failed: 1,
      errors: [{ userId: 'u1', questionId: 'q1', error: 'boom' }],
    });

    const res = await createApp().request('/cron', {
      method: 'POST',
      headers: validHeaders,
    });

    expect(res.status).toBe(200);
    expect(mockNotifyDiscord).toHaveBeenCalledWith(
      expect.objectContaining({ title: '発酵 cron: 完了（一部失敗）', color: COLORS.WARNING }),
    );
  });

  it('notifies Discord WARNING when only email failures occurred', async () => {
    mockExecute.mockResolvedValue({
      ...successResult,
      emailFailures: [{ userId: 'u1', error: 'resend down' }],
    });

    await createApp().request('/cron', { method: 'POST', headers: validHeaders });

    expect(mockNotifyDiscord).toHaveBeenCalledWith(
      expect.objectContaining({ color: COLORS.WARNING }),
    );
  });

  it('returns 500 and notifies Discord ERROR when execute throws', async () => {
    mockExecute.mockRejectedValue(new Error('db down'));

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = await createApp().request('/cron', {
      method: 'POST',
      headers: validHeaders,
    });

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'Internal Server Error', message: 'db down' });
    expect(errorSpy).toHaveBeenCalledWith('[cron-fermentation] execution failed', {
      error: 'db down',
    });
    expect(mockNotifyDiscord).toHaveBeenCalledWith(
      expect.objectContaining({
        title: '発酵 cron: 実行中にエラー',
        description: 'db down',
        color: COLORS.ERROR,
      }),
    );

    errorSpy.mockRestore();
  });
});
