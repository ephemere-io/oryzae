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

// issue #353: リトライ usecase も差し替える（既定はクリーンな no-op）。
const mockRetryExecute = vi.fn();
vi.mock(
  '@/contexts/fermentation/application/usecases/retry-failed-fermentations.usecase.js',
  () => ({
    RetryFailedFermentationsUsecase: vi.fn().mockImplementation(() => ({
      execute: (now: Date) => mockRetryExecute(now),
    })),
  }),
);

const emptyRetryResult = {
  totalCandidates: 0,
  truncated: 0,
  attempted: 0,
  succeeded: 0,
  failed: 0,
  skipped: 0,
  errors: [],
  emailFailures: [],
};

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
    mockRetryExecute.mockReset();
    mockRetryExecute.mockResolvedValue(emptyRetryResult);
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

  it('notifies Discord ERROR with the failure reason when fermentations fail', async () => {
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
      expect.objectContaining({ title: '発酵 cron: 完了（一部失敗）', color: COLORS.ERROR }),
    );
    // 失敗理由フィールドが添付されていること。
    const embed = mockNotifyDiscord.mock.calls[0][0];
    const reasonField = embed.fields.find((f: { name: string }) => f.name === '失敗理由');
    expect(reasonField?.value).toBe('boom');
  });

  it('collapses identical failure reasons into one `N× ` line (retire scenario)', async () => {
    mockExecute.mockResolvedValue({
      ...successResult,
      succeeded: 0,
      failed: 3,
      errors: [
        { userId: 'u1', questionId: 'q1', error: 'model: claude-sonnet-4-20250514' },
        { userId: 'u2', questionId: 'q2', error: 'model: claude-sonnet-4-20250514' },
        { userId: 'u3', questionId: 'q3', error: 'model: claude-sonnet-4-20250514' },
      ],
    });

    await createApp().request('/cron', { method: 'POST', headers: validHeaders });

    const embed = mockNotifyDiscord.mock.calls[0][0];
    const reasonField = embed.fields.find((f: { name: string }) => f.name === '失敗理由');
    expect(reasonField?.value).toBe('3× model: claude-sonnet-4-20250514');
    expect(reasonField?.value.length).toBeLessThanOrEqual(1024);
    expect(embed.color).toBe(COLORS.ERROR);
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

  // issue #353: sweep 後のリトライ段。
  describe('retry phase (issue #353)', () => {
    it('runs the retry usecase with the same `now` as the sweep', async () => {
      mockExecute.mockResolvedValue(successResult);

      await createApp().request('/cron', { method: 'POST', headers: validHeaders });

      expect(mockRetryExecute).toHaveBeenCalledOnce();
      // sweep とリトライへ渡る Date が同一インスタンスであること。
      expect(mockRetryExecute.mock.calls[0][0]).toBe(mockExecute.mock.calls[0][0]);
    });

    it('adds a retry summary field when there were candidates', async () => {
      mockExecute.mockResolvedValue(successResult);
      mockRetryExecute.mockResolvedValue({
        ...emptyRetryResult,
        totalCandidates: 2,
        attempted: 2,
        succeeded: 2,
      });

      await createApp().request('/cron', { method: 'POST', headers: validHeaders });

      const embed = mockNotifyDiscord.mock.calls[0][0];
      const retryField = embed.fields.find((f: { name: string }) => f.name === 'リトライ');
      expect(retryField?.value).toContain('候補:2');
      expect(retryField?.value).toContain('成功:2');
      // リトライが全て成功なら全体は SUCCESS のまま。
      expect(embed.color).toBe(COLORS.SUCCESS);
    });

    it('marks the run as failed (ERROR) when a retry fails', async () => {
      mockExecute.mockResolvedValue(successResult);
      mockRetryExecute.mockResolvedValue({
        ...emptyRetryResult,
        totalCandidates: 1,
        attempted: 1,
        failed: 1,
        errors: [{ userId: 'u1', fermentationResultId: 'f1', error: 'still failing' }],
      });

      await createApp().request('/cron', { method: 'POST', headers: validHeaders });

      const embed = mockNotifyDiscord.mock.calls[0][0];
      expect(embed.title).toBe('発酵 cron: 完了（一部失敗）');
      expect(embed.color).toBe(COLORS.ERROR);
      const reasonField = embed.fields.find((f: { name: string }) => f.name === 'リトライ失敗理由');
      expect(reasonField?.value).toBe('still failing');
    });

    it('does not fail the whole cron when the retry phase throws', async () => {
      mockExecute.mockResolvedValue(successResult);
      mockRetryExecute.mockRejectedValue(new Error('retry list query failed'));
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const res = await createApp().request('/cron', { method: 'POST', headers: validHeaders });

      // sweep は成功しているので 200。リトライエラーは summary に添えるだけ。
      expect(res.status).toBe(200);
      const embed = mockNotifyDiscord.mock.calls[0][0];
      expect(embed.color).toBe(COLORS.ERROR);
      const errField = embed.fields.find((f: { name: string }) => f.name === 'リトライ実行エラー');
      expect(errField?.value).toBe('retry list query failed');
      expect(errorSpy).toHaveBeenCalledWith('[cron-fermentation] retry phase failed', {
        error: 'retry list query failed',
      });

      errorSpy.mockRestore();
    });
  });
});
