import { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockNotifyDiscord = vi.fn();

vi.mock('@/contexts/shared/infrastructure/discord-notify.js', () => ({
  COLORS: { SUCCESS: 1, WARNING: 2, ERROR: 3, INFO: 4 },
  notifyDiscord: (...args: unknown[]) => mockNotifyDiscord(...args),
}));

import { COLORS } from '@/contexts/shared/infrastructure/discord-notify.js';
import { createCronAuthMiddleware } from '@/contexts/shared/presentation/middleware/cron-auth.js';

const SECRET = 'test-cron-secret';

function createApp() {
  return new Hono()
    .use(
      '*',
      createCronAuthMiddleware({
        routeName: 'test-cron',
        discordTitlePrefix: 'テスト cron',
      }),
    )
    .post('/run', (c) => c.json({ ok: true }));
}

describe('createCronAuthMiddleware', () => {
  beforeEach(() => {
    mockNotifyDiscord.mockClear();
    vi.stubEnv('CRON_SECRET', SECRET);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns 500, logs, and notifies Discord when CRON_SECRET is missing', async () => {
    vi.stubEnv('CRON_SECRET', '');
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const res = await createApp().request('/run', { method: 'POST' });

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'CRON_SECRET not configured' });
    expect(errorSpy).toHaveBeenCalledWith('[test-cron] CRON_SECRET not configured');
    expect(mockNotifyDiscord).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'テスト cron: CRON_SECRET 未設定',
        color: COLORS.ERROR,
      }),
    );

    errorSpy.mockRestore();
  });

  it('returns 401, logs, and notifies Discord when Authorization is absent', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const res = await createApp().request('/run', { method: 'POST' });

    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'Unauthorized' });
    expect(errorSpy).toHaveBeenCalledWith('[test-cron] Unauthorized request', {
      hasAuthHeader: false,
    });
    expect(mockNotifyDiscord).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'テスト cron: 認証失敗', color: COLORS.ERROR }),
    );

    errorSpy.mockRestore();
  });

  it('returns 401 with hasAuthHeader=true when Authorization is wrong', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const res = await createApp().request('/run', {
      method: 'POST',
      headers: { Authorization: 'Bearer wrong' },
    });

    expect(res.status).toBe(401);
    expect(errorSpy).toHaveBeenCalledWith('[test-cron] Unauthorized request', {
      hasAuthHeader: true,
    });

    errorSpy.mockRestore();
  });

  it('passes through to the next handler when CRON_SECRET matches', async () => {
    const res = await createApp().request('/run', {
      method: 'POST',
      headers: { Authorization: `Bearer ${SECRET}` },
    });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(mockNotifyDiscord).not.toHaveBeenCalled();
  });
});
